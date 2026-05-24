// src/main/ipcHandlers/tradingAssistantHandlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { VolumeProfileEngine, volumeProfileEngine } from '../services/volumeProfileEngine';
import { CandleInterval } from '@/api/tbank/marketdataTypes';
import { BacktestEngine } from '../services/backtest/backtestEngine';
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

};