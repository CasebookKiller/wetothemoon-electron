# PROJECT_STATE — Gateway

> Обновлено: 2026-11-21 #2
> Снимок цифр/статуса на дату. Обновлять при переключении сессии.

## БД gateway.db (v9, 24 таблицы)

| Группа | Таблицы | Статус |
|---|---|---|
| Диалоги | `conversations`, `messages` + 5 FTS | ✅ работает |
| Файлы | `file_blobs`, `message_files`, `resources`, `resource_versions` | 🟡 частично |
| Агенты | `agents`, `pipeline_*`, `async_tasks`, `tool_calls`, `sandboxes`, `tool_registry_snapshot` | 🔴 схема есть, не используется |
| Контекст | `context_nodes` (14), `context_versions` (20), `context_workspaces` | ✅ работает |
| Задачи | `tasks` | ✅ работает |

**Ключевое:** БД готова к Agents-режиму (таблицы есть), реализации нет. Это подтверждает цель — «автоматизация: ставить / контролировать / исполнять / проверять».

## Counts (заполнить командой ниже)

```
conversations:      TBD
messages:           TBD
context_nodes:      14
context_versions:   20
context_workspaces: TBD
tasks:              TBD
agents:             0
async_tasks:        TBD
pipeline_runs:      TBD
tool_calls:         TBD
```

**Команда для заполнения:**
```bash
sqlite3 ~/.config/wetothemoon-electron/gateway.db "
  SELECT 'conversations', COUNT(*) FROM conversations
  UNION ALL SELECT 'messages', COUNT(*) FROM messages
  UNION ALL SELECT 'context_nodes', COUNT(*) FROM context_nodes
  UNION ALL SELECT 'context_versions', COUNT(*) FROM context_versions
  UNION ALL SELECT 'context_workspaces', COUNT(*) FROM context_workspaces
  UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
  UNION ALL SELECT 'agents', COUNT(*) FROM agents
  UNION ALL SELECT 'async_tasks', COUNT(*) FROM async_tasks
  UNION ALL SELECT 'pipeline_runs', COUNT(*) FROM pipeline_runs
  UNION ALL SELECT 'tool_calls', COUNT(*) FROM tool_calls;
"
```

## Провайдеры

| Провайдер | Статус | Транспорт |
|---|---|---|
| DeepSeek | 🟢 активен | patchright + Chrome |
| GigaChat | 🟡 recon | patchright + Chrome, профиль `p_mwnqhvvi_rm0d` |
| Alice | 🔴 план | ? |
| Duck.ai | ⚫ исключён | не работает в РФ (TD10) |
| g4f.dev / LLM7.io / Pollinations | ⚪ альтернативы | API, без логина |

## Что работает

- `ProviderAdapter` / `registry` / `DeepSeekAdapter`-скелет / `BrowserPool` (созданы, `b832aae`)
- Handoff-кнопка + per-module dropdown + 16 секций (`handoffBuilder.ts`)
- «Экспорт продолжения» + `contextBuilder.ts` (Путь А)
- Context chain (14 узлов, 20 версий)
- cookieTracker (снимок куки по профилю)
- Handoff `kindLimit` (module 2500, submodule 2000, project 1500, global 1000, direction 800)
- `readModuleRoot` + `module-root` scope в intent (2026-11-20, `be84ecb`)
- **Rate-limit UX (2026-11-21 #2):** бейдж `⏸ до HH:MM` в диалоге профилей, кнопка «Запустить» янтарная и кликабельна (для просмотра/копирования сообщений), ban → disabled. Real-time через `onGatewayBridgeEvent` + тикер 30 сек
- **Switch без auto-launch (2026-11-21 #1):** `switchProfile(id, {launch:false})`, `gateway:profiles-activate(id, opts)`, кнопка «Запустить»/«Войти» отдельно от клика по строке

## Что сломано / не сделано

- **П1a:** частично смягчено (2026-11-21 #1): switch без auto-launch, браузер не рвётся. Архитектурная задача (BrowserPool) — открыта.
- **П1b:** пустой список диалогов у новых профилей (нужен recon-скрипт)
- **П2:** `global block present: false` в тесте
- **П3:** submodule bump после каждого коммита (ручной)
- **П4:** нет IP-изоляции (5 браузеров с 1 IP = ускоренный бан)
- **П5:** детект усложняется (DeepSeek спросил возраст 2026-11-19)
- **П6:** GigaChat анонимно = `app-boot-error` (WAF)
- **П7:** Chrome занят старым диалогом (single-instance lock)
- **TD6–TD15** (распределены по topics)
- **Agents-режим:** не начат (БД готова)
- **Event bus** между окнами: не начат
- **Объединение Путей А и Б handoff:** в roadmap
- **Перенос кнопки handoff из TopControlPanel в диалог профилей:** в roadmap

## Схема gateway.db

`user_version = 9`, миграции v1–v9. Схема — `src/main/services/gateway/cache/schema.ts`, миграции — `cache/migrations/v*.ts`.

## Дата

2026-11-21 #2. Следующая проверка — при переключении сессии или крупном изменении.