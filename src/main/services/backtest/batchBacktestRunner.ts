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
  // можно добавить интервал, стратегию и т.д.
}

export interface BatchResultItem {
  instrumentUid: string;
  instrumentName?: string;
  params: BatchParams;
  stats: any; // PortfolioStats
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
    valueAreaPercent: number
  ): Promise<BatchResultItem[]> {
    const loader = new HistoricalDataLoader();
    const results: BatchResultItem[] = [];

    for (const uid of instrumentUids) {
      // Загружаем свечи за весь период (используем по дням, как в обычном бэктесте)
      // Для простоты загружаем все свечи одним запросом (если период большой – может быть много, но пока допустим)
      const candles = await loader.loadIntradayCandles(
        uid,
        new Date(dateFrom + 'T07:00:00Z'),
        new Date(dateTo + 'T16:00:00Z'),
        token,
        interval
      );

      if (candles.length === 0) continue;

      // Строим профиль (один на весь период или по дням? Пока упростим – на все свечи)
      const engine = new VolumeProfileEngine({ profileResolution, valueAreaPercent });
      candles.forEach(c => (engine as any).onCandle?.(c));
      const profile = engine.getProfile(uid);

      // Для каждого набора параметров
      for (const params of paramSets) {
        const strategy = strategyType === 'trend'
          ? new TrendStrategy(uid, profile, { volumeFilterEnabled: params.volumeFilterEnabled, volumeFilterPeriod: params.volumeFilterPeriod })
          : new VolumeAccumulationStrategy(uid, profile, { volumeFilterEnabled: params.volumeFilterEnabled, volumeFilterPeriod: params.volumeFilterPeriod });

        const portfolio = new VirtualPortfolio({
          initialCapital: 100000,
          stopLossPercent: params.stopLossPercent,
          takeProfitPercent: params.takeProfitPercent,
          trailingDistancePercent: params.trailingDistancePercent,
          lotQuantity: params.lots,
          positionSizing: params.positionSizing,
          riskPercent: params.riskPercent,
        });

        // Прогоняем свечи последовательно
        for (const candle of candles) {
          strategy.onCandle(candle);
          const newSignals = strategy.getSignals();
          for (const signal of newSignals) {
            portfolio.processSignal(signal);
          }
          strategy.clearSignals();
          const high = quotationToNumber(candle.high);
          const low = quotationToNumber(candle.low);
          const close = quotationToNumber(candle.close);
          portfolio.checkStopTake(high, low, close, candle.time || '');
        }

        const lastCandle = candles[candles.length - 1];
        const lastClose = quotationToNumber(lastCandle.close);
        portfolio.finalizeWithLastPrice(lastClose, lastCandle.time || '');

        results.push({
          instrumentUid: uid,
          instrumentName: undefined, // можно будет подставить из кэша инструментов
          params,
          stats: portfolio.getStats(),
          signals: strategy.getSignals().length,
        });
      }
    }

    return results;
  }
}