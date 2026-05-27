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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay(); // 0 = вс, 6 = сб
  let offset = 1;
  if (day === 1) offset = 3; // понедельник -> пятница
  else if (day === 0) offset = 2; // воскресенье -> пятница
  else if (day === 6) offset = 1; // суббота -> пятница
  const lastTrading = new Date(today);
  lastTrading.setDate(today.getDate() - offset);
  return lastTrading;
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
  });
  
  // Локальные состояния (часто обновляемые)
  const [profile, setProfile] = useState<VolumeProfileLevels | null>(null);
  const [liveSignals, setLiveSignals] = useState<Signal[]>([]);
  const [candlesData, setCandlesData] = useState<any[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [autoTrading, setAutoTrading] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState('e6123145-9665-43e0-8413-cd61b8aa9b13');
  const [activeTab, setActiveTab] = useState('sandbox');

  // ... (все остальные refs: chartRef, candleSeriesRef и т.д.)
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

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
      }
    );
    if (result) {
      setProfile(result.profile);
      updateBacktest({ signals: result.signals, result });
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

  const renderBacktestPanel = () => (
    <div className="tab-panel">
      <h3>Backtest</h3>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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
        <button onClick={runBacktest} disabled={backtest.loading}>Run</button>
        <button onClick={sendBacktestToSandbox} disabled={!backtest.signals.length}>Send to Sandbox</button>
      </div>
      {backtest.result?.stats && backtest.result.stats.portfolio && (
        <div className="backtest-stats" style={{ marginTop: '8px' }}>
          <p style={{ margin: 0 }}>
            Strategy: {backtest.strategyType === 'trend' ? 'Trend' : 'Volume Accum'}
            {' | '}Period: {backtest.dateFrom} – {backtest.dateTo}
            {' | '}Signals: {backtest.result.stats.totalSignals}
            {' | '}Trades: {backtest.result.stats.portfolio.totalTrades}
            (W: {backtest.result.stats.portfolio.winningTrades} / L: {backtest.result.stats.portfolio.losingTrades})
            {' | '}WinRate: {backtest.result.stats.portfolio.winRate?.toFixed(1)}%
            {' | '}Profit: <span className={backtest.result.stats.portfolio.totalProfit >= 0 ? 'positive' : 'negative'}>
              {backtest.result.stats.portfolio.totalProfit?.toFixed(2)} ({backtest.result.stats.portfolio.totalProfitPercent?.toFixed(2)}%)
            </span>
            {' | '}MaxDD: {backtest.result.stats.portfolio.maxDrawdown?.toFixed(2)} ({backtest.result.stats.portfolio.maxDrawdownPercent?.toFixed(2)}%)
            {backtest.result.stats.portfolio.initialCapital && (
              <> | Capital: {backtest.result.stats.portfolio.initialCapital} → {backtest.result.stats.portfolio.finalCapital?.toFixed(2)}</>
            )}
          </p>
        </div>
      )}
    </div>
  );

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

  return (
    <div className="trading-assistant">
      <h1>Trading Assistant</h1>
      <div className="tabs">
        <button onClick={() => setActiveTab('sandbox')} className={activeTab === 'sandbox' ? 'active' : ''}>Sandbox</button>
        <button onClick={() => setActiveTab('stream')} className={activeTab === 'stream' ? 'active' : ''}>Stream</button>
        <button onClick={() => setActiveTab('backtest')} className={activeTab === 'backtest' ? 'active' : ''}>Backtest</button>
        <button onClick={() => setActiveTab('signals')} className={activeTab === 'signals' ? 'active' : ''}>Signals</button>
      </div>

      {activeTab === 'sandbox' && renderSandboxPanel()}
      {activeTab === 'stream' && renderStreamPanel()}
      {activeTab === 'backtest' && renderBacktestPanel()}
      {activeTab === 'signals' && renderSignalsPanel()}

      <div className="chart-row">
        {profile?.volumeByPrice && priceRange.max > 0 && (
          <div className="volume-profile-container">
            <VolumeProfileBars
              data={profile.volumeByPrice}
              maxVolume={Math.max(...profile.volumeByPrice.map(v => v.volume))}
              minPrice={priceRange.min}
              maxPrice={priceRange.max}
              height={400}
            />
          </div>
        )}
        <div className="chart-container" ref={chartContainerRef} />
      </div>
    </div>
  );
};
/*import React, { useEffect, useState, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  CandlestickSeries,
  Time,
  UTCTimestamp,   // <-- добавьте
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  createSeriesMarkers,
} from 'lightweight-charts';
import VolumeProfileBars from '@/components/TRADING_ASSISTANT/VolumeProfileBars/VolumeProfileBars';
import './TradingAssistantPage.css';

// Типы (оставлены локально, чтобы не зависеть от импорта из main)
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
      // Закрываем предыдущий интервал
      if (bucketStart !== null) {
        result.push({ time: bucketStart, open, high: high === -Infinity ? open : high, low: low === Infinity ? open : low, close });
      }
      // Начинаем новый
      bucketStart = bucketTime;
      open = candle.open;
      high = candle.high;
      low = candle.low;
      close = candle.close;
    } else {
      // Внутри текущего интервала обновляем high/low/close
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
  const [profile, setProfile] = useState<VolumeProfileLevels | null>(null);
  const [liveSignals, setLiveSignals] = useState<Signal[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState(
    'e6123145-9665-43e0-8413-cd61b8aa9b13'
  );
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [backtestDate, setBacktestDate] = useState('2026-05-22');
  const [backtestSignals, setBacktestSignals] = useState<BacktestSignal[]>([]);
  const [candlesData, setCandlesData] = useState<any[]>([]); // массив свечей в формате для графика
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  //const priceLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('2026-05-22');
  const [dateTo, setDateTo] = useState('2026-05-22');
  const [interval, setInterval] = useState('1min');
  const [valueAreaPercent, setValueAreaPercent] = useState(70);
  const [profileResolution, setProfileResolution] = useState(50);
  const [stopLossPercent, setStopLossPercent] = useState(0.5);
  const [takeProfitPercent, setTakeProfitPercent] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [autoTrading, setAutoTrading] = useState(false);
  const [lotQty, setLotQty] = useState(1);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });

  const [sandboxToken, setSandboxToken] = useState(import.meta.env.VITE_TSandBox || '');
  const [accountId, setAccountId] = useState('');
  const [demoMode, setDemoMode] = useState(true);

  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [creatingAccount, setCreatingAccount] = useState(false);
  const [payAmount, setPayAmount] = useState(10000);
  const [payMessage, setPayMessage] = useState('');
  const [balance, setBalance] = useState<string | null>(null);

  const [streamActive, setStreamActive] = useState(false);
  const [streamToken, setStreamToken] = useState(import.meta.env.VITE_TReadOnly || '');

  const [displayTimeframe, setDisplayTimeframe] = useState<1 | 5 | 15 | 60>(5); // по умолчанию 5-минутный

  const [strategyType, setStrategyType] = useState('volume_accumulation');

  const startStream = async () => {
    const api = (window as any).electronAPI;
    if (!api?.startMarketStream || !api?.getTodayCandles) return;

    try {
      // 1. Загружаем исторические свечи за сегодня
      const historical = await api.getTodayCandles(
        selectedInstrument,
        streamToken,
        '1min' // всегда минутные, потому что стрим минутный
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

      // 2. Запускаем стрим (минутный, как и раньше)
      await api.startMarketStream(streamToken, {
        subscribeCandlesRequest: {
          subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
          instruments: [{
            instrumentId: selectedInstrument,
            interval: 'SUBSCRIPTION_INTERVAL_ONE_MINUTE'
          }]
        }
      });
      setStreamActive(true);
    } catch (err: any) {
      console.error(err);
      alert('Ошибка запуска стрима: ' + err.message);
    }
  };

  const stopStream = async () => {
    const api = (window as any).electronAPI;
    if (!api?.stopMarketStream) return;
    await api.stopMarketStream();
    setStreamActive(false);
  };

  const refreshBalance = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getBalance || !accountId) return;
    const result = await api.getBalance(accountId);
    console.log('[Portfolio]', result);
    if (result.success) {
      setBalance(`Баланс: ${result.balance} ${result.currency}`);
    } else {
      setBalance(`Ошибка: ${result.error}`);
    }
  };

  const handlePayIn = async () => {
    const api = (window as any).electronAPI;
    if (!api?.payInSandbox) return;
    setPayMessage('');
    const result = await api.payInSandbox(payAmount, accountId);
    if (result.success) {
      setPayMessage(`Счёт пополнен. Баланс: ${JSON.stringify(result.balance)}`);
      refreshBalance(); // автоматом покажем актуальный баланс
    } else {
      setPayMessage(`Ошибка: ${result.error}`);
    }
  };

  const sendBacktestToSandbox = async () => {
    const api = (window as any).electronAPI;
    if (!api?.sendBacktestSignals) return;
    await api.sendBacktestSignals(backtestSignals);
    alert('Сигналы отправлены в OrderManager');
  };

  const applyConfig = async () => {
    const api = (window as any).electronAPI;
    if (!api?.updateTradingConfig) {
      alert('updateTradingConfig not available');
      return;
    }
    await api.updateTradingConfig({
      token: sandboxToken,
      accountId,
      demoMode,
    });
    alert('Config applied');
  };

  const toggleTrading = async () => {
    const api = (window as any).electronAPI;
    if (!api?.toggleAutoTrading) {
      alert('toggleAutoTrading not available');
      return;
    }
    const newState = !autoTrading;
    await api.toggleAutoTrading(newState);
    setAutoTrading(newState);
  };

  const handleCreateAccount = async () => {
    const api = (window as any).electronAPI;
    if (!api?.createSandboxAccount) return;
    setCreatingAccount(true);
    try {
      const result = await api.createSandboxAccount();
      if (result.success) {
        setAccountId(result.accountId);
        alert(`Счёт создан: ${result.accountId}`);
        // Обновим список счетов, если у вас есть loadAccounts
        if (api.getSandboxAccounts) {
          const list = await api.getSandboxAccounts(sandboxToken);
          setAccounts(list);
        }
      } else {
        alert('Ошибка создания счёта: ' + result.error);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!accountId) return;
    const confirmed = confirm(`Закрыть счёт ${accountId}?`);
    if (!confirmed) return;
    const api = (window as any).electronAPI;
    if (!api?.closeSandboxAccount) return;
    try {
      const result = await api.closeSandboxAccount(accountId);
      if (result.success) {
        alert('Счёт закрыт');
        setAccountId('');
        // Обновим список
        if (api.getSandboxAccounts) {
          const list = await api.getSandboxAccounts(sandboxToken);
          setAccounts(list);
        }
      } else {
        alert('Ошибка: ' + result.error);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const loadAccounts = async () => {
    const api = (window as any).electronAPI;
    if (!api?.getSandboxAccounts) return;
    setLoadingAccounts(true);
    try {
      const list = await api.getSandboxAccounts(sandboxToken);
      setAccounts(list);
      if (list.length === 0) {
        alert('Счета не найдены. Проверьте токен и права доступа.');
      } else if (list.length === 1) {
        setAccountId(list[0].id);
      }
    } catch (err: any) {
      console.error(err);
      alert('Ошибка загрузки счетов: ' + (err.message || 'Неизвестная ошибка'));
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (sandboxToken) {
      loadAccounts();
    }
  }, [sandboxToken]);

  useEffect(() => {
    if (accountId) {
      refreshBalance();
    }
  }, [accountId]);

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
        time: Math.floor(timestampMs / 1000) as UTCTimestamp,   // <-- UTCTimestamp
        open: quotationToNumber(streamCandle.open),
        high: quotationToNumber(streamCandle.high),
        low: quotationToNumber(streamCandle.low),
        close: quotationToNumber(streamCandle.close),
      };

      setCandlesData(prev => {
        // Не добавляем свечу, если она уже есть
        if (prev.some(c => c.time === newCandle.time)) return prev;

        // Добавляем новую свечу и сортируем по времени
        const updated = [...prev, newCandle];
        updated.sort((a, b) => a.time - b.time);
        // Оставляем последние 500 свечей
        return updated.slice(-500);
      });
    };

    api.onCandle(handleCandle);

    //api.onLastPrice(handleLastPrice);

    return () => {
      api.removeCandleListener();
      //api.removeLastPriceListener?.();
    };
  }, []);

  // Запуск бэктеста через IPC
  // Запуск бэктеста
  const runBacktest = async () => {
    if (loading) return;
    setLoading(true);

    const api = (window as any).electronAPI;
    if (!api?.runBacktest) return;
    const token = import.meta.env.VITE_TReadOnly;
    const result = await api.runBacktest(
      selectedInstrument,
      dateFrom,
      dateTo,
      interval,
      token,
      {
        valueAreaPercent,
        profileResolution,
        strategyType,            // ← передаём
        stopLossPercent: 0.5,   // временно, пока нет полей в UI
        takeProfitPercent: 1.0,
      }
    );
    if (result) {
      setProfile(result.profile); // последний профиль (или массив профилей?)
      setBacktestSignals(result.signals);
      // candles будут объединены за весь период
      if (result.candles?.length) {
        const formatted = result.candles.map((c: any) => ({
          time: (Math.floor(new Date(c.time).getTime() / 1000)) as UTCTimestamp, // <-- замените as Time на as UTCTimestamp
          open: quotationToNumber(c.open),
          high: quotationToNumber(c.high),
          low: quotationToNumber(c.low),
          close: quotationToNumber(c.close),
        }));
        setCandlesData(formatted);
      }
      setBacktestResult(result);
    }
    setLoading(false);
    console.log('[Backtest Result]', result);
  };

  // Подписка на live-обновления из VolumeProfileEngine
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
        setLiveSignals((prev) => [...prev.slice(-50), signal]);
      }
    };

    api.onProfileUpdate(onProfile);
    api.onTradingSignal(onSignal);

    return () => {
      api.removeProfileUpdateListener();
      api.removeTradingSignalListener();
    };
  }, [selectedInstrument]);

  // Инициализация графика (без тестовой линии)
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

    // --- Подписка на изменение размера контейнера ---
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
      }
    });
    resizeObserver.observe(container);

    // --- Подписка на зум (если ещё нужна) ---
    const timeScale = chart.timeScale();
    const priceScale = chart.priceScale('right');
    const updatePriceRange = () => {
      const range = priceScale.getVisibleRange();
      if (range) {
        setPriceRange({ min: range.from, max: range.to });
      }
    };
    timeScale.subscribeVisibleTimeRangeChange(updatePriceRange);
    updatePriceRange();

    return () => {
      resizeObserver.disconnect();
      timeScale.unsubscribeVisibleTimeRangeChange(updatePriceRange);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Отображение свечей при изменении candlesData
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candlesData.length) return;

    // Если уже есть свечная серия, удаляем её через ref (как раньше)
    if (candleSeriesRef.current) {
      chart.removeSeries(candleSeriesRef.current);
    }

    // Агрегируем минутные свечи в 5-минутные
    const aggregated = aggregateCandles(candlesData, displayTimeframe);

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
    
  }, [candlesData]);

  useEffect(() => {
    if (candlesData.length > 0) {
      const prices = candlesData.flatMap(c => [c.high, c.low]);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      setPriceRange({ min, max });
    }
  }, [candlesData]);

  const volumeSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  // Обновление уровней на графике (профиль)
  // Обновление уровней (привязываем к временному диапазону свечей)
  // Обновление уровней (привязываем к временному диапазону свечей)
  // Обновление уровней (профиль + гистограмма объёмов)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !profile || !candlesData.length || candlesData.length < 2) return;  // <-- добавьте candlesData.length < 2

    // Удаляем старые линии уровней и гистограммы
    [...levelSeriesRef.current, ...volumeSeriesRef.current].forEach((series) => {
      try { chart.removeSeries(series); } catch {}
    });
    levelSeriesRef.current = [];
    //volumeSeriesRef.current = [];

    // Проверяем, что время корректно
    const firstTime = candlesData[0].time as UTCTimestamp;
    const lastTime = candlesData[candlesData.length - 1].time as UTCTimestamp;
    if (typeof firstTime !== 'number' || typeof lastTime !== 'number') return;

    // Сначала рисуем основные уровни POC, VA (как раньше)
    const addHorizontalLine = (price: number, color: string, title: string, lineWidth = 2) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: lineWidth as any,   // ← исправление
        title,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData([
        { time: firstTime, value: price },
        { time: lastTime, value: price },
      ]);
      levelSeriesRef.current.push(series);
    };

    addHorizontalLine(profile.poc, 'red', 'POC', 3);
    addHorizontalLine(profile.valueAreaHigh, 'green', 'VA High', 2);
    addHorizontalLine(profile.valueAreaLow, 'green', 'VA Low', 2);

    // HVN, LVN (если есть) можно добавить поверх, но они уже учтены в гистограмме
  }, [profile, candlesData]);

  // Отображение сигналов бэктеста маркерами (API v5)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !backtestSignals.length) return;

    // Удаляем предыдущий примитив с маркерами, если он был
    if (signalSeriesRef.current) {
      chart.removeSeries(signalSeriesRef.current);
    }

    // Создаем новую, пустую серию, которая будет основой для маркеров
    const signalSeries = chart.addSeries(LineSeries, {
      lineVisible: false,          // скрываем линию
      lastValueVisible: false,     // не показываем значение последней точки
    });

    // Подготавливаем данные для маркеров
    const markers: SeriesMarker<Time>[] = backtestSignals.map((sig) => ({
      time: (Math.floor(new Date(sig.time).getTime() / 1000)) as Time,
      position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: sig.type === 'BUY' ? 'green' : 'red',
      shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: sig.reason,
    }));

    // НОВЫЙ СПОСОБ (v5): создаем примитив для маркеров на основе серии
    const markersPrimitive = createSeriesMarkers(signalSeries, markers);

    // Сохраняем серию в ref для последующего удаления.
    // Сам примитив маркеров будет удален вместе с ней.
    signalSeriesRef.current = signalSeries;

    // Если в будущем понадобится обновить маркеры, 
    // не пересоздавая серию, используйте:
    // markersPrimitive.setMarkers(newMarkersArray);

  }, [backtestSignals]);

  // Ручная загрузка live-профиля
  const loadProfile = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const p = await api.getVolumeProfile(selectedInstrument);
    if (p) setProfile(p);
  };

  return (
    <div className="trading-assistant">
      <h1>Volume Profile Trading Assistant</h1>
      <div className="sandbox-panel">
        <h3>Sandbox Settings</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label>
            Token:
            <input
              type="text"
              value={sandboxToken}
              onChange={(e) => setSandboxToken(e.target.value)}
              style={{ width: '300px', marginLeft: '5px' }}
            />
          </label>
          <button onClick={handleCreateAccount} disabled={creatingAccount} style={{ marginLeft: '5px' }}>
            {creatingAccount ? 'Создание...' : 'Создать счёт'}
          </button>
          <button onClick={handleCloseAccount} disabled={!accountId} style={{ marginLeft: '5px' }}>
            Удалить счёт
          </button>
          <label>
            Account ID:
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ width: '200px', marginLeft: '5px' }}>
              <option value="">-- выберите счёт --</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name || acc.id}</option>
              ))}
              {accounts.length === 0 && <option value="">Нет загруженных счетов</option>}
            </select>
          </label>
          <button onClick={loadAccounts} disabled={!sandboxToken || loadingAccounts} style={{ marginLeft: '5px' }}>
            {loadingAccounts ? 'Загрузка...' : 'Load Accounts'}
          </button>
          <label>
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
            />{' '}
            Demo mode
          </label>
        </div>
        <div style={{ marginTop: '10px' }}>
          <button onClick={applyConfig}>Apply Config</button>
          <button onClick={toggleTrading} style={{ marginLeft: '10px' }}>
            {autoTrading ? 'Stop Auto Trading' : 'Start Auto Trading'}
          </button>
          <label style={{ marginLeft: '10px' }}>
            Lots:
            <input
              type="number"
              value={lotQty}
              onChange={e => {
                const val = Number(e.target.value);
                setLotQty(val);
                (window as any).electronAPI.setLotQuantity(val);
              }}
              min={1}
              style={{ width: '60px', marginLeft: '5px' }}
            />
          </label>
          <div className="pay-in-panel" style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label>Пополнить на сумму (₽):</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} min={1000} step={1000} style={{ width: '120px', padding: '4px', background: '#2a2e39', color: '#d1d4dc', border: '1px solid #555', borderRadius: '3px' }} />
            <button onClick={handlePayIn}>Пополнить счёт</button>
            {payMessage && <p style={{ margin: 0, color: '#4caf50' }}>{payMessage}</p>}
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={refreshBalance}>Обновить баланс</button>
            {balance && <span style={{ color: '#d1d4dc' }}>{balance}</span>}
          </div>
        </div>
      </div>
      <div className="stream-panel" style={{ background: '#1e1e1e', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Market Stream</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            Token (read‑only):
            <input
              type="text"
              value={streamToken}
              onChange={(e) => setStreamToken(e.target.value)}
              style={{ width: '250px', marginLeft: '5px' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
            <label style={{ color: '#d1d4dc' }}>Таймфрейм графика:</label>
            <select value={displayTimeframe} onChange={e => setDisplayTimeframe(Number(e.target.value) as 1 | 5 | 15 | 60)} style={{ padding: '4px', background: '#2a2e39', color: '#d1d4dc', border: '1px solid #555', borderRadius: '3px' }}>
              <option value={1}>1 минута</option>
              <option value={5}>5 минут</option>
              <option value={15}>15 минут</option>
              <option value={60}>1 час</option>
            </select>
          </div>
          <button onClick={startStream} disabled={streamActive}>Start Stream</button>
          <button onClick={stopStream} disabled={!streamActive}>Stop Stream</button>
          <span style={{ color: streamActive ? '#4caf50' : '#d32f2f', marginLeft: '10px' }}>
            {streamActive ? '● Stream Active' : '○ Stream Stopped'}
          </span>
        </div>
      </div>
      <div className="instrument-selector">
        <label>Instrument UID: </label>
        <input
          type="text"
          value={selectedInstrument}
          onChange={(e) => setSelectedInstrument(e.target.value)}
        />
        <button onClick={loadProfile}>Load Live Profile</button>
      </div>
    
      <div className="backtest-panel">
        <label>Strategy:</label>
        <select value={strategyType} onChange={e => setStrategyType(e.target.value)}>
          <option value="volume_accumulation">Volume Accumulation</option>
          <option value="trend">Trend Strategy</option>
        </select>
        <label>From:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <label>To:</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <label>Interval:</label>
        <select value={interval} onChange={e => setInterval(e.target.value)}>
          <option value="1min">1 min</option>
          <option value="5min">5 min</option>
          <option value="15min">15 min</option>
          <option value="1hour">1 hour</option>
        </select>
        <label>VA%:</label>
        <input type="number" value={valueAreaPercent} onChange={e => setValueAreaPercent(Number(e.target.value))} min={50} max={90} step={5} />
        <label>Resolution:</label>
        <input type="number" value={profileResolution} onChange={e => setProfileResolution(Number(e.target.value))} min={10} max={200} step={10} />
        <label>SL%:</label>
        <input type="number" value={stopLossPercent} onChange={e => setStopLossPercent(Number(e.target.value))} min={0} max={10} step={0.1} style={{ width: '60px' }} />

        <label>TP%:</label>
        <input type="number" value={takeProfitPercent} onChange={e => setTakeProfitPercent(Number(e.target.value))} min={0} max={10} step={0.1} style={{ width: '60px' }} />
        <button disabled={loading} onClick={runBacktest}>Run Backtest</button>
      </div>

      <div className="chart-row">
        {profile?.volumeByPrice && priceRange.max > 0 && (
          <VolumeProfileBars
            data={profile.volumeByPrice}
            maxVolume={Math.max(...profile.volumeByPrice.map(v => v.volume))}
            minPrice={priceRange.min}
            maxPrice={priceRange.max}
            height={400}
          />
        )}
        <div
          className="chart-container"
          ref={chartContainerRef}
          style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}
        />
      </div>

      {profile?.volumeByPrice && profile.volumeByPrice.length > 0 && (
        <div className="volume-distribution">
          <h3>Volume Distribution (top levels)</h3>
          <ul>
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

      <div className="profile-info">
        {profile ? (
          <div>
            <h3>Current Profile</h3>
            <p>POC: {profile.poc.toFixed(2)}</p>
            <p>Value Area: {profile.valueAreaLow.toFixed(2)} – {profile.valueAreaHigh.toFixed(2)}</p>
            <p>Total Volume: {profile.totalVolume}</p>
          </div>
        ) : (
          <p>No profile data</p>
        )}
      </div>

      {
      // Лог сигналов (показываем оба списка)
      }
      {backtestSignals.length > 0 && (
        <div className="signals-log">
          <h3>Backtest Signals</h3>
          <ul>
            {backtestSignals.map((sig, idx) => (
              <li key={idx}>
                <strong>{sig.type}</strong>: {sig.reason} @ {sig.price}
              </li>
            ))}
          </ul>
        </div>
      )}

      {backtestResult?.stats && backtestResult.stats.portfolio && (
        <div className="backtest-stats">
          <h3>Backtest Results</h3>
          <p>Strategy: {strategyType}</p>
          <p>Total Signals: {backtestResult.stats.totalSignals}</p>
          <p>Buy / Sell: {backtestResult.stats.buySignals} / {backtestResult.stats.sellSignals}</p>
          <ul>
            <li>Initial Capital: {backtestResult.stats.portfolio.initialCapital}</li>
            <li>Final Capital: {backtestResult.stats.portfolio.finalCapital?.toFixed(2)}</li>
            <li>Total Profit: <span className={backtestResult.stats.portfolio.totalProfit >= 0 ? 'positive' : 'negative'}>{backtestResult.stats.portfolio.totalProfit?.toFixed(2)} ({backtestResult.stats.portfolio.totalProfitPercent?.toFixed(2)}%)</span></li>
            <li>Trades: {backtestResult.stats.portfolio.totalTrades} (W: {backtestResult.stats.portfolio.winningTrades}, L: {backtestResult.stats.portfolio.losingTrades})</li>
            <li>Win Rate: {backtestResult.stats.portfolio.winRate?.toFixed(1)}%</li>
            <li>Max Drawdown: {backtestResult.stats.portfolio.maxDrawdown?.toFixed(2)} ({backtestResult.stats.portfolio.maxDrawdownPercent?.toFixed(2)}%)</li>
            <li>Avg Profit: {backtestResult.stats.portfolio.averageProfit?.toFixed(2)}</li>
          </ul>
        </div>
      )}

      <button onClick={sendBacktestToSandbox} disabled={!backtestSignals.length}>
        Send to Sandbox
      </button>

      <div className="signals-log">
        <h3>Live Signals</h3>
        {liveSignals.length > 0 ? (
          <ul>
            {liveSignals.map((sig, idx) => (
              <li key={idx}>
                <strong>{sig.type}</strong>: {sig.message} @ {sig.price}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#888' }}>Ожидание сигналов...</p>
        )}
      </div>
    </div>
  );
};*/