// src/main/services/autonomousTrader.ts

import { marketDataBus } from './marketDataBus';
import { OrderManager } from './orderManager';
import { StrategyManager } from './strategyManager';
import { CompositeProfileService } from './compositeProfile';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';

import { EventEmitter } from 'events';
import { volumeProfileEngine } from './volumeProfileEngine';

console.log('[autonomousTrader] marketDataBus instance id:', marketDataBus.getInstanceId());

/**
 * Автономный трейдер, который динамически выбирает стратегии
 * в зависимости от текущей фазы рынка и автоматически отправляет
 * сигналы в OrderManager.
 *
 * Не зависит от Electron и может быть использован в облачном процессе.
 */
export class AutonomousTrader extends EventEmitter {
  // active хранит обработчики свечей для каждого запущенного инструмента
  private active = new Map<string, { handler: (candle: StreamCandle) => void }>();

  constructor(
    private orderManager: OrderManager,
    private strategyManager: StrategyManager,
    private compositeProfile: CompositeProfileService
  ) {
    super(); // ← обязательно
  }

  /**
   * Запустить автоматическую торговлю для указанного инструмента.
   * @param instrumentUid - идентификатор инструмента
   * @param token - токен для загрузки исторических данных (обычно read‑only)
   */
  async start(instrumentUid: string, token: string): Promise<void> {
    if (this.active.has(instrumentUid)) {
      console.warn(`[AutonomousTrader] ${instrumentUid} уже запущен`);
      return;
    }

    // Подписываемся на сигналы от VolumeProfileEngine (вместо marketDataBus)
    const handler = (signal: any) => {
      console.log('[AutonomousTrader] signal handler called', signal.instrumentUid, signal.type);
      // Временно без фильтра – принимаем все сигналы
      this.emit('signal', {
        instrumentUid: signal.instrumentUid,
        signal: { type: signal.type, price: signal.price, reason: signal.message },
        timestamp: new Date().toISOString()
      });
    };
    console.log('[AutonomousTrader] Подписываемся на signal...');
    volumeProfileEngine.on('signal', handler);
    console.log('[AutonomousTrader] Подписка выполнена');
    this.active.set(instrumentUid, { handler });
    console.log(`[AutonomousTrader] Запущен для ${instrumentUid}`);
  }

  /**
   * Остановить автоматическую торговлю для инструмента.
   */
  stop(instrumentUid: string): void {
    const entry = this.active.get(instrumentUid);
    if (!entry) return;
    marketDataBus.off('candle', entry.handler);
    this.active.delete(instrumentUid);
    // Сбрасываем активные стратегии, чтобы не оставались устаревшие
    this.strategyManager.reset();
    console.log(`[AutonomousTrader] Остановлен для ${instrumentUid}`);
  }

  /**
   * Остановить все активные трейдеры.
   */
  stopAll(): void {
    for (const uid of this.active.keys()) {
      this.stop(uid);
    }
  }

  /**
   * Получить список идентификаторов инструментов, для которых активна торговля.
   */
  getActiveInstruments(): string[] {
    return Array.from(this.active.keys());
  }
}