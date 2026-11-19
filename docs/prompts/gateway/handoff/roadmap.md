# Roadmap

## Ближайшие (2 часа)
1. **tokenCounter.ts** — pre-check бюджета перед chat() (30 мин). См. «tokenCounter — открытые вопросы» ниже.
2. **Tool calling** (prompt-based): read_context_node, create_task, list_tasks (1 час)
3. **Recon free LLMs** (Handoff v7, параллельная тема) — 9/15 живых: Duck.ai (без логина), GigaChat API (нужен Russian Trusted CA в `NODE_EXTRA_CA_CERTS`), Алиса AI API (IAM-токен), token-free-gateway. Скрипты `scripts/recon-free-llms.*` в git (1–2 часа)

## Следующие сессии
3. Event bus между окнами (1 час)
4. UI-кнопка «📋 Экспорт продолжения» в GatewayChatHeader (20 мин)
5. UI-индикатор web/api в TopControlPanel (20 мин)
6. Watcher на .md через fs.watch → syncManifestToDb (20 мин)
7. П1 (вариант B): сайдбар из cache.listConversations() без фильтра (30 мин)
8. preflight-check.mjs --json (10 мин)

## tokenCounter — открытые вопросы (на следующую сессию)

1. **Блокировать или предупреждать?** → предупреждать (console + UI badge `⚠️ 90% бюджета`), не блокировать. Решает пользователь.
2. **Input или резерв output?** → input + `max_tokens` (эвристика `input × 1.2`). `usage.prompt_tokens` из SSE — для калибровки.
3. **Бюджет в чём?** → токены (основное), USD (через `estimateCost`), запросы/день (rate limit).
4. **Tokenizer?** → начать с `Math.ceil(text.length / 3.5)` (русский/английский). Точный — если калибровка по `usage` покажет погрешность >10%.

## Что НЕ делаем сейчас