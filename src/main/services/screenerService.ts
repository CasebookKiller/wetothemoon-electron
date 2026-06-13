// src/main/services/screenerService.ts
import { HistoricalDataLoader } from './historicalDataLoader';
import { VolumeProfileEngine, VolumeProfileLevels } from './volumeProfileEngine';
import { instrumentsGrpc } from './tbank/InstrumentsGrpcService';
import { CandleInterval } from '@/api/tbank/marketdataTypes';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';

export interface ScreenerFilters {
  minAvgVolume?: number;        // минимальный средний объём за свечу (не дневной!)
  maxVaWidthPercent?: number;
  minPocStrength?: number;      // доля объёма POC от объёма Value Area (не всего профиля)
}

export interface ScreenerResult {
  figi: string;
  ticker: string;
  name: string;
  uid: string;                  // ← обязательно для отправки в фермер
  lastPrice: number;
  avgVolumePerCandle: number;   // средний объём за часовую свечу
  vaWidthPercent: number;
  pocStrength: number;          // pocVolume / vaVolume
  poc: number;
  vah: number;
  val: number;
  error?: string;
}

export class ScreenerService {
  private profileResolution = 50;
  private valueAreaPercent = 70;

  constructor(
    private historicalLoader: HistoricalDataLoader,
    private getToken: () => string
  ) {}

  async screen(filters: ScreenerFilters): Promise<ScreenerResult[]> {
    const token = this.getToken();

    const sharesResponse = await instrumentsGrpc.shares(
      { instrumentStatus: 1 },
      token
    );
    const instruments = (sharesResponse.instruments || []).filter(
      (inst: any) =>
        inst.apiTradeAvailableFlag === true &&
        inst.currency?.toLowerCase() === 'rub' &&
        !inst.blockedTrading &&
        inst.ticker &&
        inst.figi &&
        inst.uid
    );

    const results: ScreenerResult[] = [];
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    for (const instr of instruments) {
      const uid = instr.uid as string;
      const figi = instr.figi as string;
      const ticker = instr.ticker as string;
      const name = instr.name as string;

      try {
        // Задержка между инструментами, чтобы не превысить лимит API
        await new Promise(resolve => setTimeout(resolve, 150));

        let candles: StreamCandle[] | null = null;
        let attempts = 0;

        // Две попытки с паузой при rate limit
        while (attempts < 2) {
          try {
            candles = await this.historicalLoader.loadIntradayCandles(
              uid,
              twoDaysAgo,
              now,
              token,
              CandleInterval.CANDLE_INTERVAL_HOUR
            );
            break; // успешно загрузили – выходим из цикла
          } catch (err: any) {
            if (err.code === 8) { // RESOURCE_EXHAUSTED
              console.warn(`Rate limit hit for ${ticker}, waiting 3s...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              attempts++;
            } else {
              throw err; // другая ошибка – пробрасываем выше
            }
          }
        }

        if (!candles || candles.length < 5) {
          results.push({
            figi, ticker, name, uid,
            lastPrice: 0, avgVolumePerCandle: 0, vaWidthPercent: 0,
            pocStrength: 0, poc: 0, vah: 0, val: 0,
            error: 'Not enough candles'
          });
          continue;
        }

        const validCandles = candles.filter(c => {
          const high = this.q(c.high);
          const low = this.q(c.low);
          const close = this.q(c.close);
          const vol = Number(c.volume || '0');
          return vol > 0 && high > 0 && low > 0 && close > 0;
        });

        if (validCandles.length < 3) {
          results.push({
            figi, ticker, name, uid,
            lastPrice: 0, avgVolumePerCandle: 0, vaWidthPercent: 0,
            pocStrength: 0, poc: 0, vah: 0, val: 0,
            error: 'Invalid candles'
          });
          continue;
        }

        const avgVolumePerCandle = validCandles.reduce((s, c) => s + Number(c.volume || '0'), 0) / validCandles.length;
        if (filters.minAvgVolume && avgVolumePerCandle < filters.minAvgVolume) {
          results.push({
            figi, ticker, name, uid,
            lastPrice: 0, avgVolumePerCandle, vaWidthPercent: 0,
            pocStrength: 0, poc: 0, vah: 0, val: 0,
            error: 'Volume too low'
          });
          continue;
        }

        const engine = new VolumeProfileEngine({
          profileResolution: this.profileResolution,
          valueAreaPercent: this.valueAreaPercent,
          skipAutoSubscribe: true,
        });

        validCandles.forEach(c => engine.feedCandle(c));
        const profile: VolumeProfileLevels | null = engine.getProfile(uid);
        if (!profile || profile.totalVolume === 0) {
          results.push({
            figi, ticker, name, uid,
            lastPrice: 0, avgVolumePerCandle, vaWidthPercent: 0,
            pocStrength: 0, poc: 0, vah: 0, val: 0,
            error: 'No profile'
          });
          continue;
        }

        const vaWidth = profile.valueAreaHigh - profile.valueAreaLow;
        const vaWidthPercent = (vaWidth / profile.poc) * 100;
        if (filters.maxVaWidthPercent && vaWidthPercent > filters.maxVaWidthPercent) {
          results.push({
            figi, ticker, name, uid,
            lastPrice: profile.poc, avgVolumePerCandle, vaWidthPercent,
            pocStrength: 0, poc: profile.poc, vah: profile.valueAreaHigh, val: profile.valueAreaLow,
            error: 'VA too wide'
          });
          continue;
        }

        // Рассчитываем объём внутри Value Area и объём POC в VA
        let vaVolume = 0;
        let pocVolumeInVA = 0;
        for (const v of profile.volumeByPrice) {
          if (v.price >= profile.valueAreaLow && v.price <= profile.valueAreaHigh) {
            vaVolume += v.volume;
            if (v.price === profile.poc) {
              pocVolumeInVA = v.volume;
            }
          }
        }
        const pocStrength = vaVolume > 0 ? pocVolumeInVA / vaVolume : 0;
        if (filters.minPocStrength && pocStrength < filters.minPocStrength) {
          results.push({
            figi, ticker, name, uid,
            lastPrice: profile.poc, avgVolumePerCandle, vaWidthPercent,
            pocStrength, poc: profile.poc, vah: profile.valueAreaHigh, val: profile.valueAreaLow,
            error: 'POC too weak'
          });
          continue;
        }

        results.push({
          figi,
          ticker,
          name,
          uid,
          lastPrice: profile.poc,
          avgVolumePerCandle: Math.round(avgVolumePerCandle),
          vaWidthPercent: Math.round(vaWidthPercent * 100) / 100,
          pocStrength: Math.round(pocStrength * 100) / 100,
          poc: profile.poc,
          vah: profile.valueAreaHigh,
          val: profile.valueAreaLow,
        });
        engine.reset(uid);
        
      } catch (err: any) {
        results.push({
          figi, ticker, name, uid,
          lastPrice: 0, avgVolumePerCandle: 0, vaWidthPercent: 0,
          pocStrength: 0, poc: 0, vah: 0, val: 0,
          error: err.message
        });
      }
    }

    results.sort((a, b) => (a.error ? 1 : 0) - (b.error ? 1 : 0) || b.avgVolumePerCandle - a.avgVolumePerCandle);
    return results;
  }

  private q(quotation: any): number {
    if (!quotation) return 0;
    const units = Number(quotation.units || 0);
    const nano = quotation.nano || 0;
    return units + nano / 1e9;
  }
}