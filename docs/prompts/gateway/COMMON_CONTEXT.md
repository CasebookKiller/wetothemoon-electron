# Gateway — общий контекст модуля

> Версия: 1 (2026-11-20). «Always-on» дистиллят. Отправляется в контекст всегда.
> Для истории принципов — `handoff/architecture.md` (накопительная).
> Для навигации по темам — `00_MASTER_INDEX.md`.

## Что это

Модуль автономного использования LLM в `wetothemoon-electron`.
Три режима: **Web-чат** (browser, patchright + Chrome stealth) — первичный,
**API-чат** (DeepSeek API и др.) — второй приоритет,
**Agents** (автономное исполнение) — в планах, БД готова.

Окно: `#/gateway`. IPC: `gateway:*`. БД: `gateway.db` (v9, 24 таблицы).

## 🎯 Цель (принцип 0)

**Продолжать использовать бесплатные LLM** для задач приложения, несмотря на
ограничения компаний-владельцев (баны, капчи, WAF, лимиты).

**Конечная цель — полная автоматизация:** приложение само ставит задачи,
контролирует исполнение и исполняет их, используя браузерные версии чатов
с LLM как «мозг».

**Стратегия (сейчас → потом):**
1. **Сейчас:** браузерные версии бесплатных LLM (DeepSeek, GigaChat, Alice,
   альтернативы без логина) через patchright + Chrome stealth. Browser — первичный.
2. **Постепенно:** прямое подключение к API там, где оправдано (стабильность
   важнее экономии) — по одному провайдеру, по мере готовности.
3. **Потом (когда позволит):** официальные API, облачное размещение бесплатных
   моделей, обновление железа.
4. **Пока — сохранить всё бесплатное.**

**Что НЕ подошло:** `deepseek-harness` — жрёт токены, не даёт результата.
Изучить на будущее, **не используем сейчас**, не возвращаться без явного решения.

**Следствие для архитектуры:** Browser > API (принцип 2), ProviderAdapter —
единый интерфейс (принцип 12), BrowserPool — N параллельных сессий (принцип 13),
изоляция каналов API ↔ web (принцип 5).

## 🏛 Архитектурные принципы (не нарушать)

1. Три режима: Web / API / Agents.
2. **Browser-канал > API**: browser первичный, API — второй приоритет.
3. **Workspace per conversation (вариант C):** в каждом чате свой набор active directions.
4. **Мозг ≠ один:** DeepSeek API — оркестратор, Ollama — тренируемые модели, GigaChat/Alice — дополнительные web-провайдеры.
5. **Изоляция каналов:** при работе над API-каналом web не трогаем. И наоборот.
6. **Двусторонняя связь окон** (event bus) — обязательна.
7. **Долговременная память:** global → project → submodule → module → direction + state. Версионирование через `context_versions`, привязка к git commit.
8. **`key.split('/').length` = уровень** (L0→L4). Не менять.
9. **`tasks.context_key` БЕЗ FK** — при переименовании direction задачи не теряются.
10. **`kind`, `status`, `priority` — TEXT, не enum** — новые значения без миграции.
11. **Правки — только «найти → заменить»** (два блока). Не diff, не «весь файл заново».
12. **`ProviderAdapter` — единый интерфейс** для всех browser-провайдеров. Не хардкодить DeepSeek.
13. **`BrowserPool` — N BrowserContext**, каждый = изолированная сессия. Никакого глобального стейта.
14. **Адаптеры не импортируют Electron** (только `playwright-core`). `safeStorage` — только в handler.
15. **patchright — форк Playwright.** Не заменять на upstream без проверки stealth-детекта.
16. **Agent — многоролевая модель:** генерировать задачи / контролировать исполнение / исполнять / проверять здоровье проекта / + другие. **Список открыт** — по мере развития появятся арбитр, планировщик, ревьюер и т.д. Не хардкодим.

## ⏱ Паттерн бана DeepSeek

Разбан ~20:00 → работа до ~22:00 → снова бан. **Планируй на 2 часа.**

В конце каждой сессии обязательно:
1. `wm-backup`
2. bump submodule (`bash scripts/sync-submodule.sh`)
3. `git push origin main` (submodule + parent)

## 🔌 Провайдеры

| Провайдер | Статус | Транспорт | Ключевое |
|---|---|---|---|
| **DeepSeek** | 🟢 активен | patchright + Chrome | CDP, `ds_session_id`, П1a (Chrome закрывается при switch) |
| **GigaChat** | 🟡 recon | patchright + Chrome | `giga.chat`, `_sm_sess`, WAF `aws-waf-token`, send button не найден |
| **Alice** | 🔴 план | ? | `alice.yandex.ru` (проверить, чат ли), Yandex ID |
| **Duck.ai** | ⚫ исключён | — | не работает в РФ (TD10) |
| **g4f.dev / LLM7.io / Pollinations** | ⚪ альтернативы | API | без логина |

Детали — `topics/01_PROVIDERS.md`, `topics/03_RECON.md`.

## 🏷 Внутренние имена

| Имя | Роль |
|---|---|
| `ProviderAdapter` | единый интерфейс для browser-провайдеров: `connect`, `sendMessage` (AsyncIterable), `getConversations`, `cookiePatterns`, `selectors` |
| `BrowserPool` | N BrowserContext, `acquire/release/parallel` |
| `ProfileService` | создание/хранение профилей (`browserProfileDir`, `create`, `browserKind`) |
| `handoffBuilder` | генерация .md по кнопке (16 секций) |
| `contextBuilder` | Путь А: manifest + workspaceKeys (второй) |
| `MODULE_MAP` | карта модулей для dropdown (`gateway`, `prana-bindu`, `osint`, `sietch`) |
| `readPrompt` / `readModuleRoot` | чтение intent-файлов (handoff/ и корень модуля) |

## 🌐 Профили браузера

- **id:** `p_<hash>` (напр. `p_mwnqhvvi_rm0d`)
- **dir:** `~/.config/wetothemoon-electron/profiles/<id>/chrome-profile`
- **`browserKind`:** `chrome` | `yandex`
- **`cdpPort`** (внутренний) + **`chromeCdpPort`** (внешний CDP)
- **`ProfileService.browserProfileDir(p)`** — универсальная папка (`ProfileService.ts:129`)
- **`ProfileService.create({name, browserKind?})`** — создание (`ProfileService.ts:225`)
- **single-instance lock:** профиль держит один Chrome, второй attach невозможен.

## ⚙️ Механика запуска (как у DeepSeek)

- `patchrightChromium.launchPersistentContext(profileDir, {channel:'chrome'})` — запуск (`deepseekService.ts:387`)
- `ctx.storageState()` — персистентность (`deepseekService.ts:413`, `:494`)
- `safeStorage.encryptString` — только в handler.

## 🧰 Стек

- Electron 44 + React 19 + PrimeReact 10.
- **patchright** (форк Playwright) + `playwright-core` — браузер.
- `node:sqlite` (`gateway.db`) — диалоги, контекст, задачи, агенты (схема).
- `safeStorage` — шифрование секретов.
- Fetch API — DeepSeek API (fallback).

## 🔗 Интеграция

- **Окно:** `src/main/windows/gatewayWindow.ts` → `#/gateway`
- **IPC:** `gateway:*` (`src/main/ipcHandlers/gatewayHandlers.ts`)
- **Сервисы:** `src/main/services/gateway/` (`providers/`, `pool/`, `cookieTracker.ts`, `handoffBuilder.ts`, `contextBuilder.ts`, `cache/`)
- **Компоненты:** `src/components/GATEWAY/` (`TopControlPanel`, `GatewayChatHeader`, `GatewaySidebar`)
- **Preload:** `electronAPI.gateway.*`

## 🗺 Карта файлов (ключевое)

| Что | Где |
|---|---|
| Окно | `gatewayWindow.ts` |
| Сервисы | `src/main/services/gateway/` |
| Providers | `gateway/providers/{types,registry}.ts`, `deepseek/adapter.ts` |
| Pool | `gateway/pool/BrowserPool.ts` |
| DeepSeek (текущий) | `gateway/deepseekService.ts` |
| Handoff (Б) | `gateway/handoffBuilder.ts` |
| Context (А) | `gateway/contextBuilder.ts` |
| cookieTracker | `gateway/cookieTracker.ts` |
| Селекторы | `gateway/SelectorProfileService.ts` |
| Cache/DB | `gateway/cache/db.ts`, `cache/schema.ts`, `cache/migrations/` |

## 📋 Правила работы

- **Формат правок** — find/replace (два блока). Не diff.
- **git commit** по группам, **никогда `git add .`**.
- `.bak-*` не коммитить. `docs/` не коммитить (кроме `docs/prompts/`).
- `.env.local` — ключи не в чат.
- `npm run dev`, не `npm start`.
- **patchright — не заменять** на upstream.
- **Изоляция каналов** API ↔ web.
- **`profileId` везде** (IPC, bridge, БД, API).

## 🚫 Что НЕ входит

- `tokenCounter` (API-бюджет) — отложен до закрытия browser-канала.
- Duck.ai — исключён (TD10, РФ).
- Agents-режим — не начат (БД готова, реализации нет).
- Объединение Пути А и Пути Б handoff — в roadmap «Следующие сессии».
- Перенос кнопки handoff из `TopControlPanel` в диалог профилей — в roadmap.

## 🔄 Как обновлять этот файл

**Редко** — только когда меняется «always-on» контекст: цель, принципы, провайдеры (новый/выбыл), стек, механика. Конкретные задачи — в `topics/*.md`. История принципов — в `handoff/architecture.md`.