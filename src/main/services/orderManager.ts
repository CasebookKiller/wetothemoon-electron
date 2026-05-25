import { sandboxGrpc } from './tbank/SandboxGrpcService';
import { OrderDirection, OrderType, OrderIdType } from '@/api/tbank/ordersTypes';
import type { BacktestSignal } from './backtest/common';

export interface OrderManagerConfig {
  lotQuantity: number;
  useMarketOrder: boolean;
  demoMode: boolean;
  token: string;
  accountId: string;
}

export class OrderManager {
  private config: OrderManagerConfig;
  private activeOrderId: string | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<OrderManagerConfig> = {}) {
    this.config = {
      lotQuantity: 1,
      useMarketOrder: true,
      demoMode: true,
      token: '',
      accountId: '',
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
    if (!this.isRunning) {
      console.log('[OrderManager] Автоторговля выключена, сигнал проигнорирован');
      return;
    }

    // В демо-режиме сразу логируем и выходим, не требуя токен/accountId
    if (this.config.demoMode) {
      const direction = signal.type === 'BUY' ? 'BUY' : 'SELL';
      const quantity = this.config.lotQuantity;
      const price = signal.price;
      console.log(`[OrderManager][DEMO] ${direction} ${quantity} лотов по цене ${price}`);
      return;
    }

    if (!this.config.token || !this.config.accountId) {
      console.warn('[OrderManager] Не заданы токен или accountId');
      return;
    }

    if (this.activeOrderId) {
      console.log('[OrderManager] Активная заявка уже существует, пропускаем сигнал');
      return;
    }

    const direction = signal.type === 'BUY'
      ? OrderDirection.ORDER_DIRECTION_BUY
      : OrderDirection.ORDER_DIRECTION_SELL;
    const quantity = this.config.lotQuantity;
    const price = signal.price;

    try {
      if (this.config.demoMode) {
        console.log(`[OrderManager][DEMO] ${direction === OrderDirection.ORDER_DIRECTION_BUY ? 'BUY' : 'SELL'} ${quantity} лотов по цене ${price}`);
        return;
      }

      const orderType = this.config.useMarketOrder
        ? OrderType.ORDER_TYPE_MARKET
        : OrderType.ORDER_TYPE_LIMIT;

      const order = await sandboxGrpc.postSandboxOrder(
        {
          instrumentId: signal.instrumentUid,
          direction,
          orderType,
          quantity,
          price: this.config.useMarketOrder
            ? undefined
            : { units: Math.floor(price), nano: Math.round((price % 1) * 1e9) },
          accountId: this.config.accountId,
        },
        this.config.token
      );

      this.activeOrderId = order.orderId ?? null;
      console.log(`[OrderManager] Ордер отправлен: ${this.activeOrderId}`);
    } catch (error) {
      console.error('[OrderManager] Ошибка отправки ордера:', error);
    }
  }

  async cancelActiveOrder(): Promise<void> {
    if (!this.activeOrderId || !this.config.token || !this.config.accountId) return;
    try {
      await sandboxGrpc.cancelSandboxOrder(
        {
          orderId: this.activeOrderId,
          accountId: this.config.accountId,
          orderIdType: OrderIdType.ORDER_ID_TYPE_EXCHANGE,
        },
        this.config.token
      );
      console.log(`[OrderManager] Ордер ${this.activeOrderId} отменён`);
      this.activeOrderId = null;
    } catch (e) {
      console.error('[OrderManager] Ошибка отмены ордера:', e);
    }
  }
}