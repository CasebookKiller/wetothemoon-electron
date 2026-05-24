// src/main/services/tradingConnector.ts
import { marketDataBus } from './marketDataBus';
import { volumeProfileEngine } from './volumeProfileEngine';
import { OrderManager } from './orderManager';

export function connectOrderManager(manager: OrderManager): void {
  // Подписываемся на сигналы от VolumeProfileEngine
  volumeProfileEngine.on('signal', (signal: any) => {
    console.log('[TradingConnector] Получен сигнал:', signal);
    manager.processSignal(signal);
  });
}