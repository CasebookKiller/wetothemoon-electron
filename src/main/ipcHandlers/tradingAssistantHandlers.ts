// src/main/ipcHandlers/tradingAssistantHandlers.ts
import { ipcMain, BrowserWindow } from 'electron';
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
        if (strategyType === 'trend') {
          strategy = new TrendStrategy(instrumentUid, profile);
        } else if (strategyType === 'poc_pullback') {
          strategy = new POCPullbackStrategy(instrumentUid, profile);
        } else if (strategyType === 'daily_va_return') {
          strategy = new DailyVAReversalStrategy(instrumentUid, profile);
        } else if (strategyType === 'fvg_volume') {
          strategy = new FVGVolumeStrategy(instrumentUid, profile);
        } else {
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

export const registerTradingAssistantHandlers = () => {
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
      if (!win.isDestroyed()) {
        win.webContents.send('trading-assistant:profile-update', profile);
      }
    };

    // Обработчик сигналов
    const onSignal = (signal: any) => {
      if (!win.isDestroyed()) {
        win.webContents.send('trading-assistant:signal', signal);
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
          if (strategyType === 'trend') {
            strategy = new TrendStrategy(instrumentUid, profile);
          } else if (strategyType === 'poc_pullback') {
            strategy = new POCPullbackStrategy(instrumentUid, profile);
          } else {
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
      win.webContents.send('candle-data', candle);
    }
  });

  marketDataBus.on('lastPrice', (data: any) => {
    const win = getTradingAssistantWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('last-price-data', data);
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
      const response = await sandboxGrpc.getSandboxOperationsByCursor({
        accountId,
        from: from ? new Date(from + 'T00:00:00Z').toISOString() : undefined,
        to: to ? new Date(to + 'T23:59:59Z').toISOString() : undefined,
        cursor: cursor || undefined,
        limit: 50,
      }, token);

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
};