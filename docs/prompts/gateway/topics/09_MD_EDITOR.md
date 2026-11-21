# 09 — MD-редактор в UI

## Зачем
Править `topics/*.md` и `handoff/*.md` прямо из приложения.

## Состав
- `components/COMMON/MarkdownEditor/` — textarea + preview (marked + DOMPurify)
- IPC: `gatewayHandoffReadFile(moduleId, relPath)` / `gatewayHandoffWriteFile(moduleId, relPath, content)`
- Whitelist: только `docs/prompts/<module>/**/*.md`, никаких `..`, никаких абсолютных

## UI
В `HandoffTab` рядом с intent-файлами — иконка ✏️ → editor в модалке. В `topics` — то же.

## Приоритет: высокий (40–60 мин)