// src/main/services/backtest/virtualPortfolio.ts
import type { BacktestSignal } from './common';

export interface PortfolioConfig {
  initialCapital: number;
  commissionPercent?: number;
  slippagePercent?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface Trade {
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  profit: number;
  profitPercent: number;
  exitReason: 'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_DAY';
}

export interface PortfolioStats {
  initialCapital: number;
  finalCapital: number;
  totalProfit: number;
  totalProfitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageProfit: number;
  averageProfitPercent: number;
}

export class VirtualPortfolio {
  private capital: number;
  private initialCapital: number;
  private trades: Trade[] = [];
  private openPosition: {
    type: 'BUY' | 'SELL';
    price: number;
    time: string;
    stopLossPrice?: number;
    takeProfitPrice?: number;
  } | null = null;
  private peakCapital: number;
  private maxDrawdown: number = 0;
  private config: Required<PortfolioConfig>;

  constructor(config: PortfolioConfig) {
    this.config = {
      initialCapital: config.initialCapital,
      commissionPercent: config.commissionPercent ?? 0,
      slippagePercent: config.slippagePercent ?? 0,
      stopLossPercent: config.stopLossPercent ?? 0,
      takeProfitPercent: config.takeProfitPercent ?? 0,
    };
    this.initialCapital = this.config.initialCapital;
    this.capital = this.config.initialCapital;
    this.peakCapital = this.config.initialCapital;
  }

  processSignal(signal: BacktestSignal): void {
    if (this.openPosition) {
      this.closePosition(signal.price, signal.time, 'SIGNAL');
    }

    const entryPrice = signal.price;
    const stopLossPrice = this.config.stopLossPercent > 0
      ? (signal.type === 'BUY'
          ? entryPrice * (1 - this.config.stopLossPercent / 100)
          : entryPrice * (1 + this.config.stopLossPercent / 100))
      : undefined;

    const takeProfitPrice = this.config.takeProfitPercent > 0
      ? (signal.type === 'BUY'
          ? entryPrice * (1 + this.config.takeProfitPercent / 100)
          : entryPrice * (1 - this.config.takeProfitPercent / 100))
      : undefined;

    this.openPosition = {
      type: signal.type,
      price: entryPrice,
      time: signal.time,
      stopLossPrice,
      takeProfitPrice,
    };
  }

  checkStopTake(high: number, low: number, close: number, time: string): void {
    if (!this.openPosition) return;

    const { type, stopLossPrice, takeProfitPrice } = this.openPosition;

    if (stopLossPrice !== undefined) {
      if (type === 'BUY' && low <= stopLossPrice) {
        this.closePosition(stopLossPrice, time, 'STOP_LOSS');
        return;
      }
      if (type === 'SELL' && high >= stopLossPrice) {
        this.closePosition(stopLossPrice, time, 'STOP_LOSS');
        return;
      }
    }

    if (takeProfitPrice !== undefined) {
      if (type === 'BUY' && high >= takeProfitPrice) {
        this.closePosition(takeProfitPrice, time, 'TAKE_PROFIT');
        return;
      }
      if (type === 'SELL' && low <= takeProfitPrice) {
        this.closePosition(takeProfitPrice, time, 'TAKE_PROFIT');
        return;
      }
    }
  }

  private closePosition(price: number, time: string, reason: Trade['exitReason']): void {
    if (!this.openPosition) return;

    const entry = this.openPosition;
    let profit: number;

    if (entry.type === 'BUY') {
      profit = price - entry.price;
    } else {
      profit = entry.price - price;
    }

    const profitPercent = (profit / entry.price) * 100;
    this.capital += profit;

    this.trades.push({
      type: entry.type,
      entryPrice: entry.price,
      exitPrice: price,
      entryTime: entry.time,
      exitTime: time,
      profit,
      profitPercent,
      exitReason: reason,
    });

    if (this.capital > this.peakCapital) {
      this.peakCapital = this.capital;
    }
    const currentDrawdown = this.peakCapital - this.capital;
    if (currentDrawdown > this.maxDrawdown) {
      this.maxDrawdown = currentDrawdown;
    }

    this.openPosition = null;
  }

  finalizeWithLastPrice(lastPrice: number, time: string): PortfolioStats {
    if (this.openPosition) {
      this.closePosition(lastPrice, time, 'END_OF_DAY');
    }
    return this.getStats();
  }

  getStats(): PortfolioStats {
    const totalTrades = this.trades.length;
    const winningTrades = this.trades.filter(t => t.profit > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalProfit = this.capital - this.initialCapital;
    const totalProfitPercent = (totalProfit / this.initialCapital) * 100;

    const maxDrawdownPercent = this.peakCapital > 0 ? (this.maxDrawdown / this.peakCapital) * 100 : 0;

    const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
    const averageProfitPercent = totalTrades > 0 ? totalProfitPercent / totalTrades : 0;

    return {
      initialCapital: this.initialCapital,
      finalCapital: this.capital,
      totalProfit,
      totalProfitPercent,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent,
      averageProfit,
      averageProfitPercent,
    };
  }
}