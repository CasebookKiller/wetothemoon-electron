// src/main/services/pranaBindu/core/testSegmentCandidates.ts
//
// Поиск «кандидатов» — отрезков на разных тренировках, где можно
// снять тестовый отрезок заданной длительности от глобальной точки старта.
//
// Дедупликация: одна физическая тренировка может быть в БД 2–3 раза
// (fit + dodofo + icu). Берём одну запись — с приоритетным источником
// потоков (fit > zepp > tcx > dodofo). Источник потоков ≠ источник факта:
// ICU хранит FIT-файл как source='fit'.

import type { DatabaseSync } from 'node:sqlite';
import {
  getRunStreamWithPayload,
  listRunStreams,
} from '../melange/repositories/runStreamsRepo';

// ==================== Types ====================

export interface FindCandidatesOptions {
  from: string;   // YYYY-MM-DD
  to: string;     // YYYY-MM-DD
  testPoint: { lat: number; lng: number };
  durationType: 'time' | 'distance';
  durationValue: number; // секунды или метры
  minCoveragePct?: number; // по умолчанию 95
}

export interface TestCandidate {
  runFactId: number;
  date: string;
  startTime: string | null;
  factSource: string;
  streamSource: string;
  name: string | null;
  durationSec: number;
  distanceM: number;
  paceSecPerKm: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrDriftPct: number | null;
  cadenceAvg: number | null;
  coveragePct: number;
  isClean: boolean;      // |drift| < 5%
  canSave: boolean;      // coverage >= min
  alreadySaved: boolean; // уже есть test_segment с этим runFactId+типом
  startIdx: number;
  endIdx: number;
}

// ==================== Утилиты ====================

const STREAM_SOURCE_PRIORITY: Record<string, number> = {
  fit: 100,
  zepp: 90,
  tcx: 80,
  dodofo: 70,
  'strava-csv': 10,
};

function pickBestStreamSource(sources: string[]): string | null {
  let best: string | null = null;
  let bestP = -1;
  for (const s of sources) {
    const p = STREAM_SOURCE_PRIORITY[s] ?? 0;
    if (p > bestP) {
      bestP = p;
      best = s;
    }
  }
  return best;
}

function haversineM(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestIdx(
  latlng: (number | null)[][] | undefined,
  point: { lat: number; lng: number },
): number {
  if (!latlng || latlng.length === 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < latlng.length; i++) {
    const p = latlng[i];
    if (!p || p[0] == null || p[1] == null) continue;
    const d = haversineM(p[0], p[1], point.lat, point.lng);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function findEndIdxByTime(
  secT: number[] | undefined,
  startIdx: number,
  targetSec: number,
): number {
  if (!secT || secT.length === 0) return startIdx;
  const startSec = secT[startIdx];
  for (let i = startIdx + 1; i < secT.length; i++) {
    if (secT[i] - startSec >= targetSec) return i;
  }
  return secT.length - 1;
}

function findEndIdxByDist(
  distM: number[] | undefined,
  latlng: (number | null)[][] | undefined,
  startIdx: number,
  targetM: number,
): number {
  if (distM && distM.length > 0) {
    const startM = distM[startIdx];
    for (let i = startIdx + 1; i < distM.length; i++) {
      if (distM[i] - startM >= targetM) return i;
    }
    return distM.length - 1;
  }
  if (!latlng) return startIdx;
  let cum = 0;
  for (let i = startIdx + 1; i < latlng.length; i++) {
    const a = latlng[i - 1];
    const b = latlng[i];
    if (!a || !b) continue;
    const aLat = a[0], aLng = a[1], bLat = b[0], bLng = b[1];
    if (aLat == null || aLng == null || bLat == null || bLng == null) continue;
    cum += haversineM(aLat, aLng, bLat, bLng);
    if (cum >= targetM) return i;
  }
  return latlng.length - 1;
}

function computeStats(
  streams: any,
  startIdx: number,
  endIdx: number,
): {
  durationSec: number;
  distanceM: number;
  paceSecPerKm: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrDriftPct: number | null;
  cadenceAvg: number | null;
} {
  const secT = (streams?.secT ?? streams?.sec_t) as number[] | undefined;
  const distM = streams?.distM as number[] | undefined;
  const hr = streams?.hr as (number | null)[] | undefined;
  const cadence = streams?.cadence as (number | null)[] | undefined;

  const durationSec =
    secT && secT[endIdx] != null && secT[startIdx] != null
      ? secT[endIdx] - secT[startIdx]
      : 0;
  const distanceM =
    distM && distM[endIdx] != null && distM[startIdx] != null
      ? distM[endIdx] - distM[startIdx]
      : 0;
  const paceSecPerKm =
    distanceM > 0 && durationSec > 0 ? durationSec / (distanceM / 1000) : null;

  const hrs = (hr?.slice(startIdx, endIdx + 1) ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const hrAvg =
    hrs.length > 0 ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;
  const hrMax = hrs.length > 0 ? Math.max(...hrs) : null;

  let hrDriftPct: number | null = null;
  if (hrs.length >= 4) {
    const mid = Math.floor(hrs.length / 2);
    const a1 = hrs.slice(0, mid);
    const a2 = hrs.slice(mid);
    const avg1 = a1.reduce((s, v) => s + v, 0) / a1.length;
    const avg2 = a2.reduce((s, v) => s + v, 0) / a2.length;
    if (avg1 > 0) hrDriftPct = ((avg2 - avg1) / avg1) * 100;
  }

  const cads = (cadence?.slice(startIdx, endIdx + 1) ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const cadenceAvg =
    cads.length > 0 ? cads.reduce((s, v) => s + v, 0) / cads.length : null;

  return { durationSec, distanceM, paceSecPerKm, hrAvg, hrMax, hrDriftPct, cadenceAvg };
}

// ==================== Публичный API ====================

export function findTestSegmentCandidates(
  db: DatabaseSync,
  opts: FindCandidatesOptions,
): TestCandidate[] {
  const minCoverage = opts.minCoveragePct ?? 95;

  // 1. Существующие сохранённые тесты — для флага alreadySaved
  const existing = new Set<string>();
  const existingRows = db
    .prepare(
      `SELECT run_fact_id, duration_type, duration_value
         FROM test_segments`,
    )
    .all() as Array<{
    run_fact_id: number;
    duration_type: string;
    duration_value: number;
  }>;
  for (const r of existingRows) {
    existing.add(`${r.run_fact_id}:${r.duration_type}:${r.duration_value}`);
  }

  // 2. Все run_facts с потоками за окно
  const facts = db
    .prepare(
      `SELECT id, date, start_time, source, name, user_name
         FROM run_facts rf
        WHERE date >= ? AND date <= ?
          AND EXISTS (SELECT 1 FROM run_streams WHERE run_fact_id = rf.id)
        ORDER BY date DESC`,
    )
    .all(opts.from, opts.to) as Array<{
    id: number;
    date: string;
    start_time: string | null;
    source: string;
    name: string | null;
    user_name: string | null;
  }>;

  // 3. Дедупликация: одна тренировка = (date, floor(start_time / 30min))
  const grouped = new Map<string, typeof facts[number]>();
  for (const f of facts) {
    let bucket = '0';
    if (f.start_time) {
      const ts = new Date(f.start_time).getTime();
      if (Number.isFinite(ts)) bucket = String(Math.floor(ts / 1_800_000));
    }
    const key = `${f.date}:${bucket}`;
    const cur = grouped.get(key);
    if (!cur) {
      grouped.set(key, f);
      continue;
    }
    // Приоритет: fit > icu > dodofo > zepp > tcx > strava-csv
    const rank = (s: string) =>
      s === 'fit' ? 5 : s === 'intervals-icu' ? 4 : s === 'dodofo' ? 3
        : s === 'zepp' ? 2 : s === 'tcx' ? 1 : 0;
    if (rank(f.source) > rank(cur.source)) {
      grouped.set(key, f);
    }
  }

  // 4. Для каждой — вычислить отрезок
  const candidates: TestCandidate[] = [];

  for (const fact of grouped.values()) {
    const streamsMeta = listRunStreams(db, fact.id);
    if (!streamsMeta || streamsMeta.length === 0) continue;
    const streamSource = pickBestStreamSource(
      streamsMeta.map((m) => m.source),
    );
    if (!streamSource) continue;

    const stream = getRunStreamWithPayload(db, fact.id, streamSource);
    if (!stream?.payload) continue;

    const latlng = stream.payload.latlng as (number | null)[][] | undefined;
    if (!latlng || latlng.length < 2) continue;

    // UnifiedStreams использует secT/distM, но dodofo-файлы могут
    // содержать sec_t (старый формат). Поддерживаем оба.
    const secT = (stream.payload.secT ?? stream.payload.sec_t) as
      | number[]
      | undefined;
    const distM = stream.payload.distM as number[] | undefined;

    const startIdx = findNearestIdx(latlng, opts.testPoint);
    if (startIdx < 0) continue;

    const endIdx =
      opts.durationType === 'time'
        ? findEndIdxByTime(secT, startIdx, opts.durationValue)
        : findEndIdxByDist(distM, latlng, startIdx, opts.durationValue);
    if (endIdx <= startIdx) continue;

    const stats = computeStats(stream.payload, startIdx, endIdx);

    const targetSec =
      opts.durationType === 'time' ? opts.durationValue : null;
    const targetDist =
      opts.durationType === 'distance' ? opts.durationValue : null;

    let coveragePct = 100;
    if (targetSec != null) {
      coveragePct =
        stats.durationSec > 0
          ? Math.min(100, Math.round((stats.durationSec / targetSec) * 100))
          : 0;
    } else if (targetDist != null) {
      coveragePct =
        stats.distanceM > 0
          ? Math.min(100, Math.round((stats.distanceM / targetDist) * 100))
          : 0;
    }

    const isClean =
      stats.hrDriftPct == null || Math.abs(stats.hrDriftPct) < 5;
    const canSave = coveragePct >= minCoverage;
    const alreadySaved = existing.has(
      `${fact.id}:${opts.durationType}:${opts.durationValue}`,
    );

    candidates.push({
      runFactId: fact.id,
      date: fact.date,
      startTime: fact.start_time,
      factSource: fact.source,
      streamSource,
      name: fact.user_name || fact.name,
      durationSec: stats.durationSec,
      distanceM: stats.distanceM,
      paceSecPerKm: stats.paceSecPerKm,
      hrAvg: stats.hrAvg,
      hrMax: stats.hrMax,
      hrDriftPct: stats.hrDriftPct,
      cadenceAvg: stats.cadenceAvg,
      coveragePct,
      isClean,
      canSave,
      alreadySaved,
      startIdx,
      endIdx,
    });
  }

  // 5. Сортировка: canSave+clean+not saved — сверху, потом по дате
  candidates.sort((a, b) => {
    const sa = a.canSave && a.isClean && !a.alreadySaved ? 0 : 1;
    const sb = b.canSave && b.isClean && !b.alreadySaved ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return b.date.localeCompare(a.date);
  });

  return candidates;
}

/**
 * Диагностика — что видит SQL и сколько отсекается на каждом шаге.
 * Используется в UI, чтобы понимать, почему кандидатов мало.
 */
export function diagnoseCandidates(
  db: DatabaseSync,
  opts: FindCandidatesOptions,
): {
  factsInWindow: number;
  factsWithStreams: number;
  factsWithLatlng: number;
  candidatesAfterCompute: number;
} {
  const factsInWindow = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM run_facts WHERE date >= ? AND date <= ?`,
      )
      .get(opts.from, opts.to) as { n: number }
  ).n;

  const factsWithStreams = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM run_facts rf
          WHERE rf.date >= ? AND rf.date <= ?
            AND EXISTS (SELECT 1 FROM run_streams WHERE run_fact_id = rf.id)`,
      )
      .get(opts.from, opts.to) as { n: number }
  ).n;

  const factsWithLatlng = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM run_facts rf
          WHERE rf.date >= ? AND rf.date <= ?
            AND EXISTS (
              SELECT 1 FROM run_streams
               WHERE run_fact_id = rf.id AND channels LIKE '%latlng%'
            )`,
      )
      .get(opts.from, opts.to) as { n: number }
  ).n;

  const candidates = findTestSegmentCandidates(db, opts);

  return {
    factsInWindow,
    factsWithStreams,
    factsWithLatlng,
    candidatesAfterCompute: candidates.length,
  };
}