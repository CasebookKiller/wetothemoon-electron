// src/main/services/backtest/strategies/TrendStrategy.ts
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import type { VolumeProfileLevels } from '../../volumeProfileEngine';
import type { IBacktestStrategy } from '../backtestEngine';
import { quotationToNumber, BacktestSignal } from '../common';

export class TrendStrategy implements IBacktestStrategy {
  private signals: BacktestSignal[] = [];
  private dailyProfile: VolumeProfileLevels | null = null;
  private instrumentUid: string;

  // Состояния для отслеживания пробоев и ретестов
  private hvnLevel: number | null = null;        // текущий отслеживаемый уровень HVN
  private hvnBroken = false;                     // был ли пробой уровня
  private trendDirection: 'UP' | 'DOWN' | null = null;

  constructor(instrumentUid: string, dailyProfile: VolumeProfileLevels | null) {
    this.instrumentUid = instrumentUid;
    this.dailyProfile = dailyProfile;
  }

  reset(): void {
    this.signals = [];
    this.hvnLevel = null;
    this.hvnBroken = false;
    this.trendDirection = null;
  }

  onCandle(candle: StreamCandle): void {
    if (!this.dailyProfile) return;

    const high = quotationToNumber(candle.high);
    const low = quotationToNumber(candle.low);
    const close = quotationToNumber(candle.close);
    const time = candle.time || new Date().toISOString();

    // 1. Определяем тренд
    if (close > this.dailyProfile.valueAreaHigh) {
      this.trendDirection = 'UP';
    } else if (close < this.dailyProfile.valueAreaLow) {
      this.trendDirection = 'DOWN';
    } else {
      // Внутри VA – тренд не определён, сбрасываем состояние
      this.hvnLevel = null;
      this.hvnBroken = false;
      return;
    }

    // 2. Если ещё не выбрали HVN, выбираем ближайший по направлению тренда
    if (this.hvnLevel === null && this.dailyProfile.hvn.length > 0) {
      // Для восходящего тренда ищем ближайший HVN ниже текущей цены
      // Для нисходящего – выше текущей цены
      const hvnList = this.dailyProfile.hvn;
      if (this.trendDirection === 'UP') {
        const candidates = hvnList.filter(level => level < close);
        if (candidates.length > 0) {
          this.hvnLevel = Math.max(...candidates); // ближайший снизу
        }
      } else {
        const candidates = hvnList.filter(level => level > close);
        if (candidates.length > 0) {
          this.hvnLevel = Math.min(...candidates); // ближайший сверху
        }
      }
    }

    if (this.hvnLevel === null) return;

    // 3. Проверяем пробой HVN
    if (!this.hvnBroken) {
      if (this.trendDirection === 'UP' && high > this.hvnLevel) {
        this.hvnBroken = true;
      } else if (this.trendDirection === 'DOWN' && low < this.hvnLevel) {
        this.hvnBroken = true;
      }
    }

    // 4. Если пробой был, ждём ретест
    if (this.hvnBroken) {
      const retestTolerance = 0.05; // можно вынести в параметры
      if (this.trendDirection === 'UP' && close < this.hvnLevel + retestTolerance && close > this.hvnLevel - retestTolerance) {
        // Ретест снизу – вход в лонг
        this.signals.push({
          type: 'BUY',
          price: close,
          time,
          instrumentUid: this.instrumentUid,
          reason: `Тренд вверх, ретест HVN ${this.hvnLevel}`,
        });
        // Сбрасываем, чтобы искать следующий уровень
        this.hvnLevel = null;
        this.hvnBroken = false;
      } else if (this.trendDirection === 'DOWN' && close > this.hvnLevel - retestTolerance && close < this.hvnLevel + retestTolerance) {
        // Ретест сверху – вход в шорт
        this.signals.push({
          type: 'SELL',
          price: close,
          time,
          instrumentUid: this.instrumentUid,
          reason: `Тренд вниз, ретест HVN ${this.hvnLevel}`,
        });
        this.hvnLevel = null;
        this.hvnBroken = false;
      }
    }
  }

  getSignals(): BacktestSignal[] {
    return this.signals;
  }
}