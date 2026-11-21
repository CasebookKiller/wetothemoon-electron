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
