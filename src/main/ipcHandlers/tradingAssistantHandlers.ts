// src/main/ipcHandlers/tradingAssistantHandlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { VolumeProfileEngine, volumeProfileEngine } from '../services/volumeProfileEngine';
import { CandleInterval } from '@/api/tbank/marketdataTypes';
import { BacktestEngine } from '../services/backtest/backtestEngine';
import { VolumeAccumulationStrategy } from '../services/backtest/strategies/VolumeAccumulationStrategy';
import { HistoricalDataLoader } from '../services/historicalDataLoader';
import { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import { VirtualPortfolio } from '../services/backtest/virtualPortfolio';
import { BacktestSignal, quotationToNumber } from '../services/backtest/common';
import { OrderManager } from '../services/orderManager';
import { sandboxGrpc } from '../services/tbank/SandboxGrpcService';

let orderManagerInstance: OrderManager | null = null;

export const setOrderManagerInstance = (manager: OrderManager) => {
  orderManagerInstance = manager;
};

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
  /*
  ipcMain.handle('trading-assistant:run-backtest', async (_, instrumentUid: string, date: string, token: string) => {
    const loader = new HistoricalDataLoader();
    const from = new Date(date + 'T00:00:00Z');
    const to = new Date(date + 'T23:59:59Z');
    
    try {
      // 1. Загружаем минутные свечи за торговый день
      const candles = await loader.loadIntradayCandles(
        instrumentUid,
        new Date(date + 'T07:00:00Z'),
        new Date(date + 'T16:00:00Z'),
        token,
        CandleInterval.CANDLE_INTERVAL_1_MIN
      );

      if (!candles || candles.length === 0) {
        return { profile: null, stats: null, signals: [], candles: [] };
      }

      // 2. Создаём временный движок и прогоняем через него все минутные свечи
      const profileEngine = new VolumeProfileEngine({ profileResolution: 50 });
      candles.forEach((candle: StreamCandle) => {
        (profileEngine as any).onCandle?.(candle);
      });
      const profile = profileEngine.getProfile(instrumentUid);

      // 3. Стратегия и бэктест (используем уже готовые свечи)
      const strategy = new VolumeAccumulationStrategy(instrumentUid, profile);
      const engine = new BacktestEngine();
      const stats = engine.run(strategy, candles);
      const signals = strategy.getSignals();

      return { profile, stats, signals, candles };
    } catch (error) {
      console.error('Backtest error:', error);
      return null;
    }
  });
  */

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

    try {
      let currentDate = new Date(dateFrom + 'T00:00:00Z');
      const endDate = new Date(dateTo + 'T00:00:00Z');

      // Собираем свечи и сигналы за каждый день
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayFrom = new Date(dateStr + 'T07:00:00Z');
        const dayTo = new Date(dateStr + 'T16:00:00Z');

        const candles = await loader.loadIntradayCandles(
          instrumentUid, dayFrom, dayTo, token, interval
        );

        if (candles.length > 0) {
          // Профиль для стратегии (можно пересчитывать каждый день, но стратегия берёт dailyProfile)
          const engine = new VolumeProfileEngine({
            profileResolution: params.profileResolution || 50,
            valueAreaPercent: params.valueAreaPercent || 70,
          });
          candles.forEach(c => (engine as any).onCandle?.(c));
          const profile = engine.getProfile(instrumentUid);

          // Стратегия
          const strategy = new VolumeAccumulationStrategy(instrumentUid, profile);
          candles.forEach(c => strategy.onCandle(c));
          const signals = strategy.getSignals();

          allSignals.push(...signals);
          allCandles.push(...candles);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Единый портфель на все сигналы
      const portfolioConfig = { initialCapital: 100000 };
      const portfolio = new VirtualPortfolio(portfolioConfig);
      for (const signal of allSignals) {
        portfolio.processSignal(signal);
      }
      // Закрываем позицию в конце последнего дня по последней цене
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

      // Профиль за последний день
      let lastProfile = null;
      if (allCandles.length > 0) {
        const lastEngine = new VolumeProfileEngine({
          profileResolution: params.profileResolution || 50,
          valueAreaPercent: params.valueAreaPercent || 70,
        });
        // Пересчитываем профиль только для последнего дня (можно взять из цикла, но для простоты заново)
        const lastDayCandles = allCandles.filter(c => c.time?.startsWith(dateTo));
        if (lastDayCandles.length === 0) {
          // Если нет свечей за последний день, берём последние свечи
          const lastDay = allCandles.slice(-540); // примерно 9 часов торгов
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
      };
    } catch (error) {
      console.error('Backtest error:', error);
      return null;
    }
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
    if (!token) {
      console.error('[GetAccounts] Токен не передан');
      return [];
    }
    try {
      console.log('[GetAccounts] Запрос счетов с токеном:', token.slice(0, 10) + '...');
      const response = await sandboxGrpc.getSandboxAccounts({}, token);
      console.log('[GetAccounts] Ответ:', response);
      const accounts = response.accounts || [];
      return accounts.map(acc => ({
        id: acc.id,
        name: acc.name || acc.id,
      }));
    } catch (error: any) {
      console.error('[GetAccounts] Ошибка:', error.message || error);
      // Возвращаем сообщение об ошибке, чтобы UI мог показать
      throw new Error(error.message || 'Неизвестная ошибка');
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

};