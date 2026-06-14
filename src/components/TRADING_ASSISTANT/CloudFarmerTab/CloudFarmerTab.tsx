import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { InputNumber } from 'primereact/inputnumber';
import { Dialog } from 'primereact/dialog';

interface BatchResult {
  batchId: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  results?: any[];
  dateFrom?: string;
  dateTo?: string;
  strategy?: string;
  params?: any;
  interval?: string;
  error?: string;
}

interface Props {
  token: string;
  batches: BatchResult[];
  setBatches: React.Dispatch<React.SetStateAction<BatchResult[]>>;
  farmerInstruments?: string[];
  setFarmerInstruments?: React.Dispatch<React.SetStateAction<string[]>>;
}

export const CloudFarmerTab: React.FC<Props> = ({ token, batches, setBatches, farmerInstruments, setFarmerInstruments }) => {
  const [serverUrl, setServerUrl] = useState('http://192.144.14.181:8000');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [availableInstruments, setAvailableInstruments] = useState<Array<{ uid: string; name: string; ticker?: string }>>([]);
  const [showInstrumentDialog, setShowInstrumentDialog] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>([]);

  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [intervalValue, setIntervalValue] = useState('CANDLE_INTERVAL_1_MIN'); // переименовали

  const [lots, setLots] = useState(1);
  
  // Если выбрано больше 5 дней, автоматически переключаемся на 5-минутные свечи
  useEffect(() => {
    const daysDiff = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000);
    if (daysDiff > 5 && intervalValue === 'CANDLE_INTERVAL_1_MIN') {
      //setIntervalValue('CANDLE_INTERVAL_5_MIN');
    }
  }, [dateFrom, dateTo, intervalValue]);
  const [strategy, setStrategy] = useState('volume_accumulation');
  const [stopLoss, setStopLoss] = useState(0.5);
  const [takeProfit, setTakeProfit] = useState(1.0);
  const [trailing, setTrailing] = useState(false);
  const [trailingPercent, setTrailingPercent] = useState(1.0);
  const [dynamicSizing, setDynamicSizing] = useState(false);
  const [riskAmount, setRiskAmount] = useState(1000);

  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [slMin, setSlMin] = useState(1);
  const [slMax, setSlMax] = useState(2);
  const [slStep, setSlStep] = useState(0.5);
  const [tpMin, setTpMin] = useState(2);
  const [tpMax, setTpMax] = useState(4);
  const [tpStep, setTpStep] = useState(1);
  const [trailMin, setTrailMin] = useState(0.5);
  const [trailMax, setTrailMax] = useState(1);
  const [trailStep, setTrailStep] = useState(0.5);
  const [lotsMin, setLotsMin] = useState(10);
  const [lotsMax, setLotsMax] = useState(20);
  const [lotsStep, setLotsStep] = useState(10);
  const [riskMin, setRiskMin] = useState(1);
  const [riskMax, setRiskMax] = useState(2);
  const [riskStep, setRiskStep] = useState(0.5);
  const [useGrid, setUseGrid] = useState(false);

  const [useVolumeFilter, setUseVolumeFilter] = useState(false);
  const [volPeriod, setVolPeriod] = useState(20);           // фиксированное значение, если сетка не используется
  const [volPeriodMin, setVolPeriodMin] = useState(5);
  const [volPeriodMax, setVolPeriodMax] = useState(50);
  const [volPeriodStep, setVolPeriodStep] = useState(5);

  // Загрузка списка инструментов
  const loadInstruments = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getAllInstruments) return;
    const list = await api.getAllInstruments(token);
    setAvailableInstruments(list || []);
  };

  useEffect(() => {
    if (farmerInstruments && farmerInstruments.length > 0) {
      setInstruments(farmerInstruments);
      setFarmerInstruments?.([]); // сбросить, чтобы повторно не устанавливались
    }
  }, [farmerInstruments]);

  useEffect(() => {
    if (token) loadInstruments();
  }, [token]);

  // Загрузка batch'ей с сервера при монтировании
  useEffect(() => {
    const loadBatches = async () => {
      const api = (window as any).electronAPI;
      if (!api?.cloudGetBatches) return;
      const data = await api.cloudGetBatches(serverUrl);
      if (!Array.isArray(data)) return;

      // Для каждого batch'а получаем подробный статус (особенно для failed)
      const detailed = await Promise.all(
        data.map(async (b: any) => {
          const base = {
            batchId: b.id,
            status: b.status,
            total: 0, completed: 0, failed: 0,
            dateFrom: b.params?.dateFrom,
            dateTo: b.params?.dateTo,
            strategy: b.params?.strategy,
            params: b.params?.params || b.params,
            interval: b.params?.interval,
            error: undefined,
          };

          if (b.status === 'failed' || b.status === 'completed') {
            try {
              const statusData = await api.cloudGetBatchStatus(serverUrl, b.id);
              const tasks = statusData?.tasks || [];
              const failedTask = tasks.find((t: any) => t.status === 'failed');
              base.error = failedTask?.error || null;
              base.completed = tasks.filter((t: any) => t.status === 'completed').length;
              base.failed = tasks.filter((t: any) => t.status === 'failed').length;
              base.total = tasks.length;
            } catch (e) { /* оставляем как есть */ }
          }
          return base;
        })
      );

      setBatches(detailed);
    };

    if (serverUrl) loadBatches();
  }, [serverUrl, setBatches]);

  // Автоматический опрос статуса активных batch'ей
  useEffect(() => {
    if (!serverUrl || batches.length === 0) return;

    const intervalId = window.setInterval(async () => {
      const api = (window as any).electronAPI;
      const updatedBatches = await Promise.all(
        batches.map(async (batch) => {
          if (batch.status === 'completed' || batch.status === 'failed') return batch;
          try {
            const data = await api.cloudGetBatchStatus(serverUrl, batch.batchId);
            const tasks = data?.tasks || [];
            const completed = tasks.filter((t: any) => t.status === 'completed').length;
            const failed = tasks.filter((t: any) => t.status === 'failed').length;
            const failedTask = tasks.find((t: any) => t.status === 'failed');
            const errorMessage = failedTask?.error || null;
            const batchParams = data?.batch?.params || {};
            // Извлекаем параметры из объекта params (сервер кладёт их в batch.params)
            const rawParams = batchParams.params || batchParams;
            const params = {
              ...rawParams,
              trailingEnabled: rawParams.trailingDistancePercent > 0,
              trailingPercent: rawParams.trailingDistancePercent,
              useDynamicSizing: rawParams.positionSizing === 'dynamic',
              riskAmount: rawParams.riskAmount || 1000,
            };
            return {
              ...batch,
              status: data?.batch?.status || batch.status,
              total: tasks.length,
              completed,
              failed,
              dateFrom: batchParams.dateFrom || batch.dateFrom,
              dateTo: batchParams.dateTo || batch.dateTo,
              strategy: batchParams.strategy || batch.strategy,
              params: params,
              interval: batchParams.interval || batch.interval,
              error: errorMessage,
            };
          } catch {
            return batch;
          }
        })
      );
      setBatches(updatedBatches);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [serverUrl, batches, setBatches]);

  const openInstrumentDialog = () => {
    setTempSelected([...instruments]);
    setShowInstrumentDialog(true);
  };

  const applyInstrumentSelection = () => {
    setInstruments(tempSelected);
    setShowInstrumentDialog(false);
  };

  const handleStartBatch = async () => {
    if (instruments.length === 0) return;
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const params: any = {
        stopLossPercent: stopLoss,
        takeProfitPercent: takeProfit,
        trailingDistancePercent: trailing ? trailingPercent : 0,
        positionSizing: dynamicSizing ? 'dynamic' : 'fixed',
        riskPercent: dynamicSizing ? (riskAmount / 100000) * 100 : 1,
        lots: lots,   // <-- количество лотов
      };
      /*const params: any = {
        strategyType: strategy,
        stopLossPercent: stopLoss,
        takeProfitPercent: takeProfit,
        trailingEnabled: trailing,
        trailingPercent: trailing ? trailingPercent : 0,
        useDynamicSizing: dynamicSizing,
        riskAmount: dynamicSizing ? riskAmount : 0,
      };*/
      const batchConfig: any = {
        serverUrl,
        instruments,
        dateFrom,
        dateTo,
        interval: intervalValue,
        strategy,
        params,
      };
      if (useGrid) {
        batchConfig.slMin = slMin;
        batchConfig.slMax = slMax;
        batchConfig.slStep = slStep;
        batchConfig.tpMin = tpMin;
        batchConfig.tpMax = tpMax;
        batchConfig.tpStep = tpStep;
        batchConfig.trailMin = trailMin;
        batchConfig.trailMax = trailMax;
        batchConfig.trailStep = trailStep;
        batchConfig.lotsMin = lotsMin;
        batchConfig.lotsMax = lotsMax;
        batchConfig.lotsStep = lotsStep;
        batchConfig.riskMin = riskMin;
        batchConfig.riskMax = riskMax;
        batchConfig.riskStep = riskStep;
      }
      // Параметры объёмного фильтра
      if (useVolumeFilter) {
        params.volumeFilterEnabled = true;
        if (useGrid) {
          // для сетки передаём диапазон
          batchConfig.volPeriodMin = volPeriodMin;
          batchConfig.volPeriodMax = volPeriodMax;
          batchConfig.volPeriodStep = volPeriodStep;
        } else {
          // фиксированное значение
          params.volumeFilterPeriod = volPeriod;
        }
      } else {
        params.volumeFilterEnabled = false;
      }

      const result = await api.cloudCreateBatch(batchConfig);
      if (result.batchId) {
        setBatches(prev => [...prev, {
          batchId: result.batchId,
          status: 'running',
          total: instruments.length,
          completed: 0,
          failed: 0,
          dateFrom,
          dateTo,
          strategy,
          params,
          interval: intervalValue,
          error: undefined
        }]);
      } else {
        alert('Ошибка: ' + JSON.stringify(result));
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewResults = async (batch: BatchResult) => {
    setSelectedBatch(batch);
    setShowResults(true);
    setResultsLoading(true);
    try {
      const api = (window as any).electronAPI;
      const fullResults = await api.cloudGetBatchResults(serverUrl, batch.batchId);
      const enriched = (fullResults.results || []).map((r: any) => {
        const inst = availableInstruments.find(i => i.uid === r.instrumentUid);
        return {
          ...r,
          name: inst?.name || '',
          ticker: inst?.ticker || inst?.name || '',
        };
      });
      setSelectedBatch(prev => prev ? { ...prev, results: enriched } : prev);
    } catch (err) {
      console.error(err);
    } finally {
      setResultsLoading(false);
    }
  };

  const exportBatchToCSV = async (batch: BatchResult) => {
    const api = (window as any).electronAPI;
    const fullResults = await api.cloudGetBatchResults(serverUrl, batch.batchId);
    if (!fullResults?.results) return;
    const enriched = (fullResults.results || []).map((r: any) => {
      const inst = availableInstruments.find(i => i.uid === r.instrumentUid);
      return { ...r, ticker: inst?.ticker || inst?.name || r.instrumentUid?.slice(0,12) };
    });

    const header = 'Instrument,Status,Period,SL%,TP%,Trail%,Lots,Dyn,Profit,Trades,WinRate';
    const rows = fullResults.results.map((r: any) =>
      [
        r.instrumentUid,
        enriched,
        r.status,
        `${r.dateFrom || ''}–${r.dateTo || ''}`,
        r.stopLoss ?? '',
        r.takeProfit ?? '',
        r.trailing ?? '',
        r.lots ?? '',
        r.positionSizing === 'dynamic' ? 'Yes' : 'No',
        r.totalProfit ?? '',
        r.totalTrades ?? '',
        r.winRate ?? ''
      ].join(',')
    ).join('\n');

    const csv = header + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${batch.batchId.slice(-8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBody = (row: BatchResult) => {
    const severityMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
      completed: 'success',
      running: 'warning',
      pending: 'info',
      failed: 'danger',
    };
    return <Tag severity={severityMap[row.status] || 'info'} value={row.status} />;
  };

  return (
    <div className="p-2">
      <Card className="surface-ground p-2 mb-3">
        <h4 className="p-mb-2">Облачный фермер (массовый прогон)</h4>
        <div className="flex align-items-center flex-wrap gap-2 mb-3">
          <label className="mr-1 mb-0">Сервер</label>
          <InputText value={serverUrl} onChange={e => setServerUrl(e.target.value)} className="p-inputtext-sm" style={{ width: '220px' }} />
          <label className="mr-1 mb-0">Период</label>
          <InputText type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-inputtext-sm" style={{ width: '130px' }} />
          <InputText type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-inputtext-sm" style={{ width: '130px' }} />
        </div>
        <div className="flex align-items-center flex-wrap gap-2 mb-2">
          <label className="mr-1 mb-0">Interval</label>
          <Dropdown value={intervalValue} options={['CANDLE_INTERVAL_1_MIN','CANDLE_INTERVAL_5_MIN','CANDLE_INTERVAL_HOUR']} onChange={e => setIntervalValue(e.value)} className="p-inputtext-sm" style={{ width: '160px' }} />
          <label className="mr-1 mb-0">Strategy</label>
          <Dropdown value={strategy} options={['volume_accumulation','trend','poc_pullback','daily_va_return','sfp','initial_balance','anchored_vwap']} onChange={e => setStrategy(e.value)} className="p-inputtext-sm" style={{ width: '150px' }} />
          <label className="mr-1 mb-0">SL%</label>
          <InputNumber value={stopLoss} onValueChange={e => setStopLoss(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
          <label className="mr-1 mb-0">TP%</label>
          <InputNumber value={takeProfit} onValueChange={e => setTakeProfit(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
          <div className="flex align-items-center">
            <Checkbox checked={trailing} onChange={e => setTrailing(e.checked || false)} />
            <label className="ml-1 mr-2 mb-0">Trail</label>
            {trailing && <InputNumber value={trailingPercent} onValueChange={e => setTrailingPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />}
          </div>
          <div className="flex align-items-center">
            <Checkbox checked={dynamicSizing} onChange={e => setDynamicSizing(e.checked || false)} />
            <label className="ml-1 mr-2 mb-0">Dynamic Lots</label>
            {dynamicSizing && <InputNumber value={riskAmount} onValueChange={e => setRiskAmount(e.value ?? 0)} step={100} min={0} size={3} className="p-inputtext-sm" placeholder="Risk RUB" />}
          </div>
          <label className="mr-1 mb-0">Lots</label>
          <InputNumber value={lots} onValueChange={e => setLots(e.value ?? 1)} min={1} step={1} size={3} className="p-inputtext-sm" />
          <div className="flex align-items-center">
            <Checkbox checked={useGrid} onChange={e => setUseGrid(e.checked || false)} />
            <label className="ml-1 mr-2 mb-0">Grid search</label>
          </div>

          {useGrid && (
            <div className="flex flex-wrap gap-2 mt-2">
              {/* SL */}
              <div className="flex align-items-center">
                <label className="mr-1">SL</label>
                <InputNumber value={slMin} onValueChange={e => setSlMin(e.value ?? 1)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={slMax} onValueChange={e => setSlMax(e.value ?? 2)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={slStep} onValueChange={e => setSlStep(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
              {/* TP */}
              <div className="flex align-items-center">
                <label className="mr-1">TP</label>
                <InputNumber value={tpMin} onValueChange={e => setTpMin(e.value ?? 2)} min={0.1} step={1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={tpMax} onValueChange={e => setTpMax(e.value ?? 4)} min={0.1} step={1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={tpStep} onValueChange={e => setTpStep(e.value ?? 1)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
              {/* Trail */}
              <div className="flex align-items-center">
                <label className="mr-1">Trail</label>
                <InputNumber value={trailMin} onValueChange={e => setTrailMin(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={trailMax} onValueChange={e => setTrailMax(e.value ?? 1)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={trailStep} onValueChange={e => setTrailStep(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
              {/* Lots */}
              <div className="flex align-items-center">
                <label className="mr-1">Lots</label>
                <InputNumber value={lotsMin} onValueChange={e => setLotsMin(e.value ?? 10)} min={1} step={10} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={lotsMax} onValueChange={e => setLotsMax(e.value ?? 20)} min={1} step={10} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={lotsStep} onValueChange={e => setLotsStep(e.value ?? 10)} min={1} step={1} size={2} className="p-inputtext-sm" />
              </div>
              {/* Risk */}
              <div className="flex align-items-center">
                <label className="mr-1">Risk%</label>
                <InputNumber value={riskMin} onValueChange={e => setRiskMin(e.value ?? 1)} min={0.1} step={0.5} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={riskMax} onValueChange={e => setRiskMax(e.value ?? 2)} min={0.1} step={0.5} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={riskStep} onValueChange={e => setRiskStep(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
              {/* Volume Filter */}
              <div className="flex align-items-center">
                <Checkbox checked={useVolumeFilter} onChange={e => setUseVolumeFilter(e.checked || false)} />
                <label className="ml-1 mr-2 mb-0">Vol Filt</label>
                {useVolumeFilter && useGrid && (
                  <>
                    <InputNumber value={volPeriodMin} onValueChange={e => setVolPeriodMin(e.value ?? 5)} min={1} step={5} size={2} className="p-inputtext-sm" />
                    <span className="mx-1">–</span>
                    <InputNumber value={volPeriodMax} onValueChange={e => setVolPeriodMax(e.value ?? 50)} min={1} step={5} size={2} className="p-inputtext-sm" />
                    <span className="mx-1">/</span>
                    <InputNumber value={volPeriodStep} onValueChange={e => setVolPeriodStep(e.value ?? 5)} min={1} step={1} size={2} className="p-inputtext-sm" />
                  </>
                )}
                {useVolumeFilter && !useGrid && (
                  <InputNumber value={volPeriod} onValueChange={e => setVolPeriod(e.value ?? 20)} min={1} step={5} size={2} className="p-inputtext-sm" placeholder="Period" />
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex align-items-center gap-2 mb-2">
          <Button
            label="Выбрать инструменты"
            icon="pi pi-list"
            onClick={openInstrumentDialog}
            className="p-button-sm p-button-secondary p-1 px-3"
            style={{minWidth: '200px'}}
          />
          <span className="text-sm text-500">{instruments.length} выбрано</span>
          {instruments.length > 0 && (
            <span className="text-sm text-500">
              ({instruments.map(uid => availableInstruments.find(i => i.uid === uid)?.ticker || uid.slice(0,8)).join(', ')})
            </span>
          )}
        </div>
        <Button label="Запустить прогон" icon="pi pi-play" onClick={handleStartBatch} disabled={loading || instruments.length === 0} className="p-button-sm p-1 px-3" />
      </Card>

      {/* Диалог выбора инструментов */}
      <Dialog
        header="Выбор инструментов"
        visible={showInstrumentDialog}
        style={{ width: '500px', maxHeight: '600px' }}
        onHide={() => setShowInstrumentDialog(false)}
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Отмена" onClick={() => setShowInstrumentDialog(false)} className="p-button-sm p-button-secondary" />
            <Button label="Применить" onClick={applyInstrumentSelection} className="p-button-sm" />
          </div>
        }
      >
        <div className="p-mb-2">
          <InputText
            placeholder="Поиск..."
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
                  checked={tempSelected.includes(inst.uid)}
                  onChange={(e) => {
                    if (e.checked) {
                      setTempSelected(prev => [...prev, inst.uid]);
                    } else {
                      setTempSelected(prev => prev.filter(id => id !== inst.uid));
                    }
                  }}
                  className='mr-1'
                />
                <label htmlFor={`inst-${inst.uid}`}>{inst.name} ({inst.ticker})</label>
              </div>
            ))}
        </div>
      </Dialog>

      {batches.length > 0 && (
        <Card className="surface-ground p-2">
          <h5 className="p-mb-2">Прогоны ({batches.length})</h5>
          <DataTable value={batches} className="p-datatable-sm" stripedRows responsiveLayout="scroll" style={{ fontSize: '0.8rem' }}>
            <Column field="batchId" header="ID" body={(row) => row.batchId.slice(-8)} />
            <Column field="status" header="Статус" body={statusBody} />
            <Column header="Период" body={(row) => `${row.dateFrom || '?'} – ${row.dateTo || '?'}`} />
            <Column header="Стратегия" body={(row) => row.strategy || '—'} />
            <Column header="SL%" body={(row) => row.params?.stopLossPercent ?? '—'} />
            <Column header="TP%" body={(row) => row.params?.takeProfitPercent ?? '—'} />
            <Column header="Trail%" body={(row) => 
              row.params?.trailingDistancePercent > 0 ? row.params.trailingDistancePercent + '%' : '—'
            } />
            <Column header="Dyn.Lots" body={(row) => 
              row.params?.positionSizing === 'dynamic' ? 'Да' : 'Нет'
            } />
            <Column header="Интервал" body={(row) => row.interval || '—'} />
            <Column field="total" header="Всего" />
            <Column field="completed" header="Готово" />
            <Column
              header="Ошибка"
              body={(row: BatchResult) => {
                console.log('Row error:', row.status, row.error);
                return row.status === 'failed' && row.error ? (
                  <Tag severity="danger" value={row.error} />
                ) : null;
              }}
            />
            <Column body={(row: BatchResult) => (
              <div className="flex gap-1">
                <Button icon="pi pi-eye" className="p-button-sm p-button-info p-1" onClick={() => viewResults(row)} disabled={row.status !== 'completed'} />
                <Button icon="pi pi-download" className="p-button-sm p-button-success p-1" onClick={() => exportBatchToCSV(row)} disabled={row.status !== 'completed'} />
              </div>
            )} header="Рез." />
            
          </DataTable>
        </Card>
      )}

      <Dialog header={`Результаты прогона ${selectedBatch?.batchId?.slice(-8)}`} visible={showResults} style={{ width: '900px' }} onHide={() => setShowResults(false)}>
        {resultsLoading ? <p>Загрузка...</p> : selectedBatch?.results ? (
          <DataTable value={selectedBatch.results} className="p-datatable-sm" stripedRows responsiveLayout="scroll" style={{ fontSize: '0.8rem' }}>
            <Column
              header="Инструмент"
              body={(row) => {
                const ticker = row.ticker || row.name || '';
                const uid = row.instrumentUid || '';
                return ticker ? `${ticker} (${uid.slice(0,12)})` : uid.slice(0,12);
              }}
            />
            <Column field="status" header="Статус" body={(row) => <Tag severity={row.status === 'completed' ? 'success' : 'warning'} value={row.status} />} />
            <Column header="Период" body={(row) => `${row.dateFrom || '?'} – ${row.dateTo || '?'}`} />
            <Column header="SL%" body={(row) => row.stopLoss != null ? row.stopLoss : '-'} />
            <Column header="TP%" body={(row) => row.takeProfit != null ? row.takeProfit : '-'} />
            <Column header="Trail%" body={(row) => row.trailing > 0 ? row.trailing + '%' : '-'} />
            <Column header="Lots" body={(row) => row.lots ?? '-'} />
            <Column header="Dyn" body={(row) => row.positionSizing === 'dynamic' ? 'Да' : 'Нет'} />
            <Column field="totalProfit" header="Прибыль" body={(row) => row.totalProfit != null ? row.totalProfit.toFixed(2) : '-'} />
            <Column field="totalTrades" header="Сделок" body={(row) => row.totalTrades ?? '-'} />
            <Column field="winRate" header="WinRate" body={(row) => row.winRate != null ? row.winRate.toFixed(1) + '%' : '-'} />
          </DataTable>
        ) : <p>Нет данных</p>}
      </Dialog>
    </div>
  );
};