# 03 — Recon (разведка провайдеров)

> Направление: разведка новых бесплатных LLM + отрицательные результаты.
> Связано: `01_PROVIDERS.md` (адаптеры), `02_BROWSER_POOL.md` (профили).

## Зачем

Цель Gateway (принцип 0): **сохранить бесплатный доступ к LLM**. Каждый провайдер может ввести ограничения. Recon — понять, что работает, где WAF, где send button, где стриминг.

Заменить:
## GigaChat recon (закрыт 2026-11-21)

### Селекторы
- URL: `https://giga.chat`
- Title: «ГигаЧат — русскоязычная нейросеть от Сбера»
- input: `#chat-input-textarea` (aria-label «Сообщение», placeholder «Спросите ГигаЧат»)
- send: `button[aria-label="Отправить"]` — появляется **после fill**, type="submit"; fallback — Enter
- response/streaming: `[class*="MessageItem-styled__AssistantContent"]`
- threads: `a[href^="/sessions/"]`, id в `data-da_session_id`
- Challenge: `aws-waf-token` (WAF), captcha в HTML нет
- Cookies: `_sm_sess` (critical), `_sm_user_id` (critical), `_sd_user_id` (warning), `aws-waf-token` (fingerprint)
- Анонимно: `app-boot-error` (SPA не грузится без сессии)
- API: `https://api.giga.chat/v1` (OpenAI-совместимый, OAuth)

### Стрим (reset-механика)
- GigaChat сначала показывает «Думаю над ответом» → потом заменяет на реальный ответ.
- `THINKING_PREFIXES = ['Думаю над ответом', 'Думаю…', 'Thinking']` — отбрасываются.
- Если префикс сохранился → delta (append), `MessageChunk { type: 'text', text: delta }`.
- Если текст заменён целиком → `MessageChunk { type: 'text', text: next, reset: true }`.
- `stableTicks >= 10 × 300ms = 3s` → `done`.
- Enter-to-send работает (fallback).

### Профиль
- id: `p_mwnqhvvi_rm0d`, name: `GigaChat 1`, browserKind: `chrome`
- dir: `~/.config/wetothemoon-electron/profiles/p_mwnqhvvi_rm0d/chrome-profile`
- cdpPort: 9325, chromeCdpPort: 9425
- **`gigachat-2` не нужен** — первый профиль работает.

### Сделано
- `GigaChatAdapter v0` — connect / isLoggedIn / sendMessage (reset-стрим) / getConversations.
- Recon-скрипты: `scripts/mjs/recon-gigachat-adapter-test.mjs`, `scripts/mjs/recon-gigachat-conversations.mjs`.
- См. `done.md` (2026-11-21 вечер), Handoff v12.

## Alice recon (план)

- URL: `alice.yandex.ru` (проверить, чат или голосовой ассистент). Возможно `ya.ru/ai`.
- Auth: Yandex ID.
- Статус: не начат. После GigaChat.

## Duck.ai — исключён (TD10)

**Симптом:** `recon-free-llms.mjs` показал 200, но `recon-duck-smoke.mjs` (patchright + Chrome) — страница не грузится из РФ (geoblock). Ложный 200 в probe — редирект на «недоступно».

**Решение:** не тратить время.

**Альтернативы без логина:** g4f.dev (200), LLM7.io (API), Pollinations (API).

## deepseek-harness — не используем (отложено)

**Симптом:** жрёт токены, не даёт нужного результата.

**Решение:** изучить на будущее (может, с другими настройками), **не используем сейчас**. Не возвращаться без явного решения.

## TD6 — GigaChat recon stream (закрыт)

Send-кнопка найдена (`button[aria-label="Отправить"]`, после fill), стрим снят (reset-механика). См. секцию GigaChat recon выше.

## TD14 — recon-duck-smoke упал

`recon-duck-smoke.mjs` упал на отсутствии Chromium. Фикс: `channel: 'chrome'` (не проверен). Duck.ai не актуален (TD10).

## П6 — GigaChat анонимно

`giga.chat` без сессии → `app-boot-error`. SPA требует сессию, WAF `aws-waf-token`. Pre-auth recon невозможен. Только с залогиненным профилем.

## Инструменты recon (scripts/)

| Скрипт | Что |
|---|---|
| `recon-free-llms.mjs` | probe + discover + filter бесплатных LLM |
| `recon-filter-discovered.mjs` | фильтрация найденных кандидатов |
| `recon-duck-smoke.mjs` | smoke-тест Duck.ai (упал, TD14) |
| `recon-dump-dom.mjs` | `--provider`, `--profile`, `--anon`, `--stream` — dump DOM |
| `recon-login-llms.mjs` | session-провайдеры, ручной логин |
| `recon-input-area.mjs` | поиск input-area |
| `recon-attach-test.mjs` | тест attach к Chrome |
| `recon-patchright-smoke.mjs` | smoke patchright |
| `recon-profile-menu*.mjs` | профиль-меню (5 версий) |
| `recon-send-files-test.mjs` | отправка файлов |
| `recon-stream-formatting.mjs` | форматирование стрима |
| `recon-web-sources*.mjs` | web-источники |

**Внимание (TD9):** `recon-*.mjs` под `.gitignore` — при checkout потеряются. Коммитить с `git add -f` (уже сделано в `b6485c2`).

## Открытые вопросы

1. **Enter-to-send в GigaChat** — работает? (Проверить первым делом.)
2. **Alice** — это чат или голосовой ассистент? (Открыть, проверить.)
3. **deepseek-harness** — есть ли смысл вернуться с другими настройками? (Отложить до стабилизации browser-канала.)