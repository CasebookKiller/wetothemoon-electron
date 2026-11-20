# С чего начать новый чат

> ⚠️ **Формат правок:** все изменения предлагай в стиле «найти → заменить»
> (два блока: что найти, на что заменить). Не давай diff, не давай «весь файл
> заново», не давай «вставь после строки N» — только find/replace.

1. `cd ~/Документы/GitHub/wetothemoon-project/wetothemoon-electron && node scripts/preflight-check.mjs` — 10 сек.
2. Прочитать handoff (`.md`).
3. Если HEAD ушёл вперёд — `git log --oneline -10` покажет diff.
4. `git status --short` — что не закоммичено.
5. Приоритет: см. ниже «Приоритет на сессию», первые 2 пункта.

## Приоритет на сессию (2 часа)

> **Browser-канал приоритетнее API.** См. `COMMON_CONTEXT.md` §«Цель» (принцип 0).

### Приоритет 1 — browser-канал (сейчас)

1. **GigaChat recon send button** — гипотеза Enter-to-send, 2 минуты в живом профиле. Если профиль занят (П7) — создать `gigachat-2` через `ProfileService.create({name: 'GigaChat 2', browserKind: 'chrome'})`.
2. **`GigaChatAdapter` v0** — после recon, по образцу `deepseek/adapter.ts`. Input `#chat-input-textarea`, Enter-to-send, cookie `_sm_sess`.
3. **Recon П1b** — пустой сайдбар у новых профилей. Скрипт `scripts/recon-empty-sidebar.mjs` (см. `topics/02_BROWSER_POOL.md`).
4. **`AlisaAdapter` v0** — после GigaChat. `alice.yandex.ru` (проверить, чат ли), Yandex ID.

### Приоритет 2 — завершить миграцию на topics/

1. **Фаза B.10:** `handoff/architecture.md` + принцип 0 (цель) + принцип 16 (Agent-роли, открытый список).
2. **Фаза B.11:** `handoff/done.md` + строки из v9.
3. **Фаза C** — переключение на `structure: 'topics'` (см. `handoff-system.md`).
4. **Фаза D** — prana-bindu (та же схема).

### Приоритет 3 — потом

- **API-канал** — второй приоритет, постепенно (`topics/05_API_CHANNEL.md`).
- **`cookieTracker` + fingerprint** — canvas, WebGL, timezone, fonts (П5).
- **IP-изоляция** — прокси/VPN per-profile (П4, TD13).
- **Event bus** между окнами (принцип 6).
- **Объединение Путей А и Б handoff** (см. `handoff-system.md`).
- **Перенос кнопки handoff** из `TopControlPanel` в диалог профилей + чекбоксы topics (см. `topics/04_UI.md`).
- **Agents-режим** — БД готова, реализации нет (`topics/05_API_CHANNEL.md`).

## Что НЕ делаем сейчас

- Duck.ai (TD10, РФ).
- `deepseek-harness` (жрёт токены, отложено).
- `tokenCounter` (отложен до закрытия browser-канала).
- Переключение `deepseekService.ts` на адаптер (после BrowserPool).

## Открытые вопросы

1. **П1a — A/B/C?** (N процессов / CDP attach / N BrowserContext). Влияет на RAM и single-instance lock (`topics/02_BROWSER_POOL.md`).
2. **IP-изоляция:** прокси / VPN / один IP?
3. **Перенос кнопки handoff** — куда именно (`GatewayProfileSwitcher` или новый диалог)?
4. **Объединение Путей А и Б** — оставить один или два?