# Roadmap

## Ближайшие (2 часа)
1. tokenCounter.ts — pre-check бюджета перед chat() (30 мин). Ответы на 4 вопроса — см. **«🔄 Как поддерживать handoff»** ниже (tokenCounter Q&A).
2. Tool calling (prompt-based): read_context_node, create_task, list_tasks (1 час)
3. **Recon free LLMs** (Handoff v7) — 9/15 живых: Duck.ai, GigaChat CA (нужен Russian Trusted CA в `NODE_EXTRA_CA_CERTS`), Алиса IAM, token-free-gateway. Скрипты `recon-free-llms.*` в `scripts/` (1–2 часа)

## Следующие сессии
3. Event bus между окнами (1 час)
4. UI-кнопка «📋 Экспорт продолжения» в GatewayChatHeader (20 мин)
5. UI-индикатор web/api в TopControlPanel (20 мин)
6. Watcher на .md через fs.watch → syncManifestToDb (20 мин)
7. П1 (вариант B): сайдбар из cache.listConversations() без фильтра (30 мин)
8. preflight-check.mjs --json (10 мин)