# HANDOFF_STRUCTURE — стандарт структуры промптов модулей

> Версия: 1 (2026-11-20). Обязателен для всех модулей `wetothemoon-electron`.
> Введён для совместимости ручной сборки контекста (как раньше) и
> handoff-by-button (кнопка «Экспорт handoff» в UI).
>
> Заменяет плоскую структуру `handoff/{roadmap,problems,techdebt}.md`
> на `topics/<NN>_<NAME>.md` + сжатые module-level файлы.

## Структура модуля

```
docs/prompts/<module>/
├── 00_MASTER_INDEX.md            ← навигация «что где» (~100 строк)
├── COMMON_CONTEXT.md             ← «всегда отправлять» (дистиллят, ~300–400 строк)
├── PROJECT_STATE.md              ← снимок цифр/статуса (~150–200 строк)
├── summary.md                    ← manifest-node в context chain (не трогать)
├── topics/                       ← ОДИН ФАЙЛ = ОДНО НАПРАВЛЕНИЕ (плоско)
│   ├── <NN>_<NAME>.md            ← напр. 07_SPICE.md, 16_GRAPH.md
│   └── ...
└── handoff/                      ← только кросс-направленческое
    ├── architecture.md           ← накопительная, не делится
    ├── done.md                   ← «что не откатывать»
    ├── next-steps.md             ← «приоритет на сессию» (ссылается на topics/*)
    ├── handoff-system.md         ← проблемы самого handoff-механизма
    └── _HISTORY/                 ← (опционально) сессионные handoff-ы
```

## Разграничение ролей

| Файл | Роль | Отправляется в контекст |
|---|---|---|
| `00_MASTER_INDEX.md` | навигация «что где» | ✅ всегда |
| `COMMON_CONTEXT.md` | «всё, что нужно знать перед любой задачей» | ✅ всегда |
| `PROJECT_STATE.md` | снимок цифр/статуса на дату | ✅ всегда |
| `summary.md` | короткий overview для context chain | ✅ автоматически (manifest) |
| `topics/<NN>.md` | текущая задача направления | ✅ по выбору (1–2 файла) |
| `handoff/architecture.md` | референс, история принципов | ❌ on-demand |
| `handoff/done.md` | «что не откатывать» | ✅ при старте |
| `handoff/next-steps.md` | «приоритет на сессию» | ✅ при старте |
| `handoff/handoff-system.md` | проблемы handoff-механизма | ✅ при работе над handoff |

## Ручная сборка контекста (как раньше)

```
master_index + _common/COMMON.md + PROJECT_STATE.md + topics/<NN>.md + topics/<MM>.md
```

Плюс через handoff-by-button — тот же набор, но автоматически + git state + preflight + schema.

## Правила topics

1. **Плоско:** один файл = одно направление.
2. **Имена:** `<NN>_<NAME>.md`, NN — номер направления из большой карты (02, 03, 07, 08, 11, 16, 17, 18). Не 01, 02, 03 по порядку в папке.
3. **Мутабельность:** направления появляются/меняются по ходу разработки. `handoffBuilder` читает `topics/*.md` через glob/readdir, не хардкодит список.
4. **`00_MASTER_INDEX.md`** — единственное место, где список тем описан явно (для навигации человеку). При добавлении файла — обновить INDEX.
5. **UI-чекбоксы** (будущая фича, перенос кнопки handoff в диалог профилей) строятся динамически из `readdir(topics/)`.

## Миграция со старой структуры (handoff/{roadmap,problems,techdebt})

1. **Параллельное существование:** старые файлы **не удаляются** до полного наполнения `topics/`.
2. **Fallback в handoffBuilder:** если `structure: 'topics'` и `topics/` пуст — читаем legacy. Логируем warning.
3. **Переключение в самом конце:** одна правка в `MODULE_MAP` (`structure: 'topics'`). Legacy помечаются `⚠️ DEPRECATED`, но физически остаются 1–2 сессии.
4. **Долговременная память** (`context_nodes` / `context_versions`) не затрагивается.
5. **Откат:** `git reset --hard pre-topics-migration-YYYY-MM-DD` (тег ставится перед стартом).

## Два пути handoff (в переходный период)

| Путь | UI | IPC | Сервис | Выход |
|---|---|---|---|---|
| **Б (основной)** | `TopControlPanel` dropdown модулей | `gateway:export-handoff` | `handoffBuilder.ts` | `userData/handoff/handoff-*.md` |
| **А (второй)** | `GatewayChatHeader` «Экспорт продолжения» | `gateway:export-continuation` | `contextBuilder.ts` | `userData/continuation/continuation-*.md` |

Объединение путей — в roadmap «Следующие сессии».

## Текущий статус модулей

| Модуль | Структура | Мигрирован |
|---|---|---|
| gateway | topics | Фаза B/C (2026-11-20) |
| prana-bindu | topics | Фаза D (следующая сессия) |
| osint / sietch | legacy | Фаза E (когда дойдут руки) |
| landsraad | legacy | Фаза E |
| trading | legacy | — |
| tasks | legacy | — |
| ollama | legacy | — |
| ai-chat | legacy | — |

## Как это не ломает долговременную память

- `context_nodes` / `context_versions` в `gateway.db` — **не трогаем**. Схема v9 уже поддерживает иерархию `global → project → submodule → module → direction`.
- `summary.md` — **manifest-node**, через него `getChain()` собирает цепочку. Не переименовываем, не удаляем.
- `_common/COMMON.md` — **глобальный уровень**, не трогаем.
- `gen-context-manifest.mjs` — подхватит новые `topics/*.md` (не в SKIP). `COMMON_CONTEXT.md` / `00_MASTER_INDEX.md` классифицирует как `global` — пользователь правит вручную в черновике манифеста (как и задумано).
- `preflight-check.mjs` — не проверяет `docs/prompts/`, миграция его не сломает. Сторожит `context.manifest.json` → предупредит, если `global → 01_COMMON_CONTEXT` (OSINT-баг).