# Направление 17: Smithrun (миграция, единая БД)

> Обновлено: 2026-10-14
> Статус: A сделан. B — текущий.

## Роль
**Smithrun** («Кузница Бега») — будущий **основной каталог** Prana-Bindu. Сейчас — пустой каркас.

## Что такое smithrun vs каталог vs seed
- **Каталог** (`catalog`) — источник упражнений. Wade, Thenics, Cali — внешние. Smithrun — свой.
- **Seed** — JSON в бандле приложения. Неизменяемый (read-only).
- **User.json** — файл на диске. Мутируемый через UI. Сейчас есть только `wade.graph.user.json`.

## План миграции
### Этап A — инфра ✅
### Этап B — smithrun на канвасе ✅
### Этап C — активная запись (следующий)
### Этап D — миграция существующего кастома
### Этап E — наполнение smithrun
### Этап F — другие каталоги

## Открытые вопросы
1. **Формат `smithrun.graph.user.json`**.
2. **Идентификаторы** (мой голос: не префиксовать).
3. **Программы**.
4. **Взаимодействие с палитрой**.
5. **`graph-reset`**.
6. **Точка отката**.


================================================

# Направление 17: Smithrun (миграция, единая БД)

> Обновлено: 2026-10-14
> Статус: A сделан. B — текущий.

## Роль

**Smithrun** («Кузница Бега») — будущий **основной каталог** Prana-Bindu.
Сейчас — пустой каркас. В перспективе — единая база тренировочной
программы, вобравшая лучшие решения из Wade, Thenics, Cali и кастома.

Отличие от Wade/Thenics/др.: они — **источники** (первоисточники,
внешние каталоги, «чужое»). Smithrun — **итог** (то, что пользователь
собрал для себя).

## Что такое smithrun vs каталог vs seed

- **Каталог** (`catalog`) — источник упражнений. Wade, Thenics, Cali —
  внешние. Smithrun — свой.
- **Seed** — JSON в бандле приложения. Неизменяемый (read-only).
- **User.json** — файл на диске. Мутируемый через UI. Сейчас есть
  только `wade.graph.user.json`.

Smithrun сейчас = **seed**. Со временем станет **seed + user.json**.

## Текущее состояние

### Сделано (этап A, 2026-10-14)

- **`data/manifest.json`** — реестр 9 каталогов. `wade` и `smithrun`
  enabled:true, остальные false.
- **`data/index.ts`** читает манифест, экспортирует `ENABLED_SEEDS`,
  `ALL_SEEDS`, `MANIFEST`.
- **7 заглушек** (cali, runner, core, posture, weightloss, named,
  thenics) — валидный `GraphJson` с одним catalog-узлом, пустые
  массивы, `enabled: false`.
- **`smithrun.graph.json`** — пустой каркас с catalog-узлом
  «Кузница Бега».
- **`@concrete:<catalog>:<graphKey>:<level>`** в `loader.ts`
  `resolveRef` — ссылка на конкретный уровень из другого графа,
  включая дробные (7.1).
- **`smithrun` в `CATALOG_COLORS`** (песочно-горчичный `#c9a96b`).

### Сделано (этап B, 2026-10-14)

- `loadEnabledGraphs()` в `pranaBinduHandlers.ts` читает
  `ENABLED_SEEDS` и подменяет Wade на user.json.
- 3 handler'а (`pb:get-exercise-graph`, `pb:debug-graph-query`,
  `pb:debug-graph-audit`) работают с массивом графов.
- На канвасе появилась вторая catalog-нода «Кузница Бега»
  (пустая, 0 канонов).

### Что НЕ делаем в режиме B

- Write-IPC (`graph-add-*`, `graph-delete-*`, `graph-update-*`,
  `graph-save`) продолжают писать в `wade.graph.user.json`.
- Smithrun читается как **seed из бандла**. Никакой записи.
- Миграции нет. `wade.graph.user.json` живёт как раньше.

## План миграции

### Этап A — инфра ✅ (2026-10-14)

Манифест, заглушки, smithrun-каркас, `@concrete:`.

### Этап B — smithrun на канвасе ✅ (2026-10-14)

Read-only. Wade по-прежнему пишется в user.json. Smithrun = seed.

### Этап C — активная запись (следующий)

**Цель:** весь пользовательский кастом уходит в smithrun.

Что делаем:
- Write-IPC (`graph-add-*`, `graph-delete-*`, `graph-update-*`)
  пишут **в `smithrun.graph.user.json`** (новый файл на диске).
- Wade становится **read-only**. Правки Wade-узлов запрещены —
  UI отдаёт ошибку.
- В палитре появляется отдельная группа **«Кузница Бега»** для
  smithrun-узлов.
- `graph-reset` сбрасывает smithrun (не Wade).

Зачем: с этого момента **всё новое** (кастомные паттерны, каноны,
упражнения, связи) уходит в smithrun, а не в Wade.

### Этап D — миграция существующего кастома

**Цель:** перенести то, что уже есть в `wade.graph.user.json`,
в smithrun.

Что делаем:
- При первом запуске: если есть `wade.graph.user.json` и нет
  `smithrun.graph.user.json` — вычислить **дельту** (что отличается
  от seed Wade).
- Записать дельту в `smithrun.graph.user.json`.
- Оригинал переименовать в `wade.graph.user.json.bak`.
- С этого момента Wade читается только из seed, smithrun = seed + user.

Критерий успеха: все правки пользователя (Archer W7.1, позиции узлов,
дополнительные рёбра) сохранены и видны на графе.

### Этап E — наполнение smithrun

**Цель:** smithrun становится полноценным каталогом с собственной
структурой.

Что делаем:
- Перенос лучших канонов из Wade (push-up, pull-up, squat, …) —
  копирование с новыми id под smithrun.
- Перенос актуальных узлов из Thenics.
- Создание **собственных** канонов (например, для стоп, которых
  нет ни у Wade, ни у Thenics).
- Разметка `requires` / `variant-of` / `equivalent-to` между
  smithrun-узлами и узлами источников.

Итог: **smithrun — единая точка сборки программы тренировок**.

### Этап F — другие каталоги

По мере готовности:
- Cali (5 прогрессий) — включить `enabled: true`, наполнить.
- Runner (5 прогрессий) — то же.
- Core, Posture, Weight-loss, Named — по мере надобности.
- Thenics — оставить как **внешний справочник** для `equivalences`,
  не включать как источник программ.

## Открытые вопросы

1. **Формат `smithrun.graph.user.json`** — тот же `GraphJson`, что и
   seed, или отдельная схема (например, только delta от seed)?
2. **Идентификаторы.** У Wade-канонов id вида `push-up`, `hspu`. При
   переносе в smithrun — сохранять те же id или делать префикс
   `smith-`? Мой голос: **не префиксовать**, id остаются глобально
   уникальными.
3. **Программы.** `programs` в smithrun — новые (Smithrun-specific)
   или копии Wade-программ (New Blood, Veterano)?
4. **Взаимодействие с палитрой.** Когда smithrun наполнится, нужна
   отдельная группа «Кузница Бега» в палитре — с двумя подгруппами
   (Каноны / Уровни), как у Wade.
5. **`graph-reset`.** Сейчас сбрасывает `wade.graph.user.json`. После
   перехода на smithrun — что сбрасывать? Мой голос: **smithrun**.
6. **Точка отката.** Пока Wade не переведён в read-only, всегда
   можно вернуться к `wade.graph.user.json.bak`.

## Что НЕ делаем

- Не удаляем `wade.graph.user.json` до этапа D.
- Не трогаем `wade.graph.json` (seed) — это первоисточник.
- Не смешиваем smithrun с Wade в одном файле.
- Не включаем другие каталоги (cali, runner) до наполнения.
- Не переносим `equivalences` из Melange в JSON графа — они
  остаются в БД (v21).

## Проверка

```bash
# 1. Каталог появился в графе
sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT COUNT(*) FROM meta WHERE key='schema_version' AND value='21';"

# 2. Smithrun в manifest
cat src/main/services/pranaBindu/mentat/graph/data/manifest.json \
  | grep smithrun

# 3. Smithrun seed в бандле
cat src/main/services/pranaBindu/mentat/graph/data/smithrun.graph.json

# 4. На канвасе — вторая catalog-нода «Кузница Бега»
```

## Definition of Done (всего направления)

- [ ] `smithrun.graph.user.json` создаётся и мутируется через UI.
- [ ] Wade seed — read-only, правки через UI запрещены.
- [ ] Все существующие правки из `wade.graph.user.json` перенесены
      в smithrun без потерь.
- [ ] В палитре — отдельная группа «Кузница Бега».
- [ ] Хотя бы один собственный канон smithrun с 5+ уровнями.
- [ ] Документация обновлена (`01_COMMON_CONTEXT.md`,
      `PROJECT_STATE.md`, `00_MASTER_INDEX.md`).