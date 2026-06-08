// src/main/services/marketPhaseDetector.ts
import { CandleInterval } from '@/api/tbank/marketdataTypes';
import { HistoricalDataLoader } from './historicalDataLoader';
import { VolumeProfileEngine, VolumeProfileLevels } from './volumeProfileEngine';

export enum MarketPhase {
  BALANCE = 'BALANCE',
  TREND_UP = 'TREND_UP',
  TREND_DOWN = 'TREND_DOWN',
  BREAKOUT = 'BREAKOUT',
  CHOP = 'CHOP',
}

export class MarketPhaseDetector {
  constructor(
    private historicalLoader: HistoricalDataLoader,
    private profileEngine: VolumeProfileEngine
  ) {}

  async detectPhase(instrumentUid: string): Promise<MarketPhase> {
    const candles = await this.historicalLoader.loadIntradayCandles(
      instrumentUid,
      new Date(Date.now() - 120 * 60 * 1000), // последние 2 часа
      new Date(),
      process.env.VITE_TReadOnly || '',
      CandleInterval.CANDLE_INTERVAL_5_MIN, // можно параметризовать
    );

    const profile = this.profileEngine.getProfile(instrumentUid);
    if (!profile || candles.length < 5) return MarketPhase.CHOP;

    const { vwap, angle } = this.calcVWAPAngle(candles);
    const insideVA = this.calcPercentInsideVA(candles, profile);
    const lastCandle = candles[candles.length - 1];
    const avgVolume = candles.reduce((s, c) => s + Number(c.volume), 0) / candles.length;
    const volumeSpike = Number(lastCandle.volume) > avgVolume * 1.5;

    const absAngle = Math.abs(angle);
    if (insideVA > 70 && absAngle < 0.3) return MarketPhase.BALANCE;
    if (absAngle > 0.5 && insideVA < 40)
      return angle > 0 ? MarketPhase.TREND_UP : MarketPhase.TREND_DOWN;
    if (volumeSpike && (Number(lastCandle.high) > profile.valueAreaHigh || Number(lastCandle.low) < profile.valueAreaLow))
      return MarketPhase.BREAKOUT;
    return MarketPhase.CHOP;
  }

  private calcVWAPAngle(candles: any[]) {
    const totalVolume = candles.reduce((s: number, c: any) => s + Number(c.volume), 0);
    const vwap = candles.reduce((s: number, c: any) => s + (Number(c.high)+Number(c.low)+Number(c.close))/3 * Number(c.volume), 0) / totalVolume;
    if (candles.length < 2) return { vwap, angle: 0 };
    const prevVWAP = (Number(candles[candles.length-2].high)+Number(candles[candles.length-2].low)+Number(candles[candles.length-2].close))/3;
    const lastVWAP = (Number(candles[candles.length-1].high)+Number(candles[candles.length-1].low)+Number(candles[candles.length-1].close))/3;
    const angle = Math.atan((lastVWAP - prevVWAP) / prevVWAP) * (180 / Math.PI);
    return { vwap, angle };
  }

  private calcPercentInsideVA(candles: any[], profile: VolumeProfileLevels) {
    const inside = candles.filter(
      (c: any) => Number(c.close) >= profile.valueAreaLow && Number(c.close) <= profile.valueAreaHigh
    ).length;
    return (inside / candles.length) * 100;
  }
}