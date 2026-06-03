import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';

interface BacktestSignal {
  type: 'BUY' | 'SELL';
  price: number;
  time: string;
  instrumentUid: string;
  reason: string;
}

interface Props {
  backtest: any;
  updateBacktest: (patch: any) => void;
  runBacktest: () => void;
  sendBacktestToSandbox: () => void;
  selectedInstrument: string;
  setSelectedInstrument: (uid: string) => void;
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
  loadAllInstruments: () => void;
  instrumentsLoading: boolean;
}

export const BacktestTab: React.FC<Props> = ({
  backtest,
  updateBacktest,
  runBacktest,
  sendBacktestToSandbox,
  selectedInstrument,
  setSelectedInstrument,
  availableInstruments,
  loadAllInstruments,
  instrumentsLoading,
}) => {
  const stats = backtest.result?.stats;
  const portfolio = stats?.portfolio;
  const sizingStr = backtest.positionSizing === 'dynamic'
    ? `Dynamic (Risk ${backtest.riskPercent}%)`
    : 'Fixed';

  const copyText = [
    `Instrument: ${availableInstruments.find((inst: any) => inst.uid === selectedInstrument)?.name}`,
    `Strategy: ${backtest.strategyType === 'trend' ? 'Trend' : 'Volume Accum'}`,
    `Period: ${backtest.dateFrom} – ${backtest.dateTo}`,
    `Signals: ${stats?.totalSignals}`,
    `Trades: ${portfolio?.totalTrades} (W: ${portfolio?.winningTrades} / L: ${portfolio?.losingTrades})`,
    `WinRate: ${portfolio?.winRate?.toFixed(1)}%`,
    `Profit: ${portfolio?.totalProfit?.toFixed(2)} (${portfolio?.totalProfitPercent?.toFixed(2)}%)`,
    `MaxDD: ${portfolio?.maxDrawdown?.toFixed(2)} (${portfolio?.maxDrawdownPercent?.toFixed(2)}%)`,
    portfolio?.initialCapital ? `Capital: ${portfolio.initialCapital} → ${portfolio.finalCapital?.toFixed(2)}` : '',
    `Lots: ${backtest.lots}`,
    `SL: ${backtest.stopLossPercent}%`,
    `TP: ${backtest.takeProfitPercent}%`,
    `Trail: ${backtest.trailingDistancePercent}%`,
    `Sizing: ${sizingStr}`,
  ].filter(Boolean).join(' | ');

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText);
  };

  return (
    <Card title="Backtest" className="surface-ground">
      <div className="p-fluid p-formgrid p-grid">
        <div className="p-field p-col-12 p-md-4">
          <label>Instrument</label>
          <Dropdown
            value={selectedInstrument}
            options={availableInstruments.map(inst => ({ label: `${inst.name} (${inst.ticker})`, value: inst.uid }))}
            onChange={e => setSelectedInstrument(e.value)}
            placeholder="Select instrument"
            filter
          />
        </div>
        <div className="p-field p-col-6 p-md-2 p-d-flex p-ai-end">
          <Button icon="pi pi-refresh" onClick={loadAllInstruments} disabled={instrumentsLoading} className="p-button-secondary" />
        </div>
        <div className="p-field p-col-6 p-md-3">
          <label>From</label>
          <InputText type="date" value={backtest.dateFrom} onChange={e => updateBacktest({ dateFrom: e.target.value })} />
        </div>
        <div className="p-field p-col-6 p-md-3">
          <label>To</label>
          <InputText type="date" value={backtest.dateTo} onChange={e => updateBacktest({ dateTo: e.target.value })} />
        </div>
        <div className="p-field p-col-6 p-md-2">
          <label>Interval</label>
          <Dropdown value={backtest.interval} options={['1min', '5min', '15min', '1hour']} onChange={e => updateBacktest({ interval: e.value })} />
        </div>
        <div className="p-field p-col-6 p-md-2">
          <label>VA %</label>
          <InputNumber value={backtest.valueAreaPercent} onValueChange={e => updateBacktest({ valueAreaPercent: e.value })} min={50} max={90} step={5} />
        </div>
        <div className="p-field p-col-6 p-md-2">
          <label>Res</label>
          <InputNumber value={backtest.profileResolution} onValueChange={e => updateBacktest({ profileResolution: e.value })} min={10} max={200} step={10} />
        </div>
        <div className="p-field p-col-6 p-md-3">
          <label>Strategy</label>
          <Dropdown value={backtest.strategyType} options={['volume_accumulation', 'trend']} onChange={e => updateBacktest({ strategyType: e.value })} />
        </div>
        <div className="p-field p-col-4 p-md-2">
          <label>SL %</label>
          <InputNumber value={backtest.stopLossPercent} onValueChange={e => updateBacktest({ stopLossPercent: e.value })} step={0.1} min={0} />
        </div>
        <div className="p-field p-col-4 p-md-2">
          <label>TP %</label>
          <InputNumber value={backtest.takeProfitPercent} onValueChange={e => updateBacktest({ takeProfitPercent: e.value })} step={0.1} min={0} />
        </div>
        <div className="p-field p-col-4 p-md-2">
          <label>Trail %</label>
          <InputNumber value={backtest.trailingDistancePercent} onValueChange={e => updateBacktest({ trailingDistancePercent: e.value })} step={0.1} min={0} />
        </div>
        <div className="p-field p-col-6 p-md-2">
          <label>Lots</label>
          <InputNumber value={backtest.lots} onValueChange={e => updateBacktest({ lots: e.value })} min={1} step={1} />
        </div>
        <div className="p-field p-col-6 p-md-3">
          <label>Size</label>
          <Dropdown value={backtest.positionSizing} options={['fixed', 'dynamic']} onChange={e => updateBacktest({ positionSizing: e.value })} />
        </div>
        {backtest.positionSizing === 'dynamic' && (
          <div className="p-field p-col-6 p-md-2">
            <label>Risk %</label>
            <InputNumber value={backtest.riskPercent} onValueChange={e => updateBacktest({ riskPercent: e.value })} step={0.1} min={0} />
          </div>
        )}
        <div className="p-field p-col-6 p-md-2">
          <label>Vol Filter</label>
          <Checkbox checked={backtest.volumeFilterEnabled} onChange={e => updateBacktest({ volumeFilterEnabled: e.checked })} />
        </div>
        {backtest.volumeFilterEnabled && (
          <div className="p-field p-col-6 p-md-2">
            <label>Period</label>
            <InputNumber value={backtest.volumeFilterPeriod} onValueChange={e => updateBacktest({ volumeFilterPeriod: e.value })} min={5} max={100} step={5} />
          </div>
        )}
        <div className="p-field p-col-12 p-md-2 p-d-flex p-ai-end">
          <Button label="Run" onClick={runBacktest} disabled={backtest.loading} className="p-button-primary p-mr-2" />
          <Button label="Send to Sandbox" onClick={sendBacktestToSandbox} disabled={!backtest.signals.length} className="p-button-warning" />
        </div>
      </div>

      {stats && portfolio && (
        <div className="p-mt-3">
          <Card subTitle="Backtest Results">
            <p style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
              Instrument: {availableInstruments.find((inst: any) => inst.uid === selectedInstrument)?.name}
              {' | '}Strategy: {backtest.strategyType === 'trend' ? 'Trend' : 'Volume Accum'}
              {' | '}Period: {backtest.dateFrom} – {backtest.dateTo}
              {' | '}Signals: {stats.totalSignals}
              {' | '}Trades: {portfolio.totalTrades}
              (W: {portfolio.winningTrades} / L: {portfolio.losingTrades})
              {' | '}WinRate: {portfolio.winRate?.toFixed(1)}%
              {' | '}Profit: <span className={portfolio.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                {portfolio.totalProfit?.toFixed(2)} ({portfolio.totalProfitPercent?.toFixed(2)}%)
              </span>
              {' | '}MaxDD: {portfolio.maxDrawdown?.toFixed(2)} ({portfolio.maxDrawdownPercent?.toFixed(2)}%)
              {portfolio.initialCapital && (
                <> | Capital: {portfolio.initialCapital} → {portfolio.finalCapital?.toFixed(2)}</>
              )}
              {' | '}Lots: {backtest.lots}
              {' | '}SL: {backtest.stopLossPercent}%
              {' | '}TP: {backtest.takeProfitPercent}%
              {' | '}Trail: {backtest.trailingDistancePercent}%
              {' | '}Sizing: {sizingStr}
            </p>
          </Card>
        </div>
      )}
    </Card>
  );
};