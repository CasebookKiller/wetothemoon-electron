# Roadmap

## Ближайшие (2 часа) — приоритет browser-канал, не API

> **Не ждём API.** API-канал (`tokenCounter.ts`) — **отложен** (fallback, не развиваем). Приоритет — **браузерный** канал: параллельность, recon, cookie.

1. **`ProviderAdapter` + `BrowserPool`** — фундамент под N провайдеров и N профилей (1 час). Файлы: `src/main/services/gateway/providers/{types,registry}.ts`, `src/main/services/gateway/pool/{BrowserPool,TaskQueue,ProfileRouter}.ts`. Выжимка интерфейсов — см. `architecture.md` §«Browser-канал».
2. **Recon провайдеров** (1 час) — по порядку: Duck.ai (без логина) → g4f.dev (агрегатор, без логина) → GigaChat (SberID) → Алиса (Yandex ID) → HuggingChat (HF). Для каждого: selectors, cookiePatterns, adapter. Скрипты `scripts/recon-free-llms.*` уже в git.
3. **Cookie tracker** — расширить `cookieTracker.ts` (197 строк): добавить `fingerprint` (canvas, WebGL, timezone, fonts). Цель — **понять, как нас палят** (DeepSeek спросил возраст). 

## Следующие сессии
3. Event bus между окнами (1 час)
4. UI-кнопка «📋 Экспорт продолжения» в GatewayChatHeader (20 мин)
5. UI-индикатор web/api в TopControlPanel (20 мин)
6. Watcher на .md через fs.watch → syncManifestToDb (20 мин)
7. П1 (вариант B): сайдбар из cache.listConversations() без фильтра (30 мин)
8. preflight-check.mjs --json (10 мин)

## tokenCounter — ОТЛОЖЕНО (приоритет browser-канал, не API)

> Не начинать, пока не закрыты BrowserPool + recon + cookie. Ответы на 4 вопроса — на будущее.

1. **Блокировать или предупреждать?** → предупреждать (console + UI badge `⚠️ 90% бюджета`), не блокировать. Решает пользователь.
2. **Input или резерв output?** → input + `max_tokens` (эвристика `input × 1.2`). `usage.prompt_tokens` из SSE — для калибровки.
3. **Бюджет в чём?** → токены (основное), USD (через `estimateCost`), запросы/день (rate limit).
4. **Tokenizer?** → начать с `Math.ceil(text.length / 3.5)` (русский/английский). Точный — если калибровка по `usage` покажет погрешность >10%.

## Что НЕ делаем сейчас