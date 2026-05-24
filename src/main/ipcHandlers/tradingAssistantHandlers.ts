// src/main/ipcHandlers/tradingAssistantHandlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { VolumeProfileEngine, volumeProfileEngine } from '../services/volumeProfileEngine';
import { CandleInterval } from '@/api/tbank/marketdataTypes';
import { BacktestEngine, BacktestSignal } from '../services/backtest/backtestEngine';
import { VolumeAccumulationStrategy } from '../services/backtest/strategies/VolumeAccumulationStrategy';
import { HistoricalDataLoader } from '../services/historicalDataLoader';
import { StreamCandle } from '@/api/tbank/marketdataStreamTypes';

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

  ipcMain.handle('trading-assistant:run-backtest', async (
    _,
    instrumentUid: string,
    dateFrom: string,
    dateTo: string,
    intervalStr: string,
    token: string,
    params: any
  ) => {
    const loader = new HistoricalDataLoader();
    const from = new Date(dateFrom + 'T00:00:00Z');
    const to = new Date(dateTo + 'T23:59:59Z');

    // Преобразование интервала
    const intervalMap: Record<string, CandleInterval> = {
      '1min': CandleInterval.CANDLE_INTERVAL_1_MIN,
      '5min': CandleInterval.CANDLE_INTERVAL_5_MIN,
      '15min': CandleInterval.CANDLE_INTERVAL_15_MIN,
      '1hour': CandleInterval.CANDLE_INTERVAL_HOUR,
    };
    const interval = intervalMap[intervalStr] || CandleInterval.CANDLE_INTERVAL_1_MIN;

    const allSignals: BacktestSignal[] = [];
    let totalStats = { totalTrades: 0, winningTrades: 0, totalProfit: 0 };
    const allCandles: any[] = [];
    let lastProfile = null;

    try {
      // Цикл по дням
      let currentDate = new Date(dateFrom + 'T00:00:00Z');
      const endDate = new Date(dateTo + 'T00:00:00Z');
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayFrom = new Date(dateStr + 'T07:00:00Z'); // Московская биржа
        const dayTo = new Date(dateStr + 'T16:00:00Z');

        const candles = await loader.loadIntradayCandles(
          instrumentUid,
          dayFrom,
          dayTo,
          token,
          interval
        );

        if (candles.length > 0) {
          // Расчёт профиля
          const engine = new VolumeProfileEngine({
            profileResolution: params.profileResolution || 50,
            valueAreaPercent: params.valueAreaPercent || 70,
          });
          candles.forEach(c => (engine as any).onCandle?.(c));
          const profile = engine.getProfile(instrumentUid);
          if (profile) lastProfile = profile;

          // Стратегия
          const strategy = new VolumeAccumulationStrategy(instrumentUid, profile);
          const btEngine = new BacktestEngine();
          const stats = btEngine.run(strategy, candles);
          const signals = strategy.getSignals();

          allSignals.push(...signals);
          allCandles.push(...candles);

          // Агрегация статистики (упрощённо)
          totalStats.totalTrades += stats.portfolio.totalTrades;
          totalStats.winningTrades += stats.portfolio.winningTrades;
          totalStats.totalProfit += stats.portfolio.totalProfit;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        profile: lastProfile,
        stats: {
          totalSignals: allSignals.length,
          buySignals: allSignals.filter(s => s.type === 'BUY').length,
          sellSignals: allSignals.length - allSignals.filter(s => s.type === 'BUY').length,
          portfolio: {
            ...totalStats,
            winRate: totalStats.totalTrades > 0 ? (totalStats.winningTrades / totalStats.totalTrades) * 100 : 0,
          },
        },
        signals: allSignals,
        candles: allCandles,
      };
    } catch (error) {
      console.error('Backtest error:', error);
      return null;
    }
  });

};