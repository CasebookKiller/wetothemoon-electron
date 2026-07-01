// src/main/services/autonomousTrader.ts

import { marketDataBus } from './marketDataBus';
import { OrderManager } from './orderManager';
import { StrategyManager } from './strategyManager';
import { CompositeProfileService } from './compositeProfile';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';

import { EventEmitter } from 'events';

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

    // Построить композитный профиль за последние 10 дней для контекста стратегий
    try {
      await this.compositeProfile.buildComposite(instrumentUid, 10, token);
    } catch (e) {
      console.warn(`[AutonomousTrader] Не удалось построить композитный профиль для ${instrumentUid}`, e);
      // продолжаем без композита, стратегии могут использовать только текущий профиль
    }

    // Обработчик свечи
    const handler = async (candle: StreamCandle) => {
      if (candle.instrumentUid !== instrumentUid && (candle as any).figi !== instrumentUid) return;
      try {
        // 1. Проверим свечу
        console.log(`[AutonomousTrader] Свеча для ${instrumentUid.slice(0,12)}: время=${candle.time}, цена закрытия=${candle.close}`);

        // 2. Обновим фазу и стратегии
        await this.strategyManager.update(instrumentUid);
        const activeStrats = this.strategyManager.getActiveStrategies(); // если такого метода нет, добавим
        console.log(`[AutonomousTrader] Фаза обновлена, активные стратегии: ${activeStrats?.join(', ') || 'нет'}`);

        // 3. Получим сигналы
        const signals = this.strategyManager.evaluateSignals(candle);
        console.log(`[AutonomousTrader] Получено сигналов: ${signals.length}`);
        for (const sig of signals) {
          console.log(`[AutonomousTrader] Сигнал: ${sig.type} по цене ${sig.price} (${sig.reason || ''})`);
this.emit('signal', { instrumentUid, signal: { type: sig.type, price: sig.price, reason: sig.reason }, timestamp: new Date().toISOString() });
          this.emit('signal', { instrumentUid, signal: sig, timestamp: new Date().toISOString() });
          try {
            await this.orderManager.processSignal(sig);
            this.emit('order-sent', { instrumentUid, signal: sig, status: 'sent' });
          } catch (e: any) {
            this.emit('order-error', { instrumentUid, signal: sig, error: e.message });
          }
        }
      } catch (e) {
        console.error(`[AutonomousTrader] Ошибка обработки ${instrumentUid}:`, e);
      }
    };

    // Подписываемся на свечи
    marketDataBus.on('candle', handler);
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