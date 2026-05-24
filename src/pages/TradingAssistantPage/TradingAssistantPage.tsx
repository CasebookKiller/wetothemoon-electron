import React, { useEffect, useState, useRef } from 'react';
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
};