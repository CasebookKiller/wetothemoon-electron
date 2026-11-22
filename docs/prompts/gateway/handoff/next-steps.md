# С чего начать новый чат

> ⚠️ **Формат правок:** все изменения предлагай в стиле «найти → заменить»
> (два блока: что найти, на что заменить). Не давай diff, не давай «весь файл
> заново», не давай «вставь после строки N» — только find/replace.

1. `cd ~/Документы/GitHub/wetothemoon-project/wetothemoon-electron && node scripts/preflight-check.mjs` — 10 сек.
2. Прочитать handoff (`.md`).
3. Если HEAD ушёл вперёд — `git log --oneline -10` покажет diff.
4. `git status --short` — что не закоммичено.
5. Приоритет: см. ниже «Приоритет на сессию», первые 2 пункта.

## Приоритет на сессию (2 часа)

> **Browser-канал приоритетнее API.** См. `COMMON_CONTEXT.md` §«Цель» (принцип 0).

### Приоритет 1 — Multi-provider UI (универсальный)

**P1 закрыт:** `GigaChatAdapter v0` полностью готов (connect, sendMessage с reset-стримом, getConversations). `HandoffTab.tsx` в `GatewayAccountsDialog` работает.

**Цель:** UI выбирает провайдера (DeepSeek / GigaChat / Alisa / Qwen), сообщения идут через `ProviderAdapter.sendMessage()`.

**Шаги:**
1. **IPC `gateway:list-providers`** → `[{ id, displayName, requiresAuth, baseUrl }]` (из `registry.listProviders()`).
2. **IPC `gateway:send-via-provider(providerId, message, profileId?)`** → `getProvider(providerId).sendMessage(page, msg)` + стрим через event bus (`gateway:stream-chunk`).
3. **`TopControlPanel.tsx`** — `<Dropdown>` провайдеров (из `gateway:list-providers`).
4. **`gatewayHandlers.ts`** — новый handler `gateway:send-via-provider` (старый `gateway:send-message` не трогать).
5. **`ChatInterface` / `InputArea`** — переключить вызов на `gateway:send-via-provider`.

### Приоритет 2 — Alisa + BrowserPool

1. **`AlisaAdapter` v0** — `alice.yandex.ru` (проверить, чат ли), Yandex ID.
2. **Recon П1b** — пустой сайдбар у новых профилей. Скрипт `scripts/recon-empty-sidebar.mjs` (см. `topics/02_BROWSER_POOL.md`).
3. **BrowserPool** — реализация IP-изоляции (П4, TD13) и уход от single-instance lock.

### Приоритет 3 — Alisa + cookieTracker

**P3 закрыт:** topics миграция завершена (Phase A/B/C). `structure: 'topics'` работает, legacy DEPRECATED.

1. **Alisa recon** — `alice.yandex.ru` (проверить, чат или голосовой ассистент). Yandex ID. → `AlisaAdapter v0`.
2. **cookieTracker + fingerprint** (P5): расширить `cookieTracker.ts` — canvas, WebGL, timezone, fonts. Цель — понять, как DeepSeek детектит (спросил возраст 2026-11-19). v11 миграция: `profile_cookies`, `cookie_events`.
3. **P7 rate-limit detect:** фикс `RATE_MARKS` + `'лимит будет восстановлен'` применён (`injectedScript.ts:386`). **Проверить после `rs`:** для `request.tel` бейдж ⏸ появится при следующем RATE_LIMIT.

### Приоритет 4 — потом

- **API-канал** — второй приоритет, постепенно (`topics/05_API_CHANNEL.md`).
- **`cookieTracker` + fingerprint** — canvas, WebGL, timezone, fonts (П5).
- **IP-изоляция** — прокси/VPN per-profile (П4, TD13).
- **Event bus** между окнами (принцип 6).
- **Объединение Путей А и Б handoff** (см. `handoff-system.md`).
- **Перенос кнопки handoff** (перенесено в Приоритет 1).
- **Agents-режим** — БД готова, реализации нет (`topics/05_API_CHANNEL.md`).

## Что НЕ делаем сейчас

- Duck.ai (TD10, РФ).
- `deepseek-harness` (жрёт токены, отложено).
- `tokenCounter` (отложен до закрытия browser-канала).
- Переключение `deepseekService.ts` на адаптер (после BrowserPool).

## Открытые вопросы

1. **П1a — A/B/C?** (N процессов / CDP attach / N BrowserContext). Влияет на RAM и single-instance lock (`topics/02_BROWSER_POOL.md`).
2. **IP-изоляция:** прокси / VPN / один IP?
3. **Перенос кнопки handoff** — ✅ решено: `HandoffAndSettingsDialog` (см. Priority 1).
4. **Объединение Путей А и Б** — оставить один или два?