# Архитектурные принципы (не нарушать)

1. Три режима: Web-чат / API-чат / Agents.
2. Workspace per conversation (вариант C) — в каждом чате свой набор active directions.
3. Мозг ≠ один: DeepSeek API — оркестратор, Ollama — тренируемые модели.
4. Изоляция каналов: при работе над API-каналом web не трогаем.
5. Двусторонняя связь окон (event bus) — обязательна.
6. Долговременная память: global → project → submodule → module → direction + state.
   Версионирование через `context_versions`, привязка к git commit.
7. `key.split('/').length` = уровень (L0→L4). Не менять.
8. `tasks.context_key` БЕЗ FK — при переименовании direction задачи не теряются.
9. `kind`, `status`, `priority` — TEXT, не enum — новые значения без миграции.
10. Правки в стиле «найти/заменить».
## Принцип 16 — Agent-роли (2026-11-20)
Многоролевая модель: генерировать / контролировать / исполнять / проверять здоровье / + другие. Список открыт.

## Принцип 0 — Цель (2026-11-20)
Автономное использование бесплатных LLM, несмотря на ограничения. Browser > API → постепенный переход. `deepseek-harness` — не используем.

## ProviderAdapter (browser-провайдеры)

`src/main/services/gateway/providers/`

- `types.ts` — интерфейс `ProviderAdapter` + `ProviderSelectors` + `CookiePattern` + `MessageChunk`
- `registry.ts` — `registerProvider()`, `getProvider(name)`, `initProviders()` (DeepSeek + GigaChat)
- `deepseek/adapter.ts` — скелет (sendMessage TODO — TD11)
- `gigachat/adapter.ts` — v0 (connect/isLoggedIn/sendMessage/getConversations работают)

**Ключевой контракт:**
- `connect(context): Page` — открыть страницу, дождаться input
- `isLoggedIn(page): boolean` — по URL + наличию input + отсутствию authGate
- `sendMessage(page, msg): AsyncIterable<MessageChunk>` — стрим чанков, `reset: true` при замене DOM
- `getConversations(page): Conversation[]` — список тредов

**Не импортируют Electron** — только `playwright-core`/`patchright`. `safeStorage` — в handler.
