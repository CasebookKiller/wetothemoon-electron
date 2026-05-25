import React, { useEffect, useState, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  CandlestickSeries,
  Time,
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
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('2026-05-22');
  const [dateTo, setDateTo] = useState('2026-05-22');
  const [interval, setInterval] = useState('1min');
  const [valueAreaPercent, setValueAreaPercent] = useState(70);
  const [profileResolution, setProfileResolution] = useState(50);
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
    const api = (window as any).electronAPI;
    if (api) api.getTradingStatus().then((status: boolean) => setAutoTrading(status));
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
      { valueAreaPercent, profileResolution }
    );
    if (result) {
      setProfile(result.profile); // последний профиль (или массив профилей?)
      setBacktestSignals(result.signals);
      // candles будут объединены за весь период
      if (result.candles?.length) {
        const formatted = result.candles.map((c: any) => ({
          time: (Math.floor(new Date(c.time).getTime() / 1000)) as Time,
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
      timeScale: {
        timeVisible: true,
        borderColor: '#2a2e39',
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Отображение свечей при изменении candlesData
  // Отображение свечей при изменении candlesData
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candlesData.length) return;

    // Если уже есть свечная серия, удаляем её через ref (как раньше)
    if (candleSeriesRef.current) {
      chart.removeSeries(candleSeriesRef.current);
    }

    console.log('[Adding candles]', candlesData.slice(0, 2)); // первые две для проверки
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candleSeries.setData(candlesData);
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
    if (!chart || !profile || !candlesData.length) return;

    // Удаляем старые линии уровней и гистограммы
    [...levelSeriesRef.current, ...volumeSeriesRef.current].forEach((series) => {
      try { chart.removeSeries(series); } catch {}
    });
    levelSeriesRef.current = [];
    //volumeSeriesRef.current = [];

    const firstTime = candlesData[0].time;
    const lastTime = candlesData[candlesData.length - 1].time;

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

    // Теперь добавляем объёмы (гистограмма)
    //if (profile.volumeByPrice && profile.volumeByPrice.length > 0) {
    //  const maxVolume = Math.max(...profile.volumeByPrice.map(v => v.volume));
    //  profile.volumeByPrice.forEach(({ price, volume }) => {
    //    const opacity = volume / maxVolume;
    //    const color = `rgba(255, 0, 0, ${opacity})`;
    //    addHorizontalLine(price, color, '', 1 + Math.round(opacity * 4)); // толщина зависит от объёма
    //  });
    //}

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
  
  const api = (window as any).electronAPI;
  if (!api) {
    console.error('electronAPI не доступен');
    return;
  }

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
      
      <div>
        <button onClick={toggleTrading}>
          {autoTrading ? 'Stop Auto Trading' : 'Start Auto Trading'}
        </button>
        <label> Lots: </label>
        <input type="number" value={lotQty} onChange={e => {
          const val = Number(e.target.value);
          setLotQty(val);
          api.setLotQuantity(val);
        }} min={1} />
      </div>

      <div className="backtest-panel">
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
        <button disabled={loading} onClick={runBacktest}>Run Backtest</button>
      </div>

      <div style={{ display: 'flex', marginBottom: '15px' }}>
        {profile?.volumeByPrice && priceRange.max > 0 && (
          <VolumeProfileBars
            data={profile.volumeByPrice}
            maxVolume={Math.max(...profile.volumeByPrice.map(v => v.volume))}
            minPrice={priceRange.min}
            maxPrice={priceRange.max}
            height={400}
          />
        )}
        <div className="chart-container" ref={chartContainerRef} style={{ flex: 1 }} />
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

      {/* Лог сигналов (показываем оба списка) */}
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

      {liveSignals.length > 0 && (
        <div className="signals-log">
          <h3>Live Signals</h3>
          <ul>
            {liveSignals.map((sig, idx) => (
              <li key={idx}>
                <strong>{sig.type}</strong>: {sig.message} @ {sig.price}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};