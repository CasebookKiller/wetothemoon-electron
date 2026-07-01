// src/main/services/strategyManager.ts
import { MarketPhaseDetector, MarketPhase } from './marketPhaseDetector';
import { CompositeProfileService } from './compositeProfile';
import { VolumeProfileEngine, VolumeProfileLevels } from './volumeProfileEngine';
import { OrderFlowEngine } from './orderFlowEngine';
import type { IBacktestStrategy } from './backtest/backtestEngine';
import type { StreamCandle } from '@/api/tbank/marketdataStreamTypes';
import { BacktestSignal } from './backtest/common';
import { createStrategy, getAvailableStrategies } from './backtest/strategies/strategyFactory';

export class StrategyManager {
  private activeStrategies: IBacktestStrategy[] = [];
  private phaseMapping = new Map<MarketPhase, string[]>();

  constructor(
    private phaseDetector: MarketPhaseDetector,
    private compositeProfile: CompositeProfileService,
    private volumeProfile: VolumeProfileEngine,
    private orderFlow?: OrderFlowEngine
  ) {
    // Стандартный маппинг (можно изменить из UI)
    this.phaseMapping.set(MarketPhase.BALANCE, ['daily_va_return', 'poc_pullback', 'volume_accumulation']);
    this.phaseMapping.set(MarketPhase.TREND_UP, ['trend_pro', 'rejection', 'anchored_vwap']);
    this.phaseMapping.set(MarketPhase.TREND_DOWN, ['trend_pro', 'rejection', 'anchored_vwap']);
    this.phaseMapping.set(MarketPhase.BREAKOUT, ['initial_balance', 'va_breakout_retest']);
    this.phaseMapping.set(MarketPhase.CHOP, []);
  }

  updatePhaseMapping(phase: MarketPhase, strategyNames: string[]): void {
    this.phaseMapping.set(phase, strategyNames);
  }

  async update(instrumentUid: string): Promise<void> {
    const phase = await this.phaseDetector.detectPhase(instrumentUid);
    const strategyNames = this.phaseMapping.get(phase) || [];
    const profile = this.volumeProfile.getProfile(instrumentUid);

    this.activeStrategies = [];
    for (const name of strategyNames) {
      try {
        const strategy = createStrategy(name, instrumentUid, profile, this.orderFlow);
        this.activeStrategies.push(strategy);
      } catch (err) {
        console.warn(`StrategyManager: failed to create strategy ${name}`, err);
      }
    }
  }

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

  getCurrentPhase(instrumentUid: string): Promise<MarketPhase> {
    return this.phaseDetector.detectPhase(instrumentUid);
  }

  getAvailableStrategies(): string[] {
    return getAvailableStrategies();
  }

  public getActiveStrategies(): string[] {
    return this.activeStrategies.map(s => s.constructor.name);
  }

  reset(): void {
    this.activeStrategies.forEach(s => s.reset());
    this.activeStrategies = [];
  }
}