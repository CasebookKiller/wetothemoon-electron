# 02 — BrowserPool (параллельные сессии)

> Направление: N BrowserContext параллельно, изолированные сессии.
> Связано: `01_PROVIDERS.md` (адаптеры), `03_RECON.md` (профили), `04_UI.md` (switch).

## Зачем

Сейчас: один Chrome на профиль → при switch профиля Chrome **закрывается** (П1a), диалоги теряются (П1b). Цель Gateway (принцип 0): держать N бесплатных сессий одновременно → больше задач в час до бана, устойчивость к бану одного провайдера.

## BrowserPool — что есть

Файл: `src/main/services/gateway/pool/BrowserPool.ts` (181 строка, создан в `b832aae`).

**Статус: скелет, нигде не подключён.** `grep "pool.acquire"` находит только комментарии в `deepseek/adapter.ts`. `deepseekService.ts` и `gatewayHandlers.ts` его не используют.

**Спроектирован под вариант C** — конструктор принимает `Browser` (результат `chromium.launch()`), создаёт N `BrowserContext` через `browser.newContext()`. Для **persistent-профилей** (DeepSeek, GigaChat) это не работает: `launchPersistentContext` возвращает `BrowserContext`, а не `Browser`. **Будет переписан под вариант A** (никто не подключён — правим безболезненно).

**Решение (принято):**
- **DeepSeek:** N профилей = N браузеров (вариант A, N `launchPersistentContext`). Вкладки — нет: агрессивный антибот (1 fingerprint + 5 вкладок = сигнал бота), rate-limit общий.
- **GigaChat:** 1 профиль + N вкладок (один Chrome, N `Page`). Мягче к антиботу, один аккаунт делит лимит. Throttle: активно 1–2 вкладки, остальные в очереди.

**API для варианта A (новый пул):**
```ts
acquire(profileId): Promise<BrowserContext>  // launchPersistentContext, или вернуть существующий (guard)
release(profileId): Promise<void>            // закрыть ТОЛЬКО этот профиль
releaseAll(): Promise<void>
list(): string[]
```

**Guard в `acquire`:** если `profileId` уже в реестре — вернуть существующий контекст, не запускать второй. Снимает П7 и single-instance lock.

**Что TODO:**
- Переписать `BrowserPool.ts` под вариант A (~60 строк).
- Подключить: `deepseekService.ts` → `pool.acquire(activeProfileId)` вместо своего `launchPersistentContext`.
- **TD13:** IP-изоляция. `AcquireOpts.proxy` — вариант A позволяет (launch per-profile).

## Профили

- **id:** `p_<hash>` (напр. `p_mwnqhvvi_rm0d`)
- **dir:** `~/.config/wetothemoon-electron/profiles/<id>/chrome-profile`
- **`browserKind`:** `chrome` (patchright) | `yandex` (внешний)
- **`cdpPort`** (внутренний) + **`chromeCdpPort`** (внешний CDP)
- **`ProfileService.browserProfileDir(p)`** (`ProfileService.ts:129`)
- **`ProfileService.create({name, browserKind?})`** (`ProfileService.ts:225`)
- **single-instance lock:** один Chrome на профиль. Второй attach невозможен.

## П1a — Chrome закрывается при switch профиля

**Симптом:** при переключении профиля в UI текущий Chrome закрывается, новый открывается. Диалоги старого — недоступны (другой профиль).

**Причина:** `deepseekService.ts` держит **один** `this.page` и **один** контекст — при switch закрывает старый.

**Решение (вариант A):** BrowserPool — `Map<profileId, BrowserContext>`. `acquire('p_A')` и `acquire('p_B')` — два процесса Chrome. `release('p_A')` закрывает **только A**, `p_B` жив. `deepseekService.ts` переводится на `pool.acquire(activeProfileId)`.

**Для Yandex:** решается внешним браузером (не Electron-процессом).

## GigaChat — 1 профиль + N вкладок

**Решение (принято):** для GigaChat один `BrowserContext` (один профиль, один Chrome) и **N `Page`** (вкладок). Каждая вкладка — свой URL `https://giga.chat/sessions/<uuid>`, свой стрим. Сессия (`_sm_sess`) общая.

**Почему не N браузеров (как у DeepSeek):**
- GigaChat мягче к антиботу: реальный пользователь с 3 вкладками — норма.
- 1 аккаунт = 1 rate-limit, вкладки честно делят.
- Экономия RAM: ~500MB + вкладки вместо 500MB × N.

**Throttle (обязательно):** одновременно активно 1–2 вкладки, остальные — в очереди. Иначе rate-limit аккаунта.

**`GigaChatAdapter` готов:** `sendMessage(page, msg)` принимает `page` — можно вызывать с разными вкладками без правок адаптера.

**API пула (после MVP):**
```ts
acquirePage(profileId, slotId): Promise<Page>  // вкладка для направления/роли
releasePage(profileId, slotId): Promise<void>  // закрыть вкладку, контекст жив
```

## П1b — пустой список диалогов у новых профилей

**Симптом:** у нового (не залогиненного или чистого) профиля сайдбар с диалогами пустой. Возможно, там placeholder-текст («Нет диалогов» / «История пуста» / «Начните новый чат»).

**Recon-скрипт нужен:** `scripts/recon-empty-sidebar.mjs` (по образцу `recon-duck-smoke.mjs`):
1. Запустить Chrome с чистым профилем.
2. Открыть `chat.deepseek.com`.
3. Дождаться загрузки.
4. Снять DOM сайдбара (`outerHTML`), `innerText`, скриншот.
5. Сохранить JSON: `{ url, screenshotPath, sidebarHtml, sidebarText, selectors: { sidebar, list, placeholder } }`.

**Гипотезы:** A) placeholder-текст, B) пустой `<div>`, C) suggestions.

**Куда положить:** `scripts/recon-empty-sidebar.mjs`.

## П4 — IP-изоляция (новая, при параллельных браузерах)

**Симптом:** 5 браузеров с 1 IP → DeepSeek видит 5 заходов с одного адреса → бан ускоряется.

**Решение (обсуждается):**
- Прокси per-profile (SOCKS5).
- VPN per-profile.
- Один IP (готовы к быстрому бану).

**TD13:** `AcquireOpts.proxy` объявлен, не используется. `playwright-core` proxy — на уровне `launch`.

## TD8 — UI запускает оба браузера на одном профиле

**Проблема:** UI запускает Chrome + Yandex на одном профиле → конфликт.

**Фикс:** ProfileRouter — маршрутизация `browserKind` → один процесс на профиль.

## П7 — Chrome занят старым диалогом

**Проблема:** `p_mwnqhvvi_rm0d` привязан к нашему Chrome (CDP-pipe). `recon-dump-dom.mjs` не может attach (single-instance lock).

**Решение:** отдельный профиль `gigachat-2` (создать через `ProfileService.create({name: 'GigaChat 2', browserKind: 'chrome'})`) или после закрытия текущего.

## Что НЕ делаем сейчас

- Не реализуем полный BrowserPool production (сначала recon GigaChat).
- Не решаем П1a окончательно (нужно решение A/B/C от пользователя).
- Не делаем IP-изоляцию (TD13) до стабилизации BrowserPool.

## Открытые вопросы

1. **П1a — A/B/C?** (N процессов / CDP attach / N BrowserContext). Влияет на RAM и single-instance lock.
2. **IP-изоляция:** прокси / VPN / один IP?
3. **Приоритет паралледности:** A) N аккаунтов одного провайдера / B) N разных провайдеров / C) N задач в одном аккаунте — что первое?
4. **Recon П1b** — делать сейчас или после GigaChat recon?

## TD: auto-switch — только для pipeline (2026-11-21)

`gatewayHandlers.ts`: `AUTO_SWITCH_ENABLED: boolean = false` — failover-блок
(переключение при `RATE_LIMIT`) сохранён, но отключён. В интерактивном чате —
manual switch: юзер видит бейдж `⏸ до HH:MM` в диалоге аккаунтов и решает сам.

**TODO(pipeline):** при появлении pipeline/agents переключить на контекстную
проверку `taskContext?.allowAutoSwitch`, а не глобальный флаг. Тогда:
- интерактивный чат → manual (как сейчас)
- pipeline-задача → auto (конвейер не останавливается)

**Real-time UI:** `GatewayAccountsDialog` подписан на `onGatewayBridgeEvent`
(`profile:rate-limited`/`profile:banned`/`profile:switched`) + тикер 30 сек.
Бейдж исчезает по истечении `rateLimitedUntil` без переоткрытия диалога.

## TD: типизация `electronAPI` (pre-existing)
`getApi(): any` в `GatewayAccountsDialog` — `onGatewayBridgeEvent`, `gatewayLaunch`
и др. не проверяются TS. Добавить в `src/types/gateway.d.ts`:
`gatewayLaunch: () => Promise<{ success: boolean; error?: string; data?: { status?: 'logged_in' | 'login_required' } }>`,
`onGatewayBridgeEvent: (cb: (e: { type: string; payload: any; ts: number }) => void) => () => void`.
Приоритет: низкий (не блокер).