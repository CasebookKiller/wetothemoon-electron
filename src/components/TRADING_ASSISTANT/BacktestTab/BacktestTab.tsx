// src/components/TRADING_ASSISTANT/BacktestTab/BacktestTab.tsx

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';

interface BacktestTabProps {
  selectedInstrument: string;
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
  instrumentsLoading: boolean;
  loadAllInstruments: () => void;
  backtest: any;
  updateBacktest: (patch: any) => void;
  showBacktestAdvanced: boolean;
  setShowBacktestAdvanced: (v: boolean) => void;
  runBacktest: () => void;
  sendBacktestToSandbox: () => void;
  backtestCandlesData: any[];
  setSelectedInstrument: (v: string) => void;
}

export const BacktestTab: React.FC<BacktestTabProps> = ({
  selectedInstrument,
  availableInstruments,
  instrumentsLoading,
  loadAllInstruments,
  backtest,
  updateBacktest,
  showBacktestAdvanced,
  setShowBacktestAdvanced,
  runBacktest,
  sendBacktestToSandbox,
  backtestCandlesData,
  setSelectedInstrument
}) => {
  return (
    <Card className="surface-ground p-0">
      <div className="p-2">
        <div className="flex align-items-center flex-wrap gap-2">
          <label className="mr-1 mb-0">Instr</label>
          <Dropdown
            value={selectedInstrument}
            options={availableInstruments.map(i => ({ label: `${i.name} (${i.ticker})`, value: i.uid }))}
            //onChange={e => updateBacktest({ instrument: e.value })} // если нужно менять инструмент
            onChange={e => setSelectedInstrument(e.value)}
            placeholder="Select"
            filter
            className="p-inputtext-sm flex-1 mr-2"
            style={{ minWidth: '200px' }}
          />
          <Button icon="pi pi-refresh" onClick={loadAllInstruments} disabled={instrumentsLoading} className="p-button-sm p-button-secondary p-1 px-3 mr-2" />
          <Button label="Run" onClick={runBacktest} disabled={backtest.loading} className="p-button-sm border-round-sm p-1 px-3 mr-2" />
          <Button label="Send to Sandbox" onClick={sendBacktestToSandbox} disabled={!backtest.signals.length} className="p-button-sm p-button-warning border-round-sm p-1 px-3 mr-2" />
          <Button label={showBacktestAdvanced ? 'Hide Advanced' : 'Advanced'} onClick={() => setShowBacktestAdvanced(!showBacktestAdvanced)} className="p-button-sm p-button-secondary p-1 px-2" />
        </div>

        {showBacktestAdvanced && (
          <div className="flex align-items-center flex-wrap gap-2 mt-2">
            <label className="mr-1 mb-0">Int</label>
            <Dropdown value={backtest.interval} options={['1min','5min','15min','1hour']} onChange={e => updateBacktest({ interval: e.value })} className="p-inputtext-sm mr-2" style={{ width: '80px' }} />
            <label className="mr-1 mb-0">VA%</label>
            <InputNumber value={backtest.valueAreaPercent} onValueChange={e => updateBacktest({ valueAreaPercent: e.value ?? 70 })} min={50} max={90} step={5} size={2} className="mr-2" />
            <label className="mr-1 mb-0">Res</label>
            <InputNumber value={backtest.profileResolution} onValueChange={e => updateBacktest({ profileResolution: e.value ?? 50 })} min={10} max={200} step={10} size={2} className="mr-2" />
            <label className="mr-1 mb-0">Strat</label>
            <Dropdown value={backtest.strategyType} options={['volume_accumulation','trend','trend_pro','poc_pullback','daily_va_return','fvg_volume','rejection','initial_balance','va_breakout_retest','sfp','anchored_vwap','absorption','exhaustion']} onChange={e => updateBacktest({ strategyType: e.value })} className="p-inputtext-sm mr-2" style={{ width: '120px' }} />
            <label className="mr-1 mb-0">SL%</label>
            <InputNumber value={backtest.stopLossPercent} onValueChange={e => updateBacktest({ stopLossPercent: e.value ?? 0 })} step={0.1} min={0} size={2} className="mr-2" />
            <label className="mr-1 mb-0">TP%</label>
            <InputNumber value={backtest.takeProfitPercent} onValueChange={e => updateBacktest({ takeProfitPercent: e.value ?? 0 })} step={0.1} min={0} size={2} className="mr-2" />
            <label className="mr-1 mb-0">Trail%</label>
            <InputNumber value={backtest.trailingDistancePercent} onValueChange={e => updateBacktest({ trailingDistancePercent: e.value ?? 0 })} step={0.1} min={0} size={2} className="mr-2" />
            <label className="mr-1 mb-0">Lots</label>
            <InputNumber value={backtest.lots} onValueChange={e => updateBacktest({ lots: e.value ?? 1 })} min={1} step={1} size={2} className="mr-2" />
            <label className="mr-1 mb-0">Size</label>
            <Dropdown value={backtest.positionSizing} options={['fixed','dynamic']} onChange={e => updateBacktest({ positionSizing: e.value })} className="p-inputtext-sm mr-2" style={{ width: '100px' }} />
            {backtest.positionSizing === 'dynamic' && (
              <>
                <label className="mr-1 mb-0">Risk%</label>
                <InputNumber value={backtest.riskPercent} onValueChange={e => updateBacktest({ riskPercent: e.value ?? 1 })} step={0.1} min={0} size={2} className="mr-2" />
              </>
            )}
            <div className="flex align-items-center">
              <Checkbox checked={backtest.volumeFilterEnabled} onChange={e => updateBacktest({ volumeFilterEnabled: e.checked })} />
              <label className="ml-1 mr-2 mb-0">VolFilt</label>
              {backtest.volumeFilterEnabled && (
                <>
                  <label className="mr-1 mb-0">Per</label>
                  <InputNumber value={backtest.volumeFilterPeriod} onValueChange={e => updateBacktest({ volumeFilterPeriod: e.value ?? 20 })} min={5} max={100} step={5} size={2} className="mr-2" />
                </>
              )}
            </div>
          </div>
        )}

        {backtest.result?.stats && (
          <div className="mt-2">
            <div className="text-sm align-items-center" style={{ wordBreak: 'break-all' }}>
              Strategy: {backtest.strategyType} | Period: {backtest.dateFrom} – {backtest.dateTo} | Signals: {backtest.result.stats.totalSignals} | Trades: {backtest.result.stats.portfolio.totalTrades} (W: {backtest.result.stats.portfolio.winningTrades} / L: {backtest.result.stats.portfolio.losingTrades}) | WinRate: {backtest.result.stats.portfolio.winRate?.toFixed(1)}% | Profit: {backtest.result.stats.portfolio.totalProfit?.toFixed(2)} ({backtest.result.stats.portfolio.totalProfitPercent?.toFixed(2)}%) | MaxDD: {backtest.result.stats.portfolio.maxDrawdown?.toFixed(2)} ({backtest.result.stats.portfolio.maxDrawdownPercent?.toFixed(2)}%)
              <Button
                label="JSON"
                className="p-button-sm p-button-secondary ml-2 p-1 px-3"
                onClick={async () => {
                  if (!backtest.result) return;
                  const api = (window as any).electronAPI;
                  const data = {
                    strategy: backtest.strategyType,
                    period: `${backtest.dateFrom} – ${backtest.dateTo}`,
                    instrument: selectedInstrument,
                    params: { sl: backtest.stopLossPercent, tp: backtest.takeProfitPercent, trail: backtest.trailingDistancePercent, lots: backtest.lots, sizing: backtest.positionSizing, risk: backtest.riskPercent },
                    stats: backtest.result.stats,
                    trades: backtest.trades,
                  };
                  await api.saveJson(data, `backtest_${backtest.strategyType}_${backtest.dateFrom}.json`);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};