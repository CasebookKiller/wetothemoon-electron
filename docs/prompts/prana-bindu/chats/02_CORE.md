# Направление 02: Prana-Bindu Core

## Роль
Ядро тренировочного модуля. Движок зон, распределение 80/20,
логика тренировочных блоков, ворота прогрессии.

## Зона ответственности
- Расчёт пульсовых зон (1–5) по возрасту и/или по ПАНО.
- Проверка соотношения 80/20 по объёму и интенсивности за неделю.
- Логика фаз: база → порог → специфика → подводка.
- Ворота прогрессии Big-6.
- Валидатор AI-рекомендаций.

## Входные данные
- Профиль: возраст, max HR, ПАНО (если известно).
- История тренировок (из Melange).
- HRV, сон (из Water Discipline / ZeppBridge).
- Текущая фаза подготовки (из Mentat).

## Что нужно сделать
1. **zones.ts** — `getZone(hr)`, `getZoneBoundaries(profile)`,
   `zoneToIntensity(zone)`. Два режима: по возрасту (`220 - age`)
   и по ПАНО. ПАНО точнее, используем если задано.
2. **eightyTwenty.ts** — `checkEightyTwenty(weekId)`: считает объём
   в зонах 1–2 vs 4–5, возвращает `{ ratio, verdict, advice }`.
3. **phases.ts** — `getPhase(date)`, `phaseAllows(type)`,
   `phaseVolumeMultiplier(phase)`.
4. **progressionGate.ts** — `checkProgressionGate(movementId)`:
   benchmark + стабильность пульса + HRV → `{ open, reasons }`.
5. **recommendationValidator.ts** — `validateRecommendation(rec)`:
   проверяет AI-совет против 80/20, восстановления, taper →
   `{ ok, violations }`.

## Ограничения
- Никаких импортов Electron, React, PrimeReact.
- Никаких прямых обращений к БД — только через слой Melange.
- Функции детерминированы, без побочных эффектов.
- Зоны задаются конфигом, не хардкодятся.

## Связь с другими модулями
- **Mentat** → `getPhase`, `phaseAllows`, `phaseVolumeMultiplier`.
- **Stillsuit** → `getZone`, `getZoneBoundaries`.
- **Crysknife** → `checkProgressionGate`.
- **Water Discipline** → передаёт HRV/сон в `checkProgressionGate`.
- **Recommender** → `validateRecommendation`.

## Проверка (ручные сценарии)
Тестов нет (осознанно, YAGNI). Вместо них — сценарии:

1. **Зоны.** Профиль: возраст 40, max HR = 180. Ожидаем:
   З1 = 90–108, З2 = 108–126, З3 = 126–144, З4 = 144–162, З5 = 162–180.
   Проверить `getZone(120) === 2`.
2. **80/20.** Неделя с 100 км: 85 км в З1–2, 15 км в З4–5.
   Ожидаем verdict = ok, advice = «держим».
3. **Нарушение 80/20.** Неделя с 60 км: 30 км в З1–2, 30 км в З4–5.
   Ожидаем verdict = warn, advice = «снизить интенсивность».
4. **Фаза.** Дата в мае (порог) → `phaseAllows('threshold') = true`.
   Дата за 2 недели до 27.09.2026 → `phaseAllows('threshold') = false`.
5. **Ворота.** Benchmark выполнен, пульс стабилен, HRV в норме →
   `{ open: true }`. Benchmark выполнен, HRV низкий → `{ open: false,
   reasons: ['low_hrv'] }`.
6. **Валидатор.** AI советует «добавь ещё 2 пороговых в неделю» во
   время taper → `{ ok: false, violations: ['taper_violation'] }`.

Каждый сценарий — короткая функция в `scenarios.ts`, запускается
вручную, вывод в консоль. Не CI, не vitest.

## Definition of Done
- Файлы в `src/main/services/pranaBindu/core/`:
  `zones.ts`, `eightyTwenty.ts`, `phases.ts`, `progressionGate.ts`,
  `recommendationValidator.ts`, `types.ts`, `scenarios.ts`, `index.ts`.
- Сценарии проходят вручную.
- Экспорт через `index.ts`.
- Ноль импортов Electron / React.

## Что НЕ делаем
- UI, схему БД, меню, окна, интеграции — другие чаты.


==================================

# Направление 02: Prana-Bindu Core

## Роль
Ядро тренировочного модуля. Движок зон, распределение 80/20,
логика тренировочных блоков, ворота прогрессии.

## Зона ответственности
- Расчёт пульсовых зон (1–5) по возрасту и/или по ПАНО.
- Проверка соотношения 80/20 по объёму и интенсивности за неделю.
- Логика фаз: база → порог → специфика → подводка.
- Ворота прогрессии Big-6.
- Валидатор AI-рекомендаций.

## Входные данные
- Профиль: возраст, max HR, ПАНО (если известно).
- История тренировок (из Melange).
- HRV, сон (из Water Discipline / ZeppBridge).
- Текущая фаза подготовки (из Mentat).

## Что нужно сделать
1. **zones.ts** — `getZone(hr)`, `getZoneBoundaries(profile)`,
   `zoneToIntensity(zone)`. Два режима: по возрасту (`220 - age`)
   и по ПАНО. ПАНО точнее, используем если задано.
2. **eightyTwenty.ts** — `checkEightyTwenty(weekId)`: считает объём
   в зонах 1–2 vs 4–5, возвращает `{ ratio, verdict, advice }`.
3. **phases.ts** — `getPhase(date)`, `phaseAllows(type)`,
   `phaseVolumeMultiplier(phase)`.
4. **progressionGate.ts** — `checkProgressionGate(movementId)`:
   benchmark + стабильность пульса + HRV → `{ open, reasons }`.
5. **recommendationValidator.ts** — `validateRecommendation(rec)`:
   проверяет AI-совет против 80/20, восстановления, taper →
   `{ ok, violations }`.

## Ограничения
- Никаких импортов Electron, React, PrimeReact.
- Никаких прямых обращений к БД — только через слой Melange.
- Функции детерминированы, без побочных эффектов.
- Зоны задаются конфигом, не хардкодятся.

## Связь с другими модулями
- **Mentat** → `getPhase`, `phaseAllows`, `phaseVolumeMultiplier`.
- **Stillsuit** → `getZone`, `getZoneBoundaries`.
- **Crysknife** → `checkProgressionGate`.
- **Water Discipline** → передаёт HRV/сон в `checkProgressionGate`.
- **Recommender** → `validateRecommendation`.

## Проверка (ручные сценарии)
Тестов нет (осознанно, YAGNI). Вместо них — сценарии:

1. **Зоны.** Профиль: возраст 40, max HR = 180. Ожидаем:
   З1 = 90–108, З2 = 108–126, З3 = 126–144, З4 = 144–162, З5 = 162–180.
   Проверить `getZone(120) === 2`.
2. **80/20.** Неделя с 100 км: 85 км в З1–2, 15 км в З4–5.
   Ожидаем verdict = ok, advice = «держим».
3. **Нарушение 80/20.** Неделя с 60 км: 30 км в З1–2, 30 км в З4–5.
   Ожидаем verdict = warn, advice = «снизить интенсивность».
4. **Фаза.** Дата в мае (порог) → `phaseAllows('threshold') = true`.
   Дата за 2 недели до 27.09.2026 → `phaseAllows('threshold') = false`.
5. **Ворота.** Benchmark выполнен, пульс стабилен, HRV в норме →
   `{ open: true }`. Benchmark выполнен, HRV низкий → `{ open: false,
   reasons: ['low_hrv'] }`.
6. **Валидатор.** AI советует «добавь ещё 2 пороговых в неделю» во
   время taper → `{ ok: false, violations: ['taper_violation'] }`.

Каждый сценарий — короткая функция в `scenarios.ts`, запускается
вручную, вывод в консоль. Не CI, не vitest.

## Definition of Done
- Файлы в `src/main/services/pranaBindu/core/`:
  `zones.ts`, `eightyTwenty.ts`, `phases.ts`, `progressionGate.ts`,
  `recommendationValidator.ts`, `types.ts`, `scenarios.ts`, `index.ts`.
- Сценарии проходят вручную.
- Экспорт через `index.ts`.
- Ноль импортов Electron / React.

## Что НЕ делаем
- UI, схему БД, меню, окна, интеграции — другие чаты.