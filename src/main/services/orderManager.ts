// src/main/services/orderManager.ts

import { sandboxGrpc } from './tbank/SandboxGrpcService';
import { OrderDirection, OrderType, OrderIdType } from '@/api/tbank/ordersTypes';
import type { BacktestSignal } from './backtest/common';
import { marketDataGrpc } from './tbank/MarketDataGrpcService';  // <-- новый импорт (в начале файла)
import type { OrderFlowEngine } from './orderFlowEngine';
import { HistoricalDataLoader } from './historicalDataLoader';
import { StopOrderType, StopOrderDirection, StopOrderExpirationType, ExchangeOrderType } from '@/api/tbank/stopordersTypes';
import { handleApiError } from './apiErrorHandler';

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
  useDynamicSizing?: boolean;   // включить расчёт лотов по волатильности
  atrPeriod?: number;           // период ATR (по умолчанию 14)
  atrMultiplier?: number;       // множитель ATR для размера позиции (по умолчанию 2)
  riskAmount?: number;          // сумма риска на сделку в рублях (если 0 – не используется)
  trailingMode?: 'percent' | 'volatility'; // режим трейлинга
  volatilityMultiplier?: number; // множитель для стопа по волатильности
  stopMode: 'stop_order' | 'limit_order';
  entryMode?: 'market' | 'limit';   // ← добавить
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
  private historicalLoader?: HistoricalDataLoader;
  private activeTakeProfitOrderId: string | null = null;

  constructor(config: Partial<OrderManagerConfig> = {}, orderFlow?: OrderFlowEngine, historicalLoader?: HistoricalDataLoader) {
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
      useDynamicSizing: false,
      atrPeriod: 14,
      atrMultiplier: 2,
      riskAmount: 1000,        // 1000 руб риска на сделку
      trailingMode: 'percent',
      volatilityMultiplier: 2,
      stopMode: 'stop_order',
      entryMode: 'market',   // ← добавить
      ...config,
    };
    this.orderFlow = orderFlow;   // сохраняем отдельно
    this.historicalLoader = historicalLoader;
  }

  private generateUUID(): string {
    return crypto.randomUUID();
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

    // === ДИНАМИЧЕСКИЙ РАЗМЕР ПОЗИЦИИ ПО ATR ===
    let quantity = this.config.lotQuantity;
    if (this.config.useDynamicSizing && this.historicalLoader) {
      const atr = await this.calculateATR(signal.instrumentUid, this.config.token);
      if (atr && atr > 0 && this.config.riskAmount) {
        const riskPerLot = atr * this.config.atrMultiplier!;
        quantity = Math.floor(this.config.riskAmount / riskPerLot);
        if (quantity < 1) quantity = 1;
      }
    }

    // Оценка предыдущей сделки (существующая логика)
    if (this.lastEntryPrice > 0) {
      const prevProfit = signal.type === 'BUY'
        ? signal.price - this.lastEntryPrice
        : this.lastEntryPrice - signal.price;
      this.updateDailyLoss(prevProfit);
    }

    // ========== ОСНОВНОЙ ОРДЕР (рыночный или лимитный) ==========
    try {
      let entryOrderResult: any = null;

      if (this.config.entryMode === 'limit' && signal.targetPrice) {
        // ---- Лимитный вход ----
        const limitPrice = signal.targetPrice;
        const orderId = this.generateUUID();
        console.log(`[OrderManager] Выставляю лимитный ордер на ${limitPrice}, orderId=${orderId}`);
        entryOrderResult = await sandboxGrpc.postSandboxOrder(
          {
            instrumentId: signal.instrumentUid,
            direction: direction as any,
            orderType: OrderType.ORDER_TYPE_LIMIT,
            quantity,
            price: { units: Math.floor(limitPrice), nano: Math.round((limitPrice % 1) * 1e9) },
            accountId: this.config.accountId,
            orderId: orderId,
          },
          this.config.token
        );
        this.activeOrderId = entryOrderResult.orderId ?? null;
        this.lastOrderTime = now;
        this.lastEntryPrice = limitPrice;
        console.log(`[OrderManager] Лимитный ордер отправлен: ${this.activeOrderId}`);
      } else {
        // ---- Рыночный вход (текущее поведение) ----
        const orderId = this.generateUUID();
        console.log('[OrderManager] Выставляю рыночный ордер, orderId=', orderId);
        entryOrderResult = await sandboxGrpc.postSandboxOrder(
          {
            instrumentId: signal.instrumentUid,
            direction: direction as any,
            orderType: OrderType.ORDER_TYPE_MARKET,
            quantity,
            price: this.config.useMarketOrder ? undefined : { units: Math.floor(signal.price), nano: Math.round((signal.price % 1) * 1e9) },
            accountId: this.config.accountId,
            orderId: orderId,
          },
          this.config.token
        );
        this.activeOrderId = entryOrderResult.orderId ?? null;
        this.lastOrderTime = now;
        this.lastEntryPrice = signal.price;
        console.log(`[OrderManager] Рыночный ордер отправлен: ${this.activeOrderId}`);
      }

      // ========== ЗАЩИТНЫЕ ОРДЕРА И ТРЕЙЛИНГ ==========
      const entryPrice = this.lastEntryPrice;
      let stopOrderId: string | null = null;

      if (this.config.stopMode === 'stop_order') {
        stopOrderId = await this.placeStopOrders(signal);
      } else {
        const result = await this.placeProtectiveOrders(signal, entryPrice);
        stopOrderId = result.stopOrderId;
      }

      if (this.config.trailingEnabled && stopOrderId) {
        this.startTrailing(signal.instrumentUid, entryPrice, stopOrderId, this.config.trailingPercent);
      }
    } catch (error) {
      const apiError = handleApiError(error);
      console.error('[OrderManager] Ошибка отправки ордера:', apiError.message);
      // позже можно будет отправлять apiError в UI через IPC
    }
  }

  private async placeStopOrders(signal: BacktestSignal): Promise<string | null> {
    const {
      stopLossPercent,
      takeProfitPercent,
      lotQuantity,
      token,
      accountId,
    } = this.config;

    if (stopLossPercent <= 0 && takeProfitPercent <= 0) return null;
    if (!accountId || !token || !signal.instrumentUid) return null;

    const entryPrice = signal.price;
    const isBuy = signal.type === 'BUY';
    let stopOrderId: string | null = null;

    if (stopLossPercent > 0) {
      let slPrice = isBuy
        ? entryPrice * (1 - stopLossPercent / 100)
        : entryPrice * (1 + stopLossPercent / 100);

      // Ограничиваем отклонение стоп‑цены (временно 2% для ВТБ)
      const MAX_SL_DEVIATION = 0.02; // 2%
      slPrice = isBuy
        ? Math.max(slPrice, entryPrice * (1 - MAX_SL_DEVIATION))
        : Math.min(slPrice, entryPrice * (1 + MAX_SL_DEVIATION));

      try {
        const resp: any = await sandboxGrpc.postSandboxStopOrder(
          {
            instrumentId: signal.instrumentUid,
            direction: (isBuy ? StopOrderDirection.STOP_ORDER_DIRECTION_SELL : StopOrderDirection.STOP_ORDER_DIRECTION_BUY) as any,
            stopOrderType: StopOrderType.STOP_ORDER_TYPE_STOP_LOSS as any,
            price: { units: Math.floor(slPrice), nano: Math.round((slPrice % 1) * 1e9) },
            stopPrice: { units: Math.floor(slPrice), nano: Math.round((slPrice % 1) * 1e9) },
            quantity: lotQuantity,
            accountId,
            expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL as any,
            exchangeOrderType: ExchangeOrderType.EXCHANGE_ORDER_TYPE_MARKET as any,
            orderId: this.generateUUID(),
          },
          token
        );
        stopOrderId = resp.stopOrderId || null;
        console.log(`[OrderManager] Стоп‑лосс установлен на ${slPrice}, stopOrderId=${stopOrderId}`);
      } catch (e) {
        console.error('[OrderManager] Ошибка установки стоп‑лосса:', e);
      }
    }

    if (takeProfitPercent > 0) {
      const tpPrice = isBuy
        ? entryPrice * (1 + takeProfitPercent / 100)
        : entryPrice * (1 - takeProfitPercent / 100);
      try {
        await sandboxGrpc.postSandboxStopOrder(
          {
            instrumentId: signal.instrumentUid,
            direction: (isBuy ? StopOrderDirection.STOP_ORDER_DIRECTION_SELL : StopOrderDirection.STOP_ORDER_DIRECTION_BUY) as any,
            stopOrderType: StopOrderType.STOP_ORDER_TYPE_TAKE_PROFIT as any,
            price: { units: Math.floor(tpPrice), nano: Math.round((tpPrice % 1) * 1e9) },
            stopPrice: { units: Math.floor(tpPrice), nano: Math.round((tpPrice % 1) * 1e9) },
            quantity: lotQuantity,
            accountId,
            expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL as any,
            exchangeOrderType: ExchangeOrderType.EXCHANGE_ORDER_TYPE_MARKET as any,
            orderId: this.generateUUID(),
          },
          token
        );
        console.log(`[OrderManager] Тейк‑профит установлен на ${tpPrice}`);
      } catch (e) {
        console.error('[OrderManager] Ошибка установки тейк‑профита:', e);
      }
    }

    return stopOrderId;
  }

  private async placeProtectiveOrders(signal: BacktestSignal, entryPrice: number): Promise<{ stopOrderId: string | null; takeProfitOrderId: string | null }> {
    const {
      stopLossPercent,
      takeProfitPercent,
      lotQuantity,
      token,
      accountId,
      trailingMode,
      volatilityMultiplier
    } = this.config;

    if (entryPrice <= 0) {
      console.warn('[OrderManager] entryPrice = 0, защитные ордера не выставляются');
      return { stopOrderId: null, takeProfitOrderId: null };
    }

    if (stopLossPercent <= 0 && takeProfitPercent <= 0 && trailingMode !== 'volatility')
      return { stopOrderId: null, takeProfitOrderId: null };
    if (!accountId || !token || !signal.instrumentUid)
      return { stopOrderId: null, takeProfitOrderId: null };

    const isBuy = signal.type === 'BUY';
    let stopOrderId: string | null = null;
    let takeProfitOrderId: string | null = null;

    // --- Стоп‑лосс (лимитный ордер) ---
    if (stopLossPercent > 0 || trailingMode === 'volatility') {
      let slPrice: number | null = null;
      if (trailingMode === 'volatility' && volatilityMultiplier && this.historicalLoader) {
        const atr = await this.calculateATR(signal.instrumentUid, token);
        if (atr && atr > 0) {
          slPrice = isBuy ? entryPrice - atr * volatilityMultiplier : entryPrice + atr * volatilityMultiplier;
        }
      } else if (stopLossPercent > 0) {
        slPrice = isBuy
          ? entryPrice * (1 - stopLossPercent / 100)
          : entryPrice * (1 + stopLossPercent / 100);
      }

      if (slPrice) {
        // Ограничиваем отклонение стоп‑цены (временно 2% для ВТБ)
        const MAX_SL_DEVIATION = 0.02;
        slPrice = isBuy
          ? Math.max(slPrice, entryPrice * (1 - MAX_SL_DEVIATION))
          : Math.min(slPrice, entryPrice * (1 + MAX_SL_DEVIATION));

        try {
          //const orderId = `sl_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
          const orderId = this.generateUUID();
          const resp: any = await sandboxGrpc.postSandboxOrder(
            {
              instrumentId: signal.instrumentUid,
              direction: isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY,
              orderType: OrderType.ORDER_TYPE_LIMIT,
              quantity: lotQuantity,
              price: { units: Math.floor(slPrice), nano: Math.round((slPrice % 1) * 1e9) },
              accountId,
              orderId: orderId,
            } as any,
            token
          );
          stopOrderId = resp.orderId || null;
          console.log(`[OrderManager] Стоп‑лосс (лимитный) выставлен на ${slPrice}, orderId=${stopOrderId}`);
          await new Promise(resolve => setTimeout(resolve, 500)); // 500 мс
        } catch (e) {
          console.error('[OrderManager] Ошибка выставления стоп‑лосса:', e);
        }
      }
    }

    // --- Тейк‑профит (лимитный ордер) с retry ---
    if (takeProfitPercent > 0) {
      const tpPrice = isBuy
        ? entryPrice * (1 + takeProfitPercent / 100)
        : entryPrice * (1 - takeProfitPercent / 100);

      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          const orderId = this.generateUUID();
          const resp: any = await sandboxGrpc.postSandboxOrder(
            {
              instrumentId: signal.instrumentUid,
              direction: isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY,
              orderType: OrderType.ORDER_TYPE_LIMIT,
              quantity: lotQuantity,
              price: { units: Math.floor(tpPrice), nano: Math.round((tpPrice % 1) * 1e9) },
              accountId,
              orderId: orderId,
            } as any,
            token
          );
          takeProfitOrderId = resp.orderId || null;
          console.log(`[OrderManager] Тейк‑профит (лимитный) выставлен на ${tpPrice}, orderId=${takeProfitOrderId}`);
          break; // успех — выходим из цикла
        } catch (e: any) {
          if (e?.code === 8 && attempts < maxAttempts - 1) {
            // RESOURCE_EXHAUSTED — ждём и повторяем
            console.warn(`[OrderManager] Превышен лимит запросов, повтор через 1с (попытка ${attempts + 1})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          } else {
            console.error('[OrderManager] Ошибка выставления тейк‑профита:', e);
            break;
          }
        }
      }
    }

    return { stopOrderId, takeProfitOrderId };
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
    if (this.trailingActive) {
      console.log('[OrderManager] Трейлинг уже активен, перезапускаем с новым стоп‑ордером');
      this.stopTrailing();
    }
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

      const isBuy = true; // или определять по текущей позиции, пока для лонгов
      let newStopPrice: number;

      if (this.config.trailingMode === 'volatility' && this.config.volatilityMultiplier && this.historicalLoader) {
        const atr = await this.calculateATR(this.trailingInstrumentUid, this.config.token);
        if (!atr) return;
        newStopPrice = isBuy
          ? lastPrice - atr * this.config.volatilityMultiplier
          : lastPrice + atr * this.config.volatilityMultiplier;
      } else {
        newStopPrice = isBuy
          ? lastPrice * (1 - this.config.trailingPercent / 100)
          : lastPrice * (1 + this.config.trailingPercent / 100);
      }

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

  private async calculateATR(instrumentUid: string, token: string): Promise<number | null> {
    if (!this.historicalLoader) return null;
    try {
      const now = new Date();
      const from = new Date(now.getTime() - (this.config.atrPeriod! + 1) * 86400000);
      const candles = await this.historicalLoader.loadIntradayCandles(
        instrumentUid, from, now, token, 4 // CANDLE_INTERVAL_DAY
      );
      if (candles.length < this.config.atrPeriod!) return null;

      let trueRanges: number[] = [];
      for (let i = 1; i < candles.length; i++) {
        const prev = candles[i - 1];
        const curr = candles[i];
        const high = Number(curr.high?.units || 0) + Number(curr.high?.nano || 0) / 1e9;
        const low = Number(curr.low?.units || 0) + Number(curr.low?.nano || 0) / 1e9;
        const prevClose = Number(prev.close?.units || 0) + Number(prev.close?.nano || 0) / 1e9;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trueRanges.push(tr);
      }

      const atr = trueRanges.reduce((s, v) => s + v, 0) / trueRanges.length;
      return atr;
    } catch {
      return null;
    }
  }

  async sendManualOrder(params: {
    instrumentUid: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'market' | 'limit';
    price?: number;
  }): Promise<void> {
    this.isRunning = true; // ← гарантируем, что менеджер активен
    const signal: BacktestSignal = {
      instrumentUid: params.instrumentUid,
      type: params.type,
      price: params.price || 0,
      time: new Date().toISOString(),
      reason: 'Manual order',
      targetPrice: params.orderType === 'limit' ? params.price : undefined,
    };
    console.log('[OrderManager] sendManualOrder signal:', signal);
    try {
      await this.processSignal(signal);
    } catch (error) {
      const apiError = handleApiError(error);
      console.error('[OrderManager] Ошибка отправки ручного ордера:', apiError.message);
      // Можно выбросить ошибку дальше, чтобы UI показал toast
      throw error;
    }
  }
}