// src/main/services/pranaBindu/spice/providers/mcpProvider.ts
//
// Резервный провайдер Zepp через локальный MCP-сервер.
// Реализация — в 07_SPICE.md.

import type {
  ZeppDataProvider,
  ProviderCheckResult,
  RawWorkout,
  ProviderCapabilities,
} from './types';

export class ZeppMcpProvider implements ZeppDataProvider {
  readonly name = 'zepp-mcp';

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