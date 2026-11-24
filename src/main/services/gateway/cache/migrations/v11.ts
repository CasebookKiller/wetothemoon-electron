// src/main/services/gateway/cache/migrations/v11.ts
//
// v11: conversations.position — сохранение порядка диалогов «как в GigaChat».
//
//   - position INTEGER (nullable) — индекс в сайдбаре GigaChat (0..N).
//     0..K = Избранные (в порядке из DOM), K+1.. = Недавние (в порядке из DOM).
//   - NULL → legacy/новый диалог без sync; в listConversations COALESCE → 999999
//     (оказывается в конце, но перед sort по last_message_at).
//
// ИНВАРИАНТЫ:
//   - position обновляется ТОЛЬКО через setConversationPositionAndPinned,
//     который вызывается из navigator:sync-conversations. Не через syncConversation.
//   - pinned и position синхронизируются вместе — это один snapshot из GigaChat.
//   - При новом sync-conversations position перезаписывается полностью.
//   - Если GigaChat отсортирует по-другому (изменит favorites/recent),
//     следующий sync всё поправит.

import type { DatabaseSync } from 'node:sqlite';

export function migrateToV11(database: DatabaseSync): void {
  // ALTER TABLE ADD COLUMN — если колонка уже есть (повторный вызов), SQLite кинет ошибку.
  // Ловим и логируем «already applied», не падаем.
  try {
    database.exec('ALTER TABLE conversations ADD COLUMN position INTEGER');
    console.log('[GatewayCache] v11: conversations.position — добавлена');
  } catch (e: any) {
    if (String(e?.message || '').includes('duplicate column')) {
      console.log('[GatewayCache] v11: conversations.position — уже существует');
    } else {
      throw e;
    }
  }

  // Индекс не критичен (данных мало), но полезен для ORDER BY
  try {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_position
        ON conversations(profile_id, pinned DESC, position ASC);
    `);
  } catch (e) {
    console.warn('[GatewayCache] v11: idx_conversations_position — skip:', e);
  }
}