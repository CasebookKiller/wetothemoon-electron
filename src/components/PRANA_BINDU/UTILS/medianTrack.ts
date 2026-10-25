// src/components/PRANA_BINDU/UTILS/medianTrack.ts
//
// Построение медианного трека из N пробежек одного маршрута.
// Также — упрощение трека алгоритмом Дугласа-Пекера.

// ==================== Утилиты ====================

function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function geometricLength(latlng: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < latlng.length; i++) {
    total += haversineM(
      latlng[i - 1][0], latlng[i - 1][1],
      latlng[i][0], latlng[i][1],
    );
  }
  return total;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ==================== Resample по расстоянию ====================

/**
 * Ресемплит трек до targetCount точек, равномерно по длине.
 * Первая и последняя точки сохраняются как есть.
 */
export function resampleByDistance(
  latlng: [number, number][],
  targetCount: number,
): [number, number][] {
  if (latlng.length < 2) return [...latlng];
  const cum: number[] = [0];
  for (let i = 1; i < latlng.length; i++) {
    cum.push(cum[i - 1] + haversineM(
      latlng[i - 1][0], latlng[i - 1][1],
      latlng[i][0], latlng[i][1],
    ));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [latlng[0]];

  const result: [number, number][] = [];
  for (let i = 0; i < targetCount; i++) {
    const target = (i / (targetCount - 1)) * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const ratio = (target - cum[lo]) / span;
    const lat = latlng[lo][0] + (latlng[hi][0] - latlng[lo][0]) * ratio;
    const lng = latlng[lo][1] + (latlng[hi][1] - latlng[lo][1]) * ratio;
    result.push([lat, lng]);
  }
  return result;
}

// ==================== Выравнивание стартов / направлений ====================

function alignLoopStart(
  run: [number, number][],
  refStart: [number, number],
): [number, number][] {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < run.length; i++) {
    const d = haversineM(run[i][0], run[i][1], refStart[0], refStart[1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return [...run.slice(best), ...run.slice(0, best)];
}

function detectAndReverseIfNeeded(
  runs: [number, number][][],
): [number, number][][] {
  if (runs.length < 2) return runs;
  const ref = runs.reduce((a, b) =>
    geometricLength(a) > geometricLength(b) ? a : b,
  );
  const refDx = ref[ref.length - 1][1] - ref[0][1];
  const refDy = ref[ref.length - 1][0] - ref[0][0];

  return runs.map((r) => {
    const dx = r[r.length - 1][1] - r[0][1];
    const dy = r[r.length - 1][0] - r[0][0];
    const dot = dx * refDx + dy * refDy;
    return dot < 0 ? [...r].reverse() : r;
  });
}

// ==================== Медианный трек ====================

export interface MedianTrackInput {
  latlng: [number, number][];
  /** Длина трека в метрах (для фильтрации коротких). */
  lengthM: number;
}

export interface MedianTrackResult {
  coords: [number, number][];
  isLoop: boolean;
  /** Какой из треков использовался как эталонный старт (для loop). */
  usedCount: number;
  /** Отброшенные как слишком короткие. */
  discardedCount: number;
}

/**
 * Строит медианный трек из N пробежек.
 *
 * - Отбрасывает треки с длиной < minRatio × медианы длин.
 * - Для loop-треков выравнивает старт по первой точке самого длинного.
 * - Для linear-треков авторазворачивает противоположные направления.
 * - Ресемплит каждый трек до `samples` точек, берёт медиану lat/lng.
 */
export function computeMedianTrack(
  runs: MedianTrackInput[],
  samples: number = 400,
  minRatio: number = 0.6,
): MedianTrackResult {
  if (runs.length < 2) {
    throw new Error('Нужно минимум 2 трека');
  }

  // 1. Отбрасываем короткие
  const lengths = runs.map((r) => r.lengthM);
  const medianLength = median(lengths);
  const minLength = medianLength * minRatio;

  const kept = runs.filter((r) => r.lengthM >= minLength);
  const discarded = runs.length - kept.length;

  if (kept.length < 2) {
    throw new Error(
      `Слишком много коротких треков. Оставлено ${kept.length} из ${runs.length}.`,
    );
  }

  // 2. Определяем: loop или linear (по первым двум оставшимся)
  const isLoop = kept.every((r) => {
    const first = r.latlng[0];
    const last = r.latlng[r.latlng.length - 1];
    return haversineM(first[0], first[1], last[0], last[1]) < 100;
  });

  // 3. Выравниваем старты / направления
  let prepared: [number, number][][];
  if (isLoop) {
    const ref = kept.reduce((a, b) => (a.lengthM > b.lengthM ? a : b));
    const refStart = ref.latlng[0];
    prepared = kept.map((r) => alignLoopStart(r.latlng, refStart));
  } else {
    prepared = detectAndReverseIfNeeded(kept.map((r) => r.latlng));
  }

  // 4. Ресемплим до `samples` точек
  const resampled = prepared.map((l) => resampleByDistance(l, samples));

  // 5. Медиана по каждой точке
  const result: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const lats = resampled.map((r) => r[i][0]);
    const lngs = resampled.map((r) => r[i][1]);
    result.push([median(lats), median(lngs)]);
  }

  return {
    coords: result,
    isLoop,
    usedCount: kept.length,
    discardedCount: discarded,
  };
}

// ==================== Упрощение (Дуглас-Пекер) ====================

/**
 * Упрощает трек алгоритмом Дугласа-Пекера.
 * Убирает точки на прямых участках, сохраняет кривизну.
 *
 * @param epsilonM — максимальное отклонение (в метрах), при котором
 *   точку можно убрать. 5м = сохранение всех изгибов; 15м = грубо.
 */
export function simplifyDP(
  latlng: [number, number][],
  epsilonM: number,
): [number, number][] {
  if (latlng.length <= 2) return [...latlng];

  const avgLat =
    latlng.reduce((s, p) => s + p[0], 0) / latlng.length;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);
  const epsDeg = epsilonM / 111320;
  const eps2 = epsDeg * epsDeg;

  function perpDistSq(
    p: [number, number],
    a: [number, number],
    b: [number, number],
  ): number {
    const px = p[1] * cosLat;
    const py = p[0];
    const ax = a[1] * cosLat;
    const ay = a[0];
    const bx = b[1] * cosLat;
    const by = b[0];
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) {
      return (px - ax) ** 2 + (py - ay) ** 2;
    }
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const cl = Math.max(0, Math.min(1, t));
    const projX = ax + cl * dx;
    const projY = ay + cl * dy;
    return (px - projX) ** 2 + (py - projY) ** 2;
  }

  function rec(points: [number, number][]): [number, number][] {
    if (points.length < 3) return [...points];
    let maxDist = 0;
    let maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpDistSq(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > eps2) {
      const left = rec(points.slice(0, maxIdx + 1));
      const right = rec(points.slice(maxIdx));
      return [...left.slice(0, -1), ...right];
    }
    return [first, last];
  }

  return rec(latlng);
}