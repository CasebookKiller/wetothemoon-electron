// src/main/services/pranaBindu/melange/migrations.ts

import type { DatabaseSync } from 'node:sqlite';
import {
  ALL_TABLES,
  ALL_INDEXES,
  CREATE_META,
  MIGRATION_V2_DODOFO,
  MIGRATION_V3_RUN_STREAMS,
  MIGRATION_V5_FIT_ARCHIVE,
  MIGRATION_V6_RUN_FACTS_START_TIME,
  MIGRATION_V7_RUN_FACTS_GPS,
  MIGRATION_V8_RECOVERY_FIELDS,
  MIGRATION_V9_INTERVALS_ICU,
} from './schema';

export const SCHEMA_VERSION = 16;

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
  {
    version: 6,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(run_facts)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('start_time')) {
        db.exec(`ALTER TABLE run_facts ADD COLUMN start_time TEXT;`);
        console.log('[Melange] v6: добавлена колонка run_facts.start_time');
      }
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_run_facts_date_start ON run_facts(date, start_time);`
      );
    },
  },
  {
    version: 7,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(run_facts)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('gps_quality')) {
        db.exec(`ALTER TABLE run_facts ADD COLUMN gps_quality TEXT;`);
        console.log('[Melange] v7: добавлена колонка run_facts.gps_quality');
      }
      if (!has('distance_source')) {
        db.exec(`ALTER TABLE run_facts ADD COLUMN distance_source TEXT;`);
        console.log('[Melange] v7: добавлена колонка run_facts.distance_source');
      }
      if (!has('gps_coverage_pct')) {
        db.exec(`ALTER TABLE run_facts ADD COLUMN gps_coverage_pct REAL;`);
        console.log('[Melange] v7: добавлена колонка run_facts.gps_coverage_pct');
      }
    },
  },
  {
    version: 8,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(recovery_logs)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      const addIfMissing: [string, string][] = [
        ['weight_kg', 'REAL'],
        ['sleep_score', 'INTEGER'],
        ['sleep_total_min', 'INTEGER'],
        ['deep_min', 'INTEGER'],
        ['rem_min', 'INTEGER'],
        ['light_min', 'INTEGER'],
        ['awake_min', 'INTEGER'],
        ['steps', 'INTEGER'],
        ['vo2max', 'REAL'],
        ['body_battery_charged', 'INTEGER'],
        ['body_battery_drained', 'INTEGER'],
        ['stress_avg', 'INTEGER'],
        ['auto_source', 'TEXT'],
        ['raw_json', 'TEXT'],
      ];

      for (const [name, type] of addIfMissing) {
        if (!has(name)) {
          db.exec(`ALTER TABLE recovery_logs ADD COLUMN ${name} ${type};`);
          console.log(`[Melange] v8: добавлена колонка recovery_logs.${name}`);
        }
      }
    },
  },
  {
    version: 9,
    apply: (db) => {
      // recovery_logs
      const rcols = db
        .prepare(`PRAGMA table_info(recovery_logs)`)
        .all() as { name: string }[];
      const hasR = (n: string) => rcols.some((c) => c.name === n);

      const recAdd: [string, string][] = [
        ['ctl', 'REAL'], ['atl', 'REAL'], ['ramp_rate', 'REAL'],
        ['readiness', 'INTEGER'], ['soreness', 'INTEGER'],
        ['fatigue', 'INTEGER'], ['stress', 'INTEGER'],
        ['mood', 'INTEGER'], ['motivation', 'INTEGER'],
        ['injury', 'INTEGER'], ['avg_sleeping_hr', 'INTEGER'],
        ['hrv_sdnn', 'REAL'], ['baevsky_si', 'REAL'],
        ['sp_o2', 'INTEGER'], ['systolic', 'INTEGER'], ['diastolic', 'INTEGER'],
      ];
      for (const [n, t] of recAdd) {
        if (!hasR(n)) db.exec(`ALTER TABLE recovery_logs ADD COLUMN ${n} ${t};`);
      }

      // sync_settings
      const scols = db
        .prepare(`PRAGMA table_info(sync_settings)`)
        .all() as { name: string }[];
      const hasS = (n: string) => scols.some((c) => c.name === n);

      const syncAdd: [string, string][] = [
        ['intervals_api_key', 'TEXT'],
        ['intervals_athlete_id', 'TEXT'],
        ['intervals_last_sync_at', 'TEXT'],
        ['intervals_last_sync_status', 'TEXT'],
      ];
      for (const [n, t] of syncAdd) {
        if (!hasS(n)) db.exec(`ALTER TABLE sync_settings ADD COLUMN ${n} ${t};`);
      }

      console.log('[Melange] v9: recovery_logs + sync_settings под intervals.icu');
    },
  },
  {
    version: 10,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(profile)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      const addIfMissing: [string, string][] = [
        ['lthr_source', 'TEXT'],
        ['max_hr_source', 'TEXT'],
        ['resting_hr_source', 'TEXT'],
      ];

      for (const [name, type] of addIfMissing) {
        if (!has(name)) {
          db.exec(`ALTER TABLE profile ADD COLUMN ${name} ${type};`);
          console.log(`[Melange] v10: добавлена колонка profile.${name}`);
        }
      }
    },
  },
  {
    version: 11,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(run_facts)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('name')) {
        db.exec(`ALTER TABLE run_facts ADD COLUMN name TEXT;`);
        console.log('[Melange] v11: добавлена колонка run_facts.name');
      }
      if (!has('user_name')) {
        db.exec(`ALTER TABLE run_facts ADD COLUMN user_name TEXT;`);
        console.log('[Melange] v11: добавлена колонка run_facts.user_name');
      }
    },
  },
  {
    version: 12,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(sync_settings)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('zepp_archive_path')) {
        db.exec(`ALTER TABLE sync_settings ADD COLUMN zepp_archive_path TEXT;`);
        console.log('[Melange] v12: добавлена колонка sync_settings.zepp_archive_path');
      }
    },
  },
  {
    version: 13,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(profile)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('hr_zones_json')) {
        db.exec(`ALTER TABLE profile ADD COLUMN hr_zones_json TEXT;`);
        console.log('[Melange] v13: добавлена profile.hr_zones_json');
      }
      if (!has('hr_zones_source')) {
        db.exec(`ALTER TABLE profile ADD COLUMN hr_zones_source TEXT;`);
        console.log('[Melange] v13: добавлена profile.hr_zones_source');
      }
    },
  },
  {
    version: 14,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(profile)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('pace_zones_json')) {
        db.exec(`ALTER TABLE profile ADD COLUMN pace_zones_json TEXT;`);
        console.log('[Melange] v14: добавлена profile.pace_zones_json');
      }
      if (!has('threshold_pace_ms')) {
        db.exec(`ALTER TABLE profile ADD COLUMN threshold_pace_ms REAL;`);
        console.log('[Melange] v14: добавлена profile.threshold_pace_ms');
      }
      if (!has('pace_zones_source')) {
        db.exec(`ALTER TABLE profile ADD COLUMN pace_zones_source TEXT;`);
        console.log('[Melange] v14: добавлена profile.pace_zones_source');
      }
    },
  },
  {
    version: 15,
    apply: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS plan_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          external_id TEXT UNIQUE NOT NULL,
          date TEXT NOT NULL,
          start_time TEXT,
          end_time TEXT,
          category TEXT NOT NULL,
          sport TEXT,
          name TEXT NOT NULL,
          description TEXT,
          planned_load REAL,
          duration_sec INTEGER,
          distance_m REAL,
          icu_workout_json TEXT,
          raw_json TEXT,
          paired_activity_id INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (paired_activity_id) REFERENCES run_facts(id)
        );
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_plan_events_date ON plan_events(date);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_plan_events_category ON plan_events(category);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_plan_events_paired ON plan_events(paired_activity_id);`);
            console.log('[Melange] v15: создана таблица plan_events');
    },
  },
  {
    version: 16,
    apply: (db) => {
      const cols = db
        .prepare(`PRAGMA table_info(plan_events)`)
        .all() as { name: string }[];
      const has = (n: string) => cols.some((c) => c.name === n);

      if (!has('local_keep')) {
        db.exec(
          `ALTER TABLE plan_events ADD COLUMN local_keep INTEGER NOT NULL DEFAULT 0;`
        );
        console.log('[Melange] v16: добавлена plan_events.local_keep');
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