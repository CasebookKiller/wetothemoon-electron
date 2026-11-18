// src/main/services/gateway/cache/migrations/v7.ts
import type { DatabaseSync } from 'node:sqlite';

export function migrateToV7(database: DatabaseSync): void {
  const cols = database.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'sources_json')) {
    database.exec(`ALTER TABLE messages ADD COLUMN sources_json TEXT`);
    console.log('[GatewayCache] v7: добавлена колонка messages.sources_json');
  }
}