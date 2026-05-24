// src/main/services/backtest/strategies/VolumeAccumulationStrategy.ts
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import type { VolumeProfileLevels } from '../../volumeProfileEngine';
import type { IBacktestStrategy, BacktestSignal } from '../backtestEngine';

export class VolumeAccumulationStrategy implements IBacktestStrategy {
  private signals: BacktestSignal[] = [];
  private dailyProfile: VolumeProfileLevels | null = null;
  private instrumentUid: string;
  private hasBrokenHigh = false;
  private hasBrokenLow = false;

  constructor(instrumentUid: string, dailyProfile: VolumeProfileLevels | null) {
    this.instrumentUid = instrumentUid;
    this.dailyProfile = dailyProfile;
  }

  reset(): void {
    this.signals = [];
    this.hasBrokenHigh = false;
    this.hasBrokenLow = false;
    this.hasPosition = false;   // ← сброс при новом дне
  }

  private hasPosition = false;

  onCandle(candle: StreamCandle): void {
    // Если уже есть открытая позиция – не генерируем новые сигналы
    if (!this.dailyProfile || this.hasPosition) return;

    const high = quotationToNumber(candle.high);
    const low = quotationToNumber(candle.low);
    const close = quotationToNumber(candle.close);
    const time = candle.time || new Date().toISOString();

    // Отслеживаем выход выше Value Area High
    if (high > this.dailyProfile.valueAreaHigh) {
      this.hasBrokenHigh = true;
      this.hasBrokenLow = false;
    }
    // Отслеживаем выход ниже Value Area Low
    if (low < this.dailyProfile.valueAreaLow) {
      this.hasBrokenLow = true;
      this.hasBrokenHigh = false;
    }

    // Возврат внутрь VA после пробоя High → сигнал SELL
    if (this.hasBrokenHigh && close < this.dailyProfile.valueAreaHigh) {
      this.signals.push({
        type: 'SELL',
        price: close,
        time,
        instrumentUid: this.instrumentUid,
        reason: `Return to VA after breaking high (VAH=${this.dailyProfile.valueAreaHigh})`,
      });
      this.hasBrokenHigh = false;
      this.hasPosition = true;   // ← позиция открыта
    }

    // Возврат внутрь VA после пробоя Low → сигнал BUY
    if (this.hasBrokenLow && close > this.dailyProfile.valueAreaLow) {
      this.signals.push({
        type: 'BUY',
        price: close,
        time,
        instrumentUid: this.instrumentUid,
        reason: `Return to VA after breaking low (VAL=${this.dailyProfile.valueAreaLow})`,
      });
      this.hasBrokenLow = false;
      this.hasPosition = true;   // ← позиция открыта
    }
  }

  getSignals(): BacktestSignal[] {
    return this.signals;
  }
}

function quotationToNumber(q: any): number {
  if (!q) return 0;
  const units = Number(q.units || 0);
  const nano = q.nano || 0;
  return units + nano / 1e9;
}