# docs/prompts/navigator/topics/04_JSON_PROTOCOL.md

# 04 — JSON-протокол

> Единый контракт вызова tools. Связано: `03_TOOLS.md`, `01_ARCHITECTURE.md`.

## Формат запроса

```json
{ "tool": "<toolId>", "action": "<actionName>", "params": { ... } }
```

Тип tool определяется в `ToolRegistry` (`kind`), не в запросе.

## LLM (стрим)

```json
{ "tool": "gigachat", "action": "send", "params": { "message": "Привет" } }
```
→ `AsyncIterable<MessageChunk>`:
```json
{ "type": "text", "text": "..." }
{ "type": "text", "text": "...", "reset": true }
{ "type": "done" }
```

## Site (запрос → данные)

```json
{ "tool": "rusprofile", "action": "company", "params": { "inn": "7707083893" } }
```
→
```json
{ "ok": true, "data": { "name": "...", "ogrn": "...", "address": "..." } }
```

## Utility (без браузера)

```json
{ "tool": "email-generator", "action": "generate", "params": { "name": "Иван", "domain": "example.com" } }
```
→
```json
{ "ok": true, "data": { "emails": ["ivan@example.com"] } }
```

## IPC-контракт

| IPC | Что |
|---|---|
| `navigator:list-tools` | `[{id, kind, displayName, requiresAuth}]` |
| `navigator:send(profileId, message)` | стрим через `navigator:chunk` |
| `navigator:on-chunk` | `{profileId, chunk: MessageChunk}` |
| `navigator:run-tool(toolId, action, params)` | (Этап 2, site/utility) |

## Pipeline (Этап 3)

```json
{
  "steps": [
    { "tool": "rusprofile", "action": "company", "params": { "inn": "..." }, "saveAs": "company" },
    { "tool": "gigachat", "action": "send", "params": { "message": "Опиши: {{company.name}}" } }
  ]
}
```
Контракт зафиксирован. Реализация — Этап 3.