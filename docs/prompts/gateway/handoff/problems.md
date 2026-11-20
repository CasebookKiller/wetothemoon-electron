> ⚠️ **DEPRECATED (2026-11-20).** См. `topics/*.md` и `handoff/handoff-system.md`. Файл оставлен для отката на 1–2 сессии.

# Известные проблемы

## П1. Диалог пропадает при переключении профиля
`gateway:get-conversations` → live из Chrome → при switch пустой.
Фикс B: сайдбар из кэша + бейдж профиля.

## П2. global block present: false в тесте
Формат тега в промпте не `<context key="global">`. Не блокер.

## П3. Submodule bump
После каждого коммита в submodule — bump в родителе. Скрипт `scripts/sync-submodule.sh`.

## П4. IP-изоляция при параллельных браузерах (новая)

**Симптом:** N браузеров с одного IP → DeepSeek видит N заходов с одного адреса → **бан ускоряется**, противоречит цели «maximize в окно».

**Решение (обсуждается):** прокси per-profile (SOCKS5) / VPN per-profile / один IP (готовы к быстрому бану).

**Статус:** открытый вопрос, в `architecture.md` §«Browser-канал > API», п.2.

## П5. Алгоритмы блокировок усложняются (новая)

**Симптом:** DeepSeek **спросил возраст** (2026-11-19). Значит, детект — не только по IP/кукам, но и по **поведению / fingerprint / challenge**.

**Следствие:** нужен **`cookieTracker` + fingerprint** (canvas, WebGL, timezone, fonts) — понять, как нас вычисляют.

**Статус:** `cookieTracker.ts` уже есть (197 строк, коммит `e089c5e`). Расширение — в roadmap п.3.