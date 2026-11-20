# 05 — API-канал (второй приоритет)

> Направление: прямое подключение к API (DeepSeek API и др.) — **второй приоритет** после browser-канала.
> Связано: `01_PROVIDERS.md`, `handoff/architecture.md` (принцип 2).

## Роль API-канала

**Не «отложен», а «постепенный переход».** См. принцип 0 (цель): сейчас — бесплатные браузерные версии, постепенно — API там, где оправдано (стабильность важнее экономии), по одному провайдеру.

**Сейчас API-канал — fallback:**
- При бане DeepSeek (browser) — API-канал **бесполезен** (это тот же DeepSeek, тот же аккаунт, тот же бан).
- Но для **оркестратора** (принцип 4: DeepSeek API — оркестратор) — работает.
- Для **автоматизации (Agents)** — понадобится.

**Следствие:**
- `tokenCounter.ts` (API-бюджет) — **отложен** до момента, когда реально понадобится считать бюджет.
- Приоритет — browser-канал (BrowserPool, recon, cookie).

## Что есть

**IPC:** `gateway:send-message-api` (`gatewayHandlers.ts`).
```ts
payload: {
  message: string;
  model?: string;
  effort?: 'low' | 'high' | 'max';
  max_tokens?: number;
  useFallback?: boolean;
  continuationMode?: boolean;
  taskTitle?: string;
}
```

**Два режима:**
- `sendMessageViaApi(message, opts)` — прямой вызов API.
- `sendMessageWithFallback(message)` — с fallback.

**Файл:** `src/main/services/gateway/deepseekService.ts` (`sendMessageViaApi`, `sendMessageWithFallback`).

## Изоляция каналов (принцип 5)

При работе над API-каналом **web не трогаем**. И наоборот. Это разные бюджеты (деньги vs баны), разные риски.

## Что TODO

- **Agents-режим** — оркестрация через API. БД готова (`agents`, `pipeline_*`, `async_tasks`, `tool_calls`), реализации нет.
- **tokenCounter** — отложен.
- **Постепенный переход** — по одному провайдеру, когда browser даёт сбой.
- **`contextBuilder.ts`** (Путь А handoff) — использует manifest + workspaceKeys, ближе к API-чату. После объединения путей — учесть.

## Что НЕ делаем сейчас

- Не развиваем API-канал до закрытия browser-канала (BrowserPool + recon + cookie).
- Не делаем `tokenCounter`.
- Не переводим DeepSeek на API (browser первичный).

## Открытые вопросы

1. **Когда начинать Agents-режим?** (После BrowserPool? После GigaChat/Alice?)
2. **`tokenCounter`** — когда понадобится (при Agents / при API-биллинге)?
3. **Объединение Путей А и Б handoff** — влияет ли на API-канал? (Путь А ближе к API, но использует `context_nodes`, не API.)