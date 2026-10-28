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

/** Возвращает угол направления в градусах (0-360). */
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI + 360; // 0..360
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
  /** Проходы в прямом направлении (от старта к финишу). */
  forwardPasses: number;
  /** Проходы в обратном направлении (от финиша к старту). */
  backwardPasses: number;
  isClean: boolean;
}

/**
 * Быстрое отклонение трека от эталона через grid-хэш.
 *
 * @param trackLatlng      — сэмплированный трек (уже ~1000 точек).
 * @param refIndex          — заранее построенный RefIndex эталона.
 * @param covRadiusM        — радиус покрытия (для coveragePct).
 * @param onRefRadiusM      — радиус «на эталоне» (для metersOnRef + gated median).
 * @param checkpointCount   — количество контрольных точек (3..12).
 *                            Для сложных маршрутов с детурами увеличивать.
 */
export function computeDeviationFast(
  trackLatlng: [number, number][],
  refIndex: RefIndex,
  covRadiusM = 20,
  onRefRadiusM = 50,
  checkpointCount = 12,
  directionToleranceDeg = 45,
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
      forwardPasses: 0,
      backwardPasses: 0,
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

  // 3. Gated median: считаем медиану только по точкам трека, лежащим
  //    в радиусе onRefRadiusM от эталона. Точки разминки/заминки (в стороне)
  //    не должны раздувать медиану.
  //
  //    Пример (1068): из 1000 точек 400 — разминка/заминка (500-1300 м),
  //    600 — на круге (20-40 м). Полная медиана = 247 м (артефакт).
  //    Gated медиана = 30 м (правда).
  //
  //    Если «рядом» оказалось < 5 точек (трек почти не пересекается с эталоном),
  //    fallback на полную медиану — иначе получим бессмысленное число.
  const gatedForMedian = devsForMedian.filter((d) => d <= ON_REF_RADIUS_M);
  const sourceForMedian =
    gatedForMedian.length >= 5 ? gatedForMedian : devsForMedian;

  const devsSorted = [...sourceForMedian].sort((a, b) => a - b);
  const medianM = devsSorted[Math.floor(devsSorted.length / 2)] ?? 0;

  // p95 считаем по ПОЛНОМУ набору, чтобы видеть выбросы (разминка/заминка)
  const devsSortedFull = [...devsForMedian].sort((a, b) => a - b);
  const p95M =
    devsSortedFull[
      Math.min(devsSortedFull.length - 1, Math.floor(devsSortedFull.length * 0.95))
    ] ?? 0;

  // 4. ref → track (grid по треку для быстрого «покрыто?»)
    // Предрасчет направлений (азимутов)
  const trackBearings: number[] = new Array(trackLatlng.length).fill(0);
  for (let i = 0; i < trackLatlng.length; i++) {
    const p1 = trackLatlng[Math.max(0, i - 2)];
    const p2 = trackLatlng[Math.min(trackLatlng.length - 1, i + 2)];
    trackBearings[i] = getBearing(p1[0], p1[1], p2[0], p2[1]);
  }

  const refBearings: number[] = new Array(refCoords.length).fill(0);
  for (let i = 0; i < refCoords.length; i++) {
    const p1 = refCoords[Math.max(0, i - 1)];
    const p2 = refCoords[Math.min(refCoords.length - 1, i + 1)];
    refBearings[i] = getBearing(p1[0], p1[1], p2[0], p2[1]);
  }

  // 4. ref -> track (Direction-aware покрытие)
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
  for (let rIdx = 0; rIdx < refCoords.length; rIdx++) {
    const [rlat, rlng] = refCoords[rIdx];
    const refBearing = refBearings[rIdx];
    
    let closestDist = Infinity;
    let bestTrackIdx = -1;

    const { cx, cy } = latLngToCell(rlat, rlng, cosLat);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = trkCells.get(cellKey(cx + dx, cy + dy));
        if (!arr) continue;
        for (const idx of arr) {
          const [tlat, tlng] = trackLatlng[idx];
          const d = haversineM(rlat, rlng, tlat, tlng);
          if (d < closestDist) {
            closestDist = d;
            bestTrackIdx = idx;
          }
        }
      }
    }

    if (bestTrackIdx !== -1 && closestDist <= covRadiusM) {
      const trackBearing = trackBearings[bestTrackIdx];
      const angleDiff = Math.abs((trackBearing - refBearing + 360) % 360);
      
      const isForward = angleDiff < directionToleranceDeg || angleDiff > 360 - directionToleranceDeg;
      const isBackward = angleDiff > 180 - directionToleranceDeg && angleDiff < 180 + directionToleranceDeg;

      // Если направление совпадает (туда или обратно) — точка покрыта
      if (isForward || isBackward) {
        covered++;
      }
    }
  }
  const coveragePct = Math.round((covered / refCoords.length) * 100);

  // 5. metersOnRef: считаем по всем точкам, gated по devsAll.
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

  // 6. Direction-aware checkpointPasses
  const safeCpCount = Math.max(3, Math.min(12, Math.floor(checkpointCount)));
  const cpFractions: number[] = [];
  for (let i = 1; i <= safeCpCount; i++) {
    cpFractions.push(i / (safeCpCount + 1));
  }

  const isLoop = haversineM(
    refCoords[0][0], refCoords[0][1],
    refCoords[refCoords.length - 1][0], refCoords[refCoords.length - 1][1]
  ) < 50;

  const cpList: { lat: number; lng: number; bearing: number }[] = [];
  for (const frac of cpFractions) {
    const cpIdx = Math.floor(refCoords.length * frac);
    const p1 = refCoords[Math.max(0, cpIdx - 1)];
    const p2 = refCoords[Math.min(refCoords.length - 1, cpIdx + 1)];
    const bearing = getBearing(p1[0], p1[1], p2[0], p2[1]);
    cpList.push({ lat: refCoords[cpIdx][0], lng: refCoords[cpIdx][1], bearing });
  }

  const fwdHits = new Array(safeCpCount).fill(0);
  const bwdHits = new Array(safeCpCount).fill(0);
  const cpStates = new Array(safeCpCount).fill(false);

  for (let i = 0; i < trackLatlng.length; i++) {
    const [tlat, tlng] = trackLatlng[i];
    const trackBearing = trackBearings[i];

    for (let c = 0; c < safeCpCount; c++) {
      const cp = cpList[c];
      const d = haversineM(cp.lat, cp.lng, tlat, tlng);
      
      if (d < 30 && !cpStates[c]) {
        cpStates[c] = true;
        const angleDiff = Math.abs((trackBearing - cp.bearing + 360) % 360);
        const isForward = angleDiff < directionToleranceDeg || angleDiff > 360 - directionToleranceDeg;
        const isBackward = angleDiff > 180 - directionToleranceDeg && angleDiff < 180 + directionToleranceDeg;

        if (isForward) {
          fwdHits[c]++;
        } else if (isBackward) {
          bwdHits[c]++;
        }
      } else if (d > 80 && cpStates[c]) {
        cpStates[c] = false;
      }
    }
  }

  const fwdSorted = [...fwdHits].sort((a, b) => a - b);
  const bwdSorted = [...bwdHits].sort((a, b) => a - b);
  const fwdPasses = fwdSorted[Math.floor(fwdSorted.length * 0.25)] || 0;
  const bwdPasses = bwdSorted[Math.floor(bwdSorted.length * 0.25)] || 0;
  
  let checkpointPasses = 0;
  if (isLoop) {
    checkpointPasses = Math.max(fwdPasses, bwdPasses);
  } else {
    checkpointPasses = fwdPasses + bwdPasses;
  }

  // Для UI сохраняем, сколько было "туда" и сколько "обратно"
  const finalForwardPasses = isLoop ? fwdPasses : fwdPasses;
  const finalBackwardPasses = isLoop ? bwdPasses : bwdPasses;

  // Если КП вообще не пройдены, но coverage высокий — страховка
  const finalCpPasses = checkpointPasses === 0 && coveragePct >= 70 ? 1 : checkpointPasses;

  // 7. repeats
  let refLengthM = 0;
  for (let i = 1; i < refCoords.length; i++) {
    refLengthM += haversineM(
      refCoords[i - 1][0], refCoords[i - 1][1],
      refCoords[i][0], refCoords[i][1],
    );
  }


  let repeats = 0;
  if (refLengthM > 0) {
    const rawRatio = metersOnRef / refLengthM;
    if (isLoop) {
      if (finalCpPasses >= 1) {
        repeats = finalCpPasses;
      } else if (coveragePct >= 70) {
        repeats = Math.max(1, Math.round(rawRatio));
      }
    } else {
      if (finalCpPasses >= 1) {
        repeats = finalCpPasses;
      } else if (coveragePct >= 70) {
        repeats = Math.max(1, Math.round(rawRatio));
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
    checkpointPasses: finalCpPasses,
    forwardPasses: finalForwardPasses,
    backwardPasses: finalBackwardPasses,
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
  // ratio = сколько длин эталона покрыто треком.
  // Для loop - "сколько раз пробежал круг".
  // Для linear - "сколько раз прошёл отрезок" (1x, 2x, 3x, ...).
  const ratio = input.atomLenM > 0 ? input.metersOnRef / input.atomLenM : 0;
  const isLoop = input.atomKind === 'loop' || input.atomKind === 'stadium';
  const medianOk = input.medianM <= t.medianMaxM;

  // Для linear: используем repeats из computeDeviationFast (CPs-first).
  // computeDeviationFast уже посчитал repeats надёжнее, чем ratio
  // (для out-and-back CPs = 2, даже если ratio из-за GPS-шума = 1.5).
  // Здесь ничего не пересчитываем — только floor (защита от float).
  const repeats = Math.max(0, Math.floor(input.repeats));

  let used = false;
  if (isLoop) {
    used =
      input.coveragePct >= t.coverageUsed &&
      repeats >= 1 &&
      medianOk;
  } else {
    // Для linear: repeats из CPs (уже посчитан в computeDeviationFast).
    // ratioLinearMax больше не проверяется — out-and-back проходит.
    // ratioLinearMin — защита от случая, когда трек прошёл мимо (ratio < 0.75).
    used =
      input.coveragePct >= t.coverageUsed &&
      repeats >= 1 &&
      ratio >= t.ratioLinearMin &&
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
      // Для linear — match относительно фактического числа проходов (из CPs).
      // Если CPs дали 2, а ratio 1.5 — match по ratio, но база 2.
      const nearestInt = Math.max(1, repeats);
      match = 1 - Math.abs(ratio - nearestInt) / nearestInt;
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