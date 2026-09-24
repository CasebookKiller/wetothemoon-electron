// src/main/services/pranaBindu/melange/seed.ts
//
// Начальное заполнение. Идемпотентно (INSERT OR IGNORE).
// 60 ступеней Big-6 — отложены до 05_CRYSKNIFE.md.

import type { DatabaseSync } from 'node:sqlite';
import { BIG6_MOVEMENTS } from '../crysknife/big6';

export function seed(db: DatabaseSync): void {
  seedMovements(db);
  seedProfile(db);
  seedSyncSettings(db);
}

function seedMovements(db: DatabaseSync): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO movements (id, code, name, order_index)
     VALUES (?, ?, ?, ?)`
  );
  for (const m of BIG6_MOVEMENTS) {
    stmt.run(m.id, m.code, m.name, m.orderIndex);
  }
}

function seedProfile(db: DatabaseSync): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO profile (id, created_at, updated_at)
     VALUES (1, ?, ?)`
  ).run(now, now);
}

function seedSyncSettings(db: DatabaseSync): void {
  db.prepare(
    `INSERT OR IGNORE INTO sync_settings (id, mode, auto_on_start)
     VALUES (1, 'manual', 0)`
  ).run();
}