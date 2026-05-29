// src/main/services/backtest/backtestEngine.ts
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import { VirtualPortfolio, type PortfolioStats, type PortfolioConfig } from './virtualPortfolio';
import { quotationToNumber } from './common';
import type { BacktestSignal } from './common';
import { VolumeProfileLevels } from '../volumeProfileEngine';

export interface BacktestStats {
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  portfolio: PortfolioStats;
}

export interface IBacktestStrategy {
  onCandle(candle: StreamCandle): void;
  getSignals(): BacktestSignal[];
  reset(): void;
  clearSignals(): void;
  updateProfile(profile: VolumeProfileLevels): void;
}

export class BacktestEngine {
  private portfolioConfig: PortfolioConfig;

  constructor(portfolioConfig?: Partial<PortfolioConfig>) {
    this.portfolioConfig = {
      initialCapital: 100000,
      stopLossPercent: 0,
      takeProfitPercent: 0,
      ...portfolioConfig,
    };
  }

  run(strategy: IBacktestStrategy, candles: StreamCandle[]): BacktestStats {
    strategy.reset();
    const portfolio = new VirtualPortfolio(this.portfolioConfig);

    for (const candle of candles) {
      strategy.onCandle(candle);

      const high = quotationToNumber(candle.high);
      const low = quotationToNumber(candle.low);
      const close = quotationToNumber(candle.close);
      portfolio.checkStopTake(high, low, close, candle.time || '');

      const newSignals = strategy.getSignals();
      for (const signal of newSignals) {
        portfolio.processSignal(signal);
      }
      strategy.clearSignals();
    }

    const lastCandle = candles[candles.length - 1];
    const lastClose = quotationToNumber(lastCandle.close);
    portfolio.finalizeWithLastPrice(lastClose, lastCandle.time || '');

    const signals = strategy.getSignals(); // после очистки будет пусто, но на всякий случай
    const buy = signals.filter(s => s.type === 'BUY').length;
    const sell = signals.filter(s => s.type === 'SELL').length;

    return {
      totalSignals: signals.length,
      buySignals: buy,
      sellSignals: sell,
      portfolio: portfolio.getStats(),
    };
  }
}
/*import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import { VirtualPortfolio, type PortfolioStats, type PortfolioConfig } from './virtualPortfolio';
import { quotationToNumber } from './common';
import { BacktestSignal } from './common';

export interface BacktestStats {
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  portfolio: PortfolioStats;
}

export interface IBacktestStrategy {
  onCandle(candle: StreamCandle): void;
  getSignals(): BacktestSignal[];
  reset(): void;
}

export class BacktestEngine {
  private portfolioConfig: PortfolioConfig;

  constructor(portfolioConfig?: Partial<PortfolioConfig>) {
    this.portfolioConfig = {
      initialCapital: 100000,
      ...portfolioConfig,
    };
  }

  run(strategy: IBacktestStrategy, candles: StreamCandle[]): BacktestStats {
    strategy.reset();
    const portfolio = new VirtualPortfolio(this.portfolioConfig);

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      strategy.onCandle(candle);

      // Сразу обрабатываем сигналы, сгенерированные на этой свече
      const newSignals = strategy.getSignals();
      if (newSignals.length > 0) {
        for (const signal of newSignals) {
          portfolio.processSignal(signal);
        }
        // Очищаем сигналы после обработки (если стратегия не делает это сама)
        // В нашей реализации стратегия хранит все сигналы, поэтому нужно их удалять или
        // в стратегии добавить метод clearSignals. Пока будем копить.
      }
    }

    // Закрываем открытую позицию по цене закрытия последней свечи
    const lastCandle = candles[candles.length - 1];
    const lastPrice = quotationToNumber(lastCandle.close);
    portfolio.finalizeWithLastPrice(lastPrice, lastCandle.time || '');

    const signals = strategy.getSignals();
    const buy = signals.filter(s => s.type === 'BUY').length;
    const sell = signals.filter(s => s.type === 'SELL').length;

    return {
      totalSignals: signals.length,
      buySignals: buy,
      sellSignals: sell,
      portfolio: portfolio.getStats(),
    };
  }
}
*/