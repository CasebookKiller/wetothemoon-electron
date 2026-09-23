/**
 * Интерфейс провайдера данных Zepp.
 * Реализации — dofek / mcp / bridge — в 09 (каркас) и 07 (боевая логика).
 */

export interface RawWorkout {
  externalId: string;
  source: string;
  startTime: string;
  endTime: string;
  distanceM?: number;
  durationS?: number;
  avgHr?: number;
  maxHr?: number;
  raw?: unknown;
}

export interface ProviderCheckResult {
  available: boolean;
  reason?: string;
}

export interface ZeppDataProvider {
  name: string;
  isAvailable(): Promise<ProviderCheckResult>;
  fetchWorkouts(from: string, to: string): Promise<RawWorkout[]>;
}