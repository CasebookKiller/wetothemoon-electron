# Направление 16: Exercise Graph

> Обновлено: 2026-10-14
> Статус: активен. C.1–C.3, D закрыты.

## Роль
Единый граф упражнений. Связывает каталоги, программы, паттерны, прехаб, drills. Не заменяет каталоги — надстройка над ними.

## Модель

### Узлы
| Kind | Что |
|---|---|
| `pattern` | Биомеханический паттерн движения (13 корневых) |
| `exercise` | Упражнение. `isCanonical: true` — группа, `false` — конкретный уровень |
| `program` | Тренировочная программа (New Blood, …) |
| `catalog` | Каталог-контейнер (Wade, Cali, Thenics, Named, …) |
| `modality` | Способ выполнения (ring / band / weighted / …) |
| `tissue` | Анатомическая цель прехаба |
| `skill` | Технический навык бега (drills) |

### Рёбра
| Kind | Направление | Смысл |
|---|---|---|
| `progresses-to` | exercise → exercise | Линейная прогрессия |
| `variant-of` | exercise → exercise | Боковая ветка |
| `progression-from` | drill → drill | Техническое усложнение |
| `instance-of` | exercise → pattern / canonical | Привязка |
| `belongs-to` | exercise → catalog | Источник |
| `equivalent-to` | exercise ↔ exercise | Эквивалент |
| `requires` | exercise → exercise | Предусловие |
| `conflicts-with` | exercise → exercise | Противопоказание |
| `trains` | exercise → tissue | Прехаб |
| `targets` | exercise → skill | Drill |
| `warms-up` | exercise → pattern | Warmup |
| `used-in` | exercise → program | Программа |
| `modality-of` | modality → exercise | Способ |
| `parent-of` | pattern → pattern | Иерархия паттернов |

## Открытые задачи
### B — Миграция каталогов в JSON
*(Без изменений)*

### SVG-иконки
*(Без изменений)*

### Melange v37 — интеграция с графом
- `run_facts.training_load` — отдельная колонка.

### Mentat ↔ Graph
*(Без изменений)*


================================

# Направление 16: Exercise Graph

> Обновлено: 2026-10-14
> Статус: активен. C.1–C.3, D закрыты.

## Роль

Единый граф упражнений. Связывает каталоги, программы, паттерны,
прехаб, drills. Не заменяет каталоги — надстройка над ними.

## Модель

### Узлы

| Kind | Что |
|---|---|
| `pattern` | Биомеханический паттерн движения (13 корневых) |
| `exercise` | Упражнение. `isCanonical: true` — группа, `false` — конкретный уровень |
| `program` | Тренировочная программа (New Blood, …) |
| `catalog` | Каталог-контейнер (Wade, Cali, Thenics, Named, …) |
| `modality` | Способ выполнения (ring / band / weighted / …) |
| `tissue` | Анатомическая цель прехаба |
| `skill` | Технический навык бега (drills) |

### Рёбра

| Kind | Направление | Смысл |
|---|---|---|
| `progresses-to` | exercise → exercise | Линейная прогрессия |
| `variant-of` | exercise → exercise | Боковая ветка |
| `progression-from` | drill → drill | Техническое усложнение |
| `instance-of` | exercise → pattern / canonical | Привязка |
| `belongs-to` | exercise → catalog | Источник |
| `equivalent-to` | exercise ↔ exercise | Эквивалент |
| `requires` | exercise → exercise | Предусловие |
| `conflicts-with` | exercise → exercise | Противопоказание |
| `trains` | exercise → tissue | Прехаб |
| `targets` | exercise → skill | Drill |
| `warms-up` | exercise → pattern | Warmup |
| `used-in` | exercise → program | Программа |
| `modality-of` | modality → exercise | Способ |
| `parent-of` | pattern → pattern | Иерархия паттернов |

## Архитектура

```
src/main/services/pranaBindu/mentat/graph/
├── ontology.ts           ← типы, ID-хелперы
├── schema.ts             ← типы JSON
├── loader.ts             ← GraphJson → GraphNode[] / GraphEdge[]
├── graphBuilder.ts       ← seed + DB overrides
├── graphQueries.ts       ← обход графа
├── viewModel.ts          ← граф → React Flow nodes/edges
├── layout.ts             ← dagre / radial раскладка
├── sources.ts            ← палитра (Wade + Thenics)
├── equivalencesMerge.ts  ← merge seed + DB
├── equivalencesIndex.ts  ← индекс для Thenics
├── data/
│   ├── wade.graph.json   ← seed Wade
│   └── index.ts          ← ALL_GRAPHS (пока только Wade)
└── seeds/
    └── thenicsEquivalencesSeed.ts
```

UI:

```
src/components/PRANA_BINDU/ExerciseGraph/
├── ExerciseGraphDialog.tsx
├── ExerciseGraphView.tsx
├── FiltersBar.tsx
├── DetailPanel.tsx
├── PalettePanel.tsx
├── EdgeLegend.tsx
├── types.ts
├── ExerciseGraph.css
├── nodes/
│   ├── ExerciseNode.tsx
│   ├── PatternNode.tsx
│   ├── ProgramNode.tsx
│   └── CatalogNode.tsx
└── edges/
    └── FloatingEdge.tsx
```

## Формат данных (`GraphJson`)

```ts
interface GraphJson {
  id: string;
  label: string;
  labelRu?: string;
  patterns: PatternJson[];
  catalogs: CatalogJson[];
  canonicals: CanonicalJson[];
  nodes: NodeJson[];
  edges: EdgeJson[];
  programs: ProgramJson[];
}
```

**`edges.from` / `to`** — либо локальный `node.id`, либо спец-цель:

- `@pattern:<key>`
- `@canonical:<id>`
- `@catalog:<id>`

## Custom nodes (C.1)

Каждый узел — React Flow custom component:

```tsx
<div className="pb-node-inner">
  <div className="pb-node-inner__header">
    <span className="pb-node-inner__label">{label}</span>
  </div>
  <div className="pb-node-inner__body" />    ← пусто, задел на stats
  <div className="pb-node-inner__footer">
    <span className="pb-node-inner__icon">PU</span>
    <span className="pb-node-inner__badge">W5</span>
    <span className="pb-node-inner__footer-text">10 уровней</span>
  </div>
</div>
```

**Иконки** — буквенные (`ExerciseIconKey`):

| Верх | Низ | Кор | Спец | Prehab |
|---|---|---|---|---|
| PU push | SQ squat | LR core-flexion | HS inversion | KN knee |
| PL pull | HG hinge | BR core-extension | BL balance | HP hip |
| RW row | AK ankle | CA core-anti | LC locomotion | SPN spine |
| SA straight-arm | | | DR drill | SH shoulder |
| | | | PLY plyo | MOB mobility |
| | | | CF cardio | |

Позже — заменяем на SVG (в `assets/icons/exercises/`).

**Badge** — только у concrete: `W5`, `L3`, с perSide: `W7 · L/R`.

**Footer** — по роли:
- pattern: `N канонов`
- canonical: `N уровней`
- program: `N упражнений` (сумма уровней канонов)
- catalog: `N канонов · N уровней`

## Раскраска (C.2)

CSS-переменные, приходят из `viewModel.ts`:

```tsx
style={{
  '--node-fill': colors.fill,
  '--node-stroke': colors.stroke,
  '--node-text': colors.text,
  '--node-badge-bg': colors.badgeBg,
  '--node-border-width': colors.borderWidth,
}}
```

Функция `colorsForNode(role, depth, catalog, level)`:
1. **concrete + level** → `LEVEL_COLORS[1..10]` (градиент от пастельного к тёмному)
2. **canonical** → `CATALOG_COLORS[catalog]` (wade = янтарный, thenics = приглушённый фиолетовый, …)
3. **program** → циан
4. **pattern / catalog** → `DEPTH_COLORS[depth]` (0 = песочный, 1 = янтарный, 2 = циан)

## Рёбра (C.3)

`FloatingEdge` — компонент:

- **Точки подключения** вычисляются динамически. `intersection(rect, to)` находит точку на границе прямоугольника узла.
- **Стиль** — по `data.kind`:
  - `progresses-to` / `variant-of` / `requires` → **smoothstep** с `borderRadius: 12`.
  - `instance-of` / `belongs-to` / `used-in` / `equivalent-to` → **bezier**.
- Handles в узлах скрыты, проявляются при hover.

## Позиции узлов (D)

- В JSON — `pos: {x, y}` в `NodeJson` / `CanonicalJson` / `PatternJson` / `CatalogJson` / `ProgramJson`.
- В `ExerciseGraphView` — state `posOverrides: Map<string, {x, y}>`.
- На `onNodeDragStop`:
  1. Обновляется `posOverrides` (для Слои↔Круг).
  2. IPC `pb:graph-save-node-pos` пишет `pos` в JSON.
- В `layoutGraph` / `radialLayout` — если `_explicitPos` есть, используется он, а не dagre.

## Палитра и источники

`sources.ts` — `buildPalette(graph)`:
- **Wade · Каноны** — 6 канонов Wade.
- **Wade · Уровни** — 60 concrete.
- **Thenics** — 206 движений.

Каждый item имеет `state: 'active' | 'linked' | 'candidate'`:

| State | Условие | UI | Клик |
|---|---|---|---|
| `active` | Не в графе | обычный | добавить |
| `linked` | Пара есть в seed + DB | зелёный | фокус на узел |
| `candidate` | Эвристика нашла (seed / key-match) | жёлтый `?` | диалог подтверждения |

**Диалог Thenics → в граф:**
- **«Как группу»** — создаёт `ex:canonical:thenics-<key>`.
- **«Как упражнение в группу»** — dropdown canonical → создаёт exercise внутри.

## Редактор

### Тулбар
- `+ Паттерн` → новый паттерн (id → `pat:custom-<id>`).
- `+ Группа` → новый canonical (id → `ex:canonical:custom-<id>`).
- `+ Упражнение` → новый exercise внутри выбранной группы.

### DetailPanel
- `✏ Изменить` — открывает модалку для pattern / canonical / exercise.
- `🗑 Удалить` — с каскадом рёбер.
- Клик по ребру в списках → редактирование (тип, target, note, удаление).
- Протягивание между узлами → диалог типа ребра.

### CatalogPickerDialog
Для свободных сессий — ручной выбор упражнения из `PROGRESSIONS_CATALOG` +
`NAMED_EXERCISES`. Исключает ошибки парсера.

## IPC (`pb:graph-*`)

| Метод | Что |
|---|---|
| `get-exercise-graph` | Граф для рендера |
| `graph-get-json` | Сырой JSON (seed или user) |
| `graph-save` | Сохранить JSON целиком |
| `graph-reset` | Удалить user-копию |
| `graph-path` | Путь к user-файлу |
| `graph-palette` | Палитра с состояниями |
| `graph-add-pattern` | Новый паттерн |
| `graph-add-canonical` | Canonical из Thenics (палитра) |
| `graph-add-canonical-custom` | Custom canonical |
| `graph-add-exercise` | Новый exercise |
| `graph-update-canonical` | Изменить canonical |
| `graph-update-exercise` | Изменить exercise |
| `graph-update-pattern` | Изменить pattern |
| `graph-delete-canonical` | Удалить canonical (каскад) |
| `graph-delete-exercise` | Удалить exercise (каскад) |
| `graph-delete-pattern` | Удалить pattern |
| `graph-add-edge` | Создать ребро |
| `graph-delete-edge` | Удалить ребро |
| `graph-update-edge` | Изменить ребро |
| `graph-save-node-pos` | Сохранить позицию |

## Открытые задачи

### B — Миграция каталогов в JSON

- **Манифест** `manifest.json` — список подключённых каталогов.
- Отдельные файлы: `wade.graph.json`, `cali.graph.json`, `runner.graph.json`,
  `core.graph.json`, `posture.graph.json`, `weightloss.graph.json`,
  `named.graph.json`, `thenics.graph.json`, `smithrun.graph.json`.
- `enabled: false` → каталог не читается, рёбра к нему отфильтровываются.
- **smithrun** — весь кастом: новые паттерны / каноны / упражнения +
  связи + overrides существующих. Вариант B: seed + smithrun = итог.
- Один формат `GraphJson` для всех каталогов.
- Добавить `labelRu` каталогам (`cali`, `runner`, `thenics`, …).

### SVG-иконки

20 ключей (`PU`, `PL`, `RW`, `SA`, `SQ`, `HG`, `AK`, `LR`, `BR`, `CA`,
`HS`, `BL`, `LC`, `DR`, `PLY`, `CF`, `MOB`, `KN`, `HP`, `SPN`, `SH`).
Стиль — контурный, один цвет (`currentColor`), 16×16.
Положить в `src/assets/icons/exercises/*.svg`.
В `ExerciseProps` добавить `iconKey?: string` (уже есть).

### Melange v22 — интеграция с графом

- `run_facts.training_load` — отдельная колонка.
- `training_load` для FIT/TCX — расчёт через HR-зоны.
- Дублирование связей: `exercises_json` в `workout_sessions` может
  ссылаться на `canonical` / `movementKey` — сейчас строки не связаны
  с графом. Возможно, добавить `workout_sessions.exercise_graph_id`.

### Mentat ↔ Graph

- Генератор программ использует `requires` / `variant-of`.
- Превью показывает путь по графу.
- `workoutMatcher.ts` матчит не только по каталогу, но и по графу.

## Правила

- Не дублировать данные из каталогов.
- Canonical vs concrete — не смешивать.
- `PROGRESSIONS_CATALOG` / `NAMED_EXERCISES` / `THENICS_CATALOG` — остаются.
  Граф — надстройка.
- `EQUIVALENCES` в БД — не удалять.
- Не менять сигнатуры `matchIcuLine`, `parseWorkoutText`,
  `buildProgramPreview`.
- Не смешивать `NodeKind` с `CatalogId`.
- `'prehab'` — не `CatalogId`, а `NamedExerciseCategory`.

## Проверка

```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
# пусто

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT COUNT(*) FROM run_streams WHERE source='dodofo' AND channels LIKE '%latlng%';"
# 264
```


===================================================

# Направление 16: Exercise Graph (Melange Graph v1)

> Создано: 2026-10-09
> Статус: активен, файлы-заготовки готовы.
> Продолжение обсуждения из чата Mentat/Thenics.

## Что копировать в новый чат

1. `01_COMMON_CONTEXT.md`
2. `PROJECT_STATE.md`
3. `00_MASTER_INDEX.md`
4. `08_MELANGE.md`
5. `07_SPICE.md`
6. Этот файл

## Идея

Все упражнения — прогрессионные и непрогрессионные — живут в одном
**графе**. Различие между ними не в типе узла, а в **типе рёбер**.

Таблица `equivalences` (Melange v21) — seed-данные, граф — рабочее
представление. `PROGRESSIONS_CATALOG`, `NAMED_EXERCISES`,
`THENICS_CATALOG` остаются источниками — граф строится из них.

## Два уровня узлов

- **canonical** — абстрактный смысл (`ex:push-up`, `ex:pullup`).
- **concrete** — конкретная запись (`ex:wade:pushup:5`, `ex:thenics:push-up`).

Иерархия: `concrete --instance-of--> canonical --instance-of--> pattern`.

## Типы узлов

- `pattern` — корневой паттерн движения (push, pull, row, dip, squat,
  hinge, core-flexion, core-extension, core-anti, inversion, straight-arm,
  balance, locomotion) — 13 штук.
- `exercise` — конкретное упражнение (progression или named).
- `modality` — ring / band / weighted / negative / assisted / isometric /
  explosive. Пока — только задел, у нас нет модальных упражнений.
- `catalog` — контейнер (wade, cali, runner, core, posture, weightloss,
  thenics, named).
- `tissue` — анатомическая цель прехаба (achilles, glute-medius, vmo,
  spine-mobility, shoulder-capsule, …) — 20 штук.
- `skill` — технический навык для drills (ground-contact, cadence, …) —
  9 штук.
- `program` — тренировочная программа (wade new-blood, prehab-mobility, …).

## Типы рёбер

- **Прогрессии:** `progresses-to`, `variant-of`, `progression-from`.
- **Модальности:** `modality-of`.
- **Иерархия:** `instance-of`, `belongs-to`.
- **Кросс-каталог:** `equivalent-to`.
- **Предусловия:** `requires`, `conflicts-with`.
- **Специальные:** `trains`, `targets`, `warms-up`, `used-in`.

## Согласованные решения (в этом чате)

1. **Difficulty отложена на неопределённый срок** (может быть, навсегда).
   Не пишем `difficulty: 0..100`. Оставляем `level` (Wade/Cali 1..10)
   и `band` (Thenics 1..4).
2. **`aliases` и `icuName`** — сохраняем в `ExerciseProps` (для реверс-маппинга
   из `workoutMatcher`).
3. **`modality`** из `ExerciseProps` убираем. Оставляем только
   `ModalityProps` как задел.
4. **`PROGRAM_USAGE`** генерируется из `ALL_PROGRAMS` в `programs.ts`,
   не отдельный статический массив.
5. **`EQUIVALENCES`** — static seed (`thenicsEquivalencesSeed.ts`) + DB overrides
   (таблица `equivalences` из Melange v21). При сборке графа объединяем.
6. **Canonical-узлы для progression keys** (баг в присланном
   `graphBuilder.ts`): при обходе `PROGRESSIONS_CATALOG` создавать
   canonical `ex:canonical:pullup` для каждого `entry.key`. Иначе
   `used-in` из программы повиснет в воздухе.
7. **`smithrun.ts`** — массив из упражнений, концепция будет прислана
   пользователем в этом чате. Пока не пишем.
8. **UI графа:** fullscreen dialog, React Flow (`@xyflow/react` v12)
   + `dagre` (layout). Pan/zoom, мини-карта `<MiniMap>`, правая панель
   для drag unconnected упражнений в граф.

## Что уже есть (в чате присланы)

- **`ontology.ts`** — типы узлов, рёбер, props, ID-хелперы, seed-константы
  (`ROOT_PATTERNS`, `MODALITIES`, `TISSUES`, `SKILLS`), фабрики.
- **`graphBuilder.ts`** — сборщик графа из каталогов + seed-таблицы для
  drills / prehab / plyo / warmup. Аудит. Экспорт в React Flow.
- **Промт с описанием** — что делать в основном чате.

## Что нужно скорректировать в присланных файлах

### `ontology.ts`
- Убрать `difficulty?: number` из `ExerciseProps`.
- Убрать `DifficultyBand` из импорта `'../equivalences'` — тип переносим
  в `thenicsCatalog.ts` (или дублируем в `ontology.ts` как
  `type DifficultyBand = 1 | 2 | 3 | 4`).
- Добавить `aliases?: string[]`, `icuName?: string` в `ExerciseProps`.

### `graphBuilder.ts`
- Не импортировать `EQUIVALENCES` — читать из `thenicsEquivalencesSeed.ts`
  и из БД (через callback).
- `PROGRAM_USAGE` — из `ALL_PROGRAMS` из `../programs`.
- `addCatalogEntry` — создавать canonical-узел для `entry.key`.
  Структура: `concrete --instance-of--> canonical --instance-of--> pattern`.
- `linkInstanceOf` — для progression `concrete` идёт на canonical,
  для named — на pattern.
- В `addProgramEdges` использовать canonical-узлы (они теперь есть).
- Удалить зависимость от `derivedProgressions.ts` — пока его нет.
  `includeDerived = false` по умолчанию, до наполнения `smithrun.ts`.

### Файлы, которых нет
- `derivedProgressions.ts` — не пишем, пока пользователь не пришлёт
  концепцию `smithrun.ts`.
- `equivalences.ts` — не создаём. Вместо этого `graph/seeds/thenicsEquivalencesSeed.ts`
  с одной текущей записью (`thenics/push-up/Beginner → wade/pushup/5`).

## Что нужно от пользователя в этом чате

1. **Концепцию `smithrun.ts`** — пример: какие движения, из каких
   источников, как формируется «массив под рукой». Название «Smith Run»
   (вместо Derived Progressions) — принято.
2. **Подтверждение структуры папки:**
   `src/main/services/pranaBindu/mentat/graph/`.

## План работы

**Заход 1 (этот чат):**
1. Применить корректировки в `ontology.ts` (убрать difficulty, добавить
   aliases / icuName).
2. Создать `graph/seeds/thenicsEquivalencesSeed.ts` (1 запись).
3. Применить корректировки в `graphBuilder.ts`.
4. `npx tsc --noEmit` — чисто.
5. `auditGraph(buildExerciseGraph())` — прислать цифры.

**Заход 2:**
6. `graphQueries.ts` — базовый обход.
7. Интеграция с `workoutMatcher.ts` (опционально).

**Заход 3 — UI:**
8. `npm install @xyflow/react dagre` (и `@types/dagre`).
9. `ExerciseGraphDialog.tsx` (fullscreen Dialog).
10. `ExerciseGraphView.tsx` (React Flow + MiniMap + правая панель).
11. Кнопка открытия — на панели «План» (рядом с «Упражнения»).

**Заход 4 — smithrun:**
12. Написать `smithrun.ts` по концепции пользователя.

## Правила

- Не дублировать данные из каталогов.
- Canonical vs concrete — не смешивать.
- `EXERCISES`, `PROGRESSIONS_CATALOG`, `NAMED_EXERCISES` — остаются.
  Граф — надстройка.
- Не удалять `EQUIVALENCES` в БД.
- Не менять сигнатуры `matchIcuLine`, `parseWorkoutText`,
  `buildProgramPreview`.
- Не смешивать `NodeKind` с `CatalogId`.
- `'prehab'` — это не `CatalogId`, а `NamedExerciseCategory`.
  В графе прехаб-упражнения принадлежат `cat:named` с `category: 'prehab'`.

## Проверка

````bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
# пусто