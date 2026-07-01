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
  ISeriesApi,
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
import { VolumeProfileOverlay } from '@/components/TRADING_ASSISTANT/VolumeProfileOverlay/VolumeProfileOverlay';
import { PositionsOrdersTab } from '@/components/TRADING_ASSISTANT/PositionsOrdersTab/PositionsOrdersTab';
import { LogTab } from '@/components/TRADING_ASSISTANT/LogTab/LogTab';
import { CandlestickChart } from '@/components/TRADING_ASSISTANT/CandlestickChart/CandlestickChart';
import { AmChartsStockChart } from '@/components/TRADING_ASSISTANT/AmChartsStockChart/AmChartsStockChart';
import { EquityChart } from '@/components/TRADING_ASSISTANT/EquityChart/EquityChart';
import { TradesTab } from '@/components/TRADING_ASSISTANT/TradesTab/TradesTab';
import { ScreenerTab } from '@/components/TRADING_ASSISTANT/ScreenerTab/ScreenerTab';
import { CloudTab } from '@/components/TRADING_ASSISTANT/CloudTab/CloudTab';
import { CloudFarmerTab } from '@/components/TRADING_ASSISTANT/CloudFarmerTab/CloudFarmerTab';

interface BatchResult {
  batchId: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  results?: any[];
}


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
    trailingEnabled: false,
    trailingPercent: 0.5,
    dailyLossEnabled: false,
    dailyLossLimit: 0,
    maxSignalsPerDay: 0,
    minIntervalMinutes: 15,
  });
  const [showSandboxSettings, setShowSandboxSettings] = useState(false);

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
  const [backtestCandlesData, setBacktestCandlesData] = useState<any[]>([]);
  const [backtestProfile, setBacktestProfile] = useState<any>(null);
  const [showBacktestAdvanced, setShowBacktestAdvanced] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);

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
    interval: 'CANDLE_INTERVAL_1_MIN', // новое поле    
  });
  const [batchInstruments, setBatchInstruments] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchStopping, setBatchStopping] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [batchVersion, setBatchVersion] = useState<'v1' | 'v2'>('v2');
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'live' | 'backtest'>('live');

  // Профиль и сигналы (пустые, будут наполняться позже)
  const [profile, setProfile] = useState<any>(null);
  const [profileType, setProfileType] = useState<'side' | 'overlay'>('side');
  const [liveSignals, setLiveSignals] = useState<any[]>([]);
  const [autoTrading, setAutoTrading] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState('e6123145-9665-43e0-8413-cd61b8aa9b13');
  const [availableInstruments, setAvailableInstruments] = useState<Array<{ uid: string; name: string; ticker?: string }>>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(false);

  const [farmerInstruments, setFarmerInstruments] = useState<string[]>([]);

  // Активная вкладка
  const [activeTab, setActiveTab] = useState('sandbox');
  
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });

  const [showInstrumentDialog, setShowInstrumentDialog] = useState(false);
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [tempSelectedInstruments, setTempSelectedInstruments] = useState<string[]>([]);

  const [positionMarkers, setPositionMarkers] = useState<any[]>([]);
  
  const [chartLibrary, setChartLibrary] = useState<'lightweight' | 'chartjs' | 'amcharts'>('lightweight');

  const [compactMode, setCompactMode] = useState(false);

  const [farmerBatches, setFarmerBatches] = useState<BatchResult[]>([]);

  const [screenerResults, setScreenerResults] = useState<any[]>([]);

  const [activeAutoTraders, setActiveAutoTraders] = useState<string[]>([]);

  const [autoTraderLog, setAutoTraderLog] = useState<Array<{ time: string; text: string; type: 'signal' | 'order' | 'error' }>>([]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.onAutoTraderSignal((data: any) => {
      setAutoTraderLog(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString(),
        text: `${data.instrumentUid.slice(0,8)}: ${data.signal.type} @ ${data.signal.price?.toFixed(2)} - ${data.signal.message || ''}`,
        type: 'signal'
      }]);
    });
    api.onAutoTraderOrderSent((data: any) => {
      setAutoTraderLog(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString(),
        text: `Order sent: ${data.signal.type} ${data.signal.price}`,
        type: 'order'
      }]);
    });
    api.onAutoTraderOrderError((data: any) => {
      setAutoTraderLog(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString(),
        text: `Order error: ${data.error}`,
        type: 'error'
      }]);
    });

    return () => {
      api.removeAutoTraderListeners();
    };
  }, []);

  // ========== REFS ДЛЯ ГРАФИКА ==========
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const levelSeriesRef = useRef<any[]>([]);
  const signalSeriesRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const exitMarkersRef = useRef<any[]>([]);
  const positionMarkersRef = useRef<ISeriesApi<'Line'> | null>(null);

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
      trailingEnabled: sandbox.trailingEnabled,
      trailingPercent: sandbox.trailingPercent,
      maxSignalsPerDay: sandbox.maxSignalsPerDay,
      minIntervalMinutes: sandbox.minIntervalMinutes,
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

  const startAutoTraderHandler = async () => {
    const api = (window as any).electronAPI;
    if (!api?.startAutoTrader) return;
    await api.startAutoTrader(selectedInstrument);
    // Обновляем список активных
    const active = await api.getActiveAutoTraders();
    setActiveAutoTraders(active);
  };

  const stopAutoTraderHandler = async () => {
    const api = (window as any).electronAPI;
    if (!api?.stopAutoTrader) return;
    await api.stopAutoTrader(selectedInstrument);
    const active = await api.getActiveAutoTraders();
    setActiveAutoTraders(active);
  };

  // --- Stream ---
  useEffect(() => {
    const fetchActive = async () => {
      const api = (window as any).electronAPI;
      if (api?.getActiveAutoTraders) {
        const active = await api.getActiveAutoTraders();
        setActiveAutoTraders(active);
      }
    };
    fetchActive();
  }, []);

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
        // Удаляем дубликаты по времени (lightweight‑charts требует уникальное время)
        const uniqueFormatted = formatted.filter((c: any, i: number, arr: any[]) =>
          i === 0 || c.time !== arr[i - 1].time
        );
        setBacktestCandlesData(uniqueFormatted);   // ← бэктест-свечи
      }
      setBacktestProfile(result.profile);    // ← бэктест-профиль
      updateBacktest({ signals: result.signals, result, trades: result.trades || [] });
      // Автоматически переключаемся в режим Backtest после прогона
      setViewMode('backtest');
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

  // Запрос позиций каждые 15 секунд (только в live-режиме)
  useEffect(() => {
    if (viewMode !== 'live' || !sandbox.accountId) return;

    const api = (window as any).electronAPI;
    if (!api?.getPositions) return;

    const fetchPositions = async () => {
      const data = await api.getPositions(sandbox.accountId);
      const markers: SeriesMarker<Time>[] = [];
      const now = Math.floor(Date.now() / 1000) as Time;

      // Добавляем маркеры для ценных бумаг
      (data?.securities || []).forEach((pos: any) => {
        if (pos.instrumentUid && pos.averagePositionPrice) {
          const entryPrice = Number(pos.averagePositionPrice.units) + Number(pos.averagePositionPrice.nano) / 1e9;
          const isLong = (pos.quantity?.units || '0') >= '0'; // примерное определение
          markers.push({
            time: now,
            position: isLong ? 'belowBar' : 'aboveBar',
            color: isLong ? '#4caf50' : '#f44336',
            shape: isLong ? 'arrowUp' : 'arrowDown',
            text: `${isLong ? 'LONG' : 'SHORT'} @ ${entryPrice.toFixed(2)}`,
          });
        }
      });

      setPositionMarkers(markers);
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 15_000);
    return () => clearInterval(interval);
  }, [viewMode, sandbox.accountId]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (positionMarkersRef.current) {
      chart.removeSeries(positionMarkersRef.current);
    }

    if (!positionMarkers.length) return;

    const series = chart.addSeries(LineSeries, {
      lineVisible: false,
      lastValueVisible: false,
    });

    createSeriesMarkers(series, positionMarkers);
    positionMarkersRef.current = series;
  }, [positionMarkers]);
  
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
    if (!api?.batchBacktest || !api?.batchV2) return;

    setBatchRunning(true);
    setBatchResults([]);
    setBatchProgress({ completed: 0, total: 0 });

    api.removeBatchListeners();
    api.onBatchProgress((data: any) => {
      if (data.item) {
        setBatchResults(prev => [...prev, data.item]);
      }
      setBatchProgress({ completed: data.completed, total: data.total });
    });
    api.onBatchComplete(() => {
      setBatchProgress(null);
      setBatchRunning(false);
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

    // Выбор версии API
    const batchMethod = batchVersion === 'v1' ? api.batchBacktest : api.batchV2;

    batchMethod(
      batchInstruments,
      backtest.dateFrom,
      backtest.dateTo,
      batchParams.interval,
      stream.token,
      uniqueParamSets,
      batchParams.strategyType,
      backtest.profileResolution,
      backtest.valueAreaPercent
    );
  };

  const stopBatch = async () => {
    setBatchStopping(true);
    const api = (window as any).electronAPI;
    await api.stopBatch();
    api.removeBatchListeners();        // ← убираем старые подписки
    setBatchRunning(false);
    setBatchProgress(null);            // ← скрываем прогресс-бар
    setBatchStopping(false);
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

  const currentCandles = viewMode === 'live' ? candlesData : backtestCandlesData;
  const currentProfile = viewMode === 'live' ? profile : backtestProfile;
  const currentSignals = viewMode === 'live' ? liveSignals : backtest.signals;
  const currentTrades = viewMode === 'live' ? [] : backtest.trades;

  // ========== ЭФФЕКТЫ ГРАФИКА ==========
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const containerHeight = compactMode ? window.innerHeight - 60 : 400; // 60px – высота верхней панели
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: containerHeight,
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
    if (!chart || !currentCandles.length) return;

    if (candleSeriesRef.current) {
      chart.removeSeries(candleSeriesRef.current);
    }

    const aggregated = aggregateCandles(currentCandles, stream.displayTimeframe);

    // Удаляем дубликаты по времени (lightweight‑charts требует строго возрастающее уникальное время)
    const uniqueAggregated = aggregated.filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
    // Дополнительная сортировка на всякий случай
    uniqueAggregated.sort((a, b) => a.time - b.time);

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
    candleSeries.setData(uniqueAggregated);
    chart.timeScale().fitContent();
    candleSeriesRef.current = candleSeries;
  }, [currentCandles, stream.displayTimeframe]);

  // Обновление уровней
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !currentProfile || !currentCandles.length || currentCandles.length < 2) return;

    [...levelSeriesRef.current, ...exitMarkersRef.current].forEach(series => {
      try { chart.removeSeries(series); } catch {}
    });
    levelSeriesRef.current = [];

    const firstTime = currentCandles[0].time as UTCTimestamp;
    const lastTime = currentCandles[currentCandles.length - 1].time as UTCTimestamp;
    if (typeof firstTime !== 'number' || typeof lastTime !== 'number') return;

      // === ВОТ ЭТУ СТРОКУ ДОБАВЬТЕ ===
    if (firstTime === lastTime) return;

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

    addHorizontalLine(currentProfile.poc, 'red', 'POC', 3);
    addHorizontalLine(currentProfile.valueAreaHigh, 'green', 'VA High', 2);
    addHorizontalLine(currentProfile.valueAreaLow, 'green', 'VA Low', 2);
  }, [currentProfile, currentCandles]);

  // Маркеры сигналов
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !currentSignals.length) return;

    if (signalSeriesRef.current) {
      chart.removeSeries(signalSeriesRef.current);
    }

    const signalSeries = chart.addSeries(LineSeries, {
      lineVisible: false,
      lastValueVisible: false,
    });

    const markers: SeriesMarker<Time>[] = currentSignals.map(sig => ({
      time: (Math.floor(new Date(sig.time).getTime() / 1000)) as Time,
      position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: sig.type === 'BUY' ? 'green' : 'red',
      shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: sig.reason,
    }));

    createSeriesMarkers(signalSeries, markers);
    signalSeriesRef.current = signalSeries;
  }, [currentSignals]);

  // Маркеры выходов
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !currentTrades.length) return;

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
      const tradesOfReason = currentTrades.filter((t: any) => t.exitReason === key);
      if (tradesOfReason.length === 0) return;

      const data = tradesOfReason
        .map((trade: any) => {
          const timestamp = new Date(trade.exitTime).getTime();
          if (isNaN(timestamp)) return null; // отбрасываем невалидные даты
          return {
            time: Math.floor(timestamp / 1000) as Time,
            value: trade.exitPrice,
          };
        })
        .filter((d): d is { time: Time; value: number } => d !== null) // удаляем null
        .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1]?.time) // удаляем дубликаты
        .sort((a, b) => Number(a.time) - Number(b.time));

      if (data.length === 0) return;

      const series = chart.addSeries(LineSeries, {
        lineVisible: false,
        lastValueVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 5,
        color,
      });

      series.setData(data);
      exitMarkersRef.current.push(series);
    });

    chart.timeScale().fitContent();
  }, [currentTrades]);

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
      {/* ВЕРХНЯЯ ПАНЕЛЬ (компактная) */}
      <div className="flex align-items-center flex-wrap p-2 gap-2" style={{ background: '#1e1e1e', borderBottom: '1px solid #333' }}>
        {/* Инструмент */}
        <label className="mr-1 mb-0">Instr</label>
        <Dropdown
          value={selectedInstrument}
          options={availableInstruments.map(i => ({ label: `${i.name} (${i.ticker})`, value: i.uid }))}
          onChange={e => setSelectedInstrument(e.value)}
          placeholder="Select"
          filter
          className="p-inputtext-sm flex-1"
          style={{ minWidth: '180px', maxWidth: '250px' }}
        />
        <Button
          icon="pi pi-refresh"
          onClick={loadAllInstruments}
          disabled={instrumentsLoading}
          className="p-button-sm p-button-secondary p-1 px-2"
        />

        {/* Токен (компактный) */}
        <InputText
          value={stream.token}
          onChange={e => updateStream({ token: e.target.value })}
          className="p-inputtext-sm"
          placeholder="Token"
          style={{ width: '120px' }}
        />
        {/* TF */}
        <Dropdown
          value={stream.displayTimeframe}
          options={[{label:'1m',value:1},{label:'5m',value:5},{label:'15m',value:15},{label:'1h',value:60}]}
          onChange={e => updateStream({ displayTimeframe: e.value })}
          className="p-inputtext-sm"
          style={{ width: '80px' }}
        />
        {/* Start/Stop */}
        <Button
          label="Start"
          onClick={startStream}
          disabled={stream.active}
          className="p-button-sm border-round-sm p-1 px-2"
        />
        <Button
          label="Stop"
          onClick={stopStream}
          disabled={!stream.active}
          className="p-button-sm p-button-danger border-round-sm p-1 px-2"
        />
        <span style={{ color: stream.active ? '#4caf50' : '#d32f2f', minWidth: '60px', fontSize: '0.85rem' }}>
          {stream.active ? '● Live' : '○ Stopped'}
        </span>

        {/* Разделитель */}
        <div style={{ borderLeft: '1px solid #555', height: '24px', margin: '0 8px' }} />

        {/* Режим отображения (Live/Backtest) */}
        <Button
          label="Live"
          onClick={() => setViewMode('live')}
          className={`p-button-sm p-1 px-2 ${viewMode === 'live' ? 'p-button-primary' : 'p-button-secondary'}`}
        />
        <Button
          label="Backtest"
          onClick={() => setViewMode('backtest')}
          className={`p-button-sm p-1 px-2 ${viewMode === 'backtest' ? 'p-button-primary' : 'p-button-secondary'}`}
          disabled={!backtestCandlesData.length}
        />

        {/* Разделитель */}
        <div style={{ borderLeft: '1px solid #555', height: '24px', margin: '0 8px' }} />

        {/* Кнопка компактного режима */}
        <Button
          icon={compactMode ? 'pi pi-expand' : 'pi pi-compress'}
          onClick={() => setCompactMode(!compactMode)}
          className="p-button-sm p-button-secondary p-1 px-2"
          tooltip={compactMode ? 'Развернуть панели' : 'Компактный режим'}
        />

        {/* Доп. кнопки – можно добавить выпадающее меню для дат и параметров бэктеста */}
        {!compactMode && (
          <>
            <div style={{ borderLeft: '1px solid #555', height: '24px', margin: '0 8px' }} />
            <label className="mr-1 mb-0">Period:</label>
            <InputText type="date" value={backtest.dateFrom} onChange={e => updateBacktest({ dateFrom: e.target.value })} className="p-inputtext-sm" style={{ width: '130px' }} />
            <InputText type="date" value={backtest.dateTo} onChange={e => updateBacktest({ dateTo: e.target.value })} className="p-inputtext-sm" style={{ width: '130px' }} />
            <label className="ml-2 mr-1 mb-0">Max Signals/Day</label>
            <InputNumber value={sandbox.maxSignalsPerDay} onValueChange={e => updateSandbox({ maxSignalsPerDay: e.value ?? 0 })} min={0} step={1} size={2} className="p-inputtext-sm" />
            <label className="ml-2 mr-1 mb-0">Min Interval (min)</label>
            <InputNumber value={sandbox.minIntervalMinutes} onValueChange={e => updateSandbox({ minIntervalMinutes: e.value ?? 15 })} min={1} step={5} size={2} className="p-inputtext-sm" />
          </>
        )}
      </div>

      {/* TABVIEW (скрыт в компактном режиме) */}
      {!compactMode && (
        <TabView>
          {/* ========== SANDBOX ========== */}
          <TabPanel header="Sandbox">
            <Card className="surface-ground p-0">
              <div className="p-2">
                {/* Основная строка управления */}
                <div className="flex align-items-center flex-wrap gap-2">
                  <Dropdown
                    value={sandbox.accountId}
                    options={sandbox.accounts.map((a: any) => ({ label: a.name || a.id, value: a.id }))}
                    onChange={e => updateSandbox({ accountId: e.value })}
                    placeholder="Account"
                    className="p-inputtext-sm"
                    style={{ minWidth: '180px' }}
                  />
                  <Checkbox checked={sandbox.demoMode} onChange={e => updateSandbox({ demoMode: e.checked })} />
                  <label className="mr-2 mb-0">Demo</label>
                  <Button
                    label={autoTrading ? 'Stop' : 'Start'}
                    onClick={toggleTrading}
                    className={`p-button-sm ${autoTrading ? 'p-button-danger' : 'p-button-success'} border-round-sm p-1 px-2`}
                  />
                  <Button label="Apply" onClick={applyConfig} className="p-button-sm p-button-secondary border-round-sm p-1 px-2" />

                  <label className="mr-1 mb-0">Lots</label>
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

                  <label className="mr-1 mb-0">SL%</label>
                  <InputNumber
                    value={sandbox.stopLossPercent}
                    onValueChange={e => updateSandbox({ stopLossPercent: e.value ?? 0 })}
                    step={0.1} min={0} size={2} className="p-inputtext-sm"
                  />

                  <label className="mr-1 mb-0">TP%</label>
                  <InputNumber
                    value={sandbox.takeProfitPercent}
                    onValueChange={e => updateSandbox({ takeProfitPercent: e.value ?? 0 })}
                    step={0.1} min={0} size={2} className="p-inputtext-sm"
                  />

                  <Checkbox checked={sandbox.trailingEnabled} onChange={e => updateSandbox({ trailingEnabled: e.checked })} />
                  <label className="mr-1 mb-0">Trail</label>
                  {sandbox.trailingEnabled && (
                    <InputNumber
                      value={sandbox.trailingPercent}
                      onValueChange={e => updateSandbox({ trailingPercent: e.value ?? 0.5 })}
                      step={0.1} min={0} size={2} className="p-inputtext-sm"
                    />
                  )}

                  <Button
                    icon="pi pi-cog"
                    onClick={() => setShowSandboxSettings(true)}
                    className="p-button-sm p-button-secondary p-1 px-2"
                    tooltip="Settings"
                  />


                  <div className="flex align-items-center flex-wrap gap-2 mt-3">
                    <label className="mr-1 mb-0">Auto (Phase-based)</label>
                    <Button
                      label={activeAutoTraders.includes(selectedInstrument) ? 'Running...' : 'Start Auto Trader'}
                      onClick={startAutoTraderHandler}
                      disabled={!sandbox.accountId || stream.active === false}
                      className={`p-button-sm p-1 px-2 ${activeAutoTraders.includes(selectedInstrument) ? 'p-button-warning' : ''}`}
                      icon={activeAutoTraders.includes(selectedInstrument) ? 'pi pi-spin pi-spinner' : ''}
                    />
                    <Button
                      label="Stop Auto Trader"
                      onClick={stopAutoTraderHandler}
                      disabled={!activeAutoTraders.includes(selectedInstrument)}
                      className="p-button-sm p-button-danger p-1 px-2"
                    />
                    {activeAutoTraders.length > 0 && (
                      <span className="text-sm ml-2">
                        Active: {activeAutoTraders.map(uid => availableInstruments.find(i => i.uid === uid)?.ticker || uid.slice(0,8)).join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <h5>Лог автотрейдера</h5>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#111', color: '#ccc', padding: '8px', borderRadius: '4px' }}>
                      {autoTraderLog.length === 0 && <span>Ожидание сигналов...</span>}
                      {autoTraderLog.map((entry, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', borderBottom: '1px solid #333', padding: '2px 0' }}>
                          <span style={{ color: '#888' }}>{entry.time}</span>{' '}
                          <span style={{ color: entry.type === 'error' ? 'red' : entry.type === 'order' ? '#4caf50' : '#fff' }}>
                            {entry.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <span className="ml-auto">
                    {sandbox.balance && <span className="mr-2">{sandbox.balance}</span>}
                    {sandbox.payMessage && <span style={{ color: '#4caf50' }}>{sandbox.payMessage}</span>}
                  </span>
                </div>
              </div>
            </Card>

            {/* Диалог настроек песочницы */}
            <Dialog
              header="Sandbox Settings"
              visible={showSandboxSettings}
              style={{ width: '500px' }}
              onHide={() => setShowSandboxSettings(false)}
            >
              <div className="p-fluid">
                <div className="p-field mb-3">
                  <label>Token</label>
                  <InputText
                    value={sandbox.token}
                    onChange={e => updateSandbox({ token: e.target.value })}
                    className="p-inputtext-sm"
                    placeholder="Sandbox token"
                  />
                </div>
                <div className="p-field mb-3">
                  <div className="flex gap-2">
                    <Button
                      label="Load"
                      onClick={loadAccounts}
                      disabled={!sandbox.token || sandbox.loadingAccounts}
                      className="p-button-sm p-button-secondary"
                    />
                    <Button
                      label="Create"
                      onClick={handleCreateAccount}
                      disabled={sandbox.creatingAccount}
                      className="p-button-sm p-button-success"
                    />
                    <Button
                      label="Delete"
                      onClick={handleCloseAccount}
                      disabled={!sandbox.accountId}
                      className="p-button-sm p-button-danger"
                    />
                  </div>
                </div>
                <div className="p-field mb-3">
                  <label>Pay In (RUB)</label>
                  <div className="p-inputgroup">
                    <InputNumber
                      value={sandbox.payAmount}
                      onValueChange={e => updateSandbox({ payAmount: e.value ?? 1000 })}
                      min={1000} step={1000} className="p-inputtext-sm"
                    />
                    <Button label="Deposit" onClick={handlePayIn} className="p-button-sm" />
                  </div>
                </div>
                <div className="p-field mb-3">
                  <Button label="Refresh Balance" onClick={refreshBalance} className="p-button-sm p-button-info" />
                </div>
              </div>
            </Dialog>
          </TabPanel>

          {/* ========== BACKTEST ========== */}
          <TabPanel header="Backtest">
            <Card className="surface-ground p-0">
              <div className="p-2">
                {/* Основная строка: инструмент, кнопка Run, результат */}
                <div className="flex align-items-center flex-wrap gap-2">
                  <label className="mr-1 mb-0">Instr</label>
                  <Dropdown
                    value={selectedInstrument}
                    options={availableInstruments.map(i => ({ label: `${i.name} (${i.ticker})`, value: i.uid }))}
                    onChange={e => setSelectedInstrument(e.value)}
                    placeholder="Select"
                    filter
                    className="p-inputtext-sm flex-1 mr-2"
                    style={{ minWidth: '200px' }}
                  />
                  <Button
                    icon="pi pi-refresh"
                    onClick={loadAllInstruments}
                    disabled={instrumentsLoading}
                    className="p-button-sm p-button-secondary p-1 px-3 mr-2"
                  />
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
                    className="p-button-sm p-button-warning border-round-sm p-1 px-3 mr-2"
                  />
                  <Button
                    label={showBacktestAdvanced ? 'Hide Advanced' : 'Advanced'}
                    onClick={() => setShowBacktestAdvanced(!showBacktestAdvanced)}
                    className="p-button-sm p-button-secondary p-1 px-2"
                  />
                </div>

                {/* Расширенные параметры (скрыты по умолчанию) */}
                {showBacktestAdvanced && (
                  <div className="flex align-items-center flex-wrap gap-2 mt-2">
                    <label className="mr-1 mb-0">Int</label>
                    <Dropdown
                      value={backtest.interval}
                      options={['1min','5min','15min','1hour']}
                      onChange={e => updateBacktest({ interval: e.value })}
                      className="p-inputtext-sm mr-2"
                      style={{ width: '80px' }}
                    />
                    <label className="mr-1 mb-0">VA%</label>
                    <InputNumber value={backtest.valueAreaPercent} onValueChange={e => updateBacktest({ valueAreaPercent: e.value ?? 70 })} min={50} max={90} step={5} size={2} className="mr-2" />
                    <label className="mr-1 mb-0">Res</label>
                    <InputNumber value={backtest.profileResolution} onValueChange={e => updateBacktest({ profileResolution: e.value ?? 50 })} min={10} max={200} step={10} size={2} className="mr-2" />
                    <label className="mr-1 mb-0">Strat</label>
                    <Dropdown
                      value={backtest.strategyType}
                      options={[
                        'volume_accumulation',
                        'trend',
                        'trend_pro',
                        'poc_pullback',
                        'daily_va_return',
                        'fvg_volume',
                        'rejection',
                        'initial_balance',
                        'va_breakout_retest',
                        'sfp',
                        'anchored_vwap',
                        'absorption',
                        'exhaustion',
                      ]}
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

                {/* Результат бэктеста */}
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
                            params: {
                              sl: backtest.stopLossPercent,
                              tp: backtest.takeProfitPercent,
                              trail: backtest.trailingDistancePercent,
                              lots: backtest.lots,
                              sizing: backtest.positionSizing,
                              risk: backtest.riskPercent,
                            },
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
          </TabPanel>

          {/* ========== BATCH ============= */}
          <TabPanel header="Batch">
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
            </Card>

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
                      'volume_accumulation',
                      'trend',
                      'trend_pro',
                      'poc_pullback',
                      'daily_va_return',
                      'fvg_volume',
                      'rejection',
                      'initial_balance',
                      'va_breakout_retest',
                      'sfp',
                      'anchored_vwap',
                      'absorption',
                      'exhaustion',
                    ]}
                    onChange={e => setBatchParams({ ...batchParams, strategyType: e.value })}
                    className="p-inputtext-sm"
                  />
                </div>

                {/* Strategy */}
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

                {/* SL, TP, Trail, Lots (как в старой форме) */}
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

            {/* Диалог выбора инструментов (без изменений) */}
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
          </TabPanel>

          {/* ========== SIGNALS =========== */}
          <TabPanel header="Signals">
            <Card className="surface-ground p-2">
              <h4 className="p-mb-2">Signals</h4>
              {currentSignals.length > 0 ? (
                <ul className="p-pl-3" style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
                  {currentSignals.map((sig, idx) => (
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
              {currentProfile ? (
                <>
                  <div className="p-mb-2" style={{ color: '#d1d4dc' }}>
                    <p>POC: {currentProfile.poc.toFixed(2)}</p>
                    <p>Value Area: {currentProfile.valueAreaLow.toFixed(2)} – {currentProfile.valueAreaHigh.toFixed(2)}</p>
                    <p>Total Volume: {currentProfile.totalVolume}</p>
                  </div>
                  {currentProfile.volumeByPrice?.length > 0 && (
                    <>
                      <h5>Top 10 Levels</h5>
                      <ul className="p-pl-3" style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
                        {currentProfile.volumeByPrice
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
            <TradesTab currentTrades={currentTrades} trades={backtest.trades} />
          </TabPanel>

          {/* ========== POS/ORDERS ======== */}
          <TabPanel header="Pos/Orders">
            <PositionsOrdersTab accountId={sandbox.accountId} />
          </TabPanel>
          
          {/* ========== POS/ORDERS ======== */}
          <TabPanel header="Log">
            <LogTab accountId={sandbox.accountId} />
          </TabPanel>

          {/* ========== SCREENER ========== */}
          <TabPanel header="Screener">
            <ScreenerTab
              token={stream.token}
              results={screenerResults}
              setResults={setScreenerResults}
              onSendToFarmer={setFarmerInstruments}
            />
          </TabPanel>

          {/* ========== CLOUD ============= */}
          <TabPanel header="Cloud">
            <CloudTab />
          </TabPanel>

          {/* ========== FARMER ============ */}
          <TabPanel header="Farmer">
            <CloudFarmerTab
              token={stream.token}
              batches={farmerBatches}
              setBatches={setFarmerBatches}
              farmerInstruments={farmerInstruments}
              setFarmerInstruments={setFarmerInstruments}
            />
          </TabPanel>
        </TabView>
      )}

      {/* Выбор типа профиля и графика – только когда не compact или всегда видно? */}
      {!compactMode && (
        <>
          <div style={{ borderLeft: '1px solid #555', height: '8px', margin: '0 8px' }} />
          <span className="mr-1">Profile:</span>
          <Dropdown
            value={profileType}
            options={['side', 'overlay']}
            onChange={e => setProfileType(e.value)}
            className="p-inputtext-sm"
            style={{ width: '80px' }}
          />
          <span className="mr-1">Chart:</span>
          <Dropdown
            value={chartLibrary}
            options={['lightweight', 'chartjs', 'amcharts']}
            onChange={e => setChartLibrary(e.value)}
            className="p-inputtext-sm"
            style={{ width: '100px' }}
          />
        </>
      )}
   
      {/* Старый график lightweight-charts */}
      {chartLibrary === 'lightweight' && (
        <div className="chart-row">
          {profileType === 'side' && currentProfile?.volumeByPrice && priceRange.max > 0 && (
            <div className="volume-profile-container">
              <VolumeProfileBars
                data={currentProfile.volumeByPrice}
                maxVolume={Math.max(...currentProfile.volumeByPrice.map((v: any) => v.volume))}
                minPrice={priceRange.min}
                maxPrice={priceRange.max}
                height={400}
                poc={currentProfile.poc}
                vah={currentProfile.valueAreaHigh}
                val={currentProfile.valueAreaLow}
              />
            </div>
          )}
          {profileType === 'overlay' && (
            <VolumeProfileOverlay
              volumeByPrice={currentProfile?.volumeByPrice}
              poc={currentProfile?.poc}
              vah={currentProfile?.valueAreaHigh}
              val={currentProfile?.valueAreaLow}
              visible={!!currentProfile?.volumeByPrice}
            />
          )}
          <div className="chart-container" ref={chartContainerRef} />
        </div>
      )}
      {/* Новый график Chart.js */}
      {chartLibrary === 'chartjs' && (
        <div className="chart-row">
          {profileType === 'side' && currentProfile?.volumeByPrice && priceRange.max > 0 && (
            <div className="volume-profile-container">
              <VolumeProfileBars
                data={currentProfile.volumeByPrice}
                maxVolume={Math.max(...currentProfile.volumeByPrice.map((v: any) => v.volume))}
                minPrice={priceRange.min}
                maxPrice={priceRange.max}
                height={400}
                poc={currentProfile.poc}
                vah={currentProfile.valueAreaHigh}
                val={currentProfile.valueAreaLow}
              />
            </div>
          )}
          {profileType === 'overlay' && (
            <VolumeProfileOverlay
              volumeByPrice={currentProfile?.volumeByPrice}
              poc={currentProfile?.poc}
              vah={currentProfile?.valueAreaHigh}
              val={currentProfile?.valueAreaLow}
              visible={!!currentProfile?.volumeByPrice}
            />
          )}
          
          {/* Основной график */}
          <div className="chart-container" style={{ flex: 1, minWidth: 0, height: 400 }}>
            <CandlestickChart
              candlesData={aggregateCandles(currentCandles, stream.displayTimeframe)}
              poc={currentProfile?.poc}
              vah={currentProfile?.valueAreaHigh}
              val={currentProfile?.valueAreaLow}
              signals={currentSignals}
              trades={currentTrades}
              positions={[]}
            />
          </div>
        </div>
      )}
      {/* Новый график amcharts */}
      {chartLibrary === 'amcharts' && (
        <AmChartsStockChart
          candlesData={currentCandles}
          volumeByPrice={currentProfile?.volumeByPrice}
          poc={currentProfile?.poc}
          vah={currentProfile?.valueAreaHigh}
          val={currentProfile?.valueAreaLow}
        />
      )}
    
    </div>
  );
};