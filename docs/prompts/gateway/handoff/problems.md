# Известные проблемы

## П1. Диалог пропадает при переключении профиля
`gateway:get-conversations` → live из Chrome → при switch пустой.
Фикс B: сайдбар из кэша + бейдж профиля.

## П2. global block present: false в тесте
Формат тега в промпте не `<context key="global">`. Не блокер.

## П3. Submodule bump
После каждого коммита в submodule — bump в родителе. Скрипт `scripts/sync-submodule.sh`.