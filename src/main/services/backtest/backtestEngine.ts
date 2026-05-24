// src/main/services/backtest/backtestEngine.ts
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
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
