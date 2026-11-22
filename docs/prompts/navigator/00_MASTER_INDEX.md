# 00_MASTER_INDEX — Navigator

> Универсальный Browser Hub. Gateway — legacy (DeepSeek-only), не трогаем до закрытия Navigator MVP.
> Стандарт структуры — `docs/prompts/_common/HANDOFF_STRUCTURE.md`.

## С чего начать

| Файл | Роль | Когда |
|---|---|---|
| `COMMON_CONTEXT.md` | «Always-on»: цель, 7 слоёв, 7 решений, JSON-протокол, стек | Всегда (первым) |
| `PROJECT_STATE.md` | Снимок статуса слоёв, цифры | Всегда (вторым) — создать позже |
| `summary.md` | Короткий overview для manifest | Автоматически — создать позже |
| `topics/<NN>.md` | Текущая задача направления | 1–2 файла |

## Topics

| # | Файл | О чём | Статус |
|---|---|---|---|
| 01 | `topics/01_ARCHITECTURE.md` | 7 слоёв, паттерн окна, регистрация модуля | ✅ создан |
| 02 | `topics/02_BROWSER_POOL.md` | Ссылка на `gateway/topics/02_BROWSER_POOL.md` (переиспользуем) | Этап 2 |
| 03 | `topics/03_TOOLS.md` | LlmProviderAdapter / SiteAdapter / UtilityTool, контракты | ✅ создан |
| 04 | `topics/04_JSON_PROTOCOL.md` | Единый `{tool, action, params}`, IPC-контракт | ✅ создан |
| 05 | `topics/05_MEMORY.md` | Долговременная память (обобщение GatewayCacheService) | Этап 2 |
| 06 | `topics/06_PIPELINE.md` | JSON-шаги, оркестратор | Этап 3 |
| 07 | `topics/07_UI.md` | Окно, sidebar, chat, стили | Этап 1 |

## Handoff

| Файл | Роль |
|---|---|
| `handoff/architecture.md` | Накопительная история принципов |
| `handoff/done.md` | «Сделано / НЕ откатывать» |
| `handoff/next-steps.md` | Приоритет на сессию |
| `handoff/problems.md` | Активные проблемы |

## Legacy (Gateway)

| Файл | Статус |
|---|---|
| `docs/prompts/gateway/**` | ✅ рабочий, не трогаем |
| `src/pages/GatewayPage/GatewayPage.tsx` | ✅ 2908 строк, не трогаем |
| `src/components/GATEWAY/TopControlPanel/` | ✅ не трогаем |

## Карта файлов (Этап 1)

| Что | Где |
|---|---|
| Окно | `src/main/windows/navigatorWindow.ts` |
| IPC | `src/main/ipcHandlers/navigatorHandlers.ts` (`navigator:*`) |
| Сервисы | `src/main/services/navigator/{toolRegistry,llmTool,sessionManager}.ts` |
| UI | `src/pages/NAVIGATOR/{NavigatorPage,NavigatorSidebar,NavigatorChat}.tsx` |
| Preload | `electronAPI.navigator.*` |
| Route | `#/navigator` |
| Меню | `navigatorWindowMenuTemplate` в `windowMenus.ts` |
| Кнопка | `ButtonsWindows.tsx` (Dashboard) |

## Переиспользуем из Gateway (без изменений)

- `ProfileService` (+ `hasSession` provider-aware)
- `BrowserPool` v2 (вариант A)
- `GigaChatAdapter` v0
- `gateway:launch-by-profile`
- `gateway:list-providers`
- `onGatewayBridgeEvent` (preload)

## Не трогаем

- `GatewayPage.tsx`, `TopControlPanel.tsx`, `GatewayAccountsDialog.tsx`
- `deepseekService.ts`
- `gatewaySendMessage` / `gatewaySendMessageWithFiles`

## Стандарт

`docs/prompts/_common/HANDOFF_STRUCTURE.md`.