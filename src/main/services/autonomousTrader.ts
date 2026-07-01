// src/main/services/autonomousTrader.ts

import { marketDataBus } from './marketDataBus';
import { OrderManager } from './orderManager';
import { StrategyManager } from './strategyManager';
import { CompositeProfileService } from './compositeProfile';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';

/**
 * Автономный трейдер, который динамически выбирает стратегии
 * в зависимости от текущей фазы рынка и автоматически отправляет
 * сигналы в OrderManager.
 *
 * Не зависит от Electron и может быть использован в облачном процессе.
 */
export class AutonomousTrader {
  // active хранит обработчики свечей для каждого запущенного инструмента
  private active = new Map<string, { handler: (candle: StreamCandle) => void }>();

  constructor(
    private orderManager: OrderManager,
    private strategyManager: StrategyManager,
    private compositeProfile: CompositeProfileService
  ) {}

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
      // Проверяем, относится ли свеча к нашему инструменту (обычно по instrumentUid)
      if (candle.instrumentUid !== instrumentUid && (candle as any).figi !== instrumentUid) return;
      try {
        // 1. Определяем фазу рынка и обновляем список активных стратегий
        await this.strategyManager.update(instrumentUid);
        // 2. Получаем сигналы от всех активных стратегий
        const signals = this.strategyManager.evaluateSignals(candle);
        // 3. Отправляем сигналы в OrderManager (с учётом риск‑менеджмента)
        for (const signal of signals) {
          await this.orderManager.processSignal(signal);
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