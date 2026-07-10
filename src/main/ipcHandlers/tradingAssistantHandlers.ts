// src/main/ipcHandlers/tradingAssistantHandlers.ts
import { ipcMain, BrowserWindow, dialog } from 'electron';
import { VolumeProfileEngine, volumeProfileEngine } from '@/main/services/volumeProfileEngine';
import { CandleInterval } from '@/api/tbank/marketdataTypes';
import { BacktestEngine, IBacktestStrategy } from '@/main/services/backtest/backtestEngine';
import { VolumeAccumulationStrategy } from '@/main/services/backtest/strategies/VolumeAccumulationStrategy';
import { TrendStrategy } from '@/main/services/backtest/strategies/TrendStrategy';
import { POCPullbackStrategy } from '../services/backtest/strategies/POCPullbackStrategy';
import { HistoricalDataLoader } from '@/main/services/historicalDataLoader';
import { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import { VirtualPortfolio } from '@/main/services/backtest/virtualPortfolio';
import { BacktestSignal, quotationToNumber } from '@/main/services/backtest/common';
import { OrderManager } from '@/main/services/orderManager';
import { sandboxGrpc } from '@/main/services/tbank/SandboxGrpcService';
import { marketDataBus } from '@/main/services/marketDataBus';
import { getTradingAssistantWindow } from '@/main/windows/tradingAssistantWindow';
import { instrumentsGrpc } from '@/main/services/tbank/InstrumentsGrpcService';
import { BatchBacktestRunner } from '@/main/services/backtest/batchBacktestRunner';
import { DailyVAReversalStrategy } from '../services/backtest/strategies/DailyVAReversalStrategy';
import { FVGVolumeStrategy } from '../services/backtest/strategies/FVGVolumeStrategy';
import { OrderDirection, OrderType } from '@/api/tbank/ordersTypes';
import { OptionDirection } from '@/api/tbank/instrumentsTypes';
import { TrendStrategyPro } from '../services/backtest/strategies/TrendStrategyPro';
import { RejectionStrategy } from '../services/backtest/strategies/RejectionStrategy';

import * as fs from 'fs';
import { ScreenerService } from '../services/screenerService';
import { createStrategy } from '../services/backtest/strategies/strategyFactory';

import { OrderFlowEngine, orderFlowEngine } from '../services/orderFlowEngine';
import { StrategyManager } from '../services/strategyManager';
import { CompositeProfileService } from '../services/compositeProfile';
import { MarketPhase } from '../services/marketPhaseDetector';
import { AutonomousTrader } from '../services/autonomousTrader';

const instrumentFigiMap = new Map<string, string>();

let orderManagerInstance: OrderManager | null = null;

export const setOrderManagerInstance = (manager: OrderManager) => {
  orderManagerInstance = manager;
};

async function runBacktestInternal(
  instrumentUid: string,
  dateFrom: string,
  dateTo: string,
  intervalStr: string,
  token: string,
  params: any
): Promise<any> {
  const loader = new HistoricalDataLoader();
  const intervalMap: Record<string, CandleInterval> = {
    '1min': CandleInterval.CANDLE_INTERVAL_1_MIN,
    '5min': CandleInterval.CANDLE_INTERVAL_5_MIN,
    '15min': CandleInterval.CANDLE_INTERVAL_15_MIN,
    '1hour': CandleInterval.CANDLE_INTERVAL_HOUR,
  };
  const interval = intervalMap[intervalStr] || CandleInterval.CANDLE_INTERVAL_1_MIN;

  const allCandles: any[] = [];
  const allSignals: BacktestSignal[] = [];

  console.log(`[LOCAL] Portfolio config:`, {
    initialCapital: 100000,
    stopLossPercent: params.stopLossPercent,
    takeProfitPercent: params.takeProfitPercent,
    trailingDistancePercent: params.trailingDistancePercent,
    lotQuantity: params.lots,
    positionSizing: params.positionSizing,
    riskPercent: params.riskPercent,
  });

  const portfolio = new VirtualPortfolio({
    initialCapital: 100000,
    stopLossPercent: params.stopLossPercent || 0,
    takeProfitPercent: params.takeProfitPercent || 0,
    trailingDistancePercent: params.trailingDistancePercent || 0,
    lotQuantity: params.lots || 1,
    positionSizing: params.positionSizing || 'fixed',
    riskPercent: params.riskPercent || 1,
  });

  const strategyType = params.strategyType || 'volume_accumulation';

  try {
    let currentDate = new Date(dateFrom + 'T00:00:00Z');
    const endDate = new Date(dateTo + 'T00:00:00Z');

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayFrom = new Date(dateStr + 'T07:00:00Z');
      const dayTo = new Date(dateStr + 'T16:00:00Z');

      const candles = await loader.loadIntradayCandles(instrumentUid, dayFrom, dayTo, token, interval);

      if (candles.length > 0) {
        const engine = new VolumeProfileEngine({
          profileResolution: params.profileResolution || 50,
          valueAreaPercent: params.valueAreaPercent || 70,
        });
        candles.forEach(c => (engine as any).onCandle?.(c));
        const profile = engine.getProfile(instrumentUid);

        let strategy: IBacktestStrategy;
        try {
          strategy = createStrategy(strategyType, instrumentUid, profile, undefined, {
            volumeFilterEnabled: params.volumeFilterEnabled,
            volumeFilterPeriod: params.volumeFilterPeriod,
            ibMinutes: params.ibMinutes || 60,
            anchorTime: params.anchorTime,
          });
        } catch (e) {
          console.error('Failed to create strategy:', e);
          // fallback к самой первой стратегии, чтобы не падать
          strategy = new VolumeAccumulationStrategy(instrumentUid, profile, {
            volumeFilterEnabled: params.volumeFilterEnabled,
            volumeFilterPeriod: params.volumeFilterPeriod,
          });
        }

        for (const candle of candles) {
          strategy.onCandle(candle);
          const newSignals = strategy.getSignals();
          for (const signal of newSignals) {
            portfolio.processSignal(signal);
            allSignals.push(signal);
          }
          strategy.clearSignals();

          const high = quotationToNumber(candle.high);
          const low = quotationToNumber(candle.low);
          const close = quotationToNumber(candle.close);
          portfolio.checkStopTake(high, low, close, candle.time || '');
        }

        allCandles.push(...candles);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (allCandles.length > 0) {
      const lastCandle = allCandles[allCandles.length - 1];
      const lastPrice = quotationToNumber(lastCandle.close);
      portfolio.finalizeWithLastPrice(lastPrice, lastCandle.time || '');
    } else {
      portfolio.finalizeWithLastPrice(0, '');
    }

    const stats = portfolio.getStats();
    const backtestStats = {
      totalSignals: allSignals.length,
      buySignals: allSignals.filter(s => s.type === 'BUY').length,
      sellSignals: allSignals.filter(s => s.type === 'SELL').length,
      portfolio: stats,
    };
    const trades = portfolio.getTrades();

    return {
      stats: backtestStats,
      signals: allSignals,
      candles: allCandles,
      trades,
    };
  } catch (error) {
    console.error('Backtest error:', error);
    return null;
  }
}


let autonomousTraderInstance: AutonomousTrader | null = null;

export const setAutonomousTraderInstance = (instance: AutonomousTrader) => {
  autonomousTraderInstance = instance;
};

export const registerTradingAssistantHandlers = (
  historicalLoader: HistoricalDataLoader,
  profileEngine: VolumeProfileEngine,
  getToken: () => string,
  strategyManager: StrategyManager,
  compositeProfileService: CompositeProfileService,   // <-- добавить
  orderFlowEngine: OrderFlowEngine
) => {
  // Получить текущий профиль по инструменту (по запросу)
  ipcMain.handle('trading-assistant:get-profile', (_, instrumentUid: string) => {
    const profile = volumeProfileEngine.getProfile(instrumentUid);
    return profile ? { ...profile } : null; // сериализуем объект
  });

  // Подписка на обновления профиля и сигналы
  ipcMain.on('trading-assistant:subscribe', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    // Обработчик обновления профиля
    const onProfileUpdate = (profile: any) => {
      if (win && !win.isDestroyed()) {
        try { win.webContents.send('trading-assistant:profile-update', profile); } catch {}
      }
    };

    // Обработчик сигналов
    const onSignal = (signal: any) => {
      if (win && !win.isDestroyed()) {
        try { win.webContents.send('trading-assistant:signal', signal); } catch {}
      }
    };

    // Подписываемся
    volumeProfileEngine.on('profileUpdate', onProfileUpdate);
    volumeProfileEngine.on('signal', onSignal);

    // Когда окно закрывается, отписываемся (для предотвращения утечек)
    win.on('closed', () => {
      volumeProfileEngine.off('profileUpdate', onProfileUpdate);
      volumeProfileEngine.off('signal', onSignal);
    });
  });

  // Отписка (если понадобится вручную)
  ipcMain.on('trading-assistant:unsubscribe', (event) => {
    // Здесь можно реализовать ручную отписку, но автоматическая через closed обычно достаточна
  });

  // Запуск бэктеста
  ipcMain.handle('trading-assistant:run-backtest', async (_, instrumentUid: string, dateFrom: string, dateTo: string, intervalStr: string, token: string, params: any) => {
    const loader = new HistoricalDataLoader();
    const intervalMap: Record<string, CandleInterval> = {
      '1min': CandleInterval.CANDLE_INTERVAL_1_MIN,
      '5min': CandleInterval.CANDLE_INTERVAL_5_MIN,
      '15min': CandleInterval.CANDLE_INTERVAL_15_MIN,
      '1hour': CandleInterval.CANDLE_INTERVAL_HOUR,
    };
    const interval = intervalMap[intervalStr] || CandleInterval.CANDLE_INTERVAL_1_MIN;

    const allCandles: any[] = [];
    const allSignals: BacktestSignal[] = [];

    const portfolio = new VirtualPortfolio({
      initialCapital: 100000,
      stopLossPercent: params.stopLossPercent || 0,
      takeProfitPercent: params.takeProfitPercent || 0,
      trailingDistancePercent: params.trailingDistancePercent || 0,
      lotQuantity: params.lots || 1,
      positionSizing: params.positionSizing || 'fixed',
      riskPercent: params.riskPercent || 1,
    });

    // --- ВЫБОР СТРАТЕГИИ ---
    const strategyType = params.strategyType || 'volume_accumulation'; // по умолчанию первая

    try {
      let currentDate = new Date(dateFrom + 'T00:00:00Z');
      const endDate = new Date(dateTo + 'T00:00:00Z');

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayFrom = new Date(dateStr + 'T07:00:00Z');
        const dayTo = new Date(dateStr + 'T16:00:00Z');

        const candles = await loader.loadIntradayCandles(
          instrumentUid, dayFrom, dayTo, token, interval
        );

        if (candles.length > 0) {
          const engine = new VolumeProfileEngine({
            profileResolution: params.profileResolution || 50,
            valueAreaPercent: params.valueAreaPercent || 70,
          });
          candles.forEach(c => (engine as any).onCandle?.(c));
          const profile = engine.getProfile(instrumentUid);

          // Создаём стратегию в зависимости от выбора
          let strategy: IBacktestStrategy;
          try {
            strategy = createStrategy(strategyType, instrumentUid, profile, undefined, {
              volumeFilterEnabled: params.volumeFilterEnabled,
              volumeFilterPeriod: params.volumeFilterPeriod,
              ibMinutes: params.ibMinutes || 60,
              anchorTime: params.anchorTime,
            });
          } catch (e) {
            console.error('Failed to create strategy:', e);
            // fallback к самой первой стратегии, чтобы не падать
            strategy = new VolumeAccumulationStrategy(instrumentUid, profile, {
              volumeFilterEnabled: params.volumeFilterEnabled,
              volumeFilterPeriod: params.volumeFilterPeriod,
            });
          }

          // Последовательная обработка свечей
          for (const candle of candles) {
            strategy.onCandle(candle);
            const newSignals = strategy.getSignals();
            for (const signal of newSignals) {
              portfolio.processSignal(signal);
              allSignals.push(signal);
            }
            strategy.clearSignals();

            const high = quotationToNumber(candle.high);
            const low = quotationToNumber(candle.low);
            const close = quotationToNumber(candle.close);
            portfolio.checkStopTake(high, low, close, candle.time || '');
          }

          allCandles.push(...candles);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // ... остаток без изменений

      // Закрываем позицию в конце последнего дня
      if (allCandles.length > 0) {
        const lastCandle = allCandles[allCandles.length - 1];
        const lastPrice = quotationToNumber(lastCandle.close);
        portfolio.finalizeWithLastPrice(lastPrice, lastCandle.time || '');
      } else {
        portfolio.finalizeWithLastPrice(0, '');
      }

      const stats = portfolio.getStats();
      const backtestStats = {
        totalSignals: allSignals.length,
        buySignals: allSignals.filter(s => s.type === 'BUY').length,
        sellSignals: allSignals.filter(s => s.type === 'SELL').length,
        portfolio: stats,
      };
      const trades = portfolio.getTrades();

      // Профиль за последний день (как раньше)
      let lastProfile = null;
      if (allCandles.length > 0) {
        const lastEngine = new VolumeProfileEngine({
          profileResolution: params.profileResolution || 50,
          valueAreaPercent: params.valueAreaPercent || 70,
        });
        const lastDayCandles = allCandles.filter(c => c.time?.startsWith(dateTo));
        if (lastDayCandles.length === 0) {
          const lastDay = allCandles.slice(-540);
          lastDay.forEach(c => (lastEngine as any).onCandle?.(c));
        } else {
          lastDayCandles.forEach(c => (lastEngine as any).onCandle?.(c));
        }
        lastProfile = lastEngine.getProfile(instrumentUid);
      }

      return {
        profile: lastProfile,
        stats: backtestStats,
        signals: allSignals,
        candles: allCandles,
        trades,                // ← массив сделок
      };
    } catch (error) {
      console.error('Backtest error:', error);
      return null;
    }
  });

  ipcMain.handle('trading-assistant:batch-backtest', async (event, instrumentUids: string[], dateFrom: string, dateTo: string, intervalStr: string, token: string, paramSets: any[], strategyType: string, profileResolution: number, valueAreaPercent: number) => {
    const intervalMap: Record<string, CandleInterval> = {
      '1min': CandleInterval.CANDLE_INTERVAL_1_MIN,
      '5min': CandleInterval.CANDLE_INTERVAL_5_MIN,
      '15min': CandleInterval.CANDLE_INTERVAL_15_MIN,
      '1hour': CandleInterval.CANDLE_INTERVAL_HOUR,
    };
    const interval = intervalMap[intervalStr] || CandleInterval.CANDLE_INTERVAL_1_MIN;

    const runner = new BatchBacktestRunner();
    const total = instrumentUids.length * paramSets.length;
    let completed = 0;

    // Передаём колбэк, который отправляет прогресс через event.sender
    currentBatchRunner = runner;
    await runner.run(
      instrumentUids, dateFrom, dateTo, interval, token, paramSets,
      strategyType, profileResolution, valueAreaPercent,
      (item) => {
        completed++;
        event.sender.send('trading-assistant:batch-progress', {
          item,
          completed,
          total,
        });
      }
    );
    currentBatchRunner = null;

    event.sender.send('trading-assistant:batch-complete', { total: completed });

    return { completed }; // финальный ответ (опционально)
  });

  ipcMain.handle('trading-assistant:batch-v2', async (event, instrumentUids: string[], dateFrom: string, dateTo: string, intervalStr: string, token: string, paramSets: any[], strategyType: string, profileResolution: number, valueAreaPercent: number) => {
    const total = instrumentUids.length * paramSets.length;
    let completed = 0;

    // Локальный объект для поддержки остановки
    const runner = { cancelled: false, cancel: () => { runner.cancelled = true; } };
    (currentBatchRunner as any) = runner;

    for (const uid of instrumentUids) {
      if (runner.cancelled) break;

      for (const params of paramSets) {
        if (runner.cancelled) break;

        const result = await runBacktestInternal(uid, dateFrom, dateTo, intervalStr, token, {
          ...params,
          strategyType,
          profileResolution,
          valueAreaPercent,
        });

        completed++;
        if (result) {
          event.sender.send('trading-assistant:batch-progress', {
            item: {
              instrumentUid: uid,
              params,
              stats: result.stats.portfolio,   // <-- исправлено: передаём напрямую PortfolioStats
              signals: result.signals?.length || 0,
            },
            completed,
            total,
          });
        } else {
          event.sender.send('trading-assistant:batch-progress', {
            item: null,
            completed,
            total,
          });
        }
      }
    }

    currentBatchRunner = null;
    event.sender.send('trading-assistant:batch-complete', { total: completed });
    return { completed };
  });

  let currentBatchRunner: BatchBacktestRunner | null = null;

  // Внутри registerTradingAssistantHandlers():
  ipcMain.handle('trading-assistant:batch-stop', async () => {
    if (currentBatchRunner) {
      currentBatchRunner.cancel();
      return true;
    }
    return false;
  });

  ipcMain.handle('trading-assistant:send-backtest-signals', async (_, signals: BacktestSignal[]) => {
    if (!orderManagerInstance) return { success: false, error: 'OrderManager не инициализирован' };
    for (const signal of signals) {
      await orderManagerInstance.processSignal(signal);
    }
    return { success: true };
  });

  ipcMain.handle('trading-assistant:toggle-trading', async (_, enabled: boolean) => {
    if (orderManagerInstance) {
      orderManagerInstance.setRunning(enabled);
      return true;
    }
    return false;
  });

  ipcMain.handle('trading-assistant:get-trading-status', async () => {
    return orderManagerInstance ? (orderManagerInstance as any).isRunning : false;
  });

  ipcMain.handle('trading-assistant:set-lot-quantity', async (_, qty: number) => {
    if (orderManagerInstance) {
      (orderManagerInstance as any).config.lotQuantity = qty;
    }
  });

  ipcMain.handle('trading-assistant:get-accounts', async (_, token: string) => {
    if (!token) return [];

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`[GetAccounts] Попытка ${attempt + 1} из ${maxRetries}`);
        const response = await sandboxGrpc.getSandboxAccounts({}, token);
        const accounts = response.accounts || [];
        console.log(`[GetAccounts] Получено ${accounts.length} счетов`);
        return accounts.map(acc => ({
          id: acc.id,
          name: acc.name || acc.id,
        }));
      } catch (error: any) {
        attempt++;
        console.error(`[GetAccounts] Ошибка (попытка ${attempt}):`, error.message);
        if (attempt >= maxRetries) {
          throw new Error(error.message || 'Неизвестная ошибка');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });

  // Создание счёта песочницы
  ipcMain.handle('trading-assistant:create-account', async () => {
    const token = process.env.VITE_TSandBox || '';
    if (!token) return { success: false, error: 'Токен песочницы не задан' };
    try {
      const response = await sandboxGrpc.openSandboxAccount({}, token);
      return { success: true, accountId: response.accountId };
    } catch (error: any) {
      console.error('[CreateAccount] Ошибка:', error);
      return { success: false, error: error.message };
    }
  });

  // Закрытие счёта песочницы
  ipcMain.handle('trading-assistant:close-account', async (_, accountId: string) => {
    const token = process.env.VITE_TSandBox || '';
    if (!token || !accountId) return { success: false, error: 'Токен или accountId не задан' };
    try {
      await sandboxGrpc.closeSandboxAccount({ accountId }, token);
      return { success: true };
    } catch (error: any) {
      console.error('[CloseAccount] Ошибка:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('trading-assistant:pay-in', async (_, amount: number, accountId: string) => {
    const token = process.env.VITE_TSandBox || '';
    if (!token || !accountId || amount <= 0) {
      return { success: false, error: 'Токен, счёт или сумма не заданы' };
    }
    try {
      const response = await sandboxGrpc.sandboxPayIn({
        accountId,
        amount: {
          currency: 'RUB',
          units: Math.floor(amount),
          nano: Math.round((amount % 1) * 1e9),
        },
      }, token);
      return { success: true, balance: response.balance };
    } catch (error: any) {
      console.error('[PayIn] Ошибка:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('trading-assistant:get-balance', async (_, accountId: string) => {
    const token = process.env.VITE_TSandBox || '';
    if (!token || !accountId) return { success: false, error: 'Токен или счёт не заданы' };
    try {
      const response = await sandboxGrpc.getSandboxPortfolio({ accountId }, token);
      const total = response.totalAmountPortfolio;
      if (!total) return { success: false, error: 'Нет данных о балансе' };
      const balance = Number(total.units || '0') + (total.nano || 0) / 1e9;
      return { success: true, balance: balance.toFixed(2), currency: total.currency || 'RUB' };
    } catch (error: any) {
      console.error('[GetBalance] Ошибка:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('trading-assistant:update-config', async (_, config: any) => {
    if (orderManagerInstance) {
      orderManagerInstance.updateConfig(config);
      return true;
    }
    return false;
  });

  ipcMain.handle('trading-assistant:get-today-candles', async (_, instrumentUid: string, token: string, interval: string) => {
    const loader = new HistoricalDataLoader();
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0); // 07:00 МСК
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const intervalMap: Record<string, CandleInterval> = {
      '1min': CandleInterval.CANDLE_INTERVAL_1_MIN,
      '5min': CandleInterval.CANDLE_INTERVAL_5_MIN,
      '15min': CandleInterval.CANDLE_INTERVAL_15_MIN,
      '1hour': CandleInterval.CANDLE_INTERVAL_HOUR,
    };

    try {
      const candles = await loader.loadIntradayCandles(
        instrumentUid,
        from,
        to,
        token,
        intervalMap[interval] || CandleInterval.CANDLE_INTERVAL_1_MIN
      );
      return candles;
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  ipcMain.handle('trading-assistant:load-historical-profile', async (_, instrumentUid: string, candles: any[]) => {
    const engine = volumeProfileEngine; // singleton уже есть
    // Очищаем предыдущие накопления для этого инструмента (если нужно)
    // engine.reset(instrumentUid); // если метод существует
    candles.forEach(c => {
      const streamCandle = {
        instrumentUid,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume?.toString() || '0',
        time: c.time,
      };
      (engine as any).onCandle(streamCandle);
    });
    return true;
  });

  ipcMain.handle('trading-assistant:get-all-instruments', async (_, token: string) => {
    if (!token) return [];

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`[GetAllInstruments] Попытка ${attempt + 1} из ${maxRetries}`);
        const response = await instrumentsGrpc.shares(
          { instrumentStatus: 1 }, // базовый список (торгуемые)
          token
        );
        const instruments = (response.instruments || []).filter(
          (inst: any) =>
            inst.apiTradeAvailableFlag === true &&
            inst.currency?.toLowerCase() === 'rub'
        );
        instruments.forEach((inst: any) => {
          if (inst.uid && inst.figi) instrumentFigiMap.set(inst.uid, inst.figi);
        });
        console.log(`[GetAllInstruments] Найдено ${instruments.length} российских акций`);
        return instruments.map((inst: any) => ({
          uid: inst.uid || inst.figi,
          name: inst.name || inst.ticker,
          ticker: inst.ticker,
          figi: inst.figi,
        }));
      } catch (e: any) {
        attempt++;
        console.error(`[GetAllInstruments] Ошибка (попытка ${attempt}):`, e.message);
        if (attempt >= maxRetries) {
          // Все попытки исчерпаны – возвращаем пустой массив
          return [];
        }
        // Ждём перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return [];
  });

  // После регистрации всех обработчиков (внутри registerTradingAssistantHandlers):
  marketDataBus.on('candle', (candle: any) => {
    const win = getTradingAssistantWindow();
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('candle-data', candle); } catch {}
    }
  });

  marketDataBus.on('lastPrice', (data: any) => {
    const win = getTradingAssistantWindow();
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('last-price-data', data); } catch {}
    }
  });

  ipcMain.handle('trading-assistant:get-positions', async (_, accountId: string) => {
    const token = process.env.VITE_TSandBox || '';
    if (!token || !accountId) return { money: [], securities: [] };
    try {
      const response = await sandboxGrpc.getSandboxPositions({ accountId }, token);
      return {
        money: response.money || [],
        securities: response.securities || [],
      };
    } catch (e: any) {
      console.error('[GetPositions]', e);
      return { money: [], securities: [] };
    }
  });

  ipcMain.handle('trading-assistant:get-orders', async (_, accountId: string) => {
    const token = process.env.VITE_TSandBox || '';
    if (!token || !accountId) return [];
    try {
      const response = await sandboxGrpc.getSandboxOrders({ accountId }, token);
      return response.orders || [];
    } catch (e: any) {
      console.error('[GetOrders]', e);
      return [];
    }
  });

  ipcMain.handle('trading-assistant:close-position', async (_, instrumentUid: string, accountId: string, quantity: number, direction: string) => {
    const token = process.env.VITE_TSandBox || '';
    if (!token || !accountId || !instrumentUid || quantity <= 0) {
      return { success: false, error: 'Неверные параметры' };
    }

    try {
      // Определяем направление для закрытия: SELL для лонга, BUY для шорта
      const orderDirection = direction === 'long' ? OrderDirection.ORDER_DIRECTION_SELL : OrderDirection.ORDER_DIRECTION_BUY;

      console.log(`[ClosePosition] Закрываем ${quantity} ${instrumentUid} по рынку, направление: ${orderDirection}`);

      const order = await sandboxGrpc.postSandboxOrder({
        instrumentId: instrumentUid,
        direction: orderDirection,
        orderType: OrderType.ORDER_TYPE_MARKET,
        quantity,
        accountId,
      }, token);

      console.log(`[ClosePosition] Ордер отправлен: ${order.orderId}`);
      return { success: true, orderId: order.orderId };
    } catch (error: any) {
      console.error('[ClosePosition] Ошибка:', error);
      return { success: false, error: error.message || 'Неизвестная ошибка' };
    }
  });

  ipcMain.handle('trading-assistant:get-operations', async (_, accountId: string, from: string, to: string, cursor: string = '') => {
    const token = process.env.VITE_TSandBox || '';
    if (!token || !accountId) return { operations: [], hasMore: false, nextCursor: '' };

    try {
      const request: any = {
        accountId,
        limit: 50,
      };
      if (from) request.from = { seconds: Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000), nanos: 0 };
      if (to) request.to = { seconds: Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000), nanos: 0 };
      if (cursor) request.cursor = cursor;

      const response = await sandboxGrpc.getSandboxOperationsByCursor(request, token);

      return {
        operations: response.items || [],
        hasMore: response.hasNext || false,
        nextCursor: response.nextCursor || '',
      };
    } catch (e: any) {
      console.error('[GetOperations]', e);
      return { operations: [], hasMore: false, nextCursor: '' };
    }
  });

  ipcMain.handle('trading-assistant:save-json', async (_, data: any, defaultName: string) => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (!filePath) return { success: false, error: 'Отменено пользователем' };
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, filePath };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // -- Скринер инструментов --
  ipcMain.handle('trading-assistant:screener-run', async (_event, filters: any, token: string) => {
    if (!token) {
      console.warn('screener:run token is empty');
      return [];
    }
    const loader = new HistoricalDataLoader();
    const screener = new ScreenerService(loader, () => token); // ← убрали третий аргумент
    return await screener.screen(filters);
  });

  ipcMain.handle('cloud:createTask', async (_event, serverUrl: string, instrumentUid: string, dateFrom: string, dateTo: string, interval: string, strategy: string, params: any) => {
    try {
      const token = await getCloudToken(serverUrl);
      const res = await fetch(`${serverUrl}/api/backtest/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          instrumentUid,
          dateFrom,
          dateTo,
          interval,
          strategy,           // ← теперь передаём отдельно
          params,
        }),
      });
      return await res.json();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('cloud:getTaskStatus', async (_event, taskId: string) => {
    const url = process.env.VITE_CLOUD_API_URL;
    if (!url) return { error: 'CLOUD_API_URL not set' };
    const token = await getCloudToken(url); // вспомогательная функция для получения JWT (можно кешировать)
    const res = await fetch(`${url}/api/backtest/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });

  ipcMain.handle('cloud:getTaskResult', async (_event, taskId: string) => {
    const url = process.env.VITE_CLOUD_API_URL;
    if (!url) return { error: 'CLOUD_API_URL not set' };
    const token = await getCloudToken(url);
    const res = await fetch(`${url}/api/backtest/results/${taskId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });

  ipcMain.handle('cloud:getTasks', async () => {
    const url = process.env.VITE_CLOUD_API_URL;
    if (!url) return [];
    const token = await getCloudToken(url);
    const res = await fetch(`${url}/api/backtest/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });

  ipcMain.handle('cloud:testConnection', async (_event, serverUrl: string) => {
    try {
      const res = await fetch(`${serverUrl}/`);
      return { ok: res.ok, status: res.status };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Простейший кеш токена (на 20 часов)
  let cachedToken: string | null = null;
  let tokenExpiry = 0;

async function getCloudToken(serverUrl: string): Promise<string | null> {
  // простейший кеш на 20 часов
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const loginRes = await fetch(`${serverUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.CLOUD_EMAIL || 'll@me.com',
        password: process.env.CLOUD_PASSWORD || '7777',
      }),
    });
    const data = await loginRes.json();
    if (!data.token) throw new Error('Login failed: ' + JSON.stringify(data));
    cachedToken = data.token;
    tokenExpiry = Date.now() + 20 * 3600 * 1000; // 20 часов
    return cachedToken;
  }

  ipcMain.handle('trading-assistant:get-market-phase', async (_, instrumentUid: string) => {
    return await strategyManager.getCurrentPhase(instrumentUid);
  });

  // IPC: обновить маппинг фаз
  ipcMain.handle('trading-assistant:update-phase-mapping', (_, phase: MarketPhase, strategyNames: string[]) => {
    strategyManager.updatePhaseMapping(phase, strategyNames);
    return true;
  });

  ipcMain.handle('trading-assistant:get-orderflow-delta', (_, instrumentUid: string) => {
    return orderFlowEngine.getDelta(instrumentUid);
  });

  ipcMain.handle('trading-assistant:composite-profile', async (_, instrumentUid: string, days: number, token: string) => {
    return await compositeProfileService.buildComposite(instrumentUid, days, token);
  });

  /*
  ipcMain.handle('cloud:createBatch', async (_, batchConfig: any) => {
    const url = process.env.VITE_CLOUD_API_URL;
    const token = await getCloudToken();
    const res = await fetch(`${url}/api/backtest/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(batchConfig),
    });
    return await res.json();
  });
  */

  /*
  ipcMain.handle('cloud:getBatchStatus', async (_, batchId: string) => {
    const url = process.env.VITE_CLOUD_API_URL;
    const token = await getCloudToken();
    const res = await fetch(`${url}/api/backtest/batch/${batchId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });
  */

  /*
  ipcMain.handle('cloud:getBatchResults', async (_, batchId: string) => {
    const url = process.env.VITE_CLOUD_API_URL;
    const token = await getCloudToken();
    const res = await fetch(`${url}/api/backtest/batch/${batchId}/results`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });
  */

  // 1. Создание batch-прогона
  ipcMain.handle('cloud:createBatch', async (_event, batchConfig: {
    serverUrl: string;
    instruments: string[];
    dateFrom: string;
    dateTo: string;
    interval: string;
    strategy: string;
    params: any;
    // поля сетки
    slMin?: number; slMax?: number; slStep?: number;
    tpMin?: number; tpMax?: number; tpStep?: number;
    trailMin?: number; trailMax?: number; trailStep?: number;
    lotsMin?: number; lotsMax?: number; lotsStep?: number;
    riskMin?: number; riskMax?: number; riskStep?: number;
  }) => {
    const { serverUrl, ...batch } = batchConfig;
    console.log('\x1b[1;33m[IPC] Sending batch to:\x1b[0m', `${serverUrl}/api/backtest/batch`, 'with body:', JSON.stringify(batch));
    try {
      const token = await getCloudToken(serverUrl);
      console.log('\x1b[1;33m[IPC] cloud:createBatch called with serverUrl:\x1b[0m', batchConfig.serverUrl);
      console.log('\x1b[1;33m[IPC] batch body:\x1b[0m', JSON.stringify(batch));
      const res = await fetch(`${serverUrl}/api/backtest/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(batch), // batch уже содержит все нужные поля
      });
      const resjson = await res.json();
      console.log('\x1b[1;33m[IPC] batch response:\x1b[0m', JSON.stringify(resjson));
      return resjson;
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 2. Получение статуса batch'а
  ipcMain.handle('cloud:getBatchStatus', async (_event, serverUrl: string, batchId: string) => {
    try {
      const token = await getCloudToken(serverUrl);
      const res = await fetch(`${serverUrl}/api/backtest/batch/${batchId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 3. Получение результатов batch'а
  ipcMain.handle('cloud:getBatchResults', async (_event, serverUrl: string, batchId: string) => {
    try {
      const token = await getCloudToken(serverUrl);
      const res = await fetch(`${serverUrl}/api/backtest/batch/${batchId}/results`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 4. Получение списка инструментов с сервера (опционально, если есть скринер)
  ipcMain.handle('cloud:getInstruments', async (_event, serverUrl: string) => {
    try {
      const token = await getCloudToken(serverUrl);
      const res = await fetch(`${serverUrl}/api/screener`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return await res.json();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('cloud:getBatches', async (_event, serverUrl: string) => {
    const token = await getCloudToken(serverUrl);
    const res = await fetch(`${serverUrl}/api/backtest/batches`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });

  ipcMain.handle('cloud:deleteBatch', async (_event, serverUrl: string, batchId: string) => {
    const token = await getCloudToken(serverUrl);
    const res = await fetch(`${serverUrl}/api/backtest/batch/${batchId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });

  ipcMain.handle('cloud:getSchedulerTasks', async (_event, serverUrl: string) => {
    const token = await getCloudToken(serverUrl);
    const res = await fetch(`${serverUrl}/api/scheduler`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });

  ipcMain.handle('cloud:addSchedulerTask', async (_event, serverUrl: string, task: any) => {
    const token = await getCloudToken(serverUrl);
    const res = await fetch(`${serverUrl}/api/scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(task),
    });
    return await res.json();
  });

  ipcMain.handle('cloud:deleteSchedulerTask', async (_event, serverUrl: string, id: string) => {
    const token = await getCloudToken(serverUrl);
    const res = await fetch(`${serverUrl}/api/scheduler/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  });

  ipcMain.handle('trading-assistant:start-auto-trader', async (event: Electron.IpcMainInvokeEvent, instrumentUid: string) => {
    if (!autonomousTraderInstance) return { success: false, error: 'AutoTrader not initialized' };
    const token = process.env.VITE_TReadOnly || '';
    await autonomousTraderInstance.start(instrumentUid, token, instrumentFigiMap);
    //await autonomousTraderInstance.start(instrumentUid, token);

    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: true }; // окно не найдено, но трейдер запущен

    // Подписываемся на события автотрейдера
    const onSignal = (data: any) => {
      console.log('[IPC] Получен signal от автотрейдера');
      if (!win.isDestroyed()) {
        win.webContents.send('auto-trader:signal', data);
        console.log('[IPC] signal отправлен в рендерер');
      } else {
        console.log('[IPC] Окно уничтожено, signal не отправлен');
      }
    };
    const onOrderSent = (data: any) => {
      if (!win.isDestroyed()) win.webContents.send('auto-trader:order-sent', data);
    };
    const onOrderError = (data: any) => {
      if (!win.isDestroyed()) win.webContents.send('auto-trader:order-error', data);
    };

    autonomousTraderInstance.on('signal', onSignal);
    autonomousTraderInstance.on('order-sent', onOrderSent);
    autonomousTraderInstance.on('order-error', onOrderError);

    // Сохраним обработчики, чтобы отписаться при остановке (можно в Map)
    // Пока для простоты оставим так, но добавим очистку при остановке.
    return { success: true };
  });

  ipcMain.handle('trading-assistant:stop-auto-trader', async (_, instrumentUid: string) => {
    if (!autonomousTraderInstance) return { success: false, error: 'AutoTrader not initialized' };
    autonomousTraderInstance.stop(instrumentUid);
    return { success: true };
  });

  ipcMain.handle('trading-assistant:get-active-auto-traders', async () => {
    return autonomousTraderInstance ? autonomousTraderInstance.getActiveInstruments() : [];
  });

  ipcMain.handle('trading-assistant:get-orderflow-snapshot', (_, instrumentUid: string) => {
    const delta = orderFlowEngine.getDelta(instrumentUid);
    const absorption = orderFlowEngine.detectAbsorption(instrumentUid);
    const exhaustion = orderFlowEngine.detectExhaustion(instrumentUid);
    return { delta, absorption, exhaustion };
  });
};