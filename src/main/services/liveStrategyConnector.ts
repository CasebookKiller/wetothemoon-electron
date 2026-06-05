import { marketDataBus } from './marketDataBus';
import { volumeProfileEngine } from './volumeProfileEngine';
import { VolumeAccumulationStrategy } from './backtest/strategies/VolumeAccumulationStrategy';
import { OrderManager } from './orderManager';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import type { VolumeProfileLevels } from './volumeProfileEngine';

export function connectLiveStrategy(instrumentUid: string, manager: OrderManager) {
  // Создаём стратегию с пустым профилем — он заполнится при первом profileUpdate
  const strategy = new VolumeAccumulationStrategy(instrumentUid, null, {
    volumeFilterEnabled: false,
    volumeFilterPeriod: 20,
  });

  // Подписываемся на обновления профиля от движка
  volumeProfileEngine.on('profileUpdate', (profile: VolumeProfileLevels) => {
    if (profile.instrumentUid === instrumentUid) {
      strategy.updateProfile(profile);
    }
  });

  // Обрабатываем свечи
  marketDataBus.on('candle', (candle: StreamCandle) => {
    strategy.onCandle(candle);
    const signals = strategy.getSignals();
    for (const signal of signals) {
      manager.processSignal(signal);
    }
    strategy.clearSignals();
  });
}