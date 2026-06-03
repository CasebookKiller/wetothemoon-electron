import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { ProgressBar } from 'primereact/progressbar';

interface Props {
  batchInstruments: string[];
  setBatchInstruments: (uids: string[]) => void;
  batchParams: any;
  setBatchParams: any;
  batchResults: any[];
  batchProgress: { completed: number; total: number } | null;
  runBatch: () => void;
  exportCSV: () => void;
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
  batchRunning: boolean;
  backtest: any;
}

export const BatchTab: React.FC<Props> = ({
  batchInstruments,
  setBatchInstruments,
  batchParams,
  setBatchParams,
  batchResults,
  batchProgress,
  runBatch,
  exportCSV,
  availableInstruments,
  batchRunning,
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>([]);

  const filtered = availableInstruments.filter(
    inst => inst.name.toLowerCase().includes(filterText.toLowerCase()) || inst.ticker?.toLowerCase().includes(filterText.toLowerCase())
  );

  const toggleInstrument = (uid: string) => {
    if (tempSelected.includes(uid)) {
      setTempSelected(tempSelected.filter(id => id !== uid));
    } else {
      setTempSelected([...tempSelected, uid]);
    }
  };

  const percent = batchProgress ? (batchProgress.completed / batchProgress.total) * 100 : 0;

  return (
    <Card title="Batch Backtest" className="surface-ground">
      <div className="p-fluid p-formgrid p-grid">
        {/* Выбор инструментов */}
        <div className="p-field p-col-12 p-md-6">
          <label>Instruments</label>
          <div className="p-inputgroup">
            <InputText value={`${batchInstruments.length} selected`} readOnly />
            <Button icon="pi pi-search" onClick={() => {
              setTempSelected([...batchInstruments]);
              setShowDialog(true);
            }} className="p-button-secondary" />
          </div>
          {batchInstruments.length > 0 && (
            <small className="p-mt-1" style={{ color: '#888' }}>
              {batchInstruments.map(uid => {
                const inst = availableInstruments.find(i => i.uid === uid);
                return inst ? inst.ticker || inst.name : uid;
              }).join(', ')}
            </small>
          )}
        </div>

        {/* Режим SL */}
        <div className="p-field p-col-12 p-md-6">
          <label>SL %</label>
          <div className="p-inputgroup">
            <select
              value={batchParams.slMode}
              onChange={e => setBatchParams({ ...batchParams, slMode: e.target.value })}
              style={{ width: '100px' }}
            >
              <option value="manual">Ручной</option>
              <option value="range">Диапазон</option>
            </select>
            {batchParams.slMode === 'manual' ? (
              <InputText
                value={batchParams.slValues}
                onChange={e => setBatchParams({ ...batchParams, slValues: e.target.value })}
                placeholder="1,1.5,2"
              />
            ) : (
              <>
                <InputText
                  value={batchParams.slMin}
                  onChange={e => setBatchParams({ ...batchParams, slMin: e.target.value })}
                  placeholder="Мин"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.slMax}
                  onChange={e => setBatchParams({ ...batchParams, slMax: e.target.value })}
                  placeholder="Макс"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.slStep}
                  onChange={e => setBatchParams({ ...batchParams, slStep: e.target.value })}
                  placeholder="Шаг"
                  style={{ width: '80px' }}
                />
              </>
            )}
          </div>
        </div>

        {/* Режим TP */}
        <div className="p-field p-col-12 p-md-6">
          <label>TP %</label>
          <div className="p-inputgroup">
            <select
              value={batchParams.tpMode}
              onChange={e => setBatchParams({ ...batchParams, tpMode: e.target.value })}
              style={{ width: '100px' }}
            >
              <option value="manual">Ручной</option>
              <option value="range">Диапазон</option>
            </select>
            {batchParams.tpMode === 'manual' ? (
              <InputText
                value={batchParams.tpValues}
                onChange={e => setBatchParams({ ...batchParams, tpValues: e.target.value })}
                placeholder="2,3,4"
              />
            ) : (
              <>
                <InputText
                  value={batchParams.tpMin}
                  onChange={e => setBatchParams({ ...batchParams, tpMin: e.target.value })}
                  placeholder="Мин"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.tpMax}
                  onChange={e => setBatchParams({ ...batchParams, tpMax: e.target.value })}
                  placeholder="Макс"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.tpStep}
                  onChange={e => setBatchParams({ ...batchParams, tpStep: e.target.value })}
                  placeholder="Шаг"
                  style={{ width: '80px' }}
                />
              </>
            )}
          </div>
        </div>

        {/* Режим Trail */}
        <div className="p-field p-col-12 p-md-6">
          <label>Trail %</label>
          <div className="p-inputgroup">
            <select
              value={batchParams.trailMode}
              onChange={e => setBatchParams({ ...batchParams, trailMode: e.target.value })}
              style={{ width: '100px' }}
            >
              <option value="manual">Ручной</option>
              <option value="range">Диапазон</option>
            </select>
            {batchParams.trailMode === 'manual' ? (
              <InputText
                value={batchParams.trailValues}
                onChange={e => setBatchParams({ ...batchParams, trailValues: e.target.value })}
                placeholder="0.5,1"
              />
            ) : (
              <>
                <InputText
                  value={batchParams.trailMin}
                  onChange={e => setBatchParams({ ...batchParams, trailMin: e.target.value })}
                  placeholder="Мин"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.trailMax}
                  onChange={e => setBatchParams({ ...batchParams, trailMax: e.target.value })}
                  placeholder="Макс"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.trailStep}
                  onChange={e => setBatchParams({ ...batchParams, trailStep: e.target.value })}
                  placeholder="Шаг"
                  style={{ width: '80px' }}
                />
              </>
            )}
          </div>
        </div>

        {/* Режим Lots */}
        <div className="p-field p-col-12 p-md-6">
          <label>Lots</label>
          <div className="p-inputgroup">
            <select
              value={batchParams.lotsMode}
              onChange={e => setBatchParams({ ...batchParams, lotsMode: e.target.value })}
              style={{ width: '100px' }}
            >
              <option value="manual">Ручной</option>
              <option value="range">Диапазон</option>
            </select>
            {batchParams.lotsMode === 'manual' ? (
              <InputText
                value={batchParams.lotsValues}
                onChange={e => setBatchParams({ ...batchParams, lotsValues: e.target.value })}
                placeholder="10"
              />
            ) : (
              <>
                <InputText
                  value={batchParams.lotsMin}
                  onChange={e => setBatchParams({ ...batchParams, lotsMin: e.target.value })}
                  placeholder="Мин"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.lotsMax}
                  onChange={e => setBatchParams({ ...batchParams, lotsMax: e.target.value })}
                  placeholder="Макс"
                  style={{ width: '80px' }}
                />
                <InputText
                  value={batchParams.lotsStep}
                  onChange={e => setBatchParams({ ...batchParams, lotsStep: e.target.value })}
                  placeholder="Шаг"
                  style={{ width: '80px' }}
                />
              </>
            )}
          </div>
        </div>

        {/* Position Sizing */}
        <div className="p-field p-col-6 p-md-3">
          <label>Size</label>
          <select
            value={batchParams.positionSizing}
            onChange={e => setBatchParams({ ...batchParams, positionSizing: e.target.value })}
            style={{ width: '100%' }}
          >
            <option value="fixed">Fixed</option>
            <option value="dynamic">Dynamic</option>
          </select>
        </div>
        {batchParams.positionSizing === 'dynamic' && (
          <div className="p-field p-col-6 p-md-3">
            <label>Risk %</label>
            <InputText
              value={batchParams.riskPercent}
              onChange={e => setBatchParams({ ...batchParams, riskPercent: e.target.value })}
              placeholder="1"
            />
          </div>
        )}

        {/* Volume Filter */}
        <div className="p-field p-col-12 p-md-4 p-d-flex p-ai-center">
          <Checkbox
            checked={batchParams.volumeFilterEnabled}
            onChange={e => setBatchParams({ ...batchParams, volumeFilterEnabled: e.checked })}
          />
          <label className="p-ml-2">Vol Filter</label>
          {batchParams.volumeFilterEnabled && (
            <InputText
              value={batchParams.volumeFilterPeriod}
              onChange={e => setBatchParams({ ...batchParams, volumeFilterPeriod: e.target.value })}
              placeholder="Period"
              style={{ width: '80px', marginLeft: '8px' }}
            />
          )}
        </div>

        {/* Strategy */}
        <div className="p-field p-col-12 p-md-4">
          <label>Strategy</label>
          <select
            value={batchParams.strategyType}
            onChange={e => setBatchParams({ ...batchParams, strategyType: e.target.value })}
            style={{ width: '100%' }}
          >
            <option value="volume_accumulation">Vol Accum</option>
            <option value="trend">Trend</option>
          </select>
        </div>

        {/* Кнопки */}
        <div className="p-field p-col-12 p-md-4 p-d-flex p-ai-end">
          <Button label="Run Batch" onClick={runBatch} disabled={batchRunning} className="p-mr-2" />
          <Button label="Export CSV" onClick={exportCSV} disabled={batchResults.length === 0} className="p-button-secondary" />
        </div>
      </div>

      {/* Прогресс */}
      {batchProgress && (
        <div className="p-mt-3">
          <ProgressBar value={percent} />
          <span className="p-ml-2">{batchProgress.completed} / {batchProgress.total}</span>
        </div>
      )}

      {/* Диалог выбора инструментов */}
      <Dialog header="Select Instruments" visible={showDialog} style={{ width: '450px' }} onHide={() => setShowDialog(false)}>
        <InputText placeholder="Filter..." value={filterText} onChange={e => setFilterText(e.target.value)} className="p-mb-2" />
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {filtered.map(inst => (
            <div key={inst.uid} className="p-field-checkbox p-mb-1">
              <Checkbox
                inputId={`inst-${inst.uid}`}
                checked={tempSelected.includes(inst.uid)}
                onChange={() => toggleInstrument(inst.uid)}
              />
              <label htmlFor={`inst-${inst.uid}`}>{inst.name} ({inst.ticker})</label>
            </div>
          ))}
        </div>
        <div className="p-d-flex p-jc-end p-mt-2">
          <Button label="Cancel" onClick={() => setShowDialog(false)} className="p-button-text p-mr-2" />
          <Button label="Apply" onClick={() => {
            setBatchInstruments(tempSelected);
            setShowDialog(false);
          }} />
        </div>
      </Dialog>

      {/* Таблица результатов */}
      {batchResults.length > 0 && (
        <div className="p-mt-3">
          <Card subTitle="Results">
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
          </Card>
        </div>
      )}
    </Card>
  );
};