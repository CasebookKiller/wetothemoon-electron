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

## Закрытый (для контекста)

- ✅ `.bak` файлы — удалены (2026-11-18, коммит `45ba5e9`)
- ✅ `GatewayProfileSwitcher` — удалён (коммит `45ba5e9`)
- ✅ HR-баг старых dodofo-записей — **не наш фикс**, отмечен в `problems.md` П1.
- ✅ GPS в Москве — обходим через акселерометр (см. `problems.md` П2).