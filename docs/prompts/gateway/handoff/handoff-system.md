# handoff-system — проблемы самого handoff-механизма

> Не про Gateway-фичи, а про инструмент сборки контекста.
> Стандарт структуры — `_common/HANDOFF_STRUCTURE.md`.

## Два пути handoff

| Путь | UI | IPC | Сервис | Выход |
|---|---|---|---|---|
| **Б (осн.)** | `TopControlPanel` dropdown | `gateway:export-handoff` | `handoffBuilder.ts` | `userData/handoff/handoff-*.md` |
| **А (второй)** | `GatewayChatHeader` «Экспорт продолжения» | `gateway:export-continuation` | `contextBuilder.ts` | `userData/continuation/continuation-*.md` |

Объединение — в roadmap «Следующие сессии».

## TD9 — `scripts/recon-*.mjs` под `.gitignore`

**Проблема:** recon-скрипты ignored, при checkout потеряются.
**Фикс:** `git add -f scripts/mjs/recon-*.mjs` (сделано для `recon-gigachat-adapter-test` и `recon-gigachat-conversations`). При новых recon — `-f`.

## П2 — `global block present: false` в тесте

**Симптом:** тест искал `<context key="global">`, формат тега другой. `source: db` работает.
**Статус:** не блокер.

## Миграция на topics/ (2026-11-20)

**Сделано:**
- A.4: `readModuleRoot` + `module-root` scope в `handoffBuilder.ts` (коммит `be84ecb`).
- A.3: `_common/HANDOFF_STRUCTURE.md` (`8ce3431`).
- B.1–B.8: `COMMON_CONTEXT.md`, `00_MASTER_INDEX.md`, `PROJECT_STATE.md`, `topics/01–05` (`c23ef21`…`6014733` + текущая сессия).
- `.gitignore`: `!docs/prompts/gateway/**`, `!docs/prompts/_common/**`, `directions/` обратно в ignore (`ba300b1`, `c3948b3`).

**Осталось (Фаза C):**
1. `handoffBuilder.ts` — добавить поле `structure: 'topics' | 'legacy'` в `MODULE_MAP`, fallback-логику (если `topics/` пуст — читаем legacy).
2. Переключить `MODULE_MAP.gateway.structure = 'topics'`.
3. Legacy `handoff/{roadmap,problems,techdebt}.md` → `⚠️ DEPRECATED` в шапке.
4. Проверить handoff-by-button — читает `topics/`.
5. `wm-backup` + push.

**Откат:** `git reset --hard pre-topics-migration-2026-11-20`.

## gen-context-manifest.mjs

**Проблема:** `COMMON_CONTEXT.md` / `00_MASTER_INDEX.md` классифицирует как `global` (regex `common_context|^00`), а надо `module`. `topics/*.md` — как `direction` (правильно).

**Фикс (Фаза B, после наполнения topics/):** либо правим `classify`, либо правим манифест руками (как задумано: «пользователь правит вручную»).

## preflight-check.mjs

Не трогает `docs/prompts/`, миграция не ломает. Сторожит `context.manifest.json`.

## Что осталось (после миграции)

- **B.10:** `handoff/architecture.md` + принцип 0 (цель) + принцип 16 (Agent-роли).
- **B.11:** `handoff/done.md` + строки из v9.
- **C:** переключение `structure: 'topics'`.
- **Фаза D:** prana-bindu (та же схема).
- **Фаза E:** OSINT/Sietch/Landsraad.