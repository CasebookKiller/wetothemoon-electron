import React, { useEffect, useState, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  CandlestickSeries,
  Time,
  UTCTimestamp,
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  createSeriesMarkers,
} from 'lightweight-charts';
import VolumeProfileBars from '@/components/TRADING_ASSISTANT/VolumeProfileBars/VolumeProfileBars';
import './TradingAssistantPage.css';

// Типы (оставлены локально)
interface VolumeProfileLevels {
  instrumentUid: string;
  timestamp: string;
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  hvn: number[];
  lvn: number[];
  totalVolume: number;
  volumeByPrice: Array<{ price: number; volume: number }>;
}

interface Signal {
  instrumentUid: string;
  time: string;
  type: string;
  price: number;
  level: number;
  message: string;
}

interface BacktestSignal {
  type: 'BUY' | 'SELL';
  price: number;
  time: string;
  instrumentUid: string;
  reason: string;
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

const getLastTradingDay = (): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  do {
    date.setDate(date.getDate());
  } while (date.getDay() === 0 || date.getDay() === 6);
  return date;
};

export const TradingAssistantPage: React.FC = () => {
  // ---------- Группировка состояний ----------
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

  const [stream, setStream] = useState({
    active: false,
    token: import.meta.env.VITE_TReadOnly || '',
    displayTimeframe: 5 as 1 | 5 | 15 | 60,
  });

  const lastTradingDay = getLastTradingDay();
  const lastTradingDayStr = lastTradingDay.toISOString().split('T')[0];

  const [backtest, setBacktest] = useState({
    dateFrom: lastTradingDayStr,
    dateTo: lastTradingDayStr,
    interval: '1min',
    valueAreaPercent: 70,
    profileResolution: 50,
    strategyType: 'volume_accumulation',
    stopLossPercent: 0.5,
    takeProfitPercent: 1.0,
    loading: false,
    result: null as any,
    signals: [] as BacktestSignal[],
    trailingDistancePercent: 0.5,
    lots: 1,
    positionSizing: 'fixed' as 'fixed' | 'dynamic',  // ← добавить
    riskPercent: 1.0,                                 // ← добавить
    trades: [] as any[],
  });

  // Локальные состояния (часто обновляемые)
  const [profile, setProfile] = useState<VolumeProfileLevels | null>(null);
  const [liveSignals, setLiveSignals] = useState<Signal[]>([]);
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [autoTrading, setAutoTrading] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState('e6123145-9665-43e0-8413-cd61b8aa9b13');
  const [activeTab, setActiveTab] = useState('sandbox');
  const [availableInstruments, setAvailableInstruments] = useState<Array<{ uid: string; name: string; ticker?: string }>>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // ... (все остальные refs: chartRef, candleSeriesRef и т.д.)
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const exitMarkersRef = useRef<ISeriesApi<'Line'>[]>([]);

  // ---------- Функции для инструментов ----------
  const loadAllInstruments = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getAllInstruments) return;
    setInstrumentsLoading(true);
    try {
      const list = await api.getAllInstruments(stream.token); // или sandbox.token, но нужен токен с доступом к инструментам (read‑only подойдёт)
      setAvailableInstruments(list);
    } catch (e) {
      console.error(e);
    } finally {
      setInstrumentsLoading(false);
    }
  };

  // ---------- Функции для sandbox ----------
  const updateSandbox = (patch: Partial<typeof sandbox>) => setSandbox(prev => ({ ...prev, ...patch }));

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

  // ---------- Функции для stream ----------
  const updateStream = (patch: Partial<typeof stream>) => setStream(prev => ({ ...prev, ...patch }));

  const startStream = async () => {
    const api = (window as any).electronAPI;
    if (!api?.startMarketStream || !api?.getTodayCandles) return;

    try {
      const historical = await api.getTodayCandles(
        selectedInstrument,
        stream.token,
        '1min'
      );

      if (historical && historical.length > 0) {
        const formatted = historical.map((c: any) => ({
          time: (Math.floor(new Date(c.time).getTime() / 1000)) as UTCTimestamp,
          open: quotationToNumber(c.open),
          high: quotationToNumber(c.high),
          low: quotationToNumber(c.low),
          close: quotationToNumber(c.close),
        }));
        setCandlesData(formatted);
      }

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

  // ---------- Функции для backtest ----------
  const updateBacktest = (patch: Partial<typeof backtest>) => setBacktest(prev => ({ ...prev, ...patch }));

  const runBacktest = async () => {
    if (backtest.loading) return;
    updateBacktest({ loading: true });

    const api = (window as any).electronAPI;
    if (!api?.runBacktest) return;
    const token = import.meta.env.VITE_TReadOnly;
    console.log('Sending lots:', backtest.lots);
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
        lots: backtest.lots,   // ← передаём
        positionSizing: backtest.positionSizing,
        riskPercent: backtest.riskPercent,
      }
    );
    if (result) {
      console.log('[Backtest Trades]', result.trades);
      setProfile(result.profile);
      updateBacktest({ signals: result.signals, result, trades: result.trades || [] });
      console.log('[Backtest State]', backtest.trades);
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
    }
    updateBacktest({ loading: false });
    console.log('[Backtest Result]', result);
  };

  const sendBacktestToSandbox = async () => {
    const api = (window as any).electronAPI;
    if (!api?.sendBacktestSignals) return;
    await api.sendBacktestSignals(backtest.signals);
    alert('Сигналы отправлены в OrderManager');
  };

  // ---------- Жизненные циклы и подписки ----------
  useEffect(() => {
    if (sandbox.token) loadAccounts();
  }, [sandbox.token]);

  useEffect(() => {
    if (sandbox.accountId) refreshBalance();
  }, [sandbox.accountId]);

  // Подписка на live-свечи
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

      if (isNaN(timestampMs)) {
        console.warn('Invalid candle time:', streamCandle.time);
        return;
      }

      const newCandle = {
        time: Math.floor(timestampMs / 1000) as UTCTimestamp,
        open: quotationToNumber(streamCandle.open),
        high: quotationToNumber(streamCandle.high),
        low: quotationToNumber(streamCandle.low),
        close: quotationToNumber(streamCandle.close),
      };

      setCandlesData(prev => {
        if (prev.some(c => c.time === newCandle.time)) return prev;
        const updated = [...prev, newCandle];
        updated.sort((a, b) => a.time - b.time);
        return updated.slice(-500);
      });
    };

    api.onCandle(handleCandle);

    return () => {
      api.removeCandleListener();
    };
  }, []);

  // Подписка на профиль и сигналы
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.subscribeTradingAssistant();

    const onProfile = (newProfile: VolumeProfileLevels) => {
      if (newProfile.instrumentUid === selectedInstrument) {
        setProfile(newProfile);
      }
    };
    const onSignal = (signal: Signal) => {
      console.log('[Live Signal]', signal);
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

  // Инструменты
  useEffect(() => {
    if (stream.token) loadAllInstruments();
  }, [stream.token]);

  // Инициализация графика + подписка на зум
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      timeScale: {
        timeVisible: true,
        borderColor: '#2a2e39',
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
    });

    chartRef.current = chart;
    (window as any).__CHART__ = chart;

    // Подписка на изменение размера контейнера
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
      }
    });
    resizeObserver.observe(container);

    const timeScale = chart.timeScale();
    const priceScale = chart.priceScale('right');
    const updatePriceRange = () => {
      const range = priceScale.getVisibleRange();
      if (range) setPriceRange({ min: range.from, max: range.to });
    };
    timeScale.subscribeVisibleTimeRangeChange(updatePriceRange);
    updatePriceRange();

    return () => {
      resizeObserver.disconnect();
      timeScale.unsubscribeVisibleTimeRangeChange(updatePriceRange);
      // Очищаем серии выходов
      exitMarkersRef.current.forEach(series => {
        try { chart.removeSeries(series); } catch {}
      });
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
    candleSeriesRef.current = candleSeries;
  }, [candlesData, stream.displayTimeframe]);

  // Обновление уровней
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !profile || !candlesData.length || candlesData.length < 2) return;

    [...levelSeriesRef.current, ...volumeSeriesRef.current].forEach(series => {
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

  const exitMarkersPrimitiveRef = useRef<any>(null);
  // Маркеры выходов (SL, TP, TRAIL, END_OF_DAY)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !backtest.trades.length) return;

    // Очищаем предыдущие серии выходов
    exitMarkersRef.current.forEach(series => {
      try { chart.removeSeries(series); } catch {}
    });
    exitMarkersRef.current = [];

    // Цвета и легенда
    const reasons = [
      { key: 'TAKE_PROFIT', label: 'TP', color: '#4caf50' },
      { key: 'STOP_LOSS', label: 'SL', color: '#f44336' },
      { key: 'TRAILING_STOP', label: 'Trail', color: '#2196f3' },
      { key: 'END_OF_DAY', label: 'EOD', color: '#ffeb3b' },
      { key: 'SIGNAL', label: 'Signal', color: '#9e9e9e' },
    ];

    reasons.forEach(({ key, color }) => {
      const tradesOfReason = backtest.trades.filter((t: any) => t.exitReason === key);
      if (tradesOfReason.length === 0) return;

      const series = chart.addSeries(LineSeries, {
        lineVisible: false,
        lastValueVisible: false,
        pointMarkersVisible: true,
        pointMarkersRadius: 5,          // увеличенный радиус
        color: color,
      });

      const data = tradesOfReason.map((trade: any) => ({
        time: (Math.floor(new Date(trade.exitTime).getTime() / 1000)) as Time,
        value: trade.exitPrice,
      }));

      series.setData(data);
      exitMarkersRef.current.push(series);
    });

    // Подгоняем масштаб
    chart.timeScale().fitContent();
  }, [backtest.trades]);
  
/*  useEffect(() => {
    const chart = chartRef.current;
    console.log('[Exit Markers] chart:', !!chart, 'trades:', backtest.trades.length);
    if (!chart || !backtest.trades.length) return;

    // Удаляем предыдущий примитив и серию, если они есть
    if (exitMarkersPrimitiveRef.current) {
      try {
        exitMarkersPrimitiveRef.current.detach();
      } catch {}
      exitMarkersPrimitiveRef.current = null;
    }
    if (exitMarkersRef.current) {
      try {
        chart.removeSeries(exitMarkersRef.current);
      } catch {}
      exitMarkersRef.current = null;
    }

    const exitSeries = chart.addSeries(LineSeries, {
      lineVisible: false,
      lastValueVisible: false,
    });

    const markers: SeriesMarker<Time>[] = backtest.trades.map((trade: any) => ({
      time: (Math.floor(new Date(trade.exitTime).getTime() / 1000)) as Time,
      position: 'aboveBar',
      color:
        trade.exitReason === 'TAKE_PROFIT' ? '#4caf50' :
        trade.exitReason === 'STOP_LOSS' ? '#f44336' :
        trade.exitReason === 'TRAILING_STOP' ? '#2196f3' : '#ffeb3b',
      shape:
        trade.exitReason === 'TAKE_PROFIT' ? 'circle' :
        trade.exitReason === 'STOP_LOSS' ? 'square' :
        trade.exitReason === 'TRAILING_STOP' ? 'arrowUp' : 'arrowDown',
      text: `${trade.exitReason} @ ${trade.exitPrice}`,
      size: 5,
    }));

    console.log('[Exit Markers] markers count:', markers.length);
    const primitive = createSeriesMarkers(exitSeries, markers);
    exitMarkersPrimitiveRef.current = primitive;
    exitMarkersRef.current = exitSeries;

    // Подгоняем масштаб
    chart.timeScale().fitContent();
  }, [backtest.trades]);
*/
  const loadProfile = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const p = await api.getVolumeProfile(selectedInstrument);
    if (p) setProfile(p);
  };

  // ---------- Рендер панелей ----------
  const renderSandboxPanel = () => (
    <div className="tab-panel">
      <h3>Sandbox Settings</h3>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Token" value={sandbox.token} onChange={e => updateSandbox({ token: e.target.value })} style={{ width: '200px' }} />
        <button onClick={handleCreateAccount} disabled={sandbox.creatingAccount}>{sandbox.creatingAccount ? '...' : 'Создать счёт'}</button>
        <button onClick={handleCloseAccount} disabled={!sandbox.accountId}>Удалить счёт</button>
        <select value={sandbox.accountId} onChange={e => updateSandbox({ accountId: e.target.value })} style={{ width: '180px' }}>
          <option value="">-- счёт --</option>
          {sandbox.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name || acc.id}</option>)}
        </select>
        <button onClick={loadAccounts} disabled={!sandbox.token || sandbox.loadingAccounts}>Load Accounts</button>
        <label><input type="checkbox" checked={sandbox.demoMode} onChange={e => updateSandbox({ demoMode: e.target.checked })} /> Demo</label>
      </div>
      <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={applyConfig}>Apply Config</button>
        <button onClick={toggleTrading}>{autoTrading ? 'Stop Auto Trading' : 'Start Auto Trading'}</button>
        <label>Lots: <input type="number" value={sandbox.lotQty} onChange={e => updateSandbox({ lotQty: Number(e.target.value) })} min={1} style={{ width: '60px' }} /></label>
        <label>SL%: <input type="number" value={sandbox.stopLossPercent} onChange={e => updateSandbox({ stopLossPercent: Number(e.target.value) })} step={0.1} style={{ width: '50px' }} /></label>
        <label>TP%: <input type="number" value={sandbox.takeProfitPercent} onChange={e => updateSandbox({ takeProfitPercent: Number(e.target.value) })} step={0.1} style={{ width: '50px' }} /></label>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <input type="number" value={sandbox.payAmount} onChange={e => updateSandbox({ payAmount: Number(e.target.value) })} min={1000} step={1000} style={{ width: '100px' }} />
          <button onClick={handlePayIn}>Пополнить</button>
          {sandbox.payMessage && <span style={{ color: '#4caf50' }}>{sandbox.payMessage}</span>}
        </div>
        <button onClick={refreshBalance}>Баланс</button>
        {sandbox.balance && <span style={{ color: '#d1d4dc' }}>{sandbox.balance}</span>}
      </div>
    </div>
  );

  const renderStreamPanel = () => (
    <div className="tab-panel">
      <h3>Market Stream</h3>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Read-only token" value={stream.token} onChange={e => updateStream({ token: e.target.value })} style={{ width: '200px' }} />
        <label>TF: 
          <select value={stream.displayTimeframe} onChange={e => updateStream({ displayTimeframe: Number(e.target.value) as 1 | 5 | 15 | 60 })} style={{ marginLeft: '4px' }}>
            <option value={1}>1m</option><option value={5}>5m</option><option value={15}>15m</option><option value={60}>1h</option>
          </select>
        </label>
        <button onClick={startStream} disabled={stream.active}>Start Stream</button>
        <button onClick={stopStream} disabled={!stream.active}>Stop Stream</button>
        <span style={{ color: stream.active ? '#4caf50' : '#d32f2f' }}>{stream.active ? '● Live' : '○ Stopped'}</span>
      </div>
    </div>
  );

  const renderBacktestPanel = () => { 
    const stats = backtest.result?.stats;
    const portfolio = stats?.portfolio;
    const sizingStr = backtest.positionSizing === 'dynamic'
      ? `Dynamic (Risk ${backtest.riskPercent}%)`
      : 'Fixed';

    // Текст для копирования (можно скопировать и отображаемую строку, но лучше сформировать вручную без HTML)
    const copyText = [
      `Instrument: ${availableInstruments.find(inst => inst.uid === selectedInstrument)?.name}`,
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
      navigator.clipboard.writeText(copyText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    return (
      <div className="tab-panel">
        <h3>Backtest</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label>Instrument:
            <select value={selectedInstrument} onChange={e => setSelectedInstrument(e.target.value)}>
              {availableInstruments.length === 0 && <option value="">-- загрузка... --</option>}
              {availableInstruments.map(inst => (
                <option key={inst.uid} value={inst.uid}>{inst.name} ({inst.ticker})</option>
              ))}
            </select>
          </label>
          <button onClick={loadAllInstruments} disabled={instrumentsLoading} style={{ marginLeft: '5px' }}>
            {instrumentsLoading ? '...' : '🔄'}
          </button>
          <label>From: <input type="date" value={backtest.dateFrom} onChange={e => updateBacktest({ dateFrom: e.target.value })} /></label>
          <label>To: <input type="date" value={backtest.dateTo} onChange={e => updateBacktest({ dateTo: e.target.value })} /></label>
          <label>Interval: 
            <select value={backtest.interval} onChange={e => updateBacktest({ interval: e.target.value })}>
              <option value="1min">1m</option><option value="5min">5m</option><option value="15min">15m</option><option value="1hour">1h</option>
            </select>
          </label>
          <label>VA%: <input type="number" value={backtest.valueAreaPercent} onChange={e => updateBacktest({ valueAreaPercent: Number(e.target.value) })} min={50} max={90} step={5} style={{ width: '60px' }} /></label>
          <label>Res: <input type="number" value={backtest.profileResolution} onChange={e => updateBacktest({ profileResolution: Number(e.target.value) })} min={10} max={200} step={10} style={{ width: '60px' }} /></label>
          <label>Strategy: 
            <select value={backtest.strategyType} onChange={e => updateBacktest({ strategyType: e.target.value })}>
              <option value="volume_accumulation">Vol Accum</option>
              <option value="trend">Trend</option>
            </select>
          </label>
          <label>SL%: <input type="number" value={backtest.stopLossPercent} onChange={e => updateBacktest({ stopLossPercent: Number(e.target.value) })} step={0.1} style={{ width: '50px' }} /></label>
          <label>TP%: <input type="number" value={backtest.takeProfitPercent} onChange={e => updateBacktest({ takeProfitPercent: Number(e.target.value) })} step={0.1} style={{ width: '50px' }} /></label>
          <label>Lots: <input type="number" value={backtest.lots} onChange={e => updateBacktest({ lots: Number(e.target.value) })} min={1} step={1} style={{ width: '60px' }} /></label>
          <label>Size:
            <select value={backtest.positionSizing} onChange={e => updateBacktest({ positionSizing: e.target.value as 'fixed' | 'dynamic' })}>
              <option value="fixed">Fixed</option>
              <option value="dynamic">Dynamic</option>
            </select>
          </label>
          {backtest.positionSizing === 'dynamic' && (
            <label>Risk%: <input type="number" value={backtest.riskPercent} onChange={e => updateBacktest({ riskPercent: Number(e.target.value) })} step={0.1} style={{ width: '50px' }} /></label>
          )}
          <label>Trail%: <input type="number" value={backtest.trailingDistancePercent} onChange={e => updateBacktest({ trailingDistancePercent: Number(e.target.value) })} step={0.1} style={{ width: '50px' }} /></label>
          <button onClick={runBacktest} disabled={backtest.loading}>Run</button>
          <button onClick={sendBacktestToSandbox} disabled={!backtest.signals.length}>Send to Sandbox</button>
        </div>
        {backtest.result?.stats && backtest.result.stats.portfolio && (
          <div className="backtest-stats" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{ margin: 0, flex: 1 }}>
              Instrument: {availableInstruments.find(inst => inst.uid === selectedInstrument)?.name}
              {' | '}Strategy: {backtest.strategyType === 'trend' ? 'Trend' : 'Volume Accum'}
                {' | '}Period: {backtest.dateFrom} – {backtest.dateTo}
                {' | '}Signals: {stats.totalSignals}
                {' | '}Trades: {portfolio.totalTrades}
                (W: {portfolio.winningTrades} / L: {portfolio.losingTrades})
                {' | '}WinRate: {portfolio.winRate?.toFixed(1)}%
                {' | '}Profit: <span className={portfolio.totalProfit >= 0 ? 'positive' : 'negative'}>
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
              <button onClick={handleCopy} style={{ padding: '2px 8px', background: '#2a2e39', color: '#d1d4dc', border: '1px solid #555', borderRadius: '3px', cursor: 'pointer' }}>
                {copied ? '✓' : '📋'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSignalsPanel = () => (
    <div className="tab-panel">
      <h3>Live Signals</h3>
      <ul style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
        {liveSignals.map((sig, idx) => (
          <li key={idx}><strong>{sig.type}</strong>: {sig.message} @ {sig.price}</li>
        ))}
      </ul>
    </div>
  );

  const renderProfilePanel = () => (
    <div className="tab-panel">
      <h3>Volume Profile Data</h3>
      {profile ? (
        <>
          <div style={{ color: '#d1d4dc', marginBottom: '10px' }}>
            <p>POC: {profile.poc.toFixed(2)}</p>
            <p>Value Area: {profile.valueAreaLow.toFixed(2)} – {profile.valueAreaHigh.toFixed(2)}</p>
            <p>Total Volume: {profile.totalVolume}</p>
          </div>
          {profile.volumeByPrice && profile.volumeByPrice.length > 0 && (
            <div>
              <h4>Top 10 Levels</h4>
              <ul style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
                {profile.volumeByPrice
                  .sort((a, b) => b.volume - a.volume)
                  .slice(0, 10)
                  .map(({ price, volume }) => (
                    <li key={price}>
                      {price.toFixed(2)} – {volume.toFixed(0)}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: '#888' }}>Нет данных профиля</p>
      )}
    </div>
  );

  const renderTradesPanel = () => (
    <div className="tab-panel">
      <h3>Trade History</h3>
      {backtest.trades.length > 0 ? (
        <div style={{ maxHeight: '400px', overflowY: 'auto', color: '#d1d4dc' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <td className={t.profit >= 0 ? 'positive' : 'negative'}>{t.profit.toFixed(2)}</td>
                  <td>{t.exitReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#888' }}>No trades yet</p>
      )}
    </div>
  );

  return (
    <div className="trading-assistant">
      <h1>Trading Assistant</h1>
      <div className="tabs">
        <button onClick={() => setActiveTab('sandbox')} className={activeTab === 'sandbox' ? 'active' : ''}>Sandbox</button>
        <button onClick={() => setActiveTab('stream')} className={activeTab === 'stream' ? 'active' : ''}>Stream</button>
        <button onClick={() => setActiveTab('backtest')} className={activeTab === 'backtest' ? 'active' : ''}>Backtest</button>
        <button onClick={() => setActiveTab('signals')} className={activeTab === 'signals' ? 'active' : ''}>Signals</button>
        <button onClick={() => setActiveTab('profile')} className={activeTab === 'profile' ? 'active' : ''}>Profile</button>
        <button onClick={() => setActiveTab('trades')} className={activeTab === 'trades' ? 'active' : ''}>Trades</button>
      </div>

      {activeTab === 'sandbox' && renderSandboxPanel()}
      {activeTab === 'stream' && renderStreamPanel()}
      {activeTab === 'backtest' && renderBacktestPanel()}
      {activeTab === 'signals' && renderSignalsPanel()}
      {activeTab === 'profile' && renderProfilePanel()}
      {activeTab === 'trades' && renderTradesPanel()}

      <div className="chart-row">
        {profile?.volumeByPrice && priceRange.max > 0 && (
          <div className="volume-profile-container">
            <VolumeProfileBars
              data={profile.volumeByPrice}
              maxVolume={Math.max(...profile.volumeByPrice.map(v => v.volume))}
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
        {backtest.trades.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[
              { label: 'Take Profit', color: '#4caf50' },
              { label: 'Stop Loss', color: '#f44336' },
              { label: 'Trailing Stop', color: '#2196f3' },
              { label: 'End of Day', color: '#ffeb3b' },
              { label: 'Signal', color: '#9e9e9e' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#d1d4dc', fontSize: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
