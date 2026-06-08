import { sandboxGrpc } from './tbank/SandboxGrpcService';
import { OrderDirection, OrderType, OrderIdType } from '@/api/tbank/ordersTypes';
import type { BacktestSignal } from './backtest/common';
import { marketDataGrpc } from './tbank/MarketDataGrpcService';  // <-- новый импорт (в начале файла)
import type { OrderFlowEngine } from './orderFlowEngine';

export interface OrderManagerConfig {
  lotQuantity: number;
  useMarketOrder: boolean;
  demoMode: boolean;
  token: string;
  accountId: string;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingEnabled?: boolean;
  trailingPercent?: number;
  marketDataToken?: string;  // токен для рыночных данных (read-only)
  dailyLossLimit?: number;   // максимальный дневной убыток в рублях (0 = выключен)
  maxSignalsPerDay?: number;   // 0 = без ограничений
  minIntervalMinutes?: number; // минимальный интервал между сигналами (по умолчанию 15)
  
}

export class OrderManager {
  private config: Required<OrderManagerConfig>;
  private activeOrderId: string | null = null;
  private isRunning: boolean = false;
  private lastOrderTime: number = 0;
  private activeStopOrderId: string | null = null;
  private trailingActive = false;
  private trailingPercent = 0;
  private trailingInstrumentUid: string | null = null;
  private trailingEntryPrice: number | null = null;
  private trailingStopOrderId: string | null = null;
  private trailingInterval: NodeJS.Timeout | null = null;
  private dailyLossCurrent: number = 0;
  private lastLossResetDate: string = '';
  private lastEntryPrice: number = 0;
  private orderFlow?: OrderFlowEngine;

  constructor(config: Partial<OrderManagerConfig> = {}, orderFlow?: OrderFlowEngine) {
    this.config = {
      lotQuantity: 1,
      useMarketOrder: true,
      demoMode: true,
      token: '',
      accountId: '',
      stopLossPercent: 0,
      takeProfitPercent: 0,
      trailingEnabled: false,
      trailingPercent: 1,
      marketDataToken: '',
      dailyLossLimit: 0,
      maxSignalsPerDay: 0,
      minIntervalMinutes: 15,
      ...config,
    };
    this.orderFlow = orderFlow;   // сохраняем отдельно
  }

  updateConfig(patch: Partial<OrderManagerConfig>): void {
    this.config = { ...this.config, ...patch };
    this.dailyLossCurrent = 0;
    this.lastLossResetDate = new Date().toISOString().split('T')[0];
  }

  setRunning(state: boolean): void {
    this.isRunning = state;
    console.log(`[OrderManager] Автоторговля ${state ? 'запущена' : 'остановлена'}`);
  }

  async processSignal(signal: BacktestSignal): Promise<void> {
    if (!this.isRunning) return;
    if (this.config.demoMode) {
      console.log(`[OrderManager][DEMO] ${signal.type} ${this.config.lotQuantity} лотов по цене ${signal.price}`);
      return;
    }
    if (!this.config.token || !this.config.accountId) return;

    const now = Date.now();
    if (now - this.lastOrderTime < 5 * 60 * 1000) {
      console.log('[OrderManager] Кулдаун, пропускаем сигнал');
      return;
    }

    const direction = signal.type === 'BUY' ? OrderDirection.ORDER_DIRECTION_BUY : OrderDirection.ORDER_DIRECTION_SELL;
    const quantity = this.config.lotQuantity;
    const price = signal.price;

    // Оцениваем результат предыдущей сделки (если была позиция)
    if (this.lastEntryPrice > 0) {
      const prevProfit = signal.type === 'BUY'
        ? signal.price - this.lastEntryPrice   // если был BUY, то сейчас продаём
        : this.lastEntryPrice - signal.price;  // если был SELL, то сейчас покупаем
      this.updateDailyLoss(prevProfit);
    }
    this.lastEntryPrice = signal.price; // запоминаем новую цену входа

    try {
      // Отправляем основной ордер
      const order = await sandboxGrpc.postSandboxOrder(
        {
          instrumentId: signal.instrumentUid,
          direction,
          orderType: this.config.useMarketOrder ? OrderType.ORDER_TYPE_MARKET : OrderType.ORDER_TYPE_LIMIT,
          quantity,
          price: this.config.useMarketOrder ? undefined : { units: Math.floor(price), nano: Math.round((price % 1) * 1e9) },
          accountId: this.config.accountId,
        },
        this.config.token
      );
      this.activeOrderId = order.orderId ?? null;
      this.lastOrderTime = now;
      console.log(`[OrderManager] Ордер отправлен: ${this.activeOrderId}`);

      this.lastEntryPrice = signal.price;

      // Устанавливаем стоп-лосс и тейк-профит, если заданы проценты
      await this.placeStopOrders(signal);

      if (this.config.trailingEnabled && this.activeStopOrderId) {
        this.startTrailing(signal.instrumentUid, signal.price, this.activeStopOrderId, this.config.trailingPercent);
      }
    } catch (error) {
      console.error('[OrderManager] Ошибка отправки ордера:', error);
    }
  }

  private async placeStopOrders(signal: BacktestSignal): Promise<void> {
    const { stopLossPercent, takeProfitPercent, lotQuantity, token, accountId } = this.config;
    if (stopLossPercent <= 0 && takeProfitPercent <= 0) return;
    if (!accountId || !token || !signal.instrumentUid) return;

    const entryPrice = signal.price;
    const isBuy = signal.type === 'BUY';

    // Стоп-лосс
    if (stopLossPercent > 0) {
      const slPrice = isBuy
        ? entryPrice * (1 - stopLossPercent / 100)
        : entryPrice * (1 + stopLossPercent / 100);
      try {
        await sandboxGrpc.postSandboxStopOrder(
          {
            instrumentId: signal.instrumentUid,
            direction: (isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY) as any,
            stopOrderType: 1, // STOP_LOSS
            price: { units: Math.floor(slPrice), nano: Math.round((slPrice % 1) * 1e9) },
            quantity: lotQuantity,
            accountId,
          },
          token
        );
        console.log(`[OrderManager] Стоп-лосс установлен на ${slPrice}`);
      } catch (e) {
        console.error('[OrderManager] Ошибка установки стоп-лосса:', e);
      }
    }

    // Тейк-профит
    if (takeProfitPercent > 0) {
      const tpPrice = isBuy
        ? entryPrice * (1 + takeProfitPercent / 100)
        : entryPrice * (1 - takeProfitPercent / 100);
      try {
        await sandboxGrpc.postSandboxStopOrder(
          {
            instrumentId: signal.instrumentUid,
            direction: (isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY) as any,
            stopOrderType: 2, // TAKE_PROFIT
            price: { units: Math.floor(tpPrice), nano: Math.round((tpPrice % 1) * 1e9) },
            quantity: lotQuantity,
            accountId,
          },
          token
        );
        console.log(`[OrderManager] Тейк-профит установлен на ${tpPrice}`);
      } catch (e) {
        console.error('[OrderManager] Ошибка установки тейк-профита:', e);
      }
    }
  }

  async cancelActiveOrder(): Promise<void> {
    if (!this.activeOrderId || !this.config.token || !this.config.accountId) return;
    try {
      await sandboxGrpc.cancelSandboxOrder(
        { orderId: this.activeOrderId, accountId: this.config.accountId, orderIdType: OrderIdType.ORDER_ID_TYPE_EXCHANGE },
        this.config.token
      );
      console.log(`[OrderManager] Ордер ${this.activeOrderId} отменён`);
      this.activeOrderId = null;
    } catch (e) {
      console.error('[OrderManager] Ошибка отмены ордера:', e);
    }
  }

  startTrailing(instrumentUid: string, entryPrice: number, stopOrderId: string, trailPercent: number): void {
    this.trailingActive = true;
    this.trailingInstrumentUid = instrumentUid;
    this.trailingEntryPrice = entryPrice;
    this.trailingStopOrderId = stopOrderId;
    this.trailingPercent = trailPercent;
    this.trailingInterval = setInterval(() => this.checkAndUpdateTrailing(), 10_000);
  }

  stopTrailing(): void {
    this.trailingActive = false;
    if (this.trailingInterval) { clearInterval(this.trailingInterval); this.trailingInterval = null; }
    this.trailingInstrumentUid = null;
    this.trailingEntryPrice = null;
    this.trailingStopOrderId = null;
  }

  private async checkAndUpdateTrailing(): Promise<void> {
    if (!this.trailingActive || !this.trailingStopOrderId || !this.trailingInstrumentUid || !this.trailingEntryPrice) return;
    try {
      const lastPrice = await this.getLastPrice(this.trailingInstrumentUid);
      if (!lastPrice) return;

      const isBuy = true; // Для лонгов; для шортов условие обратное
      const newStopPrice = isBuy
        ? lastPrice * (1 - this.trailingPercent / 100)
        : lastPrice * (1 + this.trailingPercent / 100);

      if ((isBuy && newStopPrice > this.trailingEntryPrice) || (!isBuy && newStopPrice < this.trailingEntryPrice)) {
        await sandboxGrpc.replaceSandboxOrder(
          {
            accountId: this.config.accountId,
            orderId: this.trailingStopOrderId,
            price: { units: Math.floor(newStopPrice), nano: Math.round((newStopPrice % 1) * 1e9) },
            quantity: this.config.lotQuantity,
          },
          this.config.token
        );
        this.trailingEntryPrice = newStopPrice;
        console.log(`[OrderManager] Трейлинг‑стоп обновлён до ${newStopPrice}`);
      }
    } catch (e) {
      console.error('[OrderManager] Ошибка трейлинга:', e);
    }
  }

  private async getLastPrice(instrumentUid: string): Promise<number | null> {
    if (!this.config.marketDataToken) return null;
    try {
      const resp = await marketDataGrpc.getLastPrices(
        { instrumentId: [instrumentUid], lastPriceType: 1 },
        this.config.marketDataToken
      );
      const p = resp.lastPrices?.[0]?.price;
      return p ? Number(p.units) + Number(p.nano) / 1e9 : null;
    } catch (e) {
      console.error('[OrderManager] Не удалось получить lastPrice:', e);
      return null;
    }
  }

  private updateDailyLoss(profit: number): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastLossResetDate) {
      this.dailyLossCurrent = 0;
      this.lastLossResetDate = today;
    }
    if (profit < 0) {
      this.dailyLossCurrent += Math.abs(profit);
      console.log(`[OrderManager] Текущий дневной убыток: ${this.dailyLossCurrent.toFixed(2)} / лимит: ${this.config.dailyLossLimit}`);
      if (this.config.dailyLossLimit > 0 && this.dailyLossCurrent >= this.config.dailyLossLimit) {
        console.log('[OrderManager] Достигнут дневной лимит убытка, автоторговля остановлена');
        this.setRunning(false);
      }
    }
  }

  public getConfig(): Readonly<OrderManagerConfig> {
    return this.config;
  }
}