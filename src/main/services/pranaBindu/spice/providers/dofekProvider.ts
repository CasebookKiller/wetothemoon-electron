// src/main/services/pranaBindu/spice/providers/dofekProvider.ts
//
// Основной провайдер Zepp. Использует @dofek/zepp-client через
// regionDetector.ts. Реальные запросы к данным — в 07_SPICE.md.

import type {
  ZeppDataProvider,
  ProviderCheckResult,
  RawWorkout,
  ProviderCapabilities,
} from './types';

export class DofekZeppProvider implements ZeppDataProvider {
  readonly name = 'dofek-zepp';

  readonly capabilities: ProviderCapabilities = {
    workouts: true,
    streams: false,      // пока не реализовали
    thresholds: false,
    zones: false,
    wellness: false,
  };
  
  /**
   * Проверка доступности. Сейчас — просто сообщаем, что провайдер
   * рабочий. Реальная проверка через sync_settings (наличие appToken)
   * появится после Melange. Пока возвращаем заглушку, которую handler
   * переопределяет через sync_settings.
   */
  async isAvailable(): Promise<ProviderCheckResult> {
    return { available: false, reason: 'not connected' };
  }

  async fetchWorkouts(_from: string, _to: string): Promise<RawWorkout[]> {
    // TODO(07_SPICE): реальные запросы к api-mifit-*.zepp.com
    return [];
  }
}