// src/main/services/orderManager.ts

import { sandboxGrpc } from './tbank/SandboxGrpcService';
import { OrderDirection, OrderType, OrderIdType } from '@/api/tbank/ordersTypes';
import type { BacktestSignal } from './backtest/common';
import { marketDataGrpc } from './tbank/MarketDataGrpcService';  // <-- новый импорт (в начале файла)
import type { OrderFlowEngine } from './orderFlowEngine';
import { HistoricalDataLoader } from './historicalDataLoader';
import { StopOrderType, StopOrderDirection } from '@/api/tbank/stopordersTypes';

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
      ...config,
    };
    this.orderFlow = orderFlow;   // сохраняем отдельно
    this.historicalLoader = historicalLoader;
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

    //const direction = signal.type === 'BUY' ? OrderDirection.ORDER_DIRECTION_BUY : OrderDirection.ORDER_DIRECTION_SELL;
    const direction = signal.type === 'BUY' ? 'ORDER_DIRECTION_BUY' : 'ORDER_DIRECTION_SELL';

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
    this.lastEntryPrice = signal.price;

    console.log('[OrderManager] Отправляю ордер:', {
      instrumentId: signal.instrumentUid,
      direction,
      //orderType: this.config.useMarketOrder ? OrderType.ORDER_TYPE_MARKET : OrderType.ORDER_TYPE_LIMIT,
      orderType: this.config.useMarketOrder ? 'ORDER_TYPE_MARKET' : 'ORDER_TYPE_LIMIT',
      quantity,
      accountId: this.config.accountId,
    });
    const instrumentId = (signal as any).figi || signal.instrumentUid;
    try {
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      console.log('[OrderManager] Сгенерирован orderId:', orderId);

      const order = await sandboxGrpc.postSandboxOrder(
        {
          instrumentId: signal.instrumentUid,
          direction: direction as any,
          //orderType: this.config.useMarketOrder ? OrderType.ORDER_TYPE_MARKET : OrderType.ORDER_TYPE_LIMIT,
          orderType: (this.config.useMarketOrder ? 'ORDER_TYPE_MARKET' : 'ORDER_TYPE_LIMIT') as any,
          quantity,
          price: this.config.useMarketOrder ? undefined : { units: Math.floor(signal.price), nano: Math.round((signal.price % 1) * 1e9) },
          accountId: this.config.accountId,
          orderId: orderId,   // ← обязательно
        },
        this.config.token
      );
      this.activeOrderId = order.orderId ?? null;
      this.lastOrderTime = now;
      console.log(`[OrderManager] Ордер отправлен: ${this.activeOrderId}`);

      this.lastEntryPrice = signal.price;

      const stopOrderId = await this.placeStopOrders(signal);

      if (this.config.trailingEnabled && stopOrderId) {
        this.startTrailing(signal.instrumentUid, signal.price, stopOrderId, this.config.trailingPercent);
      }
    } catch (error) {
      console.error('[OrderManager] Ошибка отправки ордера:', error);
    }
  }

  private async placeStopOrders(signal: BacktestSignal): Promise<string | null> {
    const {
      stopLossPercent,
      takeProfitPercent,
      lotQuantity,
      token,
      accountId,
      trailingMode,
      volatilityMultiplier
    } = this.config;

    if (stopLossPercent <= 0 && takeProfitPercent <= 0 && trailingMode !== 'volatility') return null;
    if (!accountId || !token || !signal.instrumentUid) return null;

    const entryPrice = signal.price;
    const isBuy = signal.type === 'BUY';
    let slPrice: number | null = null;
    let stopOrderId: string | null = null;

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
      try {
        const resp: any = await sandboxGrpc.postSandboxStopOrder(
          {
            instrumentId: signal.instrumentUid,
            //direction: (isBuy ? StopOrderDirection.STOP_ORDER_DIRECTION_SELL : StopOrderDirection.STOP_ORDER_DIRECTION_BUY) as any,
            //stopOrderType: StopOrderType.STOP_ORDER_TYPE_STOP_LOSS as any,
            direction: (isBuy ? 'STOP_ORDER_DIRECTION_SELL' : 'STOP_ORDER_DIRECTION_BUY') as any,
            stopOrderType: 'STOP_ORDER_TYPE_STOP_LOSS' as any,
            price: { units: Math.floor(slPrice), nano: Math.round((slPrice % 1) * 1e9) },
            quantity: lotQuantity,
            accountId,
          },
          token
        );
        console.log('[OrderManager] Ответ на стоп-ордер:', JSON.stringify(resp));
        stopOrderId = resp.stopOrderId || resp.orderId || null;
        if (stopOrderId) {
          console.log(`[OrderManager] Стоп-лосс установлен на ${slPrice}, stopOrderId=${stopOrderId}`);
          this.activeStopOrderId = stopOrderId;
        } else {
          console.warn('[OrderManager] Не удалось получить ID стоп-ордера из ответа');
        }
      } catch (e) {
        console.error('[OrderManager] Ошибка установки стоп-лосса:', e);
      }
    }

    // Тейк-профит (без изменений)
    if (takeProfitPercent > 0) {
      const tpPrice = isBuy
        ? entryPrice * (1 + takeProfitPercent / 100)
        : entryPrice * (1 - takeProfitPercent / 100);
      try {
        await sandboxGrpc.postSandboxStopOrder(
          {
            instrumentId: signal.instrumentUid,
            //direction: (isBuy ? StopOrderDirection.STOP_ORDER_DIRECTION_SELL : StopOrderDirection.STOP_ORDER_DIRECTION_BUY) as any,
            //stopOrderType: StopOrderType.STOP_ORDER_TYPE_TAKE_PROFIT as any,
            direction: (isBuy ? 'STOP_ORDER_DIRECTION_SELL' : 'STOP_ORDER_DIRECTION_BUY') as any,
            stopOrderType: 'STOP_ORDER_TYPE_TAKE_PROFIT' as any,
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

    return stopOrderId;
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
}