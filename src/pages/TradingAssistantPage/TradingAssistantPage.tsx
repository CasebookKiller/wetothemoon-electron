import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  CandlestickSeries,
  Time,
  UTCTimestamp,
  SeriesMarker,
  createSeriesMarkers,
} from 'lightweight-charts';
import VolumeProfileBars from '@/components/TRADING_ASSISTANT/VolumeProfileBars/VolumeProfileBars';
import './TradingAssistantPage.css';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { TabView, TabPanel } from 'primereact/tabview';
import { Dialog } from 'primereact/dialog';
import { ProgressBar } from 'primereact/progressbar';
import { Signal } from '@/api/tbank/signalTypes';
import { VolumeProfileLevels } from '@/main/services/volumeProfileEngine';

function quotationToNumber(q: any): number {
  if (!q) return 0;
  const units = Number(q.units || 0);
  const nano = q.nano || 0;
  return units + nano / 1e9;
}

function aggregateCandles(
  rawCandles: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }>,
  targetIntervalMinutes: number
): Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> {
  if (rawCandles.length === 0) return [];

  const sorted = [...rawCandles].sort((a, b) => a.time - b.time);
  const result: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];

  let bucketStart: UTCTimestamp | null = null;
  let open = 0, high = -Infinity, low = Infinity, close = 0;

  for (const candle of sorted) {
    const bucketTime = (Math.floor(candle.time / (targetIntervalMinutes * 60)) * (targetIntervalMinutes * 60)) as UTCTimestamp;

    if (bucketStart === null || bucketTime !== bucketStart) {
      if (bucketStart !== null) {
        result.push({ time: bucketStart, open, high: high === -Infinity ? open : high, low: low === Infinity ? open : low, close });
      }
      bucketStart = bucketTime;
      open = candle.open;
      high = candle.high;
      low = candle.low;
      close = candle.close;
    } else {
      high = Math.max(high, candle.high);
      low = Math.min(low, candle.low);
      close = candle.close;
    }
  }

  if (bucketStart !== null) {
    result.push({ time: bucketStart, open, high: high === -Infinity ? open : high, low: low === Infinity ? open : low, close });
  }

  return result;
}

export const TradingAssistantPage: React.FC = () => {
  // ========== СОСТОЯНИЯ ==========
  // Песочница
  const [sandbox, setSandbox] = useState({
    token: import.meta.env.VITE_TSandBox || '',
    accountId: '',
    demoMode: true,
    lotQty: 1,
    payAmount: 10000,
    payMessage: '',
    balance: null as string | null,
    accounts: [] as Array<{ id: string; name: string }>,
    loadingAccounts: false,
    creatingAccount: false,
    stopLossPercent: 0.5,
    takeProfitPercent: 1.0,
  });

  // Стрим
  const [stream, setStream] = useState({
    active: false,
    token: import.meta.env.VITE_TReadOnly || '',
    displayTimeframe: 5 as 1 | 5 | 15 | 60,
  });

  // Бэктест
  const [backtest, setBacktest] = useState({
    dateFrom: '2026-05-26',
    dateTo: '2026-05-26',
    interval: '1min',
    valueAreaPercent: 70,
    profileResolution: 50,
    strategyType: 'volume_accumulation',
    stopLossPercent: 0.5,
    takeProfitPercent: 1.0,
    loading: false,
    result: null as any,
    signals: [] as any[],
    trailingDistancePercent: 0.5,
    lots: 1,
    positionSizing: 'fixed' as 'fixed' | 'dynamic',
    riskPercent: 1.0,
    trades: [] as any[],
    volumeFilterEnabled: false,
    volumeFilterPeriod: 20,
  });

  // Batch (пока упрощённо)
  const [batchParams, setBatchParams] = useState({
    slValues: '1,1.5,2',
    tpValues: '2,3,4',
    trailValues: '0.5,1',
    lotsValues: '10',
    positionSizing: 'dynamic' as 'fixed' | 'dynamic',
    riskPercent: 1,
    volumeFilterEnabled: false,
    volumeFilterPeriod: 20,
    strategyType: 'volume_accumulation',
    trailingDistancePercent: 0.5,
    lots: 1,
    slMode: 'range',
    tpMode: 'range',
    trailMode: 'range',
    lotsMode: 'range',
    tpMin: 1,
    tpMax: 4,
    tpStep: 0.5,
    slMin: 1,
    slMax: 2,
    slStep: 0.5,
    trailMin: 0.5,
    trailMax: 1,
    trailStep: 0.5,
    lotsMin: 10,
    lotsMax: 20,
    lotsStep: 10,
    loading: false,
    result: null as any,
    trades: [] as any[],
    
  });
  const [batchInstruments, setBatchInstruments] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null);

  // Профиль и сигналы (пустые, будут наполняться позже)
  const [profile, setProfile] = useState<any>(null);
  const [liveSignals, setLiveSignals] = useState<any[]>([]);
  const [autoTrading, setAutoTrading] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState('e6123145-9665-43e0-8413-cd61b8aa9b13');
  const [availableInstruments, setAvailableInstruments] = useState<Array<{ uid: string; name: string; ticker?: string }>>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(false);

  // Активная вкладка
  const [activeTab, setActiveTab] = useState('sandbox');
  
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });

  const [showInstrumentDialog, setShowInstrumentDialog] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [tempSelectedInstruments, setTempSelectedInstruments] = useState<string[]>([]);

  // ========== REFS ДЛЯ ГРАФИКА ==========
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const levelSeriesRef = useRef<any[]>([]);
  const signalSeriesRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const exitMarkersRef = useRef<any[]>([]);

  // ========== ФУНКЦИИ ==========

  // --- Общие хелперы ---
  const updateSandbox = (patch: Partial<typeof sandbox>) => setSandbox(prev => ({ ...prev, ...patch }));
  const updateStream = (patch: Partial<typeof stream>) => setStream(prev => ({ ...prev, ...patch }));
  const updateBacktest = (patch: Partial<typeof backtest>) => setBacktest(prev => ({ ...prev, ...patch }));

  // --- Инструменты ---
  const loadAllInstruments = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getAllInstruments) return;
    setInstrumentsLoading(true);
    try {
      const list = await api.getAllInstruments(stream.token);
      setAvailableInstruments(list);
    } catch (e) {
      console.error(e);
    } finally {
      setInstrumentsLoading(false);
    }
  };

  // --- Sandbox ---
  const loadAccounts = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getSandboxAccounts) return;
    updateSandbox({ loadingAccounts: true });
    try {
      const list = await api.getSandboxAccounts(sandbox.token);
      updateSandbox({ accounts: list, loadingAccounts: false });
      if (list.length === 1) updateSandbox({ accountId: list[0].id });
    } catch (err: any) {
      console.error(err);
      alert('Ошибка загрузки счетов: ' + (err.message || 'Неизвестная ошибка'));
      updateSandbox({ accounts: [], loadingAccounts: false });
    }
  };

  const handleCreateAccount = async () => {
    const api = (window as any).electronAPI;
    if (!api?.createSandboxAccount) return;
    updateSandbox({ creatingAccount: true });
    try {
      const result = await api.createSandboxAccount();
      if (result.success) {
        updateSandbox({ accountId: result.accountId });
        alert(`Счёт создан: ${result.accountId}`);
        await loadAccounts();
      } else {
        alert('Ошибка создания счёта: ' + result.error);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    } finally {
      updateSandbox({ creatingAccount: false });
    }
  };

  const handleCloseAccount = async () => {
    if (!sandbox.accountId) return;
    const confirmed = confirm(`Закрыть счёт ${sandbox.accountId}?`);
    if (!confirmed) return;
    const api = (window as any).electronAPI;
    if (!api?.closeSandboxAccount) return;
    try {
      const result = await api.closeSandboxAccount(sandbox.accountId);
      if (result.success) {
        alert('Счёт закрыт');
        updateSandbox({ accountId: '' });
        await loadAccounts();
      } else {
        alert('Ошибка: ' + result.error);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const refreshBalance = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getBalance || !sandbox.accountId) return;
    const result = await api.getBalance(sandbox.accountId);
    if (result.success) {
      updateSandbox({ balance: `Баланс: ${result.balance} ${result.currency}` });
    } else {
      updateSandbox({ balance: `Ошибка: ${result.error}` });
    }
  };

  const handlePayIn = async () => {
    const api = (window as any).electronAPI;
    if (!api?.payInSandbox) return;
    updateSandbox({ payMessage: '' });
    const result = await api.payInSandbox(sandbox.payAmount, sandbox.accountId);
    if (result.success) {
      updateSandbox({ payMessage: `Счёт пополнен. Баланс: ${JSON.stringify(result.balance)}` });
      refreshBalance();
    } else {
      updateSandbox({ payMessage: `Ошибка: ${result.error}` });
    }
  };

  const applyConfig = async () => {
    const api = (window as any).electronAPI;
    if (!api?.updateTradingConfig) return;
    await api.updateTradingConfig({
      token: sandbox.token,
      accountId: sandbox.accountId,
      demoMode: sandbox.demoMode,
      lotQuantity: sandbox.lotQty,
      stopLossPercent: sandbox.stopLossPercent,
      takeProfitPercent: sandbox.takeProfitPercent,
    });
    alert('Config applied');
  };

  const toggleTrading = async () => {
    const api = (window as any).electronAPI;
    if (!api?.toggleAutoTrading) return;
    const newState = !autoTrading;
    await api.toggleAutoTrading(newState);
    setAutoTrading(newState);
  };

  // --- Stream ---
  const startStream = async () => {
    const api = (window as any).electronAPI;
    if (!api?.startMarketStream || !api?.getTodayCandles || !api?.loadHistoricalProfile) return;

    try {
      // 1. Загружаем исторические свечи за сегодня
      const historical = await api.getTodayCandles(
        selectedInstrument,
        stream.token,
        '1min'
      );

      if (historical && historical.length > 0) {
        // Форматируем для графика
        const formatted = historical.map((c: any) => ({
          time: (Math.floor(new Date(c.time).getTime() / 1000)) as UTCTimestamp,
          open: quotationToNumber(c.open),
          high: quotationToNumber(c.high),
          low: quotationToNumber(c.low),
          close: quotationToNumber(c.close),
        }));
        setCandlesData(formatted);

        // Отправляем историю в движок профиля
        await api.loadHistoricalProfile(selectedInstrument, historical);
      }

      // 2. Запускаем live-стрим
      await api.startMarketStream(stream.token, {
        subscribeCandlesRequest: {
          subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
          instruments: [{
            instrumentId: selectedInstrument,
            interval: 'SUBSCRIPTION_INTERVAL_ONE_MINUTE'
          }]
        }
      });
      updateStream({ active: true });
    } catch (err: any) {
      console.error(err);
      alert('Ошибка запуска стрима: ' + err.message);
    }
  };

  const stopStream = async () => {
    const api = (window as any).electronAPI;
    if (!api?.stopMarketStream) return;
    await api.stopMarketStream();
    updateStream({ active: false });
  };

  // --- Backtest ---
  const runBacktest = async () => {
    if (backtest.loading) return;
    updateBacktest({ loading: true });
    const api = (window as any).electronAPI;
    if (!api?.runBacktest) return;
    const token = import.meta.env.VITE_TReadOnly;
    const result = await api.runBacktest(
      selectedInstrument,
      backtest.dateFrom,
      backtest.dateTo,
      backtest.interval,
      token,
      {
        valueAreaPercent: backtest.valueAreaPercent,
        profileResolution: backtest.profileResolution,
        strategyType: backtest.strategyType,
        stopLossPercent: backtest.stopLossPercent,
        takeProfitPercent: backtest.takeProfitPercent,
        trailingDistancePercent: backtest.trailingDistancePercent,
        lots: backtest.lots,
        positionSizing: backtest.positionSizing,
        riskPercent: backtest.riskPercent,
        volumeFilterEnabled: backtest.volumeFilterEnabled,
        volumeFilterPeriod: backtest.volumeFilterPeriod,
      }
    );
    if (result) {
      if (result.candles?.length) {
        const formatted = result.candles.map((c: any) => ({
          time: (Math.floor(new Date(c.time).getTime() / 1000)) as UTCTimestamp,
          open: quotationToNumber(c.open),
          high: quotationToNumber(c.high),
          low: quotationToNumber(c.low),
          close: quotationToNumber(c.close),
        }));
        setCandlesData(formatted);
      }
      setProfile(result.profile);
      updateBacktest({ signals: result.signals, result, trades: result.trades || [] });
    }
    updateBacktest({ loading: false });
  };

  const sendBacktestToSandbox = async () => {
    const api = (window as any).electronAPI;
    if (!api?.sendBacktestSignals) return;
    await api.sendBacktestSignals(backtest.signals);
    alert('Сигналы отправлены в OrderManager');
  };

  // --- Эффекты (жизненные циклы) ---
  useEffect(() => {
    if (sandbox.token) loadAccounts();
  }, [sandbox.token]);

  useEffect(() => {
    if (sandbox.accountId) refreshBalance();
  }, [sandbox.accountId]);

  useEffect(() => {
    if (stream.token) loadAllInstruments();
  }, [stream.token]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onCandle) return;

    const handleCandle = (streamCandle: any) => {
      let timestampMs: number;
      if (typeof streamCandle.time === 'object' && streamCandle.time.seconds) {
        timestampMs = Number(streamCandle.time.seconds) * 1000 + (streamCandle.time.nanos || 0) / 1e6;
      } else {
        timestampMs = new Date(streamCandle.time).getTime();
      }
      if (isNaN(timestampMs)) return;

      const newCandle = {
        time: Math.floor(timestampMs / 1000) as UTCTimestamp,
        open: quotationToNumber(streamCandle.open),
        high: quotationToNumber(streamCandle.high),
        low: quotationToNumber(streamCandle.low),
        close: quotationToNumber(streamCandle.close),
      };

      setCandlesData(prev => {
        if (prev.some(c => c.time === newCandle.time)) return prev;
        const updated = [...prev, newCandle].sort((a, b) => a.time - b.time);
        return updated.slice(-500);
      });
    };

    api.onCandle(handleCandle);
    return () => { api.removeCandleListener(); };
  }, []);

  // ========== BATCH FUNCTIONS ==========
  function generateValuesFromRange(min: number, max: number, step: number): number[] {
    const values: number[] = [];
    if (step <= 0) return [min];
    for (let v = min; v <= max + 0.0001; v += step) {
      values.push(Math.round(v * 100) / 100);
    }
    return values;
  }

  const generateParamSets = () => {
    const slValues = batchParams.slValues.split(',').map(Number);
    const tpValues = batchParams.tpValues.split(',').map(Number);
    const trailValues = batchParams.trailValues.split(',').map(Number);
    const lotsValues = batchParams.lotsValues.split(',').map(Number);

    const paramSets: any[] = [];
    for (const sl of slValues) {
      for (const tp of tpValues) {
        for (const trail of trailValues) {
          for (const lots of lotsValues) {
            paramSets.push({
              stopLossPercent: sl,
              takeProfitPercent: tp,
              trailingDistancePercent: trail,
              lots,
              positionSizing: batchParams.positionSizing,
              riskPercent: batchParams.riskPercent,
              volumeFilterEnabled: batchParams.volumeFilterEnabled,
              volumeFilterPeriod: batchParams.volumeFilterPeriod,
            });
          }
        }
      }
    }
    return paramSets;
  };

  const runBatch = () => {
    const api = (window as any).electronAPI;
    if (!api?.batchBacktest) return;

    setBatchResults([]);
    setBatchProgress({ completed: 0, total: 0 });

    api.removeBatchListeners();
    api.onBatchProgress((data: any) => {
      setBatchResults(prev => [...prev, data.item]);
      setBatchProgress({ completed: data.completed, total: data.total });
    });
    api.onBatchComplete(() => {
      setBatchProgress(null);
    });

    const paramSets = generateParamSets();
    const uniqueParamSets = paramSets.filter((set, index, self) =>
      index === self.findIndex(s =>
        s.stopLossPercent === set.stopLossPercent &&
        s.takeProfitPercent === set.takeProfitPercent &&
        s.trailingDistancePercent === set.trailingDistancePercent &&
        s.lots === set.lots &&
        s.positionSizing === set.positionSizing &&
        s.riskPercent === set.riskPercent &&
        s.volumeFilterEnabled === set.volumeFilterEnabled &&
        s.volumeFilterPeriod === set.volumeFilterPeriod
      )
    );

    api.batchBacktest(
      batchInstruments,
      backtest.dateFrom,
      backtest.dateTo,
      backtest.interval,
      stream.token,
      uniqueParamSets,
      batchParams.strategyType,
      backtest.profileResolution,
      backtest.valueAreaPercent
    );
  };

  const exportCSV = () => {
    const header = 'Instrument,SL%,TP%,Trail%,Lots,Sizing,Risk%,VolFilt,Period,Signals,Trades,WinRate,Profit,MaxDD,Capital';
    const rows = batchResults.map(r => {
      const s = r.stats;
      return `${r.instrumentUid},${r.params.stopLossPercent},${r.params.takeProfitPercent},${r.params.trailingDistancePercent},${r.params.lots},${r.params.positionSizing},${r.params.riskPercent},${r.params.volumeFilterEnabled},${r.params.volumeFilterPeriod},${r.signals},${s.totalTrades},${s.winRate?.toFixed(1)}%,${s.totalProfit?.toFixed(2)},${s.maxDrawdown?.toFixed(2)},${s.initialCapital}→${s.finalCapital?.toFixed(2)}`;
    }).join('\n');

    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ========== ЭФФЕКТЫ ГРАФИКА ==========
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      timeScale: { timeVisible: true, borderColor: '#2a2e39' },
      rightPriceScale: { borderColor: '#2a2e39' },
    });

    chartRef.current = chart;

    // Подписка на изменение видимого диапазона цен (для гистограммы)
    const timeScale = chart.timeScale();
    const priceScale = chart.priceScale('right');
    const updatePriceRange = () => {
      const range = priceScale.getVisibleRange();
      if (range) setPriceRange({ min: range.from, max: range.to });
    };
    timeScale.subscribeVisibleTimeRangeChange(updatePriceRange);
    updatePriceRange(); // начальное значение

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      timeScale.unsubscribeVisibleTimeRangeChange(updatePriceRange);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Отображение свечей
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candlesData.length) return;

    if (candleSeriesRef.current) {
      chart.removeSeries(candleSeriesRef.current);
    }

    const aggregated = aggregateCandles(candlesData, stream.displayTimeframe);

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceLineVisible: true,
      lastValueVisible: true,
    });
    candleSeries.setData(aggregated);
    chart.timeScale().fitContent();
    // Принудительно обновляем priceRange, чтобы гистограмма синхронизировалась
    //setTimeout(() => {
    //  const range = chart.priceScale('right').getVisibleRange();
    //  if (range) setPriceRange({ min: range.from, max: range.to });
    //}, 0);
    candleSeriesRef.current = candleSeries;
  }, [candlesData, stream.displayTimeframe]);

  // Обновление уровней
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !profile || !candlesData.length || candlesData.length < 2) return;

    [...levelSeriesRef.current, ...exitMarkersRef.current].forEach(series => {
      try { chart.removeSeries(series); } catch {}
    });
    levelSeriesRef.current = [];

    const firstTime = candlesData[0].time as UTCTimestamp;
    const lastTime = candlesData[candlesData.length - 1].time as UTCTimestamp;
    if (typeof firstTime !== 'number' || typeof lastTime !== 'number') return;

    const addHorizontalLine = (price: number, color: string, title: string, lineWidth = 2) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: lineWidth as any,
        title,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData([{ time: firstTime, value: price }, { time: lastTime, value: price }]);
      levelSeriesRef.current.push(series);
    };

    addHorizontalLine(profile.poc, 'red', 'POC', 3);
    addHorizontalLine(profile.valueAreaHigh, 'green', 'VA High', 2);
    addHorizontalLine(profile.valueAreaLow, 'green', 'VA Low', 2);
  }, [profile, candlesData]);

  // Маркеры сигналов
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !backtest.signals.length) return;

    if (signalSeriesRef.current) {
      chart.removeSeries(signalSeriesRef.current);
    }

    const signalSeries = chart.addSeries(LineSeries, {
      lineVisible: false,
      lastValueVisible: false,
    });

    const markers: SeriesMarker<Time>[] = backtest.signals.map(sig => ({
      time: (Math.floor(new Date(sig.time).getTime() / 1000)) as Time,
      position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: sig.type === 'BUY' ? 'green' : 'red',
      shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: sig.reason,
    }));

    createSeriesMarkers(signalSeries, markers);
    signalSeriesRef.current = signalSeries;
  }, [backtest.signals]);

  // Маркеры выходов
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !backtest.trades.length) return;

    exitMarkersRef.current.forEach(series => {
      try { chart.removeSeries(series); } catch {}
    });
    exitMarkersRef.current = [];

    const reasons = [
      { key: 'TAKE_PROFIT', color: '#4caf50' },
      { key: 'STOP_LOSS', color: '#f44336' },
      { key: 'TRAILING_STOP', color: '#2196f3' },
      { key: 'END_OF_DAY', color: '#ffeb3b' },
      { key: 'SIGNAL', color: '#9e9e9e' },
    ];

    reasons.forEach(({ key, color }) => {
      const tradesOfReason = backtest.trades.filter((t: any) => t.exitReason === key);
      if (tradesOfReason.length === 0) return;

      const series = chart.addSeries(LineSeries, {
        lineVisible: false,
        lastValueVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 5,
        color,
      });

      const data = tradesOfReason.map((trade: any) => ({
        time: (Math.floor(new Date(trade.exitTime).getTime() / 1000)) as Time,
        value: trade.exitPrice,
      }));

      series.setData(data);
      exitMarkersRef.current.push(series);
    });

    chart.timeScale().fitContent();
  }, [backtest.trades]);

  // ProfileUpdate
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.subscribeTradingAssistant();

    const onProfile = (newProfile: VolumeProfileLevels) => {
      console.log('[Profile Update]', newProfile);                  // <-- лог
      console.log('[Profile volumeByPrice]', newProfile.volumeByPrice?.length); // <-- лог
      if (newProfile.instrumentUid === selectedInstrument) {
        setProfile(newProfile);
      }
    };
    const onSignal = (signal: Signal) => {
      if (signal.instrumentUid === selectedInstrument) {
        setLiveSignals(prev => [...prev.slice(-50), signal]);
      }
    };

    api.onProfileUpdate(onProfile);
    api.onTradingSignal(onSignal);

    return () => {
      api.removeProfileUpdateListener();
      api.removeTradingSignalListener();
    };
  }, [selectedInstrument]);

  return (
    <div className="trading-assistant" style={{ padding: '5px', color: '#fff', background: '#1e1e1e' }}>

      <TabView>
        {/* ========== SANDBOX ========== */}
        <TabPanel header="Sandbox">
          <Card className="surface-ground p-0">
            {/* Первая строка: токен, кнопки счетов, выбор счёта */}
            <div className="p-2">
              <div className="p-col-12 flex align-items-center">
                <label className="p-mr-2 p-mb-0">Token</label>
                <InputText
                  value={sandbox.token}
                  onChange={e => updateSandbox({ token: e.target.value })}
                  className="p-inputtext-sm p-1 px-2 mr-2"
                  placeholder="Sandbox token"
                  style={{ flex: 1 }}
                />
                <Button
                  label="Load"
                  onClick={loadAccounts}
                  disabled={!sandbox.token || sandbox.loadingAccounts}
                  className="p-button-sm p-button-secondary border-round-sm p-1 px-3 mr-1"
                />
                <Button
                  label="Create"
                  onClick={handleCreateAccount}
                  disabled={sandbox.creatingAccount}
                  className="p-button-sm p-button-success border-round-sm p-1 px-3 mr-1"
                />
                <Button
                  label="Delete"
                  onClick={handleCloseAccount}
                  disabled={!sandbox.accountId}
                  className="p-button-sm p-button-danger border-round-sm p-1 px-3 mr-2"
                />
                <Dropdown
                  value={sandbox.accountId}
                  options={sandbox.accounts.map((a: any) => ({ label: a.name || a.id, value: a.id }))}
                  onChange={e => updateSandbox({ accountId: e.value })}
                  placeholder="Account"
                  className="p-inputtext-sm"
                  style={{ minWidth: '180px' }}
                />
              </div>
            </div>

            {/* Вторая строка: торговля, параметры, пополнение */}
            <div className="flex align-items-center flex-wrap mt-1">
              <div className="flex align-items-center flex-wrap">
                <Checkbox checked={sandbox.demoMode} onChange={e => updateSandbox({ demoMode: e.checked })} />
                <label className="p-1 mr-1 border-round-sm">Demo</label>
                <Button
                  label={autoTrading ? 'Stop' : 'Start'}
                  onClick={toggleTrading}
                  className={`p-button-sm ${autoTrading ? 'p-button-danger' : 'p-button-success'} border-round-sm p-1 px-2 mr-1`}
                />
                <Button label="Apply" onClick={applyConfig} className="p-button-sm p-button-secondary border-round-sm p-1 px-2 mr-1" />
              
                <label className="mx-1">Lots</label>
                <InputNumber
                  id="lotQty"
                  value={sandbox.lotQty}
                  onValueChange={e => updateSandbox({ lotQty: e.value ?? 1 })}
                  min={1}
                  showButtons
                  mode='decimal'
                  buttonLayout='horizontal'
                  decrementButtonClassName='lotQtyDec'
                  incrementButtonClassName='lotQtyInc'
                  size={1}
                  className='mr-2'
                />
                <label className="mr-1">SL%</label>
                <InputNumber
                  value={sandbox.stopLossPercent}
                  onValueChange={e => updateSandbox({ stopLossPercent: e.value ?? 0 })}
                  step={0.1}
                  min={0}
                  size={2}
                  className='mr-1'
                />
                <label className="mr-1">TP%</label>
                <InputNumber
                  value={sandbox.takeProfitPercent}
                  onValueChange={e => updateSandbox({ takeProfitPercent: e.value ?? 0 })}
                  step={0.1}
                  min={0}
                  size={2}
                  className='mr-2'
                />
                <label className="mr-1">Pay (RUB)</label>
                <InputNumber
                  value={sandbox.payAmount}
                  onValueChange={e => updateSandbox({ payAmount: e.value ?? 1000 })}
                  min={1000}
                  step={1000}
                  size={4}
                  className='mr-1'
                />
                <Button label="Deposit" onClick={handlePayIn} className="p-button-sm border-round-sm p-1 px-3 mr-1" />
                <Button label="Balance" onClick={refreshBalance} className="p-button-sm border-round-sm p-button-info p-1 px-3 mr-1" />
                {sandbox.balance && <span className="p-text-nowrap p-ml-1">{sandbox.balance}</span>}
                {sandbox.payMessage && <span className="p-ml-1" style={{ color: '#4caf50' }}>{sandbox.payMessage}</span>}
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* ========== STREAM ========== */}
        <TabPanel header="Stream">
          <Card className="surface-ground p-0">
            <div className="p-2">
              <div className="flex align-items-center flex-wrap">
                <label className="mr-2 mb-0">Token</label>
                <InputText
                  value={stream.token}
                  onChange={e => updateStream({ token: e.target.value })}
                  className="p-inputtext-sm flex-1 mr-2"
                  placeholder="Read-only token"
                />
                <label className="mr-2 mb-0">TF</label>
                <Dropdown
                  value={stream.displayTimeframe}
                  options={[{label:'1m',value:1},{label:'5m',value:5},{label:'15m',value:15},{label:'1h',value:60}]}
                  onChange={e => updateStream({ displayTimeframe: e.value })}
                  className="p-inputtext-sm mr-2"
                />
                <Button
                  label="Start"
                  onClick={startStream}
                  disabled={stream.active}
                  className="p-button-sm border-round-sm p-1 px-3 mr-1"
                />
                <Button
                  label="Stop"
                  onClick={stopStream}
                  disabled={!stream.active}
                  className="p-button-sm p-button-danger border-round-sm p-1 px-3 mr-1"
                />
                <span className="ml-2" style={{ color: stream.active ? '#4caf50' : '#d32f2f' }}>
                  {stream.active ? '● Live' : '○ Stopped'}
                </span>
              </div>
            </div>
          </Card>
        </TabPanel>

        {/* ========== BACKTEST ========== */}
        <TabPanel header="Backtest">
          <Card className="surface-ground p-0">
            <div className="p-2">
              <div className="flex align-items-center flex-wrap">
                <label className="mr-2 mb-0">Instr</label>
                <Dropdown
                  value={selectedInstrument}
                  options={availableInstruments.map(i => ({ label: `${i.name} (${i.ticker})`, value: i.uid }))}
                  onChange={e => setSelectedInstrument(e.value)}
                  placeholder="Select"
                  filter
                  className="p-inputtext-sm flex-1 mr-2"
                />
                <Button
                  icon="pi pi-refresh"
                  onClick={loadAllInstruments}
                  disabled={instrumentsLoading}
                  className="p-button-sm p-button-secondary p-1 px-3 mr-2"
                />
                <label className="mr-1 mb-0">From</label>
                <InputText
                  type="date"
                  value={backtest.dateFrom}
                  onChange={e => updateBacktest({ dateFrom: e.target.value })}
                  className="p-inputtext-sm mr-2"
                  style={{ width: '130px' }}
                />
                <label className="mr-1 mb-0">To</label>
                <InputText
                  type="date"
                  value={backtest.dateTo}
                  onChange={e => updateBacktest({ dateTo: e.target.value })}
                  className="p-inputtext-sm mr-2"
                  style={{ width: '130px' }}
                />
                <label className="mr-1 mb-0">Int</label>
                <Dropdown
                  value={backtest.interval}
                  options={['1min','5min','15min','1hour']}
                  onChange={e => updateBacktest({ interval: e.value })}
                  className="p-inputtext-sm mr-2"
                  style={{ width: '80px' }}
                />
                <label className="mr-1 mb-0">VA%</label>
                <InputNumber
                  value={backtest.valueAreaPercent}
                  onValueChange={e => updateBacktest({ valueAreaPercent: e.value ?? 70 })}
                  min={50} max={90} step={5}
                  size={2}
                  className="mr-2"
                />
                <label className="mr-1 mb-0">Res</label>
                <InputNumber
                  value={backtest.profileResolution}
                  onValueChange={e => updateBacktest({ profileResolution: e.value ?? 50 })}
                  min={10} max={200} step={10}
                  size={2}
                  className="mr-2"
                />
              </div>
              <div className="flex align-items-center flex-wrap mt-2">
                <label className="mr-1 mb-0">Strat</label>
                <Dropdown
                  value={backtest.strategyType}
                  options={['volume_accumulation','trend']}
                  onChange={e => updateBacktest({ strategyType: e.value })}
                  className="p-inputtext-sm mr-2"
                  style={{ width: '120px' }}
                />
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
                <Button
                  label="Run"
                  onClick={runBacktest}
                  disabled={backtest.loading}
                  className="p-button-sm border-round-sm p-1 px-3 mr-2"
                />
                <Button
                  label="Send to Sandbox"
                  onClick={sendBacktestToSandbox}
                  disabled={!backtest.signals.length}
                  className="p-button-sm p-button-warning border-round-sm p-1 px-3"
                />
              </div>
              {backtest.result?.stats && (
                <div className="mt-2">
                  <p className="text-sm" style={{ wordBreak: 'break-all' }}>
                    Strategy: {backtest.strategyType} | Period: {backtest.dateFrom} – {backtest.dateTo} | Signals: {backtest.result.stats.totalSignals} | Trades: {backtest.result.stats.portfolio.totalTrades} (W: {backtest.result.stats.portfolio.winningTrades} / L: {backtest.result.stats.portfolio.losingTrades}) | WinRate: {backtest.result.stats.portfolio.winRate?.toFixed(1)}% | Profit: {backtest.result.stats.portfolio.totalProfit?.toFixed(2)} ({backtest.result.stats.portfolio.totalProfitPercent?.toFixed(2)}%) | MaxDD: {backtest.result.stats.portfolio.maxDrawdown?.toFixed(2)} ({backtest.result.stats.portfolio.maxDrawdownPercent?.toFixed(2)}%)
                  </p>
                </div>
              )}
            </div>
          </Card>
        </TabPanel>

        {/* ========== BATCH ============= */}
        <TabPanel header="Batch">
          <Card className="surface-ground p-0">
            <div className="p-2">
              {/* Выбор инструментов, Position Sizing, Volume Filter, Strategy, Buttons */}
              <div className="p-col-12 p-md-6">
                <div className="flex align-items-center mt-1 gap-2">
                  <div className="p-inputgroup align-items-center mr-1">
                    <label>Instruments: </label>
                    <InputText value={`${batchInstruments.length} selected`} readOnly className="p-inputtext-sm mr-1" />
                    <Button icon="pi pi-search" onClick={() => {
                      setTempSelectedInstruments([...batchInstruments]);
                      setShowInstrumentDialog(true);
                    }} className="p-button-secondary p-button-sm border-round-sm p-1 px-3" />
                    {batchInstruments.length > 0 && (
                    <small className="p-mt-1" style={{ color: '#888' }}>
                      {batchInstruments.map(uid => {
                        const inst = availableInstruments.find(i => i.uid === uid);
                        return inst ? inst.ticker || inst.name : uid;
                      }).join(', ')}
                    </small>
                  )}
                  </div>
                  {/* Strategy */}
                  <div className="flex align-items-center flex-1">
                    <label className="mr-1">Strategy:</label>
                    <Dropdown
                      value={batchParams.strategyType}
                      options={['volume_accumulation','trend']}
                      onChange={e => setBatchParams({ ...batchParams, strategyType: e.value })}
                      className="p-inputtext-sm w-full"
                    />
                  </div>
                  {/* Size & Risk */}
                  <div className="flex align-items-center flex-1">
                    <label className="mr-1">Size:</label>
                    <Dropdown
                      value={batchParams.positionSizing}
                      options={['fixed','dynamic']}
                      onChange={e => setBatchParams({ ...batchParams, positionSizing: e.value })}
                      className="p-inputtext-sm w-full"
                    />
                    {batchParams.positionSizing === 'dynamic' && (
                      <>
                        <label className="ml-1 mr-1">Risk%:</label>
                        <InputText
                          value={batchParams.riskPercent.toString()}
                          onChange={e => setBatchParams({ ...batchParams, riskPercent: Number(e.target.value) })}
                          className="p-inputtext-sm w-full"
                          style={{ minWidth: '70px' }}
                        />
                      </>
                    )}
                  </div>
                  {/* Vol Filter */}
                  <div className="flex align-items-center flex-1">
                    <Checkbox
                      checked={batchParams.volumeFilterEnabled}
                      onChange={e => setBatchParams({ ...batchParams, volumeFilterEnabled: e.checked ?? false })}
                    />
                    <label className="ml-1 mr-1" style={{minWidth: '70px'}}>Vol Filter</label>
                    {batchParams.volumeFilterEnabled && (
                      <InputText
                        value={batchParams.volumeFilterPeriod.toString()}
                        onChange={e => setBatchParams({ ...batchParams, volumeFilterPeriod: Number(e.target.value) })}
                        placeholder="Period"
                        className="p-inputtext-sm flex-1"
                        style={{ minWidth: '80px' }}
                      />
                    )}
                  </div>
                  <div className="flex flex-grow-1 align-items-center mt-1 gap-2">
                    <Button label="Run Batch" onClick={runBatch} disabled={batchRunning} className="flex-grow-1 p-button-sm border-round-sm p-1 px-3 mr-1" />
                    <Button label="Export CSV" onClick={exportCSV} disabled={batchResults.length === 0} className="flex-grow-1 p-button-sm p-button-secondary border-round-sm p-1 px-3" />
                  </div>
                </div>
              </div>

              {/* SL, TP, Trail, Lots */}
              <div className="p-col-12 p-md-6">      
                <div className="p-inputgroup align-items-center mt-1">
                  <div className='p-inputgroup align-items-center mr-2'>
                    <label className='mr-1'>SL %:</label>
                    <Dropdown
                      value={batchParams.slMode}
                      options={['manual', 'range']}
                      onChange={e => setBatchParams({ ...batchParams, slMode: e.value })}
                      className="p-inputtext-sm"
                      style={{ maxWidth: '110px' }}
                    />
                    {batchParams.slMode === 'manual' ? (
                      <InputText
                        value={batchParams.slValues}
                        onChange={e => setBatchParams({ ...batchParams, slValues: e.target.value })}
                        className="p-inputtext-sm"
                        placeholder="1,1.5,2"
                      />
                    ) : (
                      <>
                        <InputText
                          value={batchParams.slMin.toString()}
                          onChange={e => setBatchParams({ ...batchParams, slMin: Number(e.target.value) })}
                          placeholder="Мин"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                        <InputText
                          value={batchParams.slMax.toString()}
                          onChange={e => setBatchParams({ ...batchParams, slMax: Number(e.target.value) })}
                          placeholder="Макс"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                        <InputText
                          value={batchParams.slStep.toString()}
                          onChange={e => setBatchParams({ ...batchParams, slStep: Number(e.target.value) })}
                          placeholder="Шаг"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                      </>
                    )}
                  </div>
                  <div className='p-inputgroup align-items-center mr-2'>
                    <label className='mr-1'>TP %:</label>
                    <Dropdown
                      value={batchParams.tpMode}
                      options={['manual', 'range']}
                      onChange={e => setBatchParams({ ...batchParams, tpMode: e.value })}
                      className="p-inputtext-sm"
                      style={{ maxWidth: '110px' }}
                    />
                    {batchParams.tpMode === 'manual' ? (
                      <InputText
                        value={batchParams.tpValues}
                        onChange={e => setBatchParams({ ...batchParams, tpValues: e.target.value })}
                        className="p-inputtext-sm"
                        placeholder="2,3,4"
                      />
                    ) : (
                      <>
                        <InputText
                          value={batchParams.tpMin.toString()}
                          onChange={e => setBatchParams({ ...batchParams, tpMin: Number(e.target.value) })}
                          placeholder="Мин"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                        <InputText
                          value={batchParams.tpMax.toString()}
                          onChange={e => setBatchParams({ ...batchParams, tpMax: Number(e.target.value) })}
                          placeholder="Макс"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                        <InputText
                          value={batchParams.tpStep.toString()}
                          onChange={e => setBatchParams({ ...batchParams, tpStep: Number(e.target.value) })}
                          placeholder="Шаг"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                      </>
                    )}
                  </div>
                  <div className='p-inputgroup align-items-center mr-2'>
                    <label className='mr-1'>Trail %</label>
                    <Dropdown
                      value={batchParams.trailMode}
                      options={['manual', 'range']}
                      onChange={e => setBatchParams({ ...batchParams, trailMode: e.value })}
                      className="p-inputtext-sm"
                      style={{ maxWidth: '110px' }}
                    />
                    {batchParams.trailMode === 'manual' ? (
                      <InputText
                        value={batchParams.trailValues}
                        onChange={e => setBatchParams({ ...batchParams, trailValues: e.target.value })}
                        className="p-inputtext-sm"
                        placeholder="0.5,1"
                      />
                    ) : (
                      <>
                        <InputText
                          value={batchParams.trailMin.toString()}
                          onChange={e => setBatchParams({ ...batchParams, trailMin: Number(e.target.value) })}
                          placeholder="Мин"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                        <InputText
                          value={batchParams.trailMax.toString()}
                          onChange={e => setBatchParams({ ...batchParams, trailMax: Number(e.target.value) })}
                          placeholder="Макс"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                        <InputText
                          value={batchParams.trailStep.toString()}
                          onChange={e => setBatchParams({ ...batchParams, trailStep: Number(e.target.value) })}
                          placeholder="Шаг"
                          style={{ maxWidth: '70px' }}
                          className="p-inputtext-sm"
                        />
                      </>
                    )}
                  </div>
                  <label className='mr-1'>Lots:</label>
                  <Dropdown
                    value={batchParams.lotsMode}
                    options={['manual', 'range']}
                    onChange={e => setBatchParams({ ...batchParams, lotsMode: e.value })}
                    className="p-inputtext-sm"
                    style={{ width: '110px' }}
                  />
                  {batchParams.lotsMode === 'manual' ? (
                    <InputText
                      value={batchParams.lotsValues}
                      onChange={e => setBatchParams({ ...batchParams, lotsValues: e.target.value })}
                      className="p-inputtext-sm"
                      placeholder="10"
                    />
                  ) : (
                    <>
                      <InputText
                        value={batchParams.lotsMin.toString()}
                        onChange={e => setBatchParams({ ...batchParams, lotsMin: Number(e.target.value) })}
                        placeholder="Мин"
                        style={{ width: '70px' }}
                        className="p-inputtext-sm"
                      />
                      <InputText
                        value={batchParams.lotsMax.toString()}
                        onChange={e => setBatchParams({ ...batchParams, lotsMax: Number(e.target.value) })}
                        placeholder="Макс"
                        style={{ width: '70px' }}
                        className="p-inputtext-sm"
                      />
                      <InputText
                        value={batchParams.lotsStep.toString()}
                        onChange={e => setBatchParams({ ...batchParams, lotsStep: Number(e.target.value) })}
                        placeholder="Шаг"
                        style={{ width: '70px' }}
                        className="p-inputtext-sm"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Position Sizing, Volume Filter, Strategy, Buttons */}
              <div className="p-col-12 p-md-6">
                
              </div>
            </div>

            {/* Progress & Results */}
            {batchProgress && (
              <div className="p-mt-2">
                <ProgressBar value={Math.round(batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0)} />
                <span className="p-ml-2">{batchProgress.completed} / {batchProgress.total}</span>
              </div>
            )}
            {batchResults.length > 0 && (
              <div className="p-mt-2" style={{ maxHeight: '400px', overflowY: 'auto', color: '#d1d4dc' }}>
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
          </Card>

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
                    />
                    <label htmlFor={`inst-${inst.uid}`}>{inst.name} ({inst.ticker})</label>
                  </div>
                ))}
            </div>
          </Dialog>
        </TabPanel>

        {/* ========== SIGNALS =========== */}
        <TabPanel header="Signals">
          <Card className="surface-ground p-2">
            <h4 className="p-mb-2">Live Signals</h4>
            {liveSignals.length > 0 ? (
              <ul className="p-pl-3" style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
                {liveSignals.map((sig, idx) => (
                  <li key={idx}><strong>{sig.type}</strong>: {sig.message} @ {sig.price}</li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-500">Ожидание сигналов...</p>
            )}
          </Card>
        </TabPanel>

        {/* ========== PROFILE =========== */}
        <TabPanel header="Profile">
          <Card className="surface-ground p-2">
            <h4 className="p-mb-2">Volume Profile Data</h4>
            {profile ? (
              <>
                <div className="p-mb-2" style={{ color: '#d1d4dc' }}>
                  <p>POC: {profile.poc.toFixed(2)}</p>
                  <p>Value Area: {profile.valueAreaLow.toFixed(2)} – {profile.valueAreaHigh.toFixed(2)}</p>
                  <p>Total Volume: {profile.totalVolume}</p>
                </div>
                {profile.volumeByPrice?.length > 0 && (
                  <>
                    <h5>Top 10 Levels</h5>
                    <ul className="p-pl-3" style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
                      {profile.volumeByPrice
                        .sort((a: any, b: any) => b.volume - a.volume)
                        .slice(0, 10)
                        .map(({ price, volume }: any) => (
                          <li key={price}>{price.toFixed(2)} – {volume.toFixed(0)}</li>
                        ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p className="text-center text-500">Нет данных профиля</p>
            )}
          </Card>
        </TabPanel>

        {/* ========== TRADES ============ */}
        <TabPanel header="Trades">
          <Card className="surface-ground p-2">
            <h4 className="p-mb-2">Trade History</h4>
            {backtest.trades.length > 0 ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto', color: '#d1d4dc' }}>
                <table className="p-datatable-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Type</th><th>Entry Time</th><th>Exit Time</th>
                      <th>Entry Price</th><th>Exit Price</th><th>Profit</th>
                      <th>Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.trades.map((t: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #444' }}>
                        <td style={{ color: t.type === 'BUY' ? '#4caf50' : '#f44336' }}>{t.type}</td>
                        <td>{new Date(t.entryTime).toLocaleString()}</td>
                        <td>{new Date(t.exitTime).toLocaleString()}</td>
                        <td>{t.entryPrice.toFixed(2)}</td>
                        <td>{t.exitPrice.toFixed(2)}</td>
                        <td className={t.profit >= 0 ? 'text-green-500' : 'text-red-500'}>{t.profit.toFixed(2)}</td>
                        <td>{t.exitReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-500">No trades yet</p>
            )}
          </Card>
        </TabPanel>
      </TabView>
      <div className="chart-row">
        {profile?.volumeByPrice && priceRange.max > 0 && (
          <div className="volume-profile-container">
            <VolumeProfileBars
              data={profile.volumeByPrice}
              maxVolume={Math.max(...profile.volumeByPrice.map((v: any) => v.volume))}
              minPrice={priceRange.min}
              maxPrice={priceRange.max}
              height={400}
              poc={profile.poc}
              vah={profile.valueAreaHigh}
              val={profile.valueAreaLow}
            />
          </div>
        )}
        <div className="chart-container" ref={chartContainerRef} />
      </div>
    </div>
  );
};