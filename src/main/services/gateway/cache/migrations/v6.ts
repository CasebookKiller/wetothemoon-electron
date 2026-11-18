// src/main/services/gateway/cache/migrations/v6.ts
//
// Миграция v5 → v6: универсальный реестр ресурсов, tool-registry,
// async-tasks, sandboxes, agents, pipelines.
//
// ИНВАРИАНТЫ:
//   - category / resource_kind / sandbox.kind — TEXT, не enum.
//     Новый модуль (osint, sietch, prana-bindu, bonds, budget, ...)
//     регистрируется через свой *.tools.json без изменения схемы.
//   - GW не знает про модули. GW знает про реестр.
//   - tool_registry_snapshot — кэш файлов tool-registry/*.json.
//     Источник правды — файлы, не БД.
//   - file_blobs НЕ переименовываем. resources — новая таблица.

import type { DatabaseSync } from 'node:sqlite';

export function migrateToV6(database: DatabaseSync): void {
  // ─── 1. resources — универсальный реестр источников ──────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      resource_key       TEXT PRIMARY KEY,
      resource_kind      TEXT NOT NULL,
      display_name       TEXT NOT NULL,
      metadata_json      TEXT NOT NULL DEFAULT '{}',
      latest_sha256      TEXT,
      latest_size_bytes  INTEGER,
      last_accessed_at   INTEGER NOT NULL,
      last_sent_at       INTEGER,
      memory_state       TEXT NOT NULL DEFAULT 'archive',
      memory_added_at    INTEGER,
      send_count         INTEGER NOT NULL DEFAULT 0,
      created_at         INTEGER NOT NULL,
      FOREIGN KEY (latest_sha256) REFERENCES file_blobs(sha256)
    );
    CREATE INDEX IF NOT EXISTS idx_resources_kind
      ON resources(resource_kind);
    CREATE INDEX IF NOT EXISTS idx_resources_last_sent
      ON resources(last_sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_resources_memory
      ON resources(memory_state) WHERE memory_state = 'memory';
  `);

  // ─── 2. resource_versions — только для kind='file' ───────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS resource_versions (
      resource_key   TEXT NOT NULL,
      sha256         TEXT NOT NULL,
      size_bytes     INTEGER NOT NULL,
      first_seen_at  INTEGER NOT NULL,
      last_sent_at   INTEGER NOT NULL,
      PRIMARY KEY (resource_key, sha256),
      FOREIGN KEY (resource_key) REFERENCES resources(resource_key) ON DELETE CASCADE,
      FOREIGN KEY (sha256)       REFERENCES file_blobs(sha256)
    );
    CREATE INDEX IF NOT EXISTS idx_resource_versions_sent
      ON resource_versions(last_sent_at DESC);
  `);

  // ─── 3. sandboxes — изолированные окружения ──────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS sandboxes (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      kind          TEXT NOT NULL,
      work_dir      TEXT NOT NULL,
      config_json   TEXT NOT NULL DEFAULT '{}',
      status        TEXT NOT NULL DEFAULT 'idle',
      last_used_at  INTEGER,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sandboxes_kind
      ON sandboxes(kind);
  `);

  // ─── 4. tool_registry_snapshot — кэш реестра tools ───────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS tool_registry_snapshot (
      name             TEXT PRIMARY KEY,
      version          INTEGER NOT NULL DEFAULT 1,
      category         TEXT NOT NULL,
      descriptor_json  TEXT NOT NULL,
      registered_at    INTEGER NOT NULL,
      last_seen_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tools_category
      ON tool_registry_snapshot(category);
  `);

  // ─── 5. async_tasks — универсальные задачи ───────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS async_tasks (
      task_id        TEXT PRIMARY KEY,
      tool_name      TEXT NOT NULL,
      tool_version   INTEGER NOT NULL,
      category       TEXT NOT NULL,
      args_json      TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'queued',
      progress       REAL DEFAULT 0,
      result_ref     TEXT,
      error          TEXT,
      created_at     INTEGER NOT NULL,
      started_at     INTEGER,
      completed_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_async_tasks_status
      ON async_tasks(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_async_tasks_category
      ON async_tasks(category);
  `);

  // ─── 6. tool_calls — журнал вызовов tools ────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS tool_calls (
      id                 TEXT PRIMARY KEY,
      conversation_id    TEXT NOT NULL,
      message_hash       TEXT,
      tool_name          TEXT NOT NULL,
      tool_version       INTEGER,
      args_json          TEXT NOT NULL,
      result_json        TEXT,
      status             TEXT NOT NULL,
      error              TEXT,
      resource_key       TEXT,
      sandbox_id         TEXT,
      async_task_id      TEXT,
      osint_artifact_ref TEXT,
      requested_at       INTEGER NOT NULL,
      executed_at        INTEGER,
      elapsed_ms         INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tool_calls_conv
      ON tool_calls(conversation_id, requested_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tool_calls_tool
      ON tool_calls(tool_name, requested_at DESC);
  `);

  // ─── 7. messages.has_tool_calls — быстрый поиск ──────────────────
  const messageCols = database
    .prepare(`PRAGMA table_info(messages)`)
    .all() as Array<{ name: string }>;
  if (!messageCols.some((c) => c.name === 'has_tool_calls')) {
    database.exec(
      `ALTER TABLE messages ADD COLUMN has_tool_calls INTEGER NOT NULL DEFAULT 0`
    );
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_has_tools
        ON messages(has_tool_calls) WHERE has_tool_calls = 1;
    `);
  }

  // ─── 8. agents — реестр агентов (мульти-агентность) ──────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id                  TEXT PRIMARY KEY,
      display_name        TEXT NOT NULL,
      role_prompt         TEXT NOT NULL,
      allowed_categories  TEXT NOT NULL DEFAULT '[]',
      conversation_ref    TEXT,
      model_config_json   TEXT NOT NULL DEFAULT '{}',
      enabled             INTEGER NOT NULL DEFAULT 1,
      created_at          INTEGER NOT NULL
    );
  `);

  // ─── 9. pipelines — конвейер задач ───────────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_definitions (
      id            TEXT PRIMARY KEY,
      display_name  TEXT NOT NULL,
      steps_json    TEXT NOT NULL,
      enabled       INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      run_id        TEXT PRIMARY KEY,
      pipeline_id   TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'queued',
      current_step  INTEGER DEFAULT 0,
      total_steps   INTEGER NOT NULL,
      context_json  TEXT NOT NULL DEFAULT '{}',
      started_at    INTEGER,
      completed_at  INTEGER,
      FOREIGN KEY (pipeline_id) REFERENCES pipeline_definitions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status
      ON pipeline_runs(status, started_at DESC);

    CREATE TABLE IF NOT EXISTS pipeline_step_runs (
      id             TEXT PRIMARY KEY,
      run_id         TEXT NOT NULL,
      step_index     INTEGER NOT NULL,
      agent_id       TEXT,
      tool_name      TEXT,
      async_task_id  TEXT,
      tool_call_id   TEXT,
      status         TEXT NOT NULL DEFAULT 'queued',
      result_json    TEXT,
      error          TEXT,
      started_at     INTEGER,
      completed_at   INTEGER,
      FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_steps_run
      ON pipeline_step_runs(run_id, step_index);
  `);
}