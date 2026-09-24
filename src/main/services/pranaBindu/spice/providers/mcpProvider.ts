// src/main/services/pranaBindu/spice/providers/mcpProvider.ts
//
// Резервный провайдер Zepp через локальный MCP-сервер.
// Реализация — в 07_SPICE.md.

import type {
  ZeppDataProvider,
  ProviderCheckResult,
  RawWorkout,
} from './types';

export class ZeppMcpProvider implements ZeppDataProvider {
  readonly name = 'zepp-mcp';

  async isAvailable(): Promise<ProviderCheckResult> {
    return { available: false, reason: 'not implemented' };
  }

  async fetchWorkouts(_from: string, _to: string): Promise<RawWorkout[]> {
    return [];
  }
}