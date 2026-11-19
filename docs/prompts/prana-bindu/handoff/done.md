# Сделано / НЕ откатывать — Prana-Bindu

## Сделано (не ломать)

| Направление / компонент | Статус | Версия / детали |
|---|---|---|
| **09 Electron Shell** (окно, меню, IPC) | завершён | `pranaBinduWindow.ts`, `pb:*`, `electronAPI.pb` |
| **14 Dashboard** (главная страница) | завершён | виджеты Тренировки + Здоровье, диалоги `TrainingDialog`, `HealthDialog` |
| **07 Spice** — провайдеры, парсеры, sync | 99% | dodofo + GPS 264/264, ICU, Strava FIT/TCX, Zepp FIT-папка |
| **08 Melange** — схема БД | **v36** | `SCHEMA_VERSION = 36`, миграции v1→v36 |
| **18 Map Editor** — редактор карты | C.1–C.13 | `RouteMapEditor`, `StoryGeneratorDialog`, `test_segments` |
| **18 C.12 Цепочки** | ✅ | БД v32/v33 (`chains`, `chain_slots`), `evaluateChain`, `ChainsPanel` |
| **18 C.13 Direction-aware** | ✅ | Bearing в `coverageIndex.ts`, `directionToleranceDeg` |
| **16 Exercise Graph** | C.1–D | Wade 76 узлов / 210 рёбер, `smithrun` каркас |
| **Здоровье, Вода, Вес, Питание** | ✅ | БД v31 (`water_logs`, `weight_logs`, `nutrition_logs`) |
| **Аналитика** — `HealthDashboardDialog` | ✅ | Chart.js: Вес, Вода, Сон, CTL/ATL |
| **Профиль** — Рост, Пол, Дата рождения | ✅ | BMR по Миффлину |
| **Mentat** — каталог упражнений | ~80% | `PROGRESSIONS_CATALOG` (22 × 10), `NAMED_EXERCISES` (~70), `THENICS_CATALOG` (206) |
| **Duna** — UI, стили | ~80% | `AppIcon`, кастомные SVG иконки |

## Правила работы (не нарушать)

- **`src/main/services/pranaBindu/` не импортирует Electron.**
- **`safeStorage` — только в handler** (`pranaBinduHandlers.ts`), не в сервисах.
- **Токены** (`dodofo`, `intervals.icu`, Zepp) — только `safeStorage`, не логировать.
- **`training:*` ≠ Prana-Bindu.** `training:*` — fine-tuning Ollama, отдельная зона.
- **`GPS в Москве глушат** — обходим через акселерометр, но трек сохраняем (`Activity.polyline`).
- **`HR-баг до 2026-09-30`** — 260 записей с `hr = 144`. Не пересчитываются на сервере.
- **`dodofo` отдаёт `null`** для `vo2max / spo2 / hrv_ms / fatigue / stress / mood` — ограничение облака.
- **Big-6 прогрессия** — только через `checkProgressionGate` (Core). Не двигать вручную.
- **Water Discipline** блокирует прогрессию при низком HRV.
- **`PROJECT_STATE.md`** — обновлять при переключении чата.
- **Не смешивать логику разных модулей.**

## Что нельзя откатывать

- **Melange v36** — все миграции v1→v36, `SCHEMA_VERSION = 36`.
- **v32/v33 chains** — `chains`, `chain_slots` (+ `direction`).
- **`coverageIndex.ts`** — direction-aware coverage (Bearing).
- **`evaluateChain`** — `aggregate='best' | 'sum'`, `direction`.
- **`run_streams`** — `.msgpack` файлы на диске (200 МБ), не переносить в БД.
- **`plan_events.local_keep`** — «не удалять при mirror-синке».
- **`sync_settings`** — токены только через `safeStorage.encryptString`.
- **`dofekProvider.ts` / `regionDetector.ts`** — каркас Zepp-direct, не удалять (даже если заглушка).