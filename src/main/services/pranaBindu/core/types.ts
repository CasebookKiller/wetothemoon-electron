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