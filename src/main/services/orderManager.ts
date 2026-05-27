import { sandboxGrpc } from './tbank/SandboxGrpcService';
import { OrderDirection, OrderType, OrderIdType } from '@/api/tbank/ordersTypes';
import type { BacktestSignal } from './backtest/common';

export interface OrderManagerConfig {
  lotQuantity: number;
  useMarketOrder: boolean;
  demoMode: boolean;
  token: string;
  accountId: string;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export class OrderManager {
  private config: Required<OrderManagerConfig>;
  private activeOrderId: string | null = null;
  private isRunning: boolean = false;
  private lastOrderTime: number = 0;
  private activeStopOrderId: string | null = null;

  constructor(config: Partial<OrderManagerConfig> = {}) {
    this.config = {
      lotQuantity: 1,
      useMarketOrder: true,
      demoMode: true,
      token: '',
      accountId: '',
      stopLossPercent: 0,
      takeProfitPercent: 0,
      ...config,
    };
  }

  updateConfig(patch: Partial<OrderManagerConfig>): void {
    this.config = { ...this.config, ...patch };
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

      // Устанавливаем стоп-лосс и тейк-профит, если заданы проценты
      await this.placeStopOrders(signal);
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
}