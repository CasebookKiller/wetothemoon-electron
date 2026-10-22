// src/main/services/pranaBindu/core/thresholds.ts
import type { DatabaseSync } from 'node:sqlite';
import { getRunStreamWithPayload } from '../melange/repositories/runStreamsRepo';
import { listRecoveryLogs } from '../melange/repositories/recoveryRepo';

// ==================== Types ====================

export interface ComputeThresholdsOptions {
  windowDays?: number;
  /** Длительность теста LTHR в секундах: 300/600/900/1200/1800. */
  lthrTestDuration?: number;
  /** Учитывать только «чистые» тесты — |дрейф HR| < 5%. */
  onlyClean?: boolean;
  /** Учитывать только интенсивные — hr_avg ≥ (pct × HRmax). */
  onlyIntensePct?: number;   // 0 = не фильтровать, 0.80 / 0.85 / 0.88 / 0.90
  /** Метод агрегации: 0 = медиана всех, N > 0 = среднее топ-N. */
  topN?: number;
  /** Минимум тестов для расчёта (default 3). */
  minTests?: number;
}

export interface ComputedThresholds {
  lthr: number | null;
  hrmax: number | null;
  resthr: number | null;
  source: 'test_segments' | 'autoscan';
  windowDays: number;
  notes: string;
  testsUsed: number;
  /** Диагностика: сколько всего / отфильтровано. */
  testsTotal: number;
  skippedClean: number;
  skippedIntense: number;
  method: 'median' | 'topN' | null;
  /** Разброс HR по отфильтрованным тестам. */
  hrRange: { min: number; max: number; median: number } | null;
}

// ==================== Коэффициенты LTHR ====================

/**
 * Приблизительные коэффициенты для пересчёта среднего HR на тесте
 * в LTHR. Чем короче тест — тем выше средний HR относительно LTHR,
 * поэтому коэффициент меньше.
 *
 * Значения основаны на общепринятой практике:
 *  - 20 мин — 95% (Coggan / Friel, классика);
 *  - 30 мин — 100% (это уже почти порог);
 *  - 5/10/15 мин — уменьшенные коэффициенты (тест не «устаканивается»,
 *    средний HR завышен из-за короткой высокой интенсивности).
 */
const LTHR_FACTOR_BY_DURATION: Record<number, number> = {
  300: 0.88,
  600: 0.91,
  900: 0.93,
  1200: 0.95,
  1800: 1.0,
};

function getLthrFactor(durationSec: number): number {
  if (LTHR_FACTOR_BY_DURATION[durationSec] != null) {
    return LTHR_FACTOR_BY_DURATION[durationSec];
  }
  if (durationSec <= 300) return 0.88;
  if (durationSec <= 600) return 0.91;
  if (durationSec <= 900) return 0.93;
  if (durationSec <= 1200) return 0.95;
  return 1.0;
}

// ==================== Хелпер: расчёт LTHR из набора тестов ====================

interface TestRow {
  hr_avg: number | null;
  hr_max: number | null;
  hr_drift_pct: number | null;
}

interface LthrFromTestsOpts {
  onlyClean: boolean;
  onlyIntensePct: number;  // 0 = не фильтровать
  topN: number;
  minTests: number;
}

interface LthrFromTestsResult {
  lthr: number | null;
  used: number;
  total: number;
  skippedClean: number;
  skippedIntense: number;
  method: 'median' | 'topN' | null;
  hrMaxGlobal: number;
  hrRange: { min: number; max: number; median: number } | null;
}

function computeLthrFromTests(
  tests: TestRow[],
  factor: number,
  opts: LthrFromTestsOpts,
): LthrFromTestsResult {
  const total = tests.length;

  // 1. Пик HR — по всем тестам (не по отфильтрованным)
  const hrMaxGlobal = tests.reduce(
    (m, t) => (t.hr_max != null && t.hr_max > m ? t.hr_max : m),
    0,
  );

  // 2. Фильтр чистоты
  let filtered = tests;
  let skippedClean = 0;
  if (opts.onlyClean) {
    const before = filtered.length;
    filtered = filtered.filter(
      (t) => t.hr_drift_pct == null || Math.abs(t.hr_drift_pct) < 5,
    );
    skippedClean = before - filtered.length;
  }

  // 3. Фильтр интенсивности
  let skippedIntense = 0;
  if (opts.onlyIntensePct > 0 && hrMaxGlobal > 0) {
    const threshold = opts.onlyIntensePct * hrMaxGlobal;
    const before = filtered.length;
    filtered = filtered.filter(
      (t) => t.hr_avg != null && t.hr_avg >= threshold,
    );
    skippedIntense = before - filtered.length;
  }

  const hrs = filtered
    .map((t) => t.hr_avg)
    .filter((v): v is number => v != null && v > 0);

  if (hrs.length < opts.minTests) {
    const hrRange =
      hrs.length > 0
        ? {
            min: Math.min(...hrs),
            max: Math.max(...hrs),
            median: median(hrs) ?? 0,
          }
        : null;
    return {
      lthr: null,
      used: hrs.length,
      total,
      skippedClean,
      skippedIntense,
      method: null,
      hrMaxGlobal,
      hrRange,
    };
  }

  // 4. Агрегация: topN-среднее или медиана
  let agg: number;
  let method: 'median' | 'topN';
  if (opts.topN > 0 && opts.topN < hrs.length) {
    const sorted = [...hrs].sort((a, b) => b - a).slice(0, opts.topN);
    agg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    method = 'topN';
  } else {
    agg = median(hrs)!;
    method = 'median';
  }

  const hrRange = {
    min: Math.min(...hrs),
    max: Math.max(...hrs),
    median: median(hrs) ?? 0,
  };

  return {
    lthr: Math.round(agg * factor),
    used: hrs.length,
    total,
    skippedClean,
    skippedIntense,
    method,
    hrMaxGlobal,
    hrRange,
  };
}

function durationLabel(sec: number): string {
  if (sec < 60) return `${sec}с`;
  if (sec < 3600) return `${Math.round(sec / 60)}м`;
  return `${Math.round(sec / 3600)}ч`;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ==================== Автопоиск по streams ====================

function findBest20MinAvgHr(hr: number[], secT: number[]): number | null {
  if (!hr || !secT || hr.length < 60) return null;

  let bestAvg = 0;
  const windowSec = 20 * 60;

  let left = 0;
  let sum = 0;

  for (let right = 0; right < hr.length; right++) {
    sum += hr[right];

    while (secT[right] - secT[left] > windowSec) {
      sum -= hr[left];
      left++;
    }

    if (secT[right] - secT[left] >= windowSec - 5) {
      const avg = sum / (right - left + 1);
      if (avg > bestAvg) bestAvg = avg;
    }
  }

  return bestAvg > 0 ? Math.round(bestAvg) : null;
}

function findPeakHr(hr: number[]): number | null {
  if (!hr || hr.length === 0) return null;
  return Math.max(...hr);
}

// ==================== Публичный API ====================

export function computeThresholds(
  db: DatabaseSync,
  optsOrDays: number | ComputeThresholdsOptions = 365,
): ComputedThresholds {
  const opts =
    typeof optsOrDays === 'number' ? { windowDays: optsOrDays } : optsOrDays;
  const windowDays = opts.windowDays ?? 365;
  const lthrTestDuration = opts.lthrTestDuration ?? 1200;
  const onlyClean = opts.onlyClean ?? false;
  const onlyIntensePct = opts.onlyIntensePct ?? 0.80; // по умолчанию 80%
  const topN = opts.topN ?? 0;                         // 0 = медиана
  const minTests = opts.minTests ?? 3;                 // по умолчанию 3

  const now = new Date();
  const from = new Date();
  from.setDate(from.getDate() - windowDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fromIso = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
  const toIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // ==================== 1. Попытка взять LTHR из test_segments ====================
  // Фильтруем по дате тренировки (run_facts.date), а не по created_at —
  // если пользователь вчера пакетно сохранил старые тесты, они не должны
  // «омолаживать» LTHR.

  const testRows = db
    .prepare(
      `SELECT ts.hr_avg, ts.hr_max, ts.hr_drift_pct
         FROM test_segments ts
         JOIN run_facts rf ON rf.id = ts.run_fact_id
        WHERE ts.duration_type = 'time'
          AND ts.duration_value = ?
          AND rf.date >= ? AND rf.date <= ?`,
    )
    .all(lthrTestDuration, fromIso, toIso) as unknown as TestRow[];

  const factor = getLthrFactor(lthrTestDuration);
  const durationLabelStr = durationLabel(lthrTestDuration);

  const lthrResult = computeLthrFromTests(testRows, factor, {
    onlyClean,
    onlyIntensePct,
    topN,
    minTests,
  });

  let lthr: number | null = lthrResult.lthr;
  let source: 'test_segments' | 'autoscan' =
    lthrResult.lthr != null ? 'test_segments' : 'autoscan';
  const testsUsed = lthrResult.used;

  // ==================== 2. HRmax (пик по всем тестам и streams) ====================

  let maxPeakHr = 0;
  for (const t of testRows) {
    if (t.hr_max != null && t.hr_max > maxPeakHr) maxPeakHr = t.hr_max;
  }

  // ==================== 3. Если LTHR не посчитан — автопоиск ====================

  let autoscanUsed = false;
  if (lthr == null) {
    const facts = db
      .prepare(
        `SELECT id, source FROM run_facts
          WHERE date >= ? AND date <= ? AND streams_loaded = 1`,
      )
      .all(fromIso, toIso) as Array<{ id: number; source: string }>;

    let bestAvg = 0;
    for (const fact of facts) {
      const stream = getRunStreamWithPayload(db, fact.id, fact.source);
      if (!stream?.payload) continue;

      const hr = stream.payload.hr as number[] | undefined;
      const secT = (stream.payload.secT || stream.payload.sec_t) as
        | number[]
        | undefined;

      if (hr && hr.length > 0) {
        const peak = findPeakHr(hr);
        if (peak && peak > maxPeakHr) maxPeakHr = peak;
      }

      if (hr && secT && secT.length === hr.length) {
        const avg = findBest20MinAvgHr(hr, secT);
        if (avg && avg > bestAvg) bestAvg = avg;
      }
    }

    if (bestAvg > 0) {
      lthr = Math.round(bestAvg * 0.95);
      autoscanUsed = true;
    }
  }

  // ==================== 4. RestHR из recovery_logs ====================

  const logs = listRecoveryLogs(db, fromIso, toIso);
  const restValues = logs
    .map((l) => l.resting_hr)
    .filter((v): v is number => v != null && v > 0);
  const medRest = median(restValues);
  const medianRestHr = medRest != null ? Math.round(medRest) : null;

  // ==================== 5. Notes ====================

  let notes: string;
  const filters: string[] = [];
  if (onlyClean) filters.push(`чистота (${lthrResult.skippedClean} отсеяно)`);
  if (onlyIntensePct > 0)
    filters.push(
      `интенсивность ≥${Math.round(onlyIntensePct * 100)}% HRmax (${lthrResult.skippedIntense} отсеяно)`,
    );
  const filterStr = filters.length > 0 ? ` Фильтры: ${filters.join(', ')}.` : '';
  const methodStr =
    lthrResult.method === 'topN'
      ? `среднее топ-${Math.min(topN, lthrResult.used)}`
      : 'медиана';

  const autoscanSuffix = autoscanUsed
    ? ' Использован автопоиск (20-мин отрезок × 0.95).'
    : ' Автопоиск тоже не дал результата.';

  if (source === 'test_segments') {
    notes = `По ${testsUsed} тестам ${durationLabelStr} (${methodStr} × ${factor}). Всего: ${lthrResult.total}.${filterStr}`;
  } else if (lthrResult.total > 0) {
    notes = `Тестов ${durationLabelStr}: ${lthrResult.total}, из них после фильтров — ${testsUsed}, нужно ≥3.${filterStr}${autoscanSuffix}`;
  } else if (autoscanUsed) {
    notes = `Тестов ${durationLabelStr} нет. Автопоиск: 95% от лучшего 20-мин отрезка по потокам.`;
  } else {
    notes = `Недостаточно данных: нет ни тестов, ни потоков.`;
  }

  return {
    lthr,
    hrmax: maxPeakHr > 0 ? maxPeakHr : null,
    resthr: medianRestHr,
    source,
    windowDays,
    notes,
    testsUsed,
    testsTotal: lthrResult.total,
    skippedClean: lthrResult.skippedClean,
    skippedIntense: lthrResult.skippedIntense,
    method: lthrResult.method,
    hrRange: lthrResult.hrRange,
  };
}

// ==================== Timeline (C.4) ====================

export interface TimelinePoint {
  date: string;            // YYYY-MM-DD (конец окна)
  lthr: number | null;
  hrmax: number | null;
  resthr: number | null;
  testsUsed: number;
  source: 'test_segments' | 'autoscan' | 'insufficient';
}

export interface ComputeTimelineOptions {
  from: string;
  to: string;
  windowDays: number;
  stepDays?: number;
  lthrTestDuration?: number;
  onlyClean?: boolean;
  onlyIntensePct?: number;
  topN?: number;
  minTests?: number;
}

/**
 * Rolling timeline: для каждой даты считаем медиану LTHR по тестам
 * в скользящем окне [date - windowDays, date].
 *
 * По умолчанию работает только по test_segments (быстро, ~10 SQL).
 * Автопоиск по streams не используется — слишком медленно для N точек.
 */
export function computeThresholdsTimeline(
  db: DatabaseSync,
  opts: ComputeTimelineOptions,
): TimelinePoint[] {
  const windowDays = opts.windowDays;
  const stepDays = opts.stepDays ?? 14;
  const lthrTestDuration = opts.lthrTestDuration ?? 1200;
  const onlyClean = opts.onlyClean ?? false;
  const onlyIntensePct = opts.onlyIntensePct ?? 0.80;
  const topN = opts.topN ?? 0;
  const minTests = opts.minTests ?? 3;
  const factor = getLthrFactor(lthrTestDuration);

  const toDate = new Date(opts.to + 'T00:00:00');
  const fromDate = new Date(opts.from + 'T00:00:00');
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const points: TimelinePoint[] = [];
  const cursor = new Date(fromDate);
  // Первая точка — когда окно полностью набрано
  cursor.setDate(cursor.getDate() + windowDays);

  while (cursor <= toDate) {
    const winFrom = new Date(cursor);
    winFrom.setDate(winFrom.getDate() - windowDays);
    const winFromIso = iso(winFrom);
    const winToIso = iso(cursor);

    // Тесты в окне
    const testRows = db
      .prepare(
        `SELECT ts.hr_avg, ts.hr_max, ts.hr_drift_pct
           FROM test_segments ts
           JOIN run_facts rf ON rf.id = ts.run_fact_id
          WHERE ts.duration_type = 'time'
            AND ts.duration_value = ?
            AND rf.date >= ? AND rf.date <= ?`,
      )
      .all(lthrTestDuration, winFromIso, winToIso) as unknown as TestRow[];

    const lthrResult = computeLthrFromTests(testRows, factor, {
      onlyClean,
      onlyIntensePct,
      topN,
      minTests,
    });

    let lthr: number | null = lthrResult.lthr;
    let source: TimelinePoint['source'] = 'insufficient';
    if (lthr != null) source = 'test_segments';

    const hrmax = lthrResult.hrMaxGlobal > 0 ? lthrResult.hrMaxGlobal : null;

    // RestHR — медиана из recovery_logs в окне
    const logs = listRecoveryLogs(db, winFromIso, winToIso);
    const restValues = logs
      .map((l) => l.resting_hr)
      .filter((v): v is number => v != null && v > 0);
    const medRest = median(restValues);
    const resthr = medRest != null ? Math.round(medRest) : null;

    points.push({
      date: winToIso,
      lthr,
      hrmax,
      resthr,
      testsUsed: lthrResult.used,
      source,
    });

    cursor.setDate(cursor.getDate() + stepDays);
  }

  return points;
}