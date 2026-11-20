# Техдолг — Prana-Bindu

## Открытый

### TD1. `run_facts.training_load` в `raw_json`
**Файл:** `melange/repositories/runFactsRepo.ts`
**Проблема:** TSS/ATL/CTL хранится в `raw_json`, не отдельной колонкой. SQL-запросы неэффективны.
**Фикс:** Melange v37 — вынести в колонку + индекс.
**Приоритет:** средний (блокирует аналитику нагрузки).

### TD2. `sources_json` в `run_facts` не до конца внедрён
**Файл:** `melange/schema.ts`, `runFactsRepo.ts`
**Проблема:** дедупликация на уровне БД (v22+) есть, но `sources_json` используется непоследовательно.
**Фикс:** доработать `sources_json` при каждой вставке (указывать все источники одной тренировки).
**Приоритет:** средний (влияет на multi-source группировку).

### TD3. `dofekProvider.ts` — заглушка
**Файл:** `spice/providers/dofekProvider.ts`
**Проблема:** `fetchWorkouts()` возвращает `[]`, реальной логики нет.
**Фикс:** доделать `DofekZeppProvider` поверх `regionDetector.ts` + `@dofek/zepp-client@0.1.44`.
**Приоритет:** высокий (единственный путь к VO2max/SpO2/HRV).

### TD4. `mcpProvider.ts` / `bridgeProvider.ts` — заглушки
**Файлы:** `spice/providers/mcpProvider.ts`, `bridgeProvider.ts`
**Проблема:** `isAvailable() → { available: false }`, `fetchWorkouts() → []`.
**Статус:** намеренно (Zepp-direct важнее).
**Приоритет:** низкий.

### TD5. `movementsRepo.ts`, `progressionsRepo.ts` — не созданы
**Проблема:** нужны для 05 Crysknife (Big-6 прогрессии).
**Фикс:** создать в Melange (по образцу `exerciseProgressRepo.ts`).
**Приоритет:** средний (блокирует Crysknife).

### TD6. `runPlansRepo.ts`, `templatesRepo.ts`, `recommendationsRepo.ts` — не созданы
**Проблема:** нужны для 03 Mentat (планы) и 11 AI-Тренер (рекомендации).
**Фикс:** создать по мере надобности.
**Приоритет:** низкий (создавать по факту).

### TD7. `SCHEMA_VERSION = 36` — тесты миграций
**Проблема:** нет регрессионного теста миграций v1 → v36.
**Фикс:** `scripts/test-melange-migrations.mjs` — прогон с нуля до текущей версии, проверка всех таблиц/колонок.
**Приоритет:** низкий (YAGNI, пока миграции не ломались).

### TD8. `scenarios.ts` в Core — нет (спека готова)
**Файл:** `src/main/services/pranaBindu/core/scenarios.ts` (не существует)
**Проблема:** 6 сценариев из спеки (зоны, 80/20, фазы, ворота, validator) — не реализованы.
**Фикс:** реализовать вместе с 02 Core.
**Приоритет:** высокий (входит в 02).

### TD11. DDL 23 таблиц Melange не в handoff-by-button
**Проблема:** handoff-by-button (2026-11-20) включает DDL только 6 из 29 таблиц (`profile`, `chains`, `chain_slots`, `water_logs`, `weight_logs`, `nutrition_logs`). Отсутствуют: `run_facts`, `run_streams`, `recovery_logs`, `plan_events`, `movements`, `progressions`, `progress_checks`, `equivalences`, `strength_plans`, `strength_sessions`, `sync_settings`, `threshold_history`, `user_movement_state`, `week_template_days`, `week_templates`, `workout_sessions`, `meta`, `reference_tracks`, `test_segments`, `exercise_progress`, `recommendations`, `run_plans`.
**Источник истины:** `git show d37d02f:docs/prompts/prana-bindu/chats/08_MELANGE.md` (2776 строк, коммит до `b4800a3`).
**Фикс:** при работе над v37 — восстанавливать DDL из этого коммита.
**Приоритет:** средний (блокирует v37 и аналитику).

### TD12. 07 Spice — провайдеры/парсеры/sync не в handoff-by-button
**Проблема:** в handoff только синтаксис ICU-конструктора. Потеряны: `dodofoProvider`, `intervalsIcuProvider`, `stravaProvider`, `dofekProvider` (поля, auth, формат ответа), парсеры (`fitParser`, `tcxParser`, `stravaCsvParser`, `gpsClassifier`), логика sync, дедупликация `(source, external_id)`, `sources_json`.
**Источник истины:** `git show d37d02f:docs/prompts/prana-bindu/chats/07_SPICE.md` (2201 строка).
**Фикс:** при Push в ICU и доработке Zepp-direct — восстанавливать.
**Приоритет:** высокий (07 Spice — 99%, но push в ICU = ближайшая задача).

### TD13. Детали 09/16/17/18 и конвенций — не в handoff-by-button
**Проблема:** handoff-by-button содержит только выжимки. Потеряны детали: `09_ELECTRON_SHELL.md` (IPC `pb:*`), `16_GRAPH.md` (граф сверх kinds), `17_SMITHRUN.md` (212 строк), `18_MAP_EDITOR.md` (C.1–C.13), `COMPONENTS_CONVENTION.md`, `STYLES_CONVENTION.md`, `PRODUCT_NAME.md`, `plans/*.csv|.md`, `letter_dodofo_hr_bug.txt`.
**Источник истины:** коммит `d37d02f` (все файлы были в git до `b4800a3`).
**Фикс:** восстанавливать по необходимости из `d37d02f`. В handoff **не дублировать** (объём), но помнить, где лежит.
**Приоритет:** низкий (по факту).

### TD10. Duck.ai не работает в РФ
**Проблема:** `recon-free-llms.mjs` показал 200, но `recon-duck-smoke.mjs` (patchright + Chrome) — страница не грузится из РФ (geoblock / региональные ограничения). Ложный 200 в probe — редирект на страницу «недоступно».
**Фикс:** не тратить время. Альтернативы без логина: g4f.dev (200), LLM7.io (API), Pollinations (API).
**Приоритет:** закрыто (не делаем).

## Закрытый (для контекста)

- ✅ `.bak` файлы — удалены (2026-11-18, коммит `45ba5e9`)
- ✅ `GatewayProfileSwitcher` — удалён (коммит `45ba5e9`)
- ✅ HR-баг старых dodofo-записей — **не наш фикс**, отмечен в `problems.md` П1.
- ✅ GPS в Москве — обходим через акселерометр (см. `problems.md` П2).