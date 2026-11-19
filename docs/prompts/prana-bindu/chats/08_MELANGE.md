# Направление 08: Melange (схема БД, миграции)

> Обновлено: 2026-10-29
> Статус: v1 → **v36** готовы.

## Роль
Локальная БД `prana_bindu.db`. Профиль, планы, факты, прогрессии Big-6, восстановление, настройки синхронизации, рекомендации, факт силовых, прогресс движений Mentat, соответствия между каталогами, цепочки, вода/вес/питание.

## Технические решения
- `node:sqlite`, синглтон, ленивая инициализация.
- Миграции — массив функций, версия в `meta.schema_version`.
- Все даты — ISO 8601 UTC. Локальная зона — на границе репозитория.
- JSON-поля — `TEXT`. Потоки — `.msgpack` файлы на диске.
- Импорт `electron` в этой папке запрещён (`safeStorage` — снаружи).

## Текущее состояние

**Реализовано:**
- `db.ts`, `schema.ts`, `migrations.ts` (`SCHEMA_VERSION = 36`), `seed.ts`, `types.ts`, `index.ts`.
- `repositories/index.ts`, `profileRepo.ts`, `syncRepo.ts`, `runFactsRepo.ts`, `runStreamsRepo.ts`, `recoveryRepo.ts`, `planEventsRepo.ts`, `workoutSessionsRepo.ts`, `exerciseProgressRepo.ts`, `equivalencesRepo.ts`, `waterRepo.ts`, `weightRepo.ts`, `nutritionRepo.ts`, `chainsRepo.ts`, `referenceTracksRepo.ts`, `testSegmentsRepo.ts`.

**История версий:**
- v13: `hr_zones_json` / `hr_zones_source` в `profile`.
- v14: `pace_zones_json` / `threshold_pace_ms` / `pace_zones_source`.
- v15-v17: `plan_events` (+ `local_keep`), `run_facts` (gps_quality).
- v18-v19: `workout_sessions`, `exercise_progress`.
- v20: `recovery_logs` += `sources_json`, `calories_active`, `calories_total`, `body_fat_pct`.
- v21: `equivalences`.
- v22-v24: автосинк (`auto_providers_json`, `streams_loaded`, `auto_range_days`).
- v25: `threshold_history`.
- v26: `test_segments`.
- v27-v31: Вода (`water_logs`), Вес (`weight_logs`), Питание (`nutrition_logs`), `test_segments.kind`, `reference_tracks`.
- v32: Цепочки (`chains`, `chain_slots`).
- v33: `chain_slots.direction`.
- v34: `profile.height_cm`.
- v35: `profile.gender`.
- v36: `profile.birth_date`.

## Схема (актуальная версия — v36)

### Мета, профиль
```sql
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age INTEGER,
  max_hr INTEGER,
  lthr INTEGER,
  resting_hr INTEGER,
  weight_kg REAL,
  height_cm REAL,
  birth_date TEXT,
  gender TEXT DEFAULT 'male',
  goal_marathon_date TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### Цепочки (v32, v33)
```sql
CREATE TABLE IF NOT EXISTS chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ordered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chain_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  expected_repeats_min REAL NOT NULL DEFAULT 1,
  expected_repeats_max REAL NOT NULL DEFAULT 1,
  aggregate TEXT NOT NULL DEFAULT 'best',
  min_coverage REAL NOT NULL DEFAULT 90,
  optional INTEGER NOT NULL DEFAULT 0,
  direction TEXT DEFAULT 'any',
  clusters_json TEXT,
  specific_atoms_json TEXT,
  notes TEXT,
  FOREIGN KEY (chain_id) REFERENCES chains(id) ON DELETE CASCADE
);
```

### Вода, Вес, Питание (v31)
```sql
CREATE TABLE IF NOT EXISTS water_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount_ml INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  food_name TEXT NOT NULL,
  calories INTEGER,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
```

*(Остальные таблицы `run_facts`, `recovery_logs`, `plan_events`, `run_streams` и т.д. без изменений).*

## Миграции

| Версия | Что | Дата |
|--------|-----|------|
| ... | ... | ... |
| v25 | `threshold_history` | 2026-10-19 |
| v26 | `test_segments` | 2026-10-22 |
| v27-v31 | `test_segments.kind`, `reference_tracks`, `water_logs`, `weight_logs`, `nutrition_logs` | 2026-10-26 |
| v32 | `chains`, `chain_slots` | 2026-10-27 |
| v33 | `chain_slots.direction` | 2026-10-28 |
| v34 | `profile.height_cm` | 2026-10-29 |
| v35 | `profile.gender` | 2026-10-29 |
| v36 | `profile.birth_date` | 2026-10-29 |

**`SCHEMA_VERSION = 36`.**

## Что нужно сделать
1. `movementsRepo.ts`, `progressionsRepo.ts` (05_CRYSKNIFE).
2. `runPlansRepo.ts`, `templatesRepo.ts`, `recommendationsRepo.ts` (по мере надобности).
3. v37 — `run_facts.training_load` (вынести из `raw_json`).


==============================================

# Направление 08: Melange (схема БД, миграции)

> Обновлено: 2026-10-08
> Статус: v1 → **v32** готовы.

## Роль

Локальная БД `prana_bindu.db`. Профиль, планы, факты, прогрессии Big-6, восстановление, настройки синхронизации, рекомендации, факт силовых, прогресс движений Mentat, соответствия между каталогами.

## Зона ответственности

- Файл `prana_bindu.db` в `app.getPath('userData')`.
- Схема таблиц, индексы, миграции (idempotent).
- Слой доступа к данным (CRUD).
- Никакой бизнес-логики.

## Технические решения

- `node:sqlite`, синглтон, ленивая инициализация.
- Миграции — массив функций, версия в `meta.schema_version`.
- Все даты — ISO 8601 UTC. Локальная зона — на границе репозитория.
- JSON-поля — `TEXT`. Потоки — `.msgpack` файлы на диске.
- Импорт `electron` в этой папке запрещён (`safeStorage` — снаружи).
- Секреты хранятся уже зашифрованными.

## Текущее состояние

**Реализовано:**
- `db.ts`, `schema.ts`, `migrations.ts` (`SCHEMA_VERSION = 32`), `seed.ts`, `types.ts`, `index.ts`.
- `repositories/index.ts`, `profileRepo.ts`, `syncRepo.ts`, `runFactsRepo.ts`, `runStreamsRepo.ts`, `recoveryRepo.ts`, `planEventsRepo.ts`, `workoutSessionsRepo.ts`, `exerciseProgressRepo.ts`, `equivalencesRepo.ts`.

**История версий:**
- v13: `hr_zones_json` / `hr_zones_source` в `profile`.
- v14: `pace_zones_json` / `threshold_pace_ms` / `pace_zones_source`.
- v15: таблица `plan_events`.
- v16: `plan_events.local_keep` — флаг «не удалять при mirror-синке».
- v17: `gps_quality`, `distance_source`, `gps_coverage_pct` в `run_facts`.
- v18: таблица `workout_sessions` — факт силовых.
- v19: таблица `exercise_progress` — прогресс движений Mentat.
- v20: `recovery_logs` += `sources_json`, `calories_active`, `calories_total`, `body_fat_pct`.
- v21: таблица `equivalences` — соответствия между каталогами.

**TODO:**
- `movementsRepo.ts`, `progressionsRepo.ts`, `runPlansRepo.ts`, `templatesRepo.ts`, `recommendationsRepo.ts` — по мере надобности.
- 60 ступеней Big-6 в `progressions` — блокируется `05_CRYSKNIFE.md`.
- v22 (план): `run_facts.training_load` или расчёт TSS из streams.

## Файловая структура

````
melange/
├── db.ts                        ← готов
├── schema.ts                    ← готов
├── migrations.ts                ← v1..v21
├── seed.ts                      ← готов
├── types.ts                     ← готов
├── index.ts                     ← готов
└── repositories/
    ├── index.ts                 ← готов
    ├── profileRepo.ts           ← готов
    ├── syncRepo.ts              ← готов
    ├── runFactsRepo.ts          ← готов
    ├── runStreamsRepo.ts        ← готов
    ├── recoveryRepo.ts          ← готов
    ├── planEventsRepo.ts        ← готов
    ├── workoutSessionsRepo.ts   ← готов
    ├── exerciseProgressRepo.ts  ← готов
    ├── equivalencesRepo.ts      ← готов
    ├── movementsRepo.ts         ← TODO (05_CRYSKNIFE)
    ├── progressionsRepo.ts      ← TODO (05_CRYSKNIFE)
    ├── runPlansRepo.ts          ← TODO
    ├── templatesRepo.ts         ← TODO
    └── recommendationsRepo.ts   ← TODO
````

## Схема (актуальная версия — v21)

### Мета, профиль

````sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

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
````

v13: добавлены `hr_zones_json TEXT`, `hr_zones_source TEXT`.
v14: добавлены `pace_zones_json TEXT`, `threshold_pace_ms INTEGER`, `pace_zones_source TEXT`.
v10: `lthr_source`, `max_hr_source`, `resting_hr_source` — источник последнего значения (`icu` | `dodofo` | `manual` | `computed`).

### Big-6

````sql
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS progressions (
  id INTEGER PRIMARY KEY,
  movement_id INTEGER NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  name TEXT NOT NULL,
  scheme_json TEXT NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1,
  is_time_based INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE (movement_id, level),
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);

CREATE TABLE IF NOT EXISTS user_movement_state (
  movement_id INTEGER PRIMARY KEY,
  current_level INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT,
  benchmark_done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
````

### План бега

````sql
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
````

### Факт бега (v4, v6, v7)

````sql
CREATE TABLE IF NOT EXISTS run_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT,           -- v6
  plan_id INTEGER,
  actual_km REAL,
  actual_pace TEXT,
  avg_hr INTEGER,
  max_hr INTEGER,
  duration_sec INTEGER,
  rpe INTEGER,
  source TEXT,               -- fit | tcx | dodofo | intervals-icu | strava-csv | manual | live-journal
  origin TEXT,               -- v4: strava-archive | zepp-app | manual-import | intervals-icu
  external_id TEXT,
  name TEXT,                 -- v11: провайдерское
  user_name TEXT,            -- v11: наше (переименование группы)
  raw_json TEXT,
  notes TEXT,
  -- v7
  gps_quality TEXT,
  distance_source TEXT,
  gps_coverage_pct REAL,
  FOREIGN KEY (plan_id) REFERENCES run_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_run_facts_date ON run_facts(date);
CREATE INDEX IF NOT EXISTS idx_run_facts_external
  ON run_facts(source, external_id);
CREATE INDEX IF NOT EXISTS idx_run_facts_origin ON run_facts(origin);
CREATE INDEX IF NOT EXISTS idx_run_facts_date_start
  ON run_facts(date, start_time);
````

**Семантика:**
- `source` — тип данных (fit, tcx, dodofo, strava-csv, intervals-icu).
- `origin` — откуда файл пришёл (strava-archive, zepp-app, manual-import, intervals-icu). **Не перезаписывается** при update, кроме случая `pb:import-zepp-dir` (может обновить origin на `zepp-app`, если файл был с другим origin).
- `external_id = '<source>:<basename>'`.
- `start_time` — ISO 8601 UTC. Локальная дата — в `date`.
- `name` — провайдерское название. `user_name` — только пользователь, никогда не перезаписывается.

### Стримы (v3)

Метаданные в SQLite, payload в файлах `.msgpack`:

````sql
CREATE TABLE IF NOT EXISTS run_streams (
  run_fact_id   INTEGER NOT NULL,
  source        TEXT NOT NULL,
  external_id   TEXT,
  file_path     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  point_count   INTEGER,
  channels      TEXT,
  fetched_at    TEXT NOT NULL,
  PRIMARY KEY (run_fact_id, source),
  FOREIGN KEY (run_fact_id) REFERENCES run_facts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_run_streams_source ON run_streams(source);
````

**Хранилище файлов:** `{userData}/prana_bindu/run_streams/{source}/{YYYY}/{id}.msgpack`.

**Payload внутри `.msgpack`:**
- UnifiedStreams: `secT`, `hr`, `speedKmh`, `cadence`, `elevationM`, `latlng`, `distM`.
- dodofo-специфичные ключи (`poly_sec_t`, `elevation_track_segments`, `hr_zones`, `summary`, `hr_curve`, `cadence_unit`, `max_hr_bpm`) сохраняются как есть.
- `latlng` — `[[lat, lng], …]`, кладётся в `fetchStreams` из `Activity.polyline`.

### Силовые (v1)

````sql
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
````

### Факт силовых (v18)

````sql
CREATE TABLE IF NOT EXISTS workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT,
  plan_event_id INTEGER,
  program_key TEXT,
  generator_category TEXT,
  exercises_json TEXT NOT NULL,
  rpe INTEGER,
  is_test INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
````

**Семантика:**
- `exercises_json` — `{ exercises: SessionExercise[] }`.
- `SessionExercise`: `{ movementKey, level, rung, target, actualSets, isTimeBased, skipped?, notes? }`.
- `rung` — достигнутый rung (для тестов — из `detectRung`, не текущий).
- `is_test = 1` — проверка уровня из `CheckLevelDialog`.
- `program_key = null` — свободная сессия (не из программы).

### Прогресс движений Mentat (v19)

````sql
CREATE TABLE IF NOT EXISTS exercise_progress (
  movement_key TEXT PRIMARY KEY,
  current_level INTEGER NOT NULL DEFAULT 1,
  current_rung INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
````

**Семантика:** ключ — `movementKey` из `exerciseCatalog` (например, `pushup`, `dips`, `runnersquat`). Отдельно от `user_movement_state` (там Big-6 из Crysknife).

**Репозиторий:** `getExerciseProgress` / `listExerciseProgress` / `setExerciseProgress` / `deleteExerciseProgress`.

### Восстановление (v8, v9, v20)

````sql
CREATE TABLE IF NOT EXISTS recovery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  -- v1
  sleep_hours REAL,
  sleep_quality INTEGER,
  hrv INTEGER,
  resting_hr INTEGER,
  status TEXT,
  notes TEXT,
  -- v8
  weight_kg REAL,
  sleep_score INTEGER,
  sleep_total_min INTEGER,
  deep_min INTEGER,
  rem_min INTEGER,
  light_min INTEGER,
  awake_min INTEGER,
  steps INTEGER,
  vo2max REAL,
  body_battery_charged INTEGER,
  body_battery_drained INTEGER,
  stress_avg INTEGER,
  auto_source TEXT,
  raw_json TEXT,
  -- v9 (intervals.icu)
  ctl REAL,
  atl REAL,
  ramp_rate REAL,
  readiness INTEGER,
  soreness INTEGER,
  fatigue INTEGER,
  stress INTEGER,
  mood INTEGER,
  motivation INTEGER,
  injury INTEGER,
  avg_sleeping_hr INTEGER,
  hrv_sdnn REAL,
  baevsky_si REAL,
  sp_o2 INTEGER,
  systolic INTEGER,
  diastolic INTEGER,
  -- v20
  sources_json TEXT,
  calories_active INTEGER,
  calories_total INTEGER,
  body_fat_pct REAL
);
````

**Семантика:**
- Upsert по `date` (UNIQUE).
- Merge-семантика: новые значения перезаписывают, `null` не затирает.
- `auto_source` — имя нашего провайдера (`dodofo`, `intervals-icu`).
- `sources_json` — массив источников, которые писали в дату (аккумулируется, не перезаписывается): `["intervals-icu","dodofo"]`.

### Контрольные тесты (v1)

````sql
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
````

### Типовые недели (v1)

````sql
CREATE TABLE IF NOT EXISTS week_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phase TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS week_template_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  run_json TEXT,
  strength_json TEXT,
  recovery_flag INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES week_templates(id) ON DELETE CASCADE,
  UNIQUE (template_id, day_of_week)
);
````

### Настройки синхронизации (v2, v5)

````sql
CREATE TABLE IF NOT EXISTS sync_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT,
  mode TEXT NOT NULL DEFAULT 'manual',
  auto_interval_min INTEGER,
  auto_on_start INTEGER NOT NULL DEFAULT 0,
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
  zepp_archive_path TEXT,
  dodofo_token TEXT,
  dodofo_user_id TEXT,
  dodofo_username TEXT,
  dodofo_last_sync_at TEXT,
  dodofo_last_sync_status TEXT,
  intervals_api_key TEXT,
  intervals_athlete_id TEXT,
  intervals_last_sync_at TEXT,
  intervals_last_sync_status TEXT,
  fit_archive_path TEXT,
  last_sync_at TEXT,
  last_sync_status TEXT
);
````

**Семантика (v21, 2026-10-08):**
- `auto_on_start = 1` и `auto_interval_min = 360` — дефолты.
- `pb:auto-sync-on-start` — единственный флаг `autoOnStart` (поле `mode` синхронизируется с чекбоксом, но не блокирует).
- Антидребезг 6 ч. Синкает workouts + wellness за 7 дней.
- `last_sync_status` пишется после каждого автосинка.

### События плана (v15, v16)

````sql
CREATE TABLE IF NOT EXISTS plan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  date TEXT NOT NULL,
  start_time TEXT,
  category TEXT,
  sport TEXT,
  name TEXT NOT NULL,
  description TEXT,
  planned_load REAL,
  duration_sec INTEGER,
  distance_m INTEGER,
  steps_json TEXT,
  icu_workout_json TEXT,
  raw_json TEXT,
  paired_activity_id INTEGER,
  generator_category TEXT,
  generator_program_key TEXT,
  local_keep INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_plan_events_date ON plan_events(date);
````

**Семантика:**
- `local_keep = 1` — пользователь «закрепил» событие, mirror-удаление его не тронет.
- `generator_category` — категория программы (Wade / Runner / Cali / Circuit).
- `paired_activity_id` — связь с `run_facts.id` (по дате + sport).

### Соответствия между каталогами (v21)

````sql
CREATE TABLE IF NOT EXISTS equivalences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_level TEXT,
  target TEXT NOT NULL,
  target_key TEXT NOT NULL,
  target_level TEXT,
  confidence TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source, source_key, source_level, target, target_key, target_level)
);

CREATE INDEX IF NOT EXISTS idx_equivalences_source
  ON equivalences(source, source_key);
CREATE INDEX IF NOT EXISTS idx_equivalences_target
  ON equivalences(target, target_key);
````

**Семантика:**
- UNIQUE по всем шести полям (source + source_key + source_level + target + target_key + target_level).
- Upsert (setEquivalence проверяет существование, обновляет confidence + note, не создаёт дубль).
- Используется в UI: «≈ Push Up (Beginner)» рядом с нашими движениями.

**Репозиторий:** `listEquivalences` / `listEquivalencesFor` / `listEquivalencesForTarget` / `setEquivalence` / `deleteEquivalence`.

### Рекомендации (v1)

````sql
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
````

## Миграции

| Версия | Что | Дата |
|--------|-----|------|
| v1 | Все базовые таблицы + индексы | 2026-09-22 |
| v2 | Колонки dodofo в `sync_settings` | 2026-09-26 |
| v3 | `run_streams` (файловое хранилище) | 2026-09-29 |
| v4 | `origin` в `run_facts` | 2026-09-29 |
| v5 | `fit_archive_path` в `sync_settings` | 2026-09-29 |
| v6 | `start_time` в `run_facts` | 2026-09-29 |
| v7 | `gps_quality`, `distance_source`, `gps_coverage_pct` | 2026-09-30 |
| v8 | Расширение `recovery_logs` (сон, battery, calories) | 2026-09-30 |
| v9 | intervals.icu: `ctl`, `atl`, `ramp_rate` | 2026-09-30 |
| v10 | `lthr_source`, `max_hr_source`, `resting_hr_source` | 2026-10-01 |
| v11 | `name` / `user_name` в `run_facts` | 2026-10-02 |
| v13 | `hr_zones_json` + `hr_zones_source` в `profile` | 2026-10-02 |
| v14 | `pace_zones_json` + `threshold_pace_ms` + `pace_zones_source` | 2026-10-02 |
| v15 | Таблица `plan_events` | 2026-10-03 |
| v16 | `plan_events.local_keep` | 2026-10-05 |
| v17 | `gps_quality`, `distance_source`, `gps_coverage_pct` (уточнение) | 2026-10-06 |
| v18 | Таблица `workout_sessions` (факт силовых) | 2026-10-06 |
| v19 | Таблица `exercise_progress` (прогресс движений Mentat) | 2026-10-07 |
| v20 | `recovery_logs` += `sources_json`, `calories_active`, `calories_total`, `body_fat_pct` | 2026-10-08 |
| v21 | Таблица `equivalences` (соответствия между каталогами) | 2026-10-08 |
| v22 | `sync_settings.auto_providers_json` | 2026-10-18 |
| v23 | `run_facts.streams_loaded` + `streams_failed_at` | 2026-10-18 |
| v24 | `sync_settings.auto_range_days` | 2026-10-18 |
| v25 | Таблица `threshold_history` (история расчётов LTHR/HRmax/RestHR) | 2026-10-19 |
| v26 | Таблица `test_segments` (C.1–C.4) | 2026-10-22 |
| v32 | Таблицы `chains`, `chain_slots` (C.12) | 2026-10-27 |

Все миграции идемпотентны через `PRAGMA table_info(...)` + `IF NOT EXISTS`.

**`SCHEMA_VERSION = 21`.**

### v22 (план)

- **`run_facts.training_load REAL`** — вынести из `raw_json` в отдельную колонку. Нужно для честного TSS в превью программ и в бегущей строке.
- **Расчёт TSS для FIT/TCX** — эвристика через HR-зоны (если есть `lthr` и поток `hr`).
- **`sources_json` в `run_facts`** — массив источников одной физической тренировки.
- **Канонический `run_events` + `run_sources`** — дедупликация между агрегаторами на уровне БД.

## Что нужно сделать

1. `recoveryRepo.ts` — сделан (v20).
2. `movementsRepo.ts`, `progressionsRepo.ts` (05_CRYSKNIFE).
3. `runPlansRepo.ts`, `templatesRepo.ts`, `recommendationsRepo.ts` — по мере надобности.
4. `seed.ts` — 60 записей `progressions`.
5. v22 — `training_load` в `run_facts`, если решим вынести.

## Ограничения

- Никаких импортов Electron.
- Только CRUD, без бизнес-логики.
- Репозитории возвращают domain-объекты (camelCase).
- Миграции идемпотентны.
- Секретные поля — зашифрованные снаружи.
- Не логировать секреты.
- Порядок таблиц: `movements` до `progressions`, `week_templates` до `week_template_days`, `run_plans` до `run_facts`.

## Проверка

````bash
sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT value FROM meta WHERE key='schema_version';"
# → 21

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT source, origin, COUNT(*) FROM run_facts
   GROUP BY source, origin;"

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT COUNT(*) FROM run_streams WHERE source='dodofo'
   AND channels LIKE '%latlng%';"
# → 264

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT date, sources_json, calories_active FROM recovery_logs
   ORDER BY date DESC LIMIT 5;"

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT source, source_key, source_level, target, target_key,
          target_level FROM equivalences;"
````

````js
await window.electronAPI.pb.getProfile()
await window.electronAPI.pb.listRunFactsByDate('2026-09-12')
await window.electronAPI.pb.listEquivalences()
````

## Definition of Done

- [x] `SCHEMA_VERSION = 21`.
- [x] Колонки `origin`, `start_time` в `run_facts`.
- [x] Таблица `run_streams` + файловое хранилище.
- [x] `runStreamsRepo.ts`, `recoveryRepo.ts`, `planEventsRepo.ts`.
- [x] `workoutSessionsRepo.ts`, `exerciseProgressRepo.ts`.
- [x] `equivalencesRepo.ts` (v21).
- [x] Backfill `start_time`.
- [x] `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 08

- Бизнес-логику.
- UI.
- Провайдеры и парсеры — 07_SPICE.
- 60 ступеней Big-6 — 05_CRYSKNIFE.
- Расчёт TSS для FIT/TCX — до v22.


==============================================

# Направление 08: Melange (схема БД, миграции)

> Обновлено: 2026-10-05
> Статус: v1 → **v16** готовы.

## Роль

Локальная БД `prana_bindu.db`. Профиль, планы, факты, прогрессии
Big-6, восстановление, настройки синхронизации, рекомендации.

## Зона ответственности

- Файл `prana_bindu.db` в `app.getPath('userData')`.
- Схема таблиц, индексы, миграции (idempotent).
- Слой доступа к данным (CRUD).
- Никакой бизнес-логики.

## Технические решения

- `node:sqlite`, синглтон, ленивая инициализация.
- Миграции — массив функций, версия в `meta.schema_version`.
- Все даты — ISO 8601 UTC. Локальная зона — на границе репозитория.
- JSON-поля — `TEXT`. Потоки — `.msgpack` файлы на диске.
- Импорт `electron` в этой папке запрещён (`safeStorage` — снаружи).
- Секреты хранятся уже зашифрованными.

## Текущее состояние

**Реализовано:**
- `db.ts`, `schema.ts`, `migrations.ts` (`SCHEMA_VERSION = 6`),
  `seed.ts`, `types.ts`, `index.ts`.
- `repositories/index.ts`, `profileRepo.ts`, `syncRepo.ts`,
  `runFactsRepo.ts`, `runStreamsRepo.ts`.
- v13: `hr_zones_json` / `hr_zones_source` в `profile`.
- v14: `pace_zones_json` / `threshold_pace_ms` / `pace_zones_source`.
- v15: таблица `plan_events`.
- v16: `plan_events.local_keep` — флаг «не удалять при mirror-синке».

**TODO:**
- `movementsRepo.ts`, `progressionsRepo.ts`, `runPlansRepo.ts`,
  `strengthRepo.ts`, `recoveryRepo.ts`, `templatesRepo.ts`,
  `recommendationsRepo.ts`.
- 60 ступеней Big-6 в `progressions` — блокируется `05_CRYSKNIFE.md`.

## Файловая структура

```
melange/
├── db.ts                       ← готов
├── schema.ts                   ← готов
├── migrations.ts               ← v1..v6
├── seed.ts                     ← готов
├── types.ts                    ← готов
├── index.ts                    ← готов
└── repositories/
    ├── index.ts                ← готов
    ├── profileRepo.ts          ← готов
    ├── syncRepo.ts             ← готов
    ├── runFactsRepo.ts         ← готов
    ├── runStreamsRepo.ts       ← готов
    ├── movementsRepo.ts        ← TODO
    ├── progressionsRepo.ts     ← TODO
    ├── runPlansRepo.ts         ← TODO
    ├── strengthRepo.ts         ← TODO
    ├── recoveryRepo.ts         ← TODO (07)
    ├── templatesRepo.ts        ← TODO
    └── recommendationsRepo.ts  ← TODO
```

## Схема (актуальная версия — v6)

### Мета, профиль

```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

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
```

### Big-6

```sql
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS progressions (
  id INTEGER PRIMARY KEY,
  movement_id INTEGER NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  name TEXT NOT NULL,
  scheme_json TEXT NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1,
  is_time_based INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE (movement_id, level),
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);

CREATE TABLE IF NOT EXISTS user_movement_state (
  movement_id INTEGER PRIMARY KEY,
  current_level INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT,
  benchmark_done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### План бега

```sql
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
```

### Факт бега (v6)

```sql
CREATE TABLE IF NOT EXISTS run_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT,           -- v6
  plan_id INTEGER,
  actual_km REAL,
  actual_pace TEXT,
  avg_hr INTEGER,
  max_hr INTEGER,
  duration_sec INTEGER,
  rpe INTEGER,
  source TEXT,               -- fit | tcx | dodofo | manual | live-journal
  origin TEXT,               -- v4: strava-archive | zepp-app | ...
  external_id TEXT,
  raw_json TEXT,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES run_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_run_facts_date ON run_facts(date);
CREATE INDEX IF NOT EXISTS idx_run_facts_external
  ON run_facts(source, external_id);
CREATE INDEX IF NOT EXISTS idx_run_facts_origin ON run_facts(origin);
CREATE INDEX IF NOT EXISTS idx_run_facts_date_start
  ON run_facts(date, start_time);
```

**Семантика:**
- `source` — тип данных (fit, tcx, dodofo).
- `origin` — откуда файл пришёл (strava-archive, zepp-app,
  manual-import). **Не перезаписывается при update.**
- `external_id = '<source>:<basename>'`.
- `start_time` — ISO 8601 UTC. Локальная дата — в `date`.

### Стримы (v3)

Метаданные в SQLite, payload в файлах `.msgpack`:

```sql
CREATE TABLE IF NOT EXISTS run_streams (
  run_fact_id   INTEGER NOT NULL,
  source        TEXT NOT NULL,
  external_id   TEXT,
  file_path     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  point_count   INTEGER,
  channels      TEXT,
  fetched_at    TEXT NOT NULL,
  PRIMARY KEY (run_fact_id, source),
  FOREIGN KEY (run_fact_id) REFERENCES run_facts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_run_streams_source ON run_streams(source);
```

**Хранилище файлов:**
`{userData}/prana_bindu/run_streams/{source}/{YYYY}/{id}.msgpack`.

**Payload внутри `.msgpack`:**
- UnifiedStreams: `secT`, `hr`, `speedKmh`, `cadence`,
  `elevationM`, `latlng`, `distM`.
- dodofo-специфичные ключи (`poly_sec_t`, `hr_zones`, `summary`)
  сохраняются как есть — без маппинга.

### Силовые

```sql
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
```

### Восстановление

```sql
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
```

### Контрольные тесты

```sql
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
```

### Типовые недели

```sql
CREATE TABLE IF NOT EXISTS week_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phase TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS week_template_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  run_json TEXT,
  strength_json TEXT,
  recovery_flag INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES week_templates(id) ON DELETE CASCADE,
  UNIQUE (template_id, day_of_week)
);
```

### Настройки синхронизации (v5)

```sql
CREATE TABLE IF NOT EXISTS sync_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT,
  mode TEXT NOT NULL DEFAULT 'manual',
  auto_interval_min INTEGER,
  auto_on_start INTEGER NOT NULL DEFAULT 0,
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
  dodofo_token TEXT,
  dodofo_user_id TEXT,
  dodofo_username TEXT,
  dodofo_last_sync_at TEXT,
  dodofo_last_sync_status TEXT,
  fit_archive_path TEXT,        -- v5
  last_sync_at TEXT,
  last_sync_status TEXT
);
```

### Рекомендации

```sql
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
```


## Миграции

| Версия | Что | Дата |
|--------|-----|------|
| v1 | Все базовые таблицы + индексы | 2026-09-22 |
| v2 | Колонки dodofo в `sync_settings` | 2026-09-26 |
| v3 | `run_streams` (файловое хранилище) | 2026-09-29 |
| v4 | `origin` в `run_facts` | 2026-09-29 |
| v5 | `fit_archive_path` в `sync_settings` | 2026-09-29 |
| v6 | `start_time` в `run_facts` | 2026-09-29 |
| v7 | `gps_quality`, `distance_source`, `gps_coverage_pct` в `run_facts` | 2026-09-30 |
| v8 | Расширение `recovery_logs` (сон, battery, calories) | 2026-09-30 |
| v9 | intervals.icu: `ctl`, `atl`, `ramp_rate`, ... в `recovery_logs`; ключи в `sync_settings` | 2026-09-30 |
| v13 | hr_zones в profile | 2026-10-02 |
| v14 | pace_zones + threshold_pace_ms | 2026-10-02 |
| v15 | plan_events (план тренировок из ICU) | 2026-10-03 |
| v16 | plan_events.local_keep (mirror-семантика) | 2026-10-05 |

Все миграции идемпотентны через `PRAGMA table_info(...)` + `IF NOT EXISTS`.

**`SCHEMA_VERSION = 16`.**

### v10 (план)

Возможные направления:
- `title TEXT`, `description TEXT` в `run_facts` (Strava CSV).
- Канонический `run_events` + `run_sources` для multi-source дедупа.
- `plan_events` — план тренировок из intervals.icu.
- `weekly_snapshots` — агрегаты по неделям (для CTL/ATL).

### v11 (идея)

- `run_sources` — таблица связи канонической тренировки с её
  источниками. Один физический забег → N источников (dodofo,
  intervals-icu, strava-archive). Позволяет не дублировать
  `run_facts` и хранить полную картину.

## Что нужно сделать

1. **`recoveryRepo.ts`** — `upsertRecoveryLog`, `listRecoveryLogs`.
2. **`movementsRepo.ts`**, **`progressionsRepo.ts`** (05_CRYSKNIFE).
3. **`runPlansRepo.ts`**, **`strengthRepo.ts`**, **`templatesRepo.ts`**,
   **`recommendationsRepo.ts`** — по мере надобности.
4. **`seed.ts`** — 60 записей `progressions`.
5. **v7** — по мере появления новых источников.

## Ограничения

- Никаких импортов Electron.
- Только CRUD, без бизнес-логики.
- Репозитории возвращают domain-объекты (camelCase).
- Миграции идемпотентны.
- Секретные поля — зашифрованные снаружи.
- Не логировать секреты.
- Порядок таблиц: `movements` до `progressions`,
  `week_templates` до `week_template_days`,
  `run_plans` до `run_facts`.

## Проверка

```bash
sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT value FROM meta WHERE key='schema_version';"
# → 6

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT source, origin, COUNT(*) FROM run_facts
   GROUP BY source, origin;"
```

```js
await window.electronAPI.pb.getProfile()
await window.electronAPI.pb.listRunFactsByDate('2026-09-12')
```

## Definition of Done

- [x] `SCHEMA_VERSION = 6`.
- [x] Колонки `origin`, `start_time` в `run_facts`.
- [x] Таблица `run_streams` + файловое хранилище.
- [x] `runStreamsRepo.ts`.
- [x] Backfill `start_time`.
- [ ] `recoveryRepo.ts`.
- [x] `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 08

- Бизнес-логику.
- UI.
- Провайдеры и парсеры — 07_SPICE.
- 60 ступеней Big-6 — 05_CRYSKNIFE.


==============================================

# Направление 08: Melange (схема БД, миграции)

> Обновлено: 2026-09-28
> Статус: v1 + v2 реализованы. v3 — в разработке (GPS-качество).

## Роль
Локальная БД `prana_bindu.db`. Профиль, планы, факты, прогрессии
Big-6, восстановление, настройки синхронизации, рекомендации.

## Зона ответственности
- Файл `prana_bindu.db` в `app.getPath('userData')`.
- Схема таблиц, индексы, миграции (idempotent).
- Слой доступа к данным (CRUD).
- Никакой бизнес-логики.

## Технические решения
- `node:sqlite`, синглтон, ленивая инициализация.
- Миграции — массив функций, версия в `meta.schema_version`.
- Все даты — ISO 8601 UTC. Локальная зона — на границе репозитория.
- JSON-поля — `TEXT`.
- Импорт `electron` в этой папке запрещён. `safeStorage` — снаружи.
- Секреты хранятся уже зашифрованными.

## Текущее состояние

**Реализовано:**
- `db.ts`, `schema.ts`, `migrations.ts` (`SCHEMA_VERSION = 2`),
  `seed.ts`, `types.ts`, `index.ts`.
- `repositories/index.ts`, `profileRepo.ts`, `syncRepo.ts`,
  `runFactsRepo.ts`.

**TODO:**
- v3 — миграция (GPS-качество).
- `movementsRepo.ts`, `progressionsRepo.ts`, `runPlansRepo.ts`,
  `strengthRepo.ts`, `recoveryRepo.ts`, `templatesRepo.ts`,
  `recommendationsRepo.ts`.
- 60 ступеней Big-6 в `progressions` — блокируется `05_CRYSKNIFE.md`.

## Файловая структура

```
melange/
├── db.ts                     ← готов
├── schema.ts                 ← готов
├── migrations.ts             ← v1, v2
├── seed.ts                   ← готов
├── types.ts                  ← готов
├── index.ts                  ← готов
└── repositories/
    ├── index.ts              ← готов
    ├── profileRepo.ts        ← готов
    ├── syncRepo.ts           ← готов
    ├── runFactsRepo.ts       ← готов
    ├── movementsRepo.ts      ← TODO
    ├── progressionsRepo.ts   ← TODO
    ├── runPlansRepo.ts       ← TODO
    ├── strengthRepo.ts       ← TODO
    ├── recoveryRepo.ts       ← TODO (07)
    ├── templatesRepo.ts      ← TODO
    └── recommendationsRepo.ts ← TODO
```

## Схема (актуальная версия — v2, v3 в разработке)

### Профиль

```sql
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
```

### Big-6: движения

```sql
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,   -- pushups / squats / pullups / leg_raises / bridge / stand
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);
```

### Big-6: ступени

```sql
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
```

### Текущее состояние пользователя

```sql
CREATE TABLE IF NOT EXISTS user_movement_state (
  movement_id INTEGER PRIMARY KEY,
  current_level INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT,
  benchmark_done INTEGER NOT NULL DEFAULT 0 CHECK (benchmark_done IN (0,1)),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### План бега

```sql
CREATE TABLE IF NOT EXISTS run_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,        -- easy / threshold / interval / long / race / rest
  zone INTEGER,
  target_km REAL,
  target_pace TEXT,
  target_hr_min INTEGER,
  target_hr_max INTEGER,
  notes TEXT
);
```

### Факт бега (v2, v3 добавляет три колонки)

```sql
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
  source TEXT,               -- fit / tcx / dodofo / manual / live-journal
  external_id TEXT,
  raw_json TEXT,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES run_plans(id)
);
CREATE INDEX IF NOT EXISTS idx_run_facts_date ON run_facts(date);
CREATE INDEX IF NOT EXISTS idx_run_facts_external
  ON run_facts(source, external_id);
```

**v3 добавит:**

```sql
ALTER TABLE run_facts ADD COLUMN gps_quality TEXT;         -- good | poor | lost
ALTER TABLE run_facts ADD COLUMN distance_source TEXT;     -- gps | accelerometer | manual
ALTER TABLE run_facts ADD COLUMN gps_coverage_pct REAL;    -- 0..100
```

> Классификация GPS-качества — при импорте. Ручной override — в UI.

### План силовой

```sql
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
```

### Факт силовой

```sql
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
```

### Восстановление

```sql
CREATE TABLE IF NOT EXISTS recovery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  sleep_hours REAL,
  sleep_quality INTEGER,     -- 1..5
  hrv INTEGER,               -- HRV, мс
  resting_hr INTEGER,
  status TEXT,               -- green / yellow / red
  notes TEXT
);
```

> Заполняется из dodofo `/api/v1/wellness` (07_SPICE).

### Контрольные тесты

```sql
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
```

### Типовые недели

```sql
CREATE TABLE IF NOT EXISTS week_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phase TEXT,                -- base / build / peak / taper / race / recovery
  description TEXT
);

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
```

### Настройки синхронизации (v2)

```sql
CREATE TABLE IF NOT EXISTS sync_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT,                    -- dodofo | google-fit | zepp-dofek | zepp-mcp | zeppbridge | manual
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
  dodofo_token TEXT,
  dodofo_user_id TEXT,
  dodofo_username TEXT,
  dodofo_last_sync_at TEXT,
  dodofo_last_sync_status TEXT,
  last_sync_at TEXT,
  last_sync_status TEXT
);
```

### AI-рекомендации

```sql
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
```

### Мета

```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## Миграции

| Версия | Что | Дата |
|--------|-----|------|
| v1 | Все базовые таблицы + индексы | 2026-09-22 |
| v2 | Колонки dodofo в `sync_settings` | 2026-09-26 |
| v3 | `run_streams` (файловое хранилище) | 2026-09-29 |
| v4 | `origin` в `run_facts` | 2026-09-29 |
| v5 | `fit_archive_path` в `sync_settings` | 2026-09-29 |
| v6 | `start_time` в `run_facts` | 2026-09-29 |
| v7 | `gps_quality`, `distance_source`, `gps_coverage_pct` | 2026-09-30 |
| v8 | Расширение `recovery_logs` (сон, battery, calories) | 2026-09-30 |
| v9 | intervals.icu: `ctl`, `atl`, `ramp_rate`, ... | 2026-09-30 |
| v10 | `lthr_source`, `max_hr_source`, `resting_hr_source` в `profile` | 2026-10-02 |
| v11 | `name`, `user_name` в `run_facts` | 2026-10-02 |
| v12 | `zepp_archive_path` в `sync_settings` | 2026-10-02 |
| v13 | `hr_zones_json`, `hr_zones_source` в `profile` | 2026-10-02 |
| v14 | `pace_zones_json`, `threshold_pace_ms`, `pace_zones_source` в `profile` | 2026-10-02 |
| v15 | Таблица `plan_events` (Mentat) | 2026-10-02 |

**`SCHEMA_VERSION = 15`.**

### v16 (план)

- `plan_events.category` — добавить индекс по `sport`.
- Канонический `run_events` + `run_sources` для multi-source дедупа.
- `weekly_snapshots` — агрегаты по неделям (для CTL/ATL).
- Потоковые данные wellness — если появится источник.

## Что нужно сделать

1. **v3 миграция** — GPS-колонки в `run_facts`.
2. **`recoveryRepo.ts`** — `upsertRecoveryLog`, `listRecoveryLogs`.
3. **Расширение `runFactsRepo`** — поддержка `gps_quality`,
   `distance_source`, `gps_coverage_pct` в `upsert`.
4. **`movementsRepo.ts`** + **`progressionsRepo.ts`** (05_CRYSKNIFE).
5. **`runPlansRepo.ts`**, **`strengthRepo.ts`**, **`templatesRepo.ts`**,
   **`recommendationsRepo.ts`** — по мере надобности.
6. **`seed.ts`** — 60 записей `progressions` (после `05_CRYSKNIFE.md`).

## Ограничения

- Никаких импортов Electron.
- Только CRUD.
- Репозитории возвращают domain-объекты (camelCase).
- Миграции идемпотентны.
- Секретные поля — зашифрованные снаружи.
- Не логировать секреты.
- Порядок таблиц: `movements` до `progressions`,
  `week_templates` до `week_template_days`,
  `run_plans` до `run_facts`.

## Проверка

1. **Пустая БД.** `openMelange(tmpPath)` → таблицы созданы,
   `schema_version = 3` (после v3).
2. **Повторный запуск.** Миграции пропущены.
3. **Seed.** 6 движений, одна строка `profile`, одна `sync_settings`.
4. **CRUD.** `run_plan` → `run_fact` → прочитать → обновить → удалить.
5. **Каскад.** Удалить `week_template` → дни удалены.
6. **`sync_settings`.** `updateSyncSettings({ source: 'dodofo' })`.
7. **Секреты dodofo.** `setDodofoToken`, `hasDodofoToken`.
8. **GPS.** `upsertRunFact` с `gpsQuality='poor'` → БД содержит
   `gps_quality = 'poor'`, `distance_source = 'accelerometer'`.

## Definition of Done

- `SCHEMA_VERSION = 3`.
- Колонки GPS в `run_facts`.
- `recoveryRepo.ts` готов.
- `runFactsRepo.upsert` принимает `UnifiedWorkout`.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 08

- Бизнес-логику.
- UI.
- Провайдеры и парсеры — 07_SPICE.
- 60 ступеней Big-6 — 05_CRYSKNIFE.


==============================================

# Направление 08: Melange (схема БД, миграции)

> Обновлено: 2026-09-26
> Статус: v1 и v2 реализованы, v3 — план.

## Роль
Локальная БД модуля Prana-Bindu. Хранит профиль, планы, факты,
прогрессии Big-6, восстановление, настройки синхронизации,
рекомендации.

## Зона ответственности
- Файл `prana_bindu.db` в `app.getPath('userData')`.
- Схема таблиц, индексы, миграции (idempotent).
- Слой доступа к данным для всех модулей
  (`core`, `stillsuit`, `crysknife`, `mentat`, `waterDiscipline`, `spice`).
- Никакой бизнес-логики — только CRUD и типизация.

## Технические решения
- `node:sqlite` (встроен, без нативных зависимостей). Уже используется
  в OSINT — берём тот же подход.
- Открытие БД — синглтон, ленивая инициализация.
- Миграции — массив функций, применяются по порядку по номеру версии.
  Версия схемы в таблице `meta` (ключ `schema_version`).
- Все даты — ISO 8601 UTC. Локальное время — только при отображении.
- JSON-поля (`scheme_json`, `sets_json`, `raw_json`, `context_json`,
  `suggestion_json`, `google_token_json`, `zepp_credentials_json`) —
  как `TEXT`, парсятся в типах.
- Путь к `userData` передаётся снаружи — импорт `electron` в этой папке
  запрещён (правило из `STRUCTURE.md`).
- Секреты (`dodofo_token`, `zepp_credentials_json`, `zepp_app_token`,
  `google_token_json`) хранятся **уже зашифрованными** (через
  `safeStorage` в handler'е). Melange к `safeStorage` не обращается.

## Текущее состояние (2026-09-26)

**Реализовано:**
- `db.ts` — синглтон, `openMelange` / `getMelange` / `closeMelange`.
- `schema.ts` — SQL-строки всех таблиц + `ALL_TABLES`, `ALL_INDEXES`,
  `MIGRATION_V2_DODOFO`.
- `migrations.ts` — `SCHEMA_VERSION = 2`, `applyMigrations`.
- `seed.ts` — 6 движений, одна строка `profile`, одна строка
  `sync_settings`.
- `types.ts` — row-типы (`ProfileRow`, `SyncSettingsRow`, `MetaRow`,
  `MovementsRow`, `ProgressionsRow`, `UserMovementStateRow`,
  `RecoveryLogsRow`).
- `index.ts` — barrel.
- `repositories/profileRepo.ts` — `getProfile`, `updateProfile`.
- `repositories/syncRepo.ts` — `getSyncSettings`, `updateSyncSettings`,
  `setZeppSecrets`, `getSyncSecretsFlags`, `setDodofoToken`,
  `getDodofoTokenEncrypted`, `hasDodofoToken`.
- `repositories/index.ts` — barrel.

**Не реализовано (TODO):**
- `movementsRepo.ts`, `progressionsRepo.ts`, `runPlansRepo.ts`,
  `runFactsRepo.ts`, `strengthRepo.ts`, `recoveryRepo.ts`,
  `templatesRepo.ts`, `recommendationsRepo.ts`.
- Заполнение 60 ступеней Big-6 в `progressions` — блокируется
  `05_CRYSKNIFE.md`.
- Миграция v3 — при необходимости (см. ниже).

## Файловая структура (внутри `melange/`)

```
melange/
├── db.ts                     ← реализован
├── schema.ts                 ← реализован
├── migrations.ts             ← реализован (v1, v2)
├── seed.ts                   ← реализован
├── types.ts                  ← реализован
├── index.ts                  ← реализован
└── repositories/
    ├── index.ts              ← реализован
    ├── profileRepo.ts        ← реализован
    ├── syncRepo.ts           ← реализован
    ├── movementsRepo.ts      ← TODO
    ├── progressionsRepo.ts   ← TODO
    ├── runPlansRepo.ts       ← TODO
    ├── runFactsRepo.ts       ← TODO (07_SPICE, первая задача)
    ├── strengthRepo.ts       ← TODO
    ├── recoveryRepo.ts       ← TODO (07_SPICE)
    ├── templatesRepo.ts      ← TODO
    └── recommendationsRepo.ts ← TODO
```

## Схема (актуальная версия — v2)

### Профиль

```sql
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age INTEGER,
  max_hr INTEGER,
  lthr INTEGER,             -- ПАНО, если известно
  resting_hr INTEGER,
  weight_kg REAL,
  goal_marathon_date TEXT,  -- '2026-09-27'
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

> TS-тип `Profile` в `core/types.ts` использует camelCase
> (`maxHr`, `lthr`, `restingHr`, `marathonDate`), репозиторий
> конвертирует snake_case ↔ camelCase на границе.

### Big-6: движения

```sql
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);
```

> Коды — точно как в `services/pranaBindu/crysknife/big6.ts`
> (`BIG6_MOVEMENTS`): `pushups`, `squats`, `pullups`, `leg_raises`,
> `bridge`, `stand`.

### Big-6: ступени

```sql
CREATE TABLE IF NOT EXISTS progressions (
  id INTEGER PRIMARY KEY,
  movement_id INTEGER NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  name TEXT NOT NULL,
  scheme_json TEXT NOT NULL,   -- [{set:1,reps:10},{set:2,reps:25},{set:3,reps:50}]
  repeat_count INTEGER NOT NULL DEFAULT 1,
  is_time_based INTEGER NOT NULL DEFAULT 0 CHECK (is_time_based IN (0,1)),
  notes TEXT,
  UNIQUE (movement_id, level),
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### Текущее состояние пользователя по движению

```sql
CREATE TABLE IF NOT EXISTS user_movement_state (
  movement_id INTEGER PRIMARY KEY,
  current_level INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT,
  benchmark_done INTEGER NOT NULL DEFAULT 0 CHECK (benchmark_done IN (0,1)),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### План бега

```sql
CREATE TABLE IF NOT EXISTS run_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,        -- easy / threshold / interval / long / race / rest
  zone INTEGER,              -- 1..5
  target_km REAL,
  target_pace TEXT,          -- '5:30'
  target_hr_min INTEGER,
  target_hr_max INTEGER,
  notes TEXT
);
```

### Факт бега

```sql
CREATE TABLE IF NOT EXISTS run_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  plan_id INTEGER,
  actual_km REAL,
  actual_pace TEXT,          -- '5:30'
  avg_hr INTEGER,
  max_hr INTEGER,
  duration_sec INTEGER,
  rpe INTEGER,               -- 1..10
  source TEXT,               -- dodofo / zepp-dofek / google-fit / manual
  external_id TEXT,          -- id в источнике, для дедупликации
  raw_json TEXT,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES run_plans(id)
);
CREATE INDEX IF NOT EXISTS idx_run_facts_date ON run_facts(date);
CREATE INDEX IF NOT EXISTS idx_run_facts_external
  ON run_facts(source, external_id);
```

> Дедупликация при синхронизации — по паре `(source, external_id)`.
> Для dodofo `external_id = 'dodofo:<activity_id>'`.

### План силовой

```sql
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
```

### Факт силовой

```sql
CREATE TABLE IF NOT EXISTS strength_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  plan_id INTEGER,
  movement_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  sets_json TEXT,            -- [{set:1,reps:12},{set:2,reps:15},{set:3,reps:10}]
  rpe INTEGER,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES strength_plans(id),
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### Восстановление

```sql
CREATE TABLE IF NOT EXISTS recovery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  sleep_hours REAL,
  sleep_quality INTEGER,     -- 1..5
  hrv INTEGER,               -- HRV, мс
  resting_hr INTEGER,
  status TEXT,               -- green / yellow / red
  notes TEXT
);
```

> Заполняется из dodofo `/api/v1/wellness` (в 07_SPICE).
> `sleep_hours` — из `sleep_hours` (ручной) или `sleep_total_min / 60`
> (авто); `hrv` — из `hrv_ms`; `resting_hr` — из `resting_hr`.

### Контрольные тесты

```sql
CREATE TABLE IF NOT EXISTS progress_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  run_pace TEXT,             -- фиксированный темп, например '5:30'
  run_avg_hr INTEGER,
  strength_movement_id INTEGER,
  strength_reps INTEGER,
  notes TEXT,
  FOREIGN KEY (strength_movement_id) REFERENCES movements(id)
);
```

### Типовые недели

```sql
CREATE TABLE IF NOT EXISTS week_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phase TEXT,                -- base / build / peak / taper / race / recovery
  description TEXT
);

CREATE TABLE IF NOT EXISTS week_template_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  run_json TEXT,             -- {type, zone, km, pace}
  strength_json TEXT,        -- {movement_code, level, sets, reps}
  recovery_flag INTEGER NOT NULL DEFAULT 0 CHECK (recovery_flag IN (0,1)),
  FOREIGN KEY (template_id) REFERENCES week_templates(id) ON DELETE CASCADE,
  UNIQUE (template_id, day_of_week)
);
```

> Фазы — те же, что `PeriodizationPhase` в `mentat/types.ts`.
> `day_of_week` — 1..7 (Пн=1, Вс=7).

### Настройки синхронизации (v2, с dodofo)

```sql
CREATE TABLE IF NOT EXISTS sync_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT,                    -- dodofo | google-fit | zepp-dofek | zepp-mcp | zeppbridge | manual
  mode TEXT NOT NULL DEFAULT 'manual',  -- auto | manual | both
  auto_interval_min INTEGER,
  auto_on_start INTEGER NOT NULL DEFAULT 0 CHECK (auto_on_start IN (0,1)),

  -- Google Fit
  google_token_json TEXT,         -- safeStorage-encrypted

  -- ZeppBridge (CLI)
  zeppbridge_path TEXT,

  -- Zepp (резерв, через dofek-zepp)
  zepp_provider TEXT,
  zepp_fallback_provider TEXT,
  zepp_credentials_json TEXT,     -- safeStorage-encrypted
  zepp_auth_host TEXT,
  zepp_data_host TEXT,
  zepp_app_token TEXT,            -- safeStorage-encrypted
  zepp_user_id TEXT,
  zepp_last_sync_at TEXT,
  zepp_last_sync_status TEXT,

  -- dodofo (основной источник)
  dodofo_token TEXT,              -- safeStorage-encrypted
  dodofo_user_id TEXT,
  dodofo_username TEXT,
  dodofo_last_sync_at TEXT,
  dodofo_last_sync_status TEXT,

  -- Общий статус (любой источник)
  last_sync_at TEXT,
  last_sync_status TEXT
);
```

> Поля `dodofo_*` добавлены миграцией v2 (см. ниже).
> Поле `source` расширено значением `'dodofo'` в
> `spice/types.ts` (`SyncSource`).

### AI-рекомендации

```sql
CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  provider TEXT NOT NULL,    -- ollama / deepseek / rule-based
  context_json TEXT,
  suggestion_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / accepted / rejected
  resolved_at TEXT,
  notes TEXT
);
```

### Мета (версия схемы)

```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## Миграции

### v1 — создание всех таблиц

- Все `CREATE TABLE IF NOT EXISTS` из раздела «Схема».
- Все индексы.
- Запись `meta.schema_version = 1`.

### v2 — dodofo

Добавление колонок в `sync_settings`:

```sql
ALTER TABLE sync_settings ADD COLUMN dodofo_token TEXT;
ALTER TABLE sync_settings ADD COLUMN dodofo_user_id TEXT;
ALTER TABLE sync_settings ADD COLUMN dodofo_username TEXT;
ALTER TABLE sync_settings ADD COLUMN dodofo_last_sync_at TEXT;
ALTER TABLE sync_settings ADD COLUMN dodofo_last_sync_status TEXT;
```

Реализация — идемпотентная: перед `ALTER` проверяется
`PRAGMA table_info(sync_settings)`; если колонка уже есть — пропускаем.
Так миграция безопасна на БД, где v1 создала таблицу сразу с этими
колонками.

### v3 (план, 07_SPICE)

Возможная миграция, если решим вынести секундные потоки тренировки
из `run_facts.raw_json` в отдельную таблицу:

```sql
CREATE TABLE IF NOT EXISTS run_streams (
  run_fact_id INTEGER PRIMARY KEY,
  dist_m TEXT,          -- JSON-массив
  sec_t TEXT,           -- JSON-массив
  speed_kmh TEXT,       -- JSON-массив
  hr TEXT,              -- JSON-массив
  power_w TEXT,         -- JSON-массив
  cadence_rpm TEXT,     -- JSON-массив
  hr_zones TEXT,        -- JSON [{zone, name, seconds, percent}]
  power_zones TEXT,     -- JSON
  summary_json TEXT,    -- сырой объект источника
  FOREIGN KEY (run_fact_id) REFERENCES run_facts(id) ON DELETE CASCADE
);
```

Решение о v3 — в 07_SPICE, после того как первая версия синхронизации
заработает и станет понятно, нужны ли быстрые запросы к потокам.

## Что нужно сделать

1. **`repositories/runFactsRepo.ts`** (07_SPICE, первая задача):
   - `upsertRunFact(db, raw: RawWorkout): { inserted: boolean; id: number }`
     — уникальность по `(source, external_id)`;
   - `listRunFacts(db, from, to): RunFactRow[]`;
   - `getRunFactByExternalId(db, source, externalId): RunFactRow | null`.

2. **`repositories/recoveryRepo.ts`** (07_SPICE):
   - `upsertRecoveryLog(db, log): { inserted: boolean; id: number }`
     по `date` (UNIQUE);
   - `listRecoveryLogs(db, from, to): RecoveryLogRow[]`.

3. **`repositories/movementsRepo.ts`** + **`progressionsRepo.ts`**
   (05_CRYSKNIFE):
   - чтение движений и ступеней;
   - `getUserMovementState` / `updateUserMovementState`.

4. **`repositories/runPlansRepo.ts`**, **`strengthRepo.ts`**,
   **`templatesRepo.ts`**, **`recommendationsRepo.ts`** — по мере
   разработки соответствующих модулей.

5. **`seed.ts`** — дополнить:
   - 60 записей `progressions` (после `05_CRYSKNIFE.md`);
   - ничего больше не нужно, кроме `movements` (уже есть).

## Ограничения

- Никаких импортов Electron.
- Никакой бизнес-логики. Только CRUD.
- Репозитории типизированы, возвращают domain-объекты (camelCase),
  не сырые строки (snake_case).
- Миграции идемпотентны. Повторный запуск не ломает БД.
- Секретные поля (`*_token`, `*_credentials_json`) хранят **уже
  зашифрованные** строки. Шифрование — через `safeStorage` **снаружи**,
  в handler'е.
- Секретные поля **не логировать** целиком.
- Порядок таблиц в DDL важен: `movements` до `progressions`,
  `week_templates` до `week_template_days`, `run_plans` до `run_facts`.

## Проверка (ручные сценарии)

1. **Пустая БД.** `openMelange(tmpPath)` → все таблицы созданы,
   `meta.schema_version = 2`.
2. **Повторный запуск.** `openMelange(tmpPath)` снова → миграции
   пропущены, данные не потеряны.
3. **Seed.** `seed()` → 6 движений, одна строка `profile`,
   одна строка `sync_settings`. `progressions` пуст (60 записей —
   TODO 05_CRYSKNIFE).
4. **CRUD по кругу.** Создать `run_plan`, затем `run_fact` со
   ссылкой на план. Прочитать. Обновить. Удалить.
5. **Каскад.** Удалить `week_template` → `week_template_days` удалены
   (`ON DELETE CASCADE`).
6. **`sync_settings`.** `updateSyncSettings(db, { source: 'dodofo' })`
   → `getSyncSettings(db)` возвращает `{ source: 'dodofo', ... }`
   в camelCase.
7. **Секреты dodofo.** `setDodofoToken(db, 'enc')` →
   `getDodofoTokenEncrypted(db)` возвращает `'enc'` →
   `hasDodofoToken(db)` возвращает `true`.
8. **Идемпотентность миграций.** `applyMigrations(db)` второй раз —
   без ошибок, `schema_version` не меняется.

## Definition of Done

- Файлы в `src/main/services/pranaBindu/melange/`:
  `db.ts`, `schema.ts`, `migrations.ts`, `seed.ts`, `types.ts`,
  `index.ts`, `repositories/index.ts`, `repositories/profileRepo.ts`,
  `repositories/syncRepo.ts`.
- `SCHEMA_VERSION = 2`.
- `seed.ts` пишет 6 движений (60 ступеней — отложено до 05).
- `sync_settings` содержит все поля `zepp_*` и `dodofo_*`.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.
- `git commit`.

## Что НЕ делаем в 08

- Бизнес-логику (это Core, Stillsuit, Crysknife, Mentat).
- UI (это UI_DUNA).
- Реальную синхронизацию с dodofo / Google Fit / Zepp — это 07_SPICE.
- Заполнение 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- Логику провайдеров — это 07_SPICE.


==============================================

# Направление 08: Melange (схема БД, миграции)

## Роль
Локальная БД модуля Prana-Bindu. Хранит профиль, планы, факты,
прогрессии Big-6, восстановление, настройки синхронизации,
рекомендации.

## Зона ответственности
- Файл `prana_bindu.db` в `app.getPath('userData')`.
- Схема таблиц, индексы, миграции (idempotent).
- Слой доступа к данным для всех модулей
  (`core`, `stillsuit`, `crysknife`, `mentat`, `waterDiscipline`, `spice`).
- Никакой бизнес-логики — только CRUD и типизация.

## Технические решения
- `node:sqlite` (встроен, без нативных зависимостей). Уже используется
  в OSINT — берём тот же подход.
- Открытие БД — синглтон, ленивая инициализация.
- Миграции — массив функций, применяются по порядку, каждая с проверкой
  `IF NOT EXISTS`. Версия схемы в таблице `meta`.
- Все даты — ISO 8601 UTC. Локальное время — только при отображении.
- JSON-поля (`scheme_json`, `sets_json`, `raw_json`, `context_json`,
  `suggestion_json`, `google_token_json`, `zepp_credentials_json`) —
  как `TEXT`, парсятся в типах.
- Путь к `userData` передаётся снаружи (импорт `electron` в этой папке
  запрещён — правило из `STRUCTURE.md`).

> Согласовано с каркасом: файлы уже созданы в
> `src/main/services/pranaBindu/melange/` — `types.ts` и `index.ts`.
> Этот документ расширяет их; при конфликте имён — приоритет у этого
> документа, `types.ts` правится по факту.

## Файловая структура (внутри `melange/`)

```
melange/
├── db.ts              — синглтон, open/close
├── schema.ts          — SQL-строки таблиц
├── migrations.ts      — массив миграций, applyMigrations()
├── seed.ts            — начальное заполнение
├── types.ts           — row-типы (snake_case, 1-в-1 с DDL)
├── index.ts           — публичный barrel
└── repositories/
    ├── profileRepo.ts
    ├── movementsRepo.ts
    ├── progressionsRepo.ts
    ├── runPlansRepo.ts
    ├── runFactsRepo.ts
    ├── strengthRepo.ts
    ├── recoveryRepo.ts
    ├── templatesRepo.ts
    ├── syncRepo.ts
    └── recommendationsRepo.ts
```

## Схема (финальная для v1)

### Профиль

```sql
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age INTEGER,
  max_hr INTEGER,
  lthr INTEGER,             -- ПАНО, если известно
  resting_hr INTEGER,
  weight_kg REAL,
  goal_marathon_date TEXT,  -- '2026-09-27'
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

> Согласовано с каркасом: TS-тип `Profile` в `core/types.ts`
> использует camelCase (`maxHr`, `marathonDate`), репозиторий
> конвертирует snake_case ↔ camelCase на границе.

### Big-6: движения

```sql
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,         -- pushups / squats / pullups / leg_raises / bridge / stand
  name TEXT,
  order_index INTEGER
);
```

> Согласовано с каркасом: коды — точно как в
> `services/pranaBindu/crysknife/big6.ts` (`BIG6_MOVEMENTS`).
> **Не** `pushup`/`handstand`/`legraise` — а `pushups`/`stand`/`leg_raises`.

### Big-6: ступени

```sql
CREATE TABLE IF NOT EXISTS progressions (
  id INTEGER PRIMARY KEY,
  movement_id INTEGER,
  level INTEGER,            -- 1..10
  name TEXT,
  scheme_json TEXT,         -- [{set:1,reps:10},{set:2,reps:25},{set:3,reps:50}]
  repeat_count INTEGER,     -- 1 или 2
  is_time_based INTEGER,    -- 0/1, для стойки
  notes TEXT,
  UNIQUE(movement_id, level),
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### Текущее состояние пользователя по движению

```sql
CREATE TABLE IF NOT EXISTS user_movement_state (
  movement_id INTEGER PRIMARY KEY,
  current_level INTEGER,
  last_attempt_at TEXT,
  benchmark_done INTEGER,   -- 0/1
  updated_at TEXT,
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### План бега

```sql
CREATE TABLE IF NOT EXISTS run_plans (
  id INTEGER PRIMARY KEY,
  date TEXT,
  type TEXT,                -- easy / threshold / interval / long / race / rest
  zone INTEGER,             -- 1..5
  target_km REAL,
  target_pace TEXT,         -- '5:30'
  target_hr_min INTEGER,
  target_hr_max INTEGER,
  notes TEXT
);
```

### Факт бега

```sql
CREATE TABLE IF NOT EXISTS run_facts (
  id INTEGER PRIMARY KEY,
  date TEXT,
  plan_id INTEGER,          -- nullable
  actual_km REAL,
  actual_pace TEXT,
  avg_hr INTEGER,
  max_hr INTEGER,
  duration_sec INTEGER,
  rpe INTEGER,              -- 1..10
  source TEXT,              -- zepp-dofek / zepp-mcp / zeppbridge / google-fit / manual
  external_id TEXT,         -- id в источнике, для дедупликации
  raw_json TEXT,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES run_plans(id)
);
CREATE INDEX IF NOT EXISTS idx_run_facts_date ON run_facts(date);
CREATE INDEX IF NOT EXISTS idx_run_facts_external
  ON run_facts(source, external_id);
```

### План силовой

```sql
CREATE TABLE IF NOT EXISTS strength_plans (
  id INTEGER PRIMARY KEY,
  date TEXT,
  movement_id INTEGER,
  level INTEGER,
  sets_target INTEGER,
  reps_target INTEGER,
  notes TEXT,
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### Факт силовой

```sql
CREATE TABLE IF NOT EXISTS strength_sessions (
  id INTEGER PRIMARY KEY,
  date TEXT,
  plan_id INTEGER,
  movement_id INTEGER,
  level INTEGER,
  sets_json TEXT,           -- [{set:1,reps:12},{set:2,reps:15},{set:3,reps:10}]
  rpe INTEGER,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES strength_plans(id),
  FOREIGN KEY (movement_id) REFERENCES movements(id)
);
```

### Восстановление

```sql
CREATE TABLE IF NOT EXISTS recovery_logs (
  id INTEGER PRIMARY KEY,
  date TEXT UNIQUE,
  sleep_hours REAL,
  sleep_quality INTEGER,    -- 1..5
  hrv INTEGER,
  resting_hr INTEGER,
  status TEXT,              -- green / yellow / red
  notes TEXT
);
```

### Контрольные тесты

```sql
CREATE TABLE IF NOT EXISTS progress_checks (
  id INTEGER PRIMARY KEY,
  date TEXT,
  run_pace TEXT,            -- фиксированный темп, например '5:30'
  run_avg_hr INTEGER,
  strength_movement_id INTEGER,
  strength_reps INTEGER,
  notes TEXT,
  FOREIGN KEY (strength_movement_id) REFERENCES movements(id)
);
```

### Типовые недели

```sql
CREATE TABLE IF NOT EXISTS week_templates (
  id INTEGER PRIMARY KEY,
  name TEXT,
  phase TEXT,               -- base / build / peak / taper / race / recovery
  description TEXT
);

CREATE TABLE IF NOT EXISTS week_template_days (
  id INTEGER PRIMARY KEY,
  template_id INTEGER,
  day_of_week INTEGER,      -- 1..7 (Пн=1, Вс=7)
  run_json TEXT,            -- {type, zone, km, pace}
  strength_json TEXT,       -- {movement_code, level, sets, reps}
  recovery_flag INTEGER,
  FOREIGN KEY (template_id) REFERENCES week_templates(id) ON DELETE CASCADE,
  UNIQUE (template_id, day_of_week)
);
```

> Согласовано с каркасом: фазы — те же, что `PeriodizationPhase`
> в `mentat/types.ts`. `day_of_week` — 1..7 (не 0..6), как
> `Weekday` в каркасе.

### Настройки синхронизации

```sql
CREATE TABLE IF NOT EXISTS sync_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT,                    -- google-fit | zepp-dofek | zepp-mcp | zeppbridge | manual
  mode TEXT,                      -- auto | manual | both
  auto_interval_min INTEGER,
  auto_on_start INTEGER,          -- 0/1

  -- Google Fit
  google_token_json TEXT,         -- safeStorage-encrypted

  -- ZeppBridge (CLI)
  zeppbridge_path TEXT,           -- путь к CLI

  -- Zepp (обобщённо, через любой из трёх провайдеров)
  zepp_provider TEXT,             -- 'dofek-zepp' | 'zepp-mcp' | 'zeppbridge'
  zepp_fallback_provider TEXT,
  zepp_credentials_json TEXT,     -- safeStorage-encrypted
  zepp_auth_host TEXT,            -- 'api-user.zepp.com' | '-de2' | '-us2'
  zepp_data_host TEXT,            -- 'api-mifit.zepp.com' | '-de2' | '-us3'
  zepp_app_token TEXT,            -- safeStorage-encrypted
  zepp_user_id TEXT,
  zepp_last_sync_at TEXT,
  zepp_last_sync_status TEXT,

  -- Общий статус последней синхронизации (любой источник)
  last_sync_at TEXT,
  last_sync_status TEXT
);
```

> Согласовано с направлением 09: именно на эти поля опирается
> `pb:sync-settings-get` / `pb:sync-settings-update`.

### AI-рекомендации

```sql
CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY,
  created_at TEXT,
  provider TEXT,            -- ollama / deepseek / rule-based
  context_json TEXT,
  suggestion_json TEXT,
  status TEXT,              -- pending / accepted / rejected
  resolved_at TEXT,
  notes TEXT
);
```

### Мета (версия схемы)

```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## Что нужно сделать

1. **`melange/db.ts`** — открытие/закрытие БД, синглтон.
   ```ts
   export function openMelange(dbPath: string): DatabaseSync;
   export function getMelange(): DatabaseSync;
   export function closeMelange(): void;
   ```
   При открытии: `PRAGMA journal_mode = WAL`,
   `PRAGMA foreign_keys = ON`, `applyMigrations(db)`.

2. **`melange/schema.ts`** — SQL-строки таблиц выше (как константы
   `CREATE_MOVEMENTS`, `CREATE_PROGRESSIONS`, ...), плюс массив
   `ALL_TABLES` для инициализации.

3. **`melange/migrations.ts`** — массив миграций:
   ```ts
   type Migration = { version: number; apply: (db: DatabaseSync) => void };
   export function applyMigrations(db: DatabaseSync): void;
   ```
   Читает `meta.schema_version`, применяет недостающие по порядку.
   v1 — создание всех таблиц (`IF NOT EXISTS`), запись
   `schema_version = 1`.

4. **`melange/repositories/`** — по файлу на домен. Каждый
   репозиторий:
   - принимает `db: DatabaseSync` параметром или берёт из синглтона;
   - возвращает доменные объекты (camelCase), не сырые строки;
   - конвертирует snake_case ↔ camelCase на границе.

5. **`melange/seed.ts`** — начальное заполнение.
   - `movements` — 6 записей из `BIG6_MOVEMENTS` (каркас).
   - `progressions` — **60 записей (10×6) — данные ещё не готовы**.
     Пока: заглушка, которая пишет 6 движений и оставляет
     `progressions` пустой. Настоящие схемы подходов появятся,
     когда будет финализирован `05_CRYSKNIFE.md`.
   - `sync_settings` — одна строка `id=1, mode='manual'`, все
     `zepp_*` и `google_*` = `NULL`.

6. **`melange/index.ts`** — экспорт всех репозиториев.

## Ограничения

- Никаких импортов Electron.
- Никакой бизнес-логики. Только CRUD.
- Репозитории типизированы, возвращают domain-объекты.
- Миграции идемпотентны. Повторный запуск не ломает БД.
- `zepp_credentials_json`, `zepp_app_token`, `google_token_json`
  хранят **уже зашифрованные** строки. Шифрование — через
  `safeStorage` **снаружи**, в слое 09/07. Melange к `safeStorage`
  не обращается.
- Ключи `zepp_*` и `google_*` не логировать.
- Порядок таблиц в DDL важен: `movements` до `progressions`,
  `week_templates` до `week_template_days`, `run_plans` до `run_facts`.

## Проверка (ручные сценарии)

1. **Пустая БД.** `openMelange(tmpPath)` → все таблицы созданы,
   `meta.schema_version = 1`.
2. **Повторный запуск.** `openMelange(tmpPath)` снова → миграции
   пропущены, данные не потеряны.
3. **Seed (частично).** `seed()` → 6 движений. `progressions` пуст
   (60 записей — TODO 05_CRYSKNIFE). Одна строка в `sync_settings`
   с `id=1`.
4. **CRUD по кругу.** Создать `run_plan`, затем `run_fact` со
   ссылкой на план. Прочитать. Обновить. Удалить. Всё отрабатывает.
5. **Каскад.** Удалить `week_template` → `week_template_days` удалены
   (`ON DELETE CASCADE`).
6. **`sync_settings`.** `UPDATE sync_settings SET zepp_provider='dofek-zepp'`
   → `getSyncSettings()` возвращает `{ zeppProvider: 'dofek-zepp', ... }`
   в camelCase.
7. **Идемпотентность миграций.** `applyMigrations(db)` второй раз —
   без ошибок, `schema_version` не меняется.

## Definition of Done

- Файлы в `src/main/services/pranaBindu/melange/`:
  `db.ts`, `schema.ts`, `migrations.ts`, `seed.ts`,
  `repositories/*`, `index.ts`, `types.ts`.
- Сценарии проходят вручную.
- `seed.ts` пишет 6 движений (60 ступеней — отложено до 05).
- `sync_settings` содержит все поля `zepp_*`.
- `npx tsc --noEmit` чистый.
- Схема задокументирована кратко в шапке `schema.ts` (для других модулей).
- `git commit`.

## Что НЕ делаем

- Бизнес-логику (это Core, Stillsuit, Crysknife, Mentat).
- UI (это UI_DUNA).
- Реальную синхронизацию с Google Fit / Zepp (это Spice).
- Заполнение 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- Реализацию `regionDetector.ts` и провайдеров — это 09 (каркас)
  и 07 (боевая логика).



=============================
old version
=============================


# Направление 08: Melange (схема БД, миграции)

## Роль
Локальная БД модуля Prana-Bindu. Хранит профиль, планы, факты,
прогрессии Big-6, восстановление, настройки синхронизации,
рекомендации.

## Зона ответственности
- Файл `prana_bindu.db` в `app.getPath('userData')`.
- Схема таблиц, индексы, миграции (idempotent).
- Слой доступа к данным для всех модулей
  (`core`, `stillsuit`, `crysknife`, `mentat`, `waterDiscipline`, `spice`).
- Никакой бизнес-логики — только CRUD и типизация.

## Технические решения
- `node:sqlite` (встроен, без нативных зависимостей). Уже используется
  в OSINT — берём тот же подход.
- Открытие БД — синглтон, ленивая инициализация.
- Миграции — массив функций, применяются по порядку, каждая с проверкой
  `IF NOT EXISTS`. Версия схемы в `meta` таблице.
- Все даты — ISO 8601 UTC. Локальное время — только при отображении.
- JSON-поля (например `scheme_json`) — как `TEXT`, парсятся в типах.

## Схема (черновик, финализируется в этом чате)

### Профиль

```sql
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  age INTEGER,
  max_hr INTEGER,
  lthr INTEGER,             -- ПАНО, если известно
  goal_marathon_date TEXT,  -- '2026-09-27'
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### Big-6: движения

```sql
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,         -- pushup, squat, pullup, legraise, bridge, handstand
  name TEXT,
  order_index INTEGER
);
```

### Big-6: ступени

```sql
CREATE TABLE IF NOT EXISTS progressions (
  id INTEGER PRIMARY KEY,
  movement_id INTEGER,
  level INTEGER,            -- 1..10
  name TEXT,
  scheme_json TEXT,         -- [{set:1,reps:10},{set:2,reps:25},{set:3,reps:50}]
  repeat_count INTEGER,     -- 1 или 2
  is_time_based INTEGER,    -- 0/1, для стойки
  notes TEXT,
  UNIQUE(movement_id, level)
);
```

### Текущее состояние пользователя по движению

```sql
CREATE TABLE IF NOT EXISTS user_movement_state (
  movement_id INTEGER PRIMARY KEY,
  current_level INTEGER,
  last_attempt_at TEXT,
  benchmark_done INTEGER,   -- 0/1
  updated_at TEXT
);
```

### План бега

```sql
CREATE TABLE IF NOT EXISTS run_plans (
  id INTEGER PRIMARY KEY,
  date TEXT,
  type TEXT,                -- easy / threshold / interval / long / race / rest
  zone INTEGER,             -- 1..5
  target_km REAL,
  target_pace TEXT,         -- '5:30'
  target_hr_min INTEGER,
  target_hr_max INTEGER,
  notes TEXT
);
```

### Факт бега

```sql
CREATE TABLE IF NOT EXISTS run_facts (
  id INTEGER PRIMARY KEY,
  date TEXT,
  plan_id INTEGER,          -- nullable
  actual_km REAL,
  actual_pace TEXT,
  avg_hr INTEGER,
  max_hr INTEGER,
  duration_sec INTEGER,
  rpe INTEGER,              -- 1..10
  source TEXT,              -- zeppbridge / googlefit / manual
  raw_json TEXT,
  notes TEXT
);
```

### План силовой

```sql
CREATE TABLE IF NOT EXISTS strength_plans (
  id INTEGER PRIMARY KEY,
  date TEXT,
  movement_id INTEGER,
  level INTEGER,
  sets_target INTEGER,
  reps_target INTEGER,
  notes TEXT
);
```

### Факт силовой

```sql
CREATE TABLE IF NOT EXISTS strength_sessions (
  id INTEGER PRIMARY KEY,
  date TEXT,
  plan_id INTEGER,
  movement_id INTEGER,
  level INTEGER,
  sets_json TEXT,           -- [{set:1,reps:12},{set:2,reps:15},{set:3,reps:10}]
  rpe INTEGER,
  notes TEXT
);
```

### Восстановление

```sql
CREATE TABLE IF NOT EXISTS recovery_logs (
  id INTEGER PRIMARY KEY,
  date TEXT UNIQUE,
  sleep_hours REAL,
  hrv INTEGER,
  resting_hr INTEGER,
  status TEXT,              -- green / yellow / red
  notes TEXT
);
```

### Контрольные тесты

```sql
CREATE TABLE IF NOT EXISTS progress_checks (
  id INTEGER PRIMARY KEY,
  date TEXT,
  run_pace TEXT,            -- фиксированный темп, например '5:30'
  run_avg_hr INTEGER,
  strength_movement_id INTEGER,
  strength_reps INTEGER,
  notes TEXT
);
```

### Типовые недели

```sql
CREATE TABLE IF NOT EXISTS week_templates (
  id INTEGER PRIMARY KEY,
  name TEXT,
  phase TEXT,               -- base / threshold / specific / taper
  description TEXT
);

CREATE TABLE IF NOT EXISTS week_template_days (
  id INTEGER PRIMARY KEY,
  template_id INTEGER,
  day_of_week INTEGER,      -- 0..6 (Пн..Вс)
  run_json TEXT,            -- {type, zone, km, pace}
  strength_json TEXT,       -- {movement_code, level, sets, reps}
  recovery_flag INTEGER,
  FOREIGN KEY (template_id) REFERENCES week_templates(id) ON DELETE CASCADE
);
```

### Настройки синхронизации

```sql
CREATE TABLE IF NOT EXISTS sync_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT,              -- zeppbridge / googlefit / both
  mode TEXT,                -- auto / manual / both
  auto_interval_min INTEGER,
  auto_on_start INTEGER,
  last_sync_at TEXT,
  last_sync_status TEXT,
  google_token_json TEXT,   -- OAuth токены (шифрование через safeStorage)
  zeppbridge_path TEXT      -- путь к CLI
);
```

### AI-рекомендации

```sql
CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY,
  created_at TEXT,
  provider TEXT,            -- ollama / deepseek / rule-based
  context_json TEXT,
  suggestion_json TEXT,
  status TEXT,              -- pending / accepted / rejected
  resolved_at TEXT,
  notes TEXT
);
```

### Мета (версия схемы)

```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## Что нужно сделать

1. **`melange/db.ts`** — открытие/закрытие БД, синглтон.
2. **`melange/migrations.ts`** — массив миграций, `applyMigrations()`.
3. **`melange/schema.ts`** — SQL-строки таблиц.
4. **`melange/repositories/`** — по файлу на домен:
   - `profileRepo.ts`
   - `movementsRepo.ts`
   - `progressionsRepo.ts`
   - `runPlansRepo.ts`
   - `runFactsRepo.ts`
   - `strengthRepo.ts`
   - `recoveryRepo.ts`
   - `templatesRepo.ts`
   - `syncRepo.ts`
   - `recommendationsRepo.ts`
5. **`melange/seed.ts`** — начальное заполнение: 6 движений + 60 ступеней
   (данные из таблицы пользователя, см. `05_CRYSKNIFE.md`).
6. **`melange/index.ts`** — экспорт всех репозиториев.

## Ограничения

- Никаких импортов Electron (путь к `userData` передаётся снаружи
  аргументом при инициализации из main-процесса).
- Никакой бизнес-логики. Только CRUD.
- Репозитории типизированы, возвращают domain-объекты, не сырые строки.
- Миграции идемпотентны. Повторный запуск не ломает БД.

## Проверка (ручные сценарии)

1. **Пустая БД.** Открыть → применить миграции → все таблицы созданы,
   `meta.schema_version = 1`.
2. **Повторный запуск.** Открыть снова → миграции пропускаются,
   данные не потеряны.
3. **Seed.** Запустить `seed()` → 6 движений, 60 ступеней.
   Проверить `progressions` для `pushup`: 10 записей с уровнями 1–10.
4. **CRUD по кругу.** Создать `run_plan`, затем `run_fact` со ссылкой
   на план. Прочитать. Обновить. Удалить. Всё отрабатывает.
5. **Каскад.** Удалить `week_template` → `week_template_days` удалены
   (`ON DELETE CASCADE`).

## Definition of Done

- Файлы в `src/main/services/pranaBindu/melange/`.
- Сценарии проходят вручную.
- `seed.ts` заполняет Big-6 полностью.
- Схема задокументирована в `docs/prana-bindu/schema.md` (краткий
  справочник по таблицам для других модулей).

## Что НЕ делаем

- Бизнес-логику (это Core, Stillsuit, Crysknife, Mentat).
- UI (это UI_DUNA).
- Синхронизацию с Google Fit / ZeppBridge (это Spice).