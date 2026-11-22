# Navigator — общий контекст модуля

> Версия: 1 (2026-11-22). «Always-on» дистиллят. Заменяет Handoff v13 (Gateway) как новая архитектура.
> Gateway остаётся legacy — не трогаем до закрытия Navigator MVP.
> История принципов — `handoff/architecture.md`. Навигация — `00_MASTER_INDEX.md`.

## Что это

**Универсальный Browser Hub** в `wetothemoon-electron`. Не «чат с LLM», а единый хаб для всего, что работает через браузер:
- LLM (DeepSeek, GigaChat, Alice, Qwen)
- Сайты-источники (rusprofile, kad.arbitr, mos-gorsud)
- Инструменты (email-generator, cookieTracker)
- Оркестратор (Pipeline, JSON-шаги)

Окно: `#/navigator`. IPC: `navigator:*`. БД: `gateway.db` (общая).

## 🎯 Цель

Наследует **принцип 0 Gateway**: автономное использование бесплатных LLM, несмотря на ограничения (баны, капчи, WAF, лимиты). Browser-канал первичный.

**Отличие от Gateway:** Gateway = DeepSeek-only (жёстко зашит). Navigator = универсальный (LLM + Sites + Tools). Gateway не ломаем — он единственный рабочий путь до Navigator-MVP.

## 🏛 Архитектура — 7 слоёв (см. `topics/01_ARCHITECTURE.md`)

```
7. Navigator UI (окно, sidebar, chat)               ← Этап 1
6. Pipeline (JSON-шаги, оркестратор)                 ← Этап 3
5. Memory (диалоги, файлы, долговременная память)    ← Этап 2
4. ToolRegistry + JSON-протокол                      ← Этап 1
3. Tools (Llm / Site / Utility)                      ← Этап 1 (LLM), Этап 2 (Site)
2. SessionManager (профиль ↔ tool ↔ браузер)         ← Этап 1
1. BrowserPool (N браузеров, N профилей)  ← ГОТОВ
```

**Слои 1 и частично 5 уже есть. Слои 2–4 — новые. Слой 7 — новое окно. Слой 6 — потом.**

## ✅ Решения (7)

| # | Вопрос | Решение |
|---|---|---|
| 1 | Название | **Navigator** — `src/pages/NAVIGATOR/`, `navigatorWindow.ts` |
| 2 | MVP-скоуп | **Только LLM** (GigaChat + DeepSeek через legacy). OSINT — Этап 2 |
| 3 | DeepSeek | **GigaChat first**, потом DeepSeek (`DeepSeekAdapter.sendMessage`) |
| 4 | Совместимость | **Не ломать Gateway** — `provider` остаётся, `toolId?` — additive (Этап 2) |
| 5 | OSINT на patchright | **Позже** (Этап 3), после LLM-MVP |
| 6 | JSON-протокол | **Единый** `{ tool, action, params }`, тип в `ToolRegistry` (`kind`) |
| 7 | Pipeline | **После MVP**. Контракт зафиксирован в `topics/04_JSON_PROTOCOL.md` |

## 📜 JSON-протокол

```json
{ "tool": "<toolId>", "action": "<actionName>", "params": { ... } }
```

**LLM (стрим):**
```json
{ "tool": "gigachat", "action": "send", "params": { "message": "Привет" } }
→ AsyncIterable<{ type: "text", text: "..." } | { type: "text", text: "...", reset: true } | { type: "done" }>
```

**Site (запрос → данные):**
```json
{ "tool": "rusprofile", "action": "company", "params": { "inn": "7707083893" } }
→ { ok: true, data: { ... } }
```

**Utility (без браузера):**
```json
{ "tool": "email-generator", "action": "generate", "params": { ... } }
→ { ok: true, data: { ... } }
```

**Детали** — `topics/04_JSON_PROTOCOL.md`.

## 🏷 Термины

| Имя | Роль |
|---|---|
| `ToolAdapter` | Единый интерфейс: `{ id, kind: 'llm'\|'site'\|'utility', displayName, requiresAuth, send\|run }` |
| `ToolRegistry` | `Map<toolId, ToolEntry>` — `register/get/list` |
| `SessionManager` | `resolve(profileId) → tool + page` |
| `LlmProviderAdapter` | Обёртка существующего `ProviderAdapter` (gateway) |
| `SiteAdapter` | OSINT-адаптер (rusprofile, kad.arbitr) — Этап 2 |
| `UtilityTool` | Без браузера (email-gen, cookieTracker) — Этап 2 |

## 🧰 Стек

- Electron 44, React 19 + PrimeReact 10.
- `patchright` (форк Playwright) — браузер.
- `node:sqlite` (`gateway.db`) — общая БД с Gateway.
- `safeStorage` — только в handler.

## 🔗 Интеграция (Этап 1)

- **Окно:** `src/main/windows/navigatorWindow.ts` (копия `gatewayWindow.ts`)
- **IPC:** `navigator:*` (`src/main/ipcHandlers/navigatorHandlers.ts`)
- **Сервисы:** `src/main/services/navigator/{toolRegistry,llmTool,sessionManager}.ts`
- **UI:** `src/pages/NAVIGATOR/{NavigatorPage,NavigatorSidebar,NavigatorChat}.tsx`
- **Preload:** `electronAPI.navigator.*`
- **Route:** `#/navigator` (`src/navigation/routes.tsx`)
- **Меню:** `navigatorWindowMenuTemplate` (`windowMenus.ts`)
- **Кнопка:** `ButtonsWindows.tsx` (Dashboard)

## 📋 Правила работы

- **Формат правок:** «найти → заменить» (два блока). Не diff, не rewrite.
- **git commit** по группам, **никогда `git add .`**.
- `.env.local` — ключи не в чат.
- `npm run dev`, не `npm start`.
- **patchright — не заменять.**
- **`wm-backup`** перед крупным шагом.
- **Gateway не ломать** — он единственный рабочий путь до Navigator-MVP.

## 🚫 Что НЕ входит (Этап 1)

- DeepSeek в Navigator (Этап 1.5, после `DeepSeekAdapter.sendMessage`)
- OSINT-адаптеры (Этап 2)
- Memory-обобщение (Этап 2)
- Pipeline (Этап 3)
- `HandoffTab` в Navigator (Этап 3)
- Alice/Qwen адаптеры (Этап 3)
- Duck.ai (TD10, РФ)
- `deepseek-harness` (жрёт токены, отложено)
- `tokenCounter` (отложен)

## 📅 Даты

- 2026-11-22 — Navigator v1 (архитектура, 7 решений, Этап 1 план).