# Стандартизация CSS/стилей для модулей приложения

> Версия: 1 (2026-11-20). Черновик, обсуждается.
> Связано: `COMPONENTS_CONVENTION.md` (React-контракты), `src/styles/common/theme.css` (реальный код).
> Место: `docs/prompts/_common/` — общая конвенция для **всех** модулей.

## Что

Мини-библиотека стилей на основе CSS Prana-Bindu: единый набор компонентов (панели, кнопки, инпуты, календари, drawer'ы, таблицы, диалоги, табы, бейджи) с цветовым переопределением по модулю.

## Зачем

Сейчас в проекте несколько модулей, у каждого свои CSS-правила. Общие паттерны дублируются с разными цветами. Нужна единая система: одинаковое поведение, разные акценты.

## Ключевые решения

### 1. Одна тема на модуль-окно

Каждое окно имеет свою акцентную тему (Prana-Bindu — песочная `#d4a373`, OSINT — синяя `#6ab2f2`, Gateway — DeepSeek-синяя `#4d6bfe`, Trading — красная). Пользователь может переопределить в настройках модуля.

### 2. Общая библиотека + акцентные переменные

Компоненты описываются один раз через CSS-переменные:
```
--module-accent
--module-accent-soft
--module-accent-rgb
```
Конкретное значение задаётся на корне модуля (`.pb-page`, `.osint-page`, `[data-module="gateway"]`).

### 3. N фонов на модуль (опция)

Тема содержит набор фонов (тёмный, светлый, кастомный). Хранится в `localStorage` или `sync_settings` модуля.

### 4. Формат: CSS-переменные + опциональный runtime-override

Тема задаётся CSS-переменными на `.module-root`, значения из настроек при старте окна.

## Обязательные CSS-переменные

```css
--module-accent            /* основной акцент (prana-bindu #d4a373, osint #6ab2f2) */
--module-accent-rgb        /* RGB для color-mix */
--module-accent-contrast   /* цвет текста на accent (обычно #1a1a1a) */
--module-bg                /* основной фон модуля */
--module-surface           /* фон карточек/панелей */
--module-border            /* цвет границ */
--module-text              /* основной текст */
--module-text-muted        /* вторичный текст (hint) */
```

## Классы-компоненты

`{mod}` — корневой класс модуля (`pb`, `osint`, `gateway`, `trading`).
`{mod}-x` — модификаторы.

Список:
- `.{mod}-panel`, `.{mod}-button`, `.{mod}-button-soft`, `.{mod}-button-destructive`
- `.{mod}-input`, `.{mod}-calendar`, `.{mod}-drawer`
- `.{mod}-tabview`, `.{mod}-badge-*`

Соглашение о нейминге: `.{mod}` — корневой, `.{mod}-x` — модификаторы.

## Как подключить тему

1. В файле модуля определить переменные (например, `[data-module="prana-bindu"]`).
2. Подключить общий `src/styles/common/theme.css` (там базовые tg-* + module-accent по умолчанию).

## Хранение настроек пользователя

- `localStorage` или `sync_settings` модуля.
- Структура: `{ accent, bg, surface }` (опционально).

## Миграционный план

1. Скопировать `01_COMMON_CONTEXT.md`, `PROJECT_STATE.md`, этот файл, `PranaBinduPage.css`, `DatabasePage.css`.
2. Обсудить черновик.
3. Написать `docs/prompts/_shared/STYLES_CONVENTION.md` (готово — это он).
4. Пилот: Prana-Bindu на новую систему (без потери вида).
5. OSINT вторым — проверить масштабируемость.

## Референс: `src/styles/common/theme.css`

```css
:root {
  /* Базовые цвета (Telegram-тема) */
  --tg-bg: #17212b;
  --tg-surface: #232e3c;
  --tg-text: #f5f5f5;
  --tg-hint: #708499;
  --tg-destructive: #ec3942;
  --tg-success: #6fbf73;
  --tg-border: rgba(255, 255, 255, 0.08);

  /* Алиасы tg-theme-* для common-компонентов */
  --tg-theme-bg-color: var(--tg-bg);
  --tg-theme-text-color: var(--tg-text);
  --tg-theme-hint-color: var(--tg-hint);
  --tg-theme-destructive-text-color: var(--tg-destructive);
  --tg-theme-secondary-bg-color: var(--tg-surface);
  --tg-theme-section-bg-color: var(--tg-surface);
  --tg-theme-accent-text-color: var(--tg-text);

  --surface-border: var(--tg-border);

  /* Default accent (синий, как в OSINT) */
  --module-accent: #6ab2f2;
  --module-accent-rgb: 106, 178, 242;
  --module-accent-contrast: var(--tg-bg, #17212b);

  /* Универсальная высота инпутов / дропдаунов / календарей */
  --control-height: 2.5rem;
}

/* Prana-Bindu: песочная */
[data-module="prana-bindu"], .pb-page-root {
  --module-accent: #d4a373;
  --module-accent-rgb: 212, 163, 115;
  --module-accent-contrast: var(--tg-bg, #17212b);
  --tg-theme-text-color: var(--tg-text, #f5f5f5);
  --tg-theme-accent-text-color: var(--tg-text, #f5f5f5);
}

/* OSINT: синяя */
[data-module="osint"] {
  --module-accent: #6ab2f2;
  --module-accent-rgb: 106, 178, 242;
  --module-accent-contrast: var(--tg-bg, #17212b);
}

/* Gateway: DeepSeek-синяя */
[data-module="gateway"] {
  --module-accent: #4d6bfe;
  --module-accent-rgb: 77, 107, 254;
  --module-accent-contrast: #ffffff;
  --tg-theme-bg-color: #1a1a1d;
  --tg-theme-text-color: #f5f5f5;
  --tg-theme-hint-color: #8a8a8f;
  --tg-theme-secondary-bg-color: #232326;
  --tg-theme-section-bg-color: #1e1e22;
  --tg-theme-destructive-text-color: #ec3942;
  --surface-border: rgba(255, 255, 255, 0.08);
}
```

## Что НЕ входит

- Рефакторинг всех модулей сразу — сначала конвенция, потом миграция.
- Тёмная/светлая тема системы — только акценты и фоны модулей.

## Связанные

- `COMPONENTS_CONVENTION.md` — React-контракты.
- `src/styles/common/theme.css` — реальные переменные.
- `src/styles/common/` — `buttons.css`, `inputs.css`, `dialogs.css`, `tables.css`.