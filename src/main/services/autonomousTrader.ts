// src/main/services/autonomousTrader.ts

import { OrderManager } from './orderManager';
import { StrategyManager } from './strategyManager';
import { CompositeProfileService } from './compositeProfile';
import { volumeProfileEngine } from './volumeProfileEngine';
import { EventEmitter } from 'events';

export class AutonomousTrader extends EventEmitter {
  private active = new Map<string, { handler: (signal: any) => void }>();

  constructor(
    private orderManager: OrderManager,
    private strategyManager: StrategyManager,
    private compositeProfile: CompositeProfileService
  ) {
    super();
  }

  async start(instrumentUid: string, token: string): Promise<void> {
    // Если уже запущен для этого инструмента, останавливаем старый обработчик
    if (this.active.has(instrumentUid)) {
      console.warn(`[AutonomousTrader] ${instrumentUid} уже запущен, перезапускаем`);
      this.stop(instrumentUid);
    }

    const handler = async (signal: any) => {
      if (signal.instrumentUid !== instrumentUid) return;

      console.log(`[AutonomousTrader] signal handler called ${signal.instrumentUid} ${signal.type}`);

      this.emit('signal', {
        instrumentUid,
        signal: { type: signal.type, price: signal.price, reason: signal.message },
        timestamp: new Date().toISOString()
      });

      if (this.orderManager) {
        await this.orderManager.processSignal(signal);
      }
    };

    console.log('[AutonomousTrader] Подписываемся на signal...');
    volumeProfileEngine.on('signal', handler);
    console.log('[AutonomousTrader] Подписка выполнена');

    this.orderManager.setRunning(true);

    this.active.set(instrumentUid, { handler });
    console.log(`[AutonomousTrader] Запущен для ${instrumentUid}`);
  }

  stop(instrumentUid: string): void {
    const entry = this.active.get(instrumentUid);
    if (!entry) return;

    volumeProfileEngine.off('signal', entry.handler);
    this.active.delete(instrumentUid);

    this.strategyManager.reset();
    console.log(`[AutonomousTrader] Остановлен для ${instrumentUid}`);
  }

  stopAll(): void {
    for (const uid of this.active.keys()) {
      this.stop(uid);
    }
  }

  getActiveInstruments(): string[] {
    return Array.from(this.active.keys());
  }
}