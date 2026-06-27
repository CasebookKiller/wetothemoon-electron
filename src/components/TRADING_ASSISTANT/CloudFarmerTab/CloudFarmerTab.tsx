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
  const [intervalValue, setIntervalValue] = useState('CANDLE_INTERVAL_1_MIN');

  const [lots, setLots] = useState(1);
  
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
  const [volPeriod, setVolPeriod] = useState(20);
  const [volPeriodMin, setVolPeriodMin] = useState(5);
  const [volPeriodMax, setVolPeriodMax] = useState(50);
  const [volPeriodStep, setVolPeriodStep] = useState(5);

  const [schedulerTasks, setSchedulerTasks] = useState<any[]>([]);
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedInstruments, setSchedInstruments] = useState<string[]>([]);
  const [schedDateFrom, setSchedDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [schedDateTo, setSchedDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [schedInterval, setSchedInterval] = useState('CANDLE_INTERVAL_1_MIN');
  const [schedStrategy, setSchedStrategy] = useState('volume_accumulation');
  const [schedStopLoss, setSchedStopLoss] = useState(1);
  const [schedTakeProfit, setSchedTakeProfit] = useState(2);
  const [schedTrailing, setSchedTrailing] = useState(false);
  const [schedTrailingPercent, setSchedTrailingPercent] = useState(1.0);
  const [schedDynamicSizing, setSchedDynamicSizing] = useState(false);
  const [schedRiskAmount, setSchedRiskAmount] = useState(1000);
  const [schedLots, setSchedLots] = useState(10);
  const [schedLoading, setSchedLoading] = useState(false);

  const [phaseFilter, setPhaseFilter] = useState<string>('Все');

  const [useServerGrid, setUseServerGrid] = useState(false);

  // Внутри компонента CloudFarmerTab, добавим новые состояния:
  const [showSchedulerDialog, setShowSchedulerDialog] = useState(false);
  const [schedulerTime, setSchedulerTime] = useState('09:00');
  const [schedulerDateFrom, setSchedulerDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [schedulerDateTo, setSchedulerDateTo] = useState(new Date().toISOString().split('T')[0]);

  const [instrumentDialogTarget, setInstrumentDialogTarget] = useState<'farmer' | 'scheduler'>('farmer');

  const [schedulerBatchStatuses, setSchedulerBatchStatuses] = useState<Map<string, string>>(new Map());

  // Функция сохранения в планировщик
  const handleSaveToScheduler = async () => {
    const api = (window as any).electronAPI;
    if (!api?.cloudAddSchedulerTask) return;

    const params: any = {
      stopLossPercent: stopLoss,
      takeProfitPercent: takeProfit,
      trailingDistancePercent: trailing ? trailingPercent : 0,
      positionSizing: dynamicSizing ? 'dynamic' : 'fixed',
      riskPercent: dynamicSizing ? (riskAmount / 100000) * 100 : 1,
      lots: lots,
    };

    const gridConfig = (useGrid || useServerGrid) ? {
      slMin, slMax, slStep,
      tpMin, tpMax, tpStep,
      trailMin, trailMax, trailStep,
      lotsMin, lotsMax, lotsStep,
      riskMin, riskMax, riskStep,
    } : null;

    const volumeFilterConfig = useVolumeFilter ? {
      min: volPeriodMin,
      max: volPeriodMax,
      step: volPeriodStep,
      period: volPeriod,
    } : null;

    try {
      const result = await api.cloudAddSchedulerTask(serverUrl, {
        time: schedulerTime,
        instruments,
        dateFrom: schedulerDateFrom,
        dateTo: schedulerDateTo,
        interval: intervalValue,
        strategy,
        params,
        useGrid: useGrid || useServerGrid,
        gridConfig,
        useVolumeFilter,
        volumeFilterConfig,
      });
      if (result.success) {
        await loadSchedulerTasks();
        setShowSchedulerDialog(false);
      } else {
        alert('Ошибка: ' + JSON.stringify(result));
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  // Функция загрузки задания в основной интерфейс
  const loadTaskToFarmer = (task: any) => {
    if (!task) return;
    setInstruments(task.instruments || []);
    setDateFrom(task.dateFrom || '');
    setDateTo(task.dateTo || '');
    setIntervalValue(task.interval || 'CANDLE_INTERVAL_1_MIN');
    setStrategy(task.strategy || 'volume_accumulation');

    const p = task.params || {};
    setStopLoss(p.stopLossPercent ?? 0.5);
    setTakeProfit(p.takeProfitPercent ?? 1);
    setTrailing(p.trailingDistancePercent > 0);
    setTrailingPercent(p.trailingDistancePercent > 0 ? p.trailingDistancePercent : 1);
    setDynamicSizing(p.positionSizing === 'dynamic');
    if (p.positionSizing === 'dynamic' && p.riskPercent) {
      setRiskAmount((p.riskPercent / 100) * 100000);
    }
    setLots(p.lots ?? 1);

    if (task.useGrid && task.gridConfig) {
      setUseGrid(true);
      setUseServerGrid(false);
      const gc = task.gridConfig;
      setSlMin(gc.slMin); setSlMax(gc.slMax); setSlStep(gc.slStep);
      setTpMin(gc.tpMin); setTpMax(gc.tpMax); setTpStep(gc.tpStep);
      setTrailMin(gc.trailMin); setTrailMax(gc.trailMax); setTrailStep(gc.trailStep);
      setLotsMin(gc.lotsMin); setLotsMax(gc.lotsMax); setLotsStep(gc.lotsStep);
      setRiskMin(gc.riskMin); setRiskMax(gc.riskMax); setRiskStep(gc.riskStep);
    } else {
      setUseGrid(false);
      setUseServerGrid(false);
    }

    if (task.useVolumeFilter && task.volumeFilterConfig) {
      setUseVolumeFilter(true);
      const vc = task.volumeFilterConfig;
      setVolPeriod(vc.period || 20);
      setVolPeriodMin(vc.min || 5);
      setVolPeriodMax(vc.max || 50);
      setVolPeriodStep(vc.step || 5);
    } else {
      setUseVolumeFilter(false);
    }
  };

  const loadSchedulerTasks = async () => {
    const api = (window as any).electronAPI;
    if (!api?.cloudGetSchedulerTasks) return;
    const data = await api.cloudGetSchedulerTasks(serverUrl);
    if (Array.isArray(data)) {
      setSchedulerTasks(data);
      // Запрашиваем статусы для заданий с lastBatchId
      const statusMap = new Map<string, string>();
      await Promise.all(data
        .filter((t: any) => t.lastBatchId)
        .map(async (t: any) => {
          try {
            const statusData = await api.cloudGetBatchStatus(serverUrl, t.lastBatchId);
            statusMap.set(t.id, statusData?.batch?.status || 'unknown');
          } catch {
            statusMap.set(t.id, 'unknown');
          }
        })
      );
      setSchedulerBatchStatuses(statusMap);
    }
  };

  const handleAddSchedulerTask = async () => {
    setSchedLoading(true);
    try {
      const api = (window as any).electronAPI;
      const params: any = {
        stopLossPercent: schedStopLoss,
        takeProfitPercent: schedTakeProfit,
        trailingDistancePercent: schedTrailing ? schedTrailingPercent : 0,
        positionSizing: schedDynamicSizing ? 'dynamic' : 'fixed',
        riskPercent: schedDynamicSizing ? (schedRiskAmount / 100000) * 100 : 1,
        lots: schedLots,
      };
      const result = await api.cloudAddSchedulerTask(serverUrl, {
        time: schedTime,
        instruments: schedInstruments,
        dateFrom: schedDateFrom,
        dateTo: schedDateTo,
        interval: schedInterval,
        strategy: schedStrategy,
        params,
      });
      if (result.success) {
        await loadSchedulerTasks();
      } else {
        alert('Ошибка: ' + JSON.stringify(result));
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    } finally {
      setSchedLoading(false);
    }
  };

  const handleDeleteSchedulerTask = async (id: string) => {
    const api = (window as any).electronAPI;
    await api.cloudDeleteSchedulerTask(serverUrl, id);
    await loadSchedulerTasks();
  };

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
      setFarmerInstruments?.([]);
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

  useEffect(() => {
    if (serverUrl) {
      loadSchedulerTasks();
    }
  }, [serverUrl]); // или можно [] чтобы загрузить один раз

  const openInstrumentDialog = () => {
    setTempSelected([...instruments]);
    setInstrumentDialogTarget('farmer');
    setShowInstrumentDialog(true);
  };

  const openSchedulerInstrumentDialog = () => {
    setTempSelected([...schedInstruments]); // копируем текущие выбранные uid
    setInstrumentDialogTarget('scheduler');
    setShowInstrumentDialog(true);
  };

  const applyInstrumentSelection = () => {
    if (instrumentDialogTarget === 'scheduler') {
      setSchedInstruments(tempSelected);
    } else {
      setInstruments(tempSelected);
    }
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
        lots: lots,
      };

      const batchConfig: any = {
        serverUrl,
        instruments,
        dateFrom,
        dateTo,
        interval: intervalValue,
        strategy,
        params,
      };

      // Передаём параметры сетки (используются и для ручного Grid, и для Server Grid)
      if (useGrid || useServerGrid) {
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

      // Флаг для серверного перебора
      if (useServerGrid) {
        batchConfig.useServerGrid = true;
      }

      // Параметры объёмного фильтра
      if (useVolumeFilter) {
        params.volumeFilterEnabled = true;
        if (useGrid || useServerGrid) {
          batchConfig.volPeriodMin = volPeriodMin;
          batchConfig.volPeriodMax = volPeriodMax;
          batchConfig.volPeriodStep = volPeriodStep;
        } else {
          params.volumeFilterPeriod = volPeriod;
        }
      } else {
        params.volumeFilterEnabled = false;
      }

      const result = await api.cloudCreateBatch(batchConfig);
      if (result.batchId) {
        setBatches(prev => [...prev, {
          batchId: result.batchId,
          status: result.status || 'pending',
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
    setSelectedBatch(null);  // ← добавить эту строку
    //setSelectedBatch(batch);
    setShowResults(true);
    setResultsLoading(true);
    try {
      const api = (window as any).electronAPI;
      const fullResults = await api.cloudGetBatchResults(serverUrl, batch.batchId);
      console.log('=== RAW SERVER RESPONSE ===');
      console.log(JSON.stringify(fullResults, null, 2));
      const enriched = (fullResults.results || []).map((r: any) => {
        const inst = availableInstruments.find(i => i.uid === r.instrumentUid);
        return {
          taskId: r.taskId,
          instrumentUid: r.instrumentUid,
          status: r.status,
          totalProfit: r.totalProfit,
          totalTrades: r.totalTrades,
          winRate: r.winRate,
          maxDrawdown: r.maxDrawdown,
          error: r.error,
          phaseDetails: r.phaseDetails || [],
          marketPhases: r.marketPhases,
          phaseDistribution: r.phaseDistribution,
          dateFrom: r.dateFrom,
          dateTo: r.dateTo,
          strategy: r.strategy,
          stopLoss: r.stopLoss,
          takeProfit: r.takeProfit,
          trailing: r.trailing,
          positionSizing: r.positionSizing,
          lots: r.lots,
          riskPercent: r.riskPercent,
          name: inst?.name || '',
          ticker: inst?.ticker || inst?.name || '',
        };
      });
      console.log('=== ENRICHED RESULTS (first item) ===');
      console.log(JSON.stringify(enriched[0], null, 2));
      // Принудительно создаём новый массив, чтобы React увидел изменение
      setSelectedBatch(prev => prev ? { ...prev, results: [...enriched] } : { ...batch, results: enriched });
      setTimeout(() => {
        console.log('=== CURRENT selectedBatch.results (first item) ===');
        console.log(JSON.stringify(selectedBatch?.results?.[0], null, 2));
      }, 100);
    } catch (err) {
      console.error(err);
    } finally {
      setResultsLoading(false);
    }
  };

  const viewBatchResults = async (batchId: string) => {
    setResultsLoading(true);
    try {
      const api = (window as any).electronAPI;
      const fullResults = await api.cloudGetBatchResults(serverUrl, batchId);
      const enriched = (fullResults.results || []).map((r: any) => {
        const inst = availableInstruments.find(i => i.uid === r.instrumentUid);
        return {
          taskId: r.taskId,
          instrumentUid: r.instrumentUid,
          status: r.status,
          totalProfit: r.totalProfit,
          totalTrades: r.totalTrades,
          winRate: r.winRate,
          maxDrawdown: r.maxDrawdown,
          error: r.error,
          phaseDetails: r.phaseDetails || [],
          marketPhases: r.marketPhases,
          dateFrom: r.dateFrom,
          dateTo: r.dateTo,
          strategy: r.strategy,
          stopLoss: r.stopLoss,
          takeProfit: r.takeProfit,
          trailing: r.trailing,
          positionSizing: r.positionSizing,
          lots: r.lots,
          riskPercent: r.riskPercent,
          name: inst?.name || '',
          ticker: inst?.ticker || inst?.name || '',
        };
      });
      // Создаём временный объект BatchResult, чтобы использовать существующий диалог отображения
      const fakeBatch: BatchResult = {
        batchId: batchId,
        status: 'completed', // не важно, диалог просто показывает результаты
        total: enriched.length,
        completed: enriched.length,
        failed: 0,
        results: enriched,
      };
      setSelectedBatch(fakeBatch);
      setShowResults(true);
    } catch (err) {
      console.error('Failed to load scheduler batch results', err);
    } finally {
      setResultsLoading(false);
    }
  };

  const exportBatchToCSV = async (batch: BatchResult) => {
    const api = (window as any).electronAPI;
    const fullResults = await api.cloudGetBatchResults(serverUrl, batch.batchId);
    if (!fullResults?.results) return;

    const header = 'Instrument,Status,Period,SL%,TP%,Trail%,Lots,Dyn,Profit,Trades,WinRate,Phase';
    const rows = fullResults.results.map((r: any) => {
      const dist = r.phaseDistribution || {};
      let dominant = '';
      let max = 0;
      for (const [phase, count] of Object.entries(dist)) {
        if ((count as number) > max) {
          max = count as number;
          dominant = phase;
        }
      }

      return [
        r.instrumentUid,
        r.status,
        `${r.dateFrom || ''}–${r.dateTo || ''}`,
        r.stopLoss ?? '',
        r.takeProfit ?? '',
        r.trailing ?? '',
        r.lots ?? '',
        r.positionSizing === 'dynamic' ? 'Yes' : 'No',
        r.totalProfit ?? '',
        r.totalTrades ?? '',
        r.winRate ?? '',
        dominant,
      ].join(',');
    }).join('\n');

    const csv = header + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${batch.batchId.slice(-8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPhaseSummary = (results: any[]) => {
    // Собираем по датам словарь { фаза: количество инструментов }
    const dayMap = new Map<string, Map<string, number>>();

    results.forEach(r => {
      const details = r.phaseDetails;
      if (Array.isArray(details)) {
        details.forEach((d: any) => {
          if (!d.date || !d.phase) return;
          if (!dayMap.has(d.date)) {
            dayMap.set(d.date, new Map());
          }
          const phaseCount = dayMap.get(d.date)!;
          phaseCount.set(d.phase, (phaseCount.get(d.phase) || 0) + 1);
        });
      }
    });

    // Определяем доминирующую фазу для каждого дня
    const dominantByDate = new Map<string, string>();
    dayMap.forEach((phaseCounts, date) => {
      let maxCount = 0;
      let dominant = 'CHOP'; // значение по умолчанию
      phaseCounts.forEach((count, phase) => {
        if (count > maxCount) {
          maxCount = count;
          dominant = phase;
        }
      });
      dominantByDate.set(date, dominant);
    });

    // Суммируем дни по доминирующим фазам
    const phaseDays = new Map<string, number>();
    dominantByDate.forEach(phase => {
      phaseDays.set(phase, (phaseDays.get(phase) || 0) + 1);
    });

    const totalDays = dominantByDate.size;

    return Array.from(phaseDays.entries()).map(([phase, days]) => ({
      phase,
      days,
      percent: totalDays > 0 ? ((days / totalDays) * 100).toFixed(1) : '0.0',
    }));
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
          <div className="flex align-items-center">
            <Checkbox checked={useServerGrid} onChange={e => setUseServerGrid(e.checked || false)} />
            <label className="ml-1 mr-2 mb-0">Server Grid</label>
          </div>

          {useGrid && (
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="flex align-items-center">
                <label className="mr-1">SL</label>
                <InputNumber value={slMin} onValueChange={e => setSlMin(e.value ?? 1)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={slMax} onValueChange={e => setSlMax(e.value ?? 2)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={slStep} onValueChange={e => setSlStep(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
              <div className="flex align-items-center">
                <label className="mr-1">TP</label>
                <InputNumber value={tpMin} onValueChange={e => setTpMin(e.value ?? 2)} min={0.1} step={1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={tpMax} onValueChange={e => setTpMax(e.value ?? 4)} min={0.1} step={1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={tpStep} onValueChange={e => setTpStep(e.value ?? 1)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
              <div className="flex align-items-center">
                <label className="mr-1">Trail</label>
                <InputNumber value={trailMin} onValueChange={e => setTrailMin(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={trailMax} onValueChange={e => setTrailMax(e.value ?? 1)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={trailStep} onValueChange={e => setTrailStep(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
              <div className="flex align-items-center">
                <label className="mr-1">Lots</label>
                <InputNumber value={lotsMin} onValueChange={e => setLotsMin(e.value ?? 10)} min={1} step={10} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={lotsMax} onValueChange={e => setLotsMax(e.value ?? 20)} min={1} step={10} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={lotsStep} onValueChange={e => setLotsStep(e.value ?? 10)} min={1} step={1} size={2} className="p-inputtext-sm" />
              </div>
              <div className="flex align-items-center">
                <label className="mr-1">Risk%</label>
                <InputNumber value={riskMin} onValueChange={e => setRiskMin(e.value ?? 1)} min={0.1} step={0.5} size={2} className="p-inputtext-sm" />
                <span className="mx-1">–</span>
                <InputNumber value={riskMax} onValueChange={e => setRiskMax(e.value ?? 2)} min={0.1} step={0.5} size={2} className="p-inputtext-sm" />
                <span className="mx-1">/</span>
                <InputNumber value={riskStep} onValueChange={e => setRiskStep(e.value ?? 0.5)} min={0.1} step={0.1} size={2} className="p-inputtext-sm" />
              </div>
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
        <Button 
          label="Сохранить в планировщик" 
          icon="pi pi-calendar-plus" 
          onClick={() => {
            setSchedulerTime('09:00');
            setSchedulerDateFrom(dateFrom);
            setSchedulerDateTo(dateTo);
            setShowSchedulerDialog(true);
          }}
          disabled={instruments.length === 0} 
          className="p-button-sm p-button-secondary p-1 px-3 ml-2" 
        />
      </Card>

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
                <Button
                  icon="pi pi-trash"
                  className="p-button-sm p-button-danger p-1"
                  tooltip="Удалить прогон"
                  onClick={async () => {
                    if (!confirm('Удалить этот прогон и все его задачи?')) return;
                    const api = (window as any).electronAPI;
                    await api.cloudDeleteBatch(serverUrl, row.batchId);
                    setBatches(prev => prev.filter(b => b.batchId !== row.batchId));
                  }}
                />
              </div>
            )} header="Рез." />
          </DataTable>
        </Card>
      )}

      <Dialog header={`Результаты прогона ${selectedBatch?.batchId?.slice(-8)}`} visible={showResults} style={{ width: '900px' }} onHide={() => setShowResults(false)}>
        {resultsLoading ? <p>Загрузка...</p> : selectedBatch?.results ? (
          <>
            {selectedBatch.results.length > 0 && (
              <div className="mb-3">
                <h5>Распределение по фазам рынка</h5>
                <DataTable value={getPhaseSummary(selectedBatch.results)} className="p-datatable-sm" stripedRows responsiveLayout="scroll" style={{ fontSize: '0.8rem' }}>
                  <Column field="phase" header="Фаза" />
                  <Column field="days" header="Дней" />
                  <Column field="percent" header="%" body={(row) => `${row.percent}%`} />
                </DataTable>
              </div>
            )}

            {selectedBatch?.results?.length > 0 && (
              <div className="mb-3">
                <h5>Фазы по дням</h5>
                {(() => {
                  // Группируем задачи по instrumentUid
                  const groupMap = new Map<string, any[]>();
                  selectedBatch.results.forEach((task: any) => {
                    const uid = task.instrumentUid;
                    if (!groupMap.has(uid)) groupMap.set(uid, []);
                    groupMap.get(uid)!.push(task);
                  });

                  return Array.from(groupMap.entries()).map(([uid, tasks]) => {
                    // Берём фазы из первой задачи (они одинаковы для всех задач с тем же uid и периодом)
                    const representative = tasks[0];
                    const details = representative.phaseDetails || [];
                    const ticker = representative.ticker || representative.name || uid.slice(0,12);
                    return (
                      <div key={uid} className="mb-2">
                        <strong>{ticker}</strong>
                        <DataTable
                          value={details}
                          className="p-datatable-sm"
                          stripedRows
                          style={{ fontSize: '0.75rem' }}
                        >
                          <Column field="date" header="Дата" />
                          <Column
                            field="phase"
                            header="Фаза"
                            body={(row: any) => (
                              <Tag
                                severity={
                                  row.phase === 'CHOP' ? 'warning' :
                                  row.phase === 'BALANCE' ? 'info' :
                                  row.phase === 'TREND_UP' ? 'success' :
                                  row.phase === 'TREND_DOWN' ? 'danger' : 'secondary'
                                }
                                value={row.phase}
                              />
                            )}
                          />
                        </DataTable>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            <div className="flex align-items-center gap-2 mb-2">
              <span>Фильтр по фазе:</span>
              <Dropdown
                value={phaseFilter}
                options={['Все', 'BALANCE', 'TREND_UP', 'TREND_DOWN', 'BREAKOUT', 'CHOP']}
                onChange={e => setPhaseFilter(e.value)}
                className="p-inputtext-sm"
                style={{ width: '140px' }}
              />
            </div>

            <DataTable
              value={selectedBatch.results.filter((r: any) => {
                if (phaseFilter === 'Все') return true;
                const phases = r.marketPhases;
                return Array.isArray(phases) && phases.includes(phaseFilter);
              })}
              key={JSON.stringify(selectedBatch.results)}
              className="p-datatable-sm"
              stripedRows
              responsiveLayout="scroll"
              style={{ fontSize: '0.8rem' }}
            >
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
              <Column header="Фаза" body={(row) => {
                const phases = row.marketPhases;
                if (!Array.isArray(phases) || phases.length === 0) return '—';
                // подсчёт самой частой фазы
                const freq: Record<string, number> = {};
                phases.forEach(p => { freq[p] = (freq[p] || 0) + 1; });
                const dominant = Object.entries(freq).sort((a,b) => b[1]-a[1])[0][0];
                return dominant;
              }} />
            </DataTable>
          </>
        ) : <p>Нет данных</p>}
      </Dialog>

      <Dialog 
        header="Сохранить в планировщик" 
        visible={showSchedulerDialog} 
        style={{ width: '350px' }} 
        onHide={() => setShowSchedulerDialog(false)}
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Отмена" onClick={() => setShowSchedulerDialog(false)} className="p-button-sm p-button-secondary" />
            <Button label="Сохранить" onClick={handleSaveToScheduler} className="p-button-sm" />
          </div>
        }
      >
        <div className="p-fluid">
          <div className="p-field mb-2">
            <label className="mb-1">Время (UTC)</label>
            <InputText value={schedulerTime} onChange={e => setSchedulerTime(e.target.value)} className="p-inputtext-sm" />
          </div>
          <div className="p-field mb-2">
            <label className="mb-1">Период с</label>
            <InputText type="date" value={schedulerDateFrom} onChange={e => setSchedulerDateFrom(e.target.value)} className="p-inputtext-sm" />
          </div>
          <div className="p-field mb-2">
            <label className="mb-1">Период по</label>
            <InputText type="date" value={schedulerDateTo} onChange={e => setSchedulerDateTo(e.target.value)} className="p-inputtext-sm" />
          </div>
        </div>
      </Dialog>

      <Card className="surface-ground p-2 mb-3">
        <h5 className="p-mb-2">Планировщик ежедневных прогонов</h5>
        <div className="flex align-items-center flex-wrap gap-2 mb-2">
          <label className="mb-1">Время (МСК)</label>
          <InputText value={schedTime} onChange={e => setSchedTime(e.target.value)} className="p-inputtext-sm" style={{ width: '80px' }} />
          <label className="mr-1 mb-0">Инструменты</label>
          <Button 
            label="Выбрать инструменты" 
            icon="pi pi-list" 
            onClick={openSchedulerInstrumentDialog} 
            className="p-button-sm p-button-secondary p-1 px-2" 
          />
          <span className="text-sm text-500">{schedInstruments.length} выбрано</span>
          <label className="mr-1 mb-0">Период</label>
          <InputText type="date" value={schedDateFrom} onChange={e => setSchedDateFrom(e.target.value)} className="p-inputtext-sm" style={{ width: '130px' }} />
          <InputText type="date" value={schedDateTo} onChange={e => setSchedDateTo(e.target.value)} className="p-inputtext-sm" style={{ width: '130px' }} />
          <Button label="Добавить задание" icon="pi pi-plus" onClick={handleAddSchedulerTask} disabled={schedLoading} className="p-button-sm p-1 px-3" />
        </div>
        {schedulerTasks.length > 0 && (
          <DataTable value={schedulerTasks} className="p-datatable-sm" stripedRows responsiveLayout="scroll" style={{ fontSize: '0.8rem' }}>
            <Column field="id" header="ID" body={(row) => row.id.slice(-8)} />
            <Column field="time" header="Время" />
            <Column field="strategy" header="Стратегия" />
            <Column 
              header="След. запуск" 
              body={(row: any) => {
                if (!row.nextRun) return '—';
                const mskDate = new Date(row.nextRun).toLocaleString('ru-RU', { 
                  timeZone: 'Europe/Moscow',
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit'
                });
                return mskDate;
              }} 
            />
            <Column
              header="Последний запуск"
              body={(row: any) => {
                if (!row.lastRun) return '—';
                const mskDate = new Date(row.lastRun).toLocaleString('ru-RU', {
                  timeZone: 'Europe/Moscow',
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit'
                });
                const status = schedulerBatchStatuses.get(row.id);
                let severity: 'success' | 'warning' | 'danger' | 'info' = 'info';
                if (status === 'completed') severity = 'success';
                else if (status === 'running') severity = 'warning';
                else if (status === 'failed') severity = 'danger';
                return (
                  <div>
                    <div style={{ fontSize: '0.7rem' }}>{mskDate}</div>
                    {status && (
                      <Tag severity={severity} value={status} style={{ fontSize: '0.65rem' }} />
                    )}
                  </div>
                );
              }}
            />
            <Column body={(row: any) => (
              <div className="flex gap-1">
                <Button
                  icon="pi pi-download"
                  className="p-button-sm p-button-info p-1"
                  tooltip="Загрузить в фермер"
                  onClick={() => loadTaskToFarmer(row)}
                />
                {row.lastBatchId && (
                  <Button
                    icon="pi pi-eye"
                    className="p-button-sm p-button-success p-1"
                    tooltip="Результаты"
                    onClick={() => viewBatchResults(row.lastBatchId)}
                  />
                )}
                <Button
                  icon="pi pi-trash"
                  className="p-button-sm p-button-danger p-1"
                  onClick={() => handleDeleteSchedulerTask(row.id)}
                />
              </div>
            )} header="Действия" />
          </DataTable>
        )}
      </Card>
    </div>
  );
};