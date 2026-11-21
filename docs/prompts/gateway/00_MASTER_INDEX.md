# 00_MASTER_INDEX — Gateway

> Навигация по модулю. Единственное место, где список topics описан явно.
> При добавлении нового `topics/<NN>_<NAME>.md` — обновить эту таблицу.

## С чего начать

| Файл | Роль | Когда читать |
|---|---|---|
| `COMMON_CONTEXT.md` | «Always-on»: цель, 16 принципов, провайдеры, профили, механика, стек, карта файлов | **Всегда** (первым) |
| `PROJECT_STATE.md` | Снимок цифр/статуса на дату | Всегда (вторым) |
| `summary.md` | Короткий overview для context chain | Автоматически (manifest) |
| `topics/<NN>_<NAME>.md` | Текущая задача направления | 1–2 файла по задаче |

## Topics (направления)

| # | Файл | О чём | Статус |
|---|---|---|---|
| 01 | `topics/01_PROVIDERS.md` | ProviderAdapter, registry, DeepSeekAdapter, GigaChat, Alice, TD7/TD11/TD12/TD15 | Фаза B.4 |
| 02 | `topics/02_BROWSER_POOL.md` | BrowserPool, ProfileRouter, IP-изоляция (П4), П1a (Chrome закрывается), П1b (пустой сайдбар), TD8, TD13, П7 | Фаза B.5 |
| 03 | `topics/03_RECON.md` | GigaChat recon, Alice recon, Duck.ai (TD10), deepseek-harness (не используем), П6, TD6, TD14 | Фаза B.6 |
| 04 | `topics/04_UI.md` | TopControlPanel, GatewayChatHeader, **два пути handoff**, П1-fix-B, перенос кнопки в диалог профилей, event bus | Фаза B.7 |
| 05 | `topics/05_API_CHANNEL.md` | API как второй приоритет, tokenCounter отложен, изоляция каналов, `gateway:send-message-api` | Фаза B.8 |
| 06 | `topics/06_INTENT_FILES.md` | Роль intent-файлов, DEPRECATED legacy (problems/roadmap/techdebt) | v13+ |
| 07 | `topics/07_SCRIPTS_REORG.md` | `scripts/{bash,mjs,python}`, header-конвенция, `manifest.json`, реестр как основа tools | v13+ |
| 08 | `topics/08_JSON_TOOLS.md` | Prompt-based tool calling: registry, parser, executor, audit; whitelist скриптов с `@tool true` | v13+ |
| 09 | `topics/09_MD_EDITOR.md` | Редактор `.md` в UI (topics + handoff), IPC read/write, whitelist путей | v13+ |
| 10 | `topics/10_COOKIE_TRACKER.md` | `profile_cookies`, `cookie_events` (v11), snapshot+diff, события `cookie:*` | v13+ |
| 11 | `topics/11_EMAIL_MAILTM.md` | `EmailProviderAdapter`, `MailTmAdapter`, `email_accounts` (v11) | v13+ |
| 12 | `topics/12_PIPELINE.md` | Оркестрация `tasks`, `allowAutoSwitch`, стадии; опирается на 08 | v13+ |

## Handoff (кросс-направленческое)

| Файл | Роль |
|---|---|
| `handoff/architecture.md` | Накопительная история принципов (старое не удаляется) |
| `handoff/done.md` | «Сделано / НЕ откатывать» |
| `handoff/next-steps.md` | «Приоритет на сессию» (ссылается на topics) |
| `handoff/handoff-system.md` | Проблемы handoff-механизма (TD9, П2) |

## Legacy (DEPRECATED, читать не надо)

| Файл | Заменён на |
|---|---|
| `handoff/roadmap.md` | `topics/*.md` + `handoff/next-steps.md` |
| `handoff/problems.md` | `topics/*.md` (П1-П11 распределены) |
| `handoff/techdebt.md` | `topics/*.md` (TD6-TD15 распределены) |

Помечены DEPRECATED в Фазе C.3. Физически остаются 1–2 сессии (откат).

## Карта файлов (ключевое)

| Что | Где |
|---|---|
| Окно | `src/main/windows/gatewayWindow.ts` |
| IPC | `src/main/ipcHandlers/gatewayHandlers.ts` |
| Сервисы | `src/main/services/gateway/` |
| Providers | `gateway/providers/{types,registry}.ts`, `deepseek/adapter.ts` |
| Pool | `gateway/pool/BrowserPool.ts` |
| DeepSeek | `gateway/deepseekService.ts` |
| Handoff Б | `gateway/handoffBuilder.ts` |
| Handoff А | `gateway/contextBuilder.ts` |
| cookieTracker | `gateway/cookieTracker.ts` |
| Селекторы | `gateway/SelectorProfileService.ts` |
| Cache/DB | `gateway/cache/{db,schema}.ts`, `cache/migrations/` |
| UI | `src/components/GATEWAY/` |

## БД gateway.db (v9, 24 таблицы)

| Группа | Таблицы |
|---|---|
| Диалоги | `conversations`, `messages` + 5 FTS |
| Файлы | `file_blobs`, `message_files`, `resources`, `resource_versions` |
| Агенты (схема, не используется) | `agents`, `pipeline_definitions`, `pipeline_runs`, `pipeline_step_runs`, `async_tasks`, `tool_calls`, `sandboxes`, `tool_registry_snapshot` |
| Контекст L0–L4 | `context_nodes`, `context_versions`, `context_workspaces` |
| Задачи | `tasks` |

## Стандарт структуры

Все модули — по `docs/prompts/_common/HANDOFF_STRUCTURE.md`. При добавлении topics, handoff, intent — сверяться с ним.

## Приоритет на сессию

См. `handoff/next-steps.md`.