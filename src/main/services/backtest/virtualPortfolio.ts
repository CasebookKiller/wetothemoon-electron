// src/main/services/backtest/virtualPortfolio.ts
import type { BacktestSignal } from './common';

export interface PortfolioConfig {
  initialCapital: number;
  commissionPercent?: number;
  slippagePercent?: number;
}

export interface Trade {
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  profit: number;
  profitPercent: number;
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
  private openPosition: { type: 'BUY' | 'SELL'; price: number; time: string } | null = null;
  private peakCapital: number;
  private maxDrawdown: number = 0; // абсолютная максимальная просадка

  constructor(config: PortfolioConfig) {
    this.initialCapital = config.initialCapital;
    this.capital = config.initialCapital;
    this.peakCapital = config.initialCapital;
  }

  processSignal(signal: BacktestSignal): void {
    if (this.openPosition) {
      this.closePosition(signal.price, signal.time);
    }
    this.openPosition = { type: signal.type, price: signal.price, time: signal.time };
  }

  closePosition(price: number, time: string): void {
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
    });

    // Обновляем пик капитала
    if (this.capital > this.peakCapital) {
      this.peakCapital = this.capital;
    }

    // Вычисляем текущую просадку от пика
    const currentDrawdown = this.peakCapital - this.capital;
    if (currentDrawdown > this.maxDrawdown) {
      this.maxDrawdown = currentDrawdown;
    }

    this.openPosition = null;
  }

  finalizeWithLastPrice(lastPrice: number, time: string): PortfolioStats {
    if (this.openPosition) {
      this.closePosition(lastPrice, time);
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

    // Максимальная просадка уже вычислена в процессе
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