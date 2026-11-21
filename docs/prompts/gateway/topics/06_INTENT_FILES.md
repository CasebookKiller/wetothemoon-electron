# 06 — Intent-файлы

## Что это
Метауровень передачи смены. Не техдокументация (`topics/`), не состояние кода (git+Schema).

| Файл | Роль |
|---|---|
| `handoff/architecture.md` | Решения и почему (trade-offs) |
| `handoff/done.md` | Журнал последних сессий |
| `handoff/next-steps.md` | Что дальше, приоритеты |
| `handoff/handoff-system.md` | Как устроен handoff |

## Два уровня
- `topics/` — «как работает X», стабильно
- `handoff/*` — «где мы и куда», меняется каждую сессию

Новая LLM читает: git state → intents → topics.

## Legacy (DEPRECATED)
`handoff/{problems,roadmap,techdebt}.md` — **не использовать**. Почистить из `gatewayHandoffListIntent` при касании.