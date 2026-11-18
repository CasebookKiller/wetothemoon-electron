// src/main/services/gateway/cache/migrations/v9.ts
//
// v9: долговременная память и агенты.
//
//   - context_nodes      — иерархия контекстов разработки
//                          (global → project → submodule → module → direction)
//   - context_versions   — история изменений каждого узла
//   - context_workspaces — workspace per conversation (вариант C)
//   - tasks              — задачи, которые ставят пользователь и агенты
//
// ИНВАРИАНТЫ:
//   - kind, status, priority — TEXT, не enum. Новые уровни/статусы
//     добавляются без миграции схемы.
//   - context_nodes.key — стабильный путь через '/' (например,
//     'wetothemoon-electron/gateway/patchright'). Используется для
//     LIKE 'prefix%' запросов и как внешний ключ в tasks.context_key.
//   - tasks.context_key — БЕЗ FK намеренно: если direction переименуется,
//     задачи не теряются (FK был бы RESTRICT/CASCADE — оба плохо).
//   - content_hash — sha256 содержимого. Меняется → новая строка в
//     context_versions, обновляется context_nodes.version.
//   - Workspaces per conversation: 1 conversation → 0 или 1 workspace
//     (уникальный индекс по conversation_id, где conversation_id NOT NULL).
//     Workspace без conversation_id — шаблон (можно клонировать в чат).

import type { DatabaseSync } from 'node:sqlite';

export function migrateToV9(database: DatabaseSync): void {
  // ─── 1. context_nodes — иерархия контекстов ────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS context_nodes (
      id            TEXT PRIMARY KEY,
      parent_id     TEXT,
      key           TEXT NOT NULL UNIQUE,
      kind          TEXT NOT NULL,
      title         TEXT NOT NULL,
      content_md    TEXT NOT NULL DEFAULT '',
      content_hash  TEXT NOT NULL DEFAULT '',
      version       INTEGER NOT NULL DEFAULT 1,
      git_sha       TEXT,
      git_branch    TEXT,
      source_file   TEXT,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES context_nodes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_context_nodes_parent
      ON context_nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_context_nodes_kind
      ON context_nodes(kind);
    CREATE INDEX IF NOT EXISTS idx_context_nodes_key
      ON context_nodes(key);
    CREATE INDEX IF NOT EXISTS idx_context_nodes_hash
      ON context_nodes(content_hash);
  `);

  // ─── 2. context_versions — история изменений ─────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS context_versions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id         TEXT NOT NULL,
      version         INTEGER NOT NULL,
      content_md      TEXT NOT NULL,
      content_hash    TEXT NOT NULL,
      change_summary  TEXT,
      git_sha         TEXT,
      created_at      INTEGER NOT NULL,
      UNIQUE (node_id, version),
      FOREIGN KEY (node_id) REFERENCES context_nodes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_context_versions_node
      ON context_versions(node_id, version DESC);
  `);

  // ─── 3. context_workspaces — workspace per conversation ──────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS context_workspaces (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      conversation_id   TEXT,
      active_keys_json  TEXT NOT NULL DEFAULT '[]',
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_context_workspaces_conv_unique
      ON context_workspaces(conversation_id)
      WHERE conversation_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_context_workspaces_conv
      ON context_workspaces(conversation_id);
  `);

  // ─── 4. tasks — задачи пользователя и агентов ────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      priority        TEXT NOT NULL DEFAULT 'medium',
      context_key     TEXT,
      assignee        TEXT,
      created_by      TEXT NOT NULL,
      parent_task_id  TEXT,
      result          TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status_priority
      ON tasks(status, priority DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_context_key
      ON tasks(context_key);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent
      ON tasks(parent_task_id);
  `);

  console.log('[GatewayCache] v9: context_nodes, context_versions, context_workspaces, tasks — созданы');
}
