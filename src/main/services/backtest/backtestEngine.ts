// src/main/services/backtest/backtestEngine.ts
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';

export interface BacktestSignal {
  type: 'BUY' | 'SELL';
  price: number;
  time: string;
  instrumentUid: string;
  reason: string;
}

export interface BacktestStats {
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
}

export interface IBacktestStrategy {
  onCandle(candle: StreamCandle): void;
  getSignals(): BacktestSignal[];
  reset(): void;
}

export class BacktestEngine {
  run(strategy: IBacktestStrategy, candles: StreamCandle[]): BacktestStats {
    strategy.reset();
    for (const candle of candles) {
      strategy.onCandle(candle);
    }
    const signals = strategy.getSignals();
    const buy = signals.filter(s => s.type === 'BUY').length;
    const sell = signals.filter(s => s.type === 'SELL').length;
    return {
      totalSignals: signals.length,
      buySignals: buy,
      sellSignals: sell,
    };
  }
}