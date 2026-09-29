// src/main/services/pranaBindu/spice/parsers/types.ts
//
// Единый внутренний формат тренировки. Источники: FIT, TCX, dodofo, manual.
// С этим форматом работают валидатор, GPS-классификатор, репозитории.

export type WorkoutSource = 'fit' | 'tcx' | 'dodofo' | 'manual' | 'live-journal';
export type SportType = 'run' | 'walk' | 'ride' | 'other';
export type GpsQuality = 'good' | 'poor' | 'lost';
export type DistanceSource = 'gps' | 'accelerometer' | 'manual';

export type ValidationFlag =
  | 'hr_flatline'
  | 'power_out_of_range'
  | 'pace_anomaly'
  | 'elevation_suspicious'
  | 'gps_lost'
  | 'distance_mismatch'
  | 'empty_streams'
  | 'duration_mismatch';

export interface UnifiedStreams {
  secT: number[];
  hr?: (number | null)[];
  speedKmh?: (number | null)[];
  cadence?: (number | null)[];
  elevationM?: (number | null)[];
  latlng?: ([number, number] | null)[];
  distM?: number[];
  powerW?: (number | null)[];
}

export interface UnifiedSummary {
  avgHr?: number;
  maxHr?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  avgCadence?: number;
  maxCadence?: number;
  elevationGain?: number;
  elevationLoss?: number;
  gpsQuality: GpsQuality;
  distanceSource: DistanceSource;
  gpsCoveragePct: number;
  gpsDistanceM?: number;
  accelDistanceM?: number;
  distanceDeltaPct?: number;
}

export interface UnifiedValidation {
  flags: ValidationFlag[];
  confidence: number;
}

export interface UnifiedLap {
  index: number;
  distanceM?: number;
  durationSec?: number;
  avgHr?: number;
  maxHr?: number;
  avgSpeedKmh?: number;
}

export interface UnifiedWorkout {
  source: WorkoutSource;
  externalId: string;
  startTime: string;
  durationSec: number;
  distanceM: number;
  sport: SportType;
  streams: UnifiedStreams;
  summary: UnifiedSummary;
  validation: UnifiedValidation;
  laps?: UnifiedLap[];
}