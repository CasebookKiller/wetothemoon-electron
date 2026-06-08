// src/main/services/historicalDataLoader.ts

import { marketDataGrpc } from './tbank/MarketDataGrpcService';
import { VolumeProfileEngine } from './volumeProfileEngine';
import type { VolumeProfileLevels } from './volumeProfileEngine';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import { CandleInterval, CandleSourceRequest } from '@/api/tbank/marketdataTypes';

function quotationToNumber(q: any): number {
  if (!q) return 0;
  const units = Number(q.units || 0);
  const nano = q.nano || 0;
  return units + nano / 1e9;
}

/** Преобразует Timestamp (строка ISO или объект {seconds,nanos}) в ISO-строку */
function timestampToISO(ts: any): string {
  if (!ts) return new Date().toISOString();
  // объект {seconds,nanos}
  if (typeof ts === 'object' && ts.seconds !== undefined) {
    return new Date(ts.seconds * 1000).toISOString();
  }
  // строка ISO 8601
  if (typeof ts === 'string') {
    return new Date(ts).toISOString();
  }
  return new Date().toISOString();
}

export class HistoricalDataLoader {
  async loadDailyProfile(
    instrumentUid: string,
    from: Date,
    to: Date,
    token: string,
    profileResolution: number = 50   // <-- новый параметр
  ): Promise<VolumeProfileLevels | null> {
    const request = {
      instrumentId: instrumentUid,
      interval: CandleInterval.CANDLE_INTERVAL_DAY,
      from: { seconds: Math.floor(from.getTime() / 1000), nanos: 0 } as any,
      to: { seconds: Math.floor(to.getTime() / 1000), nanos: 0 } as any,
      candleSourceType: CandleSourceRequest.CANDLE_SOURCE_EXCHANGE,
    };

    const response = await marketDataGrpc.getCandles(request, token);
    const candles = response.candles || [];
    if (candles.length === 0) return null;

    const engine = new VolumeProfileEngine({ profileResolution });
    for (const candle of candles) {
      const open = quotationToNumber(candle.open);
      const high = quotationToNumber(candle.high);
      const low = quotationToNumber(candle.low);
      const close = quotationToNumber(candle.close);
      const volume = Number(candle.volume || '0');

      const streamCandle: StreamCandle = {
        instrumentUid,
        open: { units: open.toString(), nano: 0 },
        high: { units: high.toString(), nano: 0 },
        low: { units: low.toString(), nano: 0 },
        close: { units: close.toString(), nano: 0 },
        volume: volume.toString(),
        time: timestampToISO(candle.time),
      };
      (engine as any).onCandle?.(streamCandle);
    }

    return engine.getProfile(instrumentUid);
  }

  async loadIntradayCandles(
    instrumentUid: string,
    from: Date,
    to: Date,
    token: string,
    interval: CandleInterval = CandleInterval.CANDLE_INTERVAL_1_MIN
  ): Promise<StreamCandle[]> {
    const request = {
      instrumentId: instrumentUid,
      interval,
      from: { seconds: Math.floor(from.getTime() / 1000), nanos: 0 } as any,
      to: { seconds: Math.floor(to.getTime() / 1000), nanos: 0 } as any,
      candleSourceType: CandleSourceRequest.CANDLE_SOURCE_EXCHANGE,
    };

    const response = await marketDataGrpc.getCandles(request, token);
    const candles = response.candles || [];

    return candles.map(candle => ({
      instrumentUid,
      open: candle.open as any,
      high: candle.high as any,
      low: candle.low as any,
      close: candle.close as any,
      volume: String(candle.volume || '0'),
      time: timestampToISO(candle.time),
    }));
  }
}