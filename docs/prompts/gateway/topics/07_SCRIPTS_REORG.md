# 07 — Скрипты: структура, headers, manifest

## Структура

```
scripts/
├── README.md
├── manifest.json # генерируется из headers
├── bash/
├── mjs/
└── python/
```

## Header-конвенция (bash/mjs/python)
Обязательные поля:
- `@name` — kebab-case
- `@purpose` — одна строка
- `@input` / `@output` — форматы
- `@args` — JSON Schema аргументов (для tool-calling)
- `@result` — JSON Schema результата
- `@exit` — карта кодов
- `@tool` — true/false (доступен ли LLM)
- `@example`

## manifest.json
Генерируется `mjs/scripts-index.mjs` из headers. Поля:
`{path, name, purpose, argsSchema, resultSchema, tool, runtime}`

## Правила скриптов с `@tool true`
- Принимает JSON в argv[1] или stdin
- Возвращает JSON в stdout, ничего лишнего
- Ошибки → stderr + exit != 0
- Без интерактивных prompt
- Timeout 30s

## Приоритет: высокий

## Статус (2026-11-21)

**Сделано:**
- `scripts/{mjs,bash,python}/` — папки созданы
- 6 ключевых скриптов **скопированы** (не перенесены) с headers:
  - `mjs/`: `preflight-check`, `test-context-service`, `test-cont-source`, `gen-context-manifest`, `scripts-index`
  - `bash/`: `sync-submodule`
- `scripts-index.mjs` — генератор `manifest.json` из headers
- `manifest.json` — сгенерирован, 6 скриптов
- Оригиналы `scripts/*.mjs` **не тронуты** — приложение (`handoffBuilder.ts:274`, `package.json`) работает со старыми путями

**TODO:**
- Перенести остальные 40+ скриптов (recon-*, md-*, test-*, inject-*) — по мере касания
- `scripts/README.md` — человеческий индекс
- **Проверка вызовов:** приложение использует `scripts/preflight-check.mjs` (без `mjs/`) — не сломать при будущем `mv`
