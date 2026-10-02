/**
 * Prana-Bindu Core — базовые доменные типы.
 * Пульсовые зоны, профиль, тренировочные блоки.
 */

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface ZoneDefinition {
  zone: HeartRateZone;
  name: string;
  /** Границы в уд/мин (абсолютные) */
  minBpm: number;
  maxBpm: number;
  /** Доля от maxHr, например [0.5, 0.6] */
  fraction: [number, number];
  description: string;
}

export interface Profile {
  age?: number;
  /** Максимальный пульс, уд/мин */
  maxHr?: number;
  /** Пульс покоя, уд/мин */
  restingHr?: number;
  weightKg?: number;
  /** Порог лактата, уд/мин (опционально) */
  lactateThresholdHr?: number;
  /** Целевая дата марафона, ISO (YYYY-MM-DD) */
  marathonDate?: string;
  // v10 — источник значения: 'icu' | 'dodofo' | 'manual' | 'computed'
  lthrSource?: string;
  maxHrSource?: string;
  restingHrSource?: string;
  /** Границы HR-зон (последняя — верхняя). Из ICU: 7 значений. */
  hrZones?: number[];
  hrZonesSource?: string;
    /** Границы pace-зон в км/ч (верхние). Из ICU: 7 значений. */
  paceZonesKmh?: number[];
  /** Пороговая скорость, м/с (как в ICU). */
  thresholdPaceMs?: number;
  paceZonesSource?: string;
}

export type TrainingBlockType =
  | 'easy'
  | 'long'
  | 'tempo'
  | 'interval'
  | 'recovery'
  | 'strength';

export interface TrainingBlock {
  type: TrainingBlockType;
  durationMin?: number;
  distanceKm?: number;
  targetZone?: HeartRateZone;
  notes?: string;
}

export type PlanCategory = 'WORKOUT' | 'PLAN' | 'TARGET' | 'NOTE' | 'RACE';

export interface WorkoutStep {
  /** 'Warmup' | 'Interval' | 'Cooldown' | 'Recovery' | ... */
  type?: string;
  /** Длительность в секундах. */
  duration?: number;
  /** Дистанция в метрах. */
  distance?: number;
  /** Целевая зона пульса (1-based). */
  hrZone?: number;
  /** Целевая зона темпа (1-based). */
  paceZone?: number;
  /** Целевая зона мощности (1-based). */
  powerZone?: number;
  /** Количество повторов. */
  reps?: number;
  /** Исходный шаг, как пришёл от ICU. */
  raw: unknown;
}

export interface PlanEvent {
  id?: number;
  externalId: string;
  date: string;               // YYYY-MM-DD
  startTime?: string;         // ISO 8601 UTC, если задано
  endTime?: string;
  category: PlanCategory;
  sport?: string;             // 'Run' | 'Workout' | ...
  name: string;
  description?: string;
  plannedLoad?: number;
  durationSec?: number;
  distanceM?: number;
  steps?: WorkoutStep[];
  zoneTimes?: Array<{ zone: string; secs: number }>;
  pairedActivityId?: number;
  raw?: unknown;
}