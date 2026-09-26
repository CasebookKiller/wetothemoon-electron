// src/main/services/pranaBindu/melange/schema.ts
//
// SQL-строки таблиц prana_bindu.db.
// Порядок таблиц в ALL_TABLES важен: сначала те, на которые ссылаются FK.

export const CREATE_META = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

export const CREATE_PROFILE = `
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    age INTEGER,
    max_hr INTEGER,
    lthr INTEGER,
    resting_hr INTEGER,
    weight_kg REAL,
    goal_marathon_date TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  );
`;

export const CREATE_MOVEMENTS = `
  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL
  );
`;

export const CREATE_PROGRESSIONS = `
  CREATE TABLE IF NOT EXISTS progressions (
    id INTEGER PRIMARY KEY,
    movement_id INTEGER NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
    name TEXT NOT NULL,
    scheme_json TEXT NOT NULL,
    repeat_count INTEGER NOT NULL DEFAULT 1,
    is_time_based INTEGER NOT NULL DEFAULT 0 CHECK (is_time_based IN (0,1)),
    notes TEXT,
    UNIQUE (movement_id, level),
    FOREIGN KEY (movement_id) REFERENCES movements(id)
  );
`;

export const CREATE_USER_MOVEMENT_STATE = `
  CREATE TABLE IF NOT EXISTS user_movement_state (
    movement_id INTEGER PRIMARY KEY,
    current_level INTEGER NOT NULL DEFAULT 1,
    last_attempt_at TEXT,
    benchmark_done INTEGER NOT NULL DEFAULT 0 CHECK (benchmark_done IN (0,1)),
    updated_at TEXT NOT NULL,
    FOREIGN KEY (movement_id) REFERENCES movements(id)
  );
`;

export const CREATE_RUN_PLANS = `
  CREATE TABLE IF NOT EXISTS run_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    zone INTEGER,
    target_km REAL,
    target_pace TEXT,
    target_hr_min INTEGER,
    target_hr_max INTEGER,
    notes TEXT
  );
`;

export const CREATE_RUN_FACTS = `
  CREATE TABLE IF NOT EXISTS run_facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    plan_id INTEGER,
    actual_km REAL,
    actual_pace TEXT,
    avg_hr INTEGER,
    max_hr INTEGER,
    duration_sec INTEGER,
    rpe INTEGER,
    source TEXT,
    external_id TEXT,
    raw_json TEXT,
    notes TEXT,
    FOREIGN KEY (plan_id) REFERENCES run_plans(id)
  );
`;

export const CREATE_STRENGTH_PLANS = `
  CREATE TABLE IF NOT EXISTS strength_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    movement_id INTEGER NOT NULL,
    level INTEGER NOT NULL,
    sets_target INTEGER,
    reps_target INTEGER,
    notes TEXT,
    FOREIGN KEY (movement_id) REFERENCES movements(id)
  );
`;

export const CREATE_STRENGTH_SESSIONS = `
  CREATE TABLE IF NOT EXISTS strength_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    plan_id INTEGER,
    movement_id INTEGER NOT NULL,
    level INTEGER NOT NULL,
    sets_json TEXT,
    rpe INTEGER,
    notes TEXT,
    FOREIGN KEY (plan_id) REFERENCES strength_plans(id),
    FOREIGN KEY (movement_id) REFERENCES movements(id)
  );
`;

export const CREATE_RECOVERY_LOGS = `
  CREATE TABLE IF NOT EXISTS recovery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    sleep_hours REAL,
    sleep_quality INTEGER,
    hrv INTEGER,
    resting_hr INTEGER,
    status TEXT,
    notes TEXT
  );
`;

export const CREATE_PROGRESS_CHECKS = `
  CREATE TABLE IF NOT EXISTS progress_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    run_pace TEXT,
    run_avg_hr INTEGER,
    strength_movement_id INTEGER,
    strength_reps INTEGER,
    notes TEXT,
    FOREIGN KEY (strength_movement_id) REFERENCES movements(id)
  );
`;

export const CREATE_WEEK_TEMPLATES = `
  CREATE TABLE IF NOT EXISTS week_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    phase TEXT,
    description TEXT
  );
`;

export const CREATE_WEEK_TEMPLATE_DAYS = `
  CREATE TABLE IF NOT EXISTS week_template_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    run_json TEXT,
    strength_json TEXT,
    recovery_flag INTEGER NOT NULL DEFAULT 0 CHECK (recovery_flag IN (0,1)),
    FOREIGN KEY (template_id) REFERENCES week_templates(id) ON DELETE CASCADE,
    UNIQUE (template_id, day_of_week)
  );
`;

export const CREATE_SYNC_SETTINGS = `
  CREATE TABLE IF NOT EXISTS sync_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    source TEXT,
    mode TEXT NOT NULL DEFAULT 'manual',
    auto_interval_min INTEGER,
    auto_on_start INTEGER NOT NULL DEFAULT 0 CHECK (auto_on_start IN (0,1)),

    google_token_json TEXT,

    zeppbridge_path TEXT,

    zepp_provider TEXT,
    zepp_fallback_provider TEXT,
    zepp_credentials_json TEXT,
    zepp_auth_host TEXT,
    zepp_data_host TEXT,
    zepp_app_token TEXT,
    zepp_user_id TEXT,
    zepp_last_sync_at TEXT,
    zepp_last_sync_status TEXT,

    last_sync_at TEXT,
    last_sync_status TEXT
  );
`;

export const CREATE_RECOMMENDATIONS = `
  CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    provider TEXT NOT NULL,
    context_json TEXT,
    suggestion_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    resolved_at TEXT,
    notes TEXT
  );
`;

export const ALL_TABLES: readonly string[] = [
  CREATE_META,
  CREATE_PROFILE,
  CREATE_MOVEMENTS,
  CREATE_PROGRESSIONS,
  CREATE_USER_MOVEMENT_STATE,
  CREATE_RUN_PLANS,
  CREATE_RUN_FACTS,
  CREATE_STRENGTH_PLANS,
  CREATE_STRENGTH_SESSIONS,
  CREATE_RECOVERY_LOGS,
  CREATE_PROGRESS_CHECKS,
  CREATE_WEEK_TEMPLATES,
  CREATE_WEEK_TEMPLATE_DAYS,
  CREATE_SYNC_SETTINGS,
  CREATE_RECOMMENDATIONS,
];

export const ALL_INDEXES: readonly string[] = [
  `CREATE INDEX IF NOT EXISTS idx_run_facts_date ON run_facts(date);`,
  `CREATE INDEX IF NOT EXISTS idx_run_facts_external ON run_facts(source, external_id);`,
  `CREATE INDEX IF NOT EXISTS idx_strength_sessions_date ON strength_sessions(date);`,
  `CREATE INDEX IF NOT EXISTS idx_recovery_logs_date ON recovery_logs(date);`,
  `CREATE INDEX IF NOT EXISTS idx_progress_checks_date ON progress_checks(date);`,
  `CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);`,
];

// ==================== Миграция v2: dodofo ====================

export const MIGRATION_V2_DODOFO: readonly string[] = [
  `ALTER TABLE sync_settings ADD COLUMN dodofo_token TEXT;`,
  `ALTER TABLE sync_settings ADD COLUMN dodofo_user_id TEXT;`,
  `ALTER TABLE sync_settings ADD COLUMN dodofo_username TEXT;`,
  `ALTER TABLE sync_settings ADD COLUMN dodofo_last_sync_at TEXT;`,
  `ALTER TABLE sync_settings ADD COLUMN dodofo_last_sync_status TEXT;`,
];