# wetothemoon-electron — краткое summary

## Роль
Многомодульное Electron-приложение. Каждый модуль — отдельное окно `BrowserWindow` со своим маршрутом и сервисами.

## Модули (окна)

| Модуль | Окно | Роль |
|---|---|---|
| Gateway | `gatewayWindow.ts` | Обёртка вокруг DeepSeek (CDP + API) |
| Prana-Bindu | `pranaBinduWindow.ts` | Fitness + AI-тренер (Zepp, Strava, Melange DB) |
| Fremen Eye (OSINT) | `osintWindow.ts` | Скрейпинг rusprofile / kad.arbitr / mos-gorsud |
| Sietch | — (сервис) | SQLite-хранилище OSINT |
| Landsraad | `landsraadWindow.ts` | Учёт судебных дел поверх Sietch |
| Trading Assistant | `tradingAssistantWindow.ts` | T-Bank, облигации, автотрейдер |
| Bonds | `bondsWindow.ts` | Облигации, потоки MarketData |
| Tasks | `tasksWindow.ts` | Cron-планировщик |
| AI Chat | `aiWindow.ts` | Чат с LLM + fine-tune |
| Ollama | `ollamaWindow.ts` | Локальный чат через Ollama |

## Стек
- Electron 44 + Forge + Vite + TypeScript.
- React 19 + PrimeReact 10.
- SQLite (`node:sqlite`) — `gateway.db`, `prana_bindu.db`, `osint_data.db`.
- Playwright + patchright — браузерная автоматизация.
- DeepSeek API + Web (CDP) — brain.

## Архитектура
- Окна — `src/main/windows/*.ts`.
- IPC — `src/main/ipcHandlers/*.ts`, префиксы по модулям (`gateway:*`, `pb:*`, `osint:*`).
- Сервисы — `src/main/services/<module>/`.
- React — `src/pages/`, `src/components/`.
- Preload — единый `src/preload.ts`, API разбит по `electronAPI.<module>.*`.

## Ключевые данные
- `~/.config/wetothemoon-electron/gateway.db` — диалоги Gateway + usage.
- `~/.config/wetothemoon-electron/prana_bindu.db` — тренировки.
- `~/.config/wetothemoon-electron/osint_data.db` — OSINT.
- `~/.config/wetothemoon-electron/profiles/<id>/` — профили браузера.

## Правила работы
- `src/main/services/pranaBindu/` не импортирует Electron.
- `safeStorage` — только в handler.
- UI-тексты — на русском.
- После логического шага — git commit.

## Что НЕ входит
- PWA-версии (Live-журнал — отдельный проект).
- Мобильная версия.
