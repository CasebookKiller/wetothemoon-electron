// src/main/services/gateway/cache/db.ts
//
// Singleton подключения к gateway.db.
// Путь передаётся снаружи (из main.ts). Без импорта electron.

import { DatabaseSync } from 'node:sqlite';
import fsSync from 'node:fs';
import path from 'node:path';
import {
  CREATE_SCHEMA_SQL,
  SCHEMA_VERSION,
  CREATE_FTS_SQL,
  CREATE_FILES_SQL,
} from './schema';
import { computeMessageHash } from './hash';
import type { MessageRole } from './types';
import { migrateToV6 } from './migrations/v6';
import { migrateToV7 } from './migrations/v7';
import { migrateToV8 } from './migrations/v8';

let db: DatabaseSync | null = null;
let gatewayFilesDir: string | null = null;

export function getGatewayFilesDir(): string {
  if (!gatewayFilesDir) {
    throw new Error(
      '[GatewayCache] gateway_files не инициализирован. Вызовите openGatewayCache(dbPath).'
    );
  }
  return gatewayFilesDir;
}


export function openGatewayCache(dbPath: string): DatabaseSync {
  if (db) return db;

  console.log(`[GatewayCache] Открываем БД: ${dbPath}`);
  gatewayFilesDir = path.join(path.dirname(dbPath), 'gateway_files');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Директория для файлов — рядом с БД
  const filesDir = path.join(path.dirname(dbPath), 'gateway_files');
  try {
    fsSync.mkdirSync(filesDir, { recursive: true });
  } catch (e) {
    console.warn(
      '[GatewayCache] Не удалось создать gateway_files:',
      (e as Error).message
    );
  }

  try {
    applySchema(db);
    ensureAllMessagesHashed(db);
    console.log('[GatewayCache] Схема готова');
  } catch (e) {
    console.error('[GatewayCache] Ошибка инициализации схемы:', e);
    db.close();
    db = null;
    throw e;
  }

  return db;
}

export function getGatewayCache(): DatabaseSync {
  if (!db) {
    throw new Error(
      '[GatewayCache] БД не инициализирована. Вызовите openGatewayCache(dbPath) при старте приложения.'
    );
  }
  return db;
}

export function isGatewayCacheOpen(): boolean {
  return db !== null;
}

export function closeGatewayCache(): void {
  if (db) {
    db.close();
    db = null;
    gatewayFilesDir = null;
    console.log('[GatewayCache] БД закрыта');
  }
}

// ---------- Применение схемы + миграции (по образцу pranaBindu/melange) ----------

interface Migration {
  version: number;
  apply: (db: DatabaseSync) => void;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    apply: (database) => {
      database.exec(CREATE_SCHEMA_SQL);
      try {
        database.exec(CREATE_FTS_SQL);
        console.log('[GatewayCache] FTS5 доступен');
      } catch (e) {
        console.warn(
          '[GatewayCache] FTS5 недоступен, поиск будет через LIKE:',
          (e as Error).message
        );
      }
    },
  },
  {
    version: 2,
    apply: (database) => {
      console.log(
        '[GatewayCache] Миграция v2: message_hash, pw_key, last_synced_at, pending_edits'
      );

      addColumnIfMissing(database, 'messages', 'message_hash', 'TEXT');
      addColumnIfMissing(database, 'messages', 'pw_key', 'TEXT');
      addColumnIfMissing(database, 'conversations', 'last_synced_at', 'INTEGER');
      addColumnIfMissing(database, 'conversations', 'pending_edits', 'INTEGER DEFAULT 0');

      // Пока идёт backfill — дропаем messages_au, чтобы не дёргать FTS
      // на каждый UPDATE messages
      const hadUpdateTrigger = !!database
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='messages_au'"
        )
        .get();

      if (hadUpdateTrigger) {
        database.exec('DROP TRIGGER IF EXISTS messages_au');
      }

      try {
        backfillMessageHashes(database);
      } finally {
        if (hadUpdateTrigger) {
          try {
            // CREATE_FTS_SQL идемпотентен — пересоздаст только удалённый триггер
            database.exec(CREATE_FTS_SQL);
          } catch (e) {
            console.warn(
              '[GatewayCache] Не удалось восстановить FTS-триггер messages_au:',
              (e as Error).message
            );
          }
        }
      }

      // v8 заменит это на UNIQUE(profile_id, message_hash).
      // На свежих БД индекс всё равно создаётся в v2, чтобы v7→v8 миграция
      // работала одинаково на любых БД (legacy и fresh).
      database.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_hash ON messages(message_hash)'
      );
    },
  },
  {
    version: 3,
    apply: (database) => {
      console.log(
        '[GatewayCache] Миграция v3: file_blobs + message_files (+ триггеры ref_count)'
      );
      database.exec(CREATE_FILES_SQL);
      console.log('[GatewayCache] Миграция v3 завершена');
    },
  },
  {
    version: 4,
    apply: (database) => {
      console.log('[GatewayCache] Миграция v4: branching (branch_total, branch_index)');
      addColumnIfMissing(database, 'messages', 'branch_total', 'INTEGER DEFAULT 1');
      addColumnIfMissing(database, 'messages', 'branch_index', 'INTEGER DEFAULT 1');
    },
  },
  {
    version: 5,
    apply: (database) => {
      console.log('[GatewayCache] Миграция v5: is_active для веток');
      addColumnIfMissing(database, 'messages', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_active
          ON messages(conversation_id, is_active);
      `);
      console.log('[GatewayCache] Миграция v5 завершена');
    },
  },
  {
    version: 6,
    apply: (database) => {
      console.log(
        '[GatewayCache] Миграция v6: resources, tool-registry, async-tasks, ' +
        'sandboxes, agents, pipelines'
      );
      migrateToV6(database);
      console.log('[GatewayCache] Миграция v6 завершена');
    },
  },
  {
    version: 7,
    apply: (database) => {
      console.log('[GatewayCache] Миграция v7: sources_json для web-источников');
      migrateToV7(database);
    },
  },
  {
    version: 8,
    apply: (database) => {
      console.log('[GatewayCache] Миграция v8: profile_id (multi-profile)');
      migrateToV8(database);
      console.log('[GatewayCache] Миграция v8 завершена');
    },
  },
];

function applySchema(database: DatabaseSync): void {
  const row = database.prepare('PRAGMA user_version').get() as
    | { user_version: number }
    | undefined;
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migration.apply(database);
      // user_version фиксируем ПОСЛЕ каждой успешной миграции
      database.exec(`PRAGMA user_version = ${migration.version}`);
      console.log(`[GatewayCache] Применена миграция v${migration.version}`);
    }
  }
}

// ---------- Утилиты миграций ----------

function addColumnIfMissing(
  database: DatabaseSync,
  table: string,
  column: string,
  type: string
): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (cols.some((c) => c.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  console.log(`[GatewayCache] Добавлена колонка ${table}.${column}`);
}

function backfillMessageHashes(database: DatabaseSync): void {
  const convIds = database
    .prepare('SELECT DISTINCT conversation_id FROM messages')
    .all() as Array<{ conversation_id: string }>;

  if (convIds.length === 0) {
    console.log('[GatewayCache] Backfill: сообщений нет, пропускаем');
    return;
  }

  const selectStmt = database.prepare(
    'SELECT id, role, content_plain, sequence FROM messages WHERE conversation_id = ? ORDER BY sequence ASC'
  );
  const updateStmt = database.prepare(
    'UPDATE messages SET message_hash = ?, pw_key = ?, sequence = ? WHERE id = ?'
  );

  let total = 0;
  database.exec('BEGIN');
  try {
    for (const { conversation_id } of convIds) {
      const rows = selectStmt.all(conversation_id) as Array<{
        id: string;
        role: string;
        content_plain: string;
        sequence: number;
      }>;
      let parentHash: string | undefined;
      for (const row of rows) {
        const pwKey = extractPwKey(row.id, conversation_id);
        // salt: pwKey стабилен; parentHash — fallback
        const salt = pwKey ?? parentHash;
        const hash = computeMessageHash(
          conversation_id,
          row.role as MessageRole,
          row.content_plain,
          salt
        );
        // sequence восстанавливаем из pwKey (реальная позиция),
        // fallback — существующее значение
        const sequence = pwKey ? parseInt(pwKey, 10) : row.sequence;
        updateStmt.run(hash, pwKey, sequence, row.id);
        parentHash = hash;
        total++;
      }
    }
    database.exec('COMMIT');
    console.log(
      `[GatewayCache] Backfill message_hash: ${total} сообщений в ${convIds.length} диалогах`
    );
  } catch (e) {
    database.exec('ROLLBACK');
    throw e;
  }
}

/**
 * Восстанавливает pw_key из старого id.
 * id = `${convId}_<digits>` для сообщений с DOM-ключом,
 * иначе — null (hash-based).
 */
function extractPwKey(id: string, convId: string): string | null {
  const prefix = convId + '_';
  if (!id.startsWith(prefix)) return null;
  const rest = id.slice(prefix.length);
  return /^\d+$/.test(rest) ? rest : null;
}

/**
 * Страховка: если после миграции/старых sync-вставок остались
 * сообщения без message_hash, добить их backfill-ом.
 * Идемпотентно (детерминированный hash-чейн по sequence).
 */
function ensureAllMessagesHashed(database: DatabaseSync): void {
  const row = database
    .prepare('SELECT COUNT(*) AS c FROM messages WHERE message_hash IS NULL')
    .get() as { c: number };
  if (!row || row.c === 0) return;
  console.log(
    `[GatewayCache] Найдено ${row.c} сообщений без message_hash — backfill`
  );

  // Тот же приём, что и в миграции v2: пока идёт backfill,
  // не дёргаем messages_au (иначе каждый UPDATE делает полный
  // скан FTS из-за message_id UNINDEXED).
  const hadUpdateTrigger = !!database
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='messages_au'"
    )
    .get();

  if (hadUpdateTrigger) {
    database.exec('DROP TRIGGER IF EXISTS messages_au');
  }

  try {
    backfillMessageHashes(database);
  } finally {
    if (hadUpdateTrigger) {
      try {
        database.exec(CREATE_FTS_SQL);
      } catch (e) {
        console.warn(
          '[GatewayCache] Не удалось восстановить FTS-триггер messages_au:',
          (e as Error).message
        );
      }
    }
  }
}