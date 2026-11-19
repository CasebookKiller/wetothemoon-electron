# Roadmap — Prana-Bindu

> Обновлено: 2026-11-19 (по состоянию на 2026-10-29)

## Индекс направлений

| #   | Направление | Статус | Открыто |
|-----|-------------|--------|---------|
| 02  | **Core** (зоны, 80/20, фазы, gates, validator) | **не начат** | **вся реализация** — спека готова |
| 03  | Mentat (календарь, периодизация) | ~80% | доделать прогрессии, привязка к 02 |
| 04  | Stillsuit (марафон: пульс, темп) | не начат | зависит от 02 |
| 05  | Crysknife (Big-6: прогрессии) | не начат | зависит от 02 (`progressionGate`) |
| 06  | Water Discipline (восстановление) | не начат | зависит от 02 (HRV в gate) |
| 07  | **Spice** (данные, парсеры, провайдеры) | **99%** | **Push в ICU** (`POST/PUT/DELETE events`, UI в `PlanEventDrawer`, preview таймлайна) |
| 08  | **Melange** (БД, миграции) | **v36** | **v37** (`run_facts.training_load`), `movementsRepo`, `progressionsRepo` |
| 09  | Electron Shell (окно, меню, IPC) | завершён | — |
| 10  | Duna (UI, визуал, стили) | ~80% | доделать стили панелей |
| 11  | **AI-Тренер** (Ollama / DeepSeek) | **активен** | `contextBuilder.ts` + `AiCoachDialog`, зависит от 02 (validator) |
| 12  | Live-журнал (PWA) | не начат | отдельный проект |
| 13  | Визуализация упражнений (p5.js / three.js) | не начат | — |
| 14  | Dashboard главной страницы | завершён | — |
| 15  | Standalone справочник калистеники | идея | — |
| 16  | **Exercise Graph** | **C.1–D** | **B**: миграция каталогов в JSON; Smithrun C–E |
| 18  | **Map Editor** | **C.1–C.13** | **C.7** Территория (полигоны на 3 КП); C.8, C.9, C.11 |

## Ближайшие (2 часа)

1. **02 Core** — реализовать 5 модулей из спеки (`zones`, `eightyTwenty`, `phases`, `progressionGate`, `recommendationValidator`) + `scenarios.ts` для ручной проверки. **Нулевой риск:** новые файлы, zero импортов, zero Electron/DB. Разблокирует 04, 05, 06, 11.
2. **07 Push в ICU** — `POST /events`, `PUT /events/{id}`, `DELETE /events/{id}`, UI textarea в `PlanEventDrawer`, preview таймлайна.
3. **08 Melange v37** — `run_facts.training_load` вынести из `raw_json`.

## Следующие сессии

4. **11 AI-Тренер** — `contextBuilder.ts` (сборка контекста из Melange для Ollama/DeepSeek) + `AiCoachDialog`. Зависит от 02.
5. **16 Exercise Graph B** — миграция каталогов в JSON (Wade уже в графе, остальные: Cali, Runner, Core, Posture, WeightLoss, Named, Thenics).
6. **16 Smithrun C–E** — активная запись в `smithrun.graph.user.json`, миграция кастома, наполнение.
7. **18 C.7 «Территория»** — полигоны на 3 КП, фундамент C.12 (chains) готов.
8. **18 C.8** — группировка атомов.
9. **18 C.9** — прокси тайлов OSM.
10. **18 C.11** — исследование бесплатных векторных карт.

## Открытые вопросы по направлениям

### 07 Spice — Push в ICU
- Как ICU хранит `icu_workout` — разобранным или как текст?
- Создаём через текстовый конструктор или структурированный JSON? (текстовый проще в UI)
- Приоритет при конфликте: ICU — источник правды для плана, наше приложение — для факта?

### 16 Exercise Graph
- Формат `smithrun.graph.user.json`?
- Идентификаторы (префиксовать или нет)?
- Программы — как связать с каталогом?
- Взаимодействие с палитрой?

### Zepp-direct (для 07)
- `@dofek/zepp-client@0.1.44` установлен, `regionDetector.ts` готов.
- `dofekProvider.ts`, `mcpProvider.ts`, `bridgeProvider.ts` — заглушки.
- **Реальные запросы к Zepp** (тренировки, VO2max, SpO2, HRV) — TODO.

## 07 ICU — синтаксис конструктора (детали в `chats/07_SPICE_PLAN.md`)

**Единицы:** `m`=минуты, `s`=секунды, `h`=часы, `mtr`=метры, `km`, `mi`.

**Секции:** `Warmup`, `Main Set`, `Cooldown` (на отдельной строке).

**Повторы:** `Nx` на отдельной строке, пустые строки до и после. **Вложенные повторы — НЕ поддерживаются.**

**Цели:** `% HR`, `%`, `Z1..Z7`, `Pace`, `freeride`.

**Cue:** текст **ПЕРЕД** длительностью → подсказка на часах.

**НЕ поддерживается:** RPE, вложенные повторы, русские единицы (`сек/мин/км`).

**Пример:**
```
VO2max Intervals (10x 400m)
Warmup
- 2km Z2 Pace
Main set 10x
- 400m Z5 Pace
- 400m recovery Z1 Pace
Cooldown
- 2km Z1 Pace
```

**Формат событий ICU:** `category` (WORKOUT/PLAN/TARGET/NOTE/RACE), `type` (Run), `name`, `start_date_local`, `icu_workout.steps` (type + duration + target). Push: `POST /events`, `PUT /events/{id}`, `DELETE /events/{id}`.

## Что НЕ делаем сейчас

- Google Fit (отложено навсегда).
- 60 ступеней Big-6 (только 10).
- Weighted / Ring / Band / Mobility из Thenics (отдельные заходы).
- Публичный релиз с именами из «Дюны».
- Мобильная версия Prana-Bindu.