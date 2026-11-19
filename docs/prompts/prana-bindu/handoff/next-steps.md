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

> **Browser-канал приоритетнее API.** Не ждём API. См. `architecture.md` §«Browser-канал > API».

1. **`ProviderAdapter` + `BrowserPool`** — фундамент для параллельных браузеров и N провайдеров (1 час).
2. **Recon провайдеров** — Duck.ai → g4f.dev → GigaChat → Алиса → HuggingChat (1 час).
3. **Cookie/fingerprint** — расширить `cookieTracker.ts` (canvas, WebGL, timezone, fonts). Ответить на П5: как нас палят.

## 02 Core — сигнатуры (детали в `docs/prompts/prana-bindu/chats/02_CORE.md`)

Файлы: `src/main/services/pranaBindu/core/{types,zones,eightyTwenty,phases,progressionGate,recommendationValidator,scenarios,index}.ts`. **Zero импортов Electron/React/БД. Детерминированы.**

- **`zones.ts`** — `getZone(hr)`, `getZoneBoundaries(profile)`, `zoneToIntensity(zone)`. Два режима: по возрасту (`220 - age`) или по ПАНО (точнее).
- **`eightyTwenty.ts`** — `checkEightyTwenty(weekId)` → `{ ratio, verdict, advice }`. Считает объём в зонах 1–2 vs 4–5.
- **`phases.ts`** — `getPhase(date)`, `phaseAllows(type)`, `phaseVolumeMultiplier(phase)`. Фазы: база → порог → специфика → подводка.
- **`progressionGate.ts`** — `checkProgressionGate(movementId)` → `{ open, reasons }`. Benchmark + стабильность пульса + HRV.
- **`recommendationValidator.ts`** — `validateRecommendation(rec)` → `{ ok, violations }`. Проверяет AI-совет против 80/20, восстановления, taper.

**6 сценариев в `scenarios.ts`** (запускаются вручную, вывод в консоль):
1. **Зоны.** Age 40, max HR 180 → З1=90-108, З2=108-126, З3=126-144, З4=144-162, З5=162-180. `getZone(120) === 2`.
2. **80/20 OK.** 100 км: 85 З1-2, 15 З4-5 → `verdict: ok`.
3. **80/20 нарушено.** 60 км: 30 З1-2, 30 З4-5 → `verdict: warn`, «снизить интенсивность».
4. **Фаза.** Май (порог) → `phaseAllows('threshold') = true`. За 2 недели до 27.09.2026 → `false`.
5. **Ворота.** Benchmark + пульс + HRV → `{ open: true }`. Benchmark + HRV низкий → `{ open: false, reasons: ['low_hrv'] }`.
6. **Валидатор.** AI: «+2 пороговых в неделю» во время taper → `{ ok: false, violations: ['taper_violation'] }`.

## Правила работы

- `src/main/services/pranaBindu/` **не импортирует Electron**.
- `safeStorage` — **только в handler** (`pranaBinduHandlers.ts`), не в сервисах.
- Токены (`dodofo`, `intervals.icu`, Zepp) — только `safeStorage`, не логировать.
- UI-тексты и комментарии — на русском.
- После логического шага — `git commit` по группам, **никогда `git add .`**.
- **Перед коммитом — `git status`** (в прошлых сессиях накапливалась незакоммиченная работа).
- Не смешивать логику разных модулей.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — должно быть пусто.