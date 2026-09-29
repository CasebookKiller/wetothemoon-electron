// src/main/services/pranaBindu/spice/validation/workoutValidator.ts

import type {
  UnifiedWorkout,
  UnifiedValidation,
  ValidationFlag,
} from '../parsers/types';

function uniqCount(arr: (number | null)[]): number {
  const s = new Set<number>();
  for (const v of arr) {
    if (v != null && Number.isFinite(v)) s.add(v);
  }
  return s.size;
}

export function validateWorkout(w: UnifiedWorkout): UnifiedValidation {
  const flags: ValidationFlag[] = [];

  const hr = w.streams.hr;
  const speed = w.streams.speedKmh;
  const power = w.streams.powerW;
  const secT = w.streams.secT;

  // 1. Пустые потоки
  if (!secT || secT.length < 2) {
    flags.push('empty_streams');
  }

  // 2. HR flatline
  if (hr && hr.length > 100) {
    const uniq = uniqCount(hr);
    if (uniq < 20) flags.push('hr_flatline');
  }

  // 3. Power out of range (для бега)
  if (w.sport === 'run' && power) {
    const valid = power.filter((v): v is number => v != null && v > 0);
    if (valid.length > 0) {
      const maxP = Math.max(...valid);
      const avgP = valid.reduce((a, b) => a + b, 0) / valid.length;
      if (maxP > 800 || avgP > 500) flags.push('power_out_of_range');
    }
  }

  // 4. Pace anomaly (грубо): max speed > avg*3
  if (speed && speed.length > 10) {
    const valid = speed.filter((v): v is number => v != null && v > 0);
    if (valid.length > 0) {
      const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
      const max = Math.max(...valid);
      if (avg > 0 && max > avg * 3) flags.push('pace_anomaly');
    }
  }

  // 5. Elevation suspicious
  if (w.summary.elevationGain != null && w.distanceM > 0) {
    const km = w.distanceM / 1000;
    if (w.summary.elevationGain > km * 300) {
      flags.push('elevation_suspicious');
    }
  }

  // 6. GPS lost
  if (w.summary.gpsCoveragePct < 50) flags.push('gps_lost');

  // 7. Distance mismatch
  if (w.summary.distanceDeltaPct != null && w.summary.distanceDeltaPct > 15) {
    flags.push('distance_mismatch');
  }

  // 8. Duration mismatch
  if (secT && secT.length >= 2) {
    const span = secT[secT.length - 1] - secT[0];
    if (Math.abs(span - w.durationSec) > w.durationSec * 0.05) {
      flags.push('duration_mismatch');
    }
  }

  // Confidence
  let confidence = 100;
  for (const f of flags) {
    switch (f) {
      case 'empty_streams':        confidence -= 80; break;
      case 'hr_flatline':          confidence -= 20; break;
      case 'gps_lost':             confidence -= 30; break;
      case 'distance_mismatch':    confidence -= 15; break;
      case 'duration_mismatch':    confidence -= 15; break;
      case 'power_out_of_range':   confidence -= 10; break;
      case 'pace_anomaly':         confidence -= 10; break;
      case 'elevation_suspicious': confidence -= 10; break;
    }
  }
  confidence = Math.max(0, Math.min(100, confidence));

  return { flags, confidence };
}