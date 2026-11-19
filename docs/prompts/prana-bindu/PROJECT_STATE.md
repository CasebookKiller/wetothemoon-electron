# Project State — Prana-Bindu

> Обновлено: 2026-10-29

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu

## Статус

- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — 99%. dodofo GPS 264/264. Выявлено отсутствие продвинутых метрик (VO2max, SpO2) у dodofo (возвращается null).
- **08 (Melange)** — v1 → **v36**.
- **11 (AI)** — **активен**. Разработка ИИ-Тренера на базе Gateway.
- **16 (Exercise Graph)** — **активен**. C.1–C.3, D закрыты.
- **18 (Картографический редактор)** — **активен**. C.1–C.13 закрыты (включая Цепочки и Direction-aware coverage).
- **Mentat (03)** — ~80%.
- **10 (Duna)** — ~80%. **Главная страница переделана в Dashboard-хаб**. Добавлены виджеты и диалоги (`TrainingDialog`, `HealthDialog`).

## Ключевые цифры (2026-10-29)

| Источник | Записей |
|---|---|
| run_facts | ~2530 |
| run_streams (.msgpack) | ~200 МБ, 264/264 dodofo с GPS |
| recovery_logs | 1000+ |
| plan_events | 13+ |
| chains | 1+ |
| Melange schema_version | **36** |

## Что сделано за 2026-10-22..29

### Картографический редактор (18)
- **C.12 (Цепочки)**: БД v32/v33 (`chains`, `chain_slots`). `evaluateChain` с `aggregate='sum'` и `direction`. UI (вкладка, плавающая панель, бейджи).
- **C.13 (Direction-aware coverage)**: Учет Bearing при прохождении КП. Настраиваемый допуск (`directionToleranceDeg`). Out-and-back для linear.

### Здоровье, Вода, Вес, Питание
- **БД v31**: таблицы `water_logs`, `weight_logs`, `nutrition_logs`.
- **UI**: `NutritionPanel` с вкладками (вода, вес, питание). `DaySummary` показывает воду (с цветовой индикацией).
- **BMR**: В профиль добавлены Рост, Пол, Дата рождения (расчет BMR по Миффлину).

### Dashboard-хаб (14)
- Главная страница переписана. Старые панели вынесены в полноэкранные диалоги.
- **Виджеты**: «Тренировки» (последняя пробежка + план), «Здоровье и Вода» (RHR, сон, CTL/ATL, прогресс воды).
- **Аналитика**: Создан `HealthDashboardDialog` с графиками Chart.js (Вес, Вода+Объем, Сон+Восстановление, Форма+Усталость).

### Рефакторинг и стили
- Внедрен компонент `AppIcon` (частично).
- Починены все CSS-флексы в модальных окнах.
- Кастомные иконки SVG (Bootstrap) для виджетов здоровья.

## ADR
*(Изменения не вносились, действуют предыдущие)*

## Ближайшие задачи

1. **11 (AI-Тренер)**: Создание `contextBuilder.ts` и `AiCoachDialog`.
2. **07 (Spice)**: Zepp-direct для получения VO2max, SpO2, HRV.
3. **08 (Melange v37)**: `run_facts.training_load` (вынести из `raw_json`).
4. **18 (C.7)**: Игровой режим «Территория» (полигоны, захват КП).

## Что НЕ делаем сейчас
- Google Fit.
- 60 ступеней Big-6.
- Weighted / Ring / Band из Thenics.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-10-21

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu

## Статус

- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — 99%. Источники: dodofo, Strava-архив, intervals.icu,
  Zepp FIT-папка. dodofo GPS 264/264.
- **08 (Melange)** — v1 → **v32**.
  Добавлены: `auto_providers_json` (v22), `streams_loaded` (v23), 
  `auto_range_days` (v24), `threshold_history` (v25).
- **16 (Exercise Graph)** — **активен**. C.1–C.3, D закрыты.
  Модель узлов, custom nodes, раскраска через CSS-переменные,
  floating edges, сохранение позиций. В графе — 76 узлов, 210 рёбер
  (Wade + 4 программы).
- **18 (Картографический редактор)** — **активен**. Этапы A+B+C закрыты.
  Реализованы: Редактор точек (drag/add/delete), RDP-оптимизация, Разделение атома на части, Автоопределение пробежек (used/similar/unused, контрольные точки для подсчета кругов), Секции в списке треков, Фильтр по эталону, Режим «Все эталоны» с кастомным стилем линий.
- **Mentat (03)** — ~80%. Каталог (22 прогрессии + ~70 named + 206 Thenics).
  Ladder для 6 категорий. Prehab (21 named + 2 программы).
  Реверс-маппинг. Учёт нагрузки. Equivalence Mapper.
  **Интеграция с графом — в работе** (палитра, редактор).
- **10 (UI, Duna)** — ~70%. PANELS/ (8 панелей), RunsPanel с двумя видами,
  AppDialog / AppIcon / CloseIcon — универсальные компоненты.
- **02 Core, 04 Stillsuit, 05 Crysknife, 06 Water Discipline** — не начаты.

## Ключевые цифры (2026-10-14)

| Источник | Записей |
|---|---|
| run_facts | ~2530 |
| run_streams (.msgpack) | ~200 МБ, 264/264 dodofo с GPS |
| recovery_logs | 1000+ |
| plan_events | 13+ |
| workout_sessions | ~10 |
| exercise_progress | ~10 |
| equivalences (DB) | 1 |
| THENICS_CATALOG | 206 |
| NAMED_EXERCISES | ~70 |
| PROGRESSIONS_CATALOG | 23 × 10 |
| Exercise Graph (seed Wade) | 76 узлов / 210 рёбер |

**Melange schema_version:** 32.

## Что сделано за 2026-10-06..14

### Spice (задача A, B, C, D, E, F)
- dodofo GPS из `Activity.polyline`, mass-resync 264/264.
- `pb:day-load-summary`, TSS в превью, подсветка 1.5× / 2.5×.
- Wellness v20: `sources_json`, `calories_*`, `body_fat_pct`.
- Модель A: RunsTableFlat + RunsTableGrouped.
- Автосинхронизация `pb:auto-sync-on-start`.
- Реверс-маппинг ICU (`workoutMatcher.ts`).

### Melange
- v20 — recovery_logs + sources_json / calories / body_fat.
- v21 — таблица `equivalences`.

### Exercise Graph (16)
- **Модель.** Pattern → Canonical → Exercise. Program, Catalog — отдельные узлы.
- **Seed.** Только Wade в JSON: 5 паттернов + 1 каталог + 6 канонов +
  60 concrete + 4 программы.
- **Custom nodes (C.1).** `exerciseNode` / `patternNode` / `programNode` /
  `catalogNode`. Структура header / body / footer. Иконки-буквы (PU / PL / HS
  / …), badge уровня, footer-текст (N уровней / N канонов / N упражнений).
- **Раскраска (C.2).** CSS-переменные `--node-fill` / `--node-stroke` /
  `--node-text` / `--node-badge-bg` из `viewModel.ts`. Удалены 15+
  `!important`-правил.
- **Рёбра (C.3).** `FloatingEdge` — smoothstep для `progresses-to` /
  `variant-of` / `requires`, bezier для `instance-of` / `belongs-to` /
  `used-in` / `equivalent-to`. Адаптивные точки подключения.
- **Позиции (D).** `pos: {x, y}` в JSON + `posOverrides` в state.
  Сохраняется при переключении Слои↔Круг и при перезагрузке.
- **Палитра.** Три состояния: active / linked / candidate. Клик по Thenics →
  диалог «как группу» / «как упражнение в группу».
- **Редактор узлов.** `+ Паттерн` / `+ Группа` / `+ Упражнение` в тулбаре.
  `✏ Изменить` / `🗑 Удалить` в DetailPanel.
- **Редактор рёбер.** Протягивание с диалогом типа. X в списке. Клик по
  ребру → редактирование (тип, target, note, удаление).
- **Каталог.** Пол Уэйд: 6 канонов · 60 уровней.

### Mentat
- Парсер: `findProgressionByIcuName` — `Pull-ups W2` → `pullup`, level 2.
- `CatalogPickerDialog` — ручной выбор из каталога для свободных сессий.
- `AppDialog` / `AppIcon` / `CloseIcon` — универсальные компоненты.

### Картографический редактор (18) — ЗАКРЫТ (Story Generator)
- **`RouteMapEditor.tsx`**: OSM-тайлы с CSS-фильтрами. Градиентный трек 
  (пульс/скорость/высота), сохранение слоёв и стилей в `localStorage`.
- **`StoryGeneratorDialog.tsx`**: Полностью переписан на **живую карту**. 
  Раньше каждый сдвиг вызывал `toDataURL` (лаги), теперь поверх живой карты 
  лежит прозрачный `<canvas>` с текстом и градиентом.
- **Камера**: `map.cameraForBounds` вписывает трек **строго по ширине** экрана. 
  Дополнительный зум и сдвиг применяются абсолютно (`jumpTo`), без накопления.
- **Сохранение**: Настройки (padding, zoom, pan, lineWidth) сохраняются 
  в `localStorage` (`pb.story.mapSettings.v2`) в привязке к ID трека и к местности (`lat,lng`).
- **Экспорт**: Склейка `map.getCanvas()` и текстового канваса по кнопке «Скачать PNG».
- **UI**: Починены скроллбары в диалогах (`.pb-story-sidebar`, `body[data-module]`), 
  кнопка «Сбросить» через `resetCounter`.

### Рефакторинг
- Единые стили закрытия в PB и OSINT через `--close-icon-color` +
  `body[data-module]`.
- `--app-dialog-accent` для диалогов.

### Block A (Синхронизация) — ЗАКРЫТ
- A.8 — фоновый автосинк с UI-событиями.
- A.9 — добавлены Strava FIT и Пороги/Зоны в автосинк.

### Block B (Duna) — ЗАКРЫТ
- B.1 — CatalogPicker (Избранное, alreadyPicked, без табов).
- Редизайн FullWeek (центрирование заголовка, sticky).

### Thresholds (Core) — В РАБОТЕ
- v25: таблица `threshold_history`.
- Сервис `computeThresholds`: LTHR (20-мин тест), HRmax (пик), RestHR (медиана).
- UI: кнопка «Рассчитать из фактов» в ProfilePanel (с выбором окна 30/90/180/365 дней).


## ADR

### 2026-10-14 — smithrun как отдельный каталог
- `smithrun.graph.json` — **весь кастом**: новые паттерны, каноны,
  упражнения, связи, overrides.
- **Вариант B:** seed + smithrun = итоговый граф. Никаких отдельных
  `graph.user.json` — всё в smithrun.
- Манифест `manifest.json` — подключение / отключение каталогов.
- Каталоги в **отдельных JSON** (`wade.graph.json`, `cali.graph.json`, …),
  одинаковый формат `GraphJson`.
- `enabled: false` в манифесте → каталог не читается, узлы не создаются,
  рёбра к нему отфильтровываются.

### 2026-10-09 — Exercise Graph (Melange Graph v1)
- Граф — первичная модель. `equivalences` — seed + DB overrides.
- Узлы: `pattern / exercise / modality / catalog / tissue / skill / program`.
- Рёбра: 14 типов (см. `16_GRAPH.md`).
- Difficulty отложена. `smithrun.ts` → `derivedProgressions.ts` (в разработке).

## Открытые вопросы

1. **Каталоги в отдельных JSON** — задача B. Концепция согласована.
2. **Миграция существующих каталогов** (Cali / Runner / Named / Thenics)
   в JSON — задача B.
3. **SVG-иконки** вместо буквенных (PU / PL / …).
4. **Melange v22** — `run_facts.training_load`.
5. **Mentat ↔ Graph integration** — `requires` / `variant-of` в генераторе.
6. **Zepp-direct** — потоковые данные о сне.
7. **Бегущая строка** — состав и место.
8. **Кеширование тайлов карты** — перенос на Electron `protocol.handle`. 
   Попытки через IndexedDB/`addProtocol` в рендерере ломают WebGL (черный экран).

## Ближайшие задачи

1. **B** — миграция каталогов в JSON + манифест.
2. **SVG-иконки** — 20 ключей в `assets/icons/exercises/`.
3. **Melange v22** — `training_load` в `run_facts`.
4. **Mentat ↔ Graph** — генератор использует связи.
5. **Story Generator (18)** — кеширование тайлов на диск (Electron), 
   добавление тестовых сегментов (Map Segments) для Thresholds.
1. **P3 — Разбор 1015-го забега:** создание недостающих атомов.
2. **C.6 — Сохранение одиночного трека:** кнопка «Сделать эталоном» для текущей пробежки.
3. **Игровой режим (C.7):** проектирование механики и БД для КП и полигонов.

## Что НЕ делаем сейчас
- Google Fit.
- 60 ступеней Big-6.
- Weighted / Ring / Band из Thenics.
- Difficulty-шкала.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-10-09

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu

## Статус

- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — 100%. Закрыты A.8 (фоновый автосинк), A.9 (Strava FIT + Пороги в автосинке).
- **08 (Melange)** — v1 → **v25**. Добавлены `threshold_history`, `streams_loaded`, `auto_range_days` и др.
- **18 (Картографический редактор)** — **активен**. Этапы A+B+C закрыты.
  Реализованы: Редактор точек (drag/add/delete), RDP-оптимизация, Разделение атома на части, Автоопределение пробежек (used/similar/unused, контрольные точки для подсчета кругов), Секции в списке треков, Фильтр по эталону, Режим «Все эталоны», Мульти-графики (ICU-style) с наведением, Сохранение одиночного трека как эталона. Группировка атомов.
- **Thresholds (Core)** — в работе. Сервис расчёта по потокам (LTHR 20-мин, HRmax, RestHR), миграция v25, UI в ProfilePanel.
- **16 (Exercise Graph)** — активен. C.1–C.3, D закрыты.
- **Mentat (03)** — ~80%. Каталог, Ladder, Prehab, реверс-маппинг, Smithrun.
- **10 (UI, Duna)** — 75%. Вынесены COMMON-стили (кнопки, инпуты, диалоги, таблицы), обновлён `FullWeek`, создан картографический редактор.
- **02 Core, 04 Stillsuit, 05 Crysknife, 06 Water Discipline** — не начаты.

## Ключевые цифры (2026-10-09)

| Источник | Записей |
|---|---|
| run_facts | ~2530 |
| run_streams (.msgpack) | ~200 МБ, 264/264 dodofo с GPS |
| recovery_logs | 1000+ |
| plan_events | 13+ |
| workout_sessions | ~10 |
| exercise_progress | ~10 |
| equivalences | 1 |
| THENICS_CATALOG | 206 |
| NAMED_EXERCISES | ~70 |
| PROGRESSIONS_CATALOG | 22 × 10 |

**Melange schema_version:** 21.

## Что сделано за 2026-10-06..09

### Задача A — dodofo GPS
Из `Activity.polyline`, второй запрос в `fetchStreams`, 264/264.

### Задача B — учёт нагрузки
`pb:day-load-summary`, TSS в превью программ, подсветка 1.5× / 2.5× от
медианы 28 дней. Только бег.

### Задача C — Wellness v20
`sources_json`, `calories_active/total`, `body_fat_pct`. `auto_source = name`.
Русификация всех секций. Секция «Энергия».

### Задача D — Модель A
`RunsPanel/RunsTableFlat` + `RunsTableGrouped` (rowGroupMode + progressive
loading). Переключатель вида.

### Задача E — Автосинхронизация
`pb:auto-sync-on-start` — единственный флаг `autoOnStart`, антидребезг 6 ч.
Синкает workouts + wellness за 7 дней. `AutoSyncPanel` встроен в SyncPanel.

### Задача F — Реверс-маппинг ICU
`workoutMatcher.ts`. Три уровня `full / partial / none`.
Нормализация имён (W/L, L/R, дефисы). `aliases` в каталоге.
241 / 46 / 77 по 25 шаблонам. Реальных `none` — 3 движения.

### Thenics
- `THENICS_CATALOG` — 206 движений.
- Melange v21: `equivalences`.
- `EquivalenceMapperPanel` — вкладка «Соответствия», фильтры по уровню
  и мышцам, счётчик «N/206» в заголовке вкладки.
- `useEquivalencesMap` — хук, показ «≈ Thenics X» в `DayDrawer`
  и `WadeProgramsPanel`.
- Баннер «Thenics не размечены» на панели «План» (мягкая альтернатива
  автооткрытию; localStorage `pb.equivBanner.hiddenUntil`).

### Prehab (G)
- 21 named в `prehab`: mobility (9), feet/ankle (4), knees/hips (4),
  shoulders/spine (4).
- 2 программы: `prehab-mobility`, `prehab-shoulders`.

### Рефакторинг
- `PANELS/`: ProfilePanel, ConnectionsPanel, AutoSyncPanel, SyncPanel,
  ImportPanel, WellnessPanel, TrainingTabs, RunsPanel.
- `PranaBinduPage.tsx` — ~700 строк, чистая композиция.

## Что сделано за 2026-10-18..20

### Block A (Синхронизация) — ЗАКРЫТ
- **A.8** — фоновый автосинк с UI-событиями (`pb:auto-sync-start` / `complete`).
- **A.9** — добавлены `strava-fit` (импорт из папки) и `thresholds` (пороги/зоны) в фоновый автосинк.

### Thresholds (Core) — В РАБОТЕ
- **Melange v25** — таблица `threshold_history` (история расчётов).
- **Сервис `computeThresholds`**: LTHR (20-мин тест), HRmax (пик), RestHR (медиана).
- **UI**: кнопка «Рассчитать из фактов» в ProfilePanel с выбором окна (30/90/180/365 дней).

### Картографический редактор (Duna) — ЭТАП A+B
- **`RouteMapEditor.tsx`** — полноэкранный редактор с группировкой источников, ленивой подгрузкой списка, standalone-режимом и переключением между источниками.
- **Слои карты** — возможность добавлять/удалять/настраивать до N растровых слоёв.
- **Фильтры слоёв** — opacity, brightness, saturation, contrast, hue-rotate. Всё через `--module-accent` и быстрые слайдеры (без ререндера React).
- **Настройки трека** — цвет, толщина, прозрачность, «свечение».
- **Градиент по данным** — раскраска трека по пульсу, скорости или высоте с выбором палитры (HR zones, Thermal, Viridis, Prana-Bindu accent).
- **Исправления**: склейка дублей источников в `groupRunFacts`, отрезание суффиксов ` (2)` от FIT-файлов при импорте, фикс чтения ICU-потоков (они сохраняются как `source='fit'`).

### CSS-библиотека (COMMON)
- Создана папка `src/styles/common/`.
- Вынесены: `theme.css` (переменные), `buttons.css`, `inputs.css` (включая slider и checkbox), `dialogs.css`, `tables.css`.
- Создана папка `src/pages/PranaBinduPage/styles/` (`pb-layout.css`, `pb-components.css`).

## Решения (ADR)

### 2026-10-09 — Exercise Graph (Melange Graph v1) — направление 16
- Граф — первичная модель данных. `equivalences` — seed + DB overrides.
- Узлы: `pattern / exercise / modality / catalog / tissue / skill / program`.
- Рёбра: `progresses-to / variant-of / progression-from / modality-of /
  instance-of / belongs-to / equivalent-to / requires / conflicts-with /
  trains / targets / warms-up / used-in`.
- Canonical vs concrete: `ex:push-up` (abstract) vs `ex:wade:pushup:5`.
- Иерархия: `concrete → canonical → pattern`.
- **Difficulty отложена на неопределённый срок** (может быть навсегда).
  Оставляем `level` (Wade/Cali, 1..10) и `band` (Thenics, 1..4).
- **`smithrun.ts`** — массив из упражнений (концепция будет прислана
  в новом чате).
- UI: fullscreen dialog, React Flow (`@xyflow/react` + `dagre`),
  pan/zoom + мини-карта + правая панель для drag unconnected.
- Файлы `ontology.ts` и `graphBuilder.ts` готовы (присланы в чате).
  Требуют корректировок: убрать `difficulty`, добавить `aliases` и
  `icuName` в `ExerciseProps`, canonical-узлы для progression keys,
  `PROGRAM_USAGE` из `ALL_PROGRAMS`.

### 2026-10-08 — большой рефакторинг + Thenics + Prehab
См. коммиты за период. Схема — `08_MELANGE.md`. Провайдеры — `07_SPICE.md`.

## Открытые вопросы

1. Концепция `smithrun` — ждём файл из нового чата.
2. Критерии перехода Big-6 (02/05).
3. Live-журнал: голосовой ввод.
4. Zepp-direct — потоковые данные о сне.
5. Бегущая строка статистики — состав и место.
6. Melange v22 — `training_load` в `run_facts`.

## Ближайшие задачи

1. **Сторис (Story Generator)** — генерация картинок для соцсетей (1080×1920) с картой/фото, цифрами, графиками (по км) и брендингом `smth.run`.
2. **Тестовые сегменты (Map Segments)** — создание геозон в редакторе и интеграция с `computeThresholds` (поиск 20-минутных отрезков внутри сегментов для более точного LTHR).
3. **Продвинутая визуализация карт** — тепловая карта (heatmap), анимация трека, 3D-рельеф.
4. **Melange v22** — `run_facts.training_load`.
5. **SVG-иконки** — 20 ключей в `assets/icons/exercises/`.
6. **Mentat ↔ Graph** — генератор использует связи.

## Что НЕ делаем сейчас
- Google Fit.
- 60 ступеней Big-6.
- Weighted / Ring / Band из Thenics.
- Difficulty-шкала.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-10-08

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус

- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — **99%**. Источники: dodofo (workouts, streams, GPS,
  thresholds, wellness), Strava-архив (FIT+TCX+CSV), intervals.icu
  (activities + streams + thresholds + zones + wellness + events +
  plan), Zepp FIT-папка.
- **08 (Melange)** — v1 → **v21**.
- **Mentat (03)** — **~75%**. Ladder для всех 6 категорий (22 прогрессии
  × 10 уровней + ~49 named). CheckLevelDialog, CheckReminderDialog,
  WadeProgramsPanel с прогрессом из БД, генератор программ, THENICS_CATALOG
  (206 движений из Thenics), Equivalence Mapper (разметка Thenics ↔ наши),
  учёт нагрузки при генерации (TSS в превью).
- **10 (UI, Duna)** — **~55%, активен**. Календари (год / квартал /
  месяц / MiniWeek / FullWeek sticky), DayDrawer, TrainingTabs
  (Календарь / План / Пробежки в одной панели с mode-switch),
  RunsPanel (плоский вид + по дням с прогрессивной подгрузкой),
  рефакторинг PranaBinduPage: 7 панелей вынесены в PANELS.
- **02 Core, 04 Stillsuit, 05 Crysknife, 06 Water Discipline** —
  не начата.

## Ключевые цифры (на 2026-10-08)

| Источник | origin | Записей |
|---|---|---|
| dodofo | — | 260 (все с GPS) |
| fit | strava-archive | 68 |
| fit | manual-import | 2 |
| fit | zepp-app | 264 |
| tcx | strava-archive | 617 |
| intervals-icu | intervals-icu | 265 |
| strava-csv | strava-archive | 1053 |
| **Итого run_facts** | | **~2530** |
| run_streams (файлы .msgpack) | | ~200 МБ |
| recovery_logs | | 1000+ (ICU + dodofo) |
| plan_events | | 13+ |
| workout_sessions | | ~10 (факт силовых + тесты) |
| exercise_progress | | ~10 движений |
| equivalences | | 1+ (Thenics ↔ Wade) |

**Melange schema_version:** 21.
**Уникальных дат пробежек:** ~900+.
**Wellness:** мульти-провайдер, ICU + dodofo.
**THENICS_CATALOG:** 206 движений (Push / Pull / Dip / Squat /
Leg Raise / Core / Handstand / Planche / Front Lever / Back Lever /
Flag / L-Sit), без weighted / Ring / Band / Mobility.

## Источники данных

| Источник | Роль | Что даёт | Статус |
|---|---|---|---|
| **dodofo.ru** | агрегатор | workouts, streams, GPS (polyline), thresholds (resthr), wellness | работает |
| **Strava-архив FIT/TCX** | файлы | workouts + streams (полные) | работает |
| **Strava activities.csv** | метаданные | workouts без потоков | работает |
| **intervals.icu** | агрегатор | workouts + streams + thresholds + zones + wellness + events + plan | работает |
| **Zepp FIT-папка** | Yandex.Disk | workouts + streams (ручные выгрузки) | работает |
| **Zepp-direct** | часы | workouts, streams, сон, HRV | TODO |
| **Google Fit** | отложено | — | отложено |

## Решения (ADR-стиль — новые за 2026-10-06..08)

### 2026-10-08 — Reфакторинг PranaBinduPage + TrainingTabs

- **TrainingTabs** (`PANELS/TrainingTabs/`) — три панели (Календарь /
  План / Пробежки) в одной Panel с mode-switch. Заголовок
  динамический: «План · 5», «Пробежки · 720». Ленивый mount,
  после — display:none. Активная вкладка — `pb.trainingTab`.
- **RunsPanel** (`PANELS/RunsPanel/`) — вынесен из родителя.
  Два вида таблицы: плоский (`RunsTableFlat`, виртуализация) и
  по дням (`RunsTableGrouped`, `rowGroupMode=subheader` + прогрессивная
  подгрузка по 25 групп). Переключатель в тулбаре. `30-мин окно`
  `groupRunFacts` сохранено.
- **Вынесены в `PANELS/`**: ProfilePanel, ConnectionsPanel,
  AutoSyncPanel (встроен в SyncPanel), ImportPanel, WellnessPanel,
  SyncPanel, TrainingTabs, RunsPanel.
- **PranaBinduPage.tsx**: ~2400 → ~700 строк. Чистая композиция.

### 2026-10-08 — Thenics: каталог + equivalences

- **`THENICS_CATALOG`** — 206 движений из приложения Thenics. Свой тип
  `ThenicsEntry` (не совместим с `CatalogEntry`: 4 уровня
  Beginner/Intermediate/Advanced/Pro, нет ladder). Заходы 1–5:
  Push+Dip, Pull+Row, Squat+Leg Raise+Core, Handstand+Planche,
  Lever+Flag+L-Sit/V-Sit.
- **Melange v21: `equivalences`** — таблица соответствий между
  каталогами (`source, source_key, source_level, target, target_key,
  target_level, confidence, note`). UNIQUE по всем шести полям,
  upsert. Используется для постепенной разметки.
- **`equivalenceMapperPanel`** — вкладка «Соответствия» в
  `WorkoutTemplatesDialog`. Список Thenics слева, форма справа
  (категория → прогрессия → уровень), «только неразмеченные».
- **`useEquivalencesMap`** — хук: один запрос, индекс по
  `(target, targetKey, targetLevel)`. Показ «≈ Push Up (Beginner)»
  в `DayDrawer` (карточка сессии) и `WadeProgramsPanel` («Мои уровни»).

### 2026-10-08 — Реверс-маппинг ICU-строк

- **`workoutMatcher.ts`** — распознаёт `- Incline Push-ups W2 2×20 30s Z1 Pace`
  → `{ movementKey: 'pushup', level: 2, rung: 2, confidence: 'full' }`.
- **Три уровня**: `full` (точный матч по `levels[].name`), `partial`
  (совпало с `icuName`, level не определён), `none`.
- **Нормализация имён**: срезает W/L-префикс, L/R-суффикс, дефисы
  → пробелы. НЕ fuzzy.
- **Aliases** в `CatalogEntry` / `CatalogLevel` / `NamedExercise`:
  `Bridge` ↔ `Bridges`, `Full Bridge` ↔ `Full Bridges`,
  `Diamond Push-ups` ↔ `Close Push-ups W6`, `Body Row` /
  `Australian Pull-ups` ↔ `Horizontal Pulls`, `Bar Knee Raises` ↔
  `Hanging Knee Raises`, 6 drill-вариантов (Toe Up / Snap Down /
  Fast / Heel / Straight Leg Run / Relaxed Acceleration).
- **Проверка на 25 шаблонах**: `full 241 / partial 46 / none 77`.
  Реальных `none` — 3 движения (Fire Hydrants, Wide Pull-ups,
  Dead Hang) + модификаторы темпа (Slow X, Deep X).

### 2026-10-08 — Учёт нагрузки при генерации

- **`pb:day-load-summary`** — сумма плановой (`plan_events.planned_load`
  где sport ~ run) и фактической (`run_facts.raw_json.raw.training_load`)
  нагрузки по дням + `baseline28` (медиана суточных сумм за 28 дней).
- **В превью программы** (`WadeProgramsPanel`) — `TSS N` рядом с датой,
  рамка жёлтая при `total > 1.5 × baseline28`, красная при `> 2.5 ×`.
- **Только бег**. Strength — следующая итерация.
- **FIT/TCX без `training_load`** в `raw_json` → 0 (Melange v22 —
  отдельный заход).

### 2026-10-08 — Профиль программы: `ProgramPreviewLine`

- `buildLine` возвращает `{ icu, en, ru, levelTag, rung, zone }`.
- В превью рядом с ICU-строкой — серым курсивом `level.nameRu`
  («Отжимания в наклоне»). В ICU уйдёт та же английская строка.

### 2026-10-08 — Wellness v20 (энергия + источники + русификация)

- **Melange v20**: `recovery_logs` += `sources_json` (аккумулируется,
  не перезаписывается), `calories_active`, `calories_total`,
  `body_fat_pct`.
- **`pb:sync-wellness`**: `auto_source = name` (наш провайдер:
  dodofo / intervals-icu), а не `zepp` из ответа. Чужой источник
  остаётся в `raw_json`.
- **`WellnessDrawer` / `WellnessView`**: бейджи источников (icu +
  dodofo) в шапке, секция «Энергия» (calories / body fat).
- **Русификация** всех секций: Оценка сна, Глубокий / Лёгкий /
  Бодрствование, Средний стресс, Крепатура, Усталость и т. д.

### 2026-10-08 — Автосинхронизация при старте

- **Melange v5-колонки** наконец используются: `auto_on_start`,
  `auto_interval_min`, `last_sync_at`, `last_sync_status`.
- **`pb:auto-sync-on-start`** — единственный флаг `autoOnStart`
  (поле `mode` синхронизируется с чекбоксом, но не блокирует).
  Антидребезг 6 ч. Синкает workouts + wellness за 7 дней.
- **`AutoSyncPanel`** — встроен внизу панели SyncPanel.
- Streams и plan — в автосинк не входят.

### 2026-10-08 — dodofo GPS из polyline

- **Публичный контракт** (docs/openapi.yaml): `/streams` не отдаёт GPS.
  GPS живёт в карточке заезда `GET /activities/{id}` → `Activity.polyline`.
- **`DodofoActivityFull extends DodofoActivity`** — добавлены `polyline`,
  `elevation_profile`, `hide_endpoints`, `hidden_endpoints`, `device`,
  `training_load`, `visibility`.
- **`fetchStreams`**: второй запрос к `/activities/{id}` + склейка
  `polyline` → `streams.latlng`. Fallback при ошибке (карточка может
  быть недоступна).
- **264/264** dodofo-фактов получили GPS (все с треком).
- **`DodofoStreams.latlng?: [number, number][] | null`**.

### 2026-10-08 — Фиксы UI

- **CheckLevelDialog**: префикс уровня W/L из категории движения
  (Wade → W, остальные → L). В `exercises_json` пишется `detectedRung`
  (результат теста), а не текущий rung.
- **DayDrawer**: одна «Свободная сессия» на день — все `programKey=null`
  сессии объединены, упражнения плоским списком, время `HH:MM` из
  `created_at`, бейдж `тест` на строках.
- **TrainingTabs**: три панели в одной с mode-switch. Стейт
  переключателя в `pb.trainingTab`.
- **RunsTableGrouped**: progressive-loading вместо пагинации
  (25 групп чанк), scrollbar в стиле Prana-Bindu.
- **`pb:import-zepp-dir`**: обновляет `origin='zepp-app'`, если файл
  уже был с другим origin.

### 2026-10-07 — Задача B: учёт нагрузки при генерации

См. 2026-10-08 — тот же пункт, реализован одним днём.

### 2026-10-05 — Календари + DayDrawer + MirrorDeleteDialog

(без изменений)

### 2026-10-04..03 — Mentat парсер + каталог + таймлайн, Wellness
multi-provider, HR-зоны

(без изменений)

## Открытые вопросы

1. Критерии перехода между ступенями Big-6.
2. Тайминги стойки (30/60/120 s).
3. Live-журнал: голосовой ввод.
4. Дедупликация между агрегаторами (v22+).
5. Потоковые данные о здоровье (Zepp-direct).
6. **Группировка Thenics-каталога**: категории / фильтры по мышцам.
7. **Бегущая строка статистики** — состав, место.
8. **Модель A** (день как заголовок) — сделано в `RunsTableGrouped`.
9. **Prehab-дополнения** — что добавлять и по каким источникам.
10. **`equivalences`** — как расширять на другие source-каталоги
    (не только Thenics).

## Новые направления (не начатые)

### A. Каталог калистеники — разведка и standalone-справочник
(без изменений — разведка, отдельный проект)

### C. Календари
**Готово:** годовой, квартальный, месячный, MiniWeek, FullWeek sticky.
**Осталось (FullWeek-2, но пересмотрено):**
- ~~Мини-таймлайн плана~~ → **отклонено**.
- Клик по «+N ещё» → DayDrawer (просто, отложено).
- TSS дня в ячейке — обсуждается вместе с бегущей строкой.

### D. Дашборд главной страницы
(без изменений)

### E. Визуализация упражнений (p5.js vs three.js)
(без изменений)

### F. Live-журнал — расширение роли
(без изменений)

### G. Standalone справочник калистеники
(без изменений)

### H. Комментарии, напоминания, соцсети
(без изменений)

### I. Wellness — backlog
Пункт 1 (sources_json) — **сделано в v20**.
Пункт 2 (Zepp-direct) — TODO.
Пункт 3 (графики здоровья) — TODO, может войти в бегущую строку.

### J. Mirror-семантика sync-plan
(без изменений)

### K. Форма факта тренировки
**Сделано:** LogWorkoutSessionDialog (план + свободный).

### L. Zepp ↔ ICU ↔ наш клиент
(без изменений)

### M. Amazfit / Zepp → ICU — wellness
(без изменений)

### N (новое). Thenics — постепенная разметка
- **Готово:** каталог 206, equivalences, EquivalenceMapperPanel,
  useEquivalencesMap.
- **TODO:** автооткрытие диалога разметки раз в сутки (как
  CheckReminderDialog); прогресс-бар «12/206» в заголовке вкладки;
  фильтры по мышцам / уровням.

### O (новое). Бегущая строка статистики
- Место: внизу FullWeek или отдельная sticky-полоса внизу экрана.
- Состав: последняя тренировка, следующая по плану, км за
  неделю/месяц/квартал/год, RestHR, MaxHR за год, дней до марафона,
  возможно CTL/ATL.
- Механизм: sticky + CSS marquee или JS-анимация.
- Отложено до уточнения состава.

## Ближайшие задачи

1. **Prehab (G)** — стопы / колени / спина / mobility. Разведка
   источников, дополнение `PROGRESSIONS_CATALOG` и `NAMED_EXERCISES`.
2. **Thenics — разметка** — расширение `equivalences`, автооткрытие
   диалога, прогресс в заголовке.
3. **Бегущая строка** — состав, реализация.
4. **Melange v22** — `run_facts.training_load` (или `raw_json` — расчёт
   для FIT/TCX). Нужно для честного TSS в превью и бегущей строке.
5. **Live-журнал** — PWA, отдельный проект.

## Что сделано (полный список)

### Инфраструктура
- [x] Архитектура, имена, источники.
- [x] Промты 00–09.
- [x] 09 (Electron Shell).

### Melange
- [x] v1–v21. Репозитории: `profileRepo`, `syncRepo`, `runFactsRepo`,
      `runStreamsRepo`, `recoveryRepo`, `planEventsRepo`,
      `workoutSessionsRepo`, `exerciseProgressRepo`, `equivalencesRepo`.
- [x] Все миграции идемпотентны.

### Провайдеры
- [x] `DodofoProvider` — workouts, streams (с GPS), thresholds, wellness.
- [x] `IntervalsIcuProvider` — workouts, streams, thresholds, zones,
      wellness, events, plan.
- [x] Capabilities у всех, `regionDetector.ts`.
- [x] `dofek-zepp` — каркас.

### Парсеры
- [x] `fitParser.ts`, `tcxParser.ts`, `stravaCsvParser.ts`.
- [x] `gpsClassifier.ts`, `workoutValidator.ts`.
- [x] `workoutMatcher.ts` — реверс-маппинг ICU-строк.

### Mentat (03)
- [x] `workoutParser.ts` — ICU + W1..W10 / L1..L10.
- [x] `workoutRenderer.ts` — обратный рендер.
- [x] `exerciseCatalog.ts` — 22 прогрессии × 10 уровней + ~49 named.
- [x] `thenicsCatalog.ts` — 206 движений.
- [x] `workoutTemplates.ts` — 25 шаблонов в 10 категориях.
- [x] `wadeProgramGenerator.ts` — preview с `lineDetails`.
- [x] Программы: `wadePrograms`, `runnerPrograms`, `caliPrograms`,
      `prehabPrograms`.
- [x] `CheckLevelDialog`, `CheckReminderDialog`.
- [x] `WadeProgramsPanel` — прогресс из БД, TSS в превью.
- [x] `EquivalenceMapperPanel`.

### Хранилище
- [x] `runStreamsStorage.ts` — .msgpack, `latlng` в channels.

### IPC
- [x] Провайдеры, профиль, синхронизация, потоки, импорт, отладка.
- [x] `pb:sync-plan`, `pb:list-plan-events`, `pb:clear-plan`.
- [x] `pb:sync-zones`, `pb:sync-thresholds`, `pb:sync-wellness`.
- [x] Wellness multi-provider.
- [x] `pb:auto-sync-on-start`, `pb:sync-settings-get/update`.
- [x] `pb:day-load-summary`.
- [x] `pb:get-exercise-progress`, `pb:list-exercise-progress`,
      `pb:set-exercise-progress`.
- [x] `pb:equivalences-list / -list-for / -for-target / -set / -delete`.
- [x] `pb:debug-match-icu / -line / -plan-events`.
- [x] `pb:update-run-fact-name`, `pb:update-run-group-name`.
- [x] `pb:push-plan-event`, `pb:delete-plan-event-remote`,
      `pb:update-plan-event-locally`, `pb:delete-plan-event-locally`.
- [x] `pb:plan-events-set-keep`, `pb:plan-events-delete-bulk`.

### UI
- [x] Панели: Профиль, Подключения (dodofo / intervals / Zepp),
      Автосинхронизация, Синхронизация (API), Импорт файлов,
      Здоровье, TrainingTabs (Календарь / План / Пробежки).
- [x] Таблица «Пробежки» — плоский вид + по дням, фильтры, бейджи.
- [x] Drawer пробежек, карта с GPS, график, sync.
- [x] Панель «План» + drawer события, библиотека шаблонов,
      каталог упражнений.
- [x] `TrainingTabs` — три панели в одной Panel.
- [x] `FullWeek` — sticky-полоса недели.
- [x] `DayDrawer` (План / Факт / Здоровье) + `DaySummary`.
- [x] `CheckReminderDialog`.
- [x] Единый accent-focus для порталов.

### Данные
- [x] ~2530 записей `run_facts`.
- [x] 1053 strava-csv (2018–2026).
- [x] 264 Zepp FIT.
- [x] 265 ICU с полным FIT-обогащением.
- [x] 264/264 dodofo с GPS.
- [x] 1000+ recovery_logs из двух источников.
- [x] `exercise_progress` — прогресс по движениям Mentat.
- [x] `workout_sessions` — факт силовых + тесты.
- [x] `equivalences` — разметка Thenics ↔ Wade.

## Что НЕ делаем сейчас
- Google Fit — отложено.
- Погода ICU — нет данных.
- 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- Live-журнал — отдельный PWA-проект.
- Weighted / Ring / Band / Mobility из Thenics — отдельные заходы.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-10-05

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — **99%**. Источники: dodofo, Strava-архив
  (FIT+TCX+CSV), intervals.icu (activities + streams +
  thresholds + zones + wellness + events), Zepp FIT-папка.
- **08 (Melange)** — v1 → **v16**.
- **Mentat (03)** — **~55%**. Сделано: `plan_events` + панель «План»,
  библиотека шаблонов, парсер/рендерер ICU (W1..W10 / L1..L10),
  каталог упражнений (22 прогрессии + 35 named), таймлайн шагов,
  **календари: год / квартал / месяц / MiniWeek / FullWeek**,
  **DayDrawer** (план+факт+wellness), **MirrorDeleteDialog**,
  push plan_events в ICU. Осталось: периодизация, подводка к старту,
  Модель A группировки, автосинхронизация.
- **10 (UI, Duna)** — **~25%, активен**: панели, drawer'ы,
  COMMON (`MiniTimeline`, `YearCalendar`, `MiniWeek`, `CalendarPanel`).ли, drawer'ы,
- **02 Core, 04 Stillsuit, 05 Crysknife, 06 Water Discipline** —
  не начата.

## Ключевые цифры (на 2026-10-04)

| Источник | origin | Записей |
|---|---|---|
| dodofo | — | 260 |
| fit | strava-archive | 68 |
| fit | manual-import | 2 |
| fit | zepp-app | 264 |
| tcx | strava-archive | 617 |
| intervals-icu | intervals-icu | 265 |
| strava-csv | strava-archive | 1053 |
| **Итого run_facts** | | **~2530** |
| run_streams (файлы .msgpack) | | ~200 МБ |
| recovery_logs | | 1000+ (ICU + dodofo) |
| plan_events | | 13+ (после sync-plan) |

**Melange schema_version:** 16.
**Уникальных дат пробежек:** ~900+.
**Wellness:** мульти-провайдер, ICU + dodofo дополняют друг друга.

## Источники данных

| Источник | Роль | Что даёт | Статус |
|---|---|---|---|
| **dodofo.ru** | агрегатор | workouts, streams, thresholds (resthr), **wellness (сон, шаги, фазы)** | работает, wellness починили |
| **Strava-архив FIT/TCX** | файлы | workouts + streams (полные) | работает |
| **Strava activities.csv** | метаданные | workouts без потоков | работает |
| **intervals.icu** | агрегатор | workouts + streams + thresholds + zones + wellness + events | работает |
| **Zepp FIT-папка** | Yandex.Disk | workouts + streams (ручные выгрузки) | работает |
| **Zepp-direct** | часы | workouts, streams, сон, HRV (потоки) | TODO |
| **Google Fit** | отложено | — | отложено |

## Решения (ADR-стиль — новые за 2026-10-04)

**Обновлено 2026-10-05 (v16):** добавлена колонка `local_keep`
(флаг «не удалять при mirror-синке»).

### 2026-10-05 — Календари + DayDrawer + MirrorDeleteDialog

**Календари:**
- `COMMON/CalendarPanel` — контейнер с режимами `Год / Квартал /
  Месяц / Неделя`.
- `COMMON/QuarterCalendar` — параметризован `monthCount` (1 —
  месяц, 3 — квартал).
- `COMMON/MiniWeek` — 7 компактных ячеек для режима «Неделя».
- `COMMON/YearCalendar` — год как 4×3 месяца.
- **`FullWeek`** — sticky-полоса на всю ширину, 7 дней,
  сегодня в центре, свёртывание/открепление с сохранением
  в localStorage (`pb.fullweek.collapsed`, `pb.fullweek.pinned`).
- Общий паттерн: `--calendar-plan-color` (teal), `--calendar-fact-color`
  (accent в Prana-Bindu через override).
- Вынос FullWeek из `.pb-page` в новый `.pb-page-root` — чтобы
  sticky работал против viewport, а не padded content-box.

**DayDrawer:**
- `DayDrawer` — правый sidebar, открывается по клику на день в любом
  календаре. Табы: **План / Факт / Wellness**.
- `views/PlanEventView` — полная функциональность `PlanEventDrawer`
  без Sidebar.
- `views/RunFactView` — полная функциональность `RunStreamsDrawer`
  без Sidebar (группировка ±30 мин, вкладки источников, streams meta,
  карта, график, sync, переименование группы).
- `views/WellnessView` — секции из `WellnessDrawer`.
- `DaySummary` — компактная строка wellness (сон, RHR, шаги,
  CTL/ATL, stress).
- Старые `PlanEventDrawer` / `RunStreamsDrawer` / `WellnessDrawer`
  сохранены — панели «План», таблица «Пробежки» и панель Wellness
  продолжают ими пользоваться.

**Удаление plan_event:**
- `DeletePlanEventDialog` — диалог с выбором scope:
  «Только в приложении» (с предупреждением, что sync вернёт)
  или «Из ICU и из приложения».
- Встроен в `PlanEventDrawer` и `views/PlanEventView`.

**Mirror-семантика sync-plan (Melange v16):**
- Колонка `plan_events.local_keep INTEGER NOT NULL DEFAULT 0`.
- `pb:sync-plan` больше **не удаляет** локальные события автоматически.
  Вместо этого возвращает `staleCandidates` — локальные ICU-события
  в диапазоне, которых нет в ICU, и у которых `local_keep = 0`.
- UI открывает **`MirrorDeleteDialog`**: чекбоксы (все отмечены =
  удалить), range в шапке, warning при ≥5 кандидатов.
- Снятые галочки → `local_keep = 1`, не всплывают при следующей
  синхронизации.
- Новые IPC: `pb:plan-events-set-keep`, `pb:plan-events-delete-bulk`.

**Извлечение общей логики:**
- `utils/groupRunFacts.ts` — общая группировка ±30 мин.
  Используется в таблице «Пробежки», в `DayDrawer` и в `FullWeek`.
- `sourceBadge()` и `SOURCE_PRIORITY` — в этом же модуле.
- `FullWeek` использует **цветные точки** (`.pb-source-dot--*`) вместо
  текстовых бейджей — для компактности в ячейке.

### 2026-10-04 — Mentat: парсер + рендерер + каталог + таймлайн

- `types.ts`: `WorkoutStep`, `WorkoutSection`, `ParsedWorkout`,
  `CatalogEntry`, `NamedExercise`, `StepPrefixKind` (W/L).
- `workoutParser.ts`: ICU + префиксы W1..W10 / L1..L10,
  авто-зона из `levelToZone(level)`.
- `workoutRenderer.ts`: обратный рендер `ParsedWorkout → ICU`.
- `exerciseCatalog.ts`: 22 прогрессии (Wade, Cali, Runner, Core,
  Posture, Weight-loss) × 10 уровней + 35 named (drill, plyo,
  warmup, run-basic).
- `PlanEventDrawer`: таймлайн строится из `parseWorkoutText`
  при пустом `event.steps`, `extractZone` нормализует `'Z2'` → 2.
- `WorkoutTimeline`: палитра совпадает с ICU: Z1 = teal
  `#009e80`, Z2 = green `#009e00` (было наоборот).
- `WorkoutTemplatesDialog`: превью таймлайна + **каталог
  упражнений** (вкладка, чипы, дерево, копирование строки вида
  `- Push-ups W3 30s Z2 Pace`).
- `COMMON/MiniTimeline` + `COMMON/YearCalendar`: годовой
  календарь на странице, маркеры план (teal) / факт (зелёный /
  accent), комбинированная метка для дней с обоими.
- Push plan_events в ICU: `createEvent` / `updateEvent` /
  `deleteEvent`, IPC `pb:push-plan-event`,
  `pb:delete-plan-event-remote`, `pb:update-plan-event-locally`.

### 2026-10-03 — Wellness: multi-provider (ICU + dodofo)
- `pb:sync-wellness(undefined, ...)` синкает всех провайдеров с
  `capabilities.wellness`, в порядке: ICU (CTL/ATL) → dodofo (сон/шаги).
- Универсальный маппинг `camelCase ?? snake_case`.
- Новые поля (из v8, но раньше не заполнялись): `sleep_total_min`,
  `deep_min`, `rem_min`, `light_min`, `awake_min`,
  `body_battery_charged/drained`, `stress_avg`, `sp_o2`, `auto_source`.
- `dodofoProvider.capabilities.zones = false` (`/me/zones` = 404).
- UI: одна кнопка, кнопка не зависит от активного провайдера.

### 2026-10-03 — Библиотека шаблонов тренировок
- `mentat/workoutTemplates.ts` — 25 шаблонов в 9 категориях.
- Синтаксис ICU: `mtr` для метров, cue перед длительностью,
  `Nx` отдельной строкой, без вложенных повторов, без RPE.
- Big-6 и силовые — чередование Work `Z2/Z3` + Rest `Z1`.
- `WorkoutTemplatesDialog.tsx` — модалка с превью, `usage`,
  копирование в буфер, флаг `verified`.

### 2026-10-02 — HR-зоны + pace-зоны (Melange v13 + v14)
- `profile.hr_zones_json` + `hr_zones_source` (v13).
- `profile.pace_zones_json` + `threshold_pace_ms` + `pace_zones_source` (v14).
- `pb:sync-zones('intervals-icu')` — читает `icu_hr_zones` +
  `threshold_pace`/`pace_zones` из последней активности.
- `RunStreamsChart`: HR-линия сегментируется по HR-зонам,
  speedKmh — по pace-зонам, остальные каналы — градиент min→max.

### 2026-10-02 — Melange v15: `plan_events` (Mentat backend)
- Таблица `plan_events` с `category / sport / name / description /
  planned_load / duration_sec / distance_m / icu_workout_json /
  raw_json / paired_activity_id`.
- `IntervalsIcuProvider.fetchPlanEvents` — маппинг `/athlete/{id}/events`.
- `pb:sync-plan`, `pb:list-plan-events`, `pb:clear-plan`.
- Связь план↔факт: `plan_events.date = run_facts.date` + sport = run →
  `paired_activity_id`.

### 2026-10-02 — Окно группировки (решение пересмотрено)
- Было 30 → меняли на 5 → **вернули на 30**. Обсуждаем модель A
  (день как заголовок) вместе с календарём «план-факт».

### 2026-10-02 — Фильтры пробежек
- Панель над таблицей, состояние в localStorage (`pb.filters.v1`).
- Поиск по `displayName` + провайдерским `name` (в выбранных
  источниках). Debounce 300ms.
- Чипы-источники = фильтр групп + scope поиска.

### 2026-10-02 — Zepp FIT-папка
- Вторая папка в «Импорт файлов», `origin='zepp-app'`.
- Дедуп только по `(source, external_id)`, без time-window.
- `sourceBadge(source, origin)` → `zepp` (циан) в таблице.

### 2026-10-02 — Strava `activities.csv` как источник
- Новый `source='strava-csv'`, `origin='strava-archive'`.
- `external_id = strava-csv:<file_id>`.
- Даты в CSV хранятся в UTC (не Moscow local).
- Фильтр по типу «Бег»: 1053 из 1162 строк.

### 2026-10-02 — Melange v11: `name` / `user_name`
- `run_facts.name` — провайдерское (ICU, dodofo, Strava CSV).
- `run_facts.user_name` — только пользователь, никогда не перезаписывается.
- UI: колонка «Название», drawer — единое имя тренировки над вкладками
  с inline редактором и копированием провайдерского.

### 2026-10-01 — Melange v10: source tracking порогов
- `lthr_source`, `max_hr_source`, `resting_hr_source`.
- `pickNum` в `updateProfile`: value changed + no source → `manual`;
  value + source → оба пишутся; value unchanged → source сохраняется.

### 2026-10-01 — Разделение `sync-now` и загрузки потоков
- `sync-now` тянет список (1 HTTP, ~2 сек).
- FIT-обогащение + потоки — `pb:sync-run-streams-all`
  с прогрессом и отменой.

### 2026-10-01 — TCX fallback: duration/distance из trackpoints
- 214 записей имели `duration_sec=0`, `actual_pace=NULL`.
- Каскад «лапы → trackpoints» починил.

### 2026-10-01 — COALESCE-семантика в UPDATE `run_facts`
- `sync-now` (только список) больше не затирает FIT-обогащение.
- `COALESCE(?, col)` для всех не-идентификационных полей.

### 2026-10-01 — Fix INSERT в `runFactsRepo`
- Позиции значений не совпадали с колонками (сдвиг на 5).
- У всех ICU-записей `external_id IS NULL`. Дедуп не работал.
- Фикс: значения возвращены на позиции.

## Открытые вопросы

1. Критерии перехода между ступенями Big-6 (02/05).
2. Тайминги стойки (30/60/120 s).
3. Live-журнал: голосовой ввод.
4. Дедупликация между агрегаторами (v16+).
5. Потоковые данные о здоровье (пульс сна) — требует Zepp-direct.
6. Модель A группировки — вместе с календарём.
7. Выбор стека визуализации: p5.js vs three.js (прототип).
8. Дашборд: какие виджеты показывать на главной, какие панели
   прятать в диалоги.
9. Горизонтальный недельный календарь: финальная разметка
   ячейки-дня (мини-таймлайн плана, факт, wellness, TSS).

## Новые направления (не начатые)

### A. Каталог калистеники — разведка и standalone-справочник

- **Разведка в интернете** — собрать источники прогрессий:
  Convict Conditioning (Пол Уэйд), Al & Danny Kavadlo,
  r/bodyweightfitness recommended routine, Startbodyweight.com,
  GymnasticBodies, Overcoming Gravity (Steven Low).
- **Сделано:** базовый `exerciseCatalog.ts` (22 прогрессии + 35 named).
- **Осталось:** разведка источников, тесты перехода, техника.
- **Перспектива** — выделить в **standalone web app**
  «Справочник по калистенике» (отдельный проект, отдельный репо).
  Внутри — прогрессии, техника, фото/видео, тесты перехода.

### C. Календари (приоритет — высокий)

- **Готово:** годовой, квартальный, месячный.
- **TODO (шаг 1):** `MiniWeek` — 5-й режим в `CalendarPanel`
  (компактные ячейки, только маркеры плана/факта).
- **TODO (шаг 2):** `FullWeek` — **sticky-полоса на всю ширину
  окна**, прижата к верху или низу, всегда видна. Скользящее
  окно 7 дней, сегодня в центре. В ячейке: дата, wellness,
  мини-таймлайн плана, мини-таймлайн факта. Основа рабочего
  стола — ниже dashboard скроллится.
- **Backlog:** `DateStrip` — бегущая строка дней как альтернативный
  навигатор. Отложено, пока не нужно.

### D. Дашборд главной страницы (14)

На главной Prana-Bindu уже 8+ панелей, они не помещаются на
экран и плохо сканируются. Переделать в **дашборд**:

- **Виджеты** (компактные): статистика недели, прогресс к
  марафону, CTL/ATL, ближайшее событие плана.
- **Тяжёлые панели** (Пробежки, Wellness, Импорт, Подключения,
  Синхронизация, План, Календарь) → скрыть в **диалоговые окна**.
- Плитки-карточки на главной, клик → открывает модалку.
- Стиль плиток — компоненты COMMON (`<DashboardTile>`).

### E. Визуализация упражнений (13)

- **Что:** анимация выполнения для каталога и standalone-справочника.
- **Кандидаты:**
  - **p5.js** — 2D, скелет, простой, лёгкий (canvas).
  - **three.js** — 3D, реалистично, WebGL, тяжелее.
- **Решение:** прототип на 1–2 упражнениях (Push-ups, Squat),
  оценка по: реализм, вес бандла, скорость разработки, сложность
  поддержки. Отдельный чат, файл `chats/13_ANIMATION.md`.

### Разведка источников калистеники

Прежде чем расширять `exerciseCatalog.ts` — собрать источники:

- Convict Conditioning (Пол Уэйд), Al & Danny Kavadlo,
- r/bodyweightfitness recommended routine,
- Startbodyweight.com, GymnasticBodies,
- Overcoming Gravity (Steven Low).

Цель — единый каталог прогрессий + тесты перехода.

### F. Live-журнал — расширение роли

Направление 12 покрывает **не только бег**, но и **силовые**:

- **Бег** — надиктовка/запись по ходу, экспорт JSON → импорт.
- **Силовая** — после подхода (подтянулся на турнике, отжался)
  открыть на телефоне, записать: движение, уровень (W3), подходы,
  повторы, RPE. Экспорт JSON → `strength_sessions` в Melange.
- Offline-first PWA. Один экспорт — весь день в основную БД.

### G. Standalone справочник калистеники

Выделить справочную часть (прогрессии, техника, тесты перехода,
фото/видео, анимации из E) в **отдельный web app**.
Отдельный репозиторий, отдельный деплой. Основное приложение —
потребитель: тянет каталог через API или копию JSON.

### H. Комментарии, напоминания, соцсети

**Задел в `plan_events` / `run_facts`** (Melange v16+, не сейчас):
- `comments_json` — массив `{ author, at, text }`, для заметок
  пользователя и обсуждений в будущем.
- `reminders_json` — массив `{ channel, at, payload }`,
  канал: `email` / `telegram` / `max` / `vk` / `push`.
- `share_token` — публичная ссылка на тренировку (для соцсетей).

**Напоминания** — отдельный процесс (не Electron-main):
- Cron-worker проверяет `reminders_json` и шлёт через бота.

**Боты и мини-приложения** (большой план, отдельное направление):
- Telegram: бот + Mini App (WebApp API) — карточка дня, лог
  силовой, отметка «сделал».
- MAX: аналогично.
- VK: бот + VK Mini Apps.
- Цель — продвижение веб-версии приложения через соцсети.
- Мини-приложения тянут данные из нашей БД через публичный API
  (отдельный gateway, не Electron).

**Что это даёт:**
- Открыл Mini App → записал подход (Live-журнал, направление 12)
  → данные ушли в облако → основной клиент синкает.
- Бот присылает напоминание «сегодня интервалы, 10×400м»
  → можно запустить тренировку прямо из чата.

### I. Wellness — backlog (не сейчас)

Диагностика 2026-10-04 показала:
- `dodofo.fetchWellness` **работает**, данные долетают;
  `auto_source` в БД — это **первый writer**, не primary
  (интервал: ICU синкается первым, поэтому у дней стоит
  `auto_source='intervals-icu'`, хотя deep/light/steps — из dodofo).
- `rem_min` и `awake_min` — **не отдаёт ни ICU, ни dodofo**.
  Оставляем NULL. Возможно, Zepp-direct (направление 12) сможет
  отдавать эти поля.
- `stress_avg`, `body_battery_*` — dodofo не отдаёт (по крайней
  мере не в `/api/v1/wellness`). Тоже ждём Zepp-direct.

**Задачи в backlog:**

1. **`sources_json` в `recovery_logs` (Melange v16).** Массив
   всех источников, которые писали в дату. Сейчас виден только
   первый. Показывать в `WellnessDrawer` (например, бейджами).
2. **Zepp-direct для wellness** (направление 12). Прямой доступ
   к Zepp-аккаунту — теоретически даст REM, awake, body battery,
   stress. Уже есть каркас `dofekProvider`.
3. **Графическое отображение здоровья** — вместо таблицы
   Wellness на главной (или в дополнение к ней): графики сна/RHR/
   HRV/CTL/ATL по неделям. Отдельная панель или часть дашборда
   (направление 14). Таблицу в панели оставляем для детального
   просмотра.

### J. Mirror-семантика sync-plan (backlog)

**Проблема.** Когда пользователь редактирует событие в ICU,
ICU **пересоздаёт** его с новым id. При `pb:sync-plan` наш upsert
добавит новую локальную запись, но старая (со старым external_id)
останется → дубликат в календаре и панели «План».

**Решение.** После синка за диапазон:
1. Собрать множество `external_id`, которые вернул ICU.
2. Удалить локальные `plan_events` за тот же диапазон, чей
   `external_id` **не входит** в это множество.
3. Только записи с `external_id LIKE 'intervals-icu-event:%'`
   подлежат зеркальному удалению. Локальные (без ICU) — не трогаем.

**Плюс.** Появится пункт «Sync (mirror)» в тулбаре панели «План» —
явная операция, не автоматическая, чтобы пользователь не потерял
случайно то, что ещё не отправил.

**Связь.** После этого станет безопасно вызывать sync-plan из
кнопки «Синхронизировать» — она уже будет приводить локальный
список к состоянию ICU.

### K. Форма факта тренировки (временная, до Live-журнала)

**Зачем:** пока нет Live-журнала, фиксировать фактическое выполнение
можно через форму после тренировки. Не удобно, но полезно как
временный способ.

**Откуда открывается:**
- Из `DayDrawer` → таб «Факт» → кнопка «+ Записать факт» на дне.
- Или из `PlanEventView` в прошедшем событии → «Записать результат».

**Что содержит:**
- Список движений из plan_events дня (подтягиваем cue + reps из
  description).
- Для каждого движения: фактическое reps/sets, RPE, заметки.
- Итоговая оценка соответствия плану (auto: % выполнения).

**Куда пишет:**
- Новая таблица `strength_sessions_v2` в Melange v17:
  `{ date, plan_event_id?, movement_key, level, rung,
     sets_target, reps_target, sets_done, reps_done, rpe, notes }`.
- Или JSON-блок в существующую `strength_sessions`.

**Анализ план-факт (позже):**
- Факт ≥ target → предложить rung++ или level++.
- Факт < target систематически → откатить rung на предыдущий.

### L. Zepp ↔ ICU ↔ наш клиент — исследование (2026-10-06)

**Наблюдение:** события, отправленные в ICU через `pb:push-plan-event`,
затем появляются в мобильном приложении Zepp. Значит между ICU
и Zepp есть двусторонний канал (ICU аккаунт связан с Zepp/Amazfit).

**Гипотезы:**
- ICU пушит события в Zepp как «planned workouts».
- Zepp может отдавать в ICU активности, сон, HRV — если ICU
  подписан на Zepp (а он подписан: у нас в wellness приходят
  `sleepDeepSecs`, `sleepLightSecs`, которых у нас из FIT нет).

**Что изучить (отдельный чат или пометка в 07_SPICE):**
- Какие каналы данных ICU передаёт между Zepp и своим API.
- Можно ли через ICU закрыть пробел `rem_min`, `awake_min`,
  `body_battery`, `stress` (см. направление I).
- Как настройки Zepp-аккаунта в ICU влияют на передачу (что
  идёт в Zepp, что обратно).
- Приоритет Zepp-direct (Huami) vs ICU-как-моста.

**Приоритет:** средний. Задача не блокирует текущую работу.

### M. Amazfit / Zepp → ICU — wellness (sleep, HRV, beat-to-beat)

**Разведка (2026-10-06):** в ICU есть интеграция с Amazfit/Zepp,
но по умолчанию она выключена. Что нужно сделать:

1. ICU → Settings → Amazfit → авторизация через Zepp-аккаунт
   (тот же логин, что в приложении Zepp).
2. Отметить **«Download wellness»** — включает сон, RHR и
   непрерывный пульс (beat-to-beat) за ночь.
3. Если часы поддерживают HRV — включить **«HRV (rMSSD)»**
   (по умолчанию выключено).
4. Кнопка **«Download Old Data»** — импорт истории за последние
   **28 дней**.
5. В Zepp-приложении: Мониторинг сна и Continuous HRM — включены,
   частота измерения — High / Frequent.

**Что это даёт нам:**
- Возможно, закроет пробелы `rem_min`, `awake_min` (см.
  направление I).
- Может появиться `hrv_rmssd` как числовое значение (сейчас
  приходит `hrv_sdnn` иногда).
- Непрерывный HR за ночь — потенциально новый канал, но
  хранить его негде (у нас нет потоков wellness, только
  дневные агрегаты).

**Первый шаг:** включить в ICU, выполнить `pb:sync-wellness`
за последние 28 дней, посмотреть формат ответа
`/athlete/{id}/wellness`. Если поля совпадают — просто
увидим больше данных. Если формат другой — расширим маппинг
в `intervalsIcuProvider` / `pb:sync-wellness`.

**Приоритет:** средний. После того как закроем текущие фичи.

## Ближайшие задачи

1. **Расширение каталога упражнений.** Разведка источников
   (Convict Conditioning, Kavadlo, r/bodyweightfitness,
   Overcoming Gravity). Новые категории/прогрессии,
   тесты перехода, техника.
2. **Дашборд (D).** Виджеты + тяжёлые панели в диалоги.
3. **Визуализация (E).** Прототип p5.js vs three.js на 1–2
   упражнениях.
4. **Live-журнал (F).** Расширение на силовые, offline-first PWA.
5. **FullWeek — вторая итерация.** Мини-таймлайн плана
   (через `parseWorkoutText`), клик по «+N ещё» → `DayDrawer`,
   TSS-число в ячейке.
6. **Автосинхронизация при старте** (`mode='auto'`).
7. **Модель A группировки** — день как заголовок в таблице
   пробежек.
8. **HR-окраска трека на карте.** CHARTS-чат.
9. **Расчёт LTHR / threshold pace самим.** После CHARTS.
10. **Standalone справочник калистеники** (направление 15).
11. **Потоковые данные о здоровье** через Zepp-direct.

## Что сделано (полный список)

### Инфраструктура
- [x] Архитектура, имена, источники.
- [x] Промты 00–09.
- [x] 09 (Electron Shell).

### Melange
- [x] v1–v16. Репозитории: `profileRepo`, `syncRepo`,
      `runFactsRepo`, `runStreamsRepo`, `recoveryRepo`,
      `planEventsRepo`.
- [x] Все миграции идемпотентны.

### Провайдеры
- [x] `DodofoProvider` — workouts, streams, thresholds, wellness.
- [x] `IntervalsIcuProvider` — workouts, streams, thresholds,
      zones, wellness, events.
- [x] Capabilities у всех, `regionDetector.ts`.
- [x] `dofek-zepp` — каркас.

### Парсеры
- [x] `fitParser.ts`, `tcxParser.ts`, `stravaCsvParser.ts`.
- [x] `gpsClassifier.ts`, `workoutValidator.ts`.

### Mentat (03)
- [x] `workoutParser.ts` — ICU + W1..W10 / L1..L10.
- [x] `workoutRenderer.ts` — обратный рендер.
- [x] `exerciseCatalog.ts` — 22 прогрессии + 35 named.
- [x] `workoutTemplates.ts` — 25 шаблонов в 9 категориях.
- [x] Timeline preview в событиях плана и шаблонах.
- [x] Push plan_events в ICU.

### Хранилище
- [x] `runStreamsStorage.ts` — .msgpack, `latlng` в channels.

### IPC
- [x] Провайдеры, профиль, синхронизация, потоки, импорт, отладка.
- [x] `pb:sync-plan`, `pb:list-plan-events`, `pb:clear-plan`.
- [x] `pb:sync-zones`.
- [x] `pb:update-run-fact-name`, `pb:update-run-group-name`.
- [x] `pb:push-plan-event`, `pb:delete-plan-event-remote`,
      `pb:update-plan-event-locally`, `pb:delete-plan-event-locally`.
- [x] Wellness multi-provider.
- [x] `pb:plan-events-set-keep`, `pb:plan-events-delete-bulk`.

### UI
- [x] Панели: Подключения, Синхронизация (API), Импорт файлов,
      Wellness, План, Пробежки, Профиль.
- [x] Таблица «Пробежки» — бейджи, фильтры, колонка «Название».
- [x] Drawer пробежек: название над вкладками, карта, график.
- [x] Панель «План» + drawer события.
- [x] Библиотека шаблонов.
- [x] Каталог упражнений во вкладке библиотеки.
- [x] `RunStreamsChart` с зонами, `GpsMapView`.
- [x] `WorkoutTimeline` — таймлайн шагов (события + шаблоны).
- [x] `YearCalendar` + `MiniTimeline` (COMMON) — годовой
      календарь с маркерами план/факт.
- [x] Панель «Календарь YYYY» на странице.
- [x] `CalendarPanel` + `YearCalendar` + `QuarterCalendar` +
      `MiniWeek` — режимы Год / Квартал / Месяц / Неделя.
- [x] `FullWeek` — sticky-полоса, 7 дней, свёртывание/открепление,
      точки источников, сохранение состояния.
- [x] `DayDrawer` (План / Факт / Wellness) + `DaySummary`.
- [x] `views/PlanEventView`, `views/RunFactView`, `views/WellnessView`.
- [x] `DeletePlanEventDialog` (scope: локально / везде).
- [x] `MirrorDeleteDialog` (mirror-delete plan_events с чекбоксами).
- [x] `utils/groupRunFacts` — общая группировка ±30 мин.

### Данные
- [x] ~2530 записей `run_facts`.
- [x] 1053 strava-csv (2018–2026).
- [x] 264 Zepp FIT.
- [x] 265 ICU с полным FIT-обогащением.
- [x] 1000+ recovery_logs из двух источников.
- [x] 8 plan_events.

## Что НЕ делаем сейчас
- Google Fit — отложено.
- Погода ICU — нет данных.
- 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- Live-журнал — отдельный PWA-проект (бег + силовая,
  см. новое направление 12).


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-10-02

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — **99%**. Источники: dodofo, Strava-архив
  (FIT+TCX+CSV), intervals.icu (activities + streams +
  thresholds + wellness), Zepp FIT-папка. Полный UI,
  группировка, фильтры, drawer.
- **08 (Melange)** — v1 → **v12**.
- Бизнес-логика (02–06) — не начата.

## Ключевые цифры (на 2026-10-02)

| Источник | origin | Записей |
|---|---|---|
| dodofo | — | 260 |
| fit | strava-archive | 68 |
| fit | manual-import | 2 |
| fit | zepp-app | 264 |
| tcx | strava-archive | 617 |
| intervals-icu | intervals-icu | 265 |
| strava-csv | strava-archive | 1053 |
| **Итого run_facts** | | **~2530** |
| run_streams (файлы .msgpack) | | ~200 МБ |
| recovery_logs (intervals.icu) | | 11+ |

**Уникальных дат пробежек:** ~900+ (после добавления strava-csv).

## Источники данных

| Источник | Роль | Что даёт | Статус |
|---|---|---|---|
| **dodofo.ru** | агрегатор | workouts, streams, thresholds (resthr) | работает |
| **Strava-архив FIT/TCX** | файлы | workouts + streams (полные) | работает |
| **Strava activities.csv** | метаданные | workouts без потоков | работает |
| **intervals.icu** | агрегатор | workouts + streams + thresholds + wellness | работает |
| **Zepp FIT-папка** | Yandex.Disk | workouts + streams (ручные выгрузки) | работает |
| **Zepp-direct** | часы | workouts, streams, сон, HRV | TODO |
| **Google Fit** | отложено | — | отложено |

## Решения (ADR-стиль — новые за 2026-10-02)

### 2026-10-01 — Fix INSERT в `runFactsRepo`
- Позиции значений не совпадали с колонками (сдвиг на 5).
- У всех ICU-записей `external_id IS NULL`. Дедуп не работал.
- Фикс: значения возвращены на позиции.

### 2026-10-01 — COALESCE-семантика в UPDATE `run_facts`
- `sync-now` (только список) больше не затирает FIT-обогащение.
- `COALESCE(?, col)` для всех не-идентификационных полей.

### 2026-10-01 — TCX fallback: duration/distance из trackpoints
- 214 записей имели `duration_sec=0`, `actual_pace=NULL`.
- Каскад «лапы → trackpoints» починил.

### 2026-10-01 — Разделение `sync-now` и загрузки потоков
- `sync-now` тянет список (1 HTTP, ~2 сек).
- FIT-обогащение + потоки — `pb:sync-run-streams-all`
  с прогрессом и отменой.

### 2026-10-01 — Melange v10: source tracking порогов
- `lthr_source`, `max_hr_source`, `resting_hr_source`.
- `pickNum` в `updateProfile`: value changed + no source → `manual`;
  value + source → оба пишутся; value unchanged → source сохраняется.

### 2026-10-02 — Melange v11: `name` / `user_name`
- `run_facts.name` — провайдерское (ICU, dodofo, Strava CSV).
- `run_facts.user_name` — только пользователь, никогда не перезаписывается.
- UI: колонка «Название», drawer — единое имя тренировки над вкладками
  с inline редактором и копированием провайдерского.

### 2026-10-02 — Strava `activities.csv` как источник
- Новый `source='strava-csv'`, `origin='strava-archive'`.
- `external_id = strava-csv:<file_id>` (совпадает суффиксом с fit/tcx).
- Даты в CSV хранятся в UTC (не Moscow local).
- Фильтр по типу «Бег»: 1053 из 1162 строк.

### 2026-10-02 — Zepp FIT-папка
- Вторая папка в «Импорт файлов», `origin='zepp-app'`.
- Дедуп только по `(source, external_id)`, без time-window.
  Zepp coexists с Strava-архивом для одной тренировки —
  это intentional (multi-source модель).
- `sourceBadge(source, origin)` → `zepp` (циан) в таблице.

### 2026-10-02 — Фильтры пробежек
- Панель над таблицей, состояние в localStorage.
- Поиск по `displayName` + провайдерским `name` (только в выбранных
  источниках). Debounce 300ms.
- Чипы-источники работают одновременно как фильтр групп и как
  scope поиска.

### 2026-10-02 — Окно группировки 30 → 5 минут
- 30 мин склеивало две разные тренировки (случайный старт часов +
  реальная пробежка через 3 мин) в одну строку с 9 бейджами.
- 5 мин покрывает реальные задержки между источниками без merge.

## Открытые вопросы

1. Критерии перехода между ступенями Big-6.
2. Тайминги стойки (30/60/120 s).
3. Формат данных от dodofo wellness — ждём ответ разработчика.
4. Live-журнал: голосовой ввод.
5. ICU events / plan — структура и объём.
6. Дедупликация между агрегаторами (v10+).

## Ближайшие задачи

1. **HR-зоны + окраска.** `pb:sync-zones`, `RunStreamsChart`
   с сегментацией по зонам, `GpsMapView` с окраской трека,
   полоса зон под графиком.
2. **ICU events / plan.** `fetchEvents`, `plan_events` (v13),
   `pb:sync-plan`, панель «План». Задел под Mentat.
3. **Автосинхронизация при старте.**
4. **Расчёт LTHR / threshold pace** — после CHARTS-чата.
5. **Модель A группировки** — день как заголовок, тренировки
   под ним. Делать вместе с календарём «план-факт».

## Что сделано (полный список)

### Инфраструктура
- [x] Архитектура, имена, источники.
- [x] Промты 00–09.
- [x] Каркас `services/pranaBindu/`, `components/PRANA_BINDU/`.
- [x] 09 (Electron Shell).

### Melange
- [x] v1–v12: базовые таблицы, dodofo, run_streams, origin,
      fit_archive_path, start_time, gps_quality, recovery_fields,
      intervals_icu, source tracking порогов, name/user_name,
      zepp_archive_path.
- [x] Репозитории: `profileRepo`, `syncRepo`, `runFactsRepo`,
      `runStreamsRepo`, `recoveryRepo`.

### Провайдеры
- [x] `DodofoProvider` — workouts, streams, thresholds, zones.
- [x] `IntervalsIcuProvider` — workouts, streams, thresholds,
      wellness (+ `fetchEvents` — заглушка).
- [x] `DofekZeppProvider`, `mcpProvider`, `bridgeProvider` — каркас.
- [x] Capabilities у всех.
- [x] `regionDetector.ts` — автодетект Zepp-хоста.

### Парсеры
- [x] `UnifiedWorkout`, `RawWorkout`.
- [x] `fitParser.ts`, `tcxParser.ts`, `stravaCsvParser.ts`.
- [x] `gpsClassifier.ts`, `workoutValidator.ts`.

### Хранилище
- [x] `runStreamsStorage.ts` — .msgpack файлы.
- [x] `extractMeta` распознаёт `latlng`.

### IPC
- [x] Провайдеры, профиль, синхронизация, потоки, импорт, отладка.
- [x] `pb:import-strava-csv`, `pb:pick-csv`.
- [x] `pb:import-zepp-dir`, `pb:zepp-archive-path-get/set`.
- [x] `pb:update-run-fact-name`, `pb:update-run-group-name`.
- [x] `pb:sync-progress`, `pb:sync-cancel`.

### UI
- [x] Панели «Подключения», «Синхронизация (API)», «Импорт файлов»,
      «Wellness», «Профиль».
- [x] Таблица «Пробежки» — группировка ±5 мин, бейджи, фильтры,
      колонка «Название».
- [x] Панель фильтров — поиск, чипы-источники, диапазоны, потоки,
      debounce, localStorage.
- [x] Drawer — название над вкладками, «Провайдерское: …» внутри,
      карта, график, потоки.
- [x] `RunStreamsChart`, `GpsMapView`, `DodofoDebugDialog`.
- [x] Прогресс-бары импорта FIT / Zepp / sync-streams.
- [x] Бейдж `zepp` (циан), `intervals-icu` (красный),
      `strava-csv` (фиолетовый).

### Данные
- [x] ~2530 записей `run_facts`.
- [x] ~200 МБ `run_streams`.
- [x] 265 ICU с полным FIT-обогащением и потоками.
- [x] 1053 strava-csv (2018–2026).
- [x] 264 Zepp FIT из Yandex.Disk.

## Что НЕ делаем сейчас
- Google Fit — отложено.
- Погода ICU — нет данных.
- 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- Live-журнал — отдельный проект.
- Мобильная версия.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-10-01

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — **98%**. Данные из 4+ источников (dodofo,
  Strava-архив, intervals.icu, Zepp-ручные FIT — в подготовке),
  wellness через intervals.icu, карта GPS, графики. Полный
  ICU-провайдер (workouts + streams + wellness) работает.
- **08 (Melange)** — v1 → **v9**. Все основные репозитории готовы.
- Бизнес-логика (02, 03, 04, 05, 06) — не начата.

## Ключевые цифры (на 2026-10-01)

**Данные в БД `prana_bindu.db`:**

| Источник | origin | Записей |
|---|---|---|
| dodofo | — | 260 |
| fit | strava-archive | 68 |
| fit | manual-import | 1 |
| fit | zepp-app | 1 |
| tcx | strava-archive | 617 |
| intervals-icu | intervals-icu | 265 |
| **Итого run_facts** | | **~1212** |
| run_streams (файлы .msgpack) | | ~100 МБ |
| recovery_logs (intervals.icu) | | 11+ |

**Уникальных дат пробежек:** ~700+.

**GPS-качество FIT/TCX:** обновлено с учётом ICU-записей; большинство
активностей ICU имеют `gps_quality=good` (по coverage ≥ 95 %),
часть — `poor` (акселерометр), единичные — `lost`.

## Источники данных (актуально)

| Источник | Роль | Что даёт | Статус |
|---|---|---|---|
| **dodofo.ru** | агрегатор | workouts, streams, thresholds (только resthr), zones (пусто) | работает |
| **Strava-архив** | FIT/TCX файлы | workouts + streams (полные) | работает |
| **intervals.icu** | агрегатор | **workouts + streams + wellness** (сон, RHR, CTL/ATL) | работает |
| **Zepp-direct** | часы | workouts, streams, сон, HRV | TODO |
| **Ручной Zepp FIT** | папка с .fit | workouts + streams | в подготовке |
| **Ручной** | fallback | ручной ввод | позже |
| **Google Fit** | отложено | — | отложено |

**Важно:** dodofo исправил HR-баг. Новые тренировки приходят
с живым HR-каналом. Мониторить.

## Решения (ADR-стиль — новые за 2026-10-01)

### 2026-10-01 — Fix INSERT в `runFactsRepo`
- **Проблема:** колонки `external_id / raw_json / gps_quality /
  distance_source / gps_coverage_pct` в INSERT-ветке были
  перепутаны с позициями значений. У источников, где
  `gpsQuality=undefined` (ICU), `external_id` записывался как
  NULL, `raw_json` не писался, `gps_coverage_pct` содержал мусор.
- **Симптом:** у всех 265 ICU-записей `external_id IS NULL`,
  дедупликация не работала.
- **Фикс:** значения возвращены на свои позиции.

### 2026-10-01 — COALESCE-семантика в UPDATE `run_facts`
- **Причина:** после разделения `sync-now` (только список) и
  `sync-run-streams-all` (FIT + потоки + обогащение), повторный
  `sync-now` мог затирать FIT-обогащённые поля (`actual_km`,
  `avg_hr`, `gps_quality`) нулями/`null` из списка.
- **Решение:** в UPDATE-ветке — `COALESCE(?, col)` для всех
  не-идентификационных полей. Null из источника не затирает
  существующее значение.

### 2026-10-01 — TCX fallback: duration/distance из trackpoints
- **Проблема:** у 214 записей `tcx` (Strava-архив) `duration_sec = 0`
  и `actual_pace IS NULL`. В их TCX лапы есть, но `TotalTimeSeconds`
  пусто. Каскад «лапы → trackpoints» не срабатывал, потому что
  `lapsRaw.length > 0`.
- **Фикс:** после агрегации по лапам, если `durationSec <= 0` или
  `distanceM <= 0` — берём из диапазона `secT` и накопленной
  дистанции trackpoints.
- **Побочно:** ушли ложные флаги `duration_mismatch`.

### 2026-10-01 — Разделение `sync-now` и загрузки потоков
- **Причина:** `pb:sync-now` для ICU качал FIT каждой активности
  в том же цикле. 265 записей → ~18 минут блокирующего IPC без
  прогресса.
- **Решение:** `sync-now` тянет только список (1 HTTP, ~2 сек).
  FIT-обогащение + потоки — отдельный `pb:sync-run-streams-all`
  с прогрессом (`pb:sync-progress`) и отменой (`pb:sync-cancel`).

### 2026-10-01 — Provider-aware `sync-run-streams-all`
- Один хендлер обслуживает dodofo и intervals-icu.
- Для ICU: `fetchUnifiedWorkout(activityId)` → FIT → наш парсер →
  `run_streams` + обогащение `run_facts`.
- Потоки от ICU пишутся с `run_streams.source='fit'`
  (это FIT-файл, просто получен через ICU).
- Прогресс-бар в UI по образцу импорта FIT.

### 2026-10-01 — `extractMeta` распознаёт `latlng`
- `channels` в метаданных `run_streams` теперь включает `latlng`
  как отдельный вид (пары координат). Раньше фильтр «только
  числовые массивы» его отбрасывал.

## Открытые вопросы

1. Критерии перехода между ступенями Big-6.
2. Тайминги стойки (30/60/120 s).
3. Формат данных от dodofo wellness — **ждём ответ разработчика**.
4. Live-журнал: голосовой ввод.
5. ICU events / plan: разобрать формат и решить, что делаем
   в Melange v10 (`plan_events`).
6. Дедупликация между агрегаторами (dodofo vs ICU vs Strava).
   Возможно, свой `run_events` в v10+.

## Ближайшие задачи

1. **UI: панель «Активности · intervals.icu»** — отдельная секция
   с двумя кнопками («Обновить список» / «Загрузить потоки»),
   прогресс-баром и мини-таблицей.
2. **Импорт Strava `activities.csv`** — `source='strava-csv'`.
3. **Zepp FIT-папка** — вторая папка в FIT-архив,
   `origin='zepp-app'`.
4. **ICU events / plan** — `fetchEvents`, `plan_events`,
   `pb:sync-plan`.
5. **Валидатор в UI** — флаги в drawer.
6. **Авто-синхронизация при старте.**
7. **Zepp-direct** — если dodofo/ICU не покроют.
8. **Модель A группировки пробежек:** день как заголовок, тренировки под ним.
   В шапке дня — агрегаты (всего км, время, источники). 
   Клик по тренировке — drawer с источниками. 
   Клик по дню (в будущем) — дневной обзор (wellness + погода + сводка).
   Делать вместе с календарём «план-факт».

## Что сделано (полный список)

### Инфраструктура
- [x] Архитектура, имена, источники.
- [x] Промты 00–09.
- [x] Каркас `services/pranaBindu/`, `components/PRANA_BINDU/`.
- [x] 09 (Electron Shell).

### Melange
- [x] v1 — базовые таблицы.
- [x] v2 — dodofo-колонки.
- [x] v3 — `run_streams` (MessagePack-файлы).
- [x] v4 — `origin` в `run_facts`.
- [x] v5 — `fit_archive_path`.
- [x] v6 — `start_time` в `run_facts`.
- [x] v7 — `gps_quality`, `distance_source`, `gps_coverage_pct`.
- [x] v8 — расширение `recovery_logs` (сон, вес, battery).
- [x] v9 — intervals.icu (ctl, atl, readiness, + sync_settings).
- [x] Репозитории: `profileRepo`, `syncRepo`, `runFactsRepo`,
      `runStreamsRepo`, `recoveryRepo`.

### Провайдеры
- [x] `DodofoProvider` — workouts, streams, thresholds, zones.
- [x] `IntervalsIcuProvider` — workouts, streams, wellness
      (+ `fetchEvents` — заглушка).
- [x] `DofekZeppProvider` — каркас.
- [x] `mcpProvider`, `bridgeProvider` — заглушки.
- [x] Capabilities у всех.
- [x] `regionDetector.ts` — автодетект Zepp-хоста.

### Парсеры
- [x] `UnifiedWorkout` (camelCase: `secT`, `distM`).
- [x] `fitParser.ts` — Zepp/Garmin/Coros.
- [x] `tcxParser.ts` — Strava/Garmin/Polar.
- [x] `tcxParser` — каскад «лапы → trackpoints» для duration/distance.
- [x] Автоопределение `.fit` / `.tcx`, поддержка `.gz`.
- [x] `gpsClassifier.ts` — haversine, coveragePct, good/poor/lost.
- [x] `workoutValidator.ts` — 8 флагов + confidence.

### Хранилище
- [x] `runStreamsStorage.ts` — .msgpack файлы.
- [x] `extractMeta` распознаёт `latlng` как канал.
- [x] `runStreamsRepo.ts` — метаданные.

### IPC
- [x] Провайдеры: `pb:dodofo-connect`, `pb:zepp-connect`,
      `pb:provider-capabilities`, `pb:intervals-setup`,
      `pb:intervals-status`.
- [x] Профиль: `pb:get-profile`, `pb:update-profile`.
- [x] Синхронизация: `pb:sync-now` (provider-aware),
      `pb:sync-thresholds`, `pb:sync-wellness` (provider-aware).
- [x] Тренировки: `pb:list-run-facts`, `pb:list-run-facts-by-date`.
- [x] Потоки: `pb:sync-run-streams` (provider-aware),
      `pb:sync-run-streams-all` (provider-aware + прогресс),
      `pb:sync-cancel`, `pb:get-run-streams-meta`,
      `pb:get-run-streams`, `pb:list-run-streams-batch`.
- [x] Импорт: `pb:import-fit`, `pb:import-files`, `pb:import-fit-dir`,
      `pb:import-cancel`, `pb:pick-files`, `pb:pick-directory`,
      `pb:fit-archive-path-get`.
- [x] Отладка: `pb:debug-streams`, `pb:debug-thresholds`,
      `pb:debug-zones`, `pb:debug-parse-fit` (FIT+TCX+.gz),
      `pb:debug-daily`, `pb:debug-wellness`, `pb:backfill-start-time`,
      `pb:debug-icu-activities`, `pb:debug-icu-activity`,
      `pb:debug-icu-streams`, `pb:debug-icu-events`,
      `pb:debug-icu-workouts`, `pb:debug-icu-workout`.
- [x] Wellness: `pb:list-recovery-logs`.
- [x] События: `pb:import-progress`, `pb:sync-progress`.

### UI
- [x] Форма «Синхронизация» по провайдеру (dodofo / intervals-icu /
      dofek-zepp).
- [x] Панель «Профиль» (maxHr, lthr, restingHr).
- [x] Панель «Wellness · intervals.icu» + мини-таблица.
- [x] Панель «FIT-архив» + drag&drop + origin.
- [x] Прогресс-бар импорта с отменой.
- [x] Прогресс-бар sync потоков с отменой.
- [x] Таблица «Пробежки» — группировка по дате, виртуализация,
      сохранение периода, «30 дней» / «За всё время».
- [x] Бейджи источников (включая `intervals-icu` с icu-red).
- [x] Drawer сравнения (TabView источников).
- [x] `RunStreamsChart` — HR, темп, каденс, высота.
- [x] `GpsMapView` — MapLibre GL + OpenFreeMap.
- [x] Dialog «Отладка» — 3 таба + анализ плоских каналов.

### Данные
- [x] ~1212 записей `run_facts`.
- [x] ~100 МБ `run_streams`.
- [x] ~700+ уникальных дат.
- [x] 11+ дней wellness.
- [x] 265 записей ICU с FIT-обогащением и потоками.

## Что НЕ делаем сейчас
- Google Fit — отложено.
- 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- Live-журнал — отдельный проект.
- Мобильная версия.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-09-30 (поздний вечер)

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — **готов на 95%**. Данные из 3+ источников,
  wellness через intervals.icu, карта GPS, графики.
- **08 (Melange)** — v1 → **v9**. Все основные репозитории готовы.
- Бизнес-логика (02, 03, 04, 05, 06) — не начата.

## Ключевые цифры (на 2026-09-30)

**Данные в БД `prana_bindu.db`:**

| Источник | origin | Записей |
|---|---|---|
| dodofo | — | 260 |
| fit | strava-archive | 68 |
| fit | manual-import | 1 |
| fit | zepp-app | 1 |
| tcx | strava-archive | 617 |
| **Итого run_facts** | | **~948** |
| run_streams (файлы .msgpack) | | 74 МБ |
| recovery_logs (intervals.icu) | | 11+ |

**Уникальных дат пробежек:** 637.

**GPS-качество FIT/TCX:**
- `good` — 610
- `poor` — 64
- `lost` — 12
- `null` — 3 (manual/zepp-app, ещё не переимпортированы)

## Источники данных (актуально)

| Источник | Роль | Что даёт | Статус |
|---|---|---|---|
| **dodofo.ru** | агрегатор | workouts, streams, thresholds (только resthr), zones (пусто) | работает |
| **Strava-архив** | FIT/TCX файлы | workouts + streams (полные) | работает |
| **intervals.icu** | агрегатор | **wellness** (сон, RHR, CTL/ATL) | частично |
| **Zepp-direct** | часы | workouts, streams, сон, HRV | TODO |
| **Ручной** | fallback | ручной ввод | позже |
| **Google Fit** | отложено | — | отложено |

**Важно:** dodofo **исправил HR-баг**. Новые тренировки приходят
с живым HR-каналом. Мониторить.

## Решения (ADR-стиль — новые за 2026-09-29/30)

### 2026-09-29 — Capabilities у провайдеров
- Обязательное поле `capabilities`: workouts, streams, thresholds,
  zones, wellness.
- UI включает/выключает кнопки. Backend защищает: `pb:sync-thresholds('zepp-mcp')` → ошибка.

### 2026-09-29 — `run_streams` — файловое хранилище (Melange v3)
- Метаданные в SQLite (`run_streams`), payload — `.msgpack` на диске.
- Путь: `{userData}/prana_bindu/run_streams/{source}/{YYYY}/{id}.msgpack`.
- Один файл на `(run_fact_id, source)`. Multi-source.
- Паттерн — как OSINT `rawStorage.ts`.

### 2026-09-29 — Multi-source модель
- `run_facts` может иметь несколько записей на одну тренировку.
- `origin` — откуда пришёл файл (`strava-archive`, `zepp-app`,
  `manual-import`). Не перезаписывается.
- UI: группировка по `(date, start_time ± 30 мин)`, в drawer —
  вкладки источников.
- Порог 30 мин — `SAME_WORKOUT_WINDOW_MIN`, вынести в настройки позже.

### 2026-09-29 — Универсальный импорт FIT/TCX
- `pb:import-fit` (1 файл), `pb:import-files` (много),
  `pb:import-fit-dir` (папка).
- Прогресс через IPC-событие `pb:import-progress`. Отмена через
  `pb:import-cancel`. Выбор origin в UI.
- Дедупликация: `(source, external_id)`.

### 2026-09-30 — dodofo исправил HR-баг
- Новые тренировки приходят с живым HR.
- **Мониторить.** Если вернётся — доказательства сохранены.

### 2026-09-30 — intervals.icu как источник wellness
- Причина: dodofo не отдаёт сон, HRV, RHR (все null).
- Реализовано: `IntervalsIcuProvider.fetchWellness`,
  `pb:intervals-setup`, `pb:sync-wellness` (provider-aware).
- Auth: Basic (`API_KEY:<ключ>`).
- Ключ в `sync_settings.intervals_api_key` (safeStorage).
- Данные: `resting_hr`, `sleep_hours`, `sleep_score`, `steps`,
  `ctl`, `atl`, `ramp_rate`, + десятки опциональных полей.
- **TODO:** workouts, streams, plan (`/events`).

### 2026-09-30 — Карта GPS (MapLibre GL + OpenFreeMap)
- `GpsMapView.tsx` — трек, маркеры старта/финиша.
- Тёмная подложка OpenFreeMap (CARTO требует ключ).
- CSP обновлён: `*.openfreemap.org`, `*.basemaps.cartocdn.com`.
- Fallback для missing sprite images.

### 2026-09-30 — Wellness UI
- Панель «Wellness · intervals.icu» — API-ключ, кнопка синка,
  мини-таблица последних 14 дней (RHR / сон / score / шаги /
  CTL / ATL).
- Цветовая индикация RHR относительно среднего.

### 2026-09-30 — Стили и компоненты — отдельные чаты
- `docs/prompts/_shared/STYLES_CONVENTION.md` — черновик.
- `docs/prompts/_shared/COMPONENTS_CONVENTION.md` — черновик.
- `docs/prompts/_shared/CHARTS_CHAT_START.md` — черновик.
- Ключевой принцип: **только глупые компоненты (props-only)**.
  Масштабируемость на другие проекты.

## Открытые вопросы

1. Критерии перехода между ступенями Big-6.
2. Тайминги стойки (30/60/120 s).
3. Формат данных от dodofo wellness — **ждём ответ разработчика**.
4. Live-журнал: голосовой ввод.
5. **intervals.icu как полный провайдер** — workouts, streams, plan.
6. Дедупликация между агрегаторами (dodofo vs intervals.icu vs
   Strava-архив). Возможно, свой `run_events` в v10+.

## Ближайшие задачи

1. **intervals.icu — full provider** (workouts, streams, plan).
2. **`pb:sync-plan`** — календарь и план (`/events`). Задел под Mentat.
3. **Валидатор в UI** — флаги в drawer (уже есть в БД).
4. **Авто-синхронизация при старте.**
5. **Обновление markdown** ✅ (этот коммит).
6. **Zepp-client direct** — если dodofo/ICU не покроют.

## Что сделано (полный список)

### Инфраструктура
- [x] Архитектура, имена, источники.
- [x] Промты 00–09.
- [x] Каркас `services/pranaBindu/`, `components/PRANA_BINDU/`.
- [x] 09 (Electron Shell).

### Melange
- [x] v1 — базовые таблицы.
- [x] v2 — dodofo-колонки.
- [x] v3 — `run_streams` (MessagePack-файлы).
- [x] v4 — `origin` в `run_facts`.
- [x] v5 — `fit_archive_path`.
- [x] v6 — `start_time` в `run_facts`.
- [x] v7 — `gps_quality`, `distance_source`, `gps_coverage_pct`.
- [x] v8 — расширение `recovery_logs` (сон, вес, battery).
- [x] v9 — intervals.icu (ctl, atl, readiness, + sync_settings).
- [x] Репозитории: `profileRepo`, `syncRepo`, `runFactsRepo`,
      `runStreamsRepo`, `recoveryRepo`.

### Провайдеры
- [x] `DodofoProvider` — workouts, streams, thresholds, zones.
- [x] `IntervalsIcuProvider` — wellness (workouts/streams/plan — TODO).
- [x] `DofekZeppProvider` — каркас.
- [x] `mcpProvider`, `bridgeProvider` — заглушки.
- [x] Capabilities у всех.
- [x] `regionDetector.ts` — автодетект Zepp-хоста.

### Парсеры
- [x] `UnifiedWorkout` (camelCase: `secT`, `distM`).
- [x] `fitParser.ts` — Zepp/Garmin/Coros.
- [x] `tcxParser.ts` — Strava/Garmin/Polar.
- [x] Автоопределение `.fit` / `.tcx`, поддержка `.gz`.
- [x] `gpsClassifier.ts` — haversine, coveragePct, good/poor/lost.
- [x] `workoutValidator.ts` — 8 флагов + confidence.

### Хранилище
- [x] `runStreamsStorage.ts` — .msgpack файлы.
- [x] `runStreamsRepo.ts` — метаданные.

### IPC
- [x] Провайдеры: `pb:dodofo-connect`, `pb:zepp-connect`,
      `pb:provider-capabilities`, `pb:intervals-setup`,
      `pb:intervals-status`.
- [x] Профиль: `pb:get-profile`, `pb:update-profile`.
- [x] Синхронизация: `pb:sync-now`, `pb:sync-thresholds`,
      `pb:sync-wellness` (provider-aware).
- [x] Тренировки: `pb:list-run-facts`, `pb:list-run-facts-by-date`.
- [x] Потоки: `pb:sync-run-streams`, `pb:sync-run-streams-all`,
      `pb:get-run-streams-meta`, `pb:get-run-streams`,
      `pb:list-run-streams-batch`.
- [x] Импорт: `pb:import-fit`, `pb:import-files`, `pb:import-fit-dir`,
      `pb:import-cancel`, `pb:pick-files`, `pb:pick-directory`,
      `pb:fit-archive-path-get`.
- [x] Отладка: `pb:debug-streams`, `pb:debug-thresholds`,
      `pb:debug-zones`, `pb:debug-parse-fit`, `pb:debug-daily`,
      `pb:debug-wellness`, `pb:backfill-start-time`.
- [x] Wellness: `pb:list-recovery-logs`.
- [x] События: `pb:import-progress`.

### UI
- [x] Форма «Синхронизация» по провайдеру.
- [x] Панель «Профиль» (maxHr, lthr, restingHr).
- [x] Панель «Wellness · intervals.icu» + мини-таблица.
- [x] Панель «FIT-архив» + drag&drop + origin.
- [x] Прогресс-бар импорта с отменой.
- [x] Таблица «Пробежки» — группировка по дате, виртуализация,
      сохранение периода, «30 дней» / «За всё время».
- [x] Бейджи источников.
- [x] Drawer сравнения (TabView источников).
- [x] `RunStreamsChart` — HR, темп, каденс, высота.
- [x] `GpsMapView` — MapLibre GL + OpenFreeMap.
- [x] Dialog «Отладка» — 3 таба + анализ плоских каналов.

### Данные
- [x] 948 записей `run_facts`.
- [x] 74 МБ `run_streams`.
- [x] 637 уникальных дат.
- [x] 11+ дней wellness.

## Что НЕ делаем сейчас
- Google Fit — отложено.
- 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- Live-журнал — отдельный проект.
- Мобильная версия.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-09-30

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
- **09 (Electron Shell)** — завершён.
- **07 (Spice)** — активная разработка. Импорт FIT/TCX, run_streams,
  UI-таблица, drawer сравнения, ручной импорт, графики — работают.
- **08 (Melange)** — v1 → **v6** готовы.
- Бизнес-логика (02, 03, 04, 05, 06) — не начата.

## Контекст
- **Цель:** марафон 42,2 км 27.09.2027 (восьмой). Седьмой — 5:56:01.
- **Задача:** снизить темп и пульс на заданном темпе.
- Параллельно — Big-6.
- Методология: 80/20 + SIRPOC + Big-6.
- Цель по весу: сбросить ~3 сек/км на каждый кг.
- Слабое место: стопы (ныли на 30+ км).

## Марафон 27.09.2026 — факты

**Финиш:** 5:56:01.
**Пульс:** 145–155 вместо 134–142.
**Тактика:** первые 2 км слишком быстро; сброс до 8:15–8:30.
**Питание:** финики с 15 км каждые 5 км, лимонный гель на 30 км.

**Проблемы данных:** были искажены в dodofo (пульс, мощность,
темп, высота). Разработчик сообщил об исправлении. **Мониторить
новые тренировки.**

**Вывод:** FIT/TCX — эталон для сравнения алгоритмов агрегаторов.

## Решения (ADR-стиль)

### 2026-09-22 — Архитектура модуля
- Отдельный модуль, новый IPC-префикс `pb:*`, БД `prana_bindu.db`.

### 2026-09-22 — Внутренние имена
- Prana-Bindu, Stillsuit, Crysknife, Mentat, Water Discipline,
  Spice, Melange.

### 2026-09-23 — Провайдеры Zepp
- `dofek-zepp` (резерв), `zepp-mcp`/`zeppbridge` (заглушки).
- `regionDetector.ts`, перебор хостов.

### 2026-09-26 — dodofo.ru как источник
- Bearer-токен, только чтение.
- Токен в `sync_settings.dodofo_token` (safeStorage).

### 2026-09-28 — FIT/TCX импорт
- Парсеры `fitParser.ts`, `tcxParser.ts`.
- GPS-классификатор `gpsClassifier.ts`.
- Валидатор `workoutValidator.ts`.
- Единый формат `UnifiedWorkout`.

### 2026-09-28 — Два режима GPS
- `good` / `poor` / `lost`, классификация при импорте.

### 2026-09-28 — Live-журнал — отдельный проект
- PWA, offline-first, экспорт JSON.

### 2026-09-28 — Приоритизация 15 идей с марафона
- Берём сразу: валидатор, FIT/TCX, анализ зон, факт-vs-план,
  live-журнал.
- Отброшено: #10 (дубль 11_RECOMMENDER).

### 2026-09-29 — Multi-source модель
- `run_facts` может иметь несколько записей на одну тренировку
  (по разным source).
- `origin` — откуда файл пришёл (`strava-archive`, `zepp-app`,
  `manual-import`, ...). Не перезаписывается при повторных импортах.
- В UI — группировка по `(date, start_time ± 30 мин)`,
  в drawer — вкладки источников.
- Порог 30 мин — константа `SAME_WORKOUT_WINDOW_MIN`.
  Вынести в настройки позже.

### 2026-09-29 — Capabilities провайдеров
- Обязательное поле `capabilities` у `ZeppDataProvider`:
  `workouts`, `streams`, `thresholds`, `zones`, `wellness`.
- UI включает/выключает кнопки по capabilities.
- Backend защищает: `pb:sync-thresholds('zepp-mcp')` → ошибка.

### 2026-09-29 — `run_streams` — файловое хранилище
- Метаданные в SQLite (`run_streams`), payload в `.msgpack`
  на диске.
- Путь: `{userData}/prana_bindu/run_streams/{source}/{YYYY}/{id}.msgpack`.
- Один файл на (run_fact_id, source). Поддержка multi-source.
- Паттерн копирует OSINT `rawStorage.ts`.

### 2026-09-29 — Универсальный импорт FIT/TCX
- `pb:import-fit` (один файл), `pb:import-files` (много),
  `pb:import-fit-dir` (папка, рекурсивно).
- Прогресс через IPC-событие `pb:import-progress`.
- Отмена через `pb:import-cancel`.
- Выбор `origin` в UI перед импортом.

### 2026-09-30 — dodofo исправил HR-баг
- Разработчик сообщил об исправлении.
- Новые тренировки должны приходить с живым HR.
- **Мониторить.** Если баг вернётся — данные для письма сохранены.

### 2026-09-30 — intervals.icu — будущий источник
- Открытое API, регистрация в планах.
- Даёт план тренировок и календарь (уникально).
- Приоритет — после FIT/TCX и валидатора.

## Открытые вопросы
1. Критерии перехода между ступенями Big-6.
2. Тайминги стойки (30/60/120 s).
3. Панель деталей дня в календаре — drawer или модалка.
4. Схемы ступеней Big-6 (60 записей).
5. Формат данных от `/api/v1/wellness`.
6. Live-журнал: голосовой ввод (Web Speech API).

## Ближайшие задачи (07_SPICE)

1. **Карта GPS-трека** — MapLibre GL или Leaflet, слои: трек,
   HR-цвет, рельеф. Нужна для визуального сравнения пульса и
   рельефа.
2. **`pb:sync-wellness`** — сон, HRV, RHR → `recovery_logs`.
3. **Валидатор в UI** — показывать флаги в drawer.
4. **intervals.icu** — регистрация, OAuth/API-key, первый
   провайдер.
5. **Авто-синхронизация при старте.**
6. **Обновление markdown + промпт для компонентов.**
7. **Стили и компоненты** — отдельные чаты (см. `_shared/`).

## Что сделано

### Инфраструктура
- [x] Согласована архитектура, имена, источники.
- [x] Промты 00–09.
- [x] Каркас `services/pranaBindu/`, `components/PRANA_BINDU/`.
- [x] Разведка `@dofek/zepp-client`, `regionDetector.ts`.
- [x] 09 (Electron Shell) полностью.

### Melange
- [x] v1 — базовые таблицы.
- [x] v2 — колонки dodofo в `sync_settings`.
- [x] v3 — `run_streams` (файловое хранилище, MessagePack).
- [x] v4 — `origin` в `run_facts`.
- [x] v5 — `fit_archive_path` в `sync_settings`.
- [x] v6 — `start_time` в `run_facts`.
- [x] `runFactsRepo`, `runStreamsRepo`, `syncRepo`, `profileRepo`.
- [x] Backfill `start_time`.

### Провайдеры
- [x] `dodofoClient.ts` + `dodofoProvider.ts`.
- [x] `dofekProvider.ts` (capabilities: workouts=true, остальное false).
- [x] `mcpProvider.ts`, `bridgeProvider.ts` — заглушки.
- [x] Capabilities у всех провайдеров.
- [x] `pb:provider-capabilities`.

### FIT/TCX
- [x] `UnifiedWorkout` (camelCase: secT, distM).
- [x] `fitParser.ts` — Zepp-совместимый.
- [x] `tcxParser.ts`.
- [x] `gpsClassifier.ts` — coverage, haversine, классификация.
- [x] `workoutValidator.ts` — флаги + confidence.
- [x] `runStreamsStorage.ts` — .msgpack файлы.
- [x] `pb:import-fit`, `pb:import-files`, `pb:import-fit-dir`.
- [x] Прогресс + отмена.
- [x] UI: FIT-архив panel, drag&drop, Dropdown origin.

### UI
- [x] Форма «Синхронизация» по провайдеру.
- [x] Таблица «Пробежки» с группировкой по дате.
- [x] Бейджи источников.
- [x] Виртуализация + запоминание периода + кнопки «30 дней» /
      «За всё время».
- [x] Drawer сравнения (TabView источников одной тренировки).
- [x] `RunStreamsChart` — HR, темп, каденс, высота, дистанция.
- [x] Debug-панель (thresholds / zones / streams) + анализ
      плоских каналов.
- [x] Панель «Профиль» (maxHr, lthr, restingHr).
- [x] Кнопка «Подтянуть пороги».

### Данные в БД
- [x] **945 записей** в `run_facts`:
  - dodofo: 260;
  - fit: 71 (69 strava-archive + 1 manual-import + 1 zepp-app);
  - tcx: 617 (strava-archive).
- [x] **74 МБ** run_streams на диске.
- [x] **637 уникальных дат** пробежек.

### Что ещё не сделано
- [ ] Карта GPS-трека.
- [ ] Wellness → `recovery_logs`.
- [ ] intervals.icu.
- [ ] Авто-синхронизация при старте.
- [ ] Валидатор в UI (показать флаги).
- [ ] Стили и компоненты (отдельные чаты).
- [ ] 60 ступеней Big-6 (`05_CRYSKNIFE.md`).
- [ ] Live-журнал (отдельный проект).

## Известные ошибки (не связаны с модулем)

`npx tsc --noEmit` — 3 ошибки:
- `src/api/public.ts` — 2
- `src/shared/utils/ipcUtils.ts` — 1

Проверка Prana-Bindu:
```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-09-28

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu (тренировки тела)
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
- **09 (Electron Shell) — завершён.**
- **07 (Spice) — активная разработка.**
  Синхронизация с dodofo, `run_facts`, UI-таблица пробежек — работает.
  Следующий шаг — FIT/TCX импорт и валидатор данных.
- **08 (Melange) — v1 + v2 готовы**, планируется v3 (GPS-качество).
- Бизнес-логика (02, 03, 04, 05, 06) — не начата.

## Контекст
- **Цель:** марафон 42,2 км 27.09.2027 (восьмой). Седьмой пробежан
  27.09.2026 за 5:56:01.
- **Задача:** снизить темп и пульс на заданном темпе. Главная проблема
  по итогу 7-го марафона — бег стабильно выше марафонской зоны
  (145–155 вместо 134–142).
- Параллельно — прогресс Big-6 по ступеням калистеники.
- Методология: 80/20 + SIRPOC + Big-6, взаимный прогресс бега и силы.
- Дополнительная цель: сбросить вес (~3 сек/км на кг).
- Слабое место: стопы (ныли на 30+ км).

## Марафон 27.09.2026 — факты и выводы

**Условия:**
- Старт 9:59, кластер J. Погода: +9 °C на старте, +18 °C к финишу.
- Финиш: **5:56:01**. Отставание от реалистичного плана (5:48) — ~7 мин.

**Тактика:**
- Первые 2 км слишком быстро (6:42/км, пульс 145–147) — ошибка.
- Сброс до 8:15–8:30 на 3–5 км — пульс вернулся в 137.
- Ровные участки: 8:20–8:50.
- Подъёмы (Бородинский, Яуза, Устьинский, Крымский) — часть шагом.

**Питание:**
- Финики с 15 км, каждые 5 км по 3 шт (~5 г углеводов на штуку).
- Лимонный гель на 30 км.
- Вода 150 мл на каждом пункте питания с 5 км + литьё на голову.

**Пульс:**
- Стабильно 145–155 вместо марафонской зоны 134–142.
- На 26 км уходил в 157 — красная зона.
- На финише: 153.

**Проблемы данных (источник — dodofo):**
- Пульс по км искажён: на каждом км 133, при среднем 150.
- Мощность 10–34 Вт (невозможно для бега, норма 200–400).
- Темп на отдельных км (10:09, 13:50) не соответствует графику —
  потеря GPS или сбой агрегации.
- `elevation_gain_m` = 6704 м на 7 км — явно битое.

**Вывод:** нужен прямой импорт FIT/TCX, минуя dodofo. dodofo остаётся
как дополнительный источник и для wellness/thresholds.

## Решения (ADR-стиль)

### 2026-09-22 — Архитектура модуля
- **Решение:** Prana-Bindu строится с нуля, отдельный модуль.
- **Причина:** `training:*` — fine-tuning Ollama, не про тело.
- **Следствие:** новый IPC-префикс `pb:*`, БД `prana_bindu.db`,
  окно `pranaBinduWindow.ts`, компоненты `PRANA_BINDU/`.

### 2026-09-22 — Расположение промтов
- `docs/prompts/prana-bindu/` — отдельная папка.

### 2026-09-22 — Внутренние имена
- Зонтичное имя **Prana-Bindu**, модули: Stillsuit, Crysknife, Mentat,
  Water Discipline, Spice, Melange.

### 2026-09-23 — Провайдеры Zepp и автодетект хоста
- **Решение:** три провайдера Zepp — `dofek-zepp` (резерв),
  `zepp-mcp`, `zeppbridge` (заглушки).
- **Реализация:** `regionDetector.ts`, перебор
  `api-user.zepp.com` → `-de2` → `-us2`.
- **Статус:** работает (проверено).

### 2026-09-26 — dodofo.ru как основной источник
- **Решение:** dodofo — основной, Zepp — резерв.
- **Причина:** Bearer-токен, эндпоинты только на чтение, готовые
  LTHR, зоны Коггана, wellness из Huawei.
- **Что даёт:** `/activities`, `/streams`, `/wellness`, `/me/thresholds`,
  `/auth/me/zones`.
- **Статус:** реализовано, работает. Токен в `sync_settings.dodofo_token`
  (шифр. через `safeStorage`).

### 2026-09-27 — Марафон 7 состоялся, выявлены проблемы данных
- **Факт:** 5:56:01, пульс 145–155 (выше марафонской зоны).
- **Проблема:** данные от dodofo искажены (пульс, мощность, темп,
  высота).
- **Следствие:** в 07_SPICE приоритет №1 — FIT/TCX импорт напрямую.

### 2026-09-28 — FIT/TCX импорт как основной путь
- **Решение:** реализовать прямой импорт `.fit` и `.tcx` файлов.
  FIT — приоритет (полный набор данных), TCX — fallback.
- **Причина:** dodofo искажает ключевые метрики. Промежуточные
  сервисы — источник потери точности.
- **Следствие:**
  - новый провайдер `fileImportProvider.ts` в `spice/providers/`;
  - парсеры `fitParser.ts`, `tcxParser.ts` в `spice/parsers/`;
  - валидатор `workoutValidator.ts` в `spice/validation/`;
  - в Melange миграция **v3** — колонки `gps_quality`, `distance_source`
    в `run_facts`.

### 2026-09-28 — Два режима GPS: good / poor / lost
- **Решение:** автоматическая классификация GPS-качества при импорте.
  Три категории: `good`, `poor`, `lost`. Плюс ручной override в UI.
- **Причина:** в центре Москвы GPS глушат (СВО). Прямой трек
  недостоверен, но акселерометр часов считает дистанцию корректно.
- **Правила классификации:**
  - `good`: ≥ 95 % точек с `hdop < 3`, GPS-дистанция vs акселерометр
    расходятся < 3 %;
  - `poor`: 50–95 % валидных, расхождение 3–15 %;
  - `lost`: < 50 % валидных, или расхождение > 15 %, или пропуски
    > 500 м подряд.
- **Следствие:**
  - в `good` — дистанция/темп от GPS;
  - в `poor`/`lost` — от акселерометра (шагомер в FIT `distance`);
  - в `lost` — трек не рисуется, только метки live-журнала;
  - бейдж на карточке тренировки, override в деталях.

### 2026-09-28 — Live-журнал во время бега — отдельный проект
- **Решение:** вынести live-журнал в **отдельное веб-приложение**
  (Express.js + PWA), не встраивать в Prana-Bindu.
- **Причина:** другой контекст (телефон, offline, голос), другая
  частота использования.
- **Интеграция:** экспорт сессии из live-журнала в JSON →
  Prana-Bindu импортирует как ещё один формат.

### 2026-09-28 — Приоритизация 15 идей с марафона
- **Берём сразу:** #8 (валидатор), #9 (FIT/TCX), #14 (анализ зон),
  #2 (факт vs план), #5 (live-журнал).
- **Второй эшелон:** #1 (прогноз финиша), #7 (питание→пульс),
  #11 (сравнение источников), #4 (погода), #3 (напоминания),
  #15 (вес/КБЖУ).
- **Слить с существующим:** #6 (Crysknife для бегунов),
  #12 (архитектура Prana-Bindu), #13 (часть Crysknife).
- **Отбросить:** #10 (дубль 11_RECOMMENDER).

## Открытые вопросы
1. Критерии перехода между ступенями Big-6 — все три подхода
   на benchmark-уровне или последний?
2. Тайминги стойки (30/60/120 s) — суммарно или каждый подход?
3. Панель деталей дня в календаре — drawer или модалка?
4. Схемы ступеней Big-6 (60 записей) — нужны для `seed.ts`.
   Блокируется `05_CRYSKNIFE.md`.
5. `elevation_gain_m` от dodofo битый. Игнорировать, брать из FIT
   или считать самим? — после первого FIT-импорта.
6. Формат данных от `/api/v1/wellness` (JSON) — уточнить, когда
   дойдём до wellness-синка.
7. Выносить ли streams в отдельную таблицу `run_streams` (Melange v4)?
   Решение — после работающего FIT-импорта.
8. Live-журнал: голосовой ввод Web Speech API работает не везде
   (iPhone Safari ограничен). Проверить на своём телефоне.

## Ближайшие задачи (07_SPICE — приоритет)

1. **`spice/parsers/fitParser.ts`** — парсинг `.fit` через
   `fit-file-parser`.
2. **`spice/parsers/tcxParser.ts`** — парсинг `.tcx` через
   `fast-xml-parser`.
3. **`UnifiedWorkout`** — единый внутренний формат (в `parsers/types.ts`).
4. **`spice/validation/workoutValidator.ts`** — валидатор данных
   с флагами `hr_flatline`, `power_out_of_range`, `pace_anomaly`,
   `elevation_suspicious`.
5. **Классификатор GPS-качества** — `gps_quality: good | poor | lost`.
6. **Melange v3:** миграция + три колонки в `run_facts`.
7. **`runFactsRepo.upsertFromUnified(...)`** — расширенный маппинг.
8. **`pb:import-file(filePath)`** — ручной импорт FIT/TCX.
9. **UI:** drag&drop файла, предпросмотр, подтверждение.
10. **`pb:sync-thresholds`** — LTHR/HRmax/RestHR → `profile`.
11. **`pb:sync-wellness`** — сон/HRV/пульс покоя → `recovery_logs`.

## Что сделано
- [x] Согласована архитектура, имена, источники.
- [x] Написаны `00_MASTER_INDEX.md`, `01_COMMON_CONTEXT.md`,
      `PROJECT_STATE.md`, `07_SPICE.md`, `08_MELANGE.md`,
      `09_ELECTRON_SHELL.md`.
- [x] Каркас `services/pranaBindu/` и `components/PRANA_BINDU/`.
- [x] Разведка `@dofek/zepp-client`, `regionDetector.ts`.
- [x] Направление 09 полностью.
- [x] Melange v1 + v2.
- [x] `dodofoClient.ts` + `dodofoProvider.ts`.
- [x] IPC `pb:dodofo-connect`, `pb:dodofo-token-status`.
- [x] UI: форма «Синхронизация» меняется по провайдеру.
- [x] Токен dodofo сохранён и проверен.
- [x] `runFactsRepo.ts` + `pb:sync-now` + UI-таблица.
- [x] Ручная проверка синка: 14 тренировок за сентябрь 2026,
      повтор → 0 added / 14 update.
- [ ] FIT/TCX парсеры.
- [ ] Валидатор данных.
- [ ] GPS-качество (v3).
- [ ] Thresholds → `profile`.
- [ ] Wellness → `recovery_logs`.
- [ ] Live-журнал (отдельный проект).

## Известные ошибки (не связаны с модулем)
`npx tsc --noEmit` — 3 ошибки в 2 наших файлах:
- `src/api/public.ts` — 2
- `src/shared/utils/ipcUtils.ts` — 1

Проверка типов Prana-Bindu:
```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
```
Пусто = наш код чистый.

## Что НЕ делаем сейчас
- Не трогаем `training:*`, `osint:*`, `trading:*` и прочие модули.
- Не делаем мобильную версию (live-журнал — отдельно, как PWA).
- Не публикуем с именами из «Дюны».
- Google Fit OAuth — приоритет ниже FIT/TCX.
- 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.
- #15 (вес/КБЖУ) — только после работающего FIT-импорта и зон.


=============================

# Project State — Prana-Bindu

> Обновлено: 2026-09-26

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu (тренировки тела)
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
Направление 09 (Electron Shell) завершено.
Провайдер dodofo подключён, токен сохраняется в Melange через `safeStorage`.
Направление 07 (Spice) — активно: ручная синхронизация и запись данных
в БД — следующий шаг.
Бизнес-логика (02, 03, 04, 05, 06) — не начата.

## Контекст
- Цель: марафон 42,2 км 27.09.2026 (седьмой), старт подготовки 01.11.2026.
- Задача: снизить темп и пульс на заданном темпе.
- Параллельно — прогресс Big-6 по ступеням калистеники.
- Методология: 80/20 + SIRPOC + Big-6, взаимный прогресс бега и силы.

## Решения (ADR-стиль)

### 2026-09-22 — Архитектура модуля
- **Решение:** Prana-Bindu строится с нуля, отдельный модуль.
- **Причина:** `training:*` в проекте — это fine-tuning Ollama, не про тело.
  Пересечения нет, ломать нечего.
- **Следствие:** новый IPC-префикс `pb:*`, новая БД `prana_bindu.db`,
  новое окно `pranaBinduWindow.ts`, компоненты `PRANA_BINDU/`.

### 2026-09-22 — Расположение промтов
- **Решение:** `docs/prompts/prana-bindu/` — отдельная папка.
- **Следствие:** `00_MASTER_INDEX.md` ведёт только свои чаты.

### 2026-09-22 — Внутренние имена
- **Решение:** зонтичное имя **Prana-Bindu**, модули: Stillsuit, Crysknife,
  Mentat, Water Discipline, Spice, Melange.
- **Следствие:** в публичном релизе — нейтральные имена (отложено).

### 2026-09-22 — Источники данных
- **Решение:** Google Fit (прямой API) + ZeppBridge (CLI) + ручной ввод.
- **Уточнено 2026-09-23 (см. ADR про провайдеры Zepp).**
- **Уточнено 2026-09-26 (см. ADR про dodofo).**

### 2026-09-23 — Провайдеры Zepp и автодетект хоста
- **Решение:** три провайдера Zepp — `dofek-zepp` (основной),
  `zepp-mcp` (резерв), `zeppbridge` (резерв).
- **Разведка `@dofek/zepp-client`:** `signInToZepp(email, password, fetchFn)`
  подтверждён; зашитые US2-хосты `api-user-us2.zepp.com` и
  `api-mifit-us2.zepp.com`; оба идут через `fetchFn` — подмена работает.
- **Реализация:** `spice/providers/regionDetector.ts`,
  перебор `api-user.zepp.com` → `api-user-de2.zepp.com` → `api-user-us2.zepp.com`.
- **Статус:** реализовано, работает (проверено вручную).

### 2026-09-26 — dodofo.ru как основной источник
- **Решение:** перейти на dodofo.ru как **основной** источник
  тренировочных данных. Прямой Zepp (`dofek-zepp`) — **резерв**.
  `zepp-mcp` и `zeppbridge` — заглушки в реестре.
- **Причина:**
  - официальное приложение работает, но прямой вход в Zepp — сложный
    (три хоста, OAuth-пляска, region-детект);
  - dodofo даёт **Bearer-токен**, эндпоинты только на чтение,
    данные уже подготовлены (LTHR, зоны Коггана, wellness из Huawei);
  - пользователь экспортировал тренировки из Zepp в dodofo —
    данные уже там, `sport_type=run` работает.
- **Что даёт dodofo (покрытие):**
  - `/api/v1/activities` — список тренировок (run, ride, walk, ...);
  - `/api/v1/activities/{id}/streams` — секундные потоки + hr_zones;
  - `/api/v1/activities/daily` — посуточный журнал + wellness;
  - `/api/v1/wellness` — сон, HRV, пульс покоя, шаги, вес;
  - `/api/v1/me/thresholds` — LTHR, HRmax, RestHR, FTP;
  - `/api/v1/auth/me/zones` — тренировочные зоны Коггана.
- **Реализовано:**
  - `spice/providers/dodofoClient.ts` — HTTP-клиент, разбор RFC 7807
    Problem, таймаут 20 сек;
  - `spice/providers/dodofoProvider.ts` — `DodofoProvider`
    (`isAvailable`, `fetchWorkouts`, `fetchThresholds`, `fetchStreams`);
  - Melange миграция **v2**: колонки `dodofo_token` (шифр.),
    `dodofo_user_id`, `dodofo_username`, `dodofo_last_sync_at`,
    `dodofo_last_sync_status`;
  - IPC `pb:dodofo-connect`, `pb:dodofo-token-status`;
  - UI: блок «Синхронизация» меняет форму по выбранному провайдеру;
    для dodofo — поле токена и кнопка «Сохранить токен».
- **Хранение токена:** `safeStorage` (Linux — keyring; без keyring
  сохраняется без шифрования с предупреждением). Fallback на dev —
  `process.env.VITE_DODOFO_TOKEN`.

## Открытые вопросы
1. Критерии перехода между ступенями Big-6: по всем трём подходам
   или по последнему? (по книге Уэйда — все три на benchmark-уровне)
2. Тайминги стойки (30s / 60s / 120s) — суммарно или каждый подход?
3. Схема данных Melange — расширять в `08_MELANGE.md`.
4. Google Fit — приоритет ниже dodofo, не трогаем.
5. Панель деталей дня в календаре — drawer или модалка?
6. Схемы ступеней Big-6 (60 записей) — нужны для `seed.ts`.
   Блокируется `05_CRYSKNIFE.md`.
7. Поле `elevation_gain_m` в dodofo для беговых тренировок
   выглядит завышенным (6.7 км на 7 км дистанции). Проверить,
   игнорировать или считать по-своему.

## Ближайшие задачи (07_SPICE)
1. `runFactsRepo` в Melange: upsert по `(source, external_id)`,
   маппинг `RawWorkout` → `run_facts`.
2. IPC `pb:sync-now(from, to)` — ручная синхронизация.
3. UI: кнопка «Синхронизировать» + индикация результата
   (добавлено / обновлено / пропущено).
4. Авто-синхронизация при старте (если `sync_settings.mode = 'auto'`).
5. `fetchStreams` → запись в `run_facts.raw_json` + вынос `hr_zones`
   в отдельную таблицу (или JSON — решить).
6. Wellness → `recovery_logs` (сон, HRV, пульс покоя).
7. Thresholds → `profile.max_hr`, `profile.lthr`, `profile.resting_hr`.
8. Пагинация `fetchWorkouts` — уже реализована, проверить на реальных
   данных (несколько страниц).
9. Миграция v3 при необходимости (если решим вынести зоны
   в отдельную таблицу).
10. Патч `regionDetector.ts` — добавить таймауты (сейчас без них,
    но `dofek-zepp` — резервный, не критично).

## Что сделано
- [x] Согласована архитектура, имена, источники данных.
- [x] Написаны `00_MASTER_INDEX.md`, `01_COMMON_CONTEXT.md`,
      `PROJECT_STATE.md`.
- [x] Каркас `services/pranaBindu/` и `components/PRANA_BINDU/`.
- [x] Разведка `@dofek/zepp-client` (probe-скрипты).
- [x] Установлен `@dofek/zepp-client@0.1.44`.
- [x] `spice/providers/regionDetector.ts`.
- [x] Направление 09: окно, маршрут, меню, IPC-каркас, preload.
- [x] Melange v1: `db.ts`, `schema.ts`, `migrations.ts`, `seed.ts`,
      `repositories/profileRepo.ts`, `repositories/syncRepo.ts`.
- [x] Melange v2: dodofo-колонки в `sync_settings`.
- [x] `spice/providers/dodofoClient.ts`.
- [x] `spice/providers/dodofoProvider.ts`.
- [x] IPC `pb:dodofo-connect`, `pb:dodofo-token-status`.
- [x] UI: форма «Синхронизация» меняется по провайдеру.
- [x] Токен dodofo сохранён и проверен (`available: true`).
- [x] Реальная запись тренировок в `run_facts`.
      (`runFactsRepo.upsertRunFact`, идемпотентно по source+external_id).
- [x] IPC `pb:sync-now` + метод `electronAPI.pb.syncNow(from, to)`.
- [x] Ручная проверка: sync за сентябрь → +14 записей, повтор → 0 added / 14 update
- [ ] Wellness → `recovery_logs`.
- [ ] Thresholds → `profile`.

## Известные ошибки (не связаны с модулем)
`npx tsc --noEmit` выдаёт 3 ошибки в 2 наших файлах:
- `src/api/public.ts` — 2
- `src/shared/utils/ipcUtils.ts` — 1

Плюс чужие/архивные файлы (игнорируем).

Проверка типов Prana-Bindu:
```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
```
Пустой вывод = наш код чистый.

## Что НЕ делаем сейчас
- Не трогаем `training:*` (Ollama).
- Не трогаем другие модули (`osint`, `trading`, `bonds`, `gateway`, ...).
- Не делаем мобильную версию.
- Не публикуем с именами из «Дюны».
- Не реализуем Google Fit OAuth — приоритет ниже dodofo.
- Не заполняем 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.



=============================

# Project State — Prana-Bindu

> Обновлено: 2026-09-23

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu (тренировки тела)
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
Каркас сервисного слоя создан. `spice/regionDetector.ts` реализован
и подтверждён разведкой `@dofek/zepp-client`.
Следующий шаг — направление 09 (Electron Shell).
Бизнес-логика (02, 03, 04, 05, 06, 07) — не начата.

## Контекст
- Цель: марафон 42,2 км 27.09.2026 (седьмой), старт подготовки 01.11.2026.
- Задача: снизить темп и пульс на заданном темпе.
- Параллельно — прогресс Big-6 по ступеням калистеники.
- Методология: 80/20 + SIRPOC + Big-6, взаимный прогресс бега и силы.

## Решения (ADR-стиль)

### 2026-09-22 — Архитектура модуля
- **Решение:** Prana-Bindu строится с нуля, отдельный модуль.
- **Причина:** `training:*` в проекте — это fine-tuning Ollama, не про тело.
  Пересечения нет, ломать нечего.
- **Следствие:** новый IPC-префикс `pb:*`, новая БД `prana_bindu.db`,
  новое окно `pranaBinduWindow.ts`, новые компоненты `PRANA_BINDU/`.

### 2026-09-22 — Расположение промтов
- **Решение:** `docs/prompts/prana-bindu/` — отдельная папка.
- **Причина:** не смешивать с OSINT-промтами в `docs/prompts/`.
- **Следствие:** `00_MASTER_INDEX.md` для Prana-Bindu ведёт только свои чаты.

### 2026-09-22 — Внутренние имена
- **Решение:** зонтичное имя **Prana-Bindu**, модули: Stillsuit, Crysknife,
  Mentat, Water Discipline, Spice, Melange.
- **Причина:** «Дюна» как внутренняя эстетика, единый словарь.
- **Следствие:** в публичном релизе — нейтральные имена (отложено).

### 2026-09-22 — Источники данных
- **Решение:** Google Fit (прямой API) + ZeppBridge (CLI) + ручной ввод.
- **Причина:** Strava закрыла бесплатный API.
- **Следствие:** Spice работает с двумя провайдерами, оба опциональны.
  *(Уточнено 2026-09-23: см. ADR про провайдеры Zepp.)*

### 2026-09-23 — Провайдеры Zepp и автодетект хоста
- **Решение:** три провайдера Zepp — `dofek-zepp` (основной),
  `zepp-mcp` (резерв), `zeppbridge` (резерв). Вход через
  `@dofek/zepp-client` с автодетектом регионального хоста:
  `api-user.zepp.com` → `api-user-de2.zepp.com` → `api-user-us2.zepp.com`.
- **Причина:** официальное приложение Zepp работает в РФ, значит вход
  возможен; вопрос только в правильном эндпоинте.
- **Следствие:** в `sync_settings` добавлены поля `zepp_provider`,
  `zepp_fallback_provider`, `zepp_credentials_json`, `zepp_auth_host`,
  `zepp_data_host`, `zepp_app_token`, `zepp_user_id`,
  `zepp_last_sync_at`, `zepp_last_sync_status`.
  `zepp_credentials_json` и `zepp_app_token` шифруются через
  Electron `safeStorage`. Пароль в БД не пишется.

### 2026-09-23 — Разведка `@dofek/zepp-client` (закрытие риска)
- **Проверено** probe-скриптами `scripts/zepp/probe-zepp-client.mjs`
  и `scripts/zepp/probe-zepp-fetch.mjs`:
  - версия пакета: `0.1.44`;
  - сигнатура: `signInToZepp(email, password, fetchFn = globalThis.fetch)`
    — третий аргумент принимается и вызывается (`length: 2` — из-за
    дефолтного значения);
  - `Всего вызовов fetch: 1` — кастомный fetch реально задействован.
- **Зашитые US2-хосты:**
  - registration: `POST https://api-user-us2.zepp.com/v2/registrations/tokens`
  - exchange:    `POST https://api-mifit-us2.zepp.com/v2/client/login`
  - оба идут через `fetchFn` (см. `client.js:98`, `client.js:175`),
    значит подмена хостов покрывает весь флоу.
- **Следствие:** подход `regionDetector.ts` подтверждён.
  Реализация — `src/main/services/pranaBindu/spice/regionDetector.ts`.
  Порядок перебора регионов: `api-user.zepp.com` (глобальный) →
  `api-user-de2.zepp.com` (Европа) → `api-user-us2.zepp.com` (US2).
- **Риск закрыт.** Исход A из плана разведки.

## Открытые вопросы
1. Критерии перехода между ступенями Big-6: по всем трём подходам
   или по последнему? (по книге Уэйда — все три на benchmark-уровне)
2. Тайминги стойки (30s / 60s / 120s) — суммарно или каждый подход?
3. Схема данных Melange — финализировать в `08_MELANGE.md`.
4. Google Fit vs Zepp — порядок интеграции. Zepp идёт через три
   провайдера (см. ADR 2026-09-23), Google Fit — параллельно.
5. Панель деталей дня в календаре — drawer или модалка?
6. Схемы ступеней Big-6 (60 записей) — нужны для `seed.ts` Melange.
   Блокируется `05_CRYSKNIFE.md`.

## Ближайшие задачи
1. Обновить промты `00_MASTER_INDEX.md`, `01_COMMON_CONTEXT.md`,
   `08_MELANGE.md`, `09_ELECTRON_SHELL.md` (тексты готовы).
2. Направление 09: `pranaBinduWindow.ts` + маршрут `#/prana-bindu`
   + страница-заглушка `PranaBinduPage`.
3. Направление 09: пункт «Открыть Prana-Bindu» в `mainMenuTemplate`
   + `pranaBinduWindowMenuTemplate` + обработчик `click` в `main.ts`.
4. Направление 09: `pranaBinduHandlers.ts` (`pb:*`) + регистрация
   в `main.ts`.
5. Направление 09: расширение `preload.ts` объектом `electronAPI.pb`.
6. Направление 09: три провайдера-заглушки в `spice/providers/`
   + `dofekProvider.ts` поверх `regionDetector.ts`.
7. Направление 08: `melange/db.ts`, `schema.ts`, `migrations.ts`,
   `seed.ts` + репозитории.
8. Написать `02_CORE.md` — движок зон и 80/20.
9. Написать `05_CRYSKNIFE.md` — 60 ступеней Big-6 (нужны для seed).

## Что сделано
- [x] Согласована архитектура (Prana-Bindu с нуля, `pb:*`, `prana_bindu.db`).
- [x] Согласованы внутренние имена модулей.
- [x] Согласованы источники данных (Google Fit + Zepp + ручной).
- [x] Согласован AI-провайдер (Ollama → DeepSeek).
- [x] Написан `00_MASTER_INDEX.md`.
- [x] Написан `01_COMMON_CONTEXT.md`.
- [x] Написан `PROJECT_STATE.md` (этот файл).
- [x] Согласован каркас `services/pranaBindu/` и `components/PRANA_BINDU/`.
- [x] Согласована схема трёх провайдеров Zepp с автодетектом хоста.
- [x] Разведан API `@dofek/zepp-client` (probe-скрипты).
- [x] Установлен `@dofek/zepp-client@0.1.44`.
- [x] Создан предварительный каркас `services/pranaBindu/`.
- [x] Реализован `spice/regionDetector.ts`.
- [ ] Создан `components/PRANA_BINDU/` со структурой под модули.
- [ ] Промты 00/01/08/09 обновлены под Zepp-провайдеры.
- [ ] Реализовано направление 09.

## Известные ошибки (не связаны с модулем)
`npx tsc --noEmit` выдаёт 3 ошибки в 2 наших файлах:
- `src/api/public.ts` — 2
- `src/shared/utils/ipcUtils.ts` — 1

Плюс 3 в чужих/архивных файлах (игнорируем):
- `node_modules/@electron-forge/plugin-vite/src/Config.ts` — 1
- `docs/archive/neuro/codes/code-*.ts` — 2

Проверка типов Prana-Bindu:
```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
```
Пустой вывод = наш код чистый.

## Что НЕ делаем сейчас
- Не трогаем `training:*` (Ollama).
- Не трогаем другие модули (`osint`, `trading`, `bonds`, `gateway`, ...).
- Не делаем мобильную версию.
- Не публикуем с именами из «Дюны».
- Не реализуем реальные запросы к Zepp (тренировки, пульс) — это 07.
- Не заполняем 60 ступеней Big-6 — блокируется `05_CRYSKNIFE.md`.




==================================
old version
==================================

# Project State — Prana-Bindu

> Обновлено: 2026-09-22

## Репозиторий
- Путь: `~/Документы/GitHub/wetothemoon-project/wetothemoon-electron`
- Ветка: `main`
- Модуль: Prana-Bindu (тренировки тела)
- Расположение промтов: `docs/prompts/prana-bindu/`

## Статус
Модуль **не начат**. Промты написаны, код не писался.

## Контекст
- Цель: марафон 42,2 км 27.09.2026 (седьмой), старт подготовки 01.11.2026.
- Задача: снизить темп и пульс на заданном темпе.
- Параллельно — прогресс Big-6 по ступеням калистеники.
- Методология: 80/20 + SIRPOC + Big-6, взаимный прогресс бега и силы.

## Решения (ADR-стиль)

### 2026-09-22 — Архитектура модуля
- **Решение:** Prana-Bindu строится с нуля, отдельный модуль.
- **Причина:** `training:*` в проекте — это fine-tuning Ollama, не про тело.
  Пересечения нет, ломать нечего.
- **Следствие:** новый IPC-префикс `pb:*`, новая БД `prana_bindu.db`,
  новое окно `pranaBinduWindow.ts`, новые компоненты `PRANA_BINDU/`.

### 2026-09-22 — Расположение промтов
- **Решение:** `docs/prompts/prana-bindu/` — отдельная папка.
- **Причина:** не смешивать с OSINT-промтами в `docs/prompts/`.
- **Следствие:** `00_MASTER_INDEX.md` для Prana-Bindu ведёт только свои чаты.

### 2026-09-22 — Внутренние имена
- **Решение:** зонтичное имя **Prana-Bindu**, модули: Stillsuit, Crysknife,
  Mentat, Water Discipline, Spice, Melange.
- **Причина:** «Дюна» как внутренняя эстетика, единый словарь.
- **Следствие:** в публичном релизе — нейтральные имена (отложено).

### 2026-09-22 — Источники данных
- **Решение:** Google Fit (прямой API) + ZeppBridge (CLI) + ручной ввод.
- **Причина:** Strava закрыла бесплатный API.
- **Следствие:** Spice работает с двумя провайдерами, оба опциональны.

## Открытые вопросы
1. Критерии перехода между ступенями Big-6: по всем трём подходам
   или по последнему? (по книге Уэйда — все три на benchmark-уровне)
2. Тайминги стойки (30s / 60s / 120s) — суммарно или каждый подход?
3. Схема данных Melange — финализировать в `08_MELANGE.md`.
4. Google Fit vs ZeppBridge — что первым интегрируем?
5. AI-рекомендации: Ollama первым, DeepSeek вторым (решено).
6. Панель деталей дня в календаре — drawer или модалка?

## Ближайшие задачи
1. Написать `02_CORE.md` — движок зон и 80/20.
2. Написать `08_MELANGE.md` — финальная схема БД.
3. Написать `09_ELECTRON_SHELL.md` — окно, меню, IPC.
4. Создать каркас `src/main/services/pranaBindu/`.
5. Создать `pranaBinduWindow.ts` + маршрут + страницу-заглушку.
6. Создать `pranaBinduHandlers.ts` + регистрация в `main.ts`.
7. Создать `src/components/PRANA_BINDU/` со структурой под модули.

## Что сделано
- [x] Согласована архитектура (Prana-Bindu с нуля, `pb:*`, `prana_bindu.db`).
- [x] Согласованы внутренние имена модулей.
- [x] Согласованы источники данных (Google Fit + ZeppBridge + ручной).
- [x] Согласован AI-провайдер (Ollama → DeepSeek).
- [x] Написан `00_MASTER_INDEX.md`.
- [x] Написан `01_COMMON_CONTEXT.md`.
- [x] Написан `PROJECT_STATE.md` (этот файл).

## Что НЕ делаем сейчас
- Не трогаем `training:*` (Ollama).
- Не трогаем другие модули (`osint`, `trading`, `bonds`, `gateway`, ...).
- Не делаем мобильную версию.
- Не публикуем с именами из «Дюны».