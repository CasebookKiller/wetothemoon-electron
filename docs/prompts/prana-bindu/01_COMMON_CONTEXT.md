# Prana-Bindu — общий контекст модуля

> Обновлено: 2026-10-14

## Что это

Prana-Bindu — модуль тренировок тела в составе многомодульного приложения `wetothemoon-electron`. Не пересекается с `training:*` (там fine-tuning Ollama, не про тело).

Две линии:
- **Stillsuit** — марафон (бег, пульс, темп, экономичность).
- **Crysknife** — Big-6 (6 движений × 10 ступеней).

Координируют: **Mentat** (периодизация, каталог упражнений), **Water Discipline** (восстановление), **Spice** (данные, провайдеры), **Melange** (БД), **Prana-Bindu Core** (зоны, 80/20), **Duna** (UI).

## Цель пользователя

- Марафон 42,2 км **27.09.2027** (восьмой).
- Седьмой пробежан **27.09.2026** за 5:56:01.
- Старт подготовки: **01.11.2026**.
- Задача: снизить темп и пульс на заданном темпе.
- Параллельно — прогресс Big-6 и общего физического.
- Сбросить вес (~3 сек/км на кг).

## Марафон 7 — ключевые уроки

- **Пульс:** 145–155 вместо марафонской зоны 134–142.
- **Стопы:** ныли на 30+ км. Нужно укреплять (prehab, задача G).
- **Первые 2 км:** слишком быстро (6:42/км) — ошибка.
- **Данные dodofo:** были искажены (исправлено разработчиком 2026-09-30).
- **GPS в Москве глушат** (СВО). Дистанция/темп — от акселерометра, не от GPS. Но сам трек записывается — и мы его **теперь забираем** из `Activity.polyline`.
- **HR-баг старых записей:** у 260 dodofo-фактов до 2026-09-30 `hr` = константа 144. Сервер не пересчитывает, mass-resync не помогает.

## Методология

- **80/20**: ~80% в зонах 1–2, ~20% в 4–5.
- **SIRPOC** — сезонная периодизация.
- **Big-6** (Convict Conditioning) — силовая.
- **Взаимный прогресс:** силовые → экономичность бега; бег → восстановление между подходами.
- **Прогрессия Big-6** — только при benchmark + стабильном пульсе.
- **Water Discipline** блокирует прогрессию при низком HRV.
- **Автоблокировка** при систематическом беге в зоне 4 (>20% объёма).

## Источники данных

### dodofo.ru — агрегатор (основной)

- Bearer-токен `dodofo_…`, только чтение. Хранится в `sync_settings.dodofo_token` (safeStorage).
- **Workouts:** `/api/v1/activities?from=&to=&sport_type=run` — список.
- **Streams:** `/api/v1/activities/{id}/streams` — числовые каналы (`dist_m`, `sec_t`, `speed_kmh`, `hr`, `power_w`, `cadence_rpm`, `hr_zones`, `power_zones`, `eftp_watts`, `summary`). **GPS здесь нет.**
- **GPS:** `GET /api/v1/activities/{id}` → `Activity.polyline: [[lat, lng], …]`. Тянем **вторым запросом** в `fetchStreams`.
- **Thresholds:** `/api/v1/me/thresholds` — только `resthr`.
- **Zones:** `/auth/me/zones` — пусто (404).
- **Wellness:** `/api/v1/wellness?from=&to=` — сон, шаги, RHR, `calories_active`. Не отдаёт `rem_min`, `awake_min`, `stress_avg`, `body_battery_*`.
- **GPS трек получен для 264/264 dodofo-фактов.**
- HR-баг в записях до 2026-09-30 — исправлен на сервере, но **старые данные не пересчитаны**.

### Strava-архив — FIT/TCX (ручной экспорт)

- 617 TCX + 69 FIT (+ 2 ручных/zepp-app).
- Импорт через `pb:import-fit-dir` или drag&drop.
- `fit-file-parser` + `fast-xml-parser`.
- `origin = 'strava-archive'`.
- Полные потоки: HR, каденс, GPS, высота.

### intervals.icu — агрегатор (wellness + план)

- API-ключ + Basic Auth (`API_KEY:<ключ>`). Хранится в `sync_settings.intervals_api_key` (safeStorage).
- **Wellness** — сон, RHR, CTL/ATL, RampRate, стресс, шаги.
- **Events / plan_events** — план тренировок.
- **Workouts + streams** — активности.
- **Zones** — HR-зоны и pace-зоны.
- Активная работа: `/wellness?oldest=&newest=`, `/athlete/{id}/events`.

### Zepp FIT-папка (Yandex.Disk)

- 264 FIT-файла, ручные выгрузки.
- `origin = 'zepp-app'`.
- Импорт через `pb:import-zepp-dir`.
- `pb:import-zepp-dir` **обновляет `origin='zepp-app'`,** если файл уже был с другим origin.

### Zepp-direct (резерв, TODO)

- `dofek-zepp` через `@dofek/zepp-client`.
- Регион-детект: `regionDetector.ts`.
- Заглушки: `zepp-mcp`, `zeppbridge`.
- Приоритет: если dodofo/ICU не покроют потоковые данные о сне — доделать прямой вход.

### Прочее

- **Ручной ввод** — fallback.
- **Live-журнал** — отдельный PWA-проект.
- **Google Fit** — отложено навсегда.

### Стратегия multi-source

Одна тренировка может быть в БД несколько раз:
- `dodofo:11714` + `fit:21485879572` + `intervals-icu:i194901643` — три записи одной тренировки 2026-09-26.
- UI группирует по `(date, start_time ± 30 мин)` → одна строка, внутри — вкладки источников.
- **Дедупликация на уровне БД** — v22+ (канонический `run_events` + `run_sources`).

## Два режима GPS

| Режим | Условие | Источник данных |
|---|---|---|
| `good` | ≥95% валидных, | GPS |
| `poor` | 50–95% валидных | акселерометр |
| `lost` | <50%, или пропуски >500 м | акселерометр |

Классификация — при импорте, override — в деталях тренировки.

## Внутренние имена

| Имя | Роль |
|---|---|
| Prana-Bindu Core | Движок зон, 80/20 |
| Stillsuit | Марафон |
| Crysknife | Big-6 |
| Mentat | Календарь, периодизация, каталог упражнений |
| Water Discipline | Восстановление |
| Spice | Аналитика, провайдеры, данные |
| Melange | Локальная БД |
| Duna | UI, визуал, стили |

## Интеграция

- **Окно:** `src/main/windows/pranaBinduWindow.ts` → `#/prana-bindu`.
- **IPC-префикс:** `pb:*`.
- **Хендлеры:** `src/main/ipcHandlers/pranaBinduHandlers.ts`.
- **Сервисы:** `src/main/services/pranaBindu/` (`core/`, `stillsuit/`, `crysknife/`, `mentat/`, `waterDiscipline/`, `spice/`, `melange/`).
- **Компоненты:** `src/components/PRANA_BINDU/`.
- **Панели:** `src/components/PRANA_BINDU/PANELS/` — по подпапке на панель.
- **Утилиты:** `UTILS/`, `VIEWS/`, `HOOKS/`.
- **Страница:** `src/pages/PranaBinduPage/PranaBinduPage.tsx` (после рефакторинга — композиция панелей).
- **Preload:** `electronAPI.pb.*`.

## Стек

- Electron 44 + Electron Forge + Vite + TypeScript.
- React 19 + PrimeReact 10 + PrimeFlex + PrimeIcons.
- SQLite `node:sqlite`.
- `@msgpack/msgpack` — файловое хранилище `run_streams`.
- `fit-file-parser` — FIT.
- `fast-xml-parser` — TCX.
- `csv-parse` — Strava `activities.csv`.
- `chart.js` + PrimeReact `Chart` — графики.
- `maplibre-gl` — карта GPS (OpenFreeMap).
- `@dofek/zepp-client` — резерв Zepp.
- Fetch API — dodofo + intervals.icu.
- `safeStorage` — шифрование токенов.
- Ollama / DeepSeek (Playwright) — AI (11_RECOMMENDER).

## Схема данных (Melange v32)

- `meta`, `profile`, `movements`, `progressions`, `user_movement_state`.
- `strength_plans`, `strength_sessions`.
- `run_plans`, `run_facts` (v4: origin, v6: start_time, v7: gps_*, v11: name/user_name).
- **`run_streams`** (v3) — метаданные, файлы `.msgpack` на диске, `latlng` в channels.
- `recovery_logs` (v8/v9/v20: sleep, battery, ctl/atl, sources_json, calories).
- `progress_checks`.
- `week_templates`, `week_template_days`.
- `sync_settings` (v2: dodofo, v5: fit_archive_path, v21: автосинк).
- `recommendations`.
- **`plan_events`** (v15/v16) — план тренировок из ICU. `local_keep` — «не удалять при mirror-синке».
- **`workout_sessions`** (v18) — факт силовых + тесты.
- **`exercise_progress`** (v19) — прогресс движений Mentat (`current_level`, `current_rung`).
- **`equivalences`** (v21) — соответствия между каталогами (Thenics ↔ Wade / Cali / Runner / ...).
- **`test_segments`** (v26) — тестовые отрезки для порогов.
- **`chains` / `chain_slots`** (v32) — цепочки маршрутов и слоты.

Подробности — `08_MELANGE.md`.

## Exercise Graph

Единый граф упражнений — надстройка над каталогами. Узлы: `pattern`,
`exercise` (canonical / concrete), `program`, `catalog`, `modality`,
`tissue`, `skill`. Рёбра: `progresses-to`, `variant-of`, `instance-of`,
`belongs-to`, `equivalent-to`, `requires`, `used-by` и др.

Сейчас в графе только **Wade** (76 узлов / 210 рёбер). Остальные
каталоги (Cali, Runner, Core, Posture, WeightLoss, Named, Thenics) —
задача **B** (миграция в JSON, манифест).

**smithrun** — каталог для кастомных паттернов / канонов / упражнений,
собранных пользователем из других каталогов. Отдельный
`smithrun.graph.json`.

Подробности — `16_GRAPH.md`.

## Каталог упражнений (Mentat)

- **`PROGRESSIONS_CATALOG`** — 22 прогрессии × 10 уровней:
  Wade (6), Cali (5), Runner (5), Core (2), Posture (2), Weight-loss (2).
- **`NAMED_EXERCISES`** — ~70 движений без уровней (drill, plyo, warmup,
  run-basic, prehab). Из них **21 prehab**: стопы / ахилл (8), колени /
  ягодичные (7), mobility (9), плечи / спина (4).
- **`THENICS_CATALOG`** — 206 движений из приложения Thenics (4 уровня:
  Beginner / Intermediate / Advanced / Pro). Используется для постепенной
  разметки через `equivalences`.
- **Aliases** для реверс-маппинга ICU-строк: `Bridge` ↔ `Bridges`,
  `Diamond Push-ups` ↔ `Close Push-ups W6` и т. д.
- **`workoutMatcher.ts`** — распознаёт `- Incline Push-ups W2 2×20 30s Z1 Pace`
  → `{ movementKey: 'pushup', level: 2, rung: 2 }`.
## Big-6

6 движений × 10 ступеней, схема в `scheme_json`. Для бегунов дополнительно — упражнения на стопы, голень, квадрицепсы, кор.

## Live-журнал (отдельный проект)

Express.js + PWA. Offline-first, локальные правила по пульсу. Экспорт JSON → импорт в Prana-Bindu. Планируется расширение на силовые (после подхода — открыть на телефоне, записать).

## Правила работы

- `src/main/services/pranaBindu/` не импортирует Electron.
- `safeStorage` — только в handler.
- UI-тексты и комментарии — на русском.
- После логического шага — `git commit`.
- **Перед коммитом всегда `git status`** — в этой сессии несколько раз накапливалась незакоммиченная работа.
- Обновлять `PROJECT_STATE.md` при переключении чата.
- Не смешивать логику разных модулей.
- Не трогать другие модули.
- Токены — только `safeStorage`, не логировать целиком.
- **Не делать `git add .`** без разбора — правки из разных фич могут смешаться.

## Что НЕ входит

- Fine-tuning Ollama (существующий `training:*`).
- Публичный релиз с именами из «Дюны».
- Мобильная версия Prana-Bindu.
- Live-журнал — отдельное приложение.
- Weighted / Ring / Band / Mobility из Thenics — отдельные заходы.

---

Проверь. Если где-то нужно что-то добавить (например, про `TrainingTabs`, `FullWeek` или про то, что `PANELS/` — новая структура) — скажи, поправлю.


=====================================

# Prana-Bindu — общий контекст модуля

> Обновлено: 2026-10-05

## Что это

Prana-Bindu — модуль тренировок тела в составе многомодульного
приложения `wetothemoon-electron`. Не пересекается с `training:*`
(там fine-tuning Ollama, не про тело).

Две линии:
- **Stillsuit** — марафон (бег, пульс, темп, экономичность).
- **Crysknife** — Big-6 (6 движений × 10 ступеней).

Координируют: **Mentat** (периодизация), **Water Discipline**
(восстановление), **Spice** (данные), **Melange** (БД),
**Prana-Bindu Core** (зоны, 80/20).

## Цель пользователя

- Марафон 42,2 км 27.09.2027 (восьмой).
- Седьмой пробежан 27.09.2026 за 5:56:01.
- Старт подготовки: 01.11.2026.
- Задача: снизить темп и пульс на заданном темпе.
- Параллельно — прогресс Big-6.
- Сбросить вес (~3 сек/км на кг).

## Марафон 7 — ключевые уроки

- **Пульс:** 145–155 вместо марафонской зоны 134–142.
- **Стопы:** ныли на 30+ км. Нужно укреплять.
- **Первые 2 км:** слишком быстро (6:42/км) — ошибка.
- **Данные dodofo:** были искажены (исправлено разработчиком).
- **GPS в Москве глушат** (СВО). Дистанция/темп — от акселерометра,
  не от GPS.

## Методология

- **80/20**: ~80% в зонах 1–2, ~20% в 4–5.
- **SIRPOC** — сезонная периодизация.
- **Big-6** (Convict Conditioning) — силовая.
- **Взаимный прогресс**: силовые → экономичность бега;
  бег → восстановление между подходами.
- **Прогрессия Big-6** — только при benchmark + стабильном пульсе.
- **Water Discipline** блокирует прогрессию при низком HRV.
- **Автоблокировка** при систематическом беге в зоне 4 (>20% объёма).

## Источники данных

### dodofo.ru — агрегатор (исторически основной)
- Bearer-токен `dodofo_…`, только чтение.
- Даёт: workouts (`/api/v1/activities`), streams
  (`/activities/{id}/streams`), thresholds (`/me/thresholds`,
  только resthr), zones (`/auth/me/zones`, пусто).
- **HR-баг исправлен разработчиком** (2026-09-30). Мониторить.
- Токен в `sync_settings.dodofo_token` (safeStorage).

### Strava-архив — FIT/TCX (ручной экспорт)
- 617 TCX + 69 FIT (плюс 2 ручных/zepp-app).
- Импорт через `pb:import-fit-dir` или drag&drop.
- `fit-file-parser` + `fast-xml-parser`.
- `origin = 'strava-archive'`.
- Полные потоки: HR, каденс, GPS, высота.

### intervals.icu — агрегатор (wellness)
- API-ключ + Basic Auth (`API_KEY:<ключ>`).
- **Wellness** — сон, RHR, CTL/ATL, RampRate, стресс, шаги.
- **TODO:** workouts, streams, plan.
- Ключ в `sync_settings.intervals_api_key` (safeStorage).
- Активная работа: `/wellness?oldest=&newest=`.

### Zepp-direct (резерв, TODO)
- `dofek-zepp` через `@dofek/zepp-client`.
- Регион-детект: `regionDetector.ts`.
- Заглушки: `zepp-mcp`, `zeppbridge`.
- Приоритет: если dodofo/ICU не покроют — доделать прямой вход.

### Прочее
- **Ручной ввод** — fallback.
- **Live-журнал** — отдельный PWA-проект.
- **Google Fit** — отложено навсегда.

### Стратегия multi-source

Одна тренировка может быть в БД несколько раз:
- `dodofo:11714` + `fit:21485879572` + `intervals-icu:12345` —
  три записи одной тренировки 26.09.
- UI группирует по `(date, start_time ± 30 мин)` → одна строка.
- В drawer — TabView источников, сравнение алгоритмов.
- **TODO:** дедупликация на уровне БД (v10+). Пока — работаем
  с multi-source моделью.

## Два режима GPS

| Режим | Условие | Источник данных |
|---|---|---|
| `good` | ≥95% валидных, | GPS |
| `poor` | 50–95% валидных | акселерометр |
| `lost` | <50%, или пропуски >500 м | акселерометр |

Классификация — при импорте, override — в деталях тренировки.

## Внутренние имена

| Имя | Роль |
|---|---|
| Prana-Bindu Core | Движок зон, 80/20 |
| Stillsuit | Марафон |
| Crysknife | Big-6 |
| Mentat | Календарь, периодизация |
| Water Discipline | Восстановление |
| Spice | Аналитика, данные |
| Melange | Локальная БД |

## Интеграция

- **Окно:** `src/main/windows/pranaBinduWindow.ts` → `#/prana-bindu`.
- **IPC-префикс:** `pb:*`.
- **Хендлеры:** `src/main/ipcHandlers/pranaBinduHandlers.ts`.
- **Сервисы:** `src/main/services/pranaBindu/` (`core/`,
  `stillsuit/`, `crysknife/`, `mentat/`, `waterDiscipline/`,
  `spice/`, `melange/`).
- **Компоненты:** `src/components/PRANA_BINDU/`.
- **Страница:** `src/pages/PranaBinduPage/PranaBinduPage.tsx`.
- **Preload:** `electronAPI.pb.*`.

## Стек

- Electron 44 + Electron Forge + Vite + TypeScript.
- React 19 + PrimeReact 10 + PrimeFlex + PrimeIcons.
- SQLite `node:sqlite`.
- `@msgpack/msgpack` — файловое хранилище `run_streams`.
- `fit-file-parser` — FIT.
- `fast-xml-parser` — TCX.
- `chart.js` + PrimeReact `Chart` — графики.
- `maplibre-gl` — карта GPS (OpenFreeMap).
- `@dofek/zepp-client` — резерв Zepp.
- Fetch API — dodofo + intervals.icu.
- `safeStorage` — шифрование токенов.
- Ollama / DeepSeek (Playwright) — AI (11_RECOMMENDER).

## Схема данных (Melange v16)

- `meta`, `profile`, `movements`, `progressions`, `user_movement_state`.
- `strength_plans`, `strength_sessions`.
- `run_plans`, `run_facts` (v4: origin, v6: start_time).
- **`run_streams`** (v3) — метаданные, файлы `.msgpack` на диске.
- `recovery_logs`, `progress_checks`.
- `week_templates`, `week_template_days`.
- `sync_settings` (v2: dodofo, v5: fit_archive_path).
- `recommendations`.
- `plan_events` (v15/v16) — план тренировок из ICU.
  `local_keep` (v16) — «не удалять при mirror-синке».

Подробности — `08_MELANGE.md`.

## Big-6

6 движений × 10 ступеней, схема в `scheme_json`. Для бегунов
дополнительно — упражнения на стопы, голень, квадрицепсы, кор.

## Live-журнал (отдельный проект)

Express.js + PWA. Offline-first, локальные правила по пульсу.
Экспорт JSON → импорт в Prana-Bindu.

## Правила работы

- `src/main/services/pranaBindu/` не импортирует Electron.
- `safeStorage` — только в handler.
- UI-тексты и комментарии — на русском.
- После логического шага — `git commit`.
- Обновлять `PROJECT_STATE.md` при переключении чата.
- Не смешивать логику разных модулей.
- Не трогать другие модули.
- Токены — только `safeStorage`, не логировать целиком.

## Что НЕ входит

- Fine-tuning Ollama (существующий `training:*`).
- Публичный релиз с именами из «Дюны».
- Мобильная версия Prana-Bindu.
- Live-журнал — отдельное приложение.


=====================================

# Prana-Bindu — общий контекст модуля

## Что это

Prana-Bindu — новый модуль тренировок тела в составе многомодульного
приложения `wetothemoon-electron`. Строится с нуля, не пересекается
с существующим `training:*` (там fine-tuning Ollama, не про тело).

Модуль ведёт параллельно две линии:
- **Stillsuit** — марафонская подготовка (бег, пульс, темп, экономичность).
- **Crysknife** — силовая подготовка по Big-6 (6 движений × 10 ступеней).

Обе линии связаны взаимно: прогресс в одной влияет на другую.
Координирует их **Mentat** (календарь, периодизация),
**Water Discipline** (восстановление) — арбитр нагрузки,
**Spice** (аналитика, импорт данных, dodofo, Google Fit),
**Melange** (локальная БД `prana_bindu.db`),
**Prana-Bindu Core** (движок зон и 80/20).

## Цель пользователя

- Марафон 42,2 км 27.09.2027 (восьмой по счёту).
- Седьмой пробежан 27.09.2026 за 5:56:01.
- Старт подготовки к восьмому: 01.11.2026.
- Задача: снизить темп на марафоне и снизить пульс на заданном темпе.
- Параллельно — прогресс в Big-6 по ступеням калистеники.
- Сбросить вес (~3 сек/км на каждый кг).

## Марафон 7 — ключевые уроки

- **Пульс на марафоне:** 145–155 вместо марафонской зоны 134–142.
  Системная проблема: тренировки проходят выше нужной зоны.
- **Стопы:** ныли на 30+ км. Нужно укреплять.
- **Первые 2 км:** слишком быстро (6:42/км) — ошибка.
- **Данные от dodofo искажены:** пульс по км, мощность (10–34 Вт),
  темп, высота. Нужен прямой импорт FIT/TCX.
- **GPS в центре Москвы глушат** (СВО). Дистанция и темп должны
  считаться от акселерометра, не от GPS.

## Методология

- **80/20**: ~80% объёма в зонах 1–2, ~20% в зонах 4–5.
- **SIRPOC** — каркас сезонной периодизации.
- **Big-6** (Convict Conditioning) — каркас силовой подготовки.
- **Взаимный прогресс**: силовые улучшают экономичность бега;
  бег улучшает восстановление между силовыми подходами.
- **Прогрессия Big-6** — только при выполнении benchmark текущей
  ступени и при стабильном пульсе на контрольном темпе.
- **Water Discipline** может блокировать прогрессию при низком HRV
  или плохом сне.
- **Автоблокировка прогрессии** при систематическом беге выше зоны 4
  на лёгких тренировках (> 20% объёма) — цель Prana-Bindu не просто
  показать цифры, а не дать убежать в зону 4.

## Источники данных

**Основной — прямой импорт FIT/TCX.**
- FIT — приоритетный формат (полный набор: пульс, каденс, GPS,
  барометрическая высота, температура, шагомерная дистанция).
- TCX — fallback (есть пульс и GPS, каденс опционально).
- Импорт через drag&drop или выбор файла.
- **Не требует сети, не зависит от dodofo, не искажает данные.**
- Парсеры: `fit-file-parser` (FIT), `fast-xml-parser` (TCX).

**dodofo.ru — дополнительный источник.**
- Bearer-токен (`dodofo_…`), только чтение.
- Покрывает: wellness (`/api/v1/wellness`), thresholds
  (`/api/v1/me/thresholds`), zones (`/api/v1/auth/me/zones`),
  краткие списки активностей (`/api/v1/activities`).
- Используется для wellness и порогов; для тренировок — с осторожностью
  (искажения пульса, мощности, темпа, высоты).
- Токен хранится в `sync_settings.dodofo_token` (шифр. `safeStorage`).

**Резервный — Zepp (Amazfit) напрямую.**
- `dofek-zepp` через `@dofek/zepp-client` с `regionDetector.ts`.
- `zepp-mcp`, `zeppbridge` — заглушки.

**Прочее:**
- **Google Fit API** — OAuth 2.0, отложено.
- **Ручной ввод** — fallback (RPE 1–10).
- **Live-журнал** — отдельный проект (Express.js + PWA), экспортирует
  JSON, Prana-Bindu импортирует как ещё один формат.

## Два режима GPS

В центре Москвы GPS глушат. Источник дистанции и темпа различается
в зависимости от качества сигнала:

| Режим | Условие | Дистанция/темп | Трек | Высота |
|---|---|---|---|---|
| `good` | ≥ 95 % точек валидны, расхождение GPS vs шагомер < 3 % | GPS | рисуется | GPS + барометр |
| `poor` | 50–95 % валидны, расхождение 3–15 % | шагомер (FIT `distance`) | пунктир в пропусках | барометр |
| `lost` | < 50 % валидны, или расхождение > 15 %, или пропуски > 500 м | шагомер | не рисуется | барометр |

Классификация — при импорте. Ручной override доступен в деталях
тренировки.

## Внутренние имена модулей

| Имя                | Роль                                                       |
|--------------------|------------------------------------------------------------|
| Prana-Bindu Core   | Движок зон, 80/20, логика тренировочных блоков             |
| Stillsuit          | Марафон: пульс, темп, экономичность, дыхание               |
| Crysknife          | Big-6: сила, контроль, сухожилия, нейромышечная работа     |
| Mentat             | Календарь, периодизация, подводка к старту                 |
| Water Discipline   | Сон, HRV, гидратация, восстановление                       |
| Spice              | Аналитика, графики, импорт данных (FIT/TCX), dodofo        |
| Melange            | Локальная БД модуля (`prana_bindu.db`)                     |

Публично эти имена не использовать — только как внутренние кодовые.

## Интеграция с существующим приложением

Проект: TypeScript + React 19 + Electron Forge + Vite + PrimeReact 10.
Существующие модули и их паттерны — см. OSINT (`SIETCH`, `osintHandlers`,
`osintWindow`, `DatabasePage`).

Куда встроен Prana-Bindu:

- **Окно:** `src/main/windows/pranaBinduWindow.ts`
  → `#/prana-bindu`.
- **IPC-префикс:** `pb:*`.
- **Хендлеры:** `src/main/ipcHandlers/pranaBinduHandlers.ts`.
- **Сервисы:** `src/main/services/pranaBindu/`
  (`core/`, `stillsuit/`, `crysknife/`, `mentat/`, `waterDiscipline/`,
  `spice/`, `melange/`).
- **Компоненты:** `src/components/PRANA_BINDU/`.
- **Страница:** `src/pages/PranaBinduPage/PranaBinduPage.tsx`.
- **Меню:** `pranaBinduWindowMenuTemplate` + пункт «Открыть Prana-Bindu».
- **Preload:** `electronAPI.pb.*`.

## Стек модуля

- Electron 44 + Electron Forge + Vite + TypeScript.
- React 19 + PrimeReact 10 + PrimeFlex + PrimeIcons.
- SQLite через `node:sqlite`.
- `fit-file-parser` — парсинг `.fit`.
- `fast-xml-parser` — парсинг `.tcx`.
- `@dofek/zepp-client` — резервный клиент Zepp.
- Fetch API — для dodofo.
- `safeStorage` — шифрование токенов.
- Ollama / DeepSeek (Playwright) — AI-рекомендации (11_RECOMMENDER).

## Схема данных (Melange, v3 — план)

- `meta`, `profile`, `movements`, `progressions`, `user_movement_state`.
- `strength_plans` / `strength_sessions`.
- `run_plans` / `run_facts` — факт бега; в v3 добавлены:
  - `gps_quality` (`good` | `poor` | `lost`);
  - `distance_source` (`gps` | `accelerometer` | `manual`);
  - `gps_coverage_pct` (REAL).
- `recovery_logs` — сон, HRV, пульс покоя.
- `progress_checks` — контрольный тест.
- `week_templates` / `week_template_days`.
- `sync_settings` — dodofo, zepp, google, mode, auto_*.
- `recommendations`.

Подробности — `08_MELANGE.md`.

## Big-6 — структура ступеней

6 движений × 10 ступеней. Схема подходов в `scheme_json`.
Дополнительно для бегунов (см. наблюдения с марафона):
упражнения для стоп, голени, квадрицепсов, кора.
Формально — часть Crysknife, но с фокусом на бег.

## Live-журнал во время бега (отдельный проект)

- **Стек:** Express.js + PWA (Vanilla JS или Preact).
- **Назначение:** ручная фиксация меток (км, время, пульс) во время
  бега без сложного UI.
- **UI:** три колеса (километр, время, пульс) + большая кнопка
  «Сохранить». Голосовой ввод опционально.
- **Offline-first:** IndexedDB + sync когда есть сеть.
- **Локальные правила:** пульс > 155 → оранжевый фон, > 165 → красный.
  Никакого LLM в момент бега (latency).
- **Интеграция:** экспорт JSON → импорт в Prana-Bindu.

## Правила работы

- Логика в `src/main/services/pranaBindu/` не должна импортировать
  Electron — готовность к будущей веб-версии.
- `safeStorage` — только в handler, не в сервисах.
- UI-тексты и комментарии — на русском.
- После каждого логического шага — `git commit`.
- Обновлять `PROJECT_STATE.md` при переключении чата.
- Не смешивать логику разных модулей в одном файле.
- Не трогать другие модули приложения
  (`osintHandlers`, `trainingHandlers`, `tradingAssistantHandlers`,
  `bondsHandlers`, `aiHandlers`, `tasksHandlers`, `gatewayHandlers`,
  `dashboardHandlers`).
- Не менять `marketDataBus`, `volumeProfileEngine`, `orderManager`,
  `scheduler`.
- Токены (`dodofo_token`, `zepp_credentials_json`, `zepp_app_token`,
  `google_token_json`) — только `safeStorage`, не логировать целиком.

## Что НЕ входит в модуль

- Fine-tuning моделей Ollama (это существующий `training:*`).
- Публичный релиз с именами из «Дюны» — только внутреннее использование.
- Мобильная версия Prana-Bindu — отложена.
- Live-журнал — отдельное приложение, не в Prana-Bindu.


=====================================

# Prana-Bindu — общий контекст модуля

## Что это

Prana-Bindu — новый модуль тренировок тела в составе многомодульного
приложения `wetothemoon-electron`. Строится с нуля, не пересекается
с существующим `training:*` (там fine-tuning Ollama, не про тело).

Модуль ведёт параллельно две линии:
- **Stillsuit** — марафонская подготовка (бег, пульс, темп, экономичность).
- **Crysknife** — силовая подготовка по Big-6 (6 движений × 10 ступеней).

Обе линии связаны взаимно: прогресс в одной влияет на другую.
Координирует их **Mentat** (календарь, периодизация),
**Water Discipline** (восстановление) — арбитр нагрузки,
**Spice** (аналитика, dodofo, Google Fit),
**Melange** (локальная БД `prana_bindu.db`),
**Prana-Bindu Core** (движок зон и 80/20).

## Цель пользователя

- Марафон 42,2 км 27.09.2026 (седьмой по счёту).
- Старт подготовки: 01.11.2026.
- Задача: снизить темп на марафоне и снизить пульс на заданном темпе.
- Параллельно — прогресс в Big-6 по ступеням калистеники.

## Методология

- **80/20**: ~80% объёма в зонах 1–2, ~20% в зонах 4–5.
- **SIRPOC** как каркас сезонной периодизации.
- **Big-6** (Convict Conditioning) как каркас силовой подготовки.
- **Взаимный прогресс**: силовые улучшают экономичность бега через
  жёсткость сухожилий и нейромышечную эффективность; бег улучшает
  восстановление между силовыми подходами через аэробную базу.
- **Прогрессия Big-6** — только при выполнении benchmark текущей ступени
  и при стабильном пульсе на контрольном темпе.
- **Water Discipline** может блокировать прогрессию при низком HRV
  или плохом сне.

## Источники данных

**Основной источник — dodofo.ru.**
- Токен создаётся в профиле пользователя, формат `dodofo_…`.
- Передаётся в заголовке `Authorization: Bearer dodofo_…`.
- Только чтение (GET), только данные владельца.
- Покрывает: поездки/пробежки (`/api/v1/activities`), секундные потоки
  и зоны Коггана (`/api/v1/activities/{id}/streams`), дневник здоровья
  (`/api/v1/wellness`, `/api/v1/activities/daily`), пороги атлета
  (`/api/v1/me/thresholds`), тренировочные зоны (`/api/v1/auth/me/zones`).
- Токен шифруется через `safeStorage` и хранится в `sync_settings`
  (`dodofo_token`).

**Резервный источник — Zepp (Amazfit) напрямую.**
- `dofek-zepp` через `@dofek/zepp-client` с автодетектом хоста
  (`regionDetector.ts`, перебор `api-user.zepp.com` → `-de2` → `-us2`).
- Используется, если dodofo по какой-то причине недоступен.
- `zepp-mcp` и `zeppbridge` — заглушки в реестре, реализации нет.

**Прочее:**
- **Google Fit API** — OAuth 2.0, через `@getstation/electron-google-oauth2`.
  Отложено, приоритет ниже dodofo.
- **Ручной ввод** — fallback.
- **Intervals.icu** — резервная альтернатива Strava.

## Внутренние имена модулей

| Имя                | Роль                                                       |
|--------------------|------------------------------------------------------------|
| Prana-Bindu Core   | Движок зон, 80/20, логика тренировочных блоков             |
| Stillsuit          | Марафон: пульс, темп, экономичность, дыхание               |
| Crysknife          | Big-6: сила, контроль, сухожилия, нейромышечная работа     |
| Mentat             | Календарь, периодизация, подводка к старту                 |
| Water Discipline   | Сон, HRV, гидратация, восстановление                       |
| Spice              | Аналитика, графики, dodofo, Google Fit                     |
| Melange            | Локальная БД модуля (`prana_bindu.db`)                     |

Публично эти имена не использовать — только как внутренние кодовые.

## Интеграция с существующим приложением

Проект: TypeScript + React 19 + Electron Forge + Vite + PrimeReact 10.
Существующие модули и их паттерны — см. OSINT (`SIETCH`, `osintHandlers`,
`osintWindow`, `DatabasePage`).

Куда встроен Prana-Bindu:

- **Окно:** `src/main/windows/pranaBinduWindow.ts`
  → `createPranaBinduWindow()` + `getPranaBinduWindow()`
  → маршрут `#/prana-bindu`.
- **IPC-префикс:** `pb:*`.
- **Хендлеры:** `src/main/ipcHandlers/pranaBinduHandlers.ts`.
- **Сервисы:** `src/main/services/pranaBindu/`
  (`core/`, `stillsuit/`, `crysknife/`, `mentat/`, `waterDiscipline/`,
  `spice/`, `melange/`).
- **Компоненты:** `src/components/PRANA_BINDU/`.
- **Страница:** `src/pages/PranaBinduPage/PranaBinduPage.tsx`.
- **Меню:** `pranaBinduWindowMenuTemplate` в `windowMenus.ts`
  + пункт «Открыть Prana-Bindu» в `mainMenuTemplate`.
- **Регистрация в `main.ts`:** `openMelange(...)` + `seedMelange(...)`
  + `registerPranaBinduHandlers()`.
- **Preload:** методы `pb:*` через `src/preload.ts` в `electronAPI.pb`.

## Стек модуля

- Electron 44 + Electron Forge + Vite + TypeScript.
- React 19 + PrimeReact 10 + PrimeFlex + PrimeIcons.
- SQLite через `node:sqlite` (встроен, без нативных зависимостей).
- `@dofek/zepp-client` — резервный клиент Zepp.
- Fetch API — для dodofo (без SDK).
- `safeStorage` — шифрование токенов и учётных данных.
- Ollama (HTTP) — локальные AI-рекомендации.
- Playwright — DeepSeek-провайдер (по образцу `gateway/deepseekService.ts`).

## Схема данных (Melange, актуальная версия — v2)

- `meta` — версия схемы.
- `profile` — возраст, max_hr, lthr, resting_hr, weight_kg, дата марафона.
- `movements` — 6 движений Big-6 (id, code, name, order_index).
- `progressions` — 10×6 ступеней (заполняются в 05_CRYSKNIFE).
- `user_movement_state` — текущая ступень пользователя по движению.
- `strength_plans` / `strength_sessions` — план и факт силовых.
- `run_plans` / `run_facts` — план и факт бега; `run_facts.external_id`
  для дедупликации из источника.
- `recovery_logs` — сон, HRV, пульс покоя, светофор.
- `progress_checks` — контрольный тест (пульс + benchmark).
- `week_templates` / `week_template_days` — типовые недели.
- `sync_settings` — настройки синхронизации:
  - `source`, `mode`, `auto_interval_min`, `auto_on_start`;
  - `google_token_json` (шифр.);
  - `zeppbridge_path`;
  - `zepp_provider`, `zepp_fallback_provider`, `zepp_credentials_json`
    (шифр.), `zepp_auth_host`, `zepp_data_host`, `zepp_app_token` (шифр.),
    `zepp_user_id`, `zepp_last_sync_at`, `zepp_last_sync_status`;
  - `dodofo_token` (шифр.), `dodofo_user_id`, `dodofo_username`,
    `dodofo_last_sync_at`, `dodofo_last_sync_status`;
  - `last_sync_at`, `last_sync_status`.
- `recommendations` — AI-рекомендации и их статус.

## Big-6 — структура ступеней

6 движений: отжимания, приседания, подтягивания, подъём ног, мостик, стойка.
Каждое движение — 10 ступеней. Схема подходов в `scheme_json`:
`[{set:1, reps:N}, {set:2, reps:N}, {set:3, reps:N}]`
плюс `repeat_count` (1 для обычных, 2 для ступеней с суффиксом `* 2`).
Для стойки — `is_time_based: true`, значения в секундах.

Список ступеней — в `05_CRYSKNIFE.md`.

## Правила работы

- Логика в `src/main/services/pranaBindu/` не должна импортировать Electron —
  готовность к будущей веб-версии.
- `safeStorage` вызывается **только в handler** (`pranaBinduHandlers.ts`),
  никогда в сервисах.
- UI-тексты и комментарии — на русском.
- После каждого логического шага — `git commit`.
- Обновлять `PROJECT_STATE.md` при переключении чата.
- Не смешивать логику разных модулей (Stillsuit / Crysknife / Mentat / ...)
  в одном файле.
- Не трогать другие модули приложения
  (`osintHandlers`, `trainingHandlers`, `tradingAssistantHandlers`,
  `bondsHandlers`, `aiHandlers`, `tasksHandlers`, `gatewayHandlers`,
  `dashboardHandlers`).
- Не менять `marketDataBus`, `volumeProfileEngine`, `orderManager`, `scheduler`.
- Токены (`dodofo_token`, `zepp_credentials_json`, `zepp_app_token`,
  `google_token_json`) — только через `safeStorage`, не логировать
  целиком, не коммитить.

## Что НЕ входит в модуль

- Fine-tuning моделей Ollama (это существующий `training:*`).
- Публичный релиз с именами из «Дюны» — только внутреннее использование.
- Мобильная версия — отложена (архитектура готова, реализация позже).


=====================================

# Prana-Bindu — общий контекст модуля

## Что это

Prana-Bindu — новый модуль тренировок тела в составе многомодульного
приложения `wetothemoon-electron`. Строится с нуля, не пересекается
с существующим `training:*` (там fine-tuning Ollama, не про тело).

Модуль ведёт параллельно две линии:
- **Stillsuit** — марафонская подготовка (бег, пульс, темп, экономичность).
- **Crysknife** — силовая подготовка по Big-6 (6 движений × 10 ступеней).

Обе линии связаны взаимно: прогресс в одной влияет на другую.
Координирует их **Mentat** (календарь, периодизация),
**Water Discipline** (восстановление) — арбитр нагрузки,
**Spice** (аналитика, Google Fit, ZeppBridge),
**Melange** (локальная БД `prana_bindu.db`),
**Prana-Bindu Core** (движок зон и 80/20).

## Цель пользователя

- Марафон 42,2 км 27.09.2026 (седьмой по счёту).
- Старт подготовки: 01.11.2026.
- Задача: снизить темп на марафоне и снизить пульс на заданном темпе.
- Параллельно — прогресс в Big-6 по ступеням калистеники.

## Методология

- **80/20**: ~80% объёма в зонах 1–2, ~20% в зонах 4–5.
- **SIRPOC** как каркас сезонной периодизации.
- **Big-6** (Convict Conditioning) как каркас силовой подготовки.
- **Взаимный прогресс**: силовые улучшают экономичность бега через
  жёсткость сухожилий и нейромышечную эффективность; бег улучшает
  восстановление между силовыми подходами через аэробную базу.
- **Прогрессия Big-6** — только при выполнении benchmark текущей ступени
  и при стабильном пульсе на контрольном темпе.
- **Water Discipline** может блокировать прогрессию при низком HRV
  или плохом сне.

## Источники данных

- **Google Fit API** — OAuth 2.0, через `@getstation/electron-google-oauth2`.
- **Zepp (Amazfit)** — три провайдера с автодетектом регионального хоста:
  - `dofek-zepp` — прямой TypeScript-клиент `@dofek/zepp-client`
    (основной). Вход через `signInToZepp` с перебором хостов
    `api-user.zepp.com` → `api-user-de2.zepp.com` → `api-user-us2.zepp.com`.
    Для запросов к данным — `api-mifit.zepp.com` (или `-de2`/`-us3`
    в зависимости от рабочего хоста аутентификации).
  - `zepp-mcp` — локальный MCP-сервер (резервный).
  - `zeppbridge` — локальный десктопный мост с CLI, экспорт в JSON/CSV/GPX
    (резервный).
- **Ручной ввод** — fallback.
- **Intervals.icu** — резервная альтернатива Strava.

## Внутренние имена модулей

| Имя                | Роль                                                       |
|--------------------|------------------------------------------------------------|
| Prana-Bindu Core   | Движок зон, 80/20, логика тренировочных блоков             |
| Stillsuit          | Марафон: пульс, темп, экономичность, дыхание               |
| Crysknife          | Big-6: сила, контроль, сухожилия, нейромышечная работа     |
| Mentat             | Календарь, периодизация, подводка к старту                 |
| Water Discipline   | Сон, HRV, гидратация, восстановление                       |
| Spice              | Аналитика, графики, интеграция с Google Fit и Zepp         |
| Melange            | Локальная БД модуля (`prana_bindu.db`)                     |

Публично эти имена не использовать — только как внутренние кодовые.

## Интеграция с существующим приложением

Проект: TypeScript + React 19 + Electron Forge + Vite + PrimeReact 10.
Существующие модули и их паттерны — см. OSINT (`SIETCH`, `osintHandlers`,
`osintWindow`, `DatabasePage`).

Куда встраивается Prana-Bindu:

- **Окно:** `src/main/windows/pranaBinduWindow.ts`
  → фабрика `createPranaBinduWindow()` + геттер `getPranaBinduWindow()`.
  → маршрут `#/prana-bindu`.
- **IPC-префикс:** `pb:*` (не трогаем `training:*`).
- **Хендлеры:** `src/main/ipcHandlers/pranaBinduHandlers.ts`.
- **Сервисы:** `src/main/services/pranaBindu/`
  (подпапки: `core/`, `stillsuit/`, `crysknife/`, `mentat/`,
  `waterDiscipline/`, `spice/`, `melange/`).
- **Компоненты:** `src/components/PRANA_BINDU/`
  (по образцу `src/components/SIETCH/`).
- **Страница:** `src/pages/PranaBinduPage/PranaBinduPage.tsx`.
- **Меню:** `pranaBinduWindowMenuTemplate` в `windowMenus.ts`
  + пункт «Открыть Prana-Bindu» в `mainMenuTemplate`
  + обработчик `click` в `main.ts` (по образцу OSINT).
- **Регистрация в `main.ts`:** `registerPranaBinduHandlers()`.
- **Preload:** экспонировать методы `pb:*` через общий `src/preload.ts`
  в объект `electronAPI.pb`.

## Стек модуля

- Electron 44 + Electron Forge + Vite + TypeScript.
- React 19 + PrimeReact 10 + PrimeFlex + PrimeIcons.
- SQLite через `node:sqlite` (встроен, без нативных зависимостей).
- `@getstation/electron-google-oauth2` — OAuth для Google Fit.
- `@dofek/zepp-client` — клиент Zepp (основной провайдер).
- `child_process` — вызов CLI ZeppBridge и `zepp-mcp`.
- Ollama (HTTP) — локальные AI-рекомендации.
- Playwright — DeepSeek-провайдер (по образцу `gateway/deepseekService.ts`).

## Схема данных (черновик Melange)

Таблицы в `prana_bindu.db`:

- `movements` — 6 движений Big-6 (id, code, name, order_index).
- `progressions` — 10×6 ступеней (id, movement_id, level, name,
  scheme_json, is_time_based, repeat_count, notes).
- `user_movement_state` — текущая ступень пользователя по движению.
- `strength_plans` / `strength_sessions` — план и факт силовых.
- `run_plans` / `run_facts` — план и факт бега.
- `recovery_logs` — сон, HRV, пульс покоя, светофор.
- `progress_checks` — общий контрольный тест (пульс + benchmark).
- `week_templates` / `week_template_days` — типовые недели.
- `sync_settings` — настройки синхронизации. Поля (полный список — в `08_MELANGE.md`):
  `source`, `mode`, `zepp_provider`, `zepp_fallback_provider`,
  `zepp_credentials_json` (шифруется `safeStorage`),
  `zepp_auth_host`, `zepp_data_host`,
  `zepp_app_token` (шифруется `safeStorage`), `zepp_user_id`,
  `zepp_last_sync_at`, `zepp_last_sync_status`.
- `recommendations` — AI-рекомендации и их статус.

## Big-6 — структура ступеней

6 движений: отжимания, приседания, подтягивания, подъём ног, мостик, стойка.
Каждое движение — 10 ступеней. Схема подходов в `scheme_json`:
`[{set:1, reps:N}, {set:2, reps:N}, {set:3, reps:N}]`
плюс `repeat_count` (1 для обычных, 2 для ступеней с суффиксом `* 2`).
Для стойки — `is_time_based: true`, значения в секундах.

Список ступеней (по таблице пользователя) — в `05_CRYSKNIFE.md`.

## Правила работы

- Логика в `src/main/services/pranaBindu/` не должна импортировать Electron —
  готовность к будущей веб-версии.
- UI-тексты и комментарии — на русском.
- После каждого логического шага — `git commit`.
- Обновлять `PROJECT_STATE.md` при переключении чата.
- Не смешивать логику разных модулей (Stillsuit / Crysknife / Mentat / ...)
  в одном файле.
- Не трогать другие модули приложения
  (`osintHandlers`, `trainingHandlers`, `tradingAssistantHandlers`,
  `bondsHandlers`, `aiHandlers`, `tasksHandlers`, `gatewayHandlers`,
  `dashboardHandlers`).
- Не менять `marketDataBus`, `volumeProfileEngine`, `orderManager`, `scheduler`.
- Учётные данные Zepp (`zepp_credentials_json`, `zepp_app_token`) —
  только через `safeStorage`, не логировать, не коммитить.

## Что НЕ входит в модуль

- Fine-tuning моделей Ollama (это существующий `training:*`).
- Публичный релиз с именами из «Дюны» — только внутреннее использование.
- Мобильная версия — отложена (архитектура готова, реализация позже).



=================================
old version
=================================


# Prana-Bindu — общий контекст модуля

## Что это

Prana-Bindu — новый модуль тренировок тела в составе многомодульного
приложения `wetothemoon-electron`. Строится с нуля, не пересекается
с существующим `training:*` (там fine-tuning Ollama, не про тело).

Модуль ведёт параллельно две линии:
- **Stillsuit** — марафонская подготовка (бег, пульс, темп, экономичность).
- **Crysknife** — силовая подготовка по Big-6 (6 движений × 10 ступеней).

Обе линии связаны взаимно: прогресс в одной влияет на другую.
Координирует их **Mentat** (календарь, периодизация),
**Water Discipline** (восстановление) — арбитр нагрузки,
**Spice** (аналитика, Google Fit, ZeppBridge),
**Melange** (локальная БД `prana_bindu.db`),
**Prana-Bindu Core** (движок зон и 80/20).

## Цель пользователя

- Марафон 42,2 км 27.09.2026 (седьмой по счёту).
- Старт подготовки: 01.11.2026.
- Задача: снизить темп на марафоне и снизить пульс на заданном темпе.
- Параллельно — прогресс в Big-6 по ступеням калистеники.

## Методология

- **80/20**: ~80% объёма в зонах 1–2, ~20% в зонах 4–5.
- **SIRPOC** как каркас сезонной периодизации.
- **Big-6** (Convict Conditioning) как каркас силовой подготовки.
- **Взаимный прогресс**: силовые улучшают экономичность бега через
  жёсткость сухожилий и нейромышечную эффективность; бег улучшает
  восстановление между силовыми подходами через аэробную базу.
- **Прогрессия Big-6** — только при выполнении benchmark текущей ступени
  и при стабильном пульсе на контрольном темпе.
- **Water Discipline** может блокировать прогрессию при низком HRV
  или плохом сне.

## Источники данных

- **Google Fit API** — OAuth 2.0, через `@getstation/electron-google-oauth2`.
- **ZeppBridge** (Amazfit) — через CLI (`child_process`), экспорт в JSON/CSV/GPX.
- **Ручной ввод** — fallback.
- **Intervals.icu** — резервная альтернатива Strava.

## Внутренние имена модулей

| Имя                | Роль                                                       |
|--------------------|------------------------------------------------------------|
| Prana-Bindu Core   | Движок зон, 80/20, логика тренировочных блоков             |
| Stillsuit          | Марафон: пульс, темп, экономичность, дыхание               |
| Crysknife          | Big-6: сила, контроль, сухожилия, нейромышечная работа     |
| Mentat             | Календарь, периодизация, подводка к старту                 |
| Water Discipline   | Сон, HRV, гидратация, восстановление                       |
| Spice              | Аналитика, графики, интеграция с Google Fit и ZeppBridge   |
| Melange            | Локальная БД модуля (`prana_bindu.db`)                     |

Публично эти имена не использовать — только как внутренние кодовые.

## Интеграция с существующим приложением

Проект: TypeScript + React 19 + Electron Forge + Vite + PrimeReact 10.
Существующие модули и их паттерны — см. OSINT (`SIETCH`, `osintHandlers`,
`osintWindow`, `DatabasePage`).

Куда встраивается Prana-Bindu:

- **Окно:** `src/main/windows/pranaBinduWindow.ts`
  → фабрика `createPranaBinduWindow()` + геттер `getPranaBinduWindow()`.
  → маршрут `#/prana-bindu`.
- **IPC-префикс:** `pb:*` (не трогаем `training:*`).
- **Хендлеры:** `src/main/ipcHandlers/pranaBinduHandlers.ts`.
- **Сервисы:** `src/main/services/pranaBindu/`
  (подпапки: `core/`, `stillsuit/`, `crysknife/`, `mentat/`,
  `waterDiscipline/`, `spice/`).
- **Компоненты:** `src/components/PRANA_BINDU/`
  (по образцу `src/components/SIETCH/`).
- **Страница:** `src/pages/PranaBinduPage/PranaBinduPage.tsx`.
- **Меню:** `pranaBinduWindowMenuTemplate` в `windowMenus.ts`
  + пункт «Открыть Prana-Bindu» в `mainMenuTemplate`
  + обработчик `click` в `main.ts` (по образцу OSINT).
- **Регистрация в `main.ts`:** `registerPranaBinduHandlers()`.
- **Preload:** экспонировать методы `pb:*` через общий `src/preload.ts`
  в объект `electronAPI`.

## Стек модуля

- Electron 44 + Electron Forge + Vite + TypeScript.
- React 19 + PrimeReact 10 + PrimeFlex + PrimeIcons.
- SQLite через `node:sqlite` (встроен, без нативных зависимостей).
- `@getstation/electron-google-oauth2` — OAuth для Google Fit.
- `child_process` — вызов CLI ZeppBridge.
- Ollama (HTTP) — локальные AI-рекомендации.
- Playwright — DeepSeek-провайдер (по образцу `gateway/deepseekService.ts`).

## Схема данных (черновик Melange)

Таблицы в `prana_bindu.db`:

- `movements` — 6 движений Big-6 (id, code, name, order_index).
- `progressions` — 10×6 ступеней (id, movement_id, level, name,
  scheme_json, is_time_based, repeat_count, notes).
- `user_movement_state` — текущая ступень пользователя по движению.
- `strength_plans` / `strength_sessions` — план и факт силовых.
- `run_plans` / `run_facts` — план и факт бега.
- `recovery_logs` — сон, HRV, пульс покоя, светофор.
- `progress_checks` — общий контрольный тест (пульс + benchmark).
- `week_templates` / `week_template_days` — типовые недели.
- `sync_settings` — настройки синхронизации.
- `recommendations` — AI-рекомендации и их статус.

## Big-6 — структура ступеней

6 движений: отжимания, приседания, подтягивания, подъём ног, мостик, стойка.
Каждое движение — 10 ступеней. Схема подходов в `scheme_json`:
`[{set:1, reps:N}, {set:2, reps:N}, {set:3, reps:N}]`
плюс `repeat_count` (1 для обычных, 2 для ступеней с суффиксом `* 2`).
Для стойки — `is_time_based: true`, значения в секундах.

Список ступеней (по таблице пользователя) — в `05_CRYSKNIFE.md`.

## Правила работы

- Логика в `src/main/services/pranaBindu/` не должна импортировать Electron —
  готовность к будущей веб-версии.
- UI-тексты и комментарии — на русском.
- После каждого логического шага — `git commit`.
- Обновлять `PROJECT_STATE.md` при переключении чата.
- Не смешивать логику разных модулей (Stillsuit / Crysknife / Mentat / ...)
  в одном файле.
- Не трогать другие модули приложения
  (`osintHandlers`, `trainingHandlers`, `tradingAssistantHandlers`,
  `bondsHandlers`, `aiHandlers`, `tasksHandlers`, `gatewayHandlers`,
  `dashboardHandlers`).
- Не менять `marketDataBus`, `volumeProfileEngine`, `orderManager`, `scheduler`.

## Что НЕ входит в модуль

- Fine-tuning моделей Ollama (это существующий `training:*`).
- Публичный релиз с именами из «Дюны» — только внутреннее использование.
- Мобильная версия — отложена (архитектура готова, реализация позже).