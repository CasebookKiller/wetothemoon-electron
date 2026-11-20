# 02 — BrowserPool (параллельные сессии)

> Направление: N BrowserContext параллельно, изолированные сессии.
> Связано: `01_PROVIDERS.md` (адаптеры), `03_RECON.md` (профили), `04_UI.md` (switch).

## Зачем

Сейчас: один Chrome на профиль → при switch профиля Chrome **закрывается** (П1a), диалоги теряются (П1b). Цель Gateway (принцип 0): держать N бесплатных сессий одновременно → больше задач в час до бана, устойчивость к бану одного провайдера.

## BrowserPool — что есть

Файл: `src/main/services/gateway/pool/BrowserPool.ts` (181 строка, создан в `b832aae`).

**API (по скелету):**
```ts
acquire(profileId, opts?): Promise<BrowserContext>
release(profileId): Promise<void>
parallel<T>(tasks: Array<() => Promise<T>>): Promise<T[]>
```

**Что работает:** N BrowserContext, `acquire/release`, `parallel()`.
**Что TODO:**
- **TD13:** IP-изоляция. `AcquireOpts.proxy` объявлен, но не используется. `playwright-core` proxy — на уровне `launch`, не `newContext`. Нужен либо отдельный `launch` per-profile с proxy, либо один `launch` + `newContext({proxy})` (проверить, поддерживает ли patchright).
- **П1a:** при switch профиля старый Chrome не должен закрываться. Сейчас `ProfileService`/`deepseekService` держат один persistent context → switch = закрытие. Нужен один из подходов:
  - **(A)** N `launchPersistentContext` (N процессов Chrome) — просто, но RAM (3-5 × ~500MB = 1.5-2.5GB).
  - **(B)** один Chrome с `--remote-debugging-port`, attach к нужному профилю через CDP — сложнее, но экономнее.
  - **(C)** один Chrome, N BrowserContext (если patchright/persistent позволяет) — проверить.
  - **Решение — за пользователем. Влияет на RAM и single-instance lock.**

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

**Причина:** один persistent context на профиль + закрытие при switch.

**Решение:** BrowserPool — N параллельных контекстов. При switch — старый **не закрывается**, новый открывается рядом. Детали (A/B/C) — выше.

**Для Yandex:** решается внешним браузером (не Electron-процессом).

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