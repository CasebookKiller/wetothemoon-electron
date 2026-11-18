// src/main/services/gateway/cache/migrations/v8.ts
//
// v8: profile_id в conversations и messages (multi-profile, см. ProfileService).
// Критично: DROP UNIQUE idx_messages_hash — иначе второй профиль с тем же
// message_hash (одинаковый промпт → одинаковый ответ) не запишется.
// Заменяется на UNIQUE(profile_id, message_hash) — та же дедупликация,
// но в рамках профиля.
import type { DatabaseSync } from 'node:sqlite';

export function migrateToV8(database: DatabaseSync): void {
  // 1) conversations.profile_id
  const convCols = database.prepare(`PRAGMA table_info(conversations)`).all() as Array<{ name: string }>;
  if (!convCols.some((c) => c.name === 'profile_id')) {
    database.exec(`ALTER TABLE conversations ADD COLUMN profile_id TEXT NOT NULL DEFAULT 'default'`);
  }
  database.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_profile ON conversations(profile_id)`);

  // 2) messages.profile_id
  const msgCols = database.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name: string }>;
  if (!msgCols.some((c) => c.name === 'profile_id')) {
    database.exec(`ALTER TABLE messages ADD COLUMN profile_id TEXT NOT NULL DEFAULT 'default'`);
  }

  // 3) Снять UNIQUE(message_hash), поставить UNIQUE(profile_id, message_hash)
  database.exec(`DROP INDEX IF EXISTS idx_messages_hash`);
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_profile_hash
      ON messages(profile_id, message_hash)
  `);

  // 4) Индекс для запросов по профилю
  database.exec(`CREATE INDEX IF NOT EXISTS idx_messages_profile ON messages(profile_id)`);

  // FTS/триггеры — без изменений: они работают по content_plain + conversation_id,
  // а profile_id при поиске восстанавливается JOIN'ом к conversations.
}