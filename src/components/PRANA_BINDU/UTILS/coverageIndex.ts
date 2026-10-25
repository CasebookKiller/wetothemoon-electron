// src/components/PRANA_BINDU/UTILS/coverageIndex.ts
//
// Быстрое сравнение трека с эталоном через grid-хэш (B.1).
// Ускорение ~20-30× относительно O(n×m). Используется в batch-режиме
// для автоопределения пробежек по атомам.

import type { CoverageThresholds } from './coverageThresholds';

// ==================== Haversine ====================

function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
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

// ==================== Grid-индекс эталона ====================

const CELL_SIZE_M = 50;

export interface RefIndex {
  coords: [number, number][];
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  cosLat: number;
  cells: Map<string, number[]>; // "cx,cy" -> индексы в coords
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function latLngToCell(
  lat: number,
  lng: number,
  cosLat: number,
): { cx: number; cy: number } {
  const xM = lng * cosLat * 111320;
  const yM = lat * 111320;
  return {
    cx: Math.floor(xM / CELL_SIZE_M),
    cy: Math.floor(yM / CELL_SIZE_M),
  };
}

export function buildRefIndex(coords: [number, number][]): RefIndex {
  if (coords.length === 0) {
    return {
      coords: [],
      bbox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
      cosLat: 1,
      cells: new Map(),
    };
  }

  let sumLat = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of coords) {
    sumLat += lat;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const avgLat = sumLat / coords.length;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);

  const cells = new Map<string, number[]>();
  coords.forEach(([lat, lng], idx) => {
    const { cx, cy } = latLngToCell(lat, lng, cosLat);
    const k = cellKey(cx, cy);
    let arr = cells.get(k);
    if (!arr) {
      arr = [];
      cells.set(k, arr);
    }
    arr.push(idx);
  });

  return {
    coords,
    bbox: { minLat, maxLat, minLng, maxLng },
    cosLat,
    cells,
  };
}

// ==================== Быстрое отклонение ====================

export interface FastDeviationResult {
  medianM: number;
  p95M: number;
  coveragePct: number;
  metersOnRef: number;
  /** Реальное число проходов эталона. */
  repeats: number;
  /** Количество проходов через контрольные точки (медиана). */
  checkpointPasses: number;
  isClean: boolean;
}

/**
 * Быстрое отклонение трека от эталона через grid-хэш.
 *
 * @param trackLatlng — сэмплированный трек (уже ~1000 точек).
 * @param refIndex     — заранее построенный RefIndex эталона.
 */
export function computeDeviationFast(
  trackLatlng: [number, number][],
  refIndex: RefIndex,
  covRadiusM = 20,
  onRefRadiusM = 50,
): FastDeviationResult | null {
  if (trackLatlng.length < 10) return null;
  if (refIndex.coords.length < 2) return null;

  const { coords: refCoords, bbox, cosLat, cells } = refIndex;

  // 1. bbox: если трек целиком далеко от эталона — сразу return 0.
  const MARGIN_DEG_LAT = 200 / 111320;
  const MARGIN_DEG_LNG = 200 / (111320 * cosLat);
  let trkMinLat = Infinity;
  let trkMaxLat = -Infinity;
  let trkMinLng = Infinity;
  let trkMaxLng = -Infinity;
  for (const [lat, lng] of trackLatlng) {
    if (lat < trkMinLat) trkMinLat = lat;
    if (lat > trkMaxLat) trkMaxLat = lat;
    if (lng < trkMinLng) trkMinLng = lng;
    if (lng > trkMaxLng) trkMaxLng = lng;
  }
  const noOverlap =
    trkMaxLat < bbox.minLat - MARGIN_DEG_LAT ||
    trkMinLat > bbox.maxLat + MARGIN_DEG_LAT ||
    trkMaxLng < bbox.minLng - MARGIN_DEG_LNG ||
    trkMinLng > bbox.maxLng + MARGIN_DEG_LNG;
  if (noOverlap) {
    return {
      medianM: 999,
      p95M: 999,
      coveragePct: 0,
      metersOnRef: 0,
      repeats: 0,
      checkpointPasses: 0,
      isClean: false,
    };
  }

  // 2. track → ref (grid-хэш). Считаем по всем точкам, но медиану — по прореженным.
  const devsAll: number[] = [];
  const devsForMedian: number[] = [];
  const ON_REF_RADIUS_M = onRefRadiusM;
  const MEDIAN_STEP = Math.max(1, Math.floor(trackLatlng.length / 200));

  for (let i = 0; i < trackLatlng.length; i++) {
    const [lat, lng] = trackLatlng[i];
    const { cx, cy } = latLngToCell(lat, lng, cosLat);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = cells.get(cellKey(cx + dx, cy + dy));
        if (!arr) continue;
        for (const idx of arr) {
          const [rlat, rlng] = refCoords[idx];
          const d = haversineM(lat, lng, rlat, rlng);
          if (d < best) {
            best = d;
            if (best < 1) break;
          }
        }
        if (best < 1) break;
      }
      if (best < 1) break;
    }
    if (best === Infinity) {
      for (const [rlat, rlng] of refCoords) {
        const d = haversineM(lat, lng, rlat, rlng);
        if (d < best) best = d;
      }
    }
    devsAll.push(best);
    if (i % MEDIAN_STEP === 0) devsForMedian.push(best);
  }

  const devsSorted = [...devsForMedian].sort((a, b) => a - b);
  const medianM = devsSorted[Math.floor(devsSorted.length / 2)] ?? 0;
  const p95M =
    devsSorted[Math.min(devsSorted.length - 1, Math.floor(devsSorted.length * 0.95))] ??
    0;

  // 3. ref → track (grid по треку для быстрого «покрыто?»)
  const trkCells = new Map<string, number[]>();
  trackLatlng.forEach(([lat, lng], idx) => {
    const { cx, cy } = latLngToCell(lat, lng, cosLat);
    const k = cellKey(cx, cy);
    let arr = trkCells.get(k);
    if (!arr) {
      arr = [];
      trkCells.set(k, arr);
    }
    arr.push(idx);
  });

  let covered = 0;
  for (const [rlat, rlng] of refCoords) {
    const { cx, cy } = latLngToCell(rlat, rlng, cosLat);
    let hit = false;
    for (let dx = -1; dx <= 1 && !hit; dx++) {
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const arr = trkCells.get(cellKey(cx + dx, cy + dy));
        if (!arr) continue;
        for (const idx of arr) {
          const [tlat, tlng] = trackLatlng[idx];
          if (haversineM(rlat, rlng, tlat, tlng) <= covRadiusM) {
            hit = true;
            break;
          }
        }
      }
    }
    if (hit) covered++;
  }
  const coveragePct = Math.round((covered / refCoords.length) * 100);

  // 4. metersOnRef: считаем по всем точкам, gated по devsAll.
  let metersOnRef = 0;
  for (let i = 1; i < trackLatlng.length; i++) {
    if (
      devsAll[i - 1] <= ON_REF_RADIUS_M ||
      devsAll[i] <= ON_REF_RADIUS_M
    ) {
      metersOnRef += haversineM(
        trackLatlng[i - 1][0], trackLatlng[i - 1][1],
        trackLatlng[i][0], trackLatlng[i][1],
      );
    }
  }

    // 5. checkpointPasses: проходы через 4 контрольные точки
  const cpFractions = [0.2, 0.4, 0.6, 0.8];
  const passesArray: number[] = [];
  
  for (const frac of cpFractions) {
    const cpIdx = Math.floor(refCoords.length * frac);
    const cp = refCoords[cpIdx];
    let passes = 0;
    let state = 'far';
    
    for (const [tlat, tlng] of trackLatlng) {
      const d = haversineM(cp[0], cp[1], tlat, tlng);
      if (d < 30) {
        if (state !== 'near') {
          passes++;
          state = 'near';
        }
      } else if (d > 100) {
        state = 'far';
      }
    }
    passesArray.push(passes);
  }
  
  passesArray.sort((a, b) => a - b);
  const checkpointPasses = passesArray[Math.floor(passesArray.length / 2)] || 0;

  // 6. repeats
  let refLengthM = 0;
  for (let i = 1; i < refCoords.length; i++) {
    refLengthM += haversineM(
      refCoords[i - 1][0], refCoords[i - 1][1],
      refCoords[i][0], refCoords[i][1],
    );
  }

  const isLoop = haversineM(
    refCoords[0][0], refCoords[0][1],
    refCoords[refCoords.length - 1][0], refCoords[refCoords.length - 1][1]
  ) < 50;

  let repeats = 0;
  if (refLengthM > 0) {
    const rawRatio = metersOnRef / refLengthM;
    if (isLoop) {
      // Берем максимум из пройденных метров и КП. КП спасают от потери GPS.
      repeats = Math.max(checkpointPasses, Math.floor(rawRatio));
      if (coveragePct >= 90) {
        const rounded = Math.round(rawRatio);
        if (Math.abs(rawRatio - rounded) < 0.35) {
          repeats = Math.max(repeats, rounded);
        }
      }
    } else {
      // Для прямых (linear) считаем только по метрам.
      repeats = Math.floor(rawRatio);
      if (coveragePct >= 90 && Math.abs(rawRatio - Math.round(rawRatio)) < 0.35) {
        repeats = Math.round(rawRatio);
      }
    }
  }
  
  if (repeats < 1 && coveragePct >= 70) {
    repeats = 1;
  }

  return {
    medianM: Math.round(medianM),
    p95M: Math.round(p95M),
    coveragePct,
    metersOnRef: Math.round(metersOnRef),
    repeats,
    checkpointPasses,
    isClean: medianM < 15 && coveragePct >= 90,
  };
}

// ==================== Классификация ====================

export type CoverageClass = 'used' | 'similar' | 'unused';

export interface ClassifyInput {
  coveragePct: number;
  medianM: number;
  /** Сколько метров трека лежит на эталоне. */
  metersOnRef: number;
  atomLenM: number;
  atomKind: 'loop' | 'linear' | 'stadium' | null;
  /** Точное число проходов. */
  repeats: number;
}

export interface ClassifyResult {
  cls: CoverageClass;
  ratio: number;
  repeats: number;
  score: number;
}

export function classifyCoverage(
  input: ClassifyInput,
  t: CoverageThresholds,
): ClassifyResult {
  // ratio теперь считается от длины трека, лежащего на эталоне (metersOnRef),
  // а не от общей длины трека. Это игнорирует разминку/заминку.
  const ratio = input.atomLenM > 0 ? input.metersOnRef / input.atomLenM : 0;
  const isLoop = input.atomKind === 'loop' || input.atomKind === 'stadium';
  const medianOk = input.medianM <= t.medianMaxM;

  const repeats = isLoop
    ? Math.max(0, Math.floor(input.repeats))
    : Math.min(1, Math.max(0, Math.floor(input.repeats || (ratio >= 0.9 ? 1 : 0))));

  let used = false;
  if (isLoop) {
    used =
      input.coveragePct >= t.coverageUsed &&
      repeats >= 1 &&
      medianOk;
  } else {
    used =
      input.coveragePct >= t.coverageUsed &&
      ratio >= t.ratioLinearMin &&
      ratio <= t.ratioLinearMax &&
      medianOk;
  }

  let cls: CoverageClass;
  if (used) cls = 'used';
  else if (input.coveragePct >= t.coverageSimilar && medianOk)
    cls = 'similar';
  else cls = 'unused';

  // score для primary
  let score = 0;
  if (used) {
    // 1. Насколько точно совпало количество кругов/отрезков.
    let match = 0;
    if (isLoop) {
      const targetRatio = Math.max(1, Math.round(ratio));
      // Используем repeats как базу, чтобы match был 1.0 для идеального попадания
      const base = Math.max(1, repeats);
      match = 1 - Math.abs(ratio - base) / base;
    } else {
      match = 1 - Math.abs(ratio - 1.0);
    }
    match = Math.max(0, Math.min(1, match));

    // 2. Штраф за отклонение (medianM). Делаем его мягче, т.к. в Москве
    // 30-40 м — нормальная погрешность GPS.
    // При 0 м = 1.0, при 40 м = 0.67, при 80 м = 0.33, ниже 0.3 не опускается.
    const rawPenalty = 1 - input.medianM / 120;
    const deviationPenalty = Math.max(0.3, Math.min(1, rawPenalty));

    // Итоговый score
    score = input.coveragePct * match * deviationPenalty;
  }

  return { cls, ratio, repeats, score };
}