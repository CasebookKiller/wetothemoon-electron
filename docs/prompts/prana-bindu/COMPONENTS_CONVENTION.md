# Компоненты COMMON — конвенция

> Обновлено: 2026-09-30
> Статус: черновик, обсуждается в отдельном чате.

## Цель

Единая коллекция React-компонентов для всех модулей приложения
(Prana-Bindu, OSINT, Gateway, Trading, Bonds, ...). Различия между
модулями — только через CSS-переменные и классы (см.
`STYLES_CONVENTION.md`). React-контракт — общий.

## Ключевые решения

### 1. Только глупые компоненты (props-only)

**Все компоненты в COMMON — dumb.** Никаких обращений к `api.pb.*`,
`fetch`, `localStorage`, `ipcRenderer`. Только `props` и внутренний
UI-state.

**Зачем:** возможность масштабировать на другие проекты, не тащить
логику IPC/БД. Логика — в родителе модуля (умном контейнере).

**Как выглядит контракт:**

```tsx
// Глупый. Всё приходит снаружи.
interface Props {
  current: number;
  total: number;
  filename: string;
  stats: { imported: number; updated: number; skipped: number; failed: number };
  onCancel: () => void;
  className?: string;
  panelClassName?: string;
}

export const ProgressBarWithStats: React.FC<Props> = ({ ... }) => { ... };
```

**Исключение:** если компонент **обязан** знать про тему (например,
`GpsMapView` тянет тайлы), интерфейс всё равно props-only, а
загрузка тайлов — внутри (это UI-логика, не бизнес).

### 2. Где живут

`src/components/COMMON/`

### 3. Префикса нет

Имена без `Module*` / `Pb*` / `Osint*`. Различие — через классы
(`pb-`, `osint-`), передаваемые родителем.

### 4. Barrel-импорт

`src/components/COMMON/index.ts` реэкспортирует всё.

- **Внешние модули** — через barrel:
  ```ts
  import { ActionButton, SourceBadges } from '@/components/COMMON';
  ```
- **Внутри COMMON** — прямые импорты (для быстрого HMR):
  ```ts
  import { ActionButton } from './ActionButton';
  ```

### 5. CSS-классы через props

Компонент принимает `className` и, если порталы — `panelClassName`.
Родитель-модуль подставляет свой префикс:

```tsx
<Dropdown
  className="pb-archive-origin__dropdown"
  panelClassName="pb-dropdown-panel"
  ...
/>
```

Дефолтный класс компонента — `module-agnostic` (`common-dropdown-panel`),
если родитель не передал свой.

## Общие правила

1. **Пропсы с явными типами.** Никаких `any` в публичном API.
2. **Стилизация — через CSS-переменные модуля**
   (`--module-accent` и т.д.), не через прямые цвета.
3. **Один файл = один компонент.** Плюс `.css` рядом.
4. **Публичный API — короткий.** Если > 10 пропсов — разбить
   на два.
5. **Никаких side effects.** `useEffect` — только для внутреннего
   UI-state (раскрытие, скролл, ресайз).
6. **Никаких импортов из `services/pranaBindu/`, `melange/`,
   `ipcHandlers/`** — иначе компонент перестаёт быть переиспользуемым.

## Коллекция

### Кнопки и действия

| Компонент | Назначение | Props (черновик) |
|---|---|---|
| `<ActionButton>` | Кнопка `.module` / `.module-soft` / `.module-destructive` | `label`, `icon`, `variant`, `onClick`, `disabled`, `loading`, `tooltip` |
| `<StepperInput>` | InputNumber с `[−][+]` по бокам | `value`, `onChange`, `min`, `max`, `placeholder` |
| `<ModulePanel>` | Panel с заголовком | `header`, `children`, `className` |

### Формы и ввод

| Компонент | Props (черновик) |
|---|---|
| `<AccentInput>` | `value`, `onChange`, `placeholder`, `type`, `disabled` |
| `<AccentCalendar>` | `value`, `onChange`, `minDate`, `maxDate`, `placeholder` |
| `<AccentDropdown>` | `value`, `options`, `onChange`, `placeholder`, `panelClassName` |
| `<DateRangePicker>` | `from`, `to`, `onChange`, `quickRanges?: Array<{label, days}>` |
| `<ImportOriginDropdown>` | `value`, `options`, `onChange` |

### Отображение

| Компонент | Props (черновик) |
|---|---|
| `<SourceBadges>` | `sources: string[]`, `maxVisible?` |
| `<StatRow>` | `label`, `value`, `valueClassName?` |
| `<PanelSection>` | `title`, `count?`, `children` |
| `<ChannelAnalyzer>` | `channels: ChannelStat[]` |
| `<ProgressBarWithStats>` | `current`, `total`, `filename`, `stats`, `onCancel` |

### Карты

| Компонент | Props (черновик) |
|---|---|
| `<GpsMapView>` | `latlng`, `hr?`, `elevation?`, `gpsQuality`, `height?` |

### Dev-страница

`src/pages/_DevComponentsPage/` — ручной просмотр.
Route: `#/dev-components`. Открывается через меню (только в dev).

## Порядок миграции

1. `<ProgressBarWithStats>` — уже есть прототип, изолирован.
2. `<SourceBadges>` — просто, три места использования.
3. `<ActionButton>` — везде, рискованно, делать аккуратно.
4. `<ModulePanel>` — обёртка над `<Panel>`.
5. Остальное — по мере надобности.

## Открытые вопросы

1. **Dev-страница.** Где и как открывать? В меню отдельным пунктом?
   Через `Ctrl+Shift+D`?
2. **CSS-файлы.** Один `common.css` на всю коллекцию или по файлу
   на компонент? Пока — по файлу.
3. **Тема по умолчанию.** Какой accent у dev-страницы?
   Ответ: переключатель тем вверху.

### Библиотека стилей (COMMON) — прогресс

- **Сделано**: `theme.css` (переменные), `buttons.css`, `inputs.css` (слайдеры, чекбоксы), `dialogs.css`, `tables.css`.
- **Сделано**: `RouteMapEditor` использует `pb-connections__block`, `pb-catalog__chips`, `pb-checkbox-dark`, `pb-soft`.
- **TODO**: 
  - Разбить `pb-components.css` на более мелкие модули.
  - Перевести остальные модалки на `<AppDialog>`.
  - Унифицировать стили треков, календарей и панели «Пробежки» (сейчас они частично дублируют друг друга).

### Задача: Глубокая унификация стилей компонентов

- **Текущее состояние:** Основные стили PB вынесены в `pb-components.css` (~5000 строк). Базовые кнопки, инпуты и диалоги вынесены в `src/styles/common/`.
- **Цель:** Провести ревизию `pb-components.css` и вынести переиспользуемые паттерны (Drawer, Каталог, Таблицы, Таймлайн) в `COMMON`.
- **Что нужно сделать:**
  1. Разбить `pb-components.css` на логические файлы (`pb-drawer.css`, `pb-catalog.css`, `pb-graph.css` и т.д.).
  2. Вынести `SourceBadge`, `ProgressBar`, `Timeline` в библиотеку `COMMON`.
  3. Заменить дублирующиеся кастомные селекторы (например, `.pb-run-filters__radio .p-radiobutton`) на глобальные классы из `common/inputs.css`.
  4. Унифицировать модалки: перевести все оставшиеся `<Dialog>` на `<AppDialog>`.

## Связанный чат

STYLES_CONVENTION.md — про CSS-переменные.
COMPONENTS_CONVENTION.md (этот файл) — про React-контракты.