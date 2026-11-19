# Направление 07: Spice (данные, парсеры, провайдеры)

> Обновлено: 2026-10-29
> Статус: 99% готово.

## Роль
Все источники данных, парсеры, синхронизация, аналитика.

## Зона ответственности

- **Провайдеры** (`spice/providers/`):
  - `dodofoClient.ts` + `dodofoProvider.ts` — workouts, streams (с GPS), thresholds, wellness;
  - `intervalsIcuProvider.ts` — workouts, streams, thresholds, wellness, events, plan;
  - `dofekProvider.ts` — резерв Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `regionDetector.ts` — автодетект хоста Zepp.
- **Парсеры** (`spice/parsers/`):
  - `types.ts` — `UnifiedWorkout`, `RawWorkout`;
  - `fitParser.ts`, `tcxParser.ts`;
  - `stravaCsvParser.ts` — `activities.csv` из архива Strava;
  - `gpsClassifier.ts`.
- **Валидация** (`spice/validation/workoutValidator.ts`).
- **Хранилище** (`spice/runStreams/runStreamsStorage.ts`).

## Провайдеры: capabilities

| name | workouts | streams | thresholds | zones | wellness |
|---|---|---|---|---|---|
| `dodofo` | ✓ | ✓ (+ GPS) | ✓ (resthr) | ✗ (404) | ✓ (сон, шаги, фазы, калории) |
| `intervals-icu` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dofek-zepp` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `zepp-mcp` / `zeppbridge` | ✗ | ✗ | ✗ | ✗ | ✗ |

## Публичный контракт dodofo

### GPS живёт в карточке заезда, не в `/streams`
- `GET /api/v1/activities/{id}/streams` → только числовые каналы. **GPS нет.**
- `GET /api/v1/activities/{id}` → `Activity.polyline: [[lat, lng], …] | null`. **Это источник GPS.**

### `fetchStreams` — составной запрос
Сначала запрашивает числовые потоки, затем карточку для получения `polyline`. Объединяет их в один объект.

### Важное про HR-баг в старых записях
У dodofo-фактов **до 2026-09-30** HR = 144 константой (баг на стороне сервера). Mass-resync **не пересчитал** старые.

## Wellness v20 — источники и энергия

### Два провайдера: intervals-icu + dodofo
`pb:sync-wellness` синкает **всех** провайдеров с `capabilities.wellness`. Порядок: **ICU первым**, потом dodofo. `upsertRecoveryLog` **мержит по date**.

### Что dodofo отдаёт в wellness (Проверено 2026-10-29)

```json
{
  "date": "2026-10-29",
  "resting_hr": 48,
  "hrv_ms": null,
  "sleep_hours": 4.5,
  "sleep_score": 81,
  "sleep_total_min": 268,
  "deep_min": 66,
  "light_min": 202,
  "rem_min": null,
  "awake_min": null,
  "steps": 10000,
  "body_fat_pct": null,
  "calories_active": 673,
  "calories_total": null,
  "vo2max": null,
  "spo2_avg_pct": null,
  "fatigue": null,
  "stress": null,
  "mood": null
}
```

**Внимание (Разведка 2026-10-29):** Провайдер dodofo возвращает ключи `vo2max`, `spo2_avg_pct`, `hrv_ms`, `fatigue`, `stress`, `mood`, но **значения в них всегда `null`**. Это ограничение облака Huawei/Zepp. 
**Следствие:** В UI эти поля скрываются. Для их получения в будущем потребуется **Zepp-direct** (прямая авторизация к API Zepp).

## Автосинхронизация при старте

### `pb:auto-sync-on-start`
1. Проверяет `autoOnStart`. Антидребезг: 6 ч.
2. Синкает **workouts** за 7 дней по всем провайдерам.
3. Синкает **wellness** за 7 дней в мультипровайдерном режиме.
4. Не синкает streams и plan (тяжелые).

## Источники данных (актуально)

| Источник | Что даёт | origin | source |
|---|---|---|---|
| dodofo.ru | workouts, streams (с GPS), thresholds (resthr), wellness | — | `dodofo` |
| Strava-архив FIT | workouts + streams | `strava-archive` | `fit` |
| Strava-архив TCX | workouts + streams | `strava-archive` | `tcx` |
| Strava `activities.csv` | метаданные без потоков | `strava-archive` | `strava-csv` |
| intervals.icu | workouts + streams + thresholds + zones + wellness + events | `intervals-icu` | `intervals-icu` |
| Zepp FIT-папка (ручная) | workouts + streams | `zepp-app` | `fit` |
| Ручной импорт FIT/TCX | workouts + streams | `manual-import` | `fit` |

## Что реализовано

### Импорт
- `pb:import-fit` / `pb:import-files` / `pb:import-fit-dir`.
- `pb:import-strava-csv(path)` — activities.csv.
- `pb:import-zepp-dir(dirPath, opts)` — папка Zepp FIT. Дедуп по `(source, external_id)`.

### Синхронизация
- `pb:sync-now(from, to, providerName)` — список активностей.
- `pb:sync-run-streams(runFactId, providerName?)` — потоки одной.
- `pb:sync-run-streams-all(...)` — батч потоков.
- `pb:sync-thresholds(providerName?)` — пороги в профиль.
- `pb:sync-zones(providerName?)` — HR-зоны + pace-зоны.
- `pb:sync-wellness(providerName?, from, to)` — мультипровайдерный wellness.
- `pb:auto-sync-on-start()` — автосинк при старте окна.

## Открытые задачи
1. **Zepp-direct**: Единственный способ получить VO2max, SpO2, HRV детально и гипнограмму сна.
2. **Melange v37**: `run_facts.training_load` (вынести из raw_json).
3. **`sources_json` в `run_facts`** (дедупликация на уровне БД).


=====================================================

# Направление 07: Spice (данные, парсеры, провайдеры)

> Обновлено: 2026-10-08
> Статус: 99% готово.

## Роль

Все источники данных, парсеры, синхронизация, аналитика.

## Зона ответственности

- **Провайдеры** (`spice/providers/`):
  - `dodofoClient.ts` + `dodofoProvider.ts` — workouts, streams (с GPS), thresholds, wellness;
  - `intervalsIcuProvider.ts` — workouts, streams, thresholds, wellness, events, plan;
  - `dofekProvider.ts` — резерв Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `regionDetector.ts` — автодетект хоста Zepp.
- **Парсеры** (`spice/parsers/`):
  - `types.ts` — `UnifiedWorkout`, `RawWorkout`;
  - `fitParser.ts`, `tcxParser.ts`;
  - `stravaCsvParser.ts` — `activities.csv` из архива Strava;
  - `gpsClassifier.ts`.
- **Валидация** (`spice/validation/workoutValidator.ts`).
- **Хранилище** (`spice/runStreams/runStreamsStorage.ts`).

## Провайдеры: capabilities

| name | workouts | streams | thresholds | zones | wellness |
|---|---|---|---|---|---|
| `dodofo` | ✓ | ✓ (+ GPS) | ✓ (resthr) | ✗ (404) | ✓ (сон, шаги, фазы, калории) |
| `intervals-icu` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dofek-zepp` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `zepp-mcp` / `zeppbridge` | ✗ | ✗ | ✗ | ✗ | ✗ |

## Публичный контракт dodofo — обновление 2026-10-08

### GPS живёт в карточке заезда, не в `/streams`

Из `docs/openapi.yaml`:
- `GET /api/v1/activities/{id}/streams` → только числовые каналы (`dist_m`, `sec_t`, `speed_kmh`, `hr`, `power_w`, `cadence_rpm`, `hr_zones`, `power_zones`, `eftp_watts`, `summary`). **GPS нет.**
- `GET /api/v1/activities/{id}` → `Activity.polyline: [[lat, lng], …] | null`. **Это источник GPS.**

### Тип `DodofoActivityFull extends DodofoActivity`

````ts
export interface DodofoActivityFull extends DodofoActivity {
  polyline?: [number, number][] | null;
  elevation_profile?: [number, number][] | null;
  hide_endpoints?: boolean;
  hidden_endpoints?: DodofoHiddenEndpoints | null;
  device?: string | null;
  training_load?: number;
  visibility?: string;
  quality_warning?: string | null;
}
````

### `fetchStreams` — составной запрос

````ts
async fetchStreams(activityId: number): Promise<DodofoStreams> {
  const token = this.getToken();
  if (!token) throw new Error('dodofo token not configured');

  // 1. Числовые каналы.
  const streams = await dodofoRequest<DodofoStreams>(
    `/api/v1/activities/${activityId}/streams`,
    token
  );

  // 2. Карточка — оттуда polyline.
  let polyline: [number, number][] | null = null;
  try {
    const activity = await dodofoRequest<DodofoActivityFull>(
      `/api/v1/activities/${activityId}`,
      token
    );
    if (Array.isArray(activity?.polyline) && activity.polyline.length > 0) {
      polyline = activity.polyline;
    }
  } catch (e) {
    console.warn(
      `[dodofo] fetchStreams: карточка ${activityId} не получена:`,
      (e as Error).message
    );
  }

  if (polyline) {
    return { ...streams, latlng: polyline };
  }
  return streams;
}
````

### `DodofoStreams.latlng`

````ts
export interface DodofoStreams {
  // Публичный контракт
  dist_m: number[];
  sec_t?: number[];
  speed_kmh: number[];
  hr?: number[];
  power_w?: number[];
  cadence_rpm?: number[];
  hr_zones?: DodofoZoneTime[];
  power_zones?: DodofoZoneTime[];
  eftp_watts?: number;
  summary?: Record<string, unknown> | null;

  // Приватные расширения (не в публичном контракте)
  poly_sec_t?: number[];
  elevation_track_segments?: [number, number][];
  hr_curve?: Record<string, number>;
  cadence_unit?: string;
  max_hr_bpm?: number;

  // Добавляем сами: GPS из Activity.polyline
  latlng?: [number, number][] | null;
}
````

### Результат mass-resync

- **264/264** dodofo-фактов получили GPS.
- `channels` в `.msgpack` содержит `latlng`.
- Карта в drawer'е рендерится.
- У `.msgpack` появился `hidden_endpoints` (в карточке) — но мы его пока не обрабатываем (не красим head/tail серым). На будущее.

### Важное про HR-баг в старых записях

У dodofo-фактов **до 2026-09-30** HR = 144 константой (баг на стороне сервера, исправлен разработчиком). Mass-resync **не пересчитал** старые — там `hr` так и останется плоским. На новые записи фикс влияет.

## Wellness v20 — источники и энергия

### Два провайдера: intervals-icu + dodofo

`pb:sync-wellness(providerName=undefined, ...)` синкает **всех** провайдеров с `capabilities.wellness`. Порядок: **ICU первым** (CTL/ATL), потом dodofo (сон/шаги/калории).

`upsertRecoveryLog` **мержит по date** — провайдеры дополняют друг друга.

### `auto_source` = имя нашего провайдера

**Раньше:** `auto_source = day.auto_source ?? name` — dodofo отдаёт `auto_source: 'zepp'`, потому что данные приходят из Huawei/Zepp-облака. В БД попадало `zepp`.

**Теперь:** `auto_source = name` (всегда наш провайдер: `dodofo`, `intervals-icu`). Чужой источник остаётся в `raw_json`.

### `sources_json` — аккумулируется

В `recoveryRepo.upsertRecoveryLog`:

````ts
const prevSources: string[] = (() => {
  if (!existing?.sources_json) return [];
  try {
    const parsed = JSON.parse(existing.sources_json);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
})();
const nextSources = [...prevSources];
if (input.auto_source && !nextSources.includes(input.auto_source)) {
  nextSources.push(input.auto_source);
}
const sourcesJsonStr =
  nextSources.length > 0 ? JSON.stringify(nextSources) : null;
````

Результат: `["intervals-icu","dodofo"]` независимо от порядка синка.

### Новые поля (v20)

- `sources_json` — массив источников.
- `calories_active` — dodofo отдаёт, раньше теряли.
- `calories_total` — то же.
- `body_fat_pct` — то же.

### Что dodofo отдаёт в wellness

````json
{
  "date": "2026-10-05",
  "resting_hr": 48,
  "hrv_ms": null,
  "sleep_hours": 4.3,
  "sleep_score": 78,
  "sleep_total_min": 259,
  "deep_min": 61,
  "light_min": 198,
  "rem_min": null,
  "awake_min": null,
  "steps": 21800,
  "body_fat_pct": null,
  "calories_active": 974,
  "calories_total": null,
  "spo2_avg_pct": null,
  "auto_source": "zepp"
}
````

**Не отдаёт:** `rem_min`, `awake_min`, `stress_avg`, `body_battery_*`, `hrv_ms` (все `null` — облако Huawei не делится).
**Потоков сна нет** — только агрегаты за день.

## Автосинхронизация при старте

### `pb:auto-sync-on-start`

Вызывается один раз из рендера при монтировании `PranaBinduPage` (сейчас живёт в `AutoSyncPanel`).

**Логика:**
1. Проверяет `autoOnStart`. Если `false` — `skipped: 'disabled'`.
2. Антидребезг: если с прошлого раза прошло меньше `autoIntervalMin` (по умолчанию 360 мин = 6 ч) — `skipped: 'cooldown'`.
3. Синкает **workouts** за 7 дней по всем провайдерам с `capabilities.workouts`.
4. Синкает **wellness** за 7 дней в мультипровайдерном режиме.
5. Пишет `last_sync_at` + `last_sync_status` (`ok` | `partial` | `error`).

**Не синкает:** streams и plan — тяжёлые операции, остаются ручными.

## Aliases — Mentat, но касается провайдеров

В `CatalogEntry.aliases`, `CatalogLevel.aliases`, `NamedExercise.aliases` — синонимы для матчинга. Используется в `workoutMatcher.ts` (Mentat). В Spice эта тема **не трогается**, но полезно знать: пробежко-дро-упражнения из ICU теперь могут матчиться через `aliases`, если имя нестандартное.

## Источники данных (актуально)

| Источник | Что даёт | origin | source |
|---|---|---|---|
| dodofo.ru | workouts, streams (с GPS), thresholds (resthr), wellness | — | `dodofo` |
| Strava-архив FIT | workouts + streams | `strava-archive` | `fit` |
| Strava-архив TCX | workouts + streams | `strava-archive` | `tcx` |
| Strava `activities.csv` | метаданные без потоков | `strava-archive` | `strava-csv` |
| intervals.icu | workouts + streams + thresholds + zones + wellness + events | `intervals-icu` | `intervals-icu` |
| Zepp FIT-папка (ручная) | workouts + streams | `zepp-app` | `fit` |
| Ручной импорт FIT/TCX | workouts + streams | `manual-import` | `fit` |

## Что реализовано

### Парсеры

- `parseFit(buffer, {externalId})` — Zepp/Garmin/Coros.
- `parseTcx(buffer, {externalId})` — Strava/Garmin/Polar.
- `parseStravaCsv(buffer)` — русская локаль, BOM, csv-parse. Даты в UTC. Десятичная запятая. Фильтр по типу «Бег».
- `UnifiedStreams`: `secT`, `hr`, `speedKmh`, `cadence`, `elevationM`, `latlng`, `distM`.
- Валидатор: 8 флагов + confidence 0–100.
- GPS-классификатор: coveragePct, haversine, good/poor/lost.
- TCX parser: fallback «лапы → trackpoints» для durationSec / distanceM.

### Хранилище потоков

- `.msgpack` файлы, `extractMeta` считает `pointCount` / `channels`.
- `channels` распознаёт `latlng` как отдельный kind.
- Multi-source: `(run_fact_id, source)` — PRIMARY KEY.
- dodofo-файлы теперь содержат `latlng`.

### Импорт

- `pb:import-fit` / `pb:import-files` / `pb:import-fit-dir`.
- `pb:import-strava-csv(path)` — activities.csv.
- `pb:import-zepp-dir(dirPath, opts)` — папка Zepp FIT.
  Дедуп по `(source, external_id)`, без time-window skip.
  **Обновляет `origin='zepp-app'`,** если файл уже был с другим origin
  (`strava-archive`, `manual-import`).
- Прогресс через `pb:import-progress`, отмена — `pb:import-cancel`.

### Синхронизация

- `pb:sync-now(from, to, providerName)` — список активностей.
- `pb:sync-run-streams(runFactId, providerName?)` — потоки одной.
  Для dodofo теперь дёргает два запроса (streams + activity) → latlng.
- `pb:sync-run-streams-all(from, to, {provider, onlyMissing})` —
  батч потоков с прогрессом и отменой.
- `pb:sync-thresholds(providerName?)` — пороги в профиль.
- `pb:sync-zones(providerName?)` — HR-зоны + pace-зоны.
- `pb:sync-wellness(providerName?, from, to)` — мультипровайдерный wellness.
- `pb:auto-sync-on-start()` — автосинк при старте окна (workouts + wellness).
- `pb:sync-settings-get/update` — настройки автосинхронизации.

### Профиль и пороги

- `profile` содержит `lthr`, `max_hr`, `resting_hr` + источники
  `lthr_source`, `max_hr_source`, `resting_hr_source`
  (`icu` | `dodofo` | `manual` | `computed`).
- Merge-семантика COALESCE в UPDATE `run_facts`: повторный sync
  без изменений не затирает FIT-обогащение.
- `pb:sync-zones` дополнительно сохраняет `pace_zones_kmh` (пересчёт
  из `threshold_pace_ms` × pct × 3.6) и `threshold_pace_ms`.

### Учёт нагрузки при генерации (Mentat, но данные из Spice)

- `pb:day-load-summary` — сумма плановой (`plan_events.planned_load`
  где sport ~ run) и фактической (`run_facts.raw_json.raw.training_load`
  или `raw_json.raw.icu_training_load`) нагрузки по дням + медиана
  за 28 дней.
- Для FIT/TCX без `training_load` в `raw_json` — `0`. Melange v22
  добавит расчёт по HR-зонам.

### UI

- Панель «Подключения» — dodofo token, ICU key + athlete id,
  Zepp email/password. Проверка токена — человекочитаемое сообщение.
- Панель «Синхронизация (API)» — диапазон, провайдер, 6 операций,
  прогресс-бар заливки, все статусы. Внизу встроена
  «Автосинхронизация».
- Панель «Импорт файлов» — FIT-архив + отдельные файлы + Strava CSV +
  Zepp-папка + drag&drop.
- Панель «Здоровье · intervals.icu» — таблица recovery_logs.

### Бейджи источников

`sourceBadge(source, origin)`:
- `fit` + `strava-archive` → `fit` (песочный);
- `fit` + `zepp-app` → `zepp` (циан);
- `fit` + `manual-import` → `manual` (зелёный);
- `tcx` → `tcx` (синий);
- `dodofo` → `dodofo` (оранжевый);
- `intervals-icu` → `intervals-icu` (красный);
- `strava-csv` → `strava-csv` (фиолетовый).

## Открытые задачи

### 1. Melange v22 — `run_facts.training_load`

Вынести из `raw_json` в отдельную колонку. Плюс — расчёт для FIT/TCX
через HR-зоны (если есть `lthr` и `hr`).

**Зачем:** сейчас `pb:day-load-summary` парсит `raw_json` на каждый
запрос и не видит FIT/TCX. Точный TSS нужен для превью программ и
будущей бегущей строки.

### 2. `sources_json` в `run_facts`

Multi-source модель: одна физическая тренировка = N источников.
Сейчас UI группирует ±30 мин на лету. БД хранит все записи как есть.

### 3. Zepp-direct

`@dofek/zepp-client` — если dodofo/ICU не покрывают:
- потоковые данные о сне (гипнограмма);
- HR per-minute за ночь;
- HRV per-minute.

Скорее всего, только Zepp-direct даст эти каналы.

### 4. Расчёт LTHR / threshold pace

Движок поиска 20-мин максимума в streams. Запись в профиль с
`source='computed'`. Лучше делать после CHARTS-чата.

### 5. Валидатор в UI

Показывать `validation.flags` и `confidence` в drawer'е.

### 6. Автосинхронизация — расширение

Сейчас синкает workouts + wellness. Опционально: если `mode='auto'`
и `auto_on_start=1` — можно добавить `sync-plan` раз в сутки
(не каждый старт).

### Отложено

- **Погода ICU** — нет данных.
- **Google Fit OAuth** — отложено навсегда.
- **HR-баг в старых dodofo** — сервер не пересчитывает.

## Проверка

````bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
# Пусто

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT source, origin, COUNT(*) FROM run_facts
   GROUP BY source, origin;"

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT COUNT(*) FROM run_streams WHERE source='dodofo'
   AND channels LIKE '%latlng%';"
# 264

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT date, auto_source, sources_json, calories_active
   FROM recovery_logs ORDER BY date DESC LIMIT 5;"
````

````js
// Прямая проверка dodofo GPS
await window.electronAPI.pb.debugStreams(15, { writeFile: true });
const p = await window.electronAPI.pb.getRunStreams(15, 'dodofo');
console.log('latlng exists?', 'latlng' in (p.payload ?? {}));
console.log('first point:', p.payload?.latlng?.[0]);

// Wellness
const w = await window.electronAPI.pb.debugWellness('2026-10-05', '2026-10-05');
console.log(JSON.stringify(w.data, null, 2));

// Автосинк
await window.electronAPI.pb.autoSyncOnStart();
````

## Definition of Done

- [x] FIT/TCX парсеры + Strava CSV парсер.
- [x] Валидатор + GPS-классификатор.
- [x] Melange v3–v20.
- [x] Импорт FIT/TCX/CSV/Zepp через UI.
- [x] Thresholds (dodofo, intervals.icu) + source tracking.
- [x] Wellness multi-provider (ICU + dodofo) с `sources_json`.
- [x] `auto_source = name` (наш провайдер).
- [x] `calories_active` / `calories_total` / `body_fat_pct` в wellness.
- [x] intervals.icu full provider: workouts + streams + events + plan.
- [x] Provider-aware `sync-run-streams-all` с прогрессом и отменой.
- [x] Fix `run_facts` INSERT (external_id / gps_* / raw_json).
- [x] Merge-семантика COALESCE в UPDATE.
- [x] `name` / `user_name` в `run_facts` + переименование в drawer.
- [x] Фильтры пробежек.
- [x] HR-зоны + окраска (CHARTS-чат).
- [x] ICU events / plan (v15/v16).
- [x] Mirror-семантика sync-plan.
- [x] **dodofo GPS из polyline** (задача A).
- [x] **Автосинхронизация при старте** (задача E).
- [x] **`pb:day-load-summary`**.
- [ ] Melange v22 — `run_facts.training_load`.
- [ ] Расчёт LTHR / threshold pace.
- [ ] Zepp-direct.

## Что НЕ делаем в 07

- Google Fit OAuth.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline.
- Бизнес-логику Core.
- Big-6.
- Live-журнал.
- Автопересчёт HR в старых dodofo-фактах (сервер не пересчитывает).


=====================================================

# Направление 07: Spice (данные, парсеры, провайдеры)

> Обновлено: 2026-10-05
> Статус: 99% готово.

## Роль
Все источники данных, парсеры, синхронизация, аналитика.

## Зона ответственности

- **Провайдеры** (`spice/providers/`):
  - `dodofoClient.ts` + `dodofoProvider.ts` — workouts, streams,
    thresholds, zones;
  - `intervalsIcuProvider.ts` — workouts, streams, thresholds,
    wellness (+ events TODO);
  - `dofekProvider.ts` — резерв Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `regionDetector.ts` — автодетект хоста Zepp.
- **Парсеры** (`spice/parsers/`):
  - `types.ts` — `UnifiedWorkout`, `RawWorkout`;
  - `fitParser.ts`, `tcxParser.ts`;
  - `stravaCsvParser.ts` — `activities.csv` из архива Strava;
  - `gpsClassifier.ts`.
- **Валидация** (`spice/validation/workoutValidator.ts`).
- **Хранилище** (`spice/runStreams/runStreamsStorage.ts`).

## Провайдеры: capabilities

| name | workouts | streams | thresholds | zones | wellness |
|---|---|---|---|---|---|
| `dodofo` | ✓ | ✓ | ✓ (resthr) | ✗ (404) | ✓ (сон, шаги, фазы) |
| `intervals-icu` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dofek-zepp` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `zepp-mcp` / `zeppbridge` | ✗ | ✗ | ✗ | ✗ | ✗ |

## Синтаксис ICU (проверено)

- **Единицы**: `m`=минуты, `s`=секунды, `h`=часы, `mtr`=метры, `km`.
- **Cue**: текст ПЕРЕД длительностью → подсказка на часах.
- **Секции**: `Warmup` / `Main Set` / `Cooldown` на отдельной строке.
- **Повторы**: `Nx` на отдельной строке, пустые строки до и после.
- **Вложенные повторы**: НЕ поддерживаются.
- **RPE**: НЕ поддерживается.
- **Цели**: `% HR`, `%`, `Z1..Z7`, `Pace`, `freeride`.
- **Первая строка** = название тренировки (обязательно).
- **Русский cue**: работает (UTF-8). Русские единицы (сек/мин/км) — нет.

## Источники данных (актуально)

| Источник | Что даёт | origin | source |
|---|---|---|---|
| dodofo.ru | workouts, streams, thresholds (resthr) | — | `dodofo` |
| Strava-архив FIT | workouts + streams | `strava-archive` | `fit` |
| Strava-архив TCX | workouts + streams | `strava-archive` | `tcx` |
| Strava `activities.csv` | метаданные без потоков | `strava-archive` | `strava-csv` |
| intervals.icu | workouts + streams + thresholds + wellness | `intervals-icu` | `intervals-icu` |
| Zepp FIT-папка (ручная) | workouts + streams | `zepp-app` | `fit` |
| Ручной импорт FIT/TCX | workouts + streams | `manual-import` | `fit` |

## Что реализовано

### Парсеры
- `parseFit(buffer, {externalId})` — Zepp/Garmin/Coros.
- `parseTcx(buffer, {externalId})` — Strava/Garmin/Polar.
- `parseStravaCsv(buffer)` — русская локаль, BOM, csv-parse.
  Даты в UTC (совпадает с FIT/ICU). Десятичная запятая. Фильтр
  по типу «Бег» (1053 из 1162 строк).
- `UnifiedStreams`: `secT`, `hr`, `speedKmh`, `cadence`,
  `elevationM`, `latlng`, `distM`.
- Валидатор: 8 флагов + confidence 0–100.
- GPS-классификатор: coveragePct, haversine, good/poor/lost.
- TCX parser: fallback «лапы → trackpoints» для durationSec /
  distanceM, если в лапах нет `TotalTimeSeconds`.

### Хранилище потоков
- `.msgpack` файлы, `extractMeta` считает `pointCount` / `channels`.
- `channels` распознаёт `latlng` как отдельный вид.
- Multi-source: `(run_fact_id, source)` — PRIMARY KEY.

### Импорт
- `pb:import-fit` / `pb:import-files` / `pb:import-fit-dir`.
- `pb:import-strava-csv(path)` — activities.csv.
- `pb:import-zepp-dir(dirPath, opts)` — папка Zepp FIT.
  Дедуп по `(source, external_id)`, без time-window skip
  (много-источниковая модель: Zepp coexists с Strava).
- Прогресс через `pb:import-progress`, отмена — `pb:import-cancel`.

### Синхронизация
- `pb:sync-now(from, to, providerName)` — список активностей.
- `pb:sync-run-streams(runFactId, providerName?)` — потоки одной.
- `pb:sync-run-streams-all(from, to, {provider})` — батч потоков
  с прогрессом и отменой.
- `pb:sync-thresholds(providerName?)` — пороги в профиль.
  Для ICU — из `/athlete/{id}` с fallback на последнюю активность.
- `pb:sync-wellness('intervals-icu', from, to)` — wellness.

### Профиль и пороги
- `profile` содержит `lthr`, `max_hr`, `resting_hr` + источники
  `lthr_source`, `max_hr_source`, `resting_hr_source`
  (значения: `icu` | `dodofo` | `manual` | `computed`).
- Merge-семантика COALESCE в UPDATE `run_facts`: повторный sync
  без изменений не затирает FIT-обогащение и не сбрасывает
  источник в `manual`.

### UI
- Панель «Подключения» — dodofo token, ICU key + athlete id,
  Zepp email/password.
- Панель «Синхронизация (API)» — диапазон, провайдер, 4 операции.
- Панель «Импорт файлов» — FIT-архив + Zepp-папка + Strava CSV.
- Панель «Wellness · intervals.icu» — таблица, скроллится,
  honor shared date range.
- Таблица «Пробежки» — группировка ±5 мин, бейджи источников,
  виртуализация, колонка «Название», фильтры.
- **Панель фильтров** — поиск по названию (debounce 300ms),
  чипы-источники, км/пульс/темп/длительность, потоки, сброс.
  Сохраняется в localStorage (`pb.filters.v1`).
- Drawer — единое название тренировки над вкладками (с inline
  редактором и копированием провайдерского), внутри вкладки —
  «Провайдерское: …», сводка, карта, график, потоки.
- `RunStreamsChart` (Chart.js), `GpsMapView` (MapLibre GL).
- Dialog «Отладка» — 3 таба + `analyzeChannels`.

### Бейджи источников

`sourceBadge(source, origin)`:
- `fit` + `strava-archive` → `fit` (песочный)
- `fit` + `zepp-app` → `zepp` (циан `#26c6da`)
- `fit` + `manual-import` → `manual` (зелёный)
- `tcx` → `tcx` (синий)
- `dodofo` → `dodofo` (оранжевый)
- `intervals-icu` → `intervals-icu` (красный)
- `strava-csv` → `strava-csv` (фиолетовый)

## TODO

### 1. HR-зоны + окраска (~2 ч) — следующая задача

- `pb:sync-zones('intervals-icu')` — читает `icu_hr_zones` из
  последней активности, сохраняет в `profile.hr_zones_json`.
- `RunStreamsChart`: сегментация HR-линии по зонам (синий → красный).
- `GpsMapView`: та же раскраска трека по HR-зонам.
- Полоса зон под графиком (время в каждой зоне из `icu_hr_zone_times`).

### 2. ICU events / plan (~2–3 ч)

- `fetchEvents`, `plan_events` (Melange v13), `pb:sync-plan`,
  мини-панель «План».
- Задел под Mentat.

### 3. Автосинхронизация (~30 мин)

- `mode='auto'` + `auto_on_start=1` → async sync при старте.

### 4. Расчёт LTHR / threshold pace (~3–4 ч)

- Движок поиска 20-мин максимума в streams.
- Запись в профиль с `source='computed'`.
- UI: показ оба значения (провайдерское + расчётное), активное
  выбирается в настройках.
- Лучше после CHARTS-чата (тот же движок).

### 5. Валидатор в UI (~1 ч)

- Показывать `validation.flags` и `confidence` в drawer'е.

### 6. Модель A группировки — день как заголовок (~4 ч)

Делать вместе с календарём «план-факт». См. `PROJECT_STATE.md`.

### 7. Zepp-direct (~3–4 ч, если понадобится)

- `@dofek/zepp-client`, если dodofo/ICU не покрывают.

### Отложено

- **Погода ICU** — нет данных: у ICU `has_weather: 0` для 49
  активностей, в Strava CSV заполнено только 11 из 1162 строк.
  Вернуться, если появится источник с погодой.
- **`extractMeta` backfill** — новые записи уже содержат `latlng`
  в `channels`, старые 265 записей можно пересинкать при случае.

## Проверка

```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
# Пусто

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT source, origin, COUNT(*) FROM run_facts
   GROUP BY source, origin;"
```

## Definition of Done

- [x] FIT/TCX парсеры + Strava CSV парсер.
- [x] Валидатор + GPS-классификатор.
- [x] Melange v3–v12.
- [x] Импорт FIT/TCX/CSV/Zepp через UI.
- [x] Thresholds (dodofo, intervals.icu) + source tracking.
- [x] Wellness (intervals.icu).
- [x] intervals.icu full provider: workouts + streams.
- [x] Provider-aware `sync-run-streams-all` с прогрессом и отменой.
- [x] Fix `run_facts` INSERT (external_id / gps_* / raw_json).
- [x] Merge-семантика COALESCE в UPDATE.
- [x] `name` / `user_name` в `run_facts` + переименование в drawer.
- [x] Фильтры пробежек (debounce, чипы источников).
- [x] Окно группировки 30 → 5 минут.
- [ ] HR-зоны + окраска.
- [x] ICU events / plan (v15/v16).
- [x] Mirror-семантика sync-plan.
- [ ] Расчёт LTHR / threshold pace.
- [ ] Модель A (день как заголовок) — с календарём.
- [x] `npx tsc --noEmit | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 07

- Google Fit OAuth.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline.
- Бизнес-логику Core.
- Big-6.
- Live-журнал.


=====================================================

# Направление 07: Spice (данные, парсеры, провайдеры)

> Обновлено: 2026-10-01
> Статус: 98% готово.

## Роль
Все источники данных, парсеры, синхронизация, аналитика.

## Зона ответственности

- **Провайдеры** (`spice/providers/`):
  - `dodofoClient.ts` + `dodofoProvider.ts` — workouts, streams,
    thresholds, zones;
  - `intervalsIcuProvider.ts` — workouts, streams, wellness
    (+ events TODO);
  - `dofekProvider.ts` — резерв Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `regionDetector.ts` — автодетект хоста Zepp.
- **Парсеры** (`spice/parsers/`):
  - `types.ts` — `UnifiedWorkout`;
  - `fitParser.ts`, `tcxParser.ts`;
  - `gpsClassifier.ts`.
- **Валидация** (`spice/validation/workoutValidator.ts`).
- **Хранилище** (`spice/runStreams/runStreamsStorage.ts`).

## Провайдеры: capabilities

| name | workouts | streams | thresholds | zones | wellness |
|---|---|---|---|---|---|
| `dodofo` | ✓ | ✓ | ✓ (resthr) | ✓ (пусто) | ✗ |
| `intervals-icu` | ✓ | ✓ | ✗ | ✗ | ✓ |
| `dofek-zepp` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `zepp-mcp` / `zeppbridge` | ✗ | ✗ | ✗ | ✗ | ✗ |

## Что реализовано

### Парсеры
- `parseFit(buffer, {externalId})` — Zepp/Garmin/Coros.
- `parseTcx(buffer, {externalId})` — Strava/Garmin/Polar.
- `UnifiedStreams`: `secT`, `hr`, `speedKmh`, `cadence`,
  `elevationM`, `latlng`, `distM`.
- Валидатор: 8 флагов + confidence 0–100.
- GPS-классификатор: coveragePct, haversine, good/poor/lost.
- TCX parser: fallback «лапы → trackpoints» для durationSec /
  distanceM, если в лапах нет `TotalTimeSeconds`
  (Strava-экспорты некоторых устройств).

### Хранилище потоков
- `.msgpack` файлы, `extractMeta` считает `pointCount` / `channels`.
- `channels` распознаёт `latlng` как отдельный вид (пары координат).
- Multi-source: `(run_fact_id, source)` — PRIMARY KEY.
- dodofo-специфичные каналы (`poly_sec_t`, `hr_zones`) — как есть.

### Импорт
- `pb:import-fit` — 1 файл.
- `pb:import-files` — массив путей, с origin.
- `pb:import-fit-dir` — папка, рекурсивно.
- Прогресс через `pb:import-progress` (current/total/filename +
  счётчики).
- Отмена через `pb:import-cancel`.

### Синхронизация

**dodofo:**
- `pb:sync-now(from, to, 'dodofo')` — список активностей.
- `pb:sync-run-streams(runFactId, 'dodofo')` — потоки одной.
- `pb:sync-run-streams-all(from, to, {provider: 'dodofo'})` —
  потоки за период.

**intervals.icu:**
- `pb:sync-now(from, to, 'intervals-icu')` — список активностей
  (`/athlete/{id}/activities`). ~2 сек на 265 записей.
- `pb:sync-run-streams-all(from, to, {provider: 'intervals-icu'})` —
  скачивает FIT каждой активности, парсит, пишет в `run_streams`
  и обогащает `run_facts` (distance / hr / gps).
- Прогресс через `pb:sync-progress` (current/total/externalId/
  fetched/skipped/failed).
- Отмена через `pb:sync-cancel`.

**wellness:**
- `pb:sync-wellness('intervals-icu', from, to)` — сон, RHR,
  CTL/ATL.

**Общее:**
- `pb:sync-thresholds(providerName?)` — из активного провайдера.
- Разделение `sync-now` и `sync-run-streams-all`: список качается
  мгновенно, тяжёлые FIT — отдельной операцией с прогрессом.

### UI
- Форма «Синхронизация» — по провайдеру (dodofo / intervals-icu /
  dofek-zepp).
- Панель «Профиль».
- Панель «Wellness · intervals.icu» + мини-таблица 14 дней.
- Панель «FIT-архив» + drag&drop + origin.
- Таблица «Пробежки» — группировка, виртуализация.
- Drawer сравнения — TabView источников одной тренировки.
- `RunStreamsChart` (Chart.js).
- `GpsMapView` (MapLibre GL + OpenFreeMap).
- Dialog «Отладка» — 3 таба + `analyzeChannels`.
- ProgressBar для импорта FIT и для sync потоков (с отменой).
- Бейджи источников: `fit`, `tcx`, `dodofo`, `manual`,
  `intervals-icu` (icu-red).

## TODO

### 1. intervals.icu: events / plan (~2 ч)

**Цель:** план тренировок (WORKOUT / PLAN / TARGET / NOTE / RACE).

**Эндпоинты:**
- `GET /athlete/{id}/events?oldest=&newest=` — план.

**Задачи:**
- `fetchEvents` — отдельный контракт (не `RawWorkout`).
- Новая таблица `plan_events` (Melange v10).
- `pb:sync-plan(from, to)`.
- UI: панель «План».
- Задел под Mentat (03).

Подробности — в `07_SPICE_PLAN.md`.

### 2. UI: панель «Активности · intervals.icu» (~1 ч)

**Цель:** отдельная панель для ICU-активностей, по аналогии с
панелью wellness. Убирает путаницу из общей «Синхронизации».

- Кнопка «Обновить список» → `sync-now('intervals-icu')`.
- Кнопка «Загрузить потоки» → `sync-run-streams-all`.
- ProgressBar с отменой.
- Мини-таблица последних N дней.
- Статус: всего записей, с потоками, последний sync.

### 3. Импорт Strava `activities.csv` (~2 ч)

**Цель:** метаданные всех тренировок из архива Strava, включая те,
для которых нет FIT/TCX.

- `source='strava-csv'`, `origin='strava-archive'`,
  `external_id='strava-csv:<Activity ID>'`.
- Парсер CSV, маппинг в `RawWorkout`.
- `pb:import-strava-csv(path)`.
- Группировка в UI подхватит автоматически.

### 4. Zepp FIT-папка (~30 мин)

**Цель:** вторая папка в FIT-архив для ручных выгрузок с Zepp.

- `origin='zepp-app'`.
- Отдельная кнопка «Обновить Zepp».
- Возможно автосканирование при старте.

### 5. Валидатор в UI (~1 ч)

- Показывать `validation.flags` и `confidence` в drawer'е.
- Бейджи у источников.

### 6. Авто-синхронизация (~30 мин)

- `mode='auto'` + `auto_on_start=1` → async sync при старте.

### 7. Zepp-direct (~3–4 ч, если нужно)

- Проверить `regionDetector.ts`.
- `@dofek/zepp-client` для login, streams, sleep.
- Fallback, если dodofo/ICU не покрывают.

### 8.

- Модель A группировки пробежек: день как заголовок, тренировки под ним.
- В шапке дня — агрегаты (всего км, время, источники). 
- Клик по тренировке — drawer с источниками. 
- Клик по дню (в будущем) — дневной обзор (wellness + погода + сводка).
- Делать вместе с календарём «план-факт».

### 9. Улучшения графиков и карты

- Окраска трека по каналу (HR / speed / cadence / elevation).
- Мультиканал на графике.
- Zoom/pan.
- Синхронизация карта↔график.
- **Отдельный чат** `CHARTS_CHAT_START.md`.

## Проверка

```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
# Пусто

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT source, origin, COUNT(*) FROM run_facts
   GROUP BY source, origin;"
```

```js
await window.electronAPI.pb.syncWellness('intervals-icu', '2026-09-20', '2026-09-30')
// → { success: true, provider: 'intervals-icu', added: 0, updated: 11, total: 11 }

// Прогон списка ICU
const t0 = Date.now();
await window.electronAPI.pb.syncNow('2020-01-01', '2026-10-01', 'intervals-icu')
// → ~2 сек, { added: 0, updated: 265, total: 265 }

// Прогон потоков ICU
await window.electronAPI.pb.syncRunStreamsAll(
  '2023-01-01', '2026-09-30',
  { provider: 'intervals-icu' }
)
// → { fetched: N, skipped: M, failed: 0, total: N+M }
```

## Definition of Done

- [x] FIT/TCX парсеры на реальных файлах.
- [x] TCX fallback: duration/distance из trackpoints, если в лапах
      нет `TotalTimeSeconds`.
- [x] Валидатор + GPS-классификатор.
- [x] Melange v3–v9.
- [x] Импорт FIT/TCX через UI.
- [x] Thresholds (resthr).
- [x] Wellness (intervals.icu).
- [x] intervals.icu full provider: workouts + streams.
- [x] Provider-aware `sync-run-streams-all` с прогрессом и отменой.
- [x] Fix `run_facts` INSERT (external_id / gps_* / raw_json).
- [x] Merge-семантика COALESCE в UPDATE.
- [x] `extractMeta` распознаёт `latlng`.
- [ ] intervals.icu events / plan.
- [ ] Импорт Strava `activities.csv`.
- [ ] Zepp FIT-папка.
- [ ] Валидатор в UI.
- [x] `npx tsc --noEmit | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 07

- Google Fit OAuth.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline.
- Бизнес-логику Core.
- Big-6.
- Live-журнал.


=====================================================

# Направление 07: Spice (данные, парсеры, провайдеры)

> Обновлено: 2026-09-30 (поздний вечер)
> Статус: 95% готово.

## Роль
Все источники данных, парсеры, синхронизация, аналитика.

## Зона ответственности

- **Провайдеры** (`spice/providers/`):
  - `dodofoClient.ts` + `dodofoProvider.ts` — workouts, streams,
    thresholds, zones;
  - `intervalsIcuProvider.ts` — wellness (+ workouts/plan TODO);
  - `dofekProvider.ts` — резерв Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `regionDetector.ts` — автодетект хоста Zepp.
- **Парсеры** (`spice/parsers/`):
  - `types.ts` — `UnifiedWorkout`;
  - `fitParser.ts`, `tcxParser.ts`;
  - `gpsClassifier.ts`.
- **Валидация** (`spice/validation/workoutValidator.ts`).
- **Хранилище** (`spice/runStreams/runStreamsStorage.ts`).

## Провайдеры: capabilities

| name | workouts | streams | thresholds | zones | wellness |
|---|---|---|---|---|---|
| `dodofo` | ✓ | ✓ | ✓ (resthr) | ✓ (пусто) | ✗ |
| `intervals-icu` | ✗ (TODO) | ✗ (TODO) | ✗ | ✗ | ✓ |
| `dofek-zepp` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `zepp-mcp` / `zeppbridge` | ✗ | ✗ | ✗ | ✗ | ✗ |

## Что реализовано

### Парсеры
- `parseFit(buffer, {externalId})` — Zepp/Garmin/Coros.
- `parseTcx(buffer, {externalId})` — Strava/Garmin/Polar.
- `UnifiedStreams`: `secT`, `hr`, `speedKmh`, `cadence`,
  `elevationM`, `latlng`, `distM`.
- Валидатор: 8 флагов + confidence 0–100.
- GPS-классификатор: coveragePct, haversine, good/poor/lost.

### Хранилище потоков
- `.msgpack` файлы, `extractMeta` считает `pointCount` / `channels`.
- Multi-source: `(run_fact_id, source)` — PRIMARY KEY.
- dodofo-специфичные каналы (`poly_sec_t`, `hr_zones`) — как есть.

### Импорт
- `pb:import-fit` — 1 файл.
- `pb:import-files` — массив путей, с origin.
- `pb:import-fit-dir` — папка, рекурсивно.
- Прогресс через `pb:import-progress` (current/total/filename +
  счётчики).
- Отмена через `pb:import-cancel`.

### Синхронизация
- `pb:sync-now(from, to)` — из dodofo.
- `pb:sync-thresholds(providerName?)` — из активного.
- `pb:sync-wellness(providerName, from, to)` — из intervals.icu.

### UI
- Форма «Синхронизация» — по провайдеру.
- Панель «Профиль».
- Панель «Wellness · intervals.icu» + мини-таблица 14 дней.
- Панель «FIT-архив» + drag&drop + origin.
- Таблица «Пробежки» — группировка, виртуализация.
- Drawer сравнения — TabView источников одной тренировки.
- `RunStreamsChart` (Chart.js).
- `GpsMapView` (MapLibre GL + OpenFreeMap).
- Dialog «Отладка» — 3 таба + `analyzeChannels`.

## TODO

### 1. intervals.icu — full provider (~4–6 ч)

**Цель:** подключить workouts, streams, plan.

**Эндпоинты:**
- `GET /api/v1/athlete/{id}/activities?oldest=&newest=` — список;
- `GET /api/v1/activity/{id}` — деталь;
- `GET /api/v1/activity/{id}/streams?types=time,heartrate,distance,velocity_smooth,cadence,altitude,latlng` — потоки;
- `GET /api/v1/activity/{id}/file` — FIT/TCX (raw);
- `GET /api/v1/athlete/{id}/events?oldest=&newest=` — план.

**Задачи:**
- `fetchWorkouts` — маппинг в `RawWorkout`.
- `fetchStreams` — маппинг в `UnifiedStreams`.
- `fetchEvents` — отдельный контракт (не `RawWorkout`).
- Регистрация в `pb:sync-now` (провайдер-aware).
- UI: переключатель активного источника для workouts.
- Origin: `intervals-icu`.
- Дедупликация с существующими записями (интервалы содержат
  `external_id` источника — `strava:12345`, `fit:...`).

### 2. `pb:sync-plan` (~2 ч)

- Календарь и план тренировок → будущие планы.
- Новая таблица `plan_events` (или использовать `run_plans`).
- Задел под Mentat (03).

### 3. Валидатор в UI (~1 ч)

- Показывать `validation.flags` и `confidence` в drawer'е.
- Бейджи у источников.

### 4. Авто-синхронизация (~30 мин)

- `mode='auto'` + `auto_on_start=1` → async sync при старте.

### 5. Zepp-direct (~3–4 ч, если нужно)

- Проверить `regionDetector.ts`.
- `@dofek/zepp-client` для login, streams, sleep.
- Fallback, если dodofo/ICU не покрывают.

### 6. Улучшения графиков и карты

- Окраска трека по каналу (HR / speed / cadence / elevation).
- Мультиканал на графике.
- Zoom/pan.
- Синхронизация карта↔график.
- **Отдельный чат** `CHARTS_CHAT_START.md`.

## Проверка

```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
# Пусто

sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
  "SELECT source, origin, COUNT(*) FROM run_facts
   GROUP BY source, origin;"
```

```js
await window.electronAPI.pb.syncWellness('intervals-icu', '2026-09-20', '2026-09-30')
// → { success: true, provider: 'intervals-icu', added: 0, updated: 11, total: 11 }
```

## Definition of Done

- [x] FIT/TCX парсеры на реальных файлах.
- [x] Валидатор + GPS-классификатор.
- [x] Melange v3–v9.
- [x] Импорт FIT/TCX через UI.
- [x] Thresholds (resthr).
- [x] Wellness (intervals.icu).
- [ ] intervals.icu full provider.
- [ ] `pb:sync-plan`.
- [ ] Валидатор в UI.
- [x] `npx tsc --noEmit | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 07

- Google Fit OAuth.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline.
- Бизнес-логику Core.
- Big-6.
- Live-журнал.


===================================================================

# Направление 07: Spice (аналитика, FIT/TCX, dodofo, intervals.icu)

> Обновлено: 2026-09-30
> Статус: в активной разработке.

## Роль

Провайдеры данных, импорт файлов, синхронизация, аналитика, графики.
Spice — то, через что тренировочные данные попадают в Melange и
отображаются в UI.

## Зона ответственности

- **Провайдеры** (`spice/providers/`):
  - `dodofoClient.ts` + `dodofoProvider.ts` — основной агрегатор;
  - `dofekProvider.ts` — резерв Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `regionDetector.ts` — автодетект хоста Zepp.
- **Парсеры файлов** (`spice/parsers/`):
  - `types.ts` — `UnifiedWorkout`, `UnifiedStreams`;
  - `fitParser.ts` — `.fit`;
  - `tcxParser.ts` — `.tcx`;
  - `gpsClassifier.ts` — coverage, haversine, good/poor/lost.
- **Валидация** (`spice/validation/workoutValidator.ts`).
- **Хранилище потоков** (`spice/runStreams/runStreamsStorage.ts`).
- **Синхронизация:** ручная (`pb:sync-now`) — работает; авто —
  не реализовано.
- **Репозитории:** `runFactsRepo`, `runStreamsRepo` — готовы;
  `recoveryRepo`, `thresholdsRepo` — TODO.

## Текущее состояние (2026-09-30)

### Реализовано

**Провайдеры**
- `DodofoProvider`: `isAvailable`, `fetchWorkouts`, `fetchStreams`,
  `fetchThresholds`, `fetchZones`.
- Capabilities: workouts=true, streams=true, thresholds=true,
  zones=true, wellness=false.
- `DofekZeppProvider`: workouts=true, остальное false.
- `ZeppMcpProvider`, `ZeppBridgeProvider` — все false.
- `regionDetector.ts` — перебор хостов.

**Парсеры**
- `UnifiedWorkout` — единый формат, camelCase (`secT`, `distM`).
- `parseFit(buffer, opts)` — Zepp/Garmin/Coros.
- `parseTcx(buffer, opts)` — Strava/Garmin/Polar.
- Автоопределение `.fit` / `.tcx`, поддержка `.gz`.
- `gpsClassifier.ts` — haversine, coveragePct, класс good/poor/lost.
- `workoutValidator.ts` — флаги: `hr_flatline`, `power_out_of_range`,
  `pace_anomaly`, `elevation_suspicious`, `gps_lost`,
  `distance_mismatch`, `empty_streams`, `duration_mismatch`.
  Confidence 0–100.

**Хранилище потоков**
- `saveRunStreamsSync` / `loadRunStreamsSync`.
- Файлы: `{userData}/prana_bindu/run_streams/{source}/{YYYY}/{id}.msgpack`.
- `extractMeta` — считает `pointCount` и `channels` для UI.
- `runStreamsRepo.ts` — CRUD метаданных в SQLite.

**IPC (`pb:*`)**
- Провайдеры: `pb:dodofo-connect`, `pb:dodofo-token-status`,
  `pb:zepp-connect`, `pb:zepp-check-provider`,
  `pb:provider-capabilities`.
- Профиль: `pb:get-profile`, `pb:update-profile`.
- Синхронизация: `pb:sync-now`, `pb:sync-thresholds`.
- Тренировки: `pb:list-run-facts`, `pb:list-run-facts-by-date`.
- Потоки: `pb:sync-run-streams`, `pb:sync-run-streams-all`,
  `pb:get-run-streams-meta`, `pb:get-run-streams`,
  `pb:list-run-streams-batch`.
- Импорт: `pb:import-fit`, `pb:import-files`, `pb:import-fit-dir`,
  `pb:import-cancel`, `pb:pick-files`, `pb:pick-directory`,
  `pb:fit-archive-path-get`.
- Отладка: `pb:debug-streams`, `pb:debug-thresholds`, `pb:debug-zones`,
  `pb:debug-parse-fit`, `pb:backfill-start-time`.

**События**
- `pb:import-progress` — прогресс батч-импорта (current/total/file
  + счётчики).

**UI**
- Форма «Синхронизация» по провайдеру.
- Панель «Профиль» (maxHr / lthr / restingHr).
- Панель «FIT-архив» — путь, выбор папки, обновление, ручной импорт,
  drag&drop, Dropdown origin.
- Прогресс-бар импорта с отменой.
- Таблица «Пробежки» — группировка по дате,
  виртуализация, сохранение периода, кнопки «30 дней» / «За всё время».
- Бейджи источников в колонке.
- Drawer сравнения: TabView источников одной тренировки.
- `RunStreamsChart` — график канала vs X-оси (secT / distM).
- Dialog «Отладка» — 3 таба + анализ плоских каналов.
- Кнопка «Подтянуть пороги».

**Импорт FIT/TCX**
- 945 записей в БД:
  - dodofo: 260;
  - fit: 71;
  - tcx: 617.
- origin: `strava-archive`, `zepp-app`, `manual-import`.
- Дедупликация по `(source, external_id)`.
- `origin` не перезаписывается при повторных импортах.

### Не реализовано

- Карта GPS-трека (MapLibre / Leaflet).
- Wellness → `recovery_logs`.
- intervals.icu.
- Авто-синхронизация при старте.
- Валидатор в UI (флаги в drawer).
- Google Fit OAuth.

## Приоритеты

### 1. Карта GPS-трека (~4–6 ч)

**Зачем:** визуально сопоставить пульс, темп и рельеф.

**Стек:** MapLibre GL JS (open-source) или Leaflet.

**Данные:** `run_streams[source].latlng` + `hr` + `elevationM`.
Каналы уже в `.msgpack`.

**UI:** кнопка «Карта» в drawer → показывает трек.
Опционально: раскраска линии по HR.

**Ограничение:** учитывать `gpsQuality`:
- `good` — трек рисуется.
- `poor` — пунктир в пропусках.
- `lost` — не рисуется, только метки.

### 2. Wellness → `recovery_logs` (~1 ч)

- `DodofoProvider.fetchWellness(from, to)` → `/api/v1/wellness`.
- `recoveryRepo.ts` — `upsertRecoveryLog` по `date`.
- В `pb:sync-now` — второй проход.
- **Нужен JSON-пример от `/wellness`.**

### 3. intervals.icu (~3–4 ч)

- Регистрация, получение API-ключа или OAuth.
- Провайдер `intervalsIcuProvider.ts`.
- Capabilities: workouts=true, streams=true, thresholds=true,
  **plan=true**.
- Уникальная ценность — план и календарь тренировок.

### 4. Валидатор в UI (~1 ч)

- В drawer показывать `validation.flags` и `confidence`.
- Бейджи у источников в таблице.

### 5. Авто-синхронизация при старте (~30 мин)

- В `main.ts` после `openMelange` + `seed`:
  - если `mode='auto'` и `auto_on_start=1` — `fetchWorkouts` за N дней.
- Не блокировать старт.

### 6. Google Fit OAuth (отложено)

## Проверка (ручные сценарии)

1. **Синк dodofo:**
   ```js
   await window.electronAPI.pb.syncNow('2026-09-01', '2026-09-30')
   ```

2. **Импорт FIT:**
   ```js
   await window.electronAPI.pb.importFit('/path/to/run.fit')
   ```

3. **Импорт файлов (много):**
   ```js
   await window.electronAPI.pb.importFiles(['/path/a.fit', '/path/b.tcx'])
   ```

4. **Проверка БД:**
   ```bash
   sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
     "SELECT source, origin, COUNT(*) FROM run_facts
      GROUP BY source, origin;"
   ```

5. **Группировка:**
   ```js
   await window.electronAPI.pb.listRunFactsByDate('2026-09-12')
   // → 2 источника (fit, dodofo)
   ```

## Definition of Done

- [x] FIT/TCX парсеры работают на реальных файлах.
- [x] Валидатор выдаёт флаги (без UI-отображения).
- [x] GPS-качество классифицируется.
- [x] Melange v3–v6.
- [x] `pb:import-fit` / `pb:import-files` работают через UI.
- [x] Thresholds подтягиваются в `profile` (resthr).
- [ ] Карта GPS-трека.
- [ ] Wellness → `recovery_logs`.
- [ ] intervals.icu.
- [x] `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 07

- Google Fit OAuth.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline.
- Бизнес-логику Core.
- Big-6.
- Live-журнал (отдельный проект).
- Схему БД целиком — это 08_MELANGE.


================================================================

# Направление 07: Spice (аналитика, FIT/TCX, dodofo, Google Fit)

> Обновлено: 2026-09-28
> Статус: в активной разработке.

## Роль
Провайдеры данных, импорт файлов, синхронизация, аналитика, графики.
Spice — то, через что тренировочные данные попадают в Melange и
отображаются в UI.

## Зона ответственности

- **Импорт FIT/TCX** (`spice/parsers/`) — **приоритет №1**.
- **Валидация данных** (`spice/validation/`).
- **Провайдеры** (`spice/providers/`):
  - `dodofoClient.ts` + `dodofoProvider.ts` — wellness, thresholds, zones;
  - `fileImportProvider.ts` — FIT/TCX;
  - `regionDetector.ts` + `dofekProvider.ts` — резерв Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки.
- **Синхронизация:** ручная (`pb:sync-now`) — **работает**; авто —
  не реализовано.
- **Репозитории:** `runFactsRepo` (готов), `recoveryRepo`, `thresholdsRepo`.
- **Google Fit** — отложено.

## Текущее состояние (2026-09-28)

### Реализовано

**`spice/providers/dodofoClient.ts`**
- `dodofoRequest<T>(path, token, query?)` — GET, Bearer, таймаут 20 сек.
- `DodofoApiError` — `status`, `title`, `detail`, `code`.
- Типы: `DodofoActivity`, `DodofoActivitiesResponse`,
  `DodofoThresholdsResponse`, `DodofoStreams`, `DodofoZoneTime`.

**`spice/providers/dodofoProvider.ts`**
- `DodofoProvider implements ZeppDataProvider`:
  - `isAvailable()`;
  - `fetchWorkouts(from, to)` — пагинация, `sport_type=run`;
  - `fetchThresholds()`;
  - `fetchStreams(id)`.
- Числовые поля нормализуются в int.

**Melange v1 + v2**
- `db.ts`, `schema.ts`, `migrations.ts`, `seed.ts`, `types.ts`, `index.ts`.
- `repositories/profileRepo.ts`, `syncRepo.ts`, `runFactsRepo.ts`.

**`runFactsRepo.ts`**
- `upsertRunFact(db, fact: RawWorkout)` — идемпотентно по
  `(source, external_id)`.
- `listRunFacts`, `getRunFactByExternalId`, `countRunFacts`.
- Маппинг `RawWorkout` → `run_facts` (date — локальная зона,
  pace — `M:SS`, int для числовых).
- При update не трогаются: `plan_id`, `rpe`, `notes`.

**IPC (`pb:*`)**
- `pb:dodofo-connect`, `pb:dodofo-token-status`.
- `pb:zepp-check-provider`.
- `pb:sync-now(from, to)` — синхронизация.
- `pb:list-run-facts(from, to)`.

**UI**
- Форма «Синхронизация» меняется по провайдеру.
- Блок «Диапазон ручной синхронизации»: два календаря + кнопка.
- Панель «Пробежки (N)» — `DataTable`.

**Проверено:** 14 тренировок за сентябрь 2026, повтор → 0 added /
14 update. `run_facts` содержит реальные записи.

### Не реализовано

- FIT/TCX импорт.
- Валидатор данных.
- GPS-классификатор (good/poor/lost).
- Авто-синхронизация.
- Wellness → `recovery_logs`.
- Thresholds → `profile`.
- Streams → `run_facts.raw_json` или `run_streams`.
- Google Fit OAuth.

## Приоритеты (в порядке работ)

### 1. FIT/TCX импорт — база всего

**Причина:** данные dodofo искажены (пульс по км, мощность 10–34 Вт,
темп с провалами, высота 6704 м на 7 км). FIT/TCX — первоисточник.

**Файлы:**
- `spice/parsers/types.ts` — `UnifiedWorkout`.
- `spice/parsers/fitParser.ts` — `parseFit(buffer): UnifiedWorkout`.
- `spice/parsers/tcxParser.ts` — `parseTcx(buffer): UnifiedWorkout`.

**Библиотеки:**
- FIT: `fit-file-parser` (pure JS, зрелая).
- TCX: `fast-xml-parser` (быстрая, потоковая).

**UnifiedWorkout:**
```ts
interface UnifiedWorkout {
  source: 'fit' | 'tcx' | 'dodofo' | 'manual' | 'live-journal';
  externalId: string;
  startTime: string;         // ISO 8601 UTC
  durationSec: number;
  distanceM: number;
  sport: 'run' | 'walk' | 'ride';
  streams?: {
    distM?: number[];
    secT?: number[];
    hr?: number[];
    paceMinPerKm?: number[];
    cadence?: number[];
    power?: number[];
    elevation?: number[];
    latlng?: [number, number][];
    gpsAccuracy?: number[];   // hdop
  };
  summary: {
    avgHr?: number;
    maxHr?: number;
    avgPace?: string;
    elevationGain?: number;
    gpsQuality: 'good' | 'poor' | 'lost';
    distanceSource: 'gps' | 'accelerometer' | 'manual';
    gpsCoveragePct: number;
    gpsDistanceM?: number;
    accelDistanceM?: number;
    distanceDeltaPct?: number;
  };
  validation: {
    flags: ValidationFlag[];
    confidence: number;       // 0..100
  };
  laps?: Lap[];
}
```

**Ключевые поля FIT для чтения:**
- `position_lat`, `position_long` — GPS.
- `distance` — device distance (акселерометр на беге).
- `enhanced_speed` — скорость от шагомера.
- `heart_rate`, `cadence`, `enhanced_altitude`, `temperature`.
- `gps_accuracy` / `hdop` — для классификации качества GPS.
- `lap` messages — интервалы.

### 2. Валидатор данных (#8 с марафона)

**Файл:** `spice/validation/workoutValidator.ts`.

**Флаги:**
- `hr_flatline` — пульс не меняется > 3 км подряд;
- `power_out_of_range` — мощность < 100 Вт на беге или > 500 Вт;
- `pace_anomaly` — темп вне ±40 % от среднего;
- `elevation_suspicious` — `elevation_gain_m > distance_km * 300`;
- `gps_lost` — покрытие < 50 %;
- `distance_mismatch` — GPS vs акселерометр > 15 %.

**Confidence (0..100):** интегральная оценка. < 50 — предложить RPE.

### 3. GPS-классификатор (good/poor/lost)

**Логика:**
- Считаем долю точек с `hdop < 3` (или `gps_accuracy < 20`).
- Считаем разницу `(gps_distance - accel_distance) / accel_distance`.
- Классифицируем:
  - `good`: coverage ≥ 95 %, delta < 3 %;
  - `poor`: coverage 50–95 %, delta 3–15 %;
  - `lost`: coverage < 50 %, или delta > 15 %, или пропуски > 500 м.

**Следствия:**
- `good` → дистанция/темп от GPS.
- `poor`/`lost` → от акселерометра.
- `lost` → трек не рисуется.

### 4. Melange v3

**Миграция:**
```sql
ALTER TABLE run_facts ADD COLUMN gps_quality TEXT;
ALTER TABLE run_facts ADD COLUMN distance_source TEXT;
ALTER TABLE run_facts ADD COLUMN gps_coverage_pct REAL;
```

Расширение `RunFactRow` и `upsertRunFact` для новых полей.

### 5. `pb:import-file(filePath)`

**Логика:**
1. Читаем файл (`fs.readFile`).
2. Определяем формат по расширению (`.fit`, `.tcx`).
3. Парсим через `fitParser` / `tcxParser`.
4. Валидируем.
5. Классифицируем GPS.
6. `upsertRunFact(db, unified)`.

**UI:**
- Кнопка «Импортировать файл» + drag&drop зона.
- Выбор через `dialog.showOpenDialog({ filters: [{ name: 'FIT/TCX',
  extensions: ['fit', 'tcx'] }] })`.
- Предпросмотр: дата, дистанция, темп, пульс, флаги валидатора.
- Подтверждение → запись.

### 6. Thresholds → `profile`

- `DodofoProvider.fetchThresholds()` — есть.
- `pb:sync-thresholds`:
  - `lthr.value` → `profile.lthr`;
  - `hrmax.value` → `profile.max_hr`;
  - `resthr.value` → `profile.resting_hr`.
- UI: кнопка «Подтянуть пороги».

### 7. Wellness → `recovery_logs`

- `DodofoProvider.fetchWellness(from, to)` → `GET /api/v1/wellness`.
- `recoveryRepo.ts`: `upsertRecoveryLog(db, log)` по `date`.
- Маппинг:
  - `sleep_hours` → `sleep_hours`;
  - `sleep_quality` → `sleep_quality`;
  - `hrv_ms` → `hrv`;
  - `resting_hr` → `resting_hr`.
- В `pb:sync-now` — второй проход.

### 8. Авто-синхронизация при старте

- В `main.ts` после `openMelange` + `seed`:
  - если `mode = 'auto'` и `auto_on_start = 1` — `fetchWorkouts`
    за последние N дней асинхронно.
- Не блокировать старт.

### 9. Streams → решение по хранению

- Пока — `run_facts.raw_json` (проще).
- Если нужен быстрый доступ к конкретным секундам — вынести
  в `run_streams` (Melange v4).
- Решение — после работающего FIT-импорта.

### 10. Миграция v4 (план)

```sql
CREATE TABLE IF NOT EXISTS run_streams (
  run_fact_id INTEGER PRIMARY KEY,
  dist_m TEXT,        -- JSON
  sec_t TEXT,
  hr TEXT,
  speed_kmh TEXT,
  cadence_rpm TEXT,
  power_w TEXT,
  elevation_m TEXT,
  latlng TEXT,
  hr_zones TEXT,      -- [{zone, name, seconds, percent}]
  power_zones TEXT,
  summary_json TEXT,
  FOREIGN KEY (run_fact_id) REFERENCES run_facts(id) ON DELETE CASCADE
);
```

## Ограничения

- Никаких импортов Electron в `spice/` — только чистый TS + fetch + fs.
- Токены не логировать целиком.
- `safeStorage` — только в handler.
- Синхронизация идемпотентна.
- Не блокировать UI (async).
- `fetchWorkouts` фильтрует `sport_type=run` и `status='ready'`.
- `date` в `run_facts` — локальная зона атлета.
- `avg_hr`, `max_hr`, `duration_sec` — int.
- `elevation_gain_m` от dodofo не использовать, брать из FIT.
- GPS-трек — только для визуализации (учитывать `hide_endpoints`).
  Аналитика — на акселерометре.

## Проверка (ручные сценарии)

1. **Синхронизация dodofo:**
   ```js
   await window.electronAPI.pb.syncNow('2026-09-01', '2026-09-30')
   // → { success: true, added: 14, updated: 0, skipped: 0, total: 14 }
   ```
2. **Импорт FIT-файла (после реализации):**
   ```js
   await window.electronAPI.pb.importFile('/path/to/run.fit')
   // → { success: true, id, flags: [], gpsQuality: 'poor' }
   ```
3. **Проверка БД:**
   ```bash
   sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
     "SELECT date, actual_km, avg_hr, gps_quality, distance_source
      FROM run_facts ORDER BY date DESC LIMIT 5;"
   ```
4. **Пороги:**
   ```js
   await window.electronAPI.pb.syncThresholds()
   await window.electronAPI.pb.getProfile()
   // → { maxHr: ..., lactateThresholdHr: ..., restingHr: ... }
   ```

## Definition of Done

- FIT/TCX парсеры работают на реальных файлах (марафон 27.09).
- Валидатор выдаёт флаги.
- GPS-качество классифицируется.
- Melange v3 — колонки в `run_facts`.
- `pb:import-file` работает через UI.
- Thresholds подтягиваются в `profile`.
- Wellness подтягивается в `recovery_logs`.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.

## Что НЕ делаем в 07

- Google Fit OAuth — отдельная задача.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline — 10_UI_DUNA.
- Бизнес-логику Core — 02_CORE.
- Big-6 — 05_CRYSKNIFE.
- Live-журнал — отдельный проект.
- Схему БД целиком — 08_MELANGE.


=======================================================

# Направление 07: Spice (аналитика, dodofo, Google Fit)

> Обновлено: 2026-09-28

## Роль
Провайдеры данных, синхронизация, аналитика, графики. Spice — это то,
через что тренировочные данные попадают в Melange и отображаются в UI.

## Зона ответственности
- **Провайдеры** в `src/main/services/pranaBindu/spice/providers/`:
  - `dodofoClient.ts` + `dodofoProvider.ts` — основной источник;
  - `regionDetector.ts` + `dofekProvider.ts` — резервный Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `types.ts`, `index.ts` — интерфейс и реестр.
- **Синхронизация**: ручная (`pb:sync-now`) — **работает**; авто (при старте) — не реализовано.
- **Репозитории записи** тренировок в Melange (`runFactsRepo` — готов,
  `recoveryRepo`, `thresholdsRepo` — по мере надобности).
- **Google Fit** — отложено, приоритет ниже dodofo.

## Текущее состояние (2026-09-28)

### Реализовано

**`spice/providers/dodofoClient.ts`**
- `dodofoRequest<T>(path, token, query?)` — GET с Bearer-токеном,
  таймаут 20 сек, разбор RFC 7807 `Problem`.
- `DodofoApiError` — типизированная ошибка с `status`, `title`,
  `detail`, `code`.
- Типы ответов: `DodofoActivity`, `DodofoActivitiesResponse`,
  `DodofoThresholdsResponse`, `DodofoStreams`, `DodofoZoneTime`.

**`spice/providers/dodofoProvider.ts`**
- Класс `DodofoProvider implements ZeppDataProvider`:
  - `name = 'dodofo'`;
  - `isAvailable()` — проверка токена через `/api/v1/me/thresholds`;
  - `fetchWorkouts(from, to)` — список тренировок с фильтром
    `sport_type=run`, пагинация по `has_more` (до 20 страниц),
    маппинг в `RawWorkout`;
  - `fetchThresholds()` — LTHR/HRmax/RestHR/FTP;
  - `fetchStreams(id)` — потоки + зоны Коггана.
- Конструктор принимает колбэк `getToken(): string | null` —
  расшифровка токена снаружи (в handler).
- **Числовые поля нормализуются в int** (`Math.round`) до `RawWorkout`:
  `distanceM`, `durationS`, `avgHr`. Иначе `node:sqlite` кладёт float
  в `INTEGER`-колонки (`avg_hr = 144.90794864791` — баг исправлен).

**Melange (v2)**
- Колонки в `sync_settings`: `dodofo_token` (шифр.), `dodofo_user_id`,
  `dodofo_username`, `dodofo_last_sync_at`, `dodofo_last_sync_status`.
- Репозиторий `syncRepo.ts`: `setDodofoToken`, `getDodofoTokenEncrypted`,
  `hasDodofoToken`.

**Melange: `runFactsRepo.ts` (новый)**
- `upsertRunFact(db, fact: RawWorkout): { inserted: boolean; id: number }`.
  Идемпотентность по `(source, external_id)` — реализована через
  `SELECT` + `INSERT`/`UPDATE` (индекс `idx_run_facts_external` **не UNIQUE**,
  поэтому `ON CONFLICT` неприменим).
- `listRunFacts(db, from, to): RunFactRow[]` — для UI и аналитики.
- `getRunFactByExternalId(db, source, externalId): RunFactRow | null`.
- `countRunFacts(db, from, to): number`.
- Маппинг `RawWorkout` → `run_facts`:
  - `externalId` → `external_id`;
  - `startTime` → `date` (**локальная зона атлета**, YYYY-MM-DD);
  - `distanceM / 1000` → `actual_km` (округление до 3 знаков);
  - `durationS`, `distanceM` → `actual_pace` (`"M:SS"`, из `durationS / (distanceM/1000)`);
  - `avgHr` → `avg_hr`, `maxHr` → `max_hr` (int, `Math.round`);
  - `durationS` → `duration_sec` (int);
  - `source` → `source`;
  - `raw` → `raw_json` (`JSON.stringify`).
- При update **не трогаются**: `plan_id`, `rpe`, `notes` — это ручные
  поля пользователя, синк их не знает.

**IPC (`pb:*`)**
- `pb:dodofo-connect(token)` — сохранение + проверка токена;
- `pb:dodofo-token-status` — есть/нет токена;
- `pb:zepp-check-provider(name)` — работает для всех, включая dodofo;
- **`pb:sync-now(from, to)` (новый)** — ручная синхронизация:
  1. берёт `getProvider('dodofo')`;
  2. `await provider.fetchWorkouts(from, to)`;
  3. для каждого `RawWorkout` — `upsertRunFact`;
  4. возвращает `{ success, added, updated, skipped, total }`;
  5. обновляет `dodofo_last_sync_at` / `dodofo_last_sync_status`.
- **`pb:list-run-facts(from, to)` (новый)** — возвращает `{ success, items, total }`
  для UI-таблицы.

**Preload (`src/preload.ts`)**
- `electronAPI.pb.syncNow(from, to)`;
- `electronAPI.pb.listRunFacts(from, to)`.

**UI (`src/pages/PranaBinduPage/`)**
- Форма «Синхронизация» меняется по выбранному провайдеру.
- Для dodofo — поле токена + кнопки «Сохранить токен»
  и «Проверить доступность».
- Блок «Диапазон ручной синхронизации»: два `Calendar` (`dd.mm.yy`,
  ширина 12rem), кнопка «Синхронизировать» (`pi-sync`, disabled если
  нет токена / не dodofo / нет дат).
- `Message` с результатом: `Добавлено: N · Обновлено: M · Всего: K`
  (severity `success` если `added > 0`, иначе `info`).
- **Панель «Пробежки (N)»** — `DataTable` с колонками:
  Дата, Км, Темп, Время, Ср. пульс, Макс. пульс, Источник.
  Автообновляется после успешного `syncNow`.
- CSS: `.pb-page` объявляет `--pb-accent` (песочный), календари и
  кнопки в едином стиле (высота 2.5rem, accent-рамка, hover-заливка).

### Не реализовано (в этом направлении)

- Авто-синхронизация при старте.
- Wellness → `recovery_logs`.
- Thresholds → `profile`.
- Потоки (streams) → `run_facts.raw_json` или отдельная таблица.
- Google Fit OAuth.

## Что сделано (для DoD)

- [x] `runFactsRepo.ts` — upsert идемпотентен.
- [x] `pb:sync-now` — возвращает счётчики `{ added, updated, skipped, total }`.
- [x] Кнопка «Синхронизировать» в UI работает.
- [x] Повторная синхронизация за тот же период: `added: 0`, `updated: N`.
- [x] `run_facts` содержит записи за реальный период — **14 тренировок
      за сентябрь 2026, проверено на живом dodofo**.
- [x] `avg_hr` в БД — целые числа (фикс float → int).
- [ ] Авто-синхронизация при старте.
- [ ] `recovery_logs` заполняется.
- [ ] `profile.max_hr`, `lthr`, `resting_hr` заполняются.
- [x] `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.
- [x] `git commit` — после UI + репозитория.

## Что осталось (в порядке приоритета)

### 1. Thresholds → `profile` (быстро, ~30 минут)

- `DodofoProvider.fetchThresholds()` — **уже есть**.
- Новый хендлер `pb:sync-thresholds`:
  - взять `lthr.value` → `profile.lthr`;
  - `hrmax.value` → `profile.max_hr`;
  - `resthr.value` → `profile.resting_hr`;
  - (опц.) `ftp.value` — пока не нужно, Big-6 не про вело.
- UI: кнопка «Подтянуть пороги» в блоке «Синхронизация».
- Закрывает DoD-пункт, сразу полезно Core (зоны).

### 2. Wellness → `recovery_logs` (средне, ~1 час)

- Добавить в провайдер `fetchWellness(from, to)` → `GET /api/v1/wellness`.
- `recoveryRepo.ts`: `upsertRecoveryLog(db, log)` по `date` (UNIQUE уже есть).
- Маппинг: `sleep_hours`, `sleep_quality`, `hrv_ms` → `hrv`, `resting_hr` → `recovery_logs`.
- В `pb:sync-now` — второй проход: workouts + wellness.
- **Нужно уточнить формат ответа dodofo** (json) — тогда впишем маппинг.
- Даёт данные для Water Discipline и Stillsuit.

### 3. Авто-синхронизация при старте (быстро, ~30 минут)

- В `main.ts` после `openMelange` + `seedMelange`:
  - проверить `sync_settings.mode === 'auto'` и `auto_on_start === 1`;
  - если да — вызвать `fetchWorkouts` за последние N дней
    (по умолчанию 30) и записать в БД.
- Не блокировать старт приложения — async, с логом в консоль.
- Косметика, легко откладывается.

### 4. Потоки (streams) — дольше, нужно решение по схеме

- Решить: писать в `run_facts.raw_json` (проще) или выносить
  в отдельную таблицу `run_streams` (чище для графиков).
- Пока — **JSON в `raw_json`**, отдельная таблица — позже, если
  понадобится быстрый доступ к конкретным секундам.
- Заполняет `max_hr` в `run_facts` (сейчас NULL).
- Зоны Коггана (`hr_zones`) — использовать в Core для 80/20,
  сохранять тоже в `raw_json`.
- **Лучше делать после появления `02_CORE`** — чтобы понимать,
  какие именно поля потоков нужны.

### 5. Миграция v3 (если нужна)

Если решаем вынести streams в отдельную таблицу — миграция v3:
```sql
CREATE TABLE run_streams (
  run_fact_id INTEGER PRIMARY KEY,
  dist_m TEXT,          -- JSON
  sec_t TEXT,           -- JSON
  hr TEXT,              -- JSON
  speed_kmh TEXT,       -- JSON
  ...
  FOREIGN KEY (run_fact_id) REFERENCES run_facts(id)
);
```

## Ограничения

- Никаких импортов Electron в `spice/` — только чистый TS + fetch.
- Токены не логировать целиком, только длину/префикс.
- `safeStorage` — только в handler, не в сервисах.
- Синхронизация — **idempotent**: повторный вызов `pb:sync-now`
  за тот же период не плодит дубликаты (**проверено на живых данных**).
- Не блокировать UI на время синхронизации (async + прогресс).
- `fetchWorkouts` уже фильтрует `sport_type=run` на стороне dodofo,
  плюс дополнительная проверка на нашей стороне.
- Фильтр `status === 'ready'` — пропускать `processing` и `failed`.
- `date` в `run_facts` — **локальная зона атлета** (тренировка в 23:30
  должна попасть в свой день).
- `avg_hr`, `max_hr`, `duration_sec` — **int**, не float.

## Проверка (ручные сценарии — актуальные)

1. **`pb:sync-now` в DevTools.**
   ```js
   await window.electronAPI.pb.syncNow('2026-09-01', '2026-09-30')
   // → { success: true, added: 14, updated: 0, skipped: 0, total: 14 }
   ```
2. **Повторный вызов** за тот же период:
   ```js
   await window.electronAPI.pb.syncNow('2026-09-01', '2026-09-30')
   // → { success: true, added: 0, updated: 14, skipped: 0, total: 14 }
   ```
3. **Проверка в БД — данные реальные:**
   ```bash
   sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
     "SELECT date, actual_km, actual_pace, avg_hr, source, external_id
      FROM run_facts ORDER BY date DESC LIMIT 5;"
   ```
   Пример вывода (проверено 2026-09-26):
   ```
   2026-09-26|7.208|8:30|145|dodofo|dodofo:11714
   2026-09-24|7.246|8:29|117|dodofo|dodofo:11715
   2026-09-19|20.489|7:30|146|dodofo|dodofo:11719
   2026-09-17|8.387|7:58|144|dodofo|dodofo:11720
   2026-09-16|9.146|7:32|122|dodofo|dodofo:11721
   ```
4. **UI-таблица:** `await window.electronAPI.pb.listRunFacts('2026-09-01', '2026-09-30')`
   → `{ success: true, items: [...], total: 14 }`.
5. **Wellness** — пока пусто (не реализовано).
6. **Thresholds → profile** — пока пусто (не реализовано).

## Известные особенности

- `max_hr` в `run_facts` = NULL — в списке активностей dodofo не отдаётся,
  только через `/api/v1/activities/{id}/streams`. Заполним шагом 4.
- `elevation_gain_m` в dodofo для беговых тренировок выглядит завышенным
  (6.7 км на 7 км дистанции) — **проверить, игнорировать или считать
  по-своему** (открытый вопрос).
- `plan_id`, `rpe`, `notes` — ручные поля, синк их не трогает.

## Definition of Done — текущее состояние

- [x] `runFactsRepo.ts` создан, `upsert` идемпотентен.
- [x] `pb:sync-now` работает, возвращает счётчики.
- [x] Кнопка «Синхронизировать» в UI работает.
- [x] Повторная синхронизация не плодит дубликаты.
- [x] `run_facts` содержит записи за реальный период.
- [ ] Авто-синхронизация при старте работает (если включена).
- [ ] `recovery_logs` заполняется (если `/wellness` отдаёт данные).
- [ ] `profile.max_hr`, `lthr`, `resting_hr` заполняются из `/me/thresholds`.
- [x] `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.
- [x] `git commit` с осмысленным сообщением.

## Что НЕ делаем в 07

- Google Fit OAuth — отдельная задача, приоритет ниже.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline —
  это `10_UI_DUNA.md`.
- Бизнес-логику Core (зоны, 80/20) — это `02_CORE.md`.
- Big-6 (ступени, benchmark) — это `05_CRYSKNIFE.md`.
- Схему БД целиком — это `08_MELANGE.md` (мы лишь добавляем
  конкретные репозитории и миграции).



`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`
.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.-`-.

# Направление 07: Spice (аналитика, dodofo, Google Fit)

## Роль
Провайдеры данных, синхронизация, аналитика, графики. Spice — это то,
через что тренировочные данные попадают в Melange и отображаются в UI.

## Зона ответственности
- **Провайдеры** в `src/main/services/pranaBindu/spice/providers/`:
  - `dodofoClient.ts` + `dodofoProvider.ts` — основной источник;
  - `regionDetector.ts` + `dofekProvider.ts` — резервный Zepp;
  - `mcpProvider.ts`, `bridgeProvider.ts` — заглушки;
  - `types.ts`, `index.ts` — интерфейс и реестр.
- **Синхронизация**: ручная (`pb:sync-now`) и авто (при старте).
- **Репозитории записи** тренировок в Melange (`runFactsRepo`,
  `recoveryRepo`, `thresholdsRepo` — по мере надобности).
- **Google Fit** — отложено, приоритет ниже dodofo.

## Текущее состояние (2026-09-26)

### Реализовано

**`spice/providers/dodofoClient.ts`**
- `dodofoRequest<T>(path, token, query?)` — GET с Bearer-токеном,
  таймаут 20 сек, разбор RFC 7807 `Problem`.
- `DodofoApiError` — типизированная ошибка с `status`, `title`,
  `detail`, `code`.
- Типы ответов: `DodofoActivity`, `DodofoActivitiesResponse`,
  `DodofoThresholdsResponse`, `DodofoStreams`, `DodofoZoneTime`.

**`spice/providers/dodofoProvider.ts`**
- Класс `DodofoProvider implements ZeppDataProvider`:
  - `name = 'dodofo'`;
  - `isAvailable()` — проверка токена через `/api/v1/me/thresholds`;
  - `fetchWorkouts(from, to)` — список тренировок с фильтром
    `sport_type=run`, пагинация по `has_more` (до 20 страниц),
    маппинг в `RawWorkout`;
  - `fetchThresholds()` — LTHR/HRmax/RestHR/FTP;
  - `fetchStreams(id)` — потоки + зоны Коггана.
- Конструктор принимает колбэк `getToken(): string | null` —
  расшифровка токена снаружи (в handler).

**Melange (v2)**
- Колонки в `sync_settings`: `dodofo_token` (шифр.), `dodofo_user_id`,
  `dodofo_username`, `dodofo_last_sync_at`, `dodofo_last_sync_status`.
- Репозиторий `syncRepo.ts`: `setDodofoToken`, `getDodofoTokenEncrypted`,
  `hasDodofoToken`.

**IPC (`pb:*`)**
- `pb:dodofo-connect(token)` — сохранение + проверка токена;
- `pb:dodofo-token-status` — есть/нет токена;
- `pb:zepp-check-provider(name)` — работает для всех, включая dodofo.

**UI**
- Форма «Синхронизация» меняется по выбранному провайдеру.
- Для dodofo — поле токена + кнопки «Сохранить токен»
  и «Проверить доступность».

### Не реализовано (этот чат)

- Запись тренировок в `run_facts` — **главная задача**.
- Авто-синхронизация.
- Wellness → `recovery_logs`.
- Thresholds → `profile`.
- Потоки → отдельное хранение или `run_facts.raw_json`.
- Google Fit OAuth.

## Что нужно сделать

### 1. `melange/repositories/runFactsRepo.ts`

- `upsertRunFact(db, fact: RawWorkout): { inserted: boolean; id: number }`.
  Уникальность по `(source, external_id)`. При конфликте — обновление
  полей (кроме `id` и `external_id`).
- `listRunFacts(db, from: string, to: string): RunFactRow[]`.
- `getRunFactByExternalId(db, source, externalId): RunFactRow | null`.
- Маппинг `RawWorkout` → `run_facts`:
  - `externalId` → `external_id`;
  - `startTime` → `date` (YYYY-MM-DD из ISO);
  - `distanceM / 1000` → `actual_km`;
  - `avg_speed_kmh` → `avg_pace` (мин:сек, вычисляется как `60 / speed`);
  - `avgHr` → `avg_hr`, `maxHr` → `max_hr`;
  - `durationS` → `duration_sec`;
  - `source` → `source`;
  - `raw` → `raw_json` (JSON.stringify).

### 2. IPC `pb:sync-now`

- Вход: `from: string`, `to: string` (YYYY-MM-DD).
- Действие:
  1. Взять провайдера `getProvider('dodofo')`.
  2. `await provider.fetchWorkouts(from, to)`.
  3. Для каждого `RawWorkout` — `upsertRunFact`.
  4. Вернуть `{ added, updated, skipped, total }`.
- Стиль — `try / catch / { success, error }` (как у остальных).

### 3. UI: кнопка «Синхронизировать»

- В блоке «Синхронизация» (или отдельной панели).
- Два поля дат: `from` / `to` (по умолчанию — последние 30 дней).
- Кнопка «Синхронизировать».
- Вывод результата: `Добавлено: N, обновлено: M, пропущено: K`.

### 4. Авто-синхронизация при старте

- В `main.ts` после `openMelange` + `seed`:
  - проверить `sync_settings.mode === 'auto'` и `auto_on_start === 1`;
  - если да — вызвать `fetchWorkouts` за последние N дней
    (по умолчанию 30) и записать в БД.
- Не блокировать старт приложения — асинхронно, с логом в консоль.

### 5. Wellness → `recovery_logs`

- `DodofoProvider.fetchWellness(from, to)`:
  - `GET /api/v1/wellness?from=&to=` — записи по дням;
  - маппинг: `sleep_hours`, `sleep_quality`, `hrv_ms`, `resting_hr` →
    `recovery_logs`.
- `recoveryRepo.ts`: `upsertRecoveryLog(db, log)` по `date`.

### 6. Thresholds → `profile`

- `DodofoProvider.fetchThresholds()` — уже есть.
- В handler `pb:sync-now` или отдельным `pb:sync-thresholds`:
  - взять `lthr.value` → `profile.lthr`;
  - `hrmax.value` → `profile.max_hr`;
  - `resthr.value` → `profile.resting_hr`.

### 7. Потоки (streams)

- Решить: писать в `run_facts.raw_json` (проще) или выносить в отдельную
  таблицу `run_streams` (чище для графиков).
- Пока — **JSON в raw_json**, отдельная таблица — позже, если понадобится
  быстрый доступ к конкретным секундам.
- Зоны Коггана (`hr_zones`) — их можно использовать в Core для 80/20,
  сохранять тоже в `raw_json`.

### 8. Миграция v3 (если нужна)

Если решаем вынести streams в отдельную таблицу — миграция v3:
```sql
CREATE TABLE run_streams (
  run_fact_id INTEGER PRIMARY KEY,
  dist_m TEXT,          -- JSON
  sec_t TEXT,           -- JSON
  hr TEXT,              -- JSON
  speed_kmh TEXT,       -- JSON
  ...
  FOREIGN KEY (run_fact_id) REFERENCES run_facts(id)
);
```

## Ограничения

- Никаких импортов Electron в `spice/` — только чистый TS + fetch.
- Токены не логировать целиком, только длину/префикс.
- Синхронизация — **idempotent**: повторный вызов `pb:sync-now`
  за тот же период не должен плодить дубликаты.
- Не блокировать UI на время синхронизации (async + прогресс).
- `fetchWorkouts` уже фильтрует `sport_type=run` на стороне dodofo,
  плюс дополнительная проверка на нашей стороне.
- Фильтр `status === 'ready'` — пропускать `processing` и `failed`.

## Проверка (ручные сценарии)

1. **`pb:sync-now` в DevTools.**
   ```js
   await window.electronAPI.pb.syncNow('2026-09-01', '2026-09-30')
   // → { success: true, added: N, updated: 0, skipped: 0 }
   ```
2. **Повторный вызов** за тот же период:
   ```js
   // → { success: true, added: 0, updated: N, skipped: 0 }
   ```
3. **Проверка в БД.**
   ```bash
   sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
     "SELECT date, actual_km, avg_hr, source, external_id FROM run_facts ORDER BY date DESC LIMIT 5;"
   ```
4. **Wellness.**
   ```bash
   sqlite3 ~/.config/wetothemoon-electron/prana_bindu.db \
     "SELECT date, sleep_hours, hrv, resting_hr FROM recovery_logs ORDER BY date DESC LIMIT 5;"
   ```
5. **Thresholds → profile.**
   ```js
   await window.electronAPI.pb.getProfile()
   // → { maxHr: ..., lactateThresholdHr: ..., restingHr: ... }
   ```

## Definition of Done

- `runFactsRepo.ts` создан, `upsert` идемпотентен.
- `pb:sync-now` работает, возвращает счётчики.
- Кнопка «Синхронизировать» в UI работает.
- Повторная синхронизация не плодит дубликаты.
- `run_facts` содержит записи за реальный период.
- Авто-синхронизация при старте работает (если включена).
- `recovery_logs` заполняется (если `/wellness` отдаёт данные).
- `profile.max_hr`, `lthr`, `resting_hr` заполняются из `/me/thresholds`.
- `npx tsc --noEmit 2>&1 | grep -i pranaBindu` — пусто.
- `git commit` с осмысленным сообщением.

## Что НЕ делаем в 07

- Google Fit OAuth — отдельная задача, приоритет ниже.
- UI модулей Stillsuit / Crysknife / Mentat / Water Discipline —
  это `10_UI_DUNA.md`.
- Бизнес-логику Core (зоны, 80/20) — это `02_CORE.md`.
- Big-6 (ступени, benchmark) — это `05_CRYSKNIFE.md`.
- Схему БД целиком — это `08_MELANGE.md` (мы лишь добавляем
  конкретные репозитории и миграции).