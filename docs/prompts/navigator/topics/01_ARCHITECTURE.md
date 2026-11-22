# docs/prompts/navigator/topics/01_ARCHITECTURE.md

# 01 — Architecture (7 слоёв)

> Navigator — универсальный Browser Hub. Gateway остаётся legacy, не трогаем.
> Связано: `03_TOOLS.md`, `04_JSON_PROTOCOL.md`, `gateway/topics/02_BROWSER_POOL.md`.

## 7 слоёв

```
┌──────────────────────────────────────────────────────────────┐
│ 7. Navigator UI (окно, sidebar, chat/scrape panel)           │ ← Этап 1
├──────────────────────────────────────────────────────────────┤
│ 6. Pipeline (JSON-шаги)                                      │ ← Этап 3
├──────────────────────────────────────────────────────────────┤
│ 5. Memory (диалоги, файлы, долговременная память)            │ ← Этап 2
├──────────────────────────────────────────────────────────────┤
│ 4. ToolRegistry + JSON-протокол                              │ ← Этап 1
├──────────────────────────────────────────────────────────────┤
│ 3. Tools (Llm / Site / Utility)                              │ ← Этап 1 (LLM), Этап 2 (Site)
├──────────────────────────────────────────────────────────────┤
│ 2. SessionManager (профиль ↔ tool ↔ браузер)                 │ ← Этап 1
├──────────────────────────────────────────────────────────────┤
│ 1. BrowserPool (N браузеров, N профилей)  ← ГОТОВ             │
└──────────────────────────────────────────────────────────────┘
```

## Слой 1 — BrowserPool (переиспользуем)

`src/main/services/gateway/pool/BrowserPool.ts`. `acquire(profileId)` / `release(profileId)`. Guard single-instance lock (П7).

## Слой 2 — SessionManager (Этап 1)

Маппинг `profileId → toolId → page`. Резолвит tool из `ToolRegistry`, вызывает `pool.acquire(profileId)`, `tool.connect(ctx)`. При send — `pool.acquire` (или существующий) + `tool.sendMessage(page, msg)`.

## Слой 3 — Tools (3 типа, см. `03_TOOLS.md`)

- **LlmProviderAdapter** — обёртка существующего `ProviderAdapter` (`gateway/providers/`)
- **SiteAdapter** — OSINT, rusprofile, kad.arbitr
- **UtilityTool** — email-generator, cookieTracker (без браузера)

## Слой 4 — ToolRegistry + JSON-протокол (см. `04_JSON_PROTOCOL.md`)

`Map<toolId, ToolEntry>`. `ToolEntry = { id, kind: 'llm'|'site'|'utility', displayName, requiresAuth, send|run }`.

## Слой 5 — Memory (Этап 2)

Обобщение `GatewayCacheService` (conversations/messages/files) + `contextBuilder` (долговременная память). Provider-agnostic. **Не трогаем до Этапа 2.**

## Слой 6 — Pipeline (Этап 3)

JSON-шаги: `[{tool, action, params}, ...]`. Оркестрация через ToolRegistry. **После MVP.**

## Слой 7 — UI (Этап 1)

`NavigatorPage` (sidebar + chat) — новое окно `navigatorWindow.ts`, route `/navigator`. **Не тянет `GatewayPage.tsx` (2908 строк).**

## Что НЕ трогаем

- `GatewayPage.tsx`, `TopControlPanel.tsx`, `deepseekService.ts` — Gateway работает как есть
- Правило: DeepSeek UI не трогаем до закрытия Navigator MVP