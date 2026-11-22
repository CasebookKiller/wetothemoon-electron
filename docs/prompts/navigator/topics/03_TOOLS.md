# 03 — Tools (Llm / Site / Utility)

> Связано: `01_ARCHITECTURE.md` (слой 3), `04_JSON_PROTOCOL.md`.
> Gateway-провайдеры (`ProviderAdapter`) — частный случай `LlmProviderAdapter`.

## 3 типа tools

| Kind | Что | Требует браузера | Этап |
|---|---|---|---|
| `llm` | LLM-провайдер (DeepSeek, GigaChat, Alice, Qwen) | ✅ (browser) | 1 |
| `site` | Сайт-источник (rusprofile, kad.arbitr, mos-gorsud) | ✅ (browser) | 2 |
| `utility` | Утилита (email-gen, cookieTracker) | ❌ | 2 |

## Единый интерфейс `ToolEntry`

```ts
interface ToolEntry {
  id: string;                                    // 'gigachat' | 'rusprofile' | 'email-generator'
  kind: 'llm' | 'site' | 'utility';
  displayName: string;                           // 'GigaChat'
  requiresAuth: boolean;
  // llm:
  send?: (page: Page, params: { message: string }, opts?: SendOpts) => AsyncIterable<MessageChunk>;
  // site:
  run?: (page: Page, action: string, params: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  // utility:
  invoke?: (action: string, params: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
}
```

**Различие `send`/`run`/`invoke`:** `send` — стрим (LLM), `run` — браузер (Site), `invoke` — без браузера (Utility). В `ToolEntry` заполнено **одно** из трёх, в зависимости от `kind`.

## LlmProviderAdapter (Этап 1)

**Обёртка над существующим `ProviderAdapter`** из `gateway/providers/`.

```ts
// src/main/services/navigator/llmTool.ts
import { getProvider } from '../gateway/providers/registry';
import type { ToolEntry } from './toolRegistry';

export function makeLlmTool(id: string, displayName: string, requiresAuth = true): ToolEntry {
  return {
    id,
    kind: 'llm',
    displayName,
    requiresAuth,
    send: (page, { message }, opts) => {
      const adapter = getProvider(id);
      if (!adapter) throw new Error(`LLM-провайдер '${id}' не зарегистрирован`);
      return adapter.sendMessage(page, message, opts);
    },
  };
}
```

**Регистрация:** `register(makeLlmTool('gigachat', 'GigaChat'))`. DeepSeek — Этап 1.5 (когда `DeepSeekAdapter.sendMessage` готов).

## SiteAdapter (Этап 2)

**Перенос OSINT-скраперов** из `src/main/services/osint/scrapers/` (rusprofile, kad.arbitr, mos-gorsud).

```ts
interface SiteTool extends ToolEntry {
  kind: 'site';
  run: (page: Page, action: string, params: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
}
```

**Действия** (`action`): `company` (rusprofile), `cases_by_inn` (kad.arbitr), `case_card`, и т.д.

## UtilityTool (Этап 2)

Без браузера. `email-generator`, `cookieTracker` (снимок).

```ts
interface UtilityTool extends ToolEntry {
  kind: 'utility';
  invoke: (action: string, params: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
}
```

## ToolRegistry — API

```ts
// src/main/services/navigator/toolRegistry.ts
const registry = new Map<string, ToolEntry>();

export function register(tool: ToolEntry): void;
export function get(id: string): ToolEntry | null;
export function list(): ToolEntry[];
export function initTools(): void;  // регистрация всех (GigaChat + ...)

export type ToolEntry = { ... }; // см. выше
```

**initTools()** — регистрирует `makeLlmTool('gigachat', ...)`. Остальные — по мере готовности.

## Этап 1 — только GigaChat

- ✅ `gigachat` — LLM (обёртка над `GigaChatAdapter` v0).
- ❌ DeepSeek — Этап 1.5.
- ❌ rusprofile / kad.arbitr — Этап 2.
- ❌ email-generator — Этап 2.

## Открытые вопросы

1. **`toolId` в профиле** — добавлять `toolId?: string` рядом с `provider` (Этап 2) или пока только `provider`? **Решение: только `provider`** (Этап 1).
2. **SiteAdapter на patchright** — Этап 3 (после LLM-MVP).
3. **UtilityTool** — Этап 2.