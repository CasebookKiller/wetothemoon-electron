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
}

export interface ComputedThresholds {
  lthr: number | null;
  hrmax: number | null;
  resthr: number | null;
  source: 'test_segments' | 'autoscan';
  windowDays: number;
  notes: string;
  testsUsed: number;
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
    .all(lthrTestDuration, fromIso, toIso) as Array<{
    hr_avg: number | null;
    hr_max: number | null;
    hr_drift_pct: number | null;
  }>;

  const cleanTests = onlyClean
    ? testRows.filter(
        (t) => t.hr_drift_pct == null || Math.abs(t.hr_drift_pct) < 5,
      )
    : testRows;

  const testHrs = cleanTests
    .map((t) => t.hr_avg)
    .filter((v): v is number => v != null && v > 0);

  const factor = getLthrFactor(lthrTestDuration);
  const durationLabelStr = durationLabel(lthrTestDuration);

  let lthr: number | null = null;
  let source: 'test_segments' | 'autoscan' = 'autoscan';
  const testsUsed = testHrs.length;

  if (testHrs.length >= 3) {
    const medHr = median(testHrs);
    if (medHr != null) {
      lthr = Math.round(medHr * factor);
      source = 'test_segments';
    }
  }

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
  if (source === 'test_segments') {
    notes = `По ${testsUsed} тестам ${durationLabelStr} (ср. HR × ${factor}).`;
  } else if (testsUsed > 0 && testsUsed < 3) {
    notes = `Найдено ${testsUsed} теста(ов) ${durationLabelStr} — нужно ≥3. Использован автопоиск.${
      onlyClean ? ' Фильтр чистоты применён к тестам.' : ''
    }`;
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
  };
}