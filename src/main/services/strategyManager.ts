// src/main/services/strategyManager.ts
import { MarketPhaseDetector, MarketPhase } from './marketPhaseDetector';
import { CompositeProfileService } from './compositeProfile';
import { VolumeProfileEngine, VolumeProfileLevels } from './volumeProfileEngine';
import { OrderFlowEngine } from './orderFlowEngine';
import type { IBacktestStrategy } from './backtest/backtestEngine';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import { BacktestSignal } from './backtest/common';

interface StrategyEntry {
  name: string;
  factory: (uid: string, profile: VolumeProfileLevels | null) => IBacktestStrategy;
}

export class StrategyManager {
  private activeStrategies: IBacktestStrategy[] = [];
  private strategyRegistry = new Map<string, StrategyEntry>();
  private phaseMapping = new Map<MarketPhase, string[]>();

  constructor(
    private phaseDetector: MarketPhaseDetector,
    private compositeProfile: CompositeProfileService,
    private volumeProfile: VolumeProfileEngine,
    private orderFlow?: OrderFlowEngine
  ) {
    // Базовый маппинг фаз на имена стратегий (будет расширено после регистрации всех стратегий)
    this.phaseMapping.set(MarketPhase.BALANCE, ['daily_va_reversal', 'poc_pullback', 'volume_accumulation']);
    this.phaseMapping.set(MarketPhase.TREND_UP, ['trend_pro', 'rejection', 'anchored_vwap']);
    this.phaseMapping.set(MarketPhase.TREND_DOWN, ['trend_pro', 'rejection', 'anchored_vwap']);
    this.phaseMapping.set(MarketPhase.BREAKOUT, ['initial_balance', 'va_breakout_retest']);
    this.phaseMapping.set(MarketPhase.CHOP, []); // chop – не торгуем
  }

  /** Зарегистрировать стратегию в реестре */
  registerStrategy(name: string, factory: (uid: string, profile: VolumeProfileLevels | null) => IBacktestStrategy): void {
    this.strategyRegistry.set(name, { name, factory });
  }

  /** Обновить маппинг фаз → стратегии (можно вызывать из UI) */
  updatePhaseMapping(phase: MarketPhase, strategyNames: string[]): void {
    this.phaseMapping.set(phase, strategyNames);
  }

  /** Основной метод: вызывается при каждом новом баре или по таймеру */
  async update(instrumentUid: string): Promise<void> {
    const phase = await this.phaseDetector.detectPhase(instrumentUid);
    const strategyNames = this.phaseMapping.get(phase) || [];
    const profile = this.volumeProfile.getProfile(instrumentUid);

    this.activeStrategies = [];
    for (const name of strategyNames) {
      const entry = this.strategyRegistry.get(name);
      if (entry) {
        try {
          const strategy = entry.factory(instrumentUid, profile);
          this.activeStrategies.push(strategy);
        } catch (err) {
          console.warn(`StrategyManager: failed to create strategy ${name}`, err);
        }
      }
    }
  }

  /** Получить сигналы от всех активных стратегий для текущей свечи */
  evaluateSignals(candle: StreamCandle): BacktestSignal[] {
    const allSignals: BacktestSignal[] = [];
    for (const strategy of this.activeStrategies) {
      strategy.onCandle(candle);
      const signals = strategy.getSignals();
      allSignals.push(...signals);
      strategy.clearSignals();
    }
    return allSignals;
  }

  /** Получить текущую фазу (кешируется в MarketPhaseDetector) */
  getCurrentPhase(instrumentUid: string): Promise<MarketPhase> {
    return this.phaseDetector.detectPhase(instrumentUid);
  }

  /** Сброс активных стратегий (например, при смене дня) */
  reset(): void {
    this.activeStrategies.forEach(s => s.reset());
    this.activeStrategies = [];
  }
}