# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-10-29
> Родительский проект: wetothemoon-electron

## Навигация

| #   | Направление                                       | Статус              |
|-----|---------------------------------------------------|---------------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | не начат            |
| 03  | Календарь, периодизация (Mentat)                  | **~80%, активен**   |
| 04  | Марафон: пульс, темп (Stillsuit)                  | не начат            |
| 05  | Big-6: движок прогрессий (Crysknife)              | не начат            |
| 06  | Восстановление (Water Discipline)                 | не начат            |
| 07  | Аналитика, FIT/TCX, провайдеры (Spice)            | **99%, активен**    |
| 08  | Схема БД, миграции (Melange)                      | **v36, активен**    |
| 09  | Окно, меню, IPC (Electron Shell)                  | **завершён**        |
| 10  | UI, визуал, стили (Duna)                          | **~80%, активен**   |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | **активен (Gateway)**|
| 12  | Live-журнал (бег + силовая) — PWA                 | не начат            |
| 13  | Визуализация упражнений (p5.js / three.js)        | не начат            |
| 14  | Дашборд главной страницы                          | **завершён**        |
| 15  | Standalone справочник калистеники                 | идея                |
| 16  | **Exercise Graph**                                | **активен (C.1–D)** |
| 18  | **Картографический редактор** (Map Editor) | **активен (C.13)**  |

## Ключевые цифры (2026-10-29)

- **Melange schema_version: 36.**
- `run_facts`: ~2530.
- `run_streams`: ~200 МБ, 264/264 dodofo с GPS.
- `recovery_logs`: 1000+.
- `chains`: 1 (тестовая).

## Что сделано за 2026-10-22..29

- **Direction-aware coverage (C.13)**: `coverageIndex.ts` учитывает Bearing.
- **Цепочки (C.12)**: БД v32/v33, UI (вкладка + HUD), `aggregate='sum'`, `direction`.
- **Вода, Вес, Питание**: БД v31, репозитории, UI панели, BMR.
- **Дашборд-хаб**: Главная страница переделана. Виджеты (Тренировки, Здоровье+Вода), диалоги (TrainingDialog, HealthDialog).
- **Полная аналитика**: Новый `HealthDashboardDialog` с графиками (Вес, Вода/Км, Сон, CTL/ATL).
- **Профиль**: Добавлены Рост, Пол, Дата рождения (расчет BMR).
- **Разведка данных**: Подтверждено, что dodofo отдает VO2max/SpO2/HRV как `null`. Требуется Zepp-direct.

## Как начать новый чат
1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»


=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-10-14
> Родительский проект: wetothemoon-electron

## Навигация

| #   | Направление                                       | Статус              |
|-----|---------------------------------------------------|---------------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | не начат            |
| 03  | Календарь, периодизация (Mentat)                  | **~80%, активен**   |
| 04  | Марафон: пульс, темп (Stillsuit)                  | не начат            |
| 05  | Big-6: движок прогрессий (Crysknife)              | не начат            |
| 06  | Восстановление (Water Discipline)                 | не начат            |
| 07  | Аналитика, FIT/TCX, провайдеры (Spice)            | **99%, активен**    |
| 08  | Схема БД, миграции (Melange)                      | **v21, активен**    |
| 09  | Окно, меню, IPC (Electron Shell)                  | **завершён**        |
| 10  | UI, визуал, стили (Duna)                          | **~70%, активен**   |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | не начат            |
| 12  | Live-журнал (бег + силовая) — PWA                 | не начат            |
| 13  | Визуализация упражнений (p5.js / three.js)        | не начат            |
| 14  | Дашборд главной страницы                          | не начат            |
| 15  | Standalone справочник калистеники                 | идея                |
| 16  | **Exercise Graph**                                | **активен (C.1–D)** |
| 18  | **Картографический редактор** (Map Editor) | **активен (A+B+C)** |

## Данные на 2026-10-14

- `run_facts`: ~2530.
- `run_streams`: ~200 МБ, 264/264 dodofo с GPS.
- `recovery_logs`: 1000+.
- `plan_events`: 13+.
- `workout_sessions`: ~10.
- `exercise_progress`: ~10.
- `equivalences`: 1.
- **Melange schema_version: 21.**
- **THENICS_CATALOG: 206** движений.
- **NAMED_EXERCISES: ~70** движений (21 prehab).
- **PROGRESSIONS_CATALOG: 22** прогрессии × 10 уровней.
- **Exercise Graph (seed Wade):** 76 узлов / 210 рёбер.

## Что сделано за 2026-10-09..21

- **Exercise Graph C.1** — custom nodes (header / body / footer).
- **C.2** — раскраска через CSS-переменные.
- **C.3** — floating edges (smoothstep / bezier по типу).
- **D** — сохранение позиций узлов.
- **Палитра Thenics** — клик → диалог «как группу / как упражнение».
- **Редактор узлов** — создание / удаление / изменение.
- **Редактор рёбер** — создание / удаление / изменение.
- **CatalogPickerDialog** — ручной выбор из каталога для свободных сессий.
- **Парсер** `findProgressionByIcuName`.
- **AppDialog / AppIcon / CloseIcon** — универсальные компоненты.
- **Story Generator (18)** — переведен на живую карту MapLibre, добавлен прозрачный canvas-оверлей для текста, реализовано точное вписывание по ширине (`cameraForBounds`), починены `ResizeObserver` и сброс камеры.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md`.
2. Обновить статус в этом файле.
3. `git commit`.

## Связь с OSINT-промтами

Промты OSINT — в `docs/prompts/`.
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.


=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-10-09
> Родительский проект: wetothemoon-electron

## Навигация

| #   | Направление                                       | Статус              |
|-----|---------------------------------------------------|---------------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | не начат            |
| 03  | Календарь, периодизация (Mentat)                  | **~80%, активен**   |
| 04  | Марафон: пульс, темп (Stillsuit)                  | не начат            |
| 05  | Big-6: движок прогрессий (Crysknife)              | не начат            |
| 06  | Восстановление (Water Discipline)                 | не начат            |
| 07  | Аналитика, FIT/TCX, провайдеры (Spice)            | **99%, активен**    |
| 08  | Схема БД, миграции (Melange)                      | **v21, активен**    |
| 09  | Окно, меню, IPC (Electron Shell)                  | **завершён**        |
| 10  | UI, визуал, стили (Duna)                          | **~60%, активен**   |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | не начат            |
| 12  | Live-журнал (бег + силовая) — PWA                 | не начат            |
| 13  | Визуализация упражнений (p5.js / three.js)        | не начат            |
| 14  | Дашборд главной страницы                          | не начат            |
| 15  | Standalone справочник калистеники                 | идея                |
| 16  | **Exercise Graph (Melange Graph v1)**             | **NEW, активен**    |

## Данные на 2026-10-09

- `run_facts`: ~2530.
- `run_streams`: ~200 МБ, 264/264 dodofo с GPS.
- `recovery_logs`: 1000+.
- `plan_events`: 13+.
- `workout_sessions`: ~10.
- `exercise_progress`: ~10.
- `equivalences`: 1.
- **Melange schema_version: 21.**
- **THENICS_CATALOG: 206** движений.
- **NAMED_EXERCISES: ~70** движений (21 prehab).
- **PROGRESSIONS_CATALOG: 22** прогрессии × 10 уровней.

## Что сделано за 2026-10-06..09

- **A. dodofo GPS** — 264/264.
- **B. Учёт нагрузки** — TSS в превью.
- **C. Wellness v20** — sources_json, calories, русификация.
- **D. Модель A** — RunsTableFlat + RunsTableGrouped.
- **E. Автосинхронизация** — pb:auto-sync-on-start.
- **F. Реверс-маппинг ICU** — workoutMatcher.ts.
- **Thenics** — каталог 206, equivalences, EquivalenceMapperPanel
  с прогрессом, фильтрами, баннером.
- **Prehab (G)** — 21 named + 2 программы.
- **Рефакторинг** — PANELS/ (8 панелей), PranaBinduPage ~700 строк.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md`.
2. Обновить статус в этом файле.
3. `git commit`.

## Связь с OSINT-промтами

Промты OSINT — в `docs/prompts/`.
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.


=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-10-08
> Родительский проект: wetothemoon-electron
> Модуль: Prana-Bindu (тренировки тела)

## Навигация

| #   | Направление                                       | Файл промпта                 | Статус              |
|-----|---------------------------------------------------|------------------------------|---------------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | chats/02_CORE.md             | не начат            |
| 03  | Календарь, периодизация (Mentat)                  | chats/03_MENTAT.md           | **~75%, активен**   |
| 04  | Марафон: пульс, темп (Stillsuit)                  | chats/04_STILLSUIT.md        | не начат            |
| 05  | Big-6: движок прогрессий (Crysknife)              | chats/05_CRYSKNIFE.md        | не начат            |
| 06  | Восстановление (Water Discipline)                 | chats/06_WATER_DISCIPLINE.md | не начат            |
| 07  | Аналитика, FIT/TCX, провайдеры (Spice)            | chats/07_SPICE.md            | **99%, активен**    |
| 08  | Схема БД, миграции (Melange)                      | chats/08_MELANGE.md          | **v21, активен**    |
| 09  | Окно, меню, IPC (Electron Shell)                  | chats/09_ELECTRON_SHELL.md   | **завершён**        |
| 10  | UI, визуал, стили (Duna)                          | chats/10_UI_DUNA.md          | **~55%, активен**   |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | chats/11_RECOMMENDER.md      | не начат            |
| 12  | Live-журнал (бег + силовая) — PWA                 | — (отдельный проект)         | не начат            |
| 13  | Визуализация упражнений (p5.js / three.js)        | chats/13_ANIMATION.md        | не начат            |
| 14  | Дашборд главной страницы                          | chats/14_DASHBOARD.md        | не начат            |
| 15  | Standalone справочник калистеники                 | — (отдельный проект)         | идея                |

## Связанные чаты (вне направлений)

| Направление                                       | Файл промпта                                  | Статус   |
|---------------------------------------------------|-----------------------------------------------|----------|
| Стандартизация CSS/стилей                         | _shared/STYLES_CONVENTION.md                  | черновик |
| Коллекция компонентов (React-контракты)           | _shared/COMPONENTS_CONVENTION.md              | черновик |
| Графики и визуализация                            | _shared/CHARTS_CHAT_START.md                  | черновик |

## Что сделано за 2026-10-06..08

### Задача A. dodofo GPS из `Activity.polyline`

- Публичный контракт dodofo: `/streams` не отдаёт GPS.
- GPS в карточке заезда `GET /activities/{id}` → `Activity.polyline`.
- `DodofoActivityFull`, `fetchStreams` дёргает два запроса, склеивает `latlng`.
- **264/264** dodofo-фактов получили GPS.
- Масс-ресинк восстановил GPS везде.

### Задача B. Учёт нагрузки при генерации

- `pb:day-load-summary(from, to)` — TSS дня (план + факт) + baseline28.
- В превью программы (`WadeProgramsPanel`) — `TSS N` рядом с датой,
  жёлтая / красная рамка при превышении 1.5× / 2.5× медианы 28 дней.
- Только бег. FIT/TCX без `training_load` → 0 (v22 — расчёт по HR).

### Задача C. Wellness v20

- Melange v20: `sources_json`, `calories_active`, `calories_total`, `body_fat_pct`.
- `auto_source = name` (наш провайдер, не `zepp`).
- `sources_json` аккумулируется: `["intervals-icu","dodofo"]`.
- Русификация всех секций WellnessDrawer / WellnessView.
- Секция «Энергия» (calories / body fat).

### Задача D. Модель A (день как заголовок)

- `RunsPanel/` — новый модуль с двумя видами таблицы.
- `RunsTableFlat` — плоский вид + виртуализация.
- `RunsTableGrouped` — `rowGroupMode=subheader` по дате + progressive loading (25 групп чанк).
- Переключатель вида в тулбаре, сохраняется в `pb.runsViewMode`.

### Задача E. Автосинхронизация при старте

- `pb:auto-sync-on-start` — единственный флаг `autoOnStart`, антидребезг 6 ч.
- Синкает workouts + wellness за 7 дней.
- `AutoSyncPanel` встроен внизу SyncPanel.

### Задача F. Реверс-маппинг ICU-строк

- `workoutMatcher.ts` — 3 уровня: `full` / `partial` / `none`.
- Нормализация имён (W/L-префикс, L/R-суффикс, дефисы).
- `aliases` в `CatalogEntry` / `CatalogLevel` / `NamedExercise`.
- Проверка на 25 шаблонах: `full 241 / partial 46 / none 77`. Реальных `none` — 3 движения + модификаторы темпа.

### Thenics — каталог + equivalences

- `THENICS_CATALOG` — 206 движений из приложения Thenics.
- Melange v21: таблица `equivalences`.
- `EquivalenceMapperPanel` — вкладка «Соответствия» в `WorkoutTemplatesDialog`.
- `useEquivalencesMap` — хук, показ «≈ Push Up (Beginner)» в `DayDrawer` и `WadeProgramsPanel`.

### Рефакторинг PranaBinduPage

- Вынесено в `PANELS/`: ProfilePanel, ConnectionsPanel, AutoSyncPanel,
  ImportPanel, WellnessPanel, SyncPanel, TrainingTabs, RunsPanel.
- `TrainingTabs` — три панели (Календарь / План / Пробежки) в одной Panel
  с mode-switch.
- `PranaBinduPage.tsx`: ~2400 → ~700 строк.

### Мелкие фиксы

- `CheckLevelDialog`: префикс W/L из категории движения,
  `detectedRung` в `exercises_json`.
- DayDrawer: одна «Свободная сессия» на день, бейдж `тест` на строках.
- `pb:import-zepp-dir`: обновляет `origin='zepp-app'` при совпадении.
- `big6-*` шаблоны → `circuit-*` (перенос из `strength-big6` в `circuit`).
- `drills-big6-run` → `drills-full-complex`.
- Убраны дубли id в `THENICS_CATALOG` (17, 34, 115, 127).

## Данные на 2026-10-08

- `run_facts`: ~2530 записей.
- `run_streams`: ~200 МБ .msgpack, 264/264 dodofo с GPS.
- `recovery_logs`: 1000+ (ICU + dodofo).
- `plan_events`: 13+.
- `workout_sessions`: ~10 (факт силовых + тесты).
- `exercise_progress`: ~10 движений.
- `equivalences`: 1+.
- **Melange schema_version: 21.**
- **THENICS_CATALOG: 206 движений.**
- Уникальных дат тренировок: ~900+.
- Интервал: 2018 – 2026 гг.

## Источники (актуально)

- **dodofo.ru** — агрегатор (workouts, streams + GPS, thresholds, wellness).
- **Strava-архив** — FIT/TCX файлы (полные потоки).
- **intervals.icu** — wellness + events + workouts + streams + plan.
- **Zepp FIT-папка** — workouts + streams (ручные выгрузки).
- **Zepp-direct** — TODO.
- **Google Fit** — отложено.

## Что уже сделано

### Инфраструктура

- Каркас `src/main/services/pranaBindu/` и `src/components/PRANA_BINDU/`.
- Разведка `@dofek/zepp-client`, `regionDetector.ts`.
- Направление 09 (Electron Shell) — полностью.

### Melange

- v1 → **v21**. Репозитории: `profileRepo`, `syncRepo`, `runFactsRepo`,
  `runStreamsRepo`, `recoveryRepo`, `planEventsRepo`,
  `workoutSessionsRepo`, `exerciseProgressRepo`, `equivalencesRepo`.
- Все миграции идемпотентны.

### Провайдеры и импорт

- `DodofoProvider` — workouts, streams (с GPS), thresholds, wellness.
- `IntervalsIcuProvider` — workouts, streams, thresholds, zones,
  wellness, events, plan.
- Capabilities у всех, `regionDetector.ts`, каркас `dofek-zepp`.
- `fitParser.ts`, `tcxParser.ts`, `stravaCsvParser.ts`,
  `gpsClassifier.ts`, `workoutValidator.ts`.
- `runStreamsStorage.ts` — .msgpack, `latlng` в channels.
- `workoutMatcher.ts` — реверс-маппинг ICU-строк.

### UI

- Панели в `PANELS/`: Профиль, Подключения, Автосинхронизация,
  Синхронизация (API), Импорт файлов, Здоровье, TrainingTabs,
  RunsPanel.
- Таблица «Пробежки» — плоский вид + по дням, фильтры, бейджи.
- Drawer пробежек, карта с GPS, график, sync.
- Панель «План» + drawer события, библиотека шаблонов,
  каталог упражнений, вкладка «Соответствия» (Thenics ↔ наши).
- `TrainingTabs` — три панели в одной Panel с mode-switch.
- `FullWeek` — sticky-полоса недели.
- `DayDrawer` (План / Факт / Здоровье) + `DaySummary`.
- `CheckReminderDialog`, `CheckLevelDialog`.
- Единый accent-focus для порталов.

### Mentat (03)

- `workoutParser.ts` — ICU + W1..W10 / L1..L10.
- `workoutRenderer.ts` — обратный рендер.
- `exerciseCatalog.ts` — 22 прогрессии × 10 уровней + ~49 named.
- `thenicsCatalog.ts` — 206 движений из Thenics.
- `workoutTemplates.ts` — 25 шаблонов в 10 категориях.
- `wadeProgramGenerator.ts` — preview с `lineDetails`.
- Программы: `wadePrograms`, `runnerPrograms`, `caliPrograms`,
  `prehabPrograms`.
- `WadeProgramsPanel` — прогресс из БД, TSS в превью.
- `EquivalenceMapperPanel`.

## Известные баги dodofo (статус)

1. HR-канал в `/streams` = константа `max_hr_bpm`. **Исправлено
   разработчиком** (2026-09-30). Старые 260 записей **не
   пересчитаны** — там HR = 144 константой.
2. `/me/thresholds` отдаёт только `resthr`.
3. `/auth/me/zones` пусто (все поля null).

## Контекст: марафон 7 и выводы

- Марафон 27.09.2026 — 5:56:01, пульс 145–155 (выше марафонской зоны).
- Данные от dodofo были искажены (пульс, мощность, темп, высота),
  исправлено разработчиком.
- Приоритет 07_SPICE — дожать импорт FIT/TCX, валидатор, GPS-карта.
- Все подробности — в `PROJECT_STATE.md`.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md` — что сделано.
2. Обновить статус в этом файле (`00_MASTER_INDEX.md`).
3. `git commit`.

## Связь с OSINT-промтами

Промты OSINT — в `docs/prompts/`.
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.

---

Проверь. Если в каком-то месте я что-то упустил или переврал — правь. Дальше — **`01_COMMON_CONTEXT.md`**. Там по сути не так много должно было поменяться, но:

- **Марафонские уроки:** добавить GPS в Москве глушат, акселерометр.
- **Стек:** уже правильно — maplibre-gl, fit-file-parser, csv-parse и т. д.
- **Схема данных:** обновить v16 → v21.
- **Big-6 / Crysknife:** без изменений.
- **Правила работы:** может добавить «Перед коммитом всегда `git status`» (это в прошлый раз пригодилось).


=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-10-05
> Родительский проект: wetothemoon-electron
> Модуль: Prana-Bindu (тренировки тела)

## Навигация

| #   | Направление                                       | Файл промпта                 | Статус              |
|-----|---------------------------------------------------|------------------------------|---------------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | chats/02_CORE.md             | не начат            |
| 03  | Календарь, периодизация (Mentat)                  | chats/03_MENTAT.md           | **~55%, активен**   |
| 04  | Марафон: пульс, темп (Stillsuit)                  | chats/04_STILLSUIT.md        | не начат            |
| 05  | Big-6: движок прогрессий (Crysknife)              | chats/05_CRYSKNIFE.md        | не начат            |
| 06  | Восстановление (Water Discipline)                 | chats/06_WATER_DISCIPLINE.md | не начат            |
| 07  | Аналитика, FIT/TCX, провайдеры (Spice)            | chats/07_SPICE.md            | **99%, активен**    |
| 08  | Схема БД, миграции (Melange)                      | chats/08_MELANGE.md          | **v15, активен**    |
| 09  | Окно, меню, IPC (Electron Shell)                  | chats/09_ELECTRON_SHELL.md   | **завершён**        |
| 10  | UI, визуал, стили (Duna)                          | chats/10_UI_DUNA.md          | **~25%, активен**   |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | chats/11_RECOMMENDER.md      | не начат            |
| 12  | Live-журнал (бег + силовая) — PWA                 | — (отдельный проект)         | не начат            |
| 13  | **Визуализация упражнений (p5.js / three.js)**    | chats/13_ANIMATION.md        | не начат, **NEW**   |
| 14  | **Дашборд главной страницы**                      | chats/14_DASHBOARD.md        | не начат, **NEW**   |
| 15  | **Standalone справочник калистеники**             | — (отдельный проект)         | идея, **NEW**       |

## Связанные чаты (вне направлений)

| Направление                                       | Файл промпта                                  | Статус   |
|---------------------------------------------------|-----------------------------------------------|----------|
| Стандартизация CSS/стилей                         | _shared/STYLES_CONVENTION.md                  | черновик |
| Коллекция компонентов (React-контракты)           | _shared/COMPONENTS_CONVENTION.md              | черновик |
| Графики и визуализация                            | _shared/CHARTS_CHAT_START.md                  | черновик |

## Данные на 2026-10-05

- `run_facts`: ~2530 записей (без изменений).
- `run_streams`: ~200 МБ .msgpack.
- `recovery_logs`: 1000+ (ICU + dodofo).
- `plan_events`: 13+.
- **Melange schema_version: 16.**
- 637+ уникальных дат тренировок.
- Интервал: 2018 – 2026 гг.

## Источники (актуально)

- **dodofo.ru** — агрегатор (workouts, streams, thresholds, wellness).
- **Strava-архив** — FIT/TCX файлы (полные потоки).
- **intervals.icu** — wellness + events + workouts + streams.
- **Zepp-direct** — TODO.
- **Google Fit** — отложено.

## Что уже сделано

### Инфраструктура

- Каркас `src/main/services/pranaBindu/` и `src/components/PRANA_BINDU/`.
- Разведка `@dofek/zepp-client`, `regionDetector.ts`.
- Направление 09 (Electron Shell) — полностью.

### Melange

- v1 → v15. Репозитории: `profileRepo`, `syncRepo`,
  `runFactsRepo`, `runStreamsRepo`, `recoveryRepo`,
  `planEventsRepo`.
- Все миграции идемпотентны.

### Провайдеры и импорт

- `DodofoProvider` — workouts, streams, thresholds, wellness.
- `IntervalsIcuProvider` — workouts, streams, thresholds,
  zones, wellness, events.
- Capabilities у всех, `regionDetector.ts`, каркас `dofek-zepp`.
- `fitParser.ts`, `tcxParser.ts`, `stravaCsvParser.ts`,
  `gpsClassifier.ts`, `workoutValidator.ts`.
- `runStreamsStorage.ts` — .msgpack, `latlng` в channels.

### UI

- Панели: Подключения, Синхронизация (API), Импорт файлов,
  Wellness, План, Пробежки, Профиль, **Календарь**.
- Таблица «Пробежки» — бейджи, фильтры, колонка «Название».
- Drawer пробежек: название над вкладками, карта, график.
- Панель «План» + drawer события.
- Библиотека шаблонов + **каталог упражнений**.
- `RunStreamsChart` с зонами, `GpsMapView`.
- `WorkoutTimeline` — таймлайн шагов (события + шаблоны).
- `YearCalendar` — годовой календарь с маркерами план/факт.
- **Календари:** Год / Квартал / Месяц / MiniWeek / FullWeek.
- **DayDrawer** — единый drawer дня (план+факт+wellness).
- **MirrorDeleteDialog** — mirror-delete plan_events.

### Mentat (03)

- `workoutParser.ts` — ICU + W1..W10 / L1..L10.
- `workoutRenderer.ts` — обратный рендер.
- `exerciseCatalog.ts` — 22 прогрессии (Wade, Cali, Runner,
  Core, Posture, Weight-loss) × 10 уровней + 35 named
  (drills, plyo, warmup, run-basic).
- `workoutTemplates.ts` — 25 шаблонов в 9 категориях.
- Парсер/рендерер + ICU-совместимые цвета таймлайна.

## Известные баги dodofo (письмо готово к отправке)

1. HR-канал в `/streams` = константа `max_hr_bpm`. **Исправлено
   разработчиком** (проверить на новых записях).
2. `/me/thresholds` отдаёт только `resthr`.
3. `/auth/me/zones` пусто (все поля null).

## Контекст: марафон 7 и выводы

- Марафон 27.09.2026 — 5:56:01, пульс 145–155 (выше марафонской зоны).
- Данные от dodofo были искажены (пульс, мощность, темп, высота),
  исправлено разработчиком.
- **Приоритет 07_SPICE:** дожать импорт FIT/TCX, валидатор, GPS-карта.
- Все подробности — в `PROJECT_STATE.md`.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md` — что сделано.
2. Обновить статус в этом файле (`00_MASTER_INDEX.md`).
3. `git commit`.

## Связь с OSINT-промтами

Промты OSINT — в `docs/prompts/`.
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.


=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-09-30
> Родительский проект: wetothemoon-electron
> Модуль: Prana-Bindu (тренировки тела)

## Навигация

| #   | Направление                                       | Файл промпта                 | Статус          |
|-----|---------------------------------------------------|------------------------------|-----------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | chats/02_CORE.md             | не начат        |
| 03  | Календарь, периодизация, подводка к 27.09.2027    | chats/03_MENTAT.md           | **~30%, активен** |
| 04  | Марафон: пульс, темп, экономичность (Stillsuit)   | chats/04_STILLSUIT.md        | не начат        |
| 05  | Big-6: движок прогрессий (Crysknife)              | chats/05_CRYSKNIFE.md        | не начат        |
| 06  | Восстановление: сон, HRV, гидратация              | chats/06_WATER_DISCIPLINE.md | не начат        |
| 07  | Аналитика, FIT/TCX, dodofo, intervals.icu (Spice) | chats/07_SPICE.md            | **99%, активен** |
| 08  | Схема БД, миграции (Melange)                      | chats/08_MELANGE.md          | **v15, активен** |
| 09  | Окно, меню, IPC, интеграция в main.ts             | chats/09_ELECTRON_SHELL.md   | **завершён**    |
| 10  | UI, визуал, стили PRANA_BINDU                     | chats/10_UI_DUNA.md          | не начат        |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | chats/11_RECOMMENDER.md      | не начат        |
| 12  | Live-журнал во время бега (отдельный PWA)         | — (отдельный проект)         | не начат        |

## Связанные чаты (вне направлений)

| Направление                                       | Файл промпта                                  | Статус  |
|---------------------------------------------------|-----------------------------------------------|---------|
| Стандартизация CSS/стилей                         | _shared/STYLES_CONVENTION.md                  | черновик |
| Коллекция компонентов (React-контракты)           | _shared/COMPONENTS_CONVENTION.md              | черновик |
| Графики и визуализация                            | _shared/CHARTS_CHAT_START.md                  | черновик |

## Данные на 2026-10-03

- `run_facts`: ~2530 записей (260 dodofo + 68 fit/strava +
  264 fit/zepp + 2 fit/manual + 617 tcx + 265 ICU + 1053 strava-csv).
- `run_streams`: ~200 МБ .msgpack.
- `recovery_logs`: 1000+ (ICU + dodofo).
- `plan_events`: 8+.
- 637+ уникальных дат тренировок.
- Интервал: 2018 – 2026 гг.

## Источники (актуально)

- **dodofo.ru** — агрегатор (workouts, streams, thresholds).
- **Strava-архив** — FIT/TCX файлы (полные потоки).
- **intervals.icu** — wellness + план (TODO: workouts, streams).
- **Zepp-direct** — TODO.
- **Google Fit** — отложено.

## Что уже сделано

- Каркас `src/main/services/pranaBindu/` и `src/components/PRANA_BINDU/`.
- Разведка `@dofek/zepp-client`, `regionDetector.ts`.
- Направление 09 (Electron Shell) — полностью.
- Melange v1 → v6 (см. 08_MELANGE.md).
- Провайдер dodofo: token, thresholds, streams, activities.
- Провайдер dofek-zepp: regionDetector, capabilities.
- Capabilities у всех провайдеров, `pb:provider-capabilities`.
- **Импорт FIT/TCX** (`fitParser.ts`, `tcxParser.ts`,
  `gpsClassifier.ts`, `workoutValidator.ts`).
- **`run_streams`** — файловое хранилище (MessagePack).
- **945 записей** в `run_facts`:
  - dodofo: 260 (после фикса HR разработчиком);
  - fit: 71 (69 strava-archive + 1 manual-import + 1 zepp-app);
  - tcx: 617 (strava-archive).
- UI-таблица пробежек: группировка по дате, бейджи источников,
  виртуализация, сохранение периода.
- Drawer сравнения: вкладки источников одной тренировки.
- Графики: `RunStreamsChart` (Chart.js) — HR, темп, каденс,
  высота, дистанция.
- Debug-панель: thresholds / zones / streams + анализ плоских
  каналов.
- Ручной импорт FIT/TCX: кнопка + drag&drop + выбор origin.
- Прогресс-бар батч-импорта с отменой.

## Известные баги dodofo (письмо готово к отправке)

1. HR-канал в `/streams` = константа `max_hr_bpm` (кейсы
   id=28, 15, 85). **Разработчик сообщил об исправлении.**
2. `/me/thresholds` отдаёт только `resthr`.
3. `/auth/me/zones` пусто (все поля null).

Мониторить после исправления: новые тренировки от dodofo
должны приходить с корректным HR-каналом.

## Контекст: марафон 7 и выводы

- Марафон 27.09.2026 — 5:56:01, пульс 145–155 (выше марафонской зоны).
- Данные от dodofo были искажены (пульс, мощность, темп, высота),
  исправлено разработчиком.
- **Приоритет 07_SPICE:** дожать импорт FIT/TCX, валидатор, GPS-карта.
- Все подробности — в `PROJECT_STATE.md`.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md` — что сделано.
2. `git commit`.
3. Обновить статус в этой таблице.

## Связь с OSINT-промтами

Промты OSINT — в `docs/prompts/`.
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.


=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-09-28
> Родительский проект: wetothemoon-electron
> Модуль: Prana-Bindu (тренировки тела)

## Навигация

| #   | Направление                                       | Файл промпта                 | Статус       |
|-----|---------------------------------------------------|------------------------------|--------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | chats/02_CORE.md             | не начат     |
| 03  | Календарь, периодизация, подводка к 27.09.2027    | chats/03_MENTAT.md           | не начат     |
| 04  | Марафон: пульс, темп, экономичность (Stillsuit)   | chats/04_STILLSUIT.md        | не начат     |
| 05  | Big-6: движок прогрессий (Crysknife)              | chats/05_CRYSKNIFE.md        | не начат     |
| 06  | Восстановление: сон, HRV, гидратация              | chats/06_WATER_DISCIPLINE.md | не начат     |
| 07  | Аналитика, FIT/TCX, dodofo, Google Fit (Spice)    | chats/07_SPICE.md            | **активный** |
| 08  | Схема БД, миграции (Melange)                      | chats/08_MELANGE.md          | **активный** |
| 09  | Окно, меню, IPC, интеграция в main.ts             | chats/09_ELECTRON_SHELL.md   | **завершён** |
| 10  | UI, визуал, стили PRANA_BINDU                     | chats/10_UI_DUNA.md          | не начат     |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | chats/11_RECOMMENDER.md      | не начат     |
| 12  | Live-журнал во время бега (отдельный PWA)         | — (отдельный проект)         | не начат     |

## Что уже сделано

- Каркас `src/main/services/pranaBindu/` и `src/components/PRANA_BINDU/`.
- Разведка `@dofek/zepp-client`, `regionDetector.ts`.
- Направление 09 (Electron Shell) — полностью.
- Melange v1 + v2.
- Провайдер dodofo (клиент + провайдер + IPC + UI).
- Синхронизация тренировок из dodofo → `run_facts` (14 записей
  за сентябрь 2026, идемпотентно).
- UI-таблица пробежек.

## Контекст: марафон 7 и выводы

- Марафон 27.09.2026 — 5:56:01, пульс 145–155 (выше марафонской зоны).
- Данные от dodofo искажены (пульс, мощность, темп, высота).
- **Приоритет 07_SPICE:** FIT/TCX импорт напрямую, валидатор данных,
  классификатор GPS-качества (глушилки в центре Москвы).
- Все подробности — в `PROJECT_STATE.md`.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md` — что сделано.
2. `git commit`.
3. Обновить статус в этой таблице.

## Связь с OSINT-промтами

Промты OSINT — в `docs/prompts/`.
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.


=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-09-26
> Родительский проект: wetothemoon-electron
> Модуль: Prana-Bindu (тренировки тела)

## Навигация

| #   | Направление                                       | Файл промпта                 | Статус     |
|-----|---------------------------------------------------|------------------------------|------------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | chats/02_CORE.md             | не начат   |
| 03  | Календарь, периодизация, подводка к 27.09.2026    | chats/03_MENTAT.md           | не начат   |
| 04  | Марафон: пульс, темп, экономичность (Stillsuit)   | chats/04_STILLSUIT.md        | не начат   |
| 05  | Big-6: движок прогрессий (Crysknife)              | chats/05_CRYSKNIFE.md        | не начат   |
| 06  | Восстановление: сон, HRV, гидратация              | chats/06_WATER_DISCIPLINE.md | не начат   |
| 07  | Аналитика, dodofo, Google Fit (Spice)             | chats/07_SPICE.md            | **активный** |
| 08  | Схема БД, миграции (Melange)                      | chats/08_MELANGE.md          | не начат   |
| 09  | Окно, меню, IPC, интеграция в main.ts             | chats/09_ELECTRON_SHELL.md   | **завершён** |
| 10  | UI, визуал, стили PRANA_BINDU                     | chats/10_UI_DUNA.md          | не начат   |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | chats/11_RECOMMENDER.md      | не начат   |

## Что уже сделано (вне направлений, подготовительно)

- Каркас `src/main/services/pranaBindu/` (структура, типы, barrel-файлы).
- Каркас `src/components/PRANA_BINDU/`.
- Разведка `@dofek/zepp-client` — `signInToZepp(email, password, fetchFn)`
  подтверждён, `regionDetector.ts` реализован.
- `spice/providers/regionDetector.ts` — автодетект регионального хоста Zepp.
- `spice/providers/dodofoClient.ts`, `dodofoProvider.ts` — HTTP-клиент и
  провайдер dodofo.ru.
- Melange v1+v2: `db.ts`, `schema.ts`, `migrations.ts`, `seed.ts`,
  `repositories/profileRepo.ts`, `syncRepo.ts`.

Подробности — в `PROJECT_STATE.md`.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md` — что сделано.
2. `git commit`.
3. Обновить статус в этой таблице.

## Связь с OSINT-промтами

Промты OSINT лежат в `docs/prompts/` (00_MASTER_INDEX, 01_COMMON_CONTEXT,
PROJECT_STATE, chats/*).
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.



=====================================

# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-09-23
> Родительский проект: wetothemoon-electron
> Модуль: Prana-Bindu (тренировки тела)

## Навигация

| #   | Направление                                       | Файл промпта                 | Статус   |
|-----|---------------------------------------------------|------------------------------|----------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | chats/02_CORE.md             | не начат |
| 03  | Календарь, периодизация, подводка к 27.09.2026    | chats/03_MENTAT.md           | не начат |
| 04  | Марафон: пульс, темп, экономичность (Stillsuit)   | chats/04_STILLSUIT.md        | не начат |
| 05  | Big-6: движок прогрессий (Crysknife)              | chats/05_CRYSKNIFE.md        | не начат |
| 06  | Восстановление: сон, HRV, гидратация              | chats/06_WATER_DISCIPLINE.md | не начат |
| 07  | Аналитика, Google Fit, Zepp (Spice)               | chats/07_SPICE.md            | не начат |
| 08  | Схема БД, миграции (Melange)                      | chats/08_MELANGE.md          | не начат |
| 09  | Окно, меню, IPC, интеграция в main.ts             | chats/09_ELECTRON_SHELL.md   | активный |
| 10  | UI, визуал, стили PRANA_BINDU                     | chats/10_UI_DUNA.md          | не начат |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | chats/11_RECOMMENDER.md      | не начат |

## Подготовительный шаг (не отдельное направление)

Перед 09 создаётся **каркас сервисного слоя и компонентов**:

- `src/main/services/pranaBindu/` — структура подмодулей (`core/`,
  `stillsuit/`, `crysknife/`, `mentat/`, `waterDiscipline/`, `spice/`,
  `melange/`), `types.ts` + `index.ts` в каждом, константы Big-6,
  интерфейс провайдеров Zepp.
- `src/components/PRANA_BINDU/` — структура папок под модули UI.

Делается один раз, коммитится отдельно. Промт-файла нет — состав
зафиксирован в этом чате и в `PROJECT_STATE.md`.

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md` — что сделано.
2. `git commit`.
3. Обновить статус в этой таблице.

## Связь с OSINT-промтами

Промты OSINT лежат в `docs/prompts/` (00_MASTER_INDEX, 01_COMMON_CONTEXT,
PROJECT_STATE, chats/*).
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.



==================================
old version
==================================


# Индекс чатов разработки Prana-Bindu

> Обновлено: 2026-09-22
> Родительский проект: wetothemoon-electron
> Модуль: Prana-Bindu (тренировки тела)

## Навигация

| #   | Направление                                       | Файл промпта                | Статус   |
|-----|---------------------------------------------------|-----------------------------|----------|
| 02  | Ядро: зоны, 80/20, движок тренировок              | chats/02_CORE.md            | активный |
| 03  | Календарь, периодизация, подводка к 27.09.2026    | chats/03_MENTAT.md          | не начат |
| 04  | Марафон: пульс, темп, экономичность (Stillsuit)   | chats/04_STILLSUIT.md       | не начат |
| 05  | Big-6: движок прогрессий (Crysknife)              | chats/05_CRYSKNIFE.md       | не начат |
| 06  | Восстановление: сон, HRV, гидратация              | chats/06_WATER_DISCIPLINE.md| не начат |
| 07  | Аналитика, Google Fit, ZeppBridge (Spice)         | chats/07_SPICE.md           | не начат |
| 08  | Схема БД, миграции (Melange)                      | chats/08_MELANGE.md         | не начат |
| 09  | Окно, меню, IPC, интеграция в main.ts             | chats/09_ELECTRON_SHELL.md  | не начат |
| 10  | UI, визуал, стили PRANA_BINDU                     | chats/10_UI_DUNA.md         | не начат |
| 11  | AI-рекомендации (Ollama / DeepSeek)               | chats/11_RECOMMENDER.md     | не начат |

## Как начать новый чат

1. Скопировать `01_COMMON_CONTEXT.md`.
2. Скопировать `PROJECT_STATE.md`.
3. Скопировать содержимое нужного `chats/NN_*.md`.
4. Написать: «Сейчас работаем над <NN>. Начинаем с шага 1.»

## Как закрыть чат

1. Обновить `PROJECT_STATE.md` — что сделано.
2. `git commit`.
3. Обновить статус в этой таблице.

## Связь с OSINT-промтами

Промты OSINT лежат в `docs/prompts/` (00_MASTER_INDEX, 01_COMMON_CONTEXT, PROJECT_STATE, chats/*).
Промты Prana-Bindu — в `docs/prompts/prana-bindu/`.
Не смешивать: разные модули, разные БД, разные IPC-префиксы.