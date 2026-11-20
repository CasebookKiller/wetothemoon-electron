# 03 — Recon (разведка провайдеров)

> Направление: разведка новых бесплатных LLM + отрицательные результаты.
> Связано: `01_PROVIDERS.md` (адаптеры), `02_BROWSER_POOL.md` (профили).

## Зачем

Цель Gateway (принцип 0): **сохранить бесплатный доступ к LLM**. Каждый провайдер может ввести ограничения. Recon — понять, что работает, где WAF, где send button, где стриминг.

## GigaChat recon (второй инстанс, 2026-11-19)

### Что известно
- URL: `https://giga.chat`
- Title: «ГигаЧат — русскоязычная нейросеть от Сбера»
- Input: `textarea#chat-input-textarea`, aria-label «Сообщение», placeholder «Спросите ГигаЧат»
- Send: ❌ **не найден** (только `Suggests-*` — кнопки-подсказки)
- Streaming: ❌ не пойман
- Challenge: `aws-waf-token` (WAF), captcha в HTML нет
- Cookies: 42 паттерна, ключ сессии `_sm_sess` (+ `_sm_user_id`, `_sd_user_id`)
- Анонимно: `app-boot-error` (SPA не грузится без сессии)
- API: `https://api.giga.chat/v1` (OpenAI-совместимый, OAuth)
- Обход: Enter-to-send (гипотеза, требует проверки)

### Профиль
- id: `p_mwnqhvvi_rm0d`, name: `GigaChat 1`, browserKind: `chrome`
- dir: `~/.config/wetothemoon-electron/profiles/p_mwnqhvvi_rm0d/chrome-profile`
- cdpPort: 9325, chromeCdpPort: 9425

### Что делать (следующая сессия)
1. Проверить гипотезу Enter-to-send (2 минуты в живом профиле).
2. Recon сайдбара (для getConversations).
3. Если профиль занят — создать `gigachat-2` через `ProfileService.create({name: 'GigaChat 2', browserKind: 'chrome'})`, залогиниться параллельно.
4. После успешного recon — `GigaChatAdapter` v0 (по образцу `deepseek/adapter.ts`).

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

## TD6 — GigaChat recon stream

Recon streaming отложен, send button не найден. Профиль был занят (П7).

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