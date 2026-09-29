// src/main/services/pranaBindu/melange/migrations.ts

import type { DatabaseSync } from 'node:sqlite';
import {
  ALL_TABLES,
  ALL_INDEXES,
  CREATE_META,
  MIGRATION_V2_DODOFO,
  MIGRATION_V3_RUN_STREAMS,   // ← добавили
  MIGRATION_V5_FIT_ARCHIVE,   // ← добавьте
} from './schema';

export const SCHEMA_VERSION = 5;

interface Migration {
  version: number;
  apply: (db: DatabaseSync) => void;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    apply: (db) => {
      for (const sql of ALL_TABLES) db.exec(sql);
      for (const sql of ALL_INDEXES) db.exec(sql);
    },
  },
  {
    version: 2,
    apply: (db) => {
      // Колонки могут уже существовать, если v1 создавала таблицу
      // с ними. Проверяем через PRAGMA.
      const cols = db
        .prepare(`PRAGMA table_info(sync_settings)`)
        .all() as { name: string }[];
      const has = (name: string) => cols.some((c) => c.name === name);

      const addIfMissing: [string, string][] = [
        ['dodofo_token', 'TEXT'],
        ['dodofo_user_id', 'TEXT'],
        ['dodofo_username', 'TEXT'],
        ['dodofo_last_sync_at', 'TEXT'],
        ['dodofo_last_sync_status', 'TEXT'],
      ];

      for (const [name, type] of addIfMissing) {
        if (!has(name)) {
          db.exec(`ALTER TABLE sync_settings ADD COLUMN ${name} ${type};`);
          console.log(`[Melange] v2: добавлена колонка sync_settings.${name}`);
        }
      }
    },
  },
  {
    version: 3,
    apply: (db) => {
      for (const sql of MIGRATION_V3_RUN_STREAMS) db.exec(sql);
      console.log('[Melange] v3: создана таблица run_streams');
    },
  },
  {
    version: 4,
    apply: (db) => {
      // Проверяем, что колонки ещё нет — идемпотентность
      const cols = db
        .prepare(`PRAGMA table_info(run_facts)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('origin')) {
        db.exec(`ALTER TABLE run_facts ADD COLUMN origin TEXT;`);
        console.log('[Melange] v4: добавлена колонка run_facts.origin');
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_run_facts_origin ON run_facts(origin);`);
    },
  },
  {
    version: 5,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(sync_settings)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('fit_archive_path')) {
        db.exec(`ALTER TABLE sync_settings ADD COLUMN fit_archive_path TEXT;`);
        console.log('[Melange] v5: добавлена колонка sync_settings.fit_archive_path');
      }
    },
  },
];

function getCurrentVersion(db: DatabaseSync): number {
  const row = db
    .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
    .get() as { value: string } | undefined;
  if (!row) return 0;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setVersion(db: DatabaseSync, version: number): void {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(version));
}

export function applyMigrations(db: DatabaseSync): void {
  db.exec(CREATE_META);

  const current = getCurrentVersion(db);
  if (current >= SCHEMA_VERSION) return;

  for (const migration of migrations) {
    if (migration.version > current) {
      migration.apply(db);
      setVersion(db, migration.version);
      console.log(`[Melange] Применена миграция v${migration.version}`);
    }
  }
}