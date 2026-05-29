// src/main/services/backtest/strategies/VolumeAccumulationStrategy.ts
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import type { VolumeProfileLevels } from '../../volumeProfileEngine';
import type { IBacktestStrategy } from '../backtestEngine';
import { BacktestSignal } from '../common';

export class VolumeAccumulationStrategy implements IBacktestStrategy {
  private signals: BacktestSignal[] = [];
  private dailyProfile: VolumeProfileLevels | null = null;
  private instrumentUid: string;
  private hasBrokenHigh = false;
  private hasBrokenLow = false;
  private volumeFilterEnabled: boolean;
  private volumeFilterPeriod: number;
  private volumeHistory: number[] = [];
  private lastSignalDirection: string | null = null;

  constructor(
    instrumentUid: string,
    dailyProfile: VolumeProfileLevels | null,   // ← добавлено | null
    options?: { volumeFilterEnabled?: boolean; volumeFilterPeriod?: number }
  ) {
    this.instrumentUid = instrumentUid;
    this.dailyProfile = dailyProfile;
    this.volumeFilterEnabled = options?.volumeFilterEnabled ?? false;
    this.volumeFilterPeriod = options?.volumeFilterPeriod ?? 20;
  }

  reset(): void {
    this.signals = [];
    this.hasBrokenHigh = false;
    this.hasBrokenLow = false;
    this.hasPosition = false;   // ← сброс при новом дне
    this.volumeHistory = [];
  }

  private hasPosition = false;

  onCandle(candle: StreamCandle): void {
    // Если уже есть открытая позиция – не генерируем новые сигналы
    if (!this.dailyProfile || this.hasPosition) return;

    const high = quotationToNumber(candle.high);
    const low = quotationToNumber(candle.low);
    const close = quotationToNumber(candle.close);
    const time = candle.time || new Date().toISOString();

    // Сохраняем объём текущей свечи
    const volume = Number(candle.volume || '0');
    this.volumeHistory.push(volume);
    if (this.volumeHistory.length > this.volumeFilterPeriod) {
      this.volumeHistory.shift();
    }

    // Проверка фильтра по объёму
    if (this.volumeFilterEnabled && this.volumeHistory.length >= this.volumeFilterPeriod) {
      const avgVolume = this.volumeHistory.reduce((a, b) => a + b, 0) / this.volumeHistory.length;
      if (volume < avgVolume) {
        return; // объём ниже среднего – игнорируем сигнал
      }
    }

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

  clearSignals(): void {
    this.signals = [];
  }

  updateProfile(profile: VolumeProfileLevels): void {
    this.dailyProfile = profile;
    this.hasPosition = false;               // ← сброс позиции
    this.lastSignalDirection = null;   // если используете
  }
}

function quotationToNumber(q: any): number {
  if (!q) return 0;
  const units = Number(q.units || 0);
  const nano = q.nano || 0;
  return units + nano / 1e9;
}