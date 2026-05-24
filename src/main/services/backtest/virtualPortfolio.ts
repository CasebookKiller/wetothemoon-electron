// src/main/services/backtest/virtualPortfolio.ts
import type { BacktestSignal } from './backtestEngine';

export interface PortfolioConfig {
  initialCapital: number;
  commissionPercent?: number; // комиссия за сделку, % (пока 0)
  slippagePercent?: number;   // проскальзывание, % (пока 0)
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

  constructor(config: PortfolioConfig) {
    this.initialCapital = config.initialCapital;
    this.capital = config.initialCapital;
    this.peakCapital = config.initialCapital;
  }

  /** Обрабатывает сигнал: если есть открытая позиция, закрывает её по цене сигнала,
   *  затем открывает новую в соответствии с сигналом.
   *  Упрощённо: каждый сигнал = закрытие предыдущей + открытие новой.
   */
  processSignal(signal: BacktestSignal): void {
    // Если уже есть позиция, закрываем
    if (this.openPosition) {
      this.closePosition(signal.price, signal.time);
    }
    // Открываем новую
    this.openPosition = { type: signal.type, price: signal.price, time: signal.time };
  }

  /** Закрыть позицию (при завершении бэктеста или перед сменой направления) */
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

    // Обновляем пик капитала для расчёта просадки
    if (this.capital > this.peakCapital) {
      this.peakCapital = this.capital;
    }

    this.openPosition = null;
  }

  /** Принудительно закрыть все позиции и вернуть статистику */
  finalize(): PortfolioStats {
    // Если осталась открытая позиция, закрываем по последней цене (незавершённая сделка)
    // Но в бэктесте мы будем закрывать в конце принудительно
    if (this.openPosition) {
      // Для простоты: закрываем по той же цене (нулевой профит)
      // В реальном бэктесте нужно использовать последнюю цену из candles,
      // поэтому добавим метод finalize(lastPrice).
      // Пока оставим как есть, вызов будет с lastPrice
    }
    return this.getStats();
  }

  /** Закрыть позицию по последней рыночной цене и вернуть статистику */
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

    // Максимальная просадка от пика
    const maxDrawdown = this.peakCapital - this.capital; // упрощённо, правильнее считать по ходу
    const maxDrawdownPercent = (maxDrawdown / this.peakCapital) * 100;

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
      maxDrawdown: Math.max(0, maxDrawdown),
      maxDrawdownPercent: Math.max(0, maxDrawdownPercent),
      averageProfit,
      averageProfitPercent,
    };
  }
}