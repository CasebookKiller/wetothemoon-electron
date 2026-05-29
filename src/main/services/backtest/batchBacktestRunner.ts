// src/main/services/batchBacktestRunner.ts
import { HistoricalDataLoader } from '@/main/services/historicalDataLoader';
import { VolumeProfileEngine } from '@/main/services/volumeProfileEngine';
import { VolumeAccumulationStrategy } from '@/main/services/backtest/strategies/VolumeAccumulationStrategy';
import { TrendStrategy } from '@/main/services/backtest/strategies/TrendStrategy';
import { VirtualPortfolio } from '@/main/services/backtest/virtualPortfolio';
import { BacktestSignal, quotationToNumber } from '@/main/services/backtest/common';
import { CandleInterval } from '@/api/tbank/marketdataTypes';

export interface BatchParams {
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingDistancePercent: number;
  lots: number;
  positionSizing: 'fixed' | 'dynamic';
  riskPercent: number;
  volumeFilterEnabled: boolean;
  volumeFilterPeriod: number;
}

export interface BatchResultItem {
  instrumentUid: string;
  params: BatchParams;
  stats: any;
  signals: number;
}

export class BatchBacktestRunner {
  async run(
    instrumentUids: string[],
    dateFrom: string,
    dateTo: string,
    interval: CandleInterval,
    token: string,
    paramSets: BatchParams[],
    strategyType: string,
    profileResolution: number,
    valueAreaPercent: number,
    onProgress: (item: BatchResultItem) => void
  ): Promise<void> {
    const loader = new HistoricalDataLoader();

    for (const uid of instrumentUids) {
      for (const params of paramSets) {
        const portfolio = new VirtualPortfolio({
          initialCapital: 100000,
          stopLossPercent: params.stopLossPercent,
          takeProfitPercent: params.takeProfitPercent,
          trailingDistancePercent: params.trailingDistancePercent,
          lotQuantity: params.lots,
          positionSizing: params.positionSizing,
          riskPercent: params.riskPercent,
        });

        const strategyOptions = {
          volumeFilterEnabled: params.volumeFilterEnabled,
          volumeFilterPeriod: params.volumeFilterPeriod,
        };

        // Создаём стратегию ОДИН раз на весь период (без профиля, обновим позже)
        const strategy = strategyType === 'trend'
          ? new TrendStrategy(uid, null as any, strategyOptions)
          : new VolumeAccumulationStrategy(uid, null as any, strategyOptions);

        let totalSignals = 0;
        let currentDate = new Date(dateFrom + 'T00:00:00Z');
        const endDate = new Date(dateTo + 'T00:00:00Z');

        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayFrom = new Date(dateStr + 'T07:00:00Z');
            const dayTo = new Date(dateStr + 'T16:00:00Z');

            try {
              const candles = await loader.loadIntradayCandles(uid, dayFrom, dayTo, token, interval);
              if (candles.length > 0) {
                // Профиль за текущий день
                const engine = new VolumeProfileEngine({ profileResolution, valueAreaPercent });
                candles.forEach(c => (engine as any).onCandle?.(c));
                const profile = engine.getProfile(uid);

                // Обновляем профиль в существующей стратегии
                if (profile) {
                  strategy.updateProfile(profile);
                }

                // Прогоняем свечи дня
                for (const candle of candles) {
                  strategy.onCandle(candle);
                  const newSignals = strategy.getSignals();
                  totalSignals += newSignals.length;

                  for (const signal of newSignals) {
                    portfolio.processSignal(signal);
                  }
                  strategy.clearSignals();

                  const high = quotationToNumber(candle.high);
                  const low = quotationToNumber(candle.low);
                  const close = quotationToNumber(candle.close);
                  portfolio.checkStopTake(high, low, close, candle.time || '');
                }
              }
            } catch (e: any) {
              console.warn(`[Batch] Ошибка загрузки за ${dateStr}:`, e.message);
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Закрываем позицию в конце периода
        portfolio.finalizeWithLastPrice(0, '');

        const resultItem: BatchResultItem = {
          instrumentUid: uid,
          params,
          stats: portfolio.getStats(),
          signals: totalSignals,
        };
        onProgress(resultItem);
      }
    }
  }
}