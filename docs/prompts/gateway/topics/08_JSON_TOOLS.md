# 08 — JSON Tools (prompt-based tool calling)

## Зачем
Browser > API → не OpenAI `tool_calls`, а prompt-based:
1. Системный промпт перечисляет tools (name/purpose/args/result)
2. LLM отвечает ` ```json {"tool":"...","args":{...}}``` `
3. Приложение парсит, валидирует, запускает **скрипт** из manifest
4. Результат уходит обратно LLM

## Состав
- `services/gateway/tools/registry.ts` — читает `scripts/manifest.json`
- `parser.ts` — извлекает JSON-блок
- `executor.ts` — валидация args, spawn скрипта, timeout
- `audit.ts` → `tool_audit` (v11)
- `promptBuilder.ts` — секция «Available tools»

## Whitelist
Только скрипты с `"tool": true` в manifest. Никакого `eval`. Только `spawn` с фиксированным argv.

## Схема v11
`tool_audit(id, task_id, conversation_id, tool, args_json, result_json, ok, at)`

## Начинать с
`read_context_node` → `git_state` → `create_task`

## Приоритет: высокий (1 сессия на MVP)