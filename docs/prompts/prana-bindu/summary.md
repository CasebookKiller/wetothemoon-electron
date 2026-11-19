# Prana-Bindu — краткое summary

## Роль
Модуль тренировок тела в `wetothemoon-electron`. Две линии: **Stillsuit** (марафон) + **Crysknife** (Big-6). Окно: `#/prana-bindu`, IPC-префикс `pb:*`. Локальная БД — `prana_bindu.db` (Melange, schema **v36**).

## Координаторы
Mentat (периодизация, каталог), Water Discipline (восстановление), Spice (данные/провайдеры), Melange (БД), Prana-Bindu Core (зоны, 80/20), Duna (UI).

## Цель
Марафон 42,2 км **27.09.2027** (восьмой). Седьмой — 27.09.2026 за 5:56:01. Старт подготовки — **01.11.2026**. Задача: снизить темп и пульс на заданном темпе. Параллельно — Big-6 и общее физическое.

## Ключевые цифры (2026-10-29)
- Melange `schema_version` = **36**
- `run_facts` ~2530
- `run_streams` ~200 МБ, 264/264 dodofo с GPS
- `recovery_logs` 1000+
- `plan_events` 13+
- `chains` 1+

## Стек
Electron 44 + React 19 + PrimeReact 10 + SQLite (`node:sqlite`). Парсеры: `fit-file-parser`, `fast-xml-parser`, `csv-parse`. Карта: `maplibre-gl` (OpenFreeMap). Chart: `chart.js` + PrimeReact `Chart`. AI: Ollama / DeepSeek (Playwright).

## Источники данных
- **dodofo.ru** — основной агрегатор (workouts + GPS + wellness). Bearer-токен в `sync_settings.dodofo_token` (`safeStorage`).
- **intervals.icu** — wellness + план (events) + streams. API-ключ в `sync_settings.intervals_api_key`.
- **Strava-архив** — FIT/TCX (ручной экспорт).
- **Zepp FIT-папка** — ручные выгрузки.
- **Zepp-direct** — TODO (VO2max, SpO2, HRV).

## Карта файлов

| Что | Где |
|---|---|
| Окно | `src/main/windows/pranaBinduWindow.ts` |
| Страница | `src/pages/PranaBinduPage/PranaBinduPage.tsx` |
| IPC-префикс | `pb:*` |
| IPC-хендлеры | `src/main/ipcHandlers/pranaBinduHandlers.ts` |
| Сервисы | `src/main/services/pranaBindu/{core,stillsuit,crysknife,mentat,waterDiscipline,spice,melange}/` |
| Компоненты | `src/components/PRANA_BINDU/` |
| Панели | `src/components/PRANA_BINDU/PANELS/` (по подпапке на панель) |
| Preload | `electronAPI.pb.*` |
| Меланж (БД) | `src/main/services/pranaBindu/melange/{db,schema,migrations,repositories}/` |
| Провайдеры | `src/main/services/pranaBindu/spice/providers/{dodofoProvider,intervalsIcuProvider,dofekProvider,mcpProvider,bridgeProvider,regionDetector}.ts` |
| Парсеры | `src/main/services/pranaBindu/spice/parsers/{fitParser,tcxParser,stravaCsvParser,gpsClassifier}.ts` |

## Что НЕ входит
Fine-tuning Ollama (`training:*`), мобильная версия Prana-Bindu, Live-журнал (отдельный PWA), публичный релиз с именами из «Дюны».