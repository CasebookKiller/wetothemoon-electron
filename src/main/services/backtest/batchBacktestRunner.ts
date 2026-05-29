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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

        const strategy = strategyType === 'trend'
          ? new TrendStrategy(uid, null as any, strategyOptions)
          : new VolumeAccumulationStrategy(uid, null as any, strategyOptions);

        let totalSignals = 0;
        let lastClose = 0;                     // ← новая переменная
        let currentDate = new Date(dateFrom + 'T00:00:00Z');
        const endDate = new Date(dateTo + 'T00:00:00Z');

        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayFrom = new Date(dateStr + 'T07:00:00Z');
            const dayTo = new Date(dateStr + 'T16:00:00Z');

            // Повторные попытки для каждого дня
            let candles: any[] = [];
            let retries = 3;
            while (retries > 0) {
              try {
                await delay(1000);
                candles = await loader.loadIntradayCandles(uid, dayFrom, dayTo, token, interval);
                break;
              } catch (e: any) {
                retries--;
                console.warn(`[Batch] Ошибка загрузки за ${dateStr}, осталось попыток: ${retries}`, e.message);
                if (retries > 0) await delay(2000);
              }
            }

            if (candles.length > 0) {
              const engine = new VolumeProfileEngine({ profileResolution, valueAreaPercent });
              candles.forEach(c => (engine as any).onCandle?.(c));
              const profile = engine.getProfile(uid);

              if (profile) {
                strategy.updateProfile(profile);

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
                  lastClose = close;          // ← запоминаем последнюю цену
                  portfolio.checkStopTake(high, low, close, candle.time || '');
                }
              }
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Закрываем позицию по реальной последней цене, а не по 0
        portfolio.finalizeWithLastPrice(lastClose, '');

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