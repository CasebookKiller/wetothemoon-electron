# С чего начать новый чат (Prana-Bindu)

> ⚠️ **Формат правок:** все изменения предлагай в стиле «найти → заменить»
> (два блока: что найти, на что заменить). Не давай diff, не «весь файл
> заново», не «вставь после строки N». Не можешь найти участок — попроси
> `grep -n "..."` и работай по выводу.

## Первые команды

```bash
cd ~/Документы/GitHub/wetothemoon-project/wetothemoon-electron
node scripts/preflight-check.mjs        # 10 сек
git log --oneline -5
```

## Проверить состояние Prana-Bindu

```bash
# SCHEMA_VERSION
grep -n "SCHEMA_VERSION" src/main/services/pranaBindu/melange/migrations.ts

# Что в БД (если открыта)
ls -la ~/.config/wetothemoon-electron/prana_bindu.db
```

Ожидаемо: `SCHEMA_VERSION = 36` (или новее), `prana_bindu.db` на месте.

## Приоритет на сессию (2 часа)

1. **Если 02 Core не начат** — реализовать. Спека готова, файлы `src/main/services/pranaBindu/core/{types,zones,eightyTwenty,phases,progressionGate,recommendationValidator,scenarios,index}.ts`. Разблокирует Crysknife, Water Discipline, AI-Validator.
2. **Если 07 Spice** — Push в ICU (`POST/PUT/DELETE events`, UI в `PlanEventDrawer`, preview таймлайна).
3. **Если 11 AI-Тренер** — `contextBuilder.ts` + `AiCoachDialog`. Зависит от 02 Core.
4. **Если 16 Exercise Graph** — миграция каталогов в JSON (этап B).
5. **Если 18 Map Editor** — C.7 «Территория» (полигоны на 3 КП, фундамент — C.12 chains).

## Правила работы

- `src/main/services/pranaBindu/` **не импортирует Electron**.
- `safeStorage` — **только в handler** (`pranaBinduHandlers.ts`), не в сервисах.
- Токены (`dodofo`, `intervals.icu`, Zepp) — только `safeStorage`, не логировать.
- UI-тексты и комментарии — на русском.
- После логического шага — `git commit` по группам, **никогда `git add .`**.
- **Перед коммитом — `git status`** (в прошлых сессиях накапливалась незакоммиченная работа).
- Не смешивать логику разных модулей.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — должно быть пусто.