# docs/prompts/navigator/handoff/next-steps.md

# С чего начать новый чат (Navigator)

> ⚠️ **Формат правок:** «найти → заменить» (два блока). Не diff, не весь файл.
> Gateway остаётся legacy — не трогаем до закрытия Navigator MVP.

## Приоритет на сессию

### Этап 1 — MVP (GigaChat end-to-end, ~2 ч)

1. **Backend** (25 мин):
   - `src/main/services/navigator/toolRegistry.ts` — `ToolEntry`, `register/get/list`
   - `src/main/services/navigator/llmTool.ts` — обёртка `ProviderAdapter`
   - `src/main/ipcHandlers/navigatorHandlers.ts` — `navigator:list-tools`, `navigator:send`, `navigator:on-chunk`
2. **Window + route** (15 мин):
   - `src/main/windows/navigatorWindow.ts` (копия `gatewayWindow.ts`)
   - `src/main/menus/windowMenus.ts` — `+navigatorWindowMenuTemplate`
   - `src/main/main.ts` — 3 регистрации (импорт, хендлер меню, создание)
   - `src/navigation/routes.tsx` — `+{path:'/navigator', Component: NavigatorPage, title:'Navigator'}`
3. **Preload + types** (10 мин):
   - `src/types/navigator.d.ts` — `electronAPI.navigator: {...}`
   - `src/preload.ts` — `+navigator: {...}`
4. **UI** (30 мин):
   - `src/pages/NAVIGATOR/NavigatorPage.tsx` (layout)
   - `src/pages/NAVIGATOR/NavigatorSidebar.tsx` (профили + бейджи DS/GG + launch)
   - `src/pages/NAVIGATOR/NavigatorChat.tsx` (input + send + stream)
5. **Тест** (10 мин): GigaChat send end-to-end

### Этап 1.5 (следующая сессия)

- `DeepSeekAdapter.sendMessage` (TD11) — реализация
- `DeepSeekAdapter.getConversations` — recon (П1b)

### Этап 2 (~2 ч)

- Memory: обобщение `GatewayCacheService` + `contextBuilder`
- `SiteAdapter` (rusprofile) + Fremen Eye на patchright
- `UtilityTool` (email-gen, cookieTracker)

### Этап 3 (после)

- Pipeline (JSON-шаги, `topics/04_JSON_PROTOCOL.md` §Pipeline)
- Alice/Qwen адаптеры

## С чего начать новый чат

```bash
cd ~/Документы/GitHub/wetothemoon-project/wetothemoon-electron
node scripts/preflight-check.mjs
git log --oneline -5
git status --short
```

## Правила

- **Find/replace** (два блока)
- **git commit по группам**, никогда `git add .`
- **`wm-backup`** перед крупным шагом
- **Gateway не трогаем** до закрытия MVP

## 2026-11-24 — После фикса «диалоги не все показывают сообщения»

### ✅ Сделано в этой сессии (коммит «Navigator: клик по диалогу синхронизирует историю»)

- **Backend `navigator:sync-messages`** — URL восстанавливается из `convId` (если не передан), навигация и `waitForSelector('[data-message-id]')` выполняются **всегда**, а не только при явном URL. Эмит `navigator:conversation-saved` после `cache.syncConversation`.
- **Sidebar `onClick`** — реально вызывает `syncMessages(profileId, convId, '')` в фоне, индикатор `⟳` в строке диалога, повторный `onSelectConversation(c.id)` для ремаунта Chat (`chatKey++`).
- **Adapter `getConversations`** — перед парсингом: клик по `SidebarFavoritesShowMore` (если есть) + прокрутка виртуального контейнера (`VirtualRow.scrollIntoView({block:'end'})` в цикле до стабилизации счётчика). Теперь видны все ~38 диалогов, а не только 11 отрендеренных.

### 🐞 Баг A (продолжение) — блокирующий IPC

`syncMessages` ждёт `[data-message-id]` **15 с** синхронно. Если GigaChat тормозит — Sidebar висит в `⟳`, UI не респонсивен до возврата IPC.

- **MVP:** ок, оставляем.
- **Потом:** переделать на event-based — `navigator:sync-messages` возвращает сразу `{ started: true }`, а результат приходит событием `navigator:sync-finished` / `navigator:sync-error`. Триггерит `refreshConversations` через подписку.

### 🐞 conversation-saved event — довести до конца

- [ ] `preload.ts`: добавить `onConversationSaved(cb)` (аналог `onChunk`).
- [ ] `navigator.d.ts`: тип `NavigatorConversationSaved { profileId, convId, count }`.
- [ ] `NavigatorSidebar.tsx`: `useEffect`-подписка → `refreshConversations(selectedId)`.
- [ ] Разблокирует автопоявление нового диалога после `navigator:send` без ручного **Sync**.

~10 мин, следующий заход. Не блокер — фикс с ручным Sync уже работает.

### 🐞 getCurrentMessages — virtual scroll для длинных чатов

Если длинные чаты (>30 сообщений) тоже рендерятся виртуализированно — увидим только последние N. Симптом: в БД `message_count` меньше, чем реально в GigaChat. Не проверяли.

- **Fix:** в `getCurrentMessages` перед парсингом — `scrollIntoView` на **первом** `[data-message-id]`, ждать стабилизации, повторять до тех пор, пока счётчик `[data-message-id]` не перестанет расти.
- **Проверить на:** реальном длинном диалоге (>40 сообщений).
- **Приоритет:** средний, только если реально режется история.

### 📌 Смежное (не забыть при Этапе 1.5 — DeepSeek)

- **DS cookies:** перед `DeepSeekAdapter.sendMessage` — проверить persistence `userDataDir` в `ProfileService` (patchright должен сохранять cookies DS-домена). Если не сохраняет — капчи будут чаще.
- **WAF-rotate в середине стрима:** DS может ротировать WAF-cookie посреди ответа → стрим рвётся. Лечится retry в адаптере + safety-timer в UI (уже есть, 135 с).
- **`hasSession(profileId, 'deepseek')`** должен проверять **домен** DS, а не «профиль авторизован где-то». Уже provider-aware — проверить в коде при реализации.
- **CookieTracker (схема v11)** — **не делаем сейчас**. Отдельная фича, не блокер. `profile_cookies` / `cookie_events` в v10 нет, и не надо.