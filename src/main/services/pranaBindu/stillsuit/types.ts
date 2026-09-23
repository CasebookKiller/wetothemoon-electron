/**
 * Stillsuit — марафонская линия.
 * Пульс, темп, экономичность, дыхание.
 */

import type { HeartRateZone } from '../core/types';

export type RunType = 'easy' | 'long' | 'tempo' | 'interval' | 'recovery';

export interface RunPlan {
  id?: number;
  /** YYYY-MM-DD */
  date: string;
  type: RunType;
  targetDistanceKm?: number;
  targetDurationMin?: number;
  targetPaceMinPerKm?: number;
  targetZone?: HeartRateZone;
  notes?: string;
}

export interface RunFact {
  id?: number;
  date: string;
  distanceKm?: number;
  durationMin?: number;
  avgPaceMinPerKm?: number;
  avgHr?: number;
  maxHr?: number;
  cadence?: number;
  source?: 'manual' | 'google-fit' | 'zeppbridge' | 'intervals';
  externalId?: string;
  notes?: string;
}

/** Экономичность бега: сколько метров на один удар сердца. */
export interface EfficiencyMetric {
  date: string;
  metersPerBeat: number;
}