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

  // Запуск бэктеста через IPC
  // Запуск бэктеста
  const runBacktest = async () => {
    const api = (window as any).electronAPI;
    if (!api?.runBacktest) {
      alert('electronAPI.runBacktest не доступен');
      return;
    }
    const token = import.meta.env.VITE_TReadOnly;
    const result = await api.runBacktest(selectedInstrument, backtestDate, token);
    console.log('[Backtest Result]', result); // ← посмотрим весь ответ
    if (result) {
      setProfile(result.profile);
      setBacktestSignals(result.signals);

      if (result.candles && result.candles.length > 0) {
        const formatted = result.candles.map((c: any) => {
          const t = new Date(c.time).getTime();
          if (isNaN(t)) {
            console.warn('Invalid candle time:', c.time);
            return null;
          }
          return {
            time: (Math.floor(t / 1000)) as Time,
            open: quotationToNumber(c.open),
            high: quotationToNumber(c.high),
            low: quotationToNumber(c.low),
            close: quotationToNumber(c.close),
          };
        }).filter(Boolean);
        console.log('[Formatted candles]', formatted); // ← как выглядят свечи
        setCandlesData(formatted);
      } else {
        console.warn('No candles in backtest result');
      }
    } else {
      alert('Ошибка при загрузке данных');
    }
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
    volumeSeriesRef.current = [];

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
    if (profile.volumeByPrice && profile.volumeByPrice.length > 0) {
      const maxVolume = Math.max(...profile.volumeByPrice.map(v => v.volume));
      profile.volumeByPrice.forEach(({ price, volume }) => {
        const opacity = volume / maxVolume;
        const color = `rgba(255, 0, 0, ${opacity})`;
        addHorizontalLine(price, color, '', 1 + Math.round(opacity * 4)); // толщина зависит от объёма
      });
    }

    // HVN, LVN (если есть) можно добавить поверх, но они уже учтены в гистограмме
  }, [profile, candlesData]);

//  useEffect(() => {
//    const chart = chartRef.current;
//    if (!chart || !backtestSignals.length) return;

//    if (signalSeriesRef.current) {
//      chart.removeSeries(signalSeriesRef.current);
//    }

//    const signalSeries = chart.addSeries(LineSeries, {
//      lineVisible: false,
//      lastValueVisible: false,
//    });

//    const markers: SeriesMarker<Time>[] = backtestSignals.map((sig) => ({
//      time: (Math.floor(new Date(sig.time).getTime() / 1000)) as Time,
//      position: sig.type === 'BUY' ? 'belowBar' : 'aboveBar',
//      color: sig.type === 'BUY' ? 'green' : 'red',
//      shape: sig.type === 'BUY' ? 'arrowUp' : 'arrowDown',
//      text: sig.reason,
//    }));

//    createSeriesMarkers(signalSeries, markers);
//    signalSeriesRef.current = signalSeries;
//  }, [backtestSignals]);

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
        <input type="date" value={backtestDate} onChange={e => setBacktestDate(e.target.value)} />
        <button onClick={runBacktest}>Run Backtest</button>
      </div>

      <div className="chart-container" ref={chartContainerRef} />

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
/*import React, { useEffect, useState, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  Time,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import './TradingAssistantPage.css';
import { BacktestSignal } from '@/main/services/backtest/backtestEngine';

// Типы (можно импортировать из shared, но для простоты определяем здесь)
interface VolumeProfileLevels {
  instrumentUid: string;
  timestamp: string;
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  hvn: number[];
  lvn: number[];
  totalVolume: number;
}

interface Signal {
  instrumentUid: string;
  time: string;
  type: string;
  price: number;
  level: number;
  message: string;
}

export const TradingAssistantPage: React.FC = () => {
  const [profile, setProfile] = useState<VolumeProfileLevels | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState(
    'e6123145-9665-43e0-8413-cd61b8aa9b13'
  );
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  const [backtestDate, setBacktestDate] = useState('2026-05-22');
  const [backtestSignals, setBacktestSignals] = useState<BacktestSignal[]>([]);
  
  const runBacktest = async () => {
    const api = (window as any).electronAPI;
    const token = import.meta.env.VITE_TReadOnly; // потом заменим на получение из защищённого хранилища
    const result = await api.runBacktest(selectedInstrument, backtestDate, token);
    if (result) {
      setProfile(result.profile);
      setSignals(result.signals); // отобразим в логе
      setBacktestSignals(result.signals);
      // Добавим сигналы на график как маркеры
      // ... (обновление графика)
    }
  };

  // Подписка на обновления
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
        setSignals((prev) => [...prev.slice(-50), signal]);
      }
    };

    api.onProfileUpdate(onProfile);
    api.onTradingSignal(onSignal);

    return () => {
      api.removeProfileUpdateListener();
      api.removeTradingSignalListener();
    };
  }, [selectedInstrument]);

  // Инициализация графика один раз
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' }, // тёмный фон
        textColor: '#d1d4dc', // светлый текст для шкал
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

    const testSeries = chart.addSeries(LineSeries, { color: 'yellow', lineWidth: 3 });
    testSeries.setData([
      { time: (Math.floor(Date.now() / 1000) - 3600) as Time, value: 320 },
      { time: (Math.floor(Date.now() / 1000)) as Time, value: 320 },
    ]);

    chartRef.current = chart;

    // Основная линия цены (пустая, потом можно подтянуть lastPrice)
    const priceSeries = chart.addSeries(LineSeries, {
      color: 'blue',
      lineWidth: 1,
    });
    priceSeries.setData([]);

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Обновление уровней при изменении профиля
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !profile) return;

    // Удаляем старые линии уровней (сохранённые в ref)
    levelSeriesRef.current.forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch (e) {
        // серия уже могла быть удалена
      }
    });
    levelSeriesRef.current = [];

    const nowSec = Math.floor(Date.now() / 1000); // number

    // Вспомогательная функция для добавления горизонтальной линии
    const addHorizontalLine = (price: number, color: string, title: string) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        title,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData([
        { time: (nowSec - 3600) as Time, value: price },
        { time: nowSec as Time, value: price },
      ]);
      levelSeriesRef.current.push(series);
    };

    addHorizontalLine(profile.poc, 'red', 'POC');
    addHorizontalLine(profile.valueAreaHigh, 'green', 'VA High');
    addHorizontalLine(profile.valueAreaLow, 'green', 'VA Low');

    // Для HVN/LVN можно добавить линии с полупрозрачностью
    profile.hvn.forEach((price) => addHorizontalLine(price, 'rgba(255,0,0,0.3)', 'HVN'));
    profile.lvn.forEach((price) => addHorizontalLine(price, 'rgba(0,0,255,0.3)', 'LVN'));
  }, [profile]);

  const loadProfile = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const p = await api.getVolumeProfile(selectedInstrument);
    if (p) setProfile(p);
  };

  return (
    <div className="trading-assistant">
      <h1>Volume Profile Trading Assistant</h1>

      <div className="instrument-selector">
        <label>Instrument UID: </label>
        <input
          type="text"
          value={selectedInstrument}
          onChange={(e) => setSelectedInstrument(e.target.value)}
        />
        <button onClick={loadProfile}>Load Profile</button>
      </div>

      <div className="backtest-panel">
        <input type="date" value={backtestDate} onChange={e => setBacktestDate(e.target.value)} />
        <button onClick={runBacktest}>Run Backtest</button>
      </div>

      <div className="chart-container" ref={chartContainerRef} />

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

      <div className="signals-log">
        <h3>Signals</h3>
        <ul>
          {signals.map((sig, idx) => (
            <li key={idx}>
              <strong>{sig.type}</strong>: {sig.message} @ {sig.price}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};*/