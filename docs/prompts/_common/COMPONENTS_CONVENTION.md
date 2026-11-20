# Компоненты COMMON — конвенция

> Версия: 1 (2026-11-20). Черновик, обсуждается.
> Связано: `STYLES_CONVENTION.md` (CSS-переменные), `src/components/COMMON/` (реальный код).
> Место: `docs/prompts/_common/` — общая конвенция для **всех** модулей.

## Цель

Единая коллекция React-компонентов для всех модулей (Prana-Bindu, OSINT, Gateway, Trading, Bonds, …). Различия — только через CSS-переменные и классы (см. `STYLES_CONVENTION.md`). React-контракт — общий.

## Ключевые решения

### 1. Только глупые компоненты (props-only)

**Все компоненты в COMMON — dumb.** Никаких `api.pb.*`, `fetch`, `localStorage`, `ipcRenderer`. Только `props` и внутренний UI-state.

**Зачем:** масштабировать на другие проекты, не тащить логику IPC/БД. Логика — в родителе модуля.

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
```

**Исключение:** если компонент **обязан** знать про тему (например, `GpsMapView` тянет тайлы) — интерфейс всё равно props-only, загрузка тайлов внутри (UI-логика, не бизнес).

### 2. Где живут

`src/components/COMMON/`

### 3. Префикса нет

Имена без `Module*` / `Pb*` / `Osint*`. Различие — через классы (`pb-`, `osint-`), передаваемые родителем.

### 4. Barrel-импорт

`src/components/COMMON/index.ts` реэкспортирует всё.
- **Внешние модули** — через barrel: `import { ActionButton } from '@/components/COMMON'`.
- **Внутри COMMON** — прямые импорты (для быстрого HMR).

### 5. CSS-классы через props

Компонент принимает `className` и, если порталы — `panelClassName`. Родитель подставляет свой префикс.

```tsx
<Dropdown className="pb-archive-origin__dropdown" panelClassName="pb-dropdown-panel" />
```

Дефолт — `module-agnostic` (`common-dropdown-panel`), если родитель не передал свой.

## Общие правила

1. **Пропсы с явными типами.** Никаких `any` в публичном API.
2. **Стилизация — через CSS-переменные модуля** (`--module-accent`), не через прямые цвета.
3. **Один файл = один компонент.** Плюс `.css` рядом.
4. **Публичный API — короткий.** Если > 10 пропсов — разбить на два.
5. **Никаких side effects.** `useEffect` — только для внутреннего UI-state (раскрытие, скролл, ресайз).
6. **Никаких импортов из `services/pranaBindu/`, `melange/`, `ipcHandlers/`** — иначе компонент перестаёт быть переиспользуемым.

## Коллекция (план)

### Кнопки и действия

| Компонент | Назначение | Props |
|---|---|---|
| `<ActionButton>` | `.module` / `.module-soft` / `.module-destructive` | `label`, `icon`, `variant`, `onClick`, `disabled`, `loading`, `tooltip` |
| `<StepperInput>` | InputNumber с `[−][+]` | `value`, `onChange`, `min`, `max`, `placeholder` |
| `<ModulePanel>` | Panel с заголовком | `header`, `children`, `className` |

### Формы и ввод

| Компонент | Props |
|---|---|
| `<AccentInput>` | `value`, `onChange`, `placeholder`, `type`, `disabled` |
| `<AccentCalendar>` | `value`, `onChange`, `minDate`, `maxDate`, `placeholder` |
| `<AccentDropdown>` | `value`, `options`, `onChange`, `placeholder`, `panelClassName` |
| `<DateRangePicker>` | `from`, `to`, `onChange`, `quickRanges?` |
| `<ImportOriginDropdown>` | `value`, `options`, `onChange` |

### Отображение

| Компонент | Props |
|---|---|
| `<SourceBadges>` | `sources: string[]`, `maxVisible?` |
| `<StatRow>` | `label`, `value`, `valueClassName?` |
| `<PanelSection>` | `title`, `count?`, `children` |
| `<ChannelAnalyzer>` | `channels: ChannelStat[]` |
| `<ProgressBarWithStats>` | `current`, `total`, `filename`, `stats`, `onCancel` |

### Карты

| Компонент | Props |
|---|---|
| `<GpsMapView>` | `latlng`, `hr?`, `elevation?`, `gpsQuality`, `height?` |

### Реально существует (2026-11-20)

| Компонент | Где |
|---|---|
| `<Link>` + `<FileSelector>` | `src/components/COMMON/Link/` |

Остальное — **план**. Постепенно наполняется.

## Dev-страница

`src/pages/_DevComponentsPage/` — ручной просмотр. Route `#/dev-components`. Через меню (только в dev).

## Порядок миграции

1. `<ProgressBarWithStats>` — прототип есть, изолирован.
2. `<SourceBadges>` — просто, три места использования.
3. `<ActionButton>` — везде, рискованно, аккуратно.
4. `<ModulePanel>` — обёртка над `<Panel>`.
5. Остальное — по мере надобности.

## Открытые вопросы

1. **Dev-страница.** Где открывать? Меню / `Ctrl+Shift+D`?
2. **CSS-файлы.** Один `common.css` или по файлу на компонент? Пока — по файлу.
3. **Тема по умолчанию** у dev-страницы — переключатель тем вверху.

## Связанные

- `STYLES_CONVENTION.md` — про CSS-переменные.
- `src/styles/common/theme.css` — реальные переменные.
- `src/components/COMMON/` — реальный код.