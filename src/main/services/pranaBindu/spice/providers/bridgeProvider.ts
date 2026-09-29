// src/main/services/pranaBindu/spice/providers/bridgeProvider.ts
//
// Резервный провайдер Zepp через ZeppBridge CLI (child_process).
// Реализация — в 07_SPICE.md.

import type {
  ZeppDataProvider,
  ProviderCheckResult,
  RawWorkout,
  ProviderCapabilities,
} from './types';

export class ZeppBridgeProvider implements ZeppDataProvider {
  readonly name = 'zeppbridge';

  readonly capabilities: ProviderCapabilities = {
    workouts: false,
    streams: false,
    thresholds: false,
    zones: false,
    wellness: false,
  };

  async isAvailable(): Promise<ProviderCheckResult> {
    return { available: false, reason: 'not implemented' };
  }

  async fetchWorkouts(_from: string, _to: string): Promise<RawWorkout[]> {
    return [];
  }
}