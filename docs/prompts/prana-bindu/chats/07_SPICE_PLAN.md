# Направление 07: Spice — планирование через intervals.icu

> Обновлено: 2026-10-01
> Продолжение чата 07_SPICE_PLAN. Базовые шаги закрыты
> в чате 07_SPICE (2026-10-01), см. ниже «Статус».

## Статус на 2026-10-01

Закрыто в предыдущей сессии (07_SPICE, 2026-10-01):

- [x] `IntervalsIcuProvider.fetchWorkouts` — список активностей
      с `/athlete/{id}/activities`. Работает.
- [x] `IntervalsIcuProvider.fetchStreams` — через `fetchUnifiedWorkout`
      (FIT-файл → наш парсер).
- [x] Capabilities: `workouts: true`, `streams: true`,
      `wellness: true`.
- [x] `pb:sync-now` — provider-aware, синхронизирует только список
      (FIT-цикл убран). 265 записей за ~2 сек.
- [x] `pb:sync-run-streams-all` — provider-aware, с прогрессом
      (`pb:sync-progress`) и отменой (`pb:sync-cancel`).
- [x] UI: `intervals-icu` в дропдауне провайдеров.
- [x] Fix `run_facts` INSERT — `external_id` пишется корректно,
      дедуп по `(source, external_id)` работает.
- [x] Fix TCX duration fallback — 214 записей получили
      корректный `duration_sec` и `actual_pace`.

**Осталось в этом плане:** только Events (план тренировок).
Всё, что про Activities, — закрыто.

## Что делаем в этом чате

**Двусторонняя интеграция с intervals.icu для планирования.**

1. **Pull** — читать события из ICU (`/athlete/{id}/events`).
2. **Push** — создавать события в ICU (`POST /events/bulk`).
3. **Связь план↔факт** — сопоставлять WORKOUT-события с
   выполненными `run_facts` по дате.
4. **Конструктор тренировок** — UI для создания плана в формате
   `icu_workout` (см. ниже).

## Формат событий intervals.icu

**Категории:**
- `WORKOUT` — тренировка.
- `PLAN` — фаза периодизации (Base/Build/Peak).
- `TARGET` — недельная цель (TSS, часы).
- `NOTE` — заметка.
- `RACE` — соревнование.

**Ключевые поля WORKOUT:**
```json
{
  "category": "WORKOUT",
  "type": "Run",
  "name": "5x 400m VO2max",
  "start_date_local": "2026-11-01T09:00:00",
  "description": "...",
  "icu_workout": {
    "steps": [
      { "type": "Warmup", "duration": 600, "target": { "type": "hr", "zone": 1 } },
      { "type": "Interval", "reps": 5, "duration": 400,
        "target": { "type": "pace", "zone": 5 } }
    ]
  }
}
```

## Конструктор тренировок ICU — текстовый формат

Intervals.icu принимает **текстовое описание** тренировки, из
которого генерирует структуру. Формат:

```
Long Run 1h30m
- 1h30m Z2 HR Z2 Pace

VO2max Intervals (10x 400m)
Warmup
- 2km Z2 Pace
Main set 10x
- 400m Z5 Pace
- 400m recovery Z1 Pace
Cooldown
- 2km Z1 Pace

Fartlek
- 10m Z2 Pace
- 2m Z4 Pace
- 3m Z2 Pace
- 1m Z5 Pace
- 4m Z2 Pace
- 5x (30s Sprint / 90s Z2 Pace)
- 10m Z2 Pace
```

## Синтаксис ICU (проверено)

- **Единицы**: m=минуты, s=секунды, h=часы, mtr=метры, km, mi.
- **Cue**: текст ПЕРЕД длительностью → подсказка на часах.
- **Секции**: Warmup / Main Set / Cooldown (на отдельной строке).
- **Повторы**: "Nx" на отдельной строке, пустые строки до и после.
- **Вложенные повторы**: НЕ поддерживаются.
- **RPE**: НЕ поддерживается.
- **Цели**: "% HR", "%", "Z1..Z7", "Pace", "freeride".
- **Дистанции**: без цели — только cue: "- Спринт 400mtr".
- **Отдых**: обычный шаг ("Отдых 90s").
- **Press Lap**: шаг по кнопке.
- **Русский cue**: работает (UTF-8). Русские единицы (сек/мин/км) — нет.


## Задачи в порядке приоритета

### 1. Разведка тестовых событий (~15 мин)

В календаре ICU уже добавлены тестовые тренировки. Нужно:
- Вызвать `pb:debug-icu-events(dateFrom, dateTo)` за даты тестовых записей.
- Посмотреть структуру: какие поля приходят, есть ли `icu_workout`
  уже разобранным, в каком формате хранится описание.
- Скинуть JSON.

### 2. `IntervalsIcuProvider.fetchEvents` (~1 ч)

```ts
async fetchEvents(from: string, to: string): Promise<UnifiedEvent[]>
```

Тип `UnifiedEvent`:
```ts
interface UnifiedEvent {
  externalId: string;        // 'intervals-icu:<id>'
  date: string;              // YYYY-MM-DD
  category: 'WORKOUT' | 'PLAN' | 'TARGET' | 'NOTE' | 'RACE';
  sport?: string;            // 'Run', 'WeightTraining'
  name: string;
  description?: string;
  plannedLoad?: number;
  durationSec?: number;
  distanceM?: number;
  steps?: WorkoutStep[];     // если есть icu_workout
  raw: unknown;
}
```

### 3. Melange v10 — таблица `plan_events` (~30 мин)

```sql
CREATE TABLE plan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  sport TEXT,
  name TEXT NOT NULL,
  description TEXT,
  planned_load REAL,
  duration_sec INTEGER,
  distance_m REAL,
  steps_json TEXT,
  raw_json TEXT,
  paired_activity_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (paired_activity_id) REFERENCES run_facts(id)
);
```

Репозиторий `planEventsRepo.ts`: `upsertPlanEvent`, `listPlanEvents`,
`getPlanEventByExternalId`, `linkToActivity`.

### 4. `pb:sync-plan(from, to)` — pull (~30 мин)

Handler + preload + кнопка в UI.

### 5. `pb:push-plan(from, to)` — push (~1 ч)

Собрать локальные `plan_events` → отправить в ICU.
Дедупликация: сначала GET, потом POST для новых / PUT для
существующих. Или `/events/bulk` с upsert.

### 6. UI: панель «План» (~2 ч)

- Мини-таблица событий на 14 дней вперёд.
- Клик по строке → drawer с деталями (описание, шаги, нагрузка).
- Кнопки «Обновить из ICU», «Отправить в ICU».
- Возможно — встроенный конструктор (textarea с текстом +
  preview разбора).

### 7. Связь план↔факт (~1 ч)

При `sync-plan` и после `sync-now` — сопоставлять
`plan_events.date = run_facts.date`. Если совпало — писать
`paired_activity_id`.

## Открытые вопросы

1. Как ICU хранит `icu_workout` — уже разобранным или как текст?
2. Создаём ли мы тренировки через текстовый конструктор или
   структурированный JSON? (текстовый — проще в UI)
3. Приоритет при конфликте: ICU — источник правды для плана,
   наше приложение — для факта?
4. Калистеника в ICU: `type: "WeightTraining"` или свой спорт?
5. Есть ли в ICU weekly targets и phases, и нужны ли они нам?

## Что НЕ делаем в этом чате

- Google Fit.
- Улучшения графиков (отдельный чат — CHARTS).
- Прямой Zepp (если dodofo/ICU покроют).
- Big-6 ступени (05_CRYSKNIFE).

## Первый шаг

`pb:debug-icu-events(<даты тестовых событий>)` → скинуть JSON.

---

## Отложено на 2026-10-02

Закрыто в предыдущей сессии (07_SPICE, 2026-10-01/02):

- [x] `fetchWorkouts` — список активностей.
- [x] `fetchStreams` через `fetchUnifiedWorkout`.
- [x] Capabilities: workouts/streams/thresholds/wellness.
- [x] `fetchThresholds` — из профиля атлета, fallback на последнюю
      активность.
- [x] `pb:sync-now` — provider-aware.
- [x] `pb:sync-run-streams-all` — provider-aware, с прогрессом.
- [x] UI: intervals-icu в дропдауне, отдельные панели
      «Подключения» / «Синхронизация (API)» / «Импорт файлов».
- [x] Fix INSERT, дедуп по `(source, external_id)`.
- [x] Multi-source группировка ±5 мин, фильтры, drawer с вкладками.

**Осталось в этом плане:** только Events (план тренировок).
Всё про Activities и thresholds — закрыто.

### HR-зоны (из `icu_hr_zones`) — отдельная задача

ICU отдаёт в активностях `icu_hr_zones: [134, 142, 150, 158, 162, 167, 175]`
(7 границ = 6 зон). Мы их сохраняем в `raw_json`, но не используем.

**Следующий заход:**
- `pb:sync-zones('intervals-icu')` — читает из последней активности,
  сохраняет в `profile.hr_zones_json`.
- `RunStreamsChart`: окраска HR-линии по зонам.
- `GpsMapView`: окраска трека по HR-зонам.
- Полоса зон под графиком (из `icu_hr_zone_times`).

### Погода ICU — отложено

Проверено 2026-10-02: у ICU `has_weather: 0` для 49 активностей,
в Strava CSV заполнено 11 из 1162 строк (1%). Данных нет, фича
мёртвая. Вернуться, если появится источник с погодой.

## Закрыто 2026-10-02/03

Events (план тренировок) — закрыто:

- [x] Melange v15: таблица `plan_events`.
- [x] `planEventsRepo.ts` — upsert, list, link, deleteRange.
- [x] `IntervalsIcuProvider.fetchPlanEvents`.
- [x] `pb:sync-plan`, `pb:list-plan-events`, `pb:clear-plan`.
- [x] Связь план↔факт по дате + sport.
- [x] UI-панель «План» + drawer события.
- [x] Библиотека шаблонов для конструктора ICU
      (`workoutTemplates.ts`, `WorkoutTemplatesDialog`).
- [x] Синтаксис ICU разобран и зафиксирован.

## Осталось в этом плане

### Push в ICU (следующий крупный заход)

- Textarea для текста ICU в PlanEventDrawer.
- Preview таймлайн из текста.
- `POST /events` — создание нового.
- `PUT /events/{id}` — обновление.
- `DELETE /events/{id}` — удаление.
- Двусторонний sync: мы создаём в ICU, потом sync-plan возвращает с `id`.

### Библиотека — доработки

- Каталог упражнений (не только шаблоны, но справочник движений).
- Прогрессии W1–W10 по каждому из 6 движений Big-6.
- p5.js анимации.
- ml5.js (использование — обсудить).


==========================================================

# Направление 07: Spice — планирование через intervals.icu

> Обновлено: 2026-10-01
> Продолжение чата 07_SPICE. Предыдущий чат закрыт по лимиту.

## Что уже готово (не трогаем)

- FIT/TCX парсеры + `UnifiedWorkout`.
- `run_streams` (.msgpack), 948 записей в `run_facts`.
- Multi-source модель с группировкой по дате.
- intervals.icu: wellness + workouts + streams через FIT.
- MapLibre-карта в drawer.
- Melange v9.
- Двусторонний `pb:sync-now` (provider-aware).

## Что делаем в этом чате

**Двусторонняя интеграция с intervals.icu для планирования.**

1. **Pull** — читать события из ICU (`/athlete/{id}/events`).
2. **Push** — создавать события в ICU (`POST /events/bulk`).
3. **Связь план↔факт** — сопоставлять WORKOUT-события с
   выполненными `run_facts` по дате.
4. **Конструктор тренировок** — UI для создания плана в формате
   `icu_workout` (см. ниже).

## Формат событий intervals.icu

**Категории:**
- `WORKOUT` — тренировка.
- `PLAN` — фаза периодизации (Base/Build/Peak).
- `TARGET` — недельная цель (TSS, часы).
- `NOTE` — заметка.
- `RACE` — соревнование.

**Ключевые поля WORKOUT:**
```json
{
  "category": "WORKOUT",
  "type": "Run",
  "name": "5x 400m VO2max",
  "start_date_local": "2026-11-01T09:00:00",
  "description": "...",
  "icu_workout": {
    "steps": [
      { "type": "Warmup", "duration": 600, "target": { "type": "hr", "zone": 1 } },
      { "type": "Interval", "reps": 5, "duration": 400,
        "target": { "type": "pace", "zone": 5 } }
    ]
  }
}
```

## Конструктор тренировок ICU — текстовый формат

Intervals.icu принимает **текстовое описание** тренировки, из
которого генерирует структуру. Формат:

```
Long Run 1h30m
- 1h30m Z2 HR Z2 Pace

VO2max Intervals (10x 400m)
Warmup
- 2km Z2 Pace
Main set 10x
- 400m Z5 Pace
- 400m recovery Z1 Pace
Cooldown
- 2km Z1 Pace

Fartlek
- 10m Z2 Pace
- 2m Z4 Pace
- 3m Z2 Pace
- 1m Z5 Pace
- 4m Z2 Pace
- 5x (30s Sprint / 90s Z2 Pace)
- 10m Z2 Pace
```

**Синтаксис:**
- `- <duration> <target>` — шаг. `1h30m`, `400m`, `30s`.
- `Z1..Z5` — зоны (HR/Pace/Power).
- `Warmup`, `Cooldown`, `Main set`, `Repeat 3x` — секции.
- Текст перед цифрами → подсказка на часах.

**Примеры для калистеники (Big-6):**
```
Circuit Big-6
- Push-ups x max reps
- Squats x 20
- Pull-ups x max reps
- Leg Raises x 15
- Back Bridge x 20 сек
- Dips x max reps
Rest 90s
Repeat 3x
```

## Задачи в порядке приоритета

### 1. Разведка тестовых событий (~15 мин)

В календаре ICU уже добавлены тестовые тренировки. Нужно:
- Вызвать `pb:debug-icu-events(dateFrom, dateTo)` за даты тестовых записей.
- Посмотреть структуру: какие поля приходят, есть ли `icu_workout`
  уже разобранным, в каком формате хранится описание.
- Скинуть JSON.

### 2. `IntervalsIcuProvider.fetchEvents` (~1 ч)

```ts
async fetchEvents(from: string, to: string): Promise<UnifiedEvent[]>
```

Тип `UnifiedEvent`:
```ts
interface UnifiedEvent {
  externalId: string;        // 'intervals-icu:<id>'
  date: string;              // YYYY-MM-DD
  category: 'WORKOUT' | 'PLAN' | 'TARGET' | 'NOTE' | 'RACE';
  sport?: string;            // 'Run', 'WeightTraining'
  name: string;
  description?: string;
  plannedLoad?: number;
  durationSec?: number;
  distanceM?: number;
  steps?: WorkoutStep[];     // если есть icu_workout
  raw: unknown;
}
```

### 3. Melange v10 — таблица `plan_events` (~30 мин)

```sql
CREATE TABLE plan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  sport TEXT,
  name TEXT NOT NULL,
  description TEXT,
  planned_load REAL,
  duration_sec INTEGER,
  distance_m REAL,
  steps_json TEXT,
  raw_json TEXT,
  paired_activity_id INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (paired_activity_id) REFERENCES run_facts(id)
);
```

Репозиторий `planEventsRepo.ts`: `upsertPlanEvent`, `listPlanEvents`,
`getPlanEventByExternalId`, `linkToActivity`.

### 4. `pb:sync-plan(from, to)` — pull (~30 мин)

Handler + preload + кнопка в UI.

### 5. `pb:push-plan(from, to)` — push (~1 ч)

Собрать локальные `plan_events` → отправить в ICU.
Дедупликация: сначала GET, потом POST для новых / PUT для
существующих. Или `/events/bulk` с upsert.

### 6. UI: панель «План» (~2 ч)

- Мини-таблица событий на 14 дней вперёд.
- Клик по строке → drawer с деталями (описание, шаги, нагрузка).
- Кнопки «Обновить из ICU», «Отправить в ICU».
- Возможно — встроенный конструктор (textarea с текстом +
  preview разбора).

### 7. Связь план↔факт (~1 ч)

При `sync-plan` и после `sync-now` — сопоставлять
`plan_events.date = run_facts.date`. Если совпало — писать
`paired_activity_id`.

## Открытые вопросы

1. Как ICU хранит `icu_workout` — уже разобранным или как текст?
2. Создаём ли мы тренировки через текстовый конструктор или
   структурированный JSON? (текстовый — проще в UI)
3. Приоритет при конфликте: ICU — источник правды для плана,
   наше приложение — для факта?
4. Калистеника в ICU: `type: "WeightTraining"` или свой спорт?
5. Есть ли в ICU weekly targets и phases, и нужны ли они нам?

## Что НЕ делаем в этом чате

- Google Fit.
- Улучшения графиков (отдельный чат — CHARTS).
- Прямой Zepp (если dodofo/ICU покроют).
- Big-6 ступени (05_CRYSKNIFE).

## Первый шаг

`pb:debug-icu-events(<даты тестовых событий>)` → скинуть JSON.


---

## Что стоит уточнить в новом чате в первую очередь

1. **Проверить реальный формат `icu_workout`** — как ICU отдаёт структурированную тренировку. Возможно, там уже готовые шаги, и нам не нужно парсить текст.

2. **Понять, как хранится шаблон** — есть ли `workout_doc_id`, ссылки на библиотеку тренировок, или всё встроено в событие.

3. **Определить направление синхронизации по умолчанию** — pull-only на первом этапе, потом двусторонняя.
