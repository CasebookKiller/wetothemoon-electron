# 01 — Providers (провайдеры LLM)

> Направление: единый интерфейс для browser-провайдеров. Browser-канал — первичный.
> Связано: `03_RECON.md` (recon провайдеров), `02_BROWSER_POOL.md` (N параллельных сессий).

## Зачем столько провайдеров

Цель Gateway (принцип 0): **сохранить бесплатный доступ к LLM**, несмотря на ограничения.
Каждый бесплатный провайдер может ввести лимиты / баны / WAF. Привязываться к одному —
риск потерять канал. `ProviderAdapter` — единый интерфейс, чтобы:
- менять провайдера без переписывания логики;
- держать N провайдеров одновременно (BrowserPool);
- переключаться при бане одного.

## ProviderAdapter — интерфейс

Файл: `src/main/services/gateway/providers/types.ts` (100 строк, создан в `b832aae`).

```ts
interface ProviderAdapter {
  name: string;                                  // 'deepseek' | 'gigachat' | 'alice' | ...
  connect(context: BrowserContext): Promise<void>;
  sendMessage(
    ctx: BrowserContext,
    message: string,
    opts?: SendOpts,
  ): AsyncIterable<Chunk>;
  getConversations(ctx: BrowserContext): Promise<Conversation[]>;
  cookiePatterns: CookiePattern[];               // для cookieTracker
  selectors: ProviderSelectors;                  // input, send, response, stream
  sessionCookieName?: string;                    // для hasSession() (TD7)
}
```

**Правила:**
- **Адаптеры не импортируют Electron** (только `playwright-core` / `patchright`). `safeStorage` — только в handler.
- **Никакого глобального стейта** — всё через `ctx` (BrowserContext).
- **`AsyncIterable<Chunk>`** для streaming — единый контракт для всех.

## Registry

Файл: `src/main/services/gateway/providers/registry.ts` (52 строки, создан в `b832aae`).

```ts
registerProvider(name: string, factory: () => ProviderAdapter): void;
getProvider(name: string): ProviderAdapter | null;
initProviders(): void;   // регистрация всех (сейчас — только DeepSeek)
```

`initProviders()` вызывается при старте. Регистрирует `deepseek`. GigaChat / Alice — по мере готовности.

## DeepSeekAdapter (скелет)

Файл: `src/main/services/gateway/providers/deepseek/adapter.ts` (87 строк, создан в `b832aae`).

**Что работает:** `connect()` — запускает / подключается к Chrome через profile.
**Что TODO:**
- **TD11:** `sendMessage` — заглушка (`not implemented`). Полная реализация после стабилизации BrowserPool — взять селекторы из `SelectorProfileService.ts`.
- **TD12:** `getConversations` — пустой массив (TODO). Нужен recon сайдбара (П1b).

**Источник селекторов:** `gateway/SelectorProfileService.ts` (существующий DeepSeek-код в `deepseekService.ts`).

**После стабилизации DeepSeekAdapter** — перевести `deepseekService.ts` на использование адаптера, чтобы не дублировать логику. Сейчас `deepseekService.ts` — рабочий, адаптер — параллельная заготовка.

## GigaChatAdapter (v0, готов)

**Статус:** ✅ v0 закрыт (`d9800e3`, `ca008c8`). connect / isLoggedIn / sendMessage (reset-стрим) / getConversations работают.

**Селекторы:**
- URL: `https://giga.chat`
- input: `#chat-input-textarea`
- send: `button[aria-label="Отправить"]` (появляется после fill; fallback — Enter)
- response/streaming: `[class*="MessageItem-styled__AssistantContent"]`
- threads: `a[href^="/sessions/"]`, id из `data-da_session_id`

**Стрим (reset-механика):**
- `THINKING_PREFIXES = ['Думаю над ответом', 'Думаю…', 'Thinking']` — отбрасываются.
- Если префикс сохранился → delta (append), `MessageChunk { type: 'text', text: delta }`.
- Если текст заменён целиком (переход «Думаю» → реальный ответ) → `MessageChunk { type: 'text', text: next, reset: true }`.
- `stableTicks >= 10 × 300ms = 3s` → `done`.

**getConversations:**
```ts
links = a[href^="/sessions/"]
→ { id: data-da_session_id, title: textContent.trim(), url: `https://giga.chat${href}` }
```

**Cookies:** `_sm_sess` (critical), `_sm_user_id` (critical), `_sd_user_id` (warning), `aws-waf-token` (fingerprint).

**Анонимно:** `app-boot-error` (SPA требует сессию).

**Детали recon** — `03_RECON.md`.

## AliceAdapter (план)

**Статус:** не начат.

**Что известно:** `alice.yandex.ru` — проверить, это чат или голосовой ассистент. Возможно `ya.ru/ai`. Yandex ID.

**План:** recon → v0 (по образцу DeepSeekAdapter). После GigaChat.

## hasSession() — TD7

**Проблема:** `hasSession()` в текущем коде DeepSeek-специфичен (проверяет `ds_session_id`).

**Фикс:** добавить в `ProviderAdapter` поле `sessionCookieName?: string`. `hasSession(ctx)` — общая функция, читает `ctx.cookies()` и ищет `adapter.sessionCookieName`.

**Приоритет:** средний. Не блокер, но при добавлении GigaChat/Alice — обязательно.

## initProviders() — TD15

**Проблема:** `require('./deepseek/adapter')` внутри функции. Если `tsc` ругается на ESM — заменить на `await import('./deepseek/adapter')`.

**Приоритет:** низкий (пока tsc чист).

## Cookie-паттерны и селекторы

- **Cookie-паттерны** (`cookiePatterns`) — список регэкспов для `cookieTracker`. Для DeepSeek — `ds_session_id`. Для GigaChat — `_sm_sess`, `_sm_user_id`, `_sd_user_id`. Для Alice — TODO.
- **Селекторы** (`selectors`) — `input`, `send`, `response`, `stream`. Для DeepSeek — из `SelectorProfileService.ts`. Для GigaChat — `#chat-input-textarea`, send = Enter, response/stream — TODO.

## Что НЕ делаем сейчас

- Не переводим `deepseekService.ts` на адаптер (после стабилизации BrowserPool).
- Не делаем `AlisaAdapter` (после GigaChat).
- Не делаем production-версии send/getConversations (пока recon не закрыт).

## Открытые вопросы

1. **DeepSeekAdapter.sendMessage** — когда? После BrowserPool или раньше? (Мой голос: после BrowserPool, чтобы не дублировать `deepseekService.ts`).
2. **Единый cookieTracker** или per-adapter? (Мой голос: единый `cookieTracker.ts` + `cookiePatterns` в адаптере).
3. **Переключение провайдеров в UI** — dropdown в `TopControlPanel`? (Сейчас там dropdown модулей для handoff; провайдеры — отдельная логика).