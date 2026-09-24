// src/main/services/pranaBindu/melange/migrations.ts
//
// Идемпотентные миграции. Версия схемы хранится в meta.schema_version.
// v1 — создание всех таблиц + индексов.

import type { DatabaseSync } from 'node:sqlite';
import { ALL_TABLES, ALL_INDEXES, CREATE_META } from './schema';

export const SCHEMA_VERSION = 1;

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
  // meta создаётся вне миграций — иначе некуда писать версию.
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