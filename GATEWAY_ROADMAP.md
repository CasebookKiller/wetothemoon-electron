# GATEWAY ROADMAP

_Обновлено: 2026-11-13 (Yandex CDP autolaunch + Input Area Recon closed)_

## ✅ Выполнено

### Ядро и управление Playwright
- [x] Окно «Шлюз», управление браузером через Playwright
- [x] Авторизация и восстановление сессии DeepSeek (storageState)
- [x] Обработка закрытия PW руками (`disconnected` listener)
- [x] Отправка сообщений (thinking + blocks + fullHtml)
- [x] Загрузка списка диалогов и истории
- [x] Тумблеры «Глубокое мышление» / «Умный поиск»
- [x] Стриминг (`assistant:content-update`, `reasoning:update`)
- [x] Отлов ошибок (`message:error` → `TopControlPanel`)
- [x] Прогресс истории (`history:progress`, `history:complete`)
- [x] Удаление / переименование / закрепление диалогов
- [x] Multi-select (bulk-pin, bulk-delete)
- [x] `sendMessage()` — отправка + ожидание + stabilize + extract

### Yandex CDP (закрыто 2026-11-13)
- [x] `connectToYandex()` через `playwright-core.connectOverCDP` (НЕ `playwright-extra`)
- [x] `isYandexCdpAlive()` — HTTP-probe `/json/version`
- [x] `launchYandexWithCdp()` — автозапуск при `ECONNREFUSED`
- [x] Переиспользование уже запущенного Yandex (`CDP-порт 9222 уже слушается`)
- [x] Cross-platform поиск бинарника (Linux/macOS/Windows)
- [x] Persistent profile: `<userData>/yandex-cdp-profile` (НЕ /tmp)
- [x] Autosave `deepseek_storage.json` после авторизации
- [x] Проверено: сессия переживает перезапуск GW

### Markdown Renderer (5.8.3 — закрыто)
- [x] `markdownRenderer.ts` (marked + prismjs + katex)
- [x] Классы DeepSeek: `ds-markdown-paragraph`, `md-code-block`, `token`, `katex`
- [x] KaTeX: размеры `1.4em`, степени `0.8em`
- [x] Fallback в `GatewayMessageAssistant` при битом `fullHtml`

### Snapshot API (5.8.3 — закрыто)
- [x] `snapshotHistory()` через IndexedDB `deepseek-chat` (~0.2с вместо 975с)
- [x] `parseIndexedDbSnapshot()` — дерево через `parent_id` + `current_message_id`
- [x] `markdownToHtml()` — минимальный fallback для IndexedDB
- [x] Fallback на traverse при ошибке

### Branching (5.7 — закрыто)
- [x] `switchBranch(messageKey, direction, opts)` с sibling-fallback
- [x] UI switcher `< 2/2 >`
- [x] `branchTotal`/`branchIndex` (user через `.dd7e4fda`, assistant наследует)
- [x] `isActive` через `activePath` из `current_message_id`

### Skip Scroll (5.6 — закрыто)
- [x] `getConversationMessages({skipBackgroundScroll})`
- [x] `scrollHistory()`
- [x] `history:complete` → sync
- [x] fingerprint last-message сравнение

### Ghost Records (2.2.6 — закрыто)
- [x] `cleanupGhosts()` в `GatewayCacheService`
- [x] Кнопка «Очистить призраков» в `GatewayCacheManager`

### Input Area Recon (5.5.1 — закрыто 2026-11-13)
- [x] `scripts/recon-input-area.mjs` через CDP (без DevTools, без `allow pasting`)
- [x] **Найдено:** `<input type="file" multiple>` скрытый, `style="display:none"`
- [x] **Найдено:** React `onChange`-хендлер на input → DeepSeek сам обработает
- [x] **Найдено:** `textareaReactHandlers: onPaste, onChange, onKeyDown` → Paste-to-File есть
- [x] **Найдено:** drop-зоны нет (D&D не поддерживается через React)
- [x] **Найдено:** кнопка-скрепка `div.f02f0e25` с SVG `M5.5498 9.75V5...`
- [x] **Найдено:** parentChain инпута: `INPUT → .bf38813a → .ec4f5d61 → ._020ab5b`
- [ ] **Recon 2 (attach-test):** `setInputFiles` на живом инпуте + проверка появления чипа

---



## ✅ Выполнено 2026-11-17: Patchright + API-канал + контекст

### Patchright (Chrome stealth)
- [x] `browserKind: "yandex" | "chrome"` в `ProfileService`
- [x] `launchChromeViaPatchright` — системный Chrome через patchright (`channel: "chrome"`)
- [x] `connectToChromeViaPatchright` — точка входа в `connectToYandex`
- [x] Смоук: `webdriver=false`, `cdcKeys=[]`, Chrome 157, реалистичные плагины
- [x] `inject-cookies-patchright.mjs` — импорт cookies в chrome-профиль

### API-канал (DeepSeek)
- [x] `deepseekApiService.ts` — стриминг, reasoning, usage
- [x] Модели: `deepseek-flash` (1M контекст, image input), `deepseek-v4-pro`
- [x] Aliases `deepseek-chat` / `deepseek-reasoner` работают
- [x] `sendMessageViaApi` — эмитит те же bridge-события, что web-канал
- [x] IPC `gateway:send-message-api`

### Учёт бюджета
- [x] `apiUsageDb.ts` — JSONL + pricing + budget
- [x] `usage` из каждого ответа пишется в файл
- [x] IPC `gateway:api-usage-summary` (summary + budget)
- [x] Оценка: \$0.00168 за типичный запрос на Flash

### Контекст и память (фундамент)
- [x] `context.manifest.json` — иерархия: global → project → submodule → module → direction
- [x] `contextBuilder.ts` — `buildContext` (full, 60K) + `buildContinuationSystemPrompt` (compact, 20K)
- [x] `sendMessageViaApi(continuationMode: true)` — компактный контекст
- [x] IPC `gateway:export-continuation` — файл в `userData/continuation/`
- [x] E2E-доказательство: модель отвечает в контексте (7/9 ключевых слов)
- [x] `docs/GATEWAY_SUMMARY.md`, `docs/SUBMODULE_SUMMARY.md`
- [x] Чистка `01_COMMON_CONTEXT.md` (убрана старая версия, бэкап `.bak-*`)

### Инфраструктура
- [x] `.gitignore`: `*.bak-*`, `deepseek_cookies.json`, `.env.local.bak-*`, recon-папки
- [x] Recon-скрипты: `test-deepseek-*.mjs`, `test-context-*.mjs`, `export-continuation-prompt.mjs`, `gen-context-manifest.mjs`

---

## 🛡️ Сквозная фаза: Anti-Bot Defense (обязательно)

**Правило:** Yandex CDP — приоритет, всё остальное — fallback.

- [x] **Yandex CDP (основной):** реальный браузер, капча проходит 100%
- [x] **Persistent profile:** cookies/сессия в `<userData>/yandex-cdp-profile`
- [x] **Автозапуск Yandex:** `isYandexCdpAlive()` + `launchYandexWithCdp()`
- [x] **Переиспользование живого Yandex:** не убиваем, подключаемся
- [ ] **Cookie-injection при пустом профиле:** если нет cookies — влить `deepseek_cookies.json` / `deepseek_storage.json` до навигации
- [ ] **Детект капчи в injectedScript:** `#ds_aws_captcha` / `#cf-overlay` → bridge `captcha:appeared` → UI-баннер
- [ ] **Safe-flags для Yandex:** `--no-sandbox --disable-gpu --disable-gpu-compositing --disable-features=VaapiVideoDecoder` в `launchYandexWithCdp()` (если segfault вернётся)
- [ ] **Stealth fallback (Patchright):** если Yandex недоступен — `patchright` вместо `playwright-extra`
- [ ] **Поведенческий слой:** human-like задержки (1–8с), mouse-jitter, scroll перед вводом
- [ ] **Прокси-ротация (reserved):** SOCKS/HTTP sticky-session
- [ ] **Капча-сервисы (reserved):** CapSolver / 2Captcha

---

## 📋 В работе / Ближайшие задачи

### 🎯 5.5 — Input Area + File Picker (СЛЕДУЮЩЕЕ)

**Цель:** умное поле ввода — выбор файлов из архива, чипы 1:1 с PW.

- [x] Recon Input Area (см. выше)
- [ ] **Recon 2 (attach-test):** `setInputFiles` на живом инпуте → появление чипа
- [ ] **`sendMessageWithFiles()`** в `deepseekService.ts` — `setInputFiles` + waitFor chips + send
- [ ] **Refactor `sendMessage`:** вынести общий `waitForAssistantResponse()` helper
- [ ] **File Picker из БД:** кнопка «Скрепка» → модалка выбора из `file_blobs` (dedup по sha256)
- [ ] **Чипы в GW:** 1:1 с PW (использовать `chipFullHTML` из recon)
- [ ] **Paste-to-File:** текст > N KB → виртуальный файл
- [ ] **Batch-загрузка:** прогресс, отмена, обработка ошибок
- [ ] **`@file` автодополнение:** по списку файлов проекта

### 🎯 5.5b — SVG-скрепка
- [ ] Перенести SVG `M5.5498 9.75V5...` в `GatewayIcons.tsx`

### 🎯 5.8 — Полировка
- [ ] Подсветка кода в старых сообщениях
- [ ] AppIcon вместо своих SVG
- [ ] Auto-hide скроллбар в FilePanel
- [ ] Меню профиля внизу сайдбара
- [ ] `cleanupOrphans` для `message_files`
- [ ] `handleEditMessage` — синхронизация edit с PW

### 🎯 Приоритет 2 — Синхронизация GW ↔ PW
- [ ] `conversation:active-changed` bridge-событие
- [ ] `activeConvId` в main — sync при переключении
- [ ] «PW закрыт руками» → fallback из БД

### 🧩 Плагин селекторов
- [ ] `dumpCurrentPage` при сбое селектора
- [ ] `deepseek.v1.json` — цепочки с фолбэками
- [ ] Окно «Редактор селекторов»

---

## 🚀 Схема БД (v3 — актуальная)

```sql
-- v1: conversations, messages, messages_fts (FTS5)
-- v2: + messages.message_hash, messages.pw_key, conversations.last_synced_at, pending_edits
-- v3: + file_blobs, message_files, триггеры ref_count


=================

# GATEWAY ROADMAP

_Обновлено: 2026-11-04 (после v3 + files feature)_

## ✅ Выполнено

### Ядро и управление Playwright
- [x] Запуск окна «Шлюз» и управление браузером через Playwright
- [x] Авторизация и восстановление сессии DeepSeek (storageState)
- [x] Обработка закрытия PW руками (`disconnected` listener)
- [x] Отправка сообщений (thinking + blocks + fullHtml)
- [x] Загрузка списка диалогов и истории
- [x] Переключатели «Глубокое мышление» и «Умный поиск»
- [x] Стриминг (`assistant:content-update`, `reasoning:update`)
- [x] Отлов ошибок (`message:error` → `TopControlPanel`)
- [x] Прогресс истории (`history:progress`, `history:complete`)
- [x] Удаление диалогов (waitForResponse на `/chat_session/delete`, `code===0`)
- [x] Переименование / Закрепление
- [x] Multi-select (bulk-pin, bulk-delete)

### Архитектура и UI
- [x] Стили DeepSeek в Shadow DOM
- [x] `GatewayIcons` — все SVG
- [x] `TopControlPanel`, `GatewaySidebar` (группировка, меню, свернутый вид)
- [x] `GatewayMessageNavigation` (мини-карта)
- [x] `GatewaySearchModal` (FTS5)
- [x] `GatewayConfirmModal`, `GatewayInputModal`, `GatewayCacheManager`
- [x] Share modal, выбор сообщений, копирование/regenerate/like/dislike/share
- [x] Автоскролл с сохранением позиции (`overflow-anchor` + `useLayoutEffect`)

### Кэш и БД (v1 → v3)
- [x] SQLite `gateway.db` (node:sqlite, WAL, миграции через `PRAGMA user_version`)
- [x] **Миграция v2**: `message_hash`, `pw_key`, `last_synced_at`, `pending_edits`
  - [x] `computeMessageHash(convId, role, contentPlain, parentHash)` — sha256, 16 hex
  - [x] `parentHash`-цепочка (stable при partial/full sync)
  - [x] `salt = pw_key ?? parentHash`
  - [x] `sequence = idx` (не parseInt(pw_key))
  - [x] Lookup 3 уровня: hash → pw_key(numeric) → (role, content_plain)
  - [x] `prune: true` только на `history:complete`
  - [x] `ensureAllMessagesHashed` в `db.ts` (backfill при старте)
- [x] **Миграция v3**: `file_blobs`, `message_files`, триггеры `ref_count`
  - [x] Дедуп по sha256 + `ref_count` через `message_files_ai` / `_ad`
  - [x] `userData/gateway_files/<sha[:2]>/<sha>.<ext>`
  - [x] Text < 512 KB → `content_text`, иначе → `content_path`
- [x] `GatewayCacheService`: syncConversation, getMessages, listConversations, deleteConversation, getMessageByHash, markConversationSynced, searchMessages (FTS5+LIKE), getStats, clearAll, exportMarkdown
- [x] Автосохранение при `getConversationMessages` и bridge-событиях
- [x] Fallback на БД при недоступном PW

### Файлы (5.4c — закрыто)
- [x] `fetchFileContent` — клик по чипу, PoW 20-30с (до 60с), `file_id` из URL
- [x] `GatewayFileService`: saveFile (dedup), getContent, getStatusesBulk, getStatsBulk (**через JOIN messages** — защита от orphaned), listPendingFiles, markFailed, gc
- [x] `FileBatchService`: MAX_BATCH_SIZE=30, последовательно, пауза 300мс, отмена после текущего PoW, `onPwDisconnected`
- [x] Порядок batch — `sequence ASC`
- [x] IPC: `file-fetch`, `file-save`, `file-content`, `file-statuses`, `file-stats-bulk`, `file-mark-failed`, `file-gc`, `file-fetch-batch`, `file-fetch-cancel`, `file-batch-state`
- [x] `GatewayMessageUser` — file-чипы, accent border, fingerprint merge для non-numeric id
- [x] `GatewayFilePanel` — drawer справа, resize-handle, localStorage ширины, inline overflow (CSS из GatewayPage.css не долетает в ShadowRoot)
- [x] `GatewayProgressToast` — draggable, auto-dismiss 3с, отмена
- [x] `GatewayDialogLoadToast` — draggable, до крестика, live-счётчики, «Загрузить оставшиеся», clamp loaded≤total
- [x] Autofetch при открытии (опционально, `localStorage['gateway.autoFetchFileCount']` 0/3/5/10, дефолт 0)
- [x] `GatewayCacheManager`: бейдж «файлы: N/M», кнопки «⬇ Загрузить» / «✓ все файлы», radio автозагрузки

### Yandex CDP (2.2.8 — закрыто 2026-11-13)
- [x] `connectToYandex()` — через `playwright-core.connectOverCDP` (НЕ `playwright-extra`)
- [x] `isYandexCdpAlive()` — HTTP-probe `/json/version`
- [x] `launchYandexWithCdp()` — автозапуск при ECONNREFUSED
- [x] Переиспользование уже запущенного Yandex (`CDP-порт 9222 уже слушается`)
- [x] Cross-platform поиск бинарника (Linux/macOS/Windows)
- [x] Persistent profile: `<userData>/yandex-cdp-profile` (не /tmp)
- [x] Autosave `deepseek_storage.json` после успешной авторизации
- [x] ⚠️ Fallback на bundled Chromium СЛОМАН: `Playwright is missing. :-)` (см. техдолг #10)

### Markdown renderer (5.8.3 — закрыто)
- [x] `markdownRenderer.ts` (marked + prismjs + katex)
- [x] Классы DeepSeek: `ds-markdown-paragraph`, `md-code-block`, `token`, `katex`
- [x] KaTeX: размеры `1.4em`, степени `0.8em`
- [x] Fallback в `GatewayMessageAssistant`, если `fullHtml` битый

### Snapshot API (5.8.3 — закрыто)
- [x] `snapshotHistory()` через IndexedDB `deepseek-chat` (~0.2с вместо 975с)
- [x] `parseIndexedDbSnapshot()` — дерево через `parent_id` + `current_message_id`
- [x] `markdownToHtml()` — минимальный fallback для IndexedDB-снимков
- [x] Fallback на traverse при ошибке

### Branching (5.7 — закрыто)
- [x] `switchBranch(messageKey, direction, opts)` с sibling-fallback
- [x] UI switcher `< 2/2 >`
- [x] `branchTotal`/`branchIndex` в parse (для user через `.dd7e4fda`, для assistant — наследование от предыдущего user)
- [x] `isActive` через `activePath` из `current_message_id`

### Ghost Records (2.2.6 — закрыто)
- [x] `cleanupGhosts()` в `GatewayCacheService`
- [x] Кнопка «Очистить призраков» в `GatewayCacheManager`

---

## 🛡️ Сквозная фаза: Anti-Bot Defense (обязательно)

Цель: минимизировать риск блокировки DeepSeek из-за AWS WAF/hCaptcha.
Многослойная стратегия, от «идеального» к «последнему рубежу».

**Правило:** Yandex CDP — приоритет, всё остальное — fallback.

- [x] **Yandex CDP (основной):** подключение к реальному браузеру. Капча проходит 100%.
- [x] **Persistent profile:** cookies/сессия в `<userData>/yandex-cdp-profile` (переживает перезагрузку).
- [x] **Автозапуск Yandex:** `isYandexCdpAlive()` + `launchYandexWithCdp()` при `ECONNREFUSED`.
- [x] **Переиспользование живого Yandex:** не убиваем, подключаемся к существующему.
- [ ] **Cookie-injection при пустом профиле:** если нет cookies — влить `deepseek_cookies.json` / `deepseek_storage.json` до первой навигации (чтобы не логиниться вручную).
- [ ] **Детект капчи в injectedScript:** ловить `#ds_aws_captcha` / `#cf-overlay` → bridge `captcha:appeared` → UI-баннер «Требуется ручное прохождение».
- [ ] **Safe-flags для Yandex:** `--no-sandbox --disable-gpu --disable-gpu-compositing --disable-features=VaapiVideoDecoder` в `launchYandexWithCdp()`.
- [ ] **Stealth fallback (Patchright):** если Yandex недоступен — `patchright` вместо `playwright-extra` (патчит бинарник, а не только JS). Капчу скорее всего не пройдёт, но лучше, чем ничего.
- [ ] **Поведенческий слой:** human-like задержки (1–8с), mouse-jitter перед send, scroll перед вводом. Снижает bot-score, капчу не решает.
- [ ] **Прокси-ротация (reserved):** SOCKS/HTTP sticky-session. Только при бане IP.
- [ ] **Капча-сервисы (reserved):** CapSolver / 2Captcha. Платно, 100%.

---

## 📋 В работе / Ближайшие задачи

### 🎯 5.5 — Input Area + File Picker (СЛЕДУЮЩЕЕ)

**Цель:** умное поле ввода — выбор файлов из архива, paste-to-file, чипы 1:1 с PW.

- [ ] **Recon Input Area** (`scripts/recon-input-area.mjs` через CDP): найти `input[type=file]`, paste-handler на textarea, drop-зону.
- [ ] **File Picker из БД:** кнопка «Скрепка» → модалка выбора из `file_blobs` (dedup по sha256).
- [ ] **Отправка в PW:** `setInputFiles()` / `ClipboardEvent` paste / `DataTransfer` drop — по результатам Recon.
- [ ] **Чипы в GW:** 1:1 с PW (использовать `existingChips[].chipFullHTML` из Recon).
- [ ] **Paste-to-File:** текст > N KB → виртуальный файл (как PW).
- [ ] **Batch-загрузка:** прогресс, отмена, обработка ошибок.
- [ ] **`@file` автодополнение** — по списку файлов проекта.

### 🎯 5.6 — Skip scroll (закрыто в этой сессии)
- [x] `getConversationMessages({skipBackgroundScroll})`
- [x] `scrollHistory()`
- [x] `history:complete` → sync
- [x] fingerprint last-message сравнение

## 🚀 Схема БД (v3 — актуальная)

```sql
-- v1: conversations, messages, messages_fts (FTS5)
-- v2: + messages.message_hash, messages.pw_key, conversations.last_synced_at, pending_edits
--     + UNIQUE INDEX idx_messages_hash
-- v3: + file_blobs, message_files, триггеры ref_count

CREATE TABLE file_blobs (
  sha256 TEXT PRIMARY KEY,
  content_text TEXT,           -- text < 512KB
  content_path TEXT,           -- text ≥ 512KB, image, binary
  content_size_bytes INTEGER NOT NULL,
  file_kind TEXT NOT NULL CHECK (file_kind IN ('text', 'image', 'binary')),
  mime TEXT,
  created_at INTEGER NOT NULL,
  ref_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE message_files (
  file_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  chip_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  size_display TEXT,
  mime_display TEXT,
  blob_sha256 TEXT NOT NULL,
  fetch_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'ok'|'failed'
  fetch_error TEXT,
  fetched_at INTEGER,
  last_accessed_at INTEGER,
  origin_url TEXT,
  UNIQUE(file_id, conversation_id, message_hash, chip_index),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (blob_sha256) REFERENCES file_blobs(sha256)
);

-- Триггеры: message_files_ai (INSERT → ref_count+1),
--           message_files_ad (DELETE → ref_count-1)
```

**Файлы на диске:** `userData/gateway_files/<sha[:2]>/<sha>.<ext>`

---

## 🚀 Роадмап hash-ID (✅ ЗАКРЫТО в v2)

- [x] `message_hash = sha256(convId + role + contentPlain + parentHash)` — 16 hex
- [x] `pw_key` параллельно (numeric `data-virtual-list-item-key`)
- [x] `syncConversation` по `message_hash`
- [x] `getMessageByHash` в `GatewayCacheService`
- [x] `markConversationSynced`
- [ ] `locateMessage(pwKeyOrHash)` в `deepseekService` — отложено (для 5.5/5.7)
- [ ] IPC `gateway:message-locate-by-hash` — отложено

---

## 📌 Известные проблемы (технический долг)

1. **Orphaned `message_files`** после `prune` — `getStatsBulk` через JOIN уже корректно считает, UI не ломается. `cleanupOrphans` — отложен.
2. **`__body` в CSS-классах** — запрещено! Regex `body → .gateway-deepseek-root` при сборке ломает. Использовать `__content`, `__scroll`, `__inner`.
3. **CSS из `GatewayPage.css` не долетает в ShadowRoot** для некоторых компонентов → inline-стили в JSX (FilePanel, Toasts).
4. **Stale closures в bridge-useEffect** (`[]` deps) → использовать `useRef` (`selectedConversationRef`, `sendingRef`, `messagesRef`, `dialogLoadToastRef`).
5. **PW переиспользует HTMLElement** → дедуп по `simpleHash(html)` через `Map<string>`, не `Map<HTMLElement>`.
6. **`message:count-changed` во время PoW** — ложные события, ломают скролл в batch → игнорировать через `batchRunningRef` (в 5.6).
7. **`selectMessages`/`regenerate`/`sendFeedback`** — `nth(index)`, не работают на виртуалке.
8. **`setRussianLanguage`** — отключён (нет селекторов Settings).
9. **FTS5** — проверено, работает (ENABLE_FTS3, ENABLE_FTS3_PARENTHESIS, ENABLE_FTS5).

10. **`Playwright is missing` в fallback** — `vite.main.config.ts` не externalize'ит `playwright-extra`. `/node_modules/` не матчится по спецификатору импорта. Нужен явный список: `'playwright', 'playwright-core', 'playwright-extra', 'puppeteer-extra', 'puppeteer-extra-plugin', 'puppeteer-extra-plugin-stealth'`. После правки `grep -c "Playwright is missing" dist/main/main.js` должно быть `0`.
11. **Yandex segfault на T480s** — при ручном `--remote-debugging-port` падает с SIGSEGV из-за GPU/sandbox. В `launchYandexWithCdp()` пока НЕ добавлены `--no-sandbox --disable-gpu --disable-gpu-compositing --disable-features=VaapiVideoDecoder`. Добавить, если segfault вернётся.

---

## 🔮 Будущее: GenericBrowserController (условия для старта)

- [ ] Завершены все текущие задачи (5.6, 5.7, 5.8)
- [ ] Есть второй агент (Yandex Alisa / GigaChat / Ollama)
- [ ] Подтверждена боль от частоты изменений селекторов (>1 раза в месяц)

**Что уже покрыто:** JSON-профили + фолбэки (`deepseek.v1.json`), `dumpCurrentPage`, мультиагентность.
**Что нового:** единый контроллер вместо копипасты, универсальный React-пульт, анти-детект, JSON-профили с instrumentation.js.

---

## 🛠 Полезные команды

```bash
npm run check:ts-gateway
npm run start
rm -rf node_modules/.vite && npm run start
```

---

## 📎 Связанные документы

- Промпт для нового чата (полный контекст, архитектурные решения, состояние файлов) — отдельный файл, вставляется при необходимости.
- `PROJECT_STATE.md` (Prana-Bindu, v36) — общий контекст проекта.


===============================================================

# Промпт для нового чата — GATEWAY (продолжение разработки, v2)

Скопируйте целиком в новый чат.

---

## 0. Задача

Продолжаем разработку окна «Шлюз» в Electron-проекте `wetothemoon-electron`.
Задача окна — автоматизировать DeepSeek (https://chat.deepseek.com) через Playwright и воспроизводить интерфейс DeepSeek 1:1 в React.

**Текущий фокус:** умная синхронизация (skip scroll при актуальной БД) + детекция изменений в PW через injectedScript. Дальше — branching, file picker из архива, полировка.

---

## 1. Контекст проекта

**Стек:**
- Electron (Electron Forge) + Vite + TypeScript
- React 19 (hooks, `useLayoutEffect`, `useRef`)
- Playwright (Chromium, non-headless)
- `node:sqlite` (`DatabaseSync`), **НЕ** `better-sqlite3`
- PrimeReact / PrimeFlex (только для `TopControlPanel`, кнопки `.pb` / `.pb-soft`)
- CSS-классы через `classNames` из `@/css/classnames`

**Пути:**
- Окно: `src/pages/GatewayPage/GatewayPage.tsx`
- Компоненты: `src/components/GATEWAY/*` (в каждом своя папка)
- Main-сервисы: `src/main/services/gateway/*`
- Cache-сервисы: `src/main/services/gateway/cache/*`
- IPC: `src/main/ipcHandlers/gatewayHandlers.ts`
- Preload: `src/preload.ts`
- Типы IPC: `src/types/gateway.d.ts` (declaration merging с `types.d.ts`)
- CSS: `src/pages/GatewayPage/GatewayPage.css` + `src/themes/deepseek-theme/main.css` (raw import через `?raw`)

**Стили:**
- Все DeepSeek стили изолированы в Shadow DOM (`GatewayDeepseekShadowRoot`)
- Замены при сборке: `:root → :host`, `body → .gateway-deepseek-root`
- ⚠️ **НИКОГДА не используй `__body` в именах CSS-классов** — замена `body → .gateway-deepseek-root` превращает `.foo__body` в невалидный `.foo__.gateway-deepseek-root`. Используй `__content`, `__scroll`, `__inner`, `__main`, `__area`.
- Если CSS из `GatewayPage.css` не долетает до элемента внутри ShadowRoot — используй **inline-стили** в JSX (у нас так сделано для `GatewayFilePanel`, `GatewayProgressToast`, `GatewayDialogLoadToast`)
- Тема через `[data-module="gateway"]`, акцент `#4d6bfe`
- Наши доп. стили — **в конец** `GatewayPage.css`
- Не трогать `main.css` (это стили DeepSeek)

**БД (`gateway.db`):**
- Файл `app.getPath('userData')/gateway.db` (Linux: `~/.config/wetothemoon-electron/gateway.db`)
- WAL-режим, `PRAGMA foreign_keys = ON`, миграции через `PRAGMA user_version`
- **v3**: `conversations`, `messages`, `messages_fts` (FTS5), `file_blobs`, `message_files`
- Файлы на диске: `<userData>/gateway_files/<sha[:2]>/<sha>.<ext>`

**Файлы для кэша `gateway_files`**:
- Text < 512 KB → `file_blobs.content_text` (в БД)
- Text ≥ 512 KB, image, binary → `file_blobs.content_path` (на диске, с дедупом по sha256)
- Дедуп через `ref_count` (триггеры на `message_files` INSERT/DELETE)
- GC: `file_blobs` с `ref_count=0` старше 24ч → удаление с диска

---

## 2. Ключевые архитектурные решения (НЕ ЛОМАТЬ)

### 2.1 Bridge Playwright ⇄ Node ⇄ IPC ⇄ React

- `page.exposeFunction('__gatewayBridge', ...)` — функция в window страницы
- `page.addInitScript({content: INJECTED_SCRIPT})` — для будущих навигаций
- `page.evaluate(INJECTED_SCRIPT)` — для текущей страницы
- Bridge-события → `gw.webContents.send('gateway:bridge-event', event)`
- GW подписывается через `api.onGatewayBridgeEvent(cb)` в `useEffect` (⚠️ stale closures на `selectedConversation` — использовать `selectedConversationRef` или `useEffect` + состояния, не замыкание из `[]`)

**Типы событий (`BridgeEvents.ts`):**
````typescript
type GatewayBridgeEventType =
  | 'network:online'
  | 'network:offline'
  | 'fetch:error'
  | 'reasoning:update'         // payload: { text }
  | 'message:count-changed'    // payload: { current, prev }
  | 'message:error'            // payload: { text, count }
  | 'history:progress'         // payload: { rawMessages: [...] }
  | 'history:complete'         // payload: { rawMessages: [...] }
  | 'conversation:list-changed'// payload: { current, prev }
  | 'assistant:content-update' // payload: { html }
  | 'file:batch-started'       // payload: { convId, total, skipped }
  | 'file:batch-progress'      // payload: { convId, current, total, ok, failed, name, status, messageHash, chipIndex, error? }
  | 'file:batch-complete';     // payload: { convId, processed, total, ok, failed, status }


=================

# GATEWAY ROADMAP

## ✅ Выполнено

### Ядро и управление Playwright
- [x] Запуск окна «Шлюз» и управление браузером через Playwright
- [x] Авторизация и восстановление сессии DeepSeek (storageState)
- [x] Корректная обработка закрытия PW руками (`disconnected` listener → `browser=null`)
- [x] Отправка сообщений и получение ответов (thinking + blocks + fullHtml)
- [x] Загрузка списка диалогов и истории сообщений
- [x] Переключатели «Глубокое мышление» и «Умный поиск»
- [x] Стриминг ответа в реальном времени через bridge (`assistant:content-update`, `reasoning:update`)
- [x] Отлов ошибок сети/сервера (`message:error` → `TopControlPanel`)
- [x] Прокрутка истории с трансляцией прогресса (`history:progress`, `history:complete`)
- [x] Удаление диалогов с подтверждением через `POST /api/v0/chat_session/delete`
- [x] Переименование диалогов
- [x] Закрепление/открепление диалогов
- [x] Выбор нескольких диалогов (bulk-pin, bulk-delete) с чекбоксами

### Архитектура и UI
- [x] Стили DeepSeek изолированы в Shadow DOM (`GatewayDeepseekShadowRoot`)
- [x] Единый компонент `GatewayIcons` для всех SVG (logo, nav, action icons и т.д.)
- [x] `TopControlPanel` (launch, refresh, кэш, toggles)
- [x] `GatewaySidebar`: группировка по датам, сворачиваемые группы, меню диалога (rename/pin/delete), режим выбора чатов, свернутый вид («пилюля» с 3 кнопками)
- [x] `GatewayMessageNavigation`: правая «мини-карта» со штрихами по сообщениям, hover-tooltip, клик-переход
- [x] `GatewaySearchModal`: глобальный поиск по названиям и содержимому (FTS5)
- [x] `GatewayConfirmModal`, `GatewayInputModal`, `GatewayCacheManager`
- [x] Модалка Share (публичная ссылка), режим выбора сообщений
- [x] Копирование/редактирование(заглушка)/regenerate/like/dislike/share под сообщениями
- [x] Сворачивание длинных сообщений как в оригинале
- [x] Автоскролл с «умной» корректировкой позиции при подгрузке истории (`overflow-anchor` + `useLayoutEffect`)

### Кэш и БД
- [x] SQLite-БД `gateway.db` (node:sqlite, WAL, миграции через `PRAGMA user_version`)
- [x] `GatewayCacheService`: `syncConversation`, `getMessages`, `listConversations`, `deleteConversation`, `searchMessages` (FTS5 + LIKE-fallback), `getStats`, `clearAll`, `exportMarkdown`
- [x] Автосохранение сообщений при открытии диалога (после `getConversationMessages`)
- [x] Fallback на БД, если Playwright недоступен
- [x] IPC-каналы `gateway:cache-*` + `gateway:delete-conversation`
- [x] Префикс `convId_<key>` в `messages.id` (защита от UNIQUE-конфликта)

---

## 📋 В работе / Ближайшие задачи

### 🎯 Приоритет 1 — Долговременная память и уникальные hash ID

Формат «JSON-файлы» из прошлой версии **не используется** — кэш уже на SQLite.
Правим принципиальную схему идентификации и синхронизации.

#### 1. Уникальный хэш-ID сообщения
- [ ] Ввести канонический `message_hash = sha256(convId + role + contentPlain + parentHash)` (16 hex-символов)
- [ ] Хранить в БД колонку `message_hash TEXT UNIQUE` (индекс)
- [ ] Хранить параллельно `pw_key` (значение `data-virtual-list-item-key` из DOM Playwright)
- [ ] При загрузке из PW заполнять оба поля; при чтении из БД — оставлять `pw_key` как есть
- [ ] При `syncConversation` сопоставлять по `message_hash`, чтобы избежать дублей при повторных открытиях диалога

#### 2. Двусторонняя связь БД ↔ PW
- [ ] IPC `gateway:message-locate-by-hash(hash)` → Playwright скроллит к сообщению и возвращает `pw_key` + boundingBox
- [ ] Использовать для будущей фичи «Открыть в оригинале»
- [ ] Использовать для скролла к сообщению из результатов поиска

#### 3. Осмысленная работа с сохранёнными диалогами
- [ ] При открытии диалога: сначала грузим из БД (мгновенно), параллельно — из PW
- [ ] Мержим: новые сообщения (по `message_hash`) → добавляем; изменённые/удалённые — по политике (оставляем в БД как архив)
- [ ] Показывать в UI индикатор «синхронизировано N сообщений» / «есть локальные правки»
- [ ] В `GatewayCacheManager` → вкладка «Диалоги»:
  - [ ] Кнопка «Открыть в оригинале» (через `gateway:message-locate-by-hash` для первого сообщения)
  - [ ] Кнопка «Синхронизировать с PW»
  - [ ] Показ `last_synced_at`, `message_count`, `pending_edits`
- [ ] Экспорт Markdown — доработать (заголовки по ролям, язык кода, thinking в `<details>`)
- [ ] Удалить один диалог из БД (сейчас есть, но проверить UI)

#### 4. FTS-поиск
- [ ] Настроить триггеры на реиндекс при `UPDATE` сообщения
- [ ] Тестировать поиск с разными языками (ru/en/mixed)
- [ ] Fallback на LIKE, если FTS5 недоступен

---

### 🎯 Приоритет 2 — Стабилизация синхронизации GW ↔ PW

- [ ] Гарантировать, что удаление в PW → БД (уже сделано)
- [ ] Гарантировать, что удаление в БД **не** удаляет в PW (уже сделано — даём выбор)
- [ ] При `message:count-changed` из PW — корректно подтягивать новые сообщения без двойной загрузки
- [ ] При переключении вкладки «Диалоги» в GW ↔ PW — синхронизировать `activeConversationId` (сейчас расхождение возможно)
- [ ] Протестировать сценарий: PW закрыт руками → GW показывает из БД, а не ошибку

---

### 🎯 Приоритет 3 — Полировка (не критично)

#### Сайдбар / меню профиля
- [ ] Нижнее меню профиля: аватар, имя, «Настройки», «Выйти»
- [ ] Экран/модалка настроек (язык, тема, hotkeys)

#### Редактирование сообщений
- [ ] Подключить `handleEditMessage` (сейчас `console.warn`) — синхронизировать с PW через `selectMessages`/`editMessage`

#### Визуальные мелочи
- [ ] Точная подгонка `GatewaySearchModal` под PW (после правок сверить повторно)
- [ ] Проверить hover-состояния и фокус-ринги в сайдбаре и навигации
- [ ] Мобильная/узкая ширина окна (проверить, что не ломается)

#### Проверка IPC
- [ ] Все `gateway:*` каналы покрыты try/catch
- [ ] Все ошибки возвращаются в UI через `TopControlPanel`
- [ ] Прелоад синхронизирован с `types.d.ts`

---

### 🧩 Плагин селекторов (адаптация под изменения DeepSeek)

- [ ] `dumpCurrentPage` + IPC `gateway:debug-dump` — уже есть в `deepseekService`, проверить, что вызывается при сбое
- [ ] `SelectorProfileService` + `deepseek.v1.json`:
  - [ ] `shareButton`, `publicLinkButton`, `reasoningToggle`, `searchToggle`, `messageInput`, `sendButton`, `conversationsList`
  - [ ] Каждый селектор — цепочка с фолбэками (`findWithFallback`)
- [ ] Автосохранение HTML-дампа при сбое поиска селектора
- [ ] Окно «Редактор селекторов» (Проверить / Сохранить / Импорт / Экспорт)
- [ ] Возможность обновлять профиль без пересборки приложения

---

## 🚀 Роадмап памяти и хэш-ID (детализация)

### Схема БД (требует миграции)

```sql
-- Новая колонка в messages
ALTER TABLE messages ADD COLUMN message_hash TEXT;
ALTER TABLE messages ADD COLUMN pw_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_hash ON messages(message_hash);

-- Метаданные диалога
ALTER TABLE conversations ADD COLUMN last_synced_at INTEGER;
ALTER TABLE conversations ADD COLUMN pending_edits INTEGER DEFAULT 0;
```

### Сервисные методы `GatewayCacheService` (дополнить)

- `getByHash(hash): CachedMessage | null`
- `updatePwKey(hash, pwKey): void`
- `getConversationMeta(convId): { lastSyncedAt, pendingEdits, messageCount }`
- `markSynced(convId): void`

### IPC

- `gateway:cache-get-by-hash(hash)`
- `gateway:cache-mark-synced(convId)`
- `gateway:message-locate-by-hash(hash)` → проксирует в `deepseekService`

### `deepseekService.locateMessage(hash)`

```ts
async locateMessage(pwKeyOrHash: string): Promise<{
  pwKey: string;
  boundingBox: { x, y, width, height };
  screenshotBase64?: string;
}>;
```

Скроллит `ds-virtual-list`, ищет `[data-virtual-list-item-key="..."]`, возвращает координаты.

### Пользовательский сценарий

1. Пользователь открывает «Кэш» → «Диалоги» → «Открыть в оригинале» у любого диалога.
2. GW вызывает `gateway:message-locate-by-hash(hash)`.
3. Playwright скроллит к сообщению, возвращает координаты.
4. GW (по желанию) делает скриншот области и показывает превью.

---

## 🔮 Будущее (не сейчас): Универсальный GenericBrowserController

Промпт от внешнего ИИ предлагает создать универсальный движок для контроля
любых сайтов с JSON-профилями, instrumentation.js, SQLite-снапшотами и
анти-детект мерами. Изоляция от `deepseekService`.

**Условия для старта:**
- Завершены все текущие задачи из GATEWAY_ROADMAP
- Есть второй агент (Yandex Alisa / GigaChat / Ollama)
- Подтверждена боль от частоты изменений селекторов (>1 раза в месяц)

**Что уже покрыто текущим подходом:**
- JSON-профили с фолбэками → `deepseek.v1.json` + `findWithFallback`
- Диагностика → `dumpCurrentPage`
- Мультиагентность → `GatewayCacheService(agentName)`

**Что нового может дать:**
- Единый контроллер вместо копипасты `deepseekService`
- Универсальный React-пульт
- Более чистая архитектура для второго/третьего агента


=================

# GATEWAY ROADMAP

## ✅ Выполнено

- [x] Запуск окна «Шлюз» и управление браузером через Playwright
- [x] Авторизация и восстановление сессии DeepSeek
- [x] Отправка сообщений и получение ответов (включая размышления и код)
- [x] Загрузка списка диалогов и истории сообщений
- [x] Выбор модели, переключатели «Глубокое мышление» и «Умный поиск»
- [x] Интеграция иконок в единый компонент `GatewayIcons`
- [x] Стилизация через Shadow DOM (`GatewayDeepseekShadowRoot`)
- [x] Режим выбора сообщений (чекбоксы, нижняя панель, создание публичной ссылки)
- [x] Кнопка «Создать публичную ссылку» (синхронизация с Playwright, модальное окно, копирование)
- [x] Обработка кнопок под сообщениями (копирование, редактирование, повтор, лайк/дизлайк, поделиться)
- [x] Сворачивание/разворачивание длинных сообщений (как в оригинале)
- [x] Исправление стилей выделения сообщений и синхронизация transition

---

## 📋 В работе / Ближайшие задачи

## 🧩 Плагин селекторов (адаптация под изменения DeepSeek)

- [ ] Добавить метод `dumpCurrentPage` и IPC `gateway:debug-dump`
- [ ] Реализовать `SelectorProfileService` и загрузку JSON-профиля
- [ ] Перевести критичные селекторы на цепочки с фолбэками:
  - shareButton, publicLinkButton, reasoningToggle, searchToggle, messageInput, sendButton, conversationsList
- [ ] Убрать концепт Expert-режима (теперь всегда включён)
- [ ] Автосохранение HTML-дампа при сбое поиска селектора
- [ ] Окно «Редактор селекторов» с функциями Проверить/Сохранить/Импорт/Экспорт
- [ ] Обновление профиля без пересборки приложения

### 1. Сайдбар
- [ ] Меню действий у каждого диалога (три точки): удаление, возможно переименование
- [ ] Меню профиля: отображение аватара/имени, выход из аккаунта
- [ ] Группировка диалогов по датам (Сегодня, Вчера, Предыдущие 7 дней и т.д.)

### 2. Навигация по истории чата
- [ ] Плавающее меню/кнопки для перехода между сообщениями (вверх/вниз, индикатор позиции)

### 3. Мелкие визуальные отличия
- [ ] Выравнивание чекбоксов, отступы, подгонка под оригинал
- [ ] Проверить цветовые схемы и шрифты

### 4. Проверка и полировка
- [ ] Убедиться, что лайк/дизлайк и повторная генерация отправляют действия в Playwright
- [ ] Проверить синхронизацию режима выбора между приложением и браузером
- [ ] Тестирование всех IPC-каналов и обработчиков ошибок

---

## 🚀 Функциональная задача: Сохранение диалогов и истории чата в JSON (уточнено)

### Цель
- Перечень чатов хранить в отдельном `index.json`.
- Каждый чат – в отдельном файле `conversations/<id>.json`.
- У каждого сообщения фиксировать `saved_at` и уникальный `id`.
- Уметь сравнивать сохранённые сообщения с данными в браузере, чтобы не загружать уже имеющиеся.

### Структура
- `deepseek_conversations/index.json` – метаданные всех чатов (id, title, last_message_at, message_count).
- `deepseek_conversations/conversations/<conversation_id>.json` – сообщения чата.

deepseek_conversations/
├── index.json
└── conversations/
├── <conversation_id>.json
└── ...


#### index.json
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "title": "Название диалога",
      "last_message_at": "2025-01-27T12:35:10Z",
      "message_count": 10,
      "updated_at": "2025-01-27T12:35:10Z"
    }
  ]
}
```

#### conversations/<conversation_id>.json
```json
{
  "id": "conv_123",
  "title": "Название диалога",
  "messages": [
    {
      "id": "msg_456",
      "role": "user",
      "content": "Текст запроса",
      "saved_at": "2025-01-27T12:34:56Z"
    },
    {
      "id": "msg_457",
      "role": "assistant",
      "thinking": "Размышление",
      "blocks": [
        {"type": "text", "content": "Ответ"},
        {"type": "code", "content": "...", "language": "python"}
      ],
      "saved_at": "2025-01-27T12:35:10Z"
    }
  ]
}
```

### Этапы
1. [ ] Разработать сервис `ConversationCacheService` (или расширить `DeepSeekService`) с методами:
   - `loadIndex(): Promise<IndexFile | null>` — чтение `index.json`
   - `saveIndex(index: IndexFile): Promise<void>` — запись `index.json`
   - `loadConversation(id: string): Promise<Conversation | null>` — чтение `conversations/<id>.json`
   - `saveConversation(conversation: Conversation): Promise<void>` — запись файла чата
   - `getCachedMessageIds(id: string): Promise<Set<string>>` — получение ID уже сохранённых сообщений
   - `applyNewMessages(id: string, newMessages: GatewayChatMessage[]): Promise<void>` — добавление только новых сообщений в кэш
2. [ ] Реализовать генерацию уникальных ID сообщений (например, `msg_<timestamp>_<random>`) и проставление `saved_at` для каждого сообщения.
3. [ ] Добавить IPC-каналы:
   - `gateway:cache-get-index`
   - `gateway:cache-get-conversation`
   - `gateway:cache-update-conversation`
   - `gateway:cache-get-new-messages` (сравнение и дозагрузка недостающих сообщений)
4. [ ] Интеграция в `GatewayPage`:
   - При открытии диалога сначала читать кэш, отображать мгновенно
   - Параллельно запрашивать свежие данные из Playwright
   - Сравнивать ID сообщений: если есть новые — дозагрузить только их и обновить кэш
   - Обновлять UI без полной перезагрузки
5. [ ] Тестирование:
   - Корректность структуры `index.json` и файлов диалогов
   - Уникальность ID сообщений
   - Правильность `saved_at`
   - Сравнение кэша с Playwright (новые сообщения появляются только при их реальном появлении)
6. [ ] Оптимизация: асинхронная запись файлов, обработка больших объёмов, предотвращение дублирования.


## 🔮 Будущее (не сейчас): Универсальный GenericBrowserController

Промпт от внешнего ИИ предлагает создать универсальный движок для контроля 
любых сайтов с JSON-профилями, instrumentation.js, SQLite-снапшотами и 
анти-детект мерами. Изоляция от deepseekService.

**Условия для старта:**
- Завершены все текущие задачи из GATEWAY_ROADMAP
- Есть второй агент (Yandex Alisa / GigaChat / Ollama)
- Подтверждена боль от частоты изменений селекторов (>1 раза в месяц)

**Что уже покрыто текущим подходом:**
- JSON-профили с фолбэками → deepseek.v1.json + findWithFallback
- Диагностика → dumpCurrentPage
- Мультиагентность → ConversationCacheService(agentName)

**Что нового может дать:**
- Единый контроллер вместо копипасты deepseekService
- Универсальный React-пульт
- Более чистая архитектура для второго/третьего агента


  --- Промпт для нового чата

  # Контекст

Я разрабатываю окно «Шлюз» в многомодульном Electron-приложении `wetothemoon-electron` (Node.js, TypeScript, React, Electron Forge, Playwright, PrimeReact/PrimeFlex). Окно предназначено для автоматизации работы с чатом DeepSeek (https://chat.deepseek.com) через Playwright: авторизация, отправка сообщений, получение ответов, восстановление сессий, а также интерфейс, максимально приближенный к оригинальному DeepSeek.

## Архитектура и ключевые файлы

### Главный процесс (src/main)
- `main.ts` — точка входа, регистрирует обработчики IPC и окна. Импортирует `registerGatewayHandlers`.
- `ipcHandlers/gatewayHandlers.ts` — обработчики каналов `gateway:*`.
- `services/gateway/deepseekService.ts` — сервис для Playwright (браузер, сессия, авторизация, отправка сообщений, история диалогов, выбор модели, тумблеры).
- `services/osint/credentials.ts` — переиспользуется для хранения учётных данных через safeStorage (ключ `'deepseek'`).
- `windows/gatewayWindow.ts` — создание окна «Шлюз» (аналогично osintWindow).
- `menus/windowMenus.ts` — содержит `gatewayWindowMenuTemplate` и пункт «Открыть Шлюз» в `mainMenuTemplate`.
- `utils/pathUtils.ts` (или `paths.ts`) — содержит `DEV_SERVER_URL`, `getMainWindowProdPath()`.

### Preload
- `src/preload.ts` — добавляет в `window.electronAPI` методы:
  - `openGatewayWindow()`
  - `gatewayLaunch()`, `gatewayClose()`, `gatewayGetStatus()`
  - `gatewaySendMessage(message)`
  - `gatewayGetConversations()`, `gatewayOpenConversation(id)`, `gatewayGetConversationMessages()`
  - `gatewaySelectModel(modelType)`, `gatewaySetDeepThinking(enabled)`, `gatewaySetSearch(enabled)`
  - `gatewayGetCurrentModel()`, `gatewayGetDeepThinking()`, `gatewayGetSearch()`
  - `gatewaySetViewportSize(width, height)` (опционально)

### Типы
- `src/types/types.d.ts` — расширен для `electronAPI` с Gateway методами.

### Рендер (React)
- `src/pages/GatewayPage/GatewayPage.tsx` — главная страница, содержит состояния и логику.
- `src/components/GATEWAY/TopControlPanel/TopControlPanel.tsx` — выпадающая панель управления (браузер, статус, режимы), скрывается/показывается по хоткею Ctrl+`.
- `src/components/GATEWAY/GatewaySidebar/GatewaySidebar.tsx` — сайдбар с логотипом, списком диалогов, профилем.
- `src/components/GATEWAY/GatewayChatHeader/GatewayChatHeader.tsx` — шапка чата с названием, режимом и кнопками.
- `src/components/GATEWAY/GatewayModeSelector/GatewayModeSelector.tsx` — блок выбора режима (Быстрый/Эксперт/Распознавание), отображается на стартовом экране.
- `src/components/GATEWAY/GatewayInputArea/GatewayInputArea.tsx` — поле ввода, тумблеры «Глубокое мышление» и «Умный поиск», кнопка отправки.
- `src/components/GATEWAY/GatewayMessageUser/GatewayMessageUser.tsx` — сообщение пользователя.
- `src/components/GATEWAY/GatewayMessageAssistant/GatewayMessageAssistant.tsx` — сообщение ассистента с размышлениями и блоками кода.

### Стили
- `src/themes/deepseek-theme/main.css` — оригинальные стили DeepSeek (скопированы с сайта).
- `src/themes/deepseek-theme/katex.css` — стили для формул.
- `src/pages/GatewayPage/GatewayPage.css` — дополнительные стили для исправления отступов, центрирования, прокрутки, цветов иконок.

## Текущее состояние (что уже работает)

- Окно «Шлюз» создаётся и открывается из меню.
- Playwright запускает Chromium, восстанавливает сессию из `deepseek_storage.json` или выполняет вход (логин/пароль из safeStorage или `.env`).
- Реализован обход капчи через ручное ожидание.
- Отправка сообщений и получение ответов с учётом блоков «размышления» и кода.
- Список диалогов загружается и отображается, выбор диалога загружает историю сообщений.
- Выбор режима (default/expert/vision), переключатели «Глубокое мышление» и «Умный поиск» работают.
- Интерфейс визуально приближен к оригиналу: сайдбар, шапка, стартовый экран с выбором режима, диалоговое окно.
- Добавлена тёмная тема (класс `dark` на body).
- Частично реализована адаптивность браузера Playwright: параметр `viewport: null` при создании контекста, чтобы страница следовала размерам окна.

## Известные проблемы и нерешённые задачи

1. **Шрифты**: не загружаются локально из-за CORS (`fe-static.deepseek.com`). Решение — закомментировать `@font-face` блоки в `main.css` или скачать и подключить шрифты локально. Пока используются системные шрифты.
2. **Кнопка «Поделиться»** в шапке диалога (`_57370c5`) реализована как копирование ссылки на чат в буфер обмена, но может требовать расширения (меню).
3. **Прокрутка**: ранее была отключена, исправлена добавлением `overflow-y: auto` и восстановлением полос прокрутки.
4. **Адаптивность окна Playwright**: браузер теперь резиновый (`viewport: null`), но при изменении размеров окна Electron возможно потребуется дополнительная синхронизация через событие `resize` (уже подготовлен метод `setViewportSize` в сервисе, но не подключён).
5. **Мелкие отличия в стилях**: заголовок стартового экрана, центрирование, ширина диалогов/поля ввода (исправлены частично через CSS).
6. **Финальное тестирование** всех функций и исправление оставшихся багов перед слиянием.

## Что нужно продолжить

- Доработать шрифты (локальное подключение или отключение).
- Проверить, что кнопка «Поделиться» работает (копирование ссылки) и, возможно, добавить меню с действиями.
- Подключить синхронизацию размера окна Electron с viewport Playwright (событие `resize` окна Gateway вызывает `setViewportSize`).
- Провести финальное тестирование: авторизация, отправка сообщений, загрузка диалогов, выбор режимов, тумблеры, прокрутка, адаптивность.
- Обновить `GATEWAY_ROADMAP.md` и сделать коммит с описанием исправлений.
- Убедиться, что все файлы соответствуют архитектуре проекта, и при необходимости вынести повторяющиеся стили/компоненты.

## Дополнительные замечания

- Все IPC-каналы используют префикс `gateway:`.
- Учётные данные DeepSeek хранятся в `osint_credentials.json` (шифруются safeStorage) или берутся из `.env` (`VITE_DEEPSEEK_LOGIN`, `VITE_DEEPSEEK_PASSWORD`).
- Сессия браузера сохраняется в `deepseek_storage.json` в `app.getPath('userData')`.
- В проекте используется алиас `@/` для импортов.
- PrimeReact/PrimeFlex применяются в `TopControlPanel`, а оригинальные компоненты DeepSeek используют чистые HTML-элементы с классами из `main.css`.

## Инструкция для нового чата

- Спросите, какие файлы нужны для продолжения (я могу прислать текущие версии).
- Попросите проверить текущее состояние, начиная с `GatewayPage.tsx` и `DeepSeekService.ts`.
- Следуйте плану: шрифты → адаптивность → тестирование → фиксы → коммит.

  ---

Отлично, я вижу полную картину. Чтобы продолжить разработку, мне нужны конкретные файлы для анализа и внесения правок. Пожалуйста, предоставьте содержимое следующих файлов (или хотя бы ключевые фрагменты):

1. `src/services/gateway/deepseekService.ts` – весь файл (особенно методы, связанные с размерами viewport, запуском браузера, кнопкой «Поделиться» и т.д.)
2. `src/pages/GatewayPage/GatewayPage.tsx` – весь файл (логика и состояния)
3. `src/preload.ts` – текущие методы `electronAPI` (особенно `gatewaySetViewportSize`, если есть)
4. `src/ipcHandlers/gatewayHandlers.ts` – весь файл
5. `src/windows/gatewayWindow.ts` – весь файл
6. `src/themes/deepseek-theme/main.css` – только блоки `@font-face` и подключение шрифтов (или первые ~50 строк)
7. `src/components/GATEWAY/GatewayChatHeader/GatewayChatHeader.tsx` – чтобы увидеть реализацию кнопки «Поделиться»
8. `GATEWAY_ROADMAP.md` – текущее содержимое (если есть)
9. `src/utils/pathUtils.ts` или `paths.ts` – для понимания путей.

Если какой-то файл слишком большой, можно прислать только релевантные части (например, методы `setViewportSize`, `launch`, `share`, обработчики IPC). 

После получения файлов я смогу:
- Предложить исправления для шрифтов (локальное подключение или отключение).
- Подключить синхронизацию размеров окна Electron и viewport Playwright.
- Улучшить кнопку «Поделиться» (добавить меню при необходимости).
- Проверить и исправить возможные ошибки.
- Обновить ROADMAP и подготовить коммит.

Жду ваши файлы!

  ---

Спасибо за файл `deepseekService.ts`. Он достаточно полный, но есть несколько замечаний и потенциальных улучшений, которые мы сможем обсудить после получения остальных файлов. 

Относительно вашего замечания про `safeStorage`: в текущем коде он действительно не используется напрямую, но вы импортируете `getCredentials` и `setCredentials` из `../osint/credentials`, которые, согласно архитектуре, уже должны реализовывать шифрование через `safeStorage`. Поэтому дублировать логику здесь не нужно — достаточно убедиться, что модуль `credentials.ts` корректно работает. Если хотите, я могу проверить и этот файл, когда вы его пришлёте.

**Что мне нужно для продолжения:**

1. **`src/pages/GatewayPage/GatewayPage.tsx`** — основной компонент страницы.
2. **`src/preload.ts`** — чтобы увидеть все методы `electronAPI` (особенно `gatewaySetViewportSize`).
3. **`src/ipcHandlers/gatewayHandlers.ts`** — обработчики IPC.
4. **`src/windows/gatewayWindow.ts`** — создание окна.
5. **`src/components/GATEWAY/GatewayChatHeader/GatewayChatHeader.tsx`** — кнопка «Поделиться».
6. **`src/themes/deepseek-theme/main.css`** — первые ~100 строк (где `@font-face`).
7. **`GATEWAY_ROADMAP.md`** — если есть.
8. **`src/main/services/osint/credentials.ts`** — для проверки safeStorage.

Если какой-то файл слишком объёмный, можно прислать только ключевые фрагменты (например, методы работы с viewport, заголовок, стили шрифтов).

После получения этих файлов я смогу:
- Предложить конкретные правки для шрифтов (локальное подключение или отключение `@font-face`).
- Подключить синхронизацию размера окна Electron с viewport Playwright через IPC.
- Доработать кнопку «Поделиться» (возможно, добавить выпадающее меню с действиями).
- Проанализировать и исправить возможные ошибки в текущем коде.
- Обновить ROADMAP и подготовить коммит.

Жду ваши файлы.

  ---

Принял `gatewayWindow.ts`. Теперь у нас есть почти все ключевые файлы, кроме:

- `GatewayChatHeader.tsx` (кнопка «Поделиться» и заголовок)
- `main.css` (первые ~100 строк, где `@font-face`)
- `GATEWAY_ROADMAP.md` (если есть)
- `credentials.ts` (для проверки safeStorage)

Как только они будут предоставлены, я смогу дать окончательные рекомендации по шрифтам и кнопке «Поделиться». А пока я проанализировал текущий код и вижу, что нам необходимо решить проблему синхронизации размеров окна Electron с viewport браузера Playwright, как упоминалось в нерешённых задачах.

### Текущее состояние viewport в DeepSeekService

В `deepseekService.ts` при создании контекста **не задаётся `viewport`**. Это означает, что Playwright будет использовать размер по умолчанию (1280×720), независимо от фактического размера окна браузера. В описании проекта было сказано, что использовался `viewport: null`, но в текущем коде это не так (возможно, вы это уже поменяли). Чтобы браузер следовал размерам окна Electron, лучше явно задать `viewport` при создании контекста, а затем обновлять его через `page.setViewportSize()` при изменении размеров окна.

### План изменений для синхронизации viewport

1. **Добавить метод `setViewportSize` в `DeepSeekService`**  
   В классе `DeepSeekService` добавим публичный метод, который вызывает `page.setViewportSize()`:

   ```typescript
   async setViewportSize(width: number, height: number): Promise<void> {
     if (!this.page) return;
     await this.page.setViewportSize({ width, height });
   }
   ```

2. **Добавить обработчик IPC `gateway:set-viewport-size` в `gatewayHandlers.ts`**  
   В `registerGatewayHandlers` добавим:

   ```typescript
   ipcMain.handle('gateway:set-viewport-size', async (_event, width: number, height: number) => {
     try {
       await service.setViewportSize(width, height);
       return { success: true };
     } catch (error) {
       return { success: false, error: (error as Error).message };
     }
   });
   ```

3. **Добавить метод в `preload.ts`**  
   В объект `electronAPI` добавим:

   ```typescript
   gatewaySetViewportSize: (width: number, height: number) =>
     ipcRenderer.invoke('gateway:set-viewport-size', width, height),
   ```

4. **Использовать в `GatewayPage.tsx`**  
   Добавим `useEffect`, который отслеживает изменение размера окна и вызывает `gatewaySetViewportSize`:

   ```typescript
   useEffect(() => {
     const handleResize = () => {
       const width = window.innerWidth;
       const height = window.innerHeight;
       api.gatewaySetViewportSize(width, height).catch(() => {});
     };
     window.addEventListener('resize', handleResize);
     handleResize(); // начальная установка
     return () => window.removeEventListener('resize', handleResize);
   }, []);
   ```

   При этом нужно учитывать, что размер окна Electron может не точно совпадать с viewport браузера из-за панелей инструментов, но для начала это приемлемо.

5. **Установить начальный viewport при создании контекста**  
   В `deepseekService.ts` в методах `loadStorageState` и `launch` (при создании контекста) добавим `viewport` с размерами окна Gateway (по умолчанию 1100×800, как в `gatewayWindow.ts`). Например:

   ```typescript
   const defaultViewport = { width: 1100, height: 800 };
   // в loadStorageState:
   this.context = await this.browser!.newContext({ storageState: state, viewport: defaultViewport });
   // в launch, если storage не загружен:
   this.context = await this.browser.newContext({ viewport: defaultViewport });
   ```

   После запуска и авторизации можно сразу вызвать `setViewportSize` с фактическими размерами окна.

### Примечание по `viewport: null`

Если вы всё же хотите использовать `viewport: null` (чтобы браузер сам адаптировался под размер окна), то метод `page.setViewportSize` работать не будет, потому что viewport не управляется Playwright. Тогда синхронизация должна осуществляться через изменение размера самого окна браузера (например, через `browser.newContext` с параметром `viewport: null` и изменение размера окна браузера из Electron?). Это сложнее, поэтому рекомендую использовать фиксированный viewport и управлять им через Playwright.

### Дальнейшие шаги

После предоставления недостающих файлов я смогу:
- Исправить проблему со шрифтами (отключить `@font-face` или подключить локально).
- Доработать кнопку «Поделиться» (возможно, добавить выпадающее меню).
- Проверить `credentials.ts` на предмет safeStorage.
- Обновить `GATEWAY_ROADMAP.md`.

Жду оставшиеся файлы.

  ---

промпт для следующего чата

  ---

  # Контекст проекта: окно «Шлюз» (DeepSeek) в многомодульном Electron-приложении

Мы разрабатываем окно «Шлюз» в проекте `wetothemoon-electron` (Node.js, TypeScript, React, Electron Forge, Playwright, PrimeReact/PrimeFlex). Окно автоматизирует работу с чатом DeepSeek (https://chat.deepseek.com) через Playwright: авторизация, отправка сообщений, получение ответов, восстановление сессий, а также интерфейс, максимально приближенный к оригинальному DeepSeek.

## Основные файлы и структура

### Главный процесс (src/main)
- `main.ts` — точка входа, регистрирует обработчики IPC и окна.
- `ipcHandlers/gatewayHandlers.ts` — обработчики каналов `gateway:*`.
- `services/gateway/deepseekService.ts` — сервис для Playwright (браузер, сессия, авторизация, отправка сообщений, история диалогов, выбор модели, тумблеры).
- `services/osint/credentials.ts` — переиспользуется для хранения учётных данных через safeStorage (ключ `'deepseek'`).
- `windows/gatewayWindow.ts` — создание окна «Шлюз».
- `menus/windowMenus.ts` — содержит `gatewayWindowMenuTemplate` и пункт «Открыть Шлюз» в главном меню.
- `utils/pathUtils.ts` — содержит `DEV_SERVER_URL`, `getMainWindowProdPath()`.

### Preload (src/preload.ts)
Добавлены методы:
- `openGatewayWindow()`
- `gatewayLaunch()`, `gatewayClose()`, `gatewayGetStatus()`
- `gatewaySendMessage(message)`
- `gatewayGetConversations()`, `gatewayOpenConversation(id)`, `gatewayGetConversationMessages()`
- `gatewaySelectModel(modelType)`, `gatewaySetDeepThinking(enabled)`, `gatewaySetSearch(enabled)`
- `gatewayGetCurrentModel()`, `gatewayGetDeepThinking()`, `gatewayGetSearch()`
- `gatewayStartSelectionMode()`, `gatewaySelectMessages(indices)`, `gatewayCancelSelectionMode()`, `gatewayCreatePublicLink()`

Все IPC вызываются через `ipcRenderer.invoke`.

### Типы (src/types/types.d.ts)
Расширены для `electronAPI` с Gateway методами.

### Рендер (React)
- `src/pages/GatewayPage/GatewayPage.tsx` — главная страница.
- Компоненты в `src/components/GATEWAY/`:
  - `TopControlPanel/TopControlPanel.tsx` — выпадающая панель управления (браузер, статус, режимы), появляется при наведении в верхнюю центральную зону или по Ctrl+` (вне Shadow DOM).
  - `GatewaySidebar/GatewaySidebar.tsx` — сайдбар с логотипом, списком диалогов, профилем.
  - `GatewayChatHeader/GatewayChatHeader.tsx` — шапка чата с названием, режимом и кнопками.
  - `GatewayModeSelector/GatewayModeSelector.tsx` — блок выбора режима (Быстрый/Эксперт/Распознавание).
  - `GatewayInputArea/GatewayInputArea.tsx` — поле ввода, тумблеры «Глубокое мышление» и «Умный поиск», кнопка отправки.
  - `GatewayMessageUser/GatewayMessageUser.tsx` — сообщение пользователя.
  - `GatewayMessageAssistant/GatewayMessageAssistant.tsx` — сообщение ассистента с размышлениями и блоками кода.
  - `GatewayIcons/GatewayIcons.tsx` — все SVG-иконки вынесены в отдельный файл.
  - `GatewaySelectionPreview/GatewaySelectionPreview.tsx` — правая панель предпросмотра выбранных сообщений.
  - `GatewayDeepseekShadowRoot/GatewayDeepseekShadowRoot.tsx` — обёртка для изоляции стилей DeepSeek через Shadow DOM.

### Стили
- `src/themes/deepseek-theme/main.css` — оригинальные стили DeepSeek (подключаются как raw-строка внутри Shadow DOM).
- `src/themes/deepseek-theme/katex.css` — стили для формул (также raw).
- `src/pages/GatewayPage/GatewayPage.css` — дополнительные стили (минимальные, закомментированы лишние).
- Шрифты лежат в `public/deepseek-theme/` и загружаются по абсолютным путям (исправлено).

## Что уже реализовано и работает

1. Окно «Шлюз» создаётся и открывается из меню.
2. Playwright запускает Chromium, восстанавливает сессию из `deepseek_storage.json` или выполняет вход (логин/пароль из safeStorage или `.env`).
3. Обход капчи через ручное ожидание.
4. Отправка сообщений и получение ответов с учётом блоков «размышления» и кода.
5. Загрузка списка диалогов, выбор диалога, загрузка истории сообщений.
6. Выбор режима модели (default/expert/vision), переключатели «Глубокое мышление» и «Умный поиск».
7. Интерфейс визуально приближен к оригиналу: сайдбар, шапка, стартовый экран с выбором режима, диалоговое окно.
8. Тёмная тема (класс `dark`, атрибут `data-ds-dark-theme`).
9. **Shadow DOM для полной изоляции стилей DeepSeek от глобальных стилей приложения.** Это решило конфликты CSS. Компонент `GatewayDeepseekShadowRoot` создаёт shadow root, вставляет туда обработанный CSS (главное: замена `:root` на `:host`, `body` на `.gateway-deepseek-root`) и рендерит всё содержимое Gateway через портал.
10. **Режим выбора сообщений**:
    - Клик по кнопке в шапке включает режим.
    - Слева от каждого сообщения появляется чекбокс.
    - Выбранные сообщения получают классы `_6e8caf5 _7729a77`, что запускает псевдоэлемент `::before` для подсветки фона.
    - Внизу появляется панель выбора с кнопками «Выбрать все», «Отмена», «Создать публичную ссылку».
    - Правая панель предпросмотра (`GatewaySelectionPreview`) показывает выбранные сообщения.
    - Подсветка заголовка размышления теперь работает (добавлены стили в конец processedCss в `GatewayDeepseekShadowRoot`).
11. **Верхняя панель управления (TopControlPanel)**:
    - Появляется при наведении мыши в верхнюю центральную половину окна или по Ctrl+`.
    - Панель не закрывается, пока курсор над ней (реализовано через состояние `panelHovered` в `GatewayPage`).

## Известные проблемы и недоделки

1. **Обработка кнопок под сообщениями в обычном режиме**:
   - В `GatewayMessageUser` и `GatewayMessageAssistant` панель кнопок (копирование, редактирование, повтор, лайк/дизлайк, поделиться) отображается, но **не подключены обработчики** к ним. Нужно реализовать соответствующие действия (как минимум копирование текста; возможно, вызов IPC для повторной генерации, лайков и т.д., если они нужны).

2. **Обработка кнопок в режиме выбора**:
   - В нижней панели выбора (`_43d222b`) есть кнопки «Выбрать все», «Отмена», «Создать публичную ссылку».
   - «Выбрать все» и «Отмена» уже вызывают `handleSelectAll` и `handleToggleSelectMode` соответственно (проверить, работают ли).
   - «Создать публичную ссылку» вызывает `handleCreatePublicLink`, который через IPC запускает в Playwright создание публичной ссылки, затем показывает модальное окно `GatewayShareModal`. Нужно проверить, что весь поток работает корректно, и при необходимости добавить обработку ошибок и закрытие модального окна.

3. **Сайдбар (GatewaySidebar)**:
   - Список диалогов отображается, выбор диалога работает.
   - Не реализованы:
     - Кнопка «Новый чат» (уже есть `onNewChat`, но нужно проверить, что Playwright переходит на новый чат).
     - Кнопка поиска (обновление списка) — уже есть `onRefresh`.
     - Меню действий у каждого диалога (три точки) — не реализовано.
     - Профиль пользователя (клик по аватару/имени) — не реализован.
     - Возможно, требуется группировка диалогов по датам (сейчас просто список).

4. **Меню справа от диалогов для навигации по истории чата**:
   - В оригинальном DeepSeek есть плавающее меню (или полоса прокрутки) для быстрого перемещения по сообщениям (например, кнопки вверх/вниз, индикатор позиции).
   - У нас это не реализовано. Нужно изучить оригинальный HTML/CSS и создать компонент, который показывает список якорей или кнопки для перехода к сообщениям.

5. **Мелкие визуальные отличия**:
   - Возможно, не идеально выровнены чекбоксы или отступы в некоторых состояниях.
   - Верхняя панель вне Shadow DOM, поэтому её стили нужно задавать отдельно (сейчас используются inline-стили).

## Технические детали, важные для продолжения

- **Shadow DOM**: компонент `GatewayDeepseekShadowRoot` импортирует `main.css`, `katex.css`, `GatewayPage.css` через `?raw` (Vite). Внутри `useEffect` он создаёт `attachShadow`, добавляет `<style>` с обработанным CSS (заменяются `:root` на `:host`, `body` на `.gateway-deepseek-root`). Затем добавляет контейнер `.gateway-deepseek-root.dark` с атрибутом `data-ds-dark-theme="dark"` и рендерит children через `createPortal`. Для точечных исправлений мы добавляли дополнительные CSS-правила прямо в конец `processedCss` внутри этого компонента. **При продолжении работы, если нужно добавить стили, делайте это либо в `GatewayPage.css` (raw), либо в конце обработанного CSS в `GatewayDeepseekShadowRoot.tsx`.**

- **Иконки**: все SVG вынесены в `GatewayIcons.tsx` и экспортируются как компоненты (`CopyIcon`, `EditIcon`, `RepeatIcon`, `LikeIcon`, `DislikeIcon`, `ShareIcon`, `BrainIcon`, `ChevronIcon`, `CheckIcon` и др.). Используйте их, чтобы не дублировать код.

- **Верхняя панель**: находится **вне** Shadow DOM, её стили задаются инлайн или глобально. В `GatewayPage.tsx` есть состояния `topPanelOpen` и `panelHovered`, обработчик `mousemove` для активации зоны (центральная верхняя часть). Панель не закрывается при наведении на неё.

- **Сообщения**: структура компонентов максимально приближена к оригинальной: корневой контейнер (`_9663006` для user, `_4f9bf79` для assistant), внутри чекбокс (`d30139ff`), затем `ds-message`, затем панель кнопок (`_11d6b3a` / `ds-flex _0a3d93b`). Все классы соответствуют оригиналу.

- **Стили выбранных сообщений**: добавлены в конец `processedCss` в `GatewayDeepseekShadowRoot.tsx`:
  ```css
  .ds-message._7729a77 { position: relative; }
  .ds-message._7729a77::before { content:""; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:calc(100% + 32px); height:calc(100% + 40px); border-radius:12px; background-color:transparent; pointer-events:none; transition:background-color .15s ease; }
  .ds-message._7729a77._6e8caf5::before { background-color:#212123; }
  .ds-message._7729a77 > * { position:relative; z-index:1; }


  ---

  Для аккуратного внесения правок без риска сломать уже работающий код, мне потребуются текущие версии следующих файлов. Пожалуйста, пришлите их (можно в виде кода или укажите, что они доступны для редактирования).

### 1. Компоненты сообщений (обработка кнопок)
- `src/components/GATEWAY/GatewayMessageUser/GatewayMessageUser.tsx`
- `src/components/GATEWAY/GatewayMessageAssistant/GatewayMessageAssistant.tsx`

### 2. Главная страница и управление состоянием
- `src/pages/GatewayPage/GatewayPage.tsx`

### 3. Сайдбар
- `src/components/GATEWAY/GatewaySidebar/GatewaySidebar.tsx`

### 4. Режим выбора и предпросмотр
- `src/components/GATEWAY/GatewaySelectionPreview/GatewaySelectionPreview.tsx`
- Если есть компонент модального окна для публичной ссылки, пришлите и его (например, `GatewayShareModal.tsx`). Если нет — укажите.

### 5. Обёртка Shadow DOM (для добавления стилей и интеграции навигации)
- `src/components/GATEWAY/GatewayDeepseekShadowRoot/GatewayDeepseekShadowRoot.tsx`

### 6. Набор иконок (чтобы понимать доступные компоненты)
- `src/components/GATEWAY/GatewayIcons/GatewayIcons.tsx`

### 7. Preload и типы
- `src/preload.ts`
- `src/types/types.d.ts`

### 8. Главный процесс и сервис
- `src/ipcHandlers/gatewayHandlers.ts`
- `src/services/gateway/deepseekService.ts`

### 9. Дополнительные стили
- `src/pages/GatewayPage/GatewayPage.css` (если используется raw-импорт)
- Любые глобальные CSS, которые могут влиять на Gateway (если есть).

---

Если какие-то файлы отсутствуют или имеют другое имя, сообщите — я скорректирую запрос. После получения этих файлов я смогу дать точные пошаговые правки, минимизируя риск конфликтов.