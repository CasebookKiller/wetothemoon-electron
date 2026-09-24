Идём в **Группу 3 — Melange (БД)**. Цель: заменить in-memory заглушки в хендлерах на реальное чтение/запись в SQLite. Бизнес-логику (CRUD планов, фактов, ступеней) пока не пишем — только то, что нужно для 09: `profile` и `sync_settings`.

## Часть 1. Ядро Melange

### 3.1 `src/main/services/pranaBindu/melange/schema.ts` (новый)

```ts
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
```

### 3.2 `src/main/services/pranaBindu/melange/migrations.ts` (новый)

```ts
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
```

### 3.3 `src/main/services/pranaBindu/melange/db.ts` (новый)

```ts
// src/main/services/pranaBindu/melange/db.ts
//
// Синглтон подключения к prana_bindu.db.
// Путь передаётся снаружи (из main.ts). Никаких импортов electron.

import { DatabaseSync } from 'node:sqlite';
import { applyMigrations } from './migrations';

let db: DatabaseSync | null = null;

export function openMelange(dbPath: string): DatabaseSync {
  if (db) return db;

  console.log(`[Melange] Открываем БД: ${dbPath}`);
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  try {
    applyMigrations(db);
    console.log('[Melange] Схема готова');
  } catch (e) {
    console.error('[Melange] Ошибка инициализации схемы:', e);
    db.close();
    db = null;
    throw e;
  }

  return db;
}

export function getMelange(): DatabaseSync {
  if (!db) {
    throw new Error(
      '[Melange] БД не инициализирована. Вызовите openMelange(dbPath) при старте приложения.'
    );
  }
  return db;
}

export function closeMelange(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

### 3.4 `src/main/services/pranaBindu/melange/seed.ts` (новый)

```ts
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
```

### 3.5 `src/main/services/pranaBindu/melange/types.ts` (обновить)

Допиши к существующему файлу:

```ts
// Row-типы Melange. Snake_case, 1-в-1 с DDL.

export interface ProfileRow {
  id: number;
  age: number | null;
  max_hr: number | null;
  lthr: number | null;
  resting_hr: number | null;
  weight_kg: number | null;
  goal_marathon_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SyncSettingsRow {
  id: number;
  source: string | null;
  mode: string;
  auto_interval_min: number | null;
  auto_on_start: 0 | 1;
  google_token_json: string | null;
  zeppbridge_path: string | null;
  zepp_provider: string | null;
  zepp_fallback_provider: string | null;
  zepp_credentials_json: string | null;
  zepp_auth_host: string | null;
  zepp_data_host: string | null;
  zepp_app_token: string | null;
  zepp_user_id: string | null;
  zepp_last_sync_at: string | null;
  zepp_last_sync_status: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

export interface MetaRow {
  key: string;
  value: string;
}

// (существующие: MovementsRow, ProgressionsRow, UserMovementStateRow,
//  RecoveryLogsRow — оставить как есть)
```

### 3.6 `src/main/services/pranaBindu/melange/index.ts` (обновить)

```ts
export * from './types';
export { openMelange, getMelange, closeMelange } from './db';
export { applyMigrations, SCHEMA_VERSION } from './migrations';
export { seed } from './seed';
export * from './repositories';
```

## Часть 2. Репозитории

### 3.7 `src/main/services/pranaBindu/melange/repositories/profileRepo.ts` (новый)

```ts
// src/main/services/pranaBindu/melange/repositories/profileRepo.ts

import type { DatabaseSync } from 'node:sqlite';
import type { Profile } from '../../core/types';
import type { ProfileRow } from '../types';

function rowToDomain(row: ProfileRow): Profile {
  return {
    age: row.age ?? undefined,
    maxHr: row.max_hr ?? undefined,
    restingHr: row.resting_hr ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    lactateThresholdHr: row.lthr ?? undefined,
    marathonDate: row.goal_marathon_date ?? undefined,
  };
}

export function getProfile(db: DatabaseSync): Profile {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined;
  if (!row) return {};
  return rowToDomain(row);
}

export function updateProfile(db: DatabaseSync, patch: Partial<Profile>): Profile {
  const now = new Date().toISOString();

  // Читаем текущее значение, чтобы не потерять неуказанные поля.
  const current = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined;

  const merged = {
    age: patch.age ?? current?.age ?? null,
    max_hr: patch.maxHr ?? current?.max_hr ?? null,
    lthr: patch.lactateThresholdHr ?? current?.lthr ?? null,
    resting_hr: patch.restingHr ?? current?.resting_hr ?? null,
    weight_kg: patch.weightKg ?? current?.weight_kg ?? null,
    goal_marathon_date: patch.marathonDate ?? current?.goal_marathon_date ?? null,
    updated_at: now,
  };

  if (!current) {
    db.prepare(
      `INSERT INTO profile (id, age, max_hr, lthr, resting_hr, weight_kg,
        goal_marathon_date, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      merged.age, merged.max_hr, merged.lthr, merged.resting_hr,
      merged.weight_kg, merged.goal_marathon_date, now, now
    );
  } else {
    db.prepare(
      `UPDATE profile SET
        age = ?, max_hr = ?, lthr = ?, resting_hr = ?, weight_kg = ?,
        goal_marathon_date = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      merged.age, merged.max_hr, merged.lthr, merged.resting_hr,
      merged.weight_kg, merged.goal_marathon_date, now
    );
  }

  return getProfile(db);
}
```

### 3.8 `src/main/services/pranaBindu/melange/repositories/syncRepo.ts` (новый)

```ts
// src/main/services/pranaBindu/melange/repositories/syncRepo.ts
//
// Шифрование секретов — снаружи (в handler через safeStorage).
// Репозиторий принимает уже зашифрованные строки как есть.

import type { DatabaseSync } from 'node:sqlite';
import type { SyncSettings } from '../../spice/types';
import type { SyncSettingsRow } from '../types';

function rowToDomain(row: SyncSettingsRow): SyncSettings {
  return {
    source: (row.source as SyncSettings['source']) ?? undefined,
    mode: (row.mode as SyncSettings['mode']) ?? 'manual',
    zeppProvider: row.zepp_provider ?? undefined,
    zeppFallbackProvider: row.zepp_fallback_provider ?? undefined,
    zeppAuthHost: row.zepp_auth_host ?? undefined,
    zeppDataHost: row.zepp_data_host ?? undefined,
    zeppUserId: row.zepp_user_id ?? undefined,
    zeppLastSyncAt: row.zepp_last_sync_at ?? undefined,
    zeppLastSyncStatus: row.zepp_last_sync_status ?? undefined,
  };
}

export function getSyncSettings(db: DatabaseSync): SyncSettings {
  const row = db.prepare('SELECT * FROM sync_settings WHERE id = 1').get() as SyncSettingsRow | undefined;
  if (!row) return { mode: 'manual' };
  return rowToDomain(row);
}

/** Расширенный геттер — только для handler'а, которому нужны флаги секретов. */
export function getSyncSettingsInternal(db: DatabaseSync): SyncSettingsRow | undefined {
  return db.prepare('SELECT * FROM sync_settings WHERE id = 1').get() as SyncSettingsRow | undefined;
}

export function updateSyncSettings(db: DatabaseSync, patch: Partial<SyncSettings>): SyncSettings {
  const current = getSyncSettingsInternal(db);
  if (!current) throw new Error('sync_settings не инициализирован (seed не выполнен)');

  const merged = {
    source: patch.source ?? current.source,
    mode: patch.mode ?? current.mode,
    zepp_provider: patch.zeppProvider ?? current.zepp_provider,
    zepp_fallback_provider: patch.zeppFallbackProvider ?? current.zepp_fallback_provider,
    zepp_auth_host: patch.zeppAuthHost ?? current.zepp_auth_host,
    zepp_data_host: patch.zeppDataHost ?? current.zepp_data_host,
    zepp_user_id: patch.zeppUserId ?? current.zepp_user_id,
    zepp_last_sync_at: patch.zeppLastSyncAt ?? current.zepp_last_sync_at,
    zepp_last_sync_status: patch.zeppLastSyncStatus ?? current.zepp_last_sync_status,
  };

  db.prepare(
    `UPDATE sync_settings SET
      source = ?, mode = ?,
      zepp_provider = ?, zepp_fallback_provider = ?,
      zepp_auth_host = ?, zepp_data_host = ?,
      zepp_user_id = ?,
      zepp_last_sync_at = ?, zepp_last_sync_status = ?
     WHERE id = 1`
  ).run(
    merged.source, merged.mode,
    merged.zepp_provider, merged.zepp_fallback_provider,
    merged.zepp_auth_host, merged.zepp_data_host,
    merged.zepp_user_id,
    merged.zepp_last_sync_at, merged.zepp_last_sync_status
  );

  return getSyncSettings(db);
}

/**
 * Сохранение секретов Zepp (уже зашифрованных снаружи).
 * Отдельная функция, чтобы handler явно знал, что тут секреты.
 */
export function setZeppSecrets(
  db: DatabaseSync,
  payload: {
    credentialsJson: string | null;
    appToken: string | null;
  }
): void {
  db.prepare(
    `UPDATE sync_settings SET
      zepp_credentials_json = ?,
      zepp_app_token = ?
     WHERE id = 1`
  ).run(payload.credentialsJson, payload.appToken);
}

/** Флаги наличия секретов — без выдачи самих секретов наружу. */
export function getSyncSecretsFlags(db: DatabaseSync): {
  hasCredentials: boolean;
  hasAppToken: boolean;
} {
  const row = getSyncSettingsInternal(db);
  return {
    hasCredentials: !!row?.zepp_credentials_json,
    hasAppToken: !!row?.zepp_app_token,
  };
}
```

### 3.9 `src/main/services/pranaBindu/melange/repositories/index.ts` (новый)

```ts
export * from './profileRepo';
export * from './syncRepo';
```

## Часть 3. Патчи интеграции

### 3.10 `src/main/main.ts` (патч)

**Правка 1.** Найди блок импортов Prana-Bindu:

```ts
import { createPranaBinduWindow, getPranaBinduWindow } from './windows/pranaBinduWindow.ts';
import { registerPranaBinduHandlers } from './ipcHandlers/pranaBinduHandlers.ts';
```

Добавь после:

```ts
import { openMelange, seed as seedMelange } from './services/pranaBindu/melange';
```

**Правка 2.** В `app.whenReady()`, найди строку:

```ts
  registerPranaBinduHandlers();
```

Замени на:

```ts
  // Melange: открываем БД ДО регистрации хендлеров,
  // чтобы репозитории сразу были доступны.
  const melangeDb = openMelange(
    path.join(app.getPath('userData'), 'prana_bindu.db')
  );
  seedMelange(melangeDb);

  registerPranaBinduHandlers();
```

`path` уже импортирован в `main.ts` — проверь, если нет, добавь `import path from 'path';`.

### 3.11 `src/main/services/pranaBindu/melange/index.ts` — исправить экспорт seed

В части 1 (п. 3.6) у меня `export { seed } from './seed';`. В `main.ts` импортирую как `seed as seedMelange` — ок.

## Часть 4. Переписать хендлеры на Melange

### 3.12 `src/main/ipcHandlers/pranaBinduHandlers.ts` (заменить целиком)

```ts
// src/main/ipcHandlers/pranaBinduHandlers.ts

import { ipcMain, safeStorage } from 'electron';
import { createPranaBinduWindow, getPranaBinduWindow } from '../windows/pranaBinduWindow';
import { detectZeppConnection } from '../services/pranaBindu/spice/providers/regionDetector';
import { DofekZeppProvider } from '../services/pranaBindu/spice/providers/dofekProvider';
import { ZeppMcpProvider } from '../services/pranaBindu/spice/providers/mcpProvider';
import { ZeppBridgeProvider } from '../services/pranaBindu/spice/providers/bridgeProvider';
import {
  registerProvider,
  getProvider,
  listProviders,
} from '../services/pranaBindu/spice/providers';
import {
  getMelange,
  getProfile,
  updateProfile,
  getSyncSettings,
  updateSyncSettings,
  setZeppSecrets,
  getSyncSecretsFlags,
} from '../services/pranaBindu/melange';

// ==================== Регистрация провайдеров ====================

let providersRegistered = false;

function ensureProvidersRegistered(): void {
  if (providersRegistered) return;
  registerProvider(new DofekZeppProvider());
  registerProvider(new ZeppMcpProvider());
  registerProvider(new ZeppBridgeProvider());
  providersRegistered = true;
  console.log(`[Prana-Bindu] Зарегистрировано провайдеров Zepp: ${listProviders().length}`);
}

// ==================== safeStorage helpers ====================

/**
 * Шифрует строку через safeStorage. Если шифрование недоступно
 * (Linux без keyring и т.п.) — возвращает null и логирует предупреждение.
 */
function encryptSecret(plain: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[Prana-Bindu] safeStorage недоступен — секрет не сохранён');
      return null;
    }
    return safeStorage.encryptString(plain).toString('base64');
  } catch (e) {
    console.error('[Prana-Bindu] Ошибка шифрования:', (e as Error).message);
    return null;
  }
}

// ==================== Регистрация хендлеров ====================

export function registerPranaBinduHandlers(): void {
  ensureProvidersRegistered();

  // -------- Окно --------
  ipcMain.handle('pb:open-window', () => {
    const existing = getPranaBinduWindow();
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return;
    }
    createPranaBinduWindow();
  });

  // -------- Health-check --------
  ipcMain.handle('pb:ping', () => ({ pong: true }));

  // -------- Профиль --------
  ipcMain.handle('pb:get-profile', () => {
    try {
      return { success: true, data: getProfile(getMelange()) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:update-profile', (_event, patch) => {
    try {
      const updated = updateProfile(getMelange(), patch);
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Настройки синхронизации --------
  ipcMain.handle('pb:sync-settings-get', () => {
    try {
      const settings = getSyncSettings(getMelange());
      const flags = getSyncSecretsFlags(getMelange());
      return { success: true, data: { ...settings, ...flags } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:sync-settings-update', (_event, patch) => {
    try {
      // Защита: через этот канал секреты не принимаем.
      // Для секретов — pb:zepp-connect.
      const { zeppAppToken, zeppCredentials, ...safePatch } = patch ?? {};
      const updated = updateSyncSettings(getMelange(), safePatch);
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Проверка доступности провайдера --------
  ipcMain.handle('pb:zepp-check-provider', async (_event, name: string) => {
    try {
      const provider = getProvider(name);
      if (!provider) {
        return { available: false, reason: `Провайдер «${name}» не зарегистрирован` };
      }
      return await provider.isAvailable();
    } catch (e) {
      return { available: false, reason: (e as Error).message };
    }
  });

  // -------- Подключение к Zepp --------
  ipcMain.handle('pb:zepp-connect', async (_event, email: string, password: string) => {
    if (!email || !password) {
      return { success: false, error: 'Email и пароль обязательны' };
    }

    try {
      const result = await detectZeppConnection(email, password);
      const db = getMelange();

      // Обновляем sync_settings
      updateSyncSettings(db, {
        zeppProvider: 'dofek-zepp',
        zeppAuthHost: result.authHost,
        zeppDataHost: result.dataHost,
        zeppUserId: result.userId,
        zeppLastSyncAt: new Date().toISOString(),
        zeppLastSyncStatus: 'connected',
      });

      // Шифруем и сохраняем секреты
      const credsEncrypted = encryptSecret(JSON.stringify({ email, password }));
      const tokenEncrypted = encryptSecret(result.appToken);
      setZeppSecrets(db, {
        credentialsJson: credsEncrypted,
        appToken: tokenEncrypted,
      });

      // Наружу — только безопасные поля, без appToken.
      return {
        success: true,
        userId: result.userId,
        authHost: result.authHost,
        dataHost: result.dataHost,
      };
    } catch (e) {
      try {
        updateSyncSettings(getMelange(), {
          zeppLastSyncAt: new Date().toISOString(),
          zeppLastSyncStatus: 'error',
        });
      } catch {
        // ignore — если БД ещё не готова
      }
      return { success: false, error: (e as Error).message };
    }
  });

  console.log('[Prana-Bindu] IPC-хендлеры зарегистрированы (pb:*)');
}
```

## Проверка

```bash
npm start
```

В DevTools окна Prana-Bindu (`Ctrl+Shift+I`):

```js
await window.electronAPI.pb.ping()
// → { pong: true }

await window.electronAPI.pb.getProfile()
// → { success: true, data: {} }  (все поля undefined, только id/created_at в БД)

await window.electronAPI.pb.updateProfile({ age: 40, maxHr: 180, marathonDate: '2026-09-27' })
// → { success: true, data: { age: 40, maxHr: 180, marathonDate: '2026-09-27' } }

// Закрой окно, открой заново, выполни снова:
await window.electronAPI.pb.getProfile()
// → { success: true, data: { age: 40, maxHr: 180, marathonDate: '2026-09-27' } }

await window.electronAPI.pb.syncSettingsGet()
// → { success: true, data: { mode: 'manual', hasCredentials: false, hasAppToken: false, ... } }

await window.electronAPI.pb.syncSettingsUpdate({ mode: 'auto' })
// → { success: true, data: { mode: 'auto', ... } }

await window.electronAPI.pb.zeppConnect('твой@email', 'пароль')
// → { success: true, userId: '...', authHost: 'api-user.zepp.com', dataHost: 'api-mifit.zepp.com' }
// либо { success: false, error: '...' }
```

Проверь, что БД появилась:

```bash
ls -la ~/.config/wetothemoon-electron/prana_bindu.db
# или другой userData-путь в зависимости от forge.config.ts
```

Проверь таблицы:

```bash
sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db ".tables"
# Должно быть: meta movements profile progressions recovery_logs recommendations
# run_facts run_plans strength_plans strength_sessions sync_settings
# user_movement_state week_template_days week_templates

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db "SELECT code, name FROM movements;"
# pushups|Отжимания
# squats|Приседания
# pullups|Подтягивания
# leg_raises|Подъём ног
# bridge|Мостик
# stand|Стойка

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db "SELECT value FROM meta WHERE key='schema_version';"
# 1
```

## Коммит

```bash
git add src/main/services/pranaBindu/melange/ \
        src/main/ipcHandlers/pranaBinduHandlers.ts \
        src/main/main.ts
git commit -m "Prana-Bindu: Melange — БД, миграции, seed, репозитории; хендлеры на SQLite"
```

Запускай, скинь результат `sqlite3` и консоли. Если что-то не взлетит — пришли лог `npm start`.