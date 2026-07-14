// src/components/TRADING_ASSISTANT/BatchTab/BatchTab.tsx

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { ProgressBar } from 'primereact/progressbar';

interface BatchTabProps {
  batchParams: any;
  setBatchParams: React.Dispatch<React.SetStateAction<any>>;
  batchInstruments: string[];
  setBatchInstruments: React.Dispatch<React.SetStateAction<string[]>>;
  batchResults: any[];
  batchRunning: boolean;
  batchStopping: boolean;
  batchProgress: { completed: number; total: number } | null;
  batchVersion: 'v1' | 'v2';
  setBatchVersion: React.Dispatch<React.SetStateAction<'v1' | 'v2'>>;
  showBatchDialog: boolean;
  setShowBatchDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showInstrumentDialog: boolean;
  setShowInstrumentDialog: React.Dispatch<React.SetStateAction<boolean>>;
  instrumentFilter: string;
  setInstrumentFilter: React.Dispatch<React.SetStateAction<string>>;
  tempSelectedInstruments: string[];
  setTempSelectedInstruments: React.Dispatch<React.SetStateAction<string[]>>;
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
  runBatch: () => void;
  stopBatch: () => void;
  exportCSV: () => void;
  backtest: any;
  stream: { token: string };
}

export const BatchTab: React.FC<BatchTabProps> = ({
  batchParams,
  setBatchParams,
  batchInstruments,
  setBatchInstruments,
  batchResults,
  batchRunning,
  batchStopping,
  batchProgress,
  batchVersion,
  setBatchVersion,
  showBatchDialog,
  setShowBatchDialog,
  showInstrumentDialog,
  setShowInstrumentDialog,
  instrumentFilter,
  setInstrumentFilter,
  tempSelectedInstruments,
  setTempSelectedInstruments,
  availableInstruments,
  runBatch,
  stopBatch,
  exportCSV,
  backtest,
  stream,
}) => {
  return (
    <Card className="surface-ground p-0">
      <div className="p-2">
        {/* Компактная строка управления */}
        <div className="flex align-items-center flex-wrap gap-2 mb-2">
          <Button
            label="Configure"
            icon="pi pi-cog"
            onClick={() => setShowBatchDialog(true)}
            className="p-button-sm p-button-secondary p-1 px-3"
          />
          <Button
            label={batchRunning ? 'Running...' : 'Run'}
            onClick={runBatch}
            disabled={batchRunning || batchStopping}
            className="p-button-sm p-1 px-3"
            icon={batchRunning ? 'pi pi-spin pi-spinner' : ''}
          />
          {batchRunning && (
            <Button
              label="Stop"
              onClick={stopBatch}
              disabled={batchStopping}
              className="p-button-sm p-button-danger p-1 px-3"
            />
          )}
          <Button
            label="Export CSV"
            onClick={exportCSV}
            disabled={batchResults.length === 0 || batchRunning}
            className="p-button-sm p-button-secondary p-1 px-3"
          />
          <Button
            label="JSON"
            className="p-button-sm p-button-secondary p-1 px-3"
            disabled={batchResults.length === 0}
            onClick={async () => {
              const api = (window as any).electronAPI;
              await api.saveJson(batchResults, `batch_results_${new Date().toISOString().slice(0,10)}.json`);
            }}
          />
          <span className="ml-2 text-sm">{batchInstruments.length} instrument(s) selected</span>
        </div>

        {/* Прогресс */}
        {batchProgress && (
          <div className="mb-2">
            <ProgressBar value={Math.round(batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0)} />
            <span className="ml-2">{batchProgress.completed} / {batchProgress.total}</span>
          </div>
        )}

        {/* Таблица результатов */}
        {batchResults.length > 0 && (
          <div style={{ maxHeight: '400px', overflowY: 'auto', color: '#d1d4dc' }}>
            <table className="p-datatable-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Instrument</th><th>SL%</th><th>TP%</th><th>Trail%</th><th>Lots</th>
                  <th>Sizing</th><th>Risk%</th><th>VolFilt</th><th>Period</th>
                  <th>Signals</th><th>Trades</th><th>WinRate</th><th>Profit</th><th>MaxDD</th><th>Capital</th>
                </tr>
              </thead>
              <tbody>
                {batchResults.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.instrumentUid.slice(0,8)}</td>
                    <td>{r.params.stopLossPercent}</td>
                    <td>{r.params.takeProfitPercent}</td>
                    <td>{r.params.trailingDistancePercent}</td>
                    <td>{r.params.lots}</td>
                    <td>{r.params.positionSizing}</td>
                    <td>{r.params.riskPercent}</td>
                    <td>{r.params.volumeFilterEnabled ? 'Y' : 'N'}</td>
                    <td>{r.params.volumeFilterPeriod}</td>
                    <td>{r.signals}</td>
                    <td>{r.stats.totalTrades}</td>
                    <td>{r.stats.winRate?.toFixed(1)}%</td>
                    <td>{r.stats.totalProfit?.toFixed(2)}</td>
                    <td>{r.stats.maxDrawdown?.toFixed(2)}</td>
                    <td>{r.stats.initialCapital}→{r.stats.finalCapital?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Диалог конфигурации Batch */}
      <Dialog
        header="Batch Configuration"
        visible={showBatchDialog}
        style={{ width: '750px', maxHeight: '90vh' }}
        onHide={() => setShowBatchDialog(false)}
      >
        <div className="p-fluid">
          {/* Выбор инструментов */}
          <div className="p-field mb-3">
            <label>Instruments</label>
            <div className="p-inputgroup">
              <InputText value={`${batchInstruments.length} selected`} readOnly className="p-inputtext-sm" />
              <Button icon="pi pi-search" onClick={() => setShowInstrumentDialog(true)} className="p-button-secondary p-button-sm" />
            </div>
            {batchInstruments.length > 0 && (
              <small className="mt-1" style={{ color: '#888' }}>
                {batchInstruments.map(uid => {
                  const inst = availableInstruments.find(i => i.uid === uid);
                  return inst ? inst.ticker || inst.name : uid;
                }).join(', ')}
              </small>
            )}
          </div>

          {/* Версия */}
          <div className="p-field mb-3">
            <label>Batch Version</label>
            <Dropdown
              value={batchVersion}
              options={['v1', 'v2']}
              onChange={e => setBatchVersion(e.value)}
              className="p-inputtext-sm"
            />
          </div>

          {/* Strategy */}
          <div className="p-field mb-3">
            <label>Strategy</label>
            <Dropdown
              value={batchParams.strategyType}
              options={[
                'volume_accumulation', 'trend', 'trend_pro', 'poc_pullback',
                'daily_va_return', 'fvg_volume', 'rejection', 'initial_balance',
                'va_breakout_retest', 'sfp', 'anchored_vwap', 'absorption', 'exhaustion',
              ]}
              onChange={e => setBatchParams({ ...batchParams, strategyType: e.value })}
              className="p-inputtext-sm"
            />
          </div>

          {/* Interval */}
          <div className="p-field mb-3">
            <label>Interval</label>
            <Dropdown
              value={batchParams.interval}
              options={[
                { label: '1 min', value: 'CANDLE_INTERVAL_1_MIN' },
                { label: '5 min', value: 'CANDLE_INTERVAL_5_MIN' },
                { label: '1 hour', value: 'CANDLE_INTERVAL_HOUR' },
              ]}
              onChange={e => setBatchParams({ ...batchParams, interval: e.value })}
              className="p-inputtext-sm"
            />
          </div>

          {/* Size & Risk */}
          <div className="p-field mb-3">
            <label>Position Sizing</label>
            <div className="flex align-items-center gap-2">
              <Dropdown
                value={batchParams.positionSizing}
                options={['fixed', 'dynamic']}
                onChange={e => setBatchParams({ ...batchParams, positionSizing: e.value })}
                className="p-inputtext-sm"
                style={{ width: '120px' }}
              />
              {batchParams.positionSizing === 'dynamic' && (
                <>
                  <label className="ml-2">Risk%:</label>
                  <InputText
                    value={batchParams.riskPercent.toString()}
                    onChange={e => setBatchParams({ ...batchParams, riskPercent: Number(e.target.value) })}
                    className="p-inputtext-sm"
                    style={{ width: '100px' }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Vol Filter */}
          <div className="p-field mb-3">
            <div className="flex align-items-center gap-2">
              <Checkbox
                checked={batchParams.volumeFilterEnabled}
                onChange={e => setBatchParams({ ...batchParams, volumeFilterEnabled: e.checked ?? false })}
              />
              <label>Volume Filter</label>
              {batchParams.volumeFilterEnabled && (
                <InputText
                  value={batchParams.volumeFilterPeriod.toString()}
                  onChange={e => setBatchParams({ ...batchParams, volumeFilterPeriod: Number(e.target.value) })}
                  placeholder="Period"
                  className="p-inputtext-sm"
                  style={{ width: '100px' }}
                />
              )}
            </div>
          </div>

          {/* SL, TP, Trail, Lots */}
          {['sl', 'tp', 'trail', 'lots'].map((type) => (
            <div className="p-field mb-3" key={type}>
              <label>{type.toUpperCase()} % (Lots for Lots)</label>
              <div className="p-inputgroup">
                <Dropdown
                  value={(batchParams as any)[`${type}Mode`]}
                  options={['manual', 'range']}
                  onChange={e => setBatchParams({ ...batchParams, [`${type}Mode`]: e.value })}
                  className="p-inputtext-sm"
                  style={{ width: '110px' }}
                />
                {(batchParams as any)[`${type}Mode`] === 'manual' ? (
                  <InputText
                    value={(batchParams as any)[`${type}Values`]}
                    onChange={e => setBatchParams({ ...batchParams, [`${type}Values`]: e.target.value })}
                    className="p-inputtext-sm"
                    placeholder={type === 'lots' ? '10' : '1,1.5,2'}
                  />
                ) : (
                  <>
                    <InputText
                      value={(batchParams as any)[`${type}Min`].toString()}
                      onChange={e => setBatchParams({ ...batchParams, [`${type}Min`]: Number(e.target.value) })}
                      placeholder="Min"
                      style={{ width: '70px' }}
                      className="p-inputtext-sm"
                    />
                    <InputText
                      value={(batchParams as any)[`${type}Max`].toString()}
                      onChange={e => setBatchParams({ ...batchParams, [`${type}Max`]: Number(e.target.value) })}
                      placeholder="Max"
                      style={{ width: '70px' }}
                      className="p-inputtext-sm"
                    />
                    <InputText
                      value={(batchParams as any)[`${type}Step`].toString()}
                      onChange={e => setBatchParams({ ...batchParams, [`${type}Step`]: Number(e.target.value) })}
                      placeholder="Step"
                      style={{ width: '70px' }}
                      className="p-inputtext-sm"
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Dialog>

      {/* Диалог выбора инструментов */}
      <Dialog
        header="Выбор инструментов для Batch"
        visible={showInstrumentDialog}
        style={{ width: '450px', maxHeight: '600px' }}
        onHide={() => setShowInstrumentDialog(false)}
        footer={
          <div className="p-d-flex p-jc-end p-gap-2">
            <Button label="Отмена" onClick={() => setShowInstrumentDialog(false)} className="p-button-sm p-button-secondary" />
            <Button label="Применить" onClick={() => {
              setBatchInstruments(tempSelectedInstruments);
              setShowInstrumentDialog(false);
            }} className="p-button-sm" />
          </div>
        }
      >
        <div className="p-mb-2">
          <InputText
            placeholder="Поиск инструмента..."
            value={instrumentFilter}
            onChange={e => setInstrumentFilter(e.target.value)}
            className="p-inputtext-sm"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ maxHeight: '350px', overflowY: 'auto', color: '#d1d4dc' }}>
          {availableInstruments
            .filter(inst => inst.name.toLowerCase().includes(instrumentFilter.toLowerCase()) || inst.ticker?.toLowerCase().includes(instrumentFilter.toLowerCase()))
            .map(inst => (
              <div key={inst.uid} className="p-field-checkbox p-mb-1">
                <Checkbox
                  inputId={`inst-${inst.uid}`}
                  checked={tempSelectedInstruments.includes(inst.uid)}
                  onChange={(e) => {
                    if (e.checked) {
                      setTempSelectedInstruments(prev => [...prev, inst.uid]);
                    } else {
                      setTempSelectedInstruments(prev => prev.filter(id => id !== inst.uid));
                    }
                  }}
                  className='mr-1'
                />
                <label htmlFor={`inst-${inst.uid}`}>{inst.name} ({inst.ticker})</label>
              </div>
            ))}
        </div>
      </Dialog>
    </Card>
  );
};