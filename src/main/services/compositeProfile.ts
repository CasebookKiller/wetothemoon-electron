// src/main/services/compositeProfile.ts
import { HistoricalDataLoader } from './historicalDataLoader';
import { VolumeProfileEngine, VolumeProfileLevels } from './volumeProfileEngine';

export interface CompositeLevels {
  instrumentUid: string;
  /** Основной POC (самый частый за период) */
  poc: number;
  /** Все повторяющиеся POC с частотой (price -> count) */
  recurringPocs: Map<number, number>;
  /** Свинг-уровни: зоны поддержки/сопротивления на основе HVN/LVN */
  swingHighs: number[];
  swingLows: number[];
  /** Усреднённые границы Value Area */
  avgVAHigh: number;
  avgVALow: number;
  /** Количество дней, использованных в композите */
  daysUsed: number;
}

export class CompositeProfileService {
  private cache = new Map<string, CompositeLevels>();

  constructor(
    private historicalLoader: HistoricalDataLoader,
    private profileEngine: VolumeProfileEngine,
    private defaultDays: number = 10
  ) {}

  /**
   * Строит композитный профиль за N дней.
   * Использует уже загруженные дневные профили через VolumeProfileEngine,
   * но для истории создаёт временные экземпляры движка.
   */
  async buildComposite(
    instrumentUid: string,
    days: number = this.defaultDays,
    token: string
  ): Promise<CompositeLevels | null> {
    const cacheKey = `${instrumentUid}_${days}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const profiles: VolumeProfileLevels[] = [];
    const now = new Date();
    // Загружаем последние N торговых дней (пропускаем выходные можно, но для простоты берём календарные дни)
    for (let d = 0; d < days; d++) {
      const date = new Date(now.getTime() - d * 86400000);
      const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0);
      const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 0, 0);

      try {
        // Загружаем часовые свечи за день (можно дневной профиль, но часовые точнее)
        const candles = await this.historicalLoader.loadIntradayCandles(
          instrumentUid,
          from,
          to,
          token,
          4 // CANDLE_INTERVAL_HOUR
        );
        if (!candles || candles.length === 0) continue;

        // Создаём временный движок без автоподписки
        const engine = new VolumeProfileEngine({
          profileResolution: 50,
          valueAreaPercent: 70,
          skipAutoSubscribe: true,
        });
        candles.forEach(c => engine.feedCandle(c));
        const profile = engine.getProfile(instrumentUid);
        if (profile) profiles.push(profile);
      } catch (err) {
        console.warn(`CompositeProfile: error loading day ${date.toISOString().slice(0,10)}`, err);
      }
    }

    if (profiles.length === 0) return null;

    // Агрегация POC: подсчитываем частоту каждого POC
    const pocFrequency = new Map<number, number>();
    let totalVAHigh = 0;
    let totalVALow = 0;
    const allHVN: number[] = [];
    const allLVN: number[] = [];

    for (const p of profiles) {
      const poc = p.poc;
      pocFrequency.set(poc, (pocFrequency.get(poc) || 0) + 1);
      totalVAHigh += p.valueAreaHigh;
      totalVALow += p.valueAreaLow;
      allHVN.push(...p.hvn);
      allLVN.push(...p.lvn);
    }

    // Основной POC — с максимальной частотой
    let mainPoc = profiles[0].poc;
    let maxCount = 0;
    pocFrequency.forEach((count, price) => {
      if (count > maxCount) {
        maxCount = count;
        mainPoc = price;
      }
    });

    // Свинг-уровни: кластеризуем HVN и LVN, чтобы найти ключевые уровни
    const swingHighs = this.clusterLevels(allHVN, 0.5); // 0.5% допуск
    const swingLows = this.clusterLevels(allLVN, 0.5);

    const result: CompositeLevels = {
      instrumentUid,
      poc: mainPoc,
      recurringPocs: pocFrequency,
      swingHighs,
      swingLows,
      avgVAHigh: totalVAHigh / profiles.length,
      avgVALow: totalVALow / profiles.length,
      daysUsed: profiles.length,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /** Простая кластеризация уровней: группирует близкие цены (±percent) */
  private clusterLevels(levels: number[], percent: number): number[] {
    if (levels.length === 0) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[] = [];
    let currentCluster: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = currentCluster[currentCluster.length - 1];
      if ((sorted[i] - prev) / prev <= percent / 100) {
        currentCluster.push(sorted[i]);
      } else {
        // Среднее значение кластера
        clusters.push(currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length);
        currentCluster = [sorted[i]];
      }
    }
    // Последний кластер
    clusters.push(currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length);
    return clusters;
  }

  /** Очистка кэша для инструмента */
  invalidateCache(instrumentUid?: string): void {
    if (instrumentUid) {
      // Удалить все ключи, начинающиеся с instrumentUid
      for (const key of this.cache.keys()) {
        if (key.startsWith(instrumentUid)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}