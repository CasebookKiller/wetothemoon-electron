// src/main/services/pranaBindu/spice/parsers/gpsClassifier.ts

import type { GpsQuality } from './types';

const EARTH_R = 6371000;

export function haversine(
  a: [number, number],
  b: [number, number]
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

/**
 * Суммарная GPS-дистанция: haversine между последовательными
 * валидными точками. Точки без координат пропускаются, но связь
 * восстанавливается от последней валидной до следующей валидной.
 */
export function computeGpsDistanceM(
  latlng: ([number, number] | null)[]
): number {
  let total = 0;
  let prev: [number, number] | null = null;

  for (const p of latlng) {
    if (!p) continue;
    if (prev) {
      total += haversine(prev, p);
    }
    prev = p;
  }

  return total;
}

export function computeCoveragePct(
  latlng: ([number, number] | null)[]
): number {
  if (latlng.length === 0) return 0;
  const valid = latlng.filter((p) => p != null).length;
  return (valid / latlng.length) * 100;
}

/**
 * Классификация качества GPS по покрытию и расхождению
 * с шагомерной дистанцией.
 */
export function classifyGps(
  coveragePct: number,
  deltaPct: number | null
): GpsQuality {
  if (coveragePct < 50) return 'lost';
  if (deltaPct != null && deltaPct > 15) return 'lost';

  if (coveragePct >= 95 && (deltaPct == null || deltaPct < 3)) return 'good';

  return 'poor';
}