// src/main/services/gateway/cache/migrations/v10.ts
//
// v10: handoff_preferences — сохранение выбора handoff per-profile.
//
//   - profile_id UNIQUE — один набор настроек на профиль
//   - selection_json   — { moduleId, preset, selectedTopics[], includeGit, includePreflight, includeSchema, includeIntent }
//   - preset           — 'all' | 'min' | 'topics-only' | 'custom' (TEXT, не enum — расширяемо)
//
// ИНВАРИАНТЫ:
//   - preset — TEXT, не CHECK. Новые presets добавляются без миграции схемы.
//   - selection_json — строка, парсится на стороне сервиса. Схема не валидирует JSON.
//   - updated_at — INTEGER (ms), для сортировки/дебага.

import type { DatabaseSync } from 'node:sqlite';

export function migrateToV10(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS handoff_preferences (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL,
      selection_json  TEXT NOT NULL DEFAULT '{}',
      preset          TEXT NOT NULL DEFAULT 'all',
      updated_at      INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_handoff_prefs_profile_unique
      ON handoff_preferences(profile_id);

    CREATE INDEX IF NOT EXISTS idx_handoff_prefs_updated
      ON handoff_preferences(updated_at DESC);
  `);

  console.log('[GatewayCache] v10: handoff_preferences — создана');
}