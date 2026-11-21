# 12 — Pipeline (оркестрация задач)

## Зачем
Сейчас: failover в `gatewayHandlers.ts:857,938`, но `AUTO_SWITCH_ENABLED=false`. Нужна управляемая оркестрация.

## Модель
`task` (v9 `tasks`) → стадии: created → profile_selected → sent → waiting → done|failed.
На rate-limit → переключение профиля (если `task.allowAutoSwitch`), иначе fail.

## IPC
- `gatewayTaskCreate({title, moduleId, profileId?, allowAutoSwitch})`
- `gatewayTaskList()` / `gatewayTaskStatus(id)` / `gatewayTaskCancel(id)`

## Схема v11
Дополнить `tasks`: `pipeline_stage`, `allow_auto_switch`, `last_error`.

## Приоритет: высокий, но после 08 (JSON_TOOLS)