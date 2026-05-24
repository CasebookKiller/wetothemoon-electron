// src/main/services/backtest/backtestEngine.ts
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';

export interface BacktestStrategy {
  onCandle(candle: StreamCandle): void;
  getStats(): BacktestStats;
  reset(): void;
}

export interface BacktestStats {
  totalTrades: number;
  winningTrades: number;
  profitFactor: number;
  maxDrawdownPercent: number;
}

export class BacktestEngine {
  run(strategy: BacktestStrategy, candles: StreamCandle[]): BacktestStats {
    strategy.reset();
    for (const candle of candles) {
      strategy.onCandle(candle);
    }
    return strategy.getStats();
  }
}