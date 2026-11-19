# Общие правила разработки (L0, common)

## Стек
Electron 44 + React 19 + PrimeReact + Vite + TypeScript. SQLite (node:sqlite).

## Принципы
- Комментарии и UI-тексты — на русском
- После логического шага — `git commit` по группам, никогда `git add .`
- **Правки — только в стиле «найти → заменить»** (два блока: что найти, на что заменить). Не «вот весь файл», не diff, не «добавь после строки N». Если не можешь найти участок — попроси `grep -n "..."` и работай по выводу.
- `.bak-*` файлы не коммитить
- Ключи `.env.local` — не выводить в чат/логи

## Проверка перед коммитом
- `git status --short` — только ожидаемые файлы
- `tsc --noEmit` — pre-existing ошибки не считать
- `docs/` не коммитить — там OSINT и directions, не для публикации

## Модули проекта
Gateway (DeepSeek), OSINT (Fremen Eye), Prana-Bindu, Trading, Sietch, Landsraad, Tasks, Ollama, AI Chat.
