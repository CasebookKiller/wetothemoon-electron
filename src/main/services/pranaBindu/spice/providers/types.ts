/**
 * Интерфейс провайдера данных Zepp.
 * Реализации — dofek / mcp / bridge — в 09 (каркас) и 07 (боевая логика).
 */

export interface RawWorkout {
  externalId: string;
  source: string;
  origin?: string;
  startTime: string;
  endTime: string;
  distanceM?: number;
  durationS?: number;
  avgHr?: number;
  maxHr?: number;
  gpsQuality?: string;         // ← новое
  distanceSource?: string;     // ← новое
  gpsCoveragePct?: number;     // ← новое
  raw?: unknown;
  name?: string;
}

export interface ProviderCheckResult {
  available: boolean;
  reason?: string;
}

export interface ProviderCapabilities {
  workouts: boolean;
  streams: boolean;
  thresholds: boolean;
  zones: boolean;
  wellness: boolean;
}

export interface ZeppDataProvider {
  name: string;
  capabilities: ProviderCapabilities;
  isAvailable(): Promise<ProviderCheckResult>;
  fetchWorkouts?(from: string, to: string): Promise<RawWorkout[]>;
  fetchStreams?(activityId: number | string): Promise<unknown>;
  fetchThresholds?(): Promise<unknown>;
  fetchZones?(): Promise<unknown>;
  fetchWellness?(from: string, to: string): Promise<unknown>;
}