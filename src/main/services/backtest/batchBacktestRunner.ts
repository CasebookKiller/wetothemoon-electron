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
      // Загружаем свечи за каждый рабочий день периода
      const allCandles: any[] = [];
      let currentDate = new Date(dateFrom + 'T00:00:00Z');
      const endDate = new Date(dateTo + 'T00:00:00Z');

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 = вс, 6 = сб
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const dayFrom = new Date(dateStr + 'T07:00:00Z');
          const dayTo = new Date(dateStr + 'T16:00:00Z');

          try {
            const candles = await loader.loadIntradayCandles(uid, dayFrom, dayTo, token, interval);
            allCandles.push(...candles);
          } catch (e: any) {
            console.warn(`[Batch] Ошибка загрузки за ${dateStr}:`, e.message);
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (allCandles.length === 0) continue;

      // Строим профиль на все свечи периода
      const engine = new VolumeProfileEngine({ profileResolution, valueAreaPercent });
      allCandles.forEach(c => (engine as any).onCandle?.(c));
      const profile = engine.getProfile(uid);

      // Для каждого набора параметров
      for (const params of paramSets) {
        const strategyOptions = {
          volumeFilterEnabled: params.volumeFilterEnabled,
          volumeFilterPeriod: params.volumeFilterPeriod,
        };

        const strategy = strategyType === 'trend'
          ? new TrendStrategy(uid, profile, strategyOptions)
          : new VolumeAccumulationStrategy(uid, profile, strategyOptions);

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
        for (const candle of allCandles) {
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

        // Закрываем позицию в конце периода
        const lastCandle = allCandles[allCandles.length - 1];
        const lastClose = quotationToNumber(lastCandle.close);
        portfolio.finalizeWithLastPrice(lastClose, lastCandle.time || '');

        results.push({
          instrumentUid: uid,
          params,
          stats: portfolio.getStats(),
          signals: strategy.getSignals().length,
        });
      }
    }

    return results;
  }
}