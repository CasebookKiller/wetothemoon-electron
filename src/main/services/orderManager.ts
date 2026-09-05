// src/main/services/orderManager.ts

import { sandboxGrpc } from './tbank/SandboxGrpcService';
import { OrderDirection, OrderType, OrderIdType } from '@/api/tbank/ordersTypes';
import type { BacktestSignal } from './backtest/common';
import { marketDataGrpc } from './tbank/MarketDataGrpcService';  // <-- новый импорт (в начале файла)
import type { OrderFlowEngine } from './orderFlowEngine';
import { HistoricalDataLoader } from './historicalDataLoader';
import { StopOrderType, StopOrderDirection, StopOrderExpirationType, ExchangeOrderType } from '@/api/tbank/stopordersTypes';
import { handleApiError } from './apiErrorHandler';
import { BrowserWindow } from 'electron';

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
  trailingMode?: 'percent' | 'volatility'; // режим трейлинга
  volatilityMultiplier?: number; // множитель для стопа по волатильности
  stopMode: 'stop_order' | 'limit_order';
  entryMode?: 'market' | 'limit';   // ← добавить
  riskAmount?: number;            // абсолютный риск (если процент не задан)
  dynamicSizingPercent?: number;  // процент от депозита (0 = не используется)
  maxPositionPercentPerInstrument?: number; // макс. доля на один инструмент (по умолчанию 10%)
  maxTotalPositionPercent?: number;         // макс. суммарная доля всех бумаг (по умолчанию 30%)
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
  private trailingQuantity: number = 1;
  private trailingStopPrice: number = 0;

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
      dynamicSizingPercent: 0,
      maxPositionPercentPerInstrument: 10,
      maxTotalPositionPercent: 30,
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
    console.log('[OrderManager] updateConfig trailingEnabled:', this.config.trailingEnabled, 'useDynamicSizing:', this.config.useDynamicSizing);
    this.dailyLossCurrent = 0;
    this.lastLossResetDate = new Date().toISOString().split('T')[0];
  }

  setRunning(state: boolean): void {
    this.isRunning = state;
    console.log(`[OrderManager] Автоторговля ${state ? 'запущена' : 'остановлена'}`);
  }

  async processSignal(signal: BacktestSignal): Promise<void> {
    console.log('[OrderManager] entryMode:', this.config.entryMode, 'targetPrice:', signal.targetPrice, 'stopMode:', this.config.stopMode);

    if (!this.isRunning) return;
    if (this.config.demoMode) {
      console.log(`[OrderManager][DEMO] ${signal.type} ${this.config.lotQuantity} лотов по цене ${signal.price}`);
      return;
    }
    if (!this.config.token || !this.config.accountId) return;

    // Получаем текущее состояние портфеля
    let balanceRes: any = null;
    try {
      balanceRes = await sandboxGrpc.getSandboxPortfolio(
        { accountId: this.config.accountId },
        this.config.token
      );
    } catch (e) {
      console.warn('[OrderManager] Не удалось получить портфель, продолжаем без данных о позициях');
    }

    // Запрещаем открывать новую позицию, если уже есть открытая по этому инструменту
    if (balanceRes) {
      const existingPos = (balanceRes.positions || []).find(
        (p: any) => p.instrumentUid === signal.instrumentUid && p.quantity && (Number(p.quantity.units) || 0) !== 0
      );
      if (existingPos) {
        console.log('[OrderManager] Уже есть открытая позиция по инструменту, пропускаем сигнал');
        return;
      }
    }

    const now = Date.now();
    //Временное отключение кулдауна
    //if (now - this.lastOrderTime < 5 * 60 * 1000) {
    if (now - this.lastOrderTime < 60 * 1000) { // 60 секунд для теста
      console.log('[OrderManager] Кулдаун, пропускаем сигнал');
      return;
    }

    // Нормализуем тип сигнала (если приходит POC_BREAKOUT_UP/DOWN)
    const rawType = (signal as any).type as string;
    if (rawType === 'POC_BREAKOUT_UP') {
      (signal as any).type = 'BUY';
    } else if (rawType === 'POC_BREAKOUT_DOWN') {
      (signal as any).type = 'SELL';
    }

    const direction = signal.type === 'BUY' ? OrderDirection.ORDER_DIRECTION_BUY : OrderDirection.ORDER_DIRECTION_SELL;

    // Проверяем, нет ли уже открытой позиции по этому инструменту
    try {
      //const positionsResp = await sandboxGrpc.getSandboxPositions(
      //  { accountId: this.config.accountId },
      //  this.config.token
      //);
      //const existingPos = (positionsResp.securities || []).find(
      //  (p: any) => p.instrumentUid === signal.instrumentUid && p.quantity && (Number(p.quantity.units) || 0) !== 0
      //);
      //if (existingPos) {
      //  console.log('[OrderManager] Уже есть открытая позиция по инструменту, пропускаем сигнал');
      //  return;
      //}
    } catch (e) {
      console.warn('[OrderManager] Не удалось проверить позиции, продолжаем');
      // Если API недоступен, лучше пропустить сделку? Решайте сами.
      // Пока можно продолжить, но в реальности стоит остановить.
    }

    // === ДИНАМИЧЕСКИЙ РАЗМЕР ПОЗИЦИИ ===
    let quantity = this.config.lotQuantity;
    let riskAmount = this.config.riskAmount;
    let freeBalance = 0;

    // 1. Получаем свободные средства
    if (this.config.useDynamicSizing && this.config.dynamicSizingPercent && this.config.dynamicSizingPercent > 0) {
      try {
        //const balanceRes = await sandboxGrpc.getSandboxPortfolio({ accountId: this.config.accountId }, this.config.token);
        //console.log('[OrderManager] Portfolio response:', JSON.stringify(balanceRes, null, 2));
        const totalCurrencies = (balanceRes as any).totalAmountCurrencies;
        if (totalCurrencies && totalCurrencies.currency === 'rub') {
          freeBalance = Number(totalCurrencies.units || 0) + (totalCurrencies.nano || 0) / 1e9;
        } else {
          // fallback на случай, если вдруг структура изменится
          const rubPos = ((balanceRes as any).positions || []).find((p: any) => p.instrumentType === 'currency' && p.ticker === 'RUB000UTSTOM');
          if (rubPos && rubPos.quantity) {
            freeBalance = Number(rubPos.quantity.units || 0) + (rubPos.quantity.nano || 0) / 1e9;
          }
        }
        riskAmount = freeBalance * (this.config.dynamicSizingPercent / 100);
        console.log(`[OrderManager] Свободный остаток: ${freeBalance}, риск ${this.config.dynamicSizingPercent}% = ${riskAmount.toFixed(2)}`);
      
        // Проверка: не открыта ли уже позиция по этому инструменту?
        //const existingPos = (balanceRes.positions || []).find(
        //  (p: any) => p.instrumentUid === signal.instrumentUid && p.quantity && (Number(p.quantity.units) || 0) !== 0
        //);
        //if (existingPos) {
        //  console.log('[OrderManager] Уже есть открытая позиция по инструменту, пропускаем сигнал');
        //  return;
        //}

      } catch (e) {
        console.warn('[OrderManager] Не удалось получить портфель, используется абсолютный риск');
      }
    }

    // 2. Определяем риск на 1 лот
    if (this.config.useDynamicSizing) {
      const entryPrice = signal.price || signal.targetPrice || 0;
      let riskPerLot = 0;

      if (this.config.stopLossPercent && this.config.stopLossPercent > 0) {
        // Стоп-лосс задан в процентах от цены
        riskPerLot = entryPrice * (this.config.stopLossPercent / 100);
      } else if (this.config.trailingMode === 'volatility' && this.historicalLoader) {
        // Используем волатильный стоп
        const atr = await this.calculateATR(signal.instrumentUid, this.config.token);
        if (atr) riskPerLot = atr * (this.config.volatilityMultiplier || 2);
      }

      if (riskPerLot > 0 && riskAmount > 0) {
        quantity = Math.floor(riskAmount / riskPerLot);
        console.log(`[OrderManager] riskPerLot=${riskPerLot.toFixed(2)}, quantity before limits=${quantity}`);
        // После определения quantity (строки, где quantity = Math.floor(riskAmount / riskPerLot) и т.д.)
        const entryPrice = signal.price || signal.targetPrice || 0;
        const portfolioTotal = Number(balanceRes?.totalAmountPortfolio?.units || 0) +
          (balanceRes?.totalAmountPortfolio?.nano || 0) / 1e9;
        const currenciesTotal = Number(balanceRes?.totalAmountCurrencies?.units || 0) +
          (balanceRes?.totalAmountCurrencies?.nano || 0) / 1e9;
        const securitiesValue = portfolioTotal - currenciesTotal;

        const newPositionCost = quantity * entryPrice;
        const currentInstrumentPosition = (balanceRes?.positions || []).find(
          (p: any) => p.instrumentUid === signal.instrumentUid
        );
        const currentInstrumentQty = currentInstrumentPosition?.quantity
          ? Math.abs(Number(currentInstrumentPosition.quantity.units) + (currentInstrumentPosition.quantity.nano || 0) / 1e9)
          : 0;
        const currentInstrumentValue = currentInstrumentQty * entryPrice;

        // Лимит на один инструмент
        const maxInstrumentValue = portfolioTotal * (this.config.maxPositionPercentPerInstrument / 100);
        if (currentInstrumentValue + newPositionCost > maxInstrumentValue) {
          const allowedValue = Math.max(0, maxInstrumentValue - currentInstrumentValue);
          const allowedQty = Math.floor(allowedValue / entryPrice);
          if (allowedQty < 1) {
            console.log('[OrderManager] Лимит по инструменту превышен, пропускаем сделку');
            return;
          }
          quantity = Math.min(quantity, allowedQty);
          console.log(`[OrderManager] Лимит по инструменту: quantity уменьшен до ${quantity}`);
        }

        // Лимит на суммарную стоимость бумаг
        const maxTotalSecuritiesValue = portfolioTotal * (this.config.maxTotalPositionPercent / 100);
        if (securitiesValue + newPositionCost > maxTotalSecuritiesValue) {
          const allowedTotalValue = Math.max(0, maxTotalSecuritiesValue - securitiesValue);
          const allowedTotalQty = Math.floor(allowedTotalValue / entryPrice);
          if (allowedTotalQty < 1) {
            console.log('[OrderManager] Общий лимит портфеля превышен, пропускаем сделку');
            return;
          }
          quantity = Math.min(quantity, allowedTotalQty);
          console.log(`[OrderManager] Общий лимит портфеля: quantity уменьшен до ${quantity}`);
        }

      } else {
        quantity = this.config.lotQuantity; // fallback
      }

      if (quantity < 1) {
        console.log('[OrderManager] Недостаточно средств для открытия позиции');
        return;
      }
      console.log(`[OrderManager] Final quantity=${quantity}`);
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
        await new Promise(resolve => setTimeout(resolve, 1000)); // пауза 1 сек перед защитными ордерами
      } else {
        // ---- Рыночный вход (текущее поведение) ----
        
        // Агрессивный лимитный вход для песочницы (цена +0.2% от lastPrice)
        const lastPrice = await this.getLastPrice(signal.instrumentUid);
        const limitPrice = lastPrice ? lastPrice * 1.002 : signal.price;
        const orderId = this.generateUUID();
        console.log(`[OrderManager] Агрессивный лимитный ордер на ${limitPrice.toFixed(2)}, orderId=${orderId}`);
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
        console.log(`[OrderManager] Агрессивный лимитный ордер отправлен: ${this.activeOrderId}`);
        
        /*
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
        */
      }

      // ========== ЗАЩИТНЫЕ ОРДЕРА И ТРЕЙЛИНГ ==========
      const entryPrice = this.lastEntryPrice;
      let stopOrderId: string | null = null;
      try {
        if (this.config.stopMode === 'stop_order') {
          stopOrderId = await this.placeStopOrders(signal, quantity);
        } else {
          const result = await this.placeProtectiveOrders(signal, entryPrice, quantity);
          stopOrderId = result.stopOrderId;
        }
      } catch (protectiveError) {
        console.error('[OrderManager] Ошибка установки защитных ордеров:', protectiveError);
      }

      console.log('[OrderManager] trail check:', { trailingEnabled: this.config.trailingEnabled, stopOrderId });
      
      if (this.config.trailingEnabled && stopOrderId) {
        this.trailingQuantity = quantity;      // <-- сохраняем для трейлинга
        this.startTrailing(signal.instrumentUid, entryPrice, stopOrderId, this.config.trailingPercent);
      }
    } catch (error) {
      const apiError = handleApiError(error);
      console.error('[OrderManager] Ошибка отправки ордера:', apiError.message);
      // позже можно будет отправлять apiError в UI через IPC
    }
  }

  private async placeStopOrders(signal: BacktestSignal, quantity: number): Promise<string | null> {
    const {
      stopLossPercent,
      takeProfitPercent,
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

      // Ограничиваем отклонение стоп‑цены (временно 2%)
      const MAX_SL_DEVIATION = 0.02;
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
            quantity,                                    // <-- было lotQuantity
            accountId,
            expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL as any,
            exchangeOrderType: ExchangeOrderType.EXCHANGE_ORDER_TYPE_MARKET as any,
            orderId: this.generateUUID(),
          },
          token
        );
        stopOrderId = resp.stopOrderId || null;
        console.log(`[OrderManager] Стоп‑лосс установлен на ${slPrice}, stopOrderId=${stopOrderId}`);
      } catch (error) {
        const apiError = handleApiError(error);
        console.error('[OrderManager] Ошибка установки стоп‑лосса: ', apiError.message);
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
            quantity,                                    // <-- было lotQuantity
            accountId,
            expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL as any,
            exchangeOrderType: ExchangeOrderType.EXCHANGE_ORDER_TYPE_MARKET as any,
            orderId: this.generateUUID(),
          },
          token
        );
        console.log(`[OrderManager] Тейк‑профит установлен на ${tpPrice}`);
      } catch (error) {
        const apiError = handleApiError(error);
        console.error('[OrderManager] Ошибка установки тейк‑профита:', apiError.message);
      }
    }

    return stopOrderId;
  }

  private async placeProtectiveOrders(signal: BacktestSignal, entryPrice: number, quantity: number): Promise<{ stopOrderId: string | null; takeProfitOrderId: string | null }> {
    const {
      stopLossPercent,
      takeProfitPercent,
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
        console.log(`[OrderManager] Выставляю стоп‑лосс (лимитный) на ${slPrice}`);

        // Ограничиваем отклонение стоп‑цены (временно 2%)
        const MAX_SL_DEVIATION = 0.02;
        slPrice = isBuy
          ? Math.max(slPrice, entryPrice * (1 - MAX_SL_DEVIATION))
          : Math.min(slPrice, entryPrice * (1 + MAX_SL_DEVIATION));

        try {
          const orderId = this.generateUUID();
          const resp: any = await sandboxGrpc.postSandboxOrder(
            {
              instrumentId: signal.instrumentUid,
              direction: isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY,
              orderType: OrderType.ORDER_TYPE_LIMIT,
              quantity,                                    // <-- было lotQuantity
              price: { units: Math.floor(slPrice), nano: Math.round((slPrice % 1) * 1e9) },
              accountId,
              orderId: orderId,
            } as any,
            token
          );
          stopOrderId = resp.orderId || null;
          console.log(`[OrderManager] Стоп‑лосс (лимитный) выставлен на ${slPrice}, orderId=${stopOrderId}`);
          await new Promise(resolve => setTimeout(resolve, 1500)); // 1500 мс
        } catch (error) {
          const apiError = handleApiError(error);
          console.error('[OrderManager] Ошибка выставления стоп‑лосса:', apiError.message);
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
              quantity,                                    // <-- было lotQuantity
              price: { units: Math.floor(tpPrice), nano: Math.round((tpPrice % 1) * 1e9) },
              accountId,
              orderId: orderId,
            } as any,
            token
          );
          takeProfitOrderId = resp.orderId || null;
          console.log(`[OrderManager] Тейк‑профит (лимитный) выставлен на ${tpPrice}, orderId=${takeProfitOrderId}`);
          break;
        } catch (error: any) {
          if (error?.code === 8 && attempts < maxAttempts - 1) {
            console.warn(`[OrderManager] Превышен лимит запросов, повтор через 1с (попытка ${attempts + 1})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          } else {
            const apiError = handleApiError(error);
            console.error('[OrderManager] Ошибка выставления тейк‑профита:', apiError.message);
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
    } catch (error) {
      const apiError = handleApiError(error);
      console.error('[OrderManager] Ошибка отмены ордера:', apiError.message);
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

    // Начальный уровень стоп-лосса
    if (this.config.stopLossPercent > 0) {
      this.trailingStopPrice = entryPrice * (1 - this.config.stopLossPercent / 100);
    } else {
      this.trailingStopPrice = entryPrice; // fallback
    }

    this.trailingInterval = setInterval(() => this.checkAndUpdateTrailing(), 2_000);
  }

  stopTrailing(): void {
    this.trailingActive = false;
    if (this.trailingInterval) {
      clearInterval(this.trailingInterval);
      this.trailingInterval = null;
    }
    this.trailingInstrumentUid = null;
    this.trailingEntryPrice = null;
    this.trailingStopOrderId = null;
    this.trailingStopPrice = 0;
  }

  private async checkAndUpdateTrailing(): Promise<void> {
    if (!this.trailingActive || !this.trailingStopOrderId || !this.trailingInstrumentUid || !this.trailingEntryPrice) return;

    try {
      const lastPrice = await this.getLastPrice(this.trailingInstrumentUid);
      if (!lastPrice) return;

      const isBuy = true; // пока только лонги
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

      if ((isBuy && newStopPrice > this.trailingStopPrice) || (!isBuy && newStopPrice < this.trailingStopPrice)) {
        // Отменяем предыдущий стоп-ордер
        try {
          await sandboxGrpc.cancelSandboxOrder(
            {
              accountId: this.config.accountId,
              orderId: this.trailingStopOrderId,
              orderIdType: OrderIdType.ORDER_ID_TYPE_EXCHANGE,
            },
            this.config.token
          );
          console.log(`[OrderManager] Трейлинг: предыдущий стоп-ордер ${this.trailingStopOrderId} отменён`);
        } catch (cancelError) {
          console.warn('[OrderManager] Не удалось отменить предыдущий стоп-ордер, продолжаем');
        }

        // Выставляем новый лимитный стоп-ордер
        const orderId = this.generateUUID();
        const resp: any = await sandboxGrpc.postSandboxOrder(
          {
            instrumentId: this.trailingInstrumentUid,
            direction: isBuy ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY,
            orderType: OrderType.ORDER_TYPE_LIMIT,
            quantity: this.trailingQuantity,
            price: { units: Math.floor(newStopPrice), nano: Math.round((newStopPrice % 1) * 1e9) },
            accountId: this.config.accountId,
            orderId: orderId,
          },
          this.config.token
        );

        this.trailingStopOrderId = resp.orderId || null;
        this.trailingStopPrice = newStopPrice;
        console.warn(`\x1b[42m\x1b[30m🚀 TRAILING UPDATE 🚀\x1b[0m \x1b[32m[OrderManager] Трейлинг‑стоп обновлён до ${newStopPrice} (новый ордер ${this.trailingStopOrderId})\x1b[0m \x07`);
      }
    } catch (error) {
      const apiError = handleApiError(error);
      console.error('[OrderManager] Ошибка трейлинга:', apiError.message);
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
    } catch (error) {
      const apiError = handleApiError(error);
      console.error('[OrderManager] Не удалось получить lastPrice:', apiError.message );
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
    //this.lastOrderTime = 0; // временное отключение кулдауна
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