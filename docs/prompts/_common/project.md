# wetothemoon-project — краткое summary

## Роль
Родительский репозиторий. Содержит `wetothemoon-electron/` как submodule.

## Структура
- `wetothemoon-electron/` — Electron-приложение (см. отдельный узел)
- `docs/` — локальные промпты (в .gitignore, 594M)
- `.gitmodules` — submodule registration

## Bump submodule
После коммитов в `wetothemoon-electron/` — `bash scripts/sync-submodule.sh`.