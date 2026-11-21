# Сделано / НЕ откатывать — Gateway

## Сделано (не ломать)

| Компонент | Статус | Коммит |
|---|---|---|
| Patchright + Chrome stealth (stealth-канал) | ✅ | (бан-чат) |
| API-канал DeepSeek (`deepseekApiService.ts`) — SSE, reasoning_content, usage | ✅ | (бан-чат) |
| Учёт бюджета API (`apiUsageDb.ts`, JSONL) | ✅ | (бан-чат) |
| contextBuilder (FS + DB-first continuation) | ✅ | `0821ea4` |
| Multi-profile cache v8 (`profile_id` в 4 методах) | ✅ | `1d402b0`, `ccde55d` |
| v9 миграция — `context_nodes`, `context_versions`, `context_workspaces`, `tasks` | ✅ | `62ca32b` |
| contextService (manifest → БД) | ✅ | `770dbc8`, `fddf746` |
| `buildContinuationSystemPrompt` DB-first | ✅ | `0821ea4` |
| L0 = `_common/COMMON.md` (не OSINT) | ✅ | `c5b359c` |
| preflight-check.mjs (9 секций, ESM) | ✅ | `694dd5f`, `18784c1`, `c5b359c` |
| UI аккаунтов + стили (6 common CSS глобально) | ✅ | `57e4bbc`, `ca45df4`, `8014c25` |
| **Handoff-кнопка** — async export, loading state, intent-секции, git log -15 | ✅ | `560537c` |
| **Per-module dropdown** — gateway / prana-bindu / osint / sietch | ✅ | (эта сессия) |
| **Стандарт 13 секций** для всех модулей | ✅ | (эта сессия) |
| **cookieTracker.ts** + **probe-deepseek-cookies.mjs** — мониторинг куки, которыми DeepSeek/провайдеры идентифицируют и трекают пользователя. Anti-detection, тот же трек, что patchright stealth | ✅ | `e089c5e` |
| **done.md / git log -10 / meta-instructions** в handoffBuilder | ✅ | (эта сессия) |
| **recon-free-llms.mjs** + `candidates.json` + `filter-discovered.mjs` — разведка 15 провайдеров (9 живых) | ✅ | `92adb33` |
| **gitignore**: `docs/*` + `!docs/prompts/` (18 intent-файлов в git), `deepseek_cookies.json` + `.env.local.bak-*` вне git | ✅ | `72969d6`, `2c269d1`, `c709b83` |
| **Switch профиля без auto-launch** + кнопка «Запустить/Войти» в `GatewayAccountsDialog` | ✅ | (эта сессия) |
| **cookieTracker.ts** + **probe-deepseek-cookies.mjs** — снимок куки по профилю (CDP) | ✅ | `e089c5e` |
| **done.md / git log -10 / meta-instructions** в handoffBuilder | ✅ | (эта сессия) |
| **HandoffTab.tsx** (369 строк) в `GatewayAccountsDialog` — module switcher + presets + per-profile v10 | ✅ | `cf20d47`, `e5ef5af` |
| **v10 миграция** — `handoff_preferences` (profile_id unique, selection_json, preset) | ✅ | `cf20d47` |
| **Topics миграция** — `topics/01-12.md` + `MODULE_MAP.structure:'topics'` + legacy DEPRECATED | ✅ | `8e35196`, `67aa498` |
| **scripts/{mjs,bash}/** + `scripts-index.mjs` + `manifest.json` + headers (6 ключевых) | ✅ | `96454d9` |
| **rate-limit fix** — `RATE_MARKS` += `'лимит будет восстановлен'` (для DeepSeek) | ✅ | (эта сессия) |

## Правила работы (не нарушать)

- **`patchright`** — форк Playwright. Не заменять на upstream без проверки stealth-детекта.
- **Изоляция каналов:** при работе над API-каналом — web не трогаем. И наоборот.
- **`profileId` везде** — в IPC, bridge-событиях, БД, API-ответах. Default = активный профиль.
- **`tasks.context_key` БЕЗ FK** — при переименовании direction задачи не теряются.
- **`kind` / `status` / `priority` — TEXT, не enum** — новые значения без миграции.
- **`key.split('/').length`** = уровень в `context_nodes` (L0→L4). Не менять.
- **`docs/` НЕ коммитить** (кроме `docs/prompts/` — правила игры).
- **`.env.local`** — ключи не выводить в чат/логи.
- **`npm run dev`, не `npm start`**.
- **`wm-backup`** перед крупным шагом.

## Что нельзя откатывать

- `deepseekApiService.ts` — стриминг SSE + `sendMessageViaApi`.
- `contextService.ts` — `syncManifestToDb`, `getChain` (дедуп через `seen Set`).
- `handoffBuilder.ts` — `MODULE_MAP`, `readPrompt`, разветвление Schema.
- `TopControlPanel.tsx` — dropdown модулей. **Кнопка handoff переезжает** в `HandoffAndSettingsDialog` (Приоритет 1 следующей сессии) — «не откатывать» относится к dropdown, не к кнопке.
- v9-миграция — 4 таблицы, индексы, `PRAGMA foreign_keys = ON`.
- `preflight-check.mjs` — 9 секций, ESM (`await import`).

## 2026-11-21 #2 — rate-limit UI (бейдж + кликабельная кнопка)

- **Диагноз:** main работал корректно, баг был в UI — find/replace
  прижился частично (подписка + тикер), но `ProfileInfo` / JSX-бейдж /
  disable-логика не применились.
- `ProfileInfo`: `+ rateLimitedUntil?: number | null; + bannedAt?: number | null`
- `formatLockTime(ts)` — HH:MM ru-RU
- Бейдж: `⏸ до HH:MM` при rate-limit, `⛔ забанен` при ban
- Кнопка «Запустить» при rate-limit: янтарная (`#f59e0b`), **кликабельна**
  (браузер открывается для просмотра/копирования сообщений).
  Hover `rgba(245,158,11,0.18)` через `onMouseEnter/onMouseLeave` — обход `.pb:hover`.
- Кнопка при ban: `disabled`
- `onLaunch`: guard только `bannedAt`, rate-limit разрешён
- Real-time: `onGatewayBridgeEvent` (`rate-limited`/`banned`/`switched`) → `refresh()`
- Тикер 30 сек: бейдж исчезает по истечении без переоткрытия диалога