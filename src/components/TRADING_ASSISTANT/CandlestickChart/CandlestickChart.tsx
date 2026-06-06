import React from 'react';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-luxon';

ChartJS.register(
  TimeScale,
  LinearScale,
  LineElement,
  PointElement,
  CandlestickController,
  CandlestickElement,
  Tooltip,
  Legend,
  Filler
);

interface CandlestickChartProps {
  candlesData: Array<{ time: number; open: number; high: number; low: number; close: number }>;
  poc?: number;
  vah?: number;
  val?: number;
  signals?: Array<{ time: string; type: string; price: number; reason: string }>;
  trades?: Array<{ entryTime: string; exitTime: string; entryPrice: number; exitPrice: number; type: string; exitReason: string }>;
  positions?: Array<{ instrumentUid: string; averagePositionPrice: any; quantity: any; ticker?: string }>;
  onVisiblePriceRangeChange?: (min: number, max: number) => void;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candlesData,
  poc,
  vah,
  val,
  signals = [],
  trades = [],
  positions = [],
  onVisiblePriceRangeChange,
}) => {
  const candlestickData = candlesData.map(c => ({
    x: c.time * 1000,
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
  }));

  const timeRange = candlesData.length > 0
    ? [candlesData[0].time * 1000, candlesData[candlesData.length - 1].time * 1000]
    : [0, 0];

  const datasets: any[] = [
    {
      label: 'Candles',
      type: 'candlestick',
      data: candlestickData,
      yAxisID: 'y',
    },
  ];

  // Линии уровней
  if (poc !== undefined) {
    datasets.push({
      label: 'POC',
      type: 'line',
      data: [
        { x: timeRange[0], y: poc },
        { x: timeRange[1], y: poc },
      ],
      borderColor: 'red',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
    });
  }
  if (vah !== undefined) {
    datasets.push({
      label: 'VAH',
      type: 'line',
      data: [
        { x: timeRange[0], y: vah },
        { x: timeRange[1], y: vah },
      ],
      borderColor: 'green',
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
    });
  }
  if (val !== undefined) {
    datasets.push({
      label: 'VAL',
      type: 'line',
      data: [
        { x: timeRange[0], y: val },
        { x: timeRange[1], y: val },
      ],
      borderColor: 'green',
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
    });
  }

  // Маркеры сигналов и выходов
  if (signals.length > 0) {
    datasets.push({
      label: 'Signals',
      type: 'scatter',
      data: signals.map(s => ({
        x: new Date(s.time).getTime(),
        y: s.price,
      })),
      backgroundColor: signals.map(s => s.type === 'BUY' ? 'green' : 'red'),
      borderColor: signals.map(s => s.type === 'BUY' ? 'darkgreen' : 'darkred'),
      borderWidth: 1,
      pointRadius: 5,
      pointStyle: 'circle',
      showLine: false,
      yAxisID: 'y',
    });
  }
  if (trades.length > 0) {
    datasets.push({
      label: 'Exits',
      type: 'scatter',
      data: trades.map(t => ({
        x: new Date(t.exitTime).getTime(),
        y: t.exitPrice,
      })),
      backgroundColor: trades.map(t => {
        switch (t.exitReason) {
          case 'TAKE_PROFIT': return '#4caf50';
          case 'STOP_LOSS': return '#f44336';
          case 'TRAILING_STOP': return '#2196f3';
          case 'END_OF_DAY': return '#ffeb3b';
          default: return '#9e9e9e';
        }
      }),
      pointRadius: 4,
      pointStyle: 'rectRot',
      showLine: false,
      yAxisID: 'y',
    });
  }

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <Chart
        type="candlestick"
        data={{ datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            x: {
              type: 'timeseries',
              time: {
                unit: 'minute',
                displayFormats: { minute: 'HH:mm' },
              },
              grid: { display: false },
            },
            y: {
              position: 'right',
              grid: { color: '#2a2e39' },
              ticks: { color: '#d1d4dc' },
            },
          },
        }}
      />
    </div>
  );
};