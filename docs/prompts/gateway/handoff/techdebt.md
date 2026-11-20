> ⚠️ **DEPRECATED (2026-11-20).** См. `topics/*.md` и `handoff/handoff-system.md`. Файл оставлен для отката на 1–2 сессии.

# Техдолг — Gateway

## Открытый

### TD1. `scripts/test-context-service.mjs` — временный
**Проблема:** лежит в `scripts/`, не CI, но полезен для регрессии.
**Статус:** оставить, запускать вручную после правок `contextService.ts`.
**Приоритет:** низкий.

### TD3. `handoffBuilder.ts` — `exec` с таймаутом
**Проблема:** `sh(..., 60_000)` для preflight. Если preflight замедлится — таймаут сработает посередине.
**Фикс:** `--fast` в preflight (уже добавлен) + мониторить.
**Приоритет:** низкий.

### TD4. П1 — диалог пропадает при переключении профиля
**Файл:** `GatewayPage.tsx:1183`
**Проблема:** `gateway:get-conversations` → live из Chrome, не из кэша. При switch — пустой список.
**Фикс B:** сайдбар из `cache.listConversations()` без фильтра + бейдж профиля.
**Приоритет:** средний (UX).

### TD5. П2 — `global block present: false` в тесте
**Проблема:** тест искал `<context key="global">`, формат тега в промпте другой.
**Статус:** не блокер, `source: db` работает.
**Приоритет:** низкий (диагностика).

## Закрытый

- ✅ `.bak` файлы — удалены (2026-11-18, коммит `45ba5e9`)
- ✅ `GatewayProfileSwitcher` — удалён (коммит `45ba5e9`)
- ✅ `sync-submodule.sh` — создан (Handoff v6)
- ✅ Handoff-кнопка — async export, loading state, intent-секции
- ✅ `/tmp/test-cont-source.mjs` — перенесён в `scripts/test-cont-source.mjs` (коммит `086254b`)
- ✅ `deepseek_cookies.json` / `.env.local.bak-*` — в `.gitignore`, физически удалить (не в git)