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

## Статус (2026-11-23, реорганизация завершена)

**Итог:** `scripts/{mjs(40),bash(3),python(0), _backup/}`
- **mjs/** (40): 6 базовых, 3 recon-gigachat, 2 test-context-*, 6 test-deepseek/*, 5 md-*, 4 handoff/context, 3 recon batch1, 3 cookies/profiles (tracked), 3 recon batch3 (tracked), 3 recon batch4, 3 recon batch5.
- **bash/** (3): `sync-submodule`, `recon`, `recon-symbols`.
- **root**: пусто (все `.mjs`/`.sh` разобраны).
- **_backup/** (21): 5 root-дублей, 5 мёртвых утилит, 5 profile-menu, 1 inject-cookies, `kad-test/` (5, не Gateway), `zepp/` (2, не Gateway). См. `scripts/_backup/README.md`.
- **Не тронуто:** `test-intervals-abort.mjs` (prana-bindu, отдельная сессия), `kad-test/`, `zepp/` — ждут решения по принадлежности модулю.

**.gitignore** — whitelist `!scripts/mjs/recon-*.mjs` (12 имён) для документированных recon; `recon-*.candidates/discovered.json` остаются в `scripts/` и не трекаются.

**Дальше:** прогон `node scripts/mjs/scripts-index.mjs` + `mjs/scripts-index.mjs` как основа `topics/08_JSON_TOOLS.md` (tool-calling).

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
- **Проверка вызовов (2026-11-23):** приложение использует `\scripts/mjs/preflight-check.mjs`. Root-версия → `scripts/_backup/`. Ссылка в `handoffBuilder.ts:278` обновлена.