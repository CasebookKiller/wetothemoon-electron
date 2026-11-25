# Handoff — Navigator — 2026-11-25 (DeepSeekAdapter: реализация завершена)

> Заменяет Handoff от 2026-11-25 (Приоритет 1 закрыт).
> Фиксирует: **DeepSeekAdapter написан**, интеграция в Navigator готова (PROVIDER_TO_TOOL, register).
> **Не проверено:** end-to-end тест в UI, парсинг `getConversations` для DS, `thinking` (reasoning).
> Следующий шаг: запуск и проверка DS-адаптера, допиливание селекторов сайдбара DS.

---

## Git state

- **HEAD:** `<fill>` — последний коммит сессии 25.11
- **Рабочее дерево:** не наши — SPICE, `package.json`, `manifest.json`.
- **БД:** `~/.config/wetothemoon-electron/gateway.db` (Schema **v11**).

### Быстрая проверка при старте

```bash
cd ~/Документы/GitHub/wetothemoon-project/wetothemoon-electron
node scripts/mjs/preflight-check.mjs
git log --oneline -5
git status --short
sqlite3 ~/.config/wetothemoon-electron/gateway.db "PRAGMA user_version;"  # ожидаем 11
```

---

## ✅ Сделано в этой сессии (2026-11-25, вечер)

### 1. DeepSeekAdapter (`src/main/services/gateway/providers/deepseek/adapter.ts`)
Заглушка (87 строк) заменена на **реализацию со стримом**:
- **Input:** `textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]`
- **Send:** `div.ds-button--primary.ds-button--filled, div._52c986b`
- **Response:** `.ds-markdown` (внутри `[data-virtual-list-item-key]`)
- **Reasoning:** `div.e1675d8b.ds-think-content`
- **Стрим:** 300 мс поллинг, `reset: true` (HTML перерисовывается целиком). Стабильность — 3 сек (10 тиков).
- **Формат:** `format: 'html'` (как GigaChat, UI уже умеет рендерить).

### 2. Регистрация DS в Navigator (2 строки)
- `src/main/services/navigator/sessionManager.ts`: `deepseek: 'deepseek'` в `PROVIDER_TO_TOOL`.
- `src/main/services/navigator/llmTool.ts`: `register(makeLlmTool('deepseek', 'DeepSeek'));`.

### 3. HTML в user-сообщениях — ✅ ЗАКРЫТО
Рендер в `NavigatorChat.tsx` теперь зависит ТОЛЬКО от `format` (`m.format === 'html'`), а `role` управляет только стилями (alignSelf). Это соответствует универсальной архитектуре.

### 4. `patchright` подтверждён
`BrowserPool.ts` использует `import { chromium } from 'patchright';` (строка 49) и `launchPersistentContext` (строка 160). WAF DeepSeek не заблокирует — стелс-патчи активны.

---

## 🐞 Проблемы / TODO (Не блокеры)

1. **`getConversations` для DS** — пока возвращает `[]`. Нужно спарсить сайдбар DS (селекторы `data-da_name="SessionListItem"` или аналогичные). Отложено.
2. **Reasoning (thinking)** — DS отдаёт `div.e1675d8b.ds-think-content`. В коде есть комментарий, куда это вставить (`yield { type: 'reasoning' }`). Нужно решить, рендерить ли в UI. Сейчас — игнорируется.
3. **Scroll cap / Virtual scroll** — при парсинге истории DS может быть та же проблема с виртуализацией, что и у GigaChat.
4. **End-to-end тест DS в Navigator** — не запускался.

---

## 🚀 С чего начать следующий чат

1. `npm run dev`.
2. В Navigator выбрать **DeepSeek-профиль** в Sidebar, нажать «Запустить».
3. Отправить сообщение.
4. Если стрим работает — отлично. Если нет — смотреть селекторы в DevTools и добавлять в `SELECTORS`.
5. **`getConversations`** — реализовать парсинг сайдбара DS (аналог GigaChat: `Collect во время скролла`).

---

## 📋 Правила работы
- Gateway не ломаем.
- «Найти → заменить», не diff.
- `git commit` по группам, **никогда `git add .`**.


### Техдолг — Gateway-DS на legacy singleton
- `gatewayHandlers.ts:87,157,261` — `DeepSeekService.getInstance()`, `switchProfile` закрывает `this.browser`.
- Navigator уже уведён на `BrowserPool` (launch, sync, send).
- Gateway-UI для DS всё ещё на legacy → **не открывать два DS-профиля в Gateway одновременно**.
- Полный переезд Gateway → BrowserPool — отдельная задача (после MVP).

### 2026-11-25 — launch через BrowserPool ✅
- `navigator:launch-profile` — новый IPC, идёт в `pool.acquire`, не в legacy `DeepSeekService.switchProfile`.
- Проверено: 3 DS-профиля одновременно в Navigator, все живы.
- Legacy `switchProfile` (`deepseekService.ts:1548`) больше не дёргается из Navigator.
- **Gateway-DS всё ещё на legacy** (gatewayHandlers.ts:87,157,261) — техдолг, не открывать 2 DS в Gateway.
- Не проверено: `getConversations` (правка 5), send per-profile, изоляция cookies, Gateway+NAV одновременно.

### Архитектурная заметка (2026-11-25)

OSINT-скраперы (rusprofile, kad.arbitr, mos-gorsud) и SIETCH — переезжают на patchright.
Естественный дом — `BrowserPool` (единый lifecycle, изоляция профилей, стелс).
Нужны расширения `BrowserPool`: `acquireEphemeral(domainKey)` (без userDataDir, для
агрессивно-банящих сайтов), rate-limiter per domain.
`ToolRegistry` требует новый kind `'site'` (не стрим, а результат) — отдельный дизайн
в Этапе 2.
SIETCH (`scripts/kad-test/`) на первом этапе — внешний `@tool true` скрипт, не через
BrowserPool. Переход на pool — когда SIETCH станет критичным.

# Handoff — Navigator — 2026-11-26 (DS-адаптер закрыт)

## Сделано
- `navigator:launch-profile` → `pool.acquire` (не legacy switchProfile). 3 DS-профиля одновременно.
- `deepseek/adapter.getConversations` — порт из legacy. Работает на 3 аккаунтах.
- `deepseek/adapter.sendMessage` — изолирован (проверен per-profile).
- Cookies isolation — подтверждена (`ds_session_id` разный на профиль).

## Не проверено / техдолг
- Gateway-DS всё ещё на legacy singleton (`gatewayHandlers.ts:87,157,261`). Не открывать 2 DS в Gateway.
- `thinking` (reasoning, `div.e1675d8b.ds-think-content`) — игнорируется.
- Scroll cap / virtual scroll при парсинге истории DS — не тестировался.
- `recon-*` для DS: скрипты для sidebar не создавались (селекторы из legacy работают).

## Следующее
- Этап 2: Memory + Site tools (rusprofile, kad.arbitr, mos-gorsud) — см. отдельную сессию.

# Handoff — Navigator — 2026-11-25 (DeepSeek-адаптер ЗАКРЫТ)

> Заменяет Handoff 2026-11-25 (вечер). DS-адаптер доведён до рабочего состояния,
> изоляция профилей подтверждена (3 DS-профиля одновременно, Gateway + NAV одновременно).

## Git state

- **HEAD:** `<fill>` — последний коммит сессии 26.11
- **БД:** `~/.config/wetothemoon-electron/gateway.db` (Schema **v11**)

## ✅ Закрыто в этой сессии

### 1. Launch через BrowserPool (изоляция профилей)
- `navigator:launch-profile` → `pool.acquire(profileId)`, не legacy `deepseekService.switchProfile`.
- Проверено: **3 DS-профиля одновременно** в Navigator, все живы.
- Проверено: **Gateway-DS + Navigator-DS одновременно** — оба живы, send в одном не убивает другого.
- Legacy `switchProfile` (`deepseekService.ts:1548`, `this.browser.close()`) больше не дёргается из Navigator.

### 2. `sync-conversations` — provider-aware
- Было: захардкожен `GigaChatAdapter` → для DS возвращал `[]`.
- Стало: `getProvider(profile.provider)` → `DeepSeekAdapter` для DS.
- Подтверждено логом:

```text
[navigator:sync-conversations] provider=deepseek, pageURL=chat.deepseek.com/..., convs.length=2
[GatewayCacheService] setConversationPositionAndPinned(...) → rows changed: 1
```

### 3. `deepseek/adapter.getConversations` — порт из legacy
- Селекторы из `deepseekService.getConversations()` (deepseekService.ts:2194):
`._3098d02` (группы) / `.f3d18f6a` (заголовок группы) / `a._546d736` (ссылки) / `.c08e6e93` (title).
- Добавлен `waitForSelector('a._546d736', { state: 'attached', timeout: 10_000 })` — adapter получает свежую страницу, legacy работал на прогретой.
- Возвращает `{ id, title, group, pinned: false, position }`.
- `Conversation.group?: string` — additive в `providers/types.ts`.

## Не проверено / техдолг

1. **`thinking` (reasoning)** — `div.e1675d8b.ds-think-content` игнорируется. `yield { type: 'reasoning' }` закомментирован в `adapter.ts:135`.
2. **Scroll cap / virtual scroll** при парсинге истории DS — не тестировался. У GigaChat scroll cap ~190 диалогов.
3. **`sendMessage` per-profile** — проверено на 2-м и 3-м профилях, работает, соседи живы.
4. **`syncMessages` блокирующий IPC** (15–20 сек) — техдолг из handoff #2, не менялось.
5. **Gateway-DS на legacy singleton** (`gatewayHandlers.ts:87,157,261`) — техдолг. **Не открывать 2 DS-профиля в Gateway одновременно** (второй `switchProfile` убьёт первый).
6. **`getBrowserPool(): Promise<any>`** — тип `any`, чинить отдельной задачей.

## Техдолг — legacy `deepseekService`

- `gatewayHandlers.ts:87,157,261` → `DeepSeekService.getInstance()`.
- Полный переезд Gateway-UI на `BrowserPool` — отдельная сессия (после MVP).
- После переезда: `deepseekService.ts` можно удалить (~6800 строк legacy).

## Архитектурная заметка (2026-11-26) — OSINT/SIETCH

- OSINT-скраперы (rusprofile, kad.arbitr, mos-gorsud) и SIETCH — переезжают на patchright.
- Естественный дом — `BrowserPool` (единый lifecycle, изоляция профилей, стелс).
- Нужны расширения `BrowserPool`:
- `acquireEphemeral(domainKey)` — без `userDataDir`, для агрессивно-банящих сайтов.
- rate-limiter per domain.
- `ToolRegistry` требует новый kind `'site'` (не стрим, а результат) — отдельный дизайн в Этапе 2.
- SIETCH (`scripts/kad-test/`) — на первом этапе как внешний `@tool true` скрипт, не через BrowserPool.
Переход на pool — когда SIETCH станет критичным.

## С чего начать следующую сессию

Этап 2 (Memory + Site tools) — см. handoff #2. Начинать с **одного** скрапера
(rusprofile), на нём обкатать `SiteAdapter` + `acquireEphemeral` + `kind: 'site'`.
Три скрапера сразу — преждевременно.