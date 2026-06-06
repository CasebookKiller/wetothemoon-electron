import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-luxon';

// Регистрируем все компоненты
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  BarElement,
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
  volumeByPrice?: Array<{ price: number; volume: number }>;
  poc?: number;
  vah?: number;
  val?: number;
  signals?: Array<{ time: string; type: string; price: number; reason: string }>;
  trades?: Array<{ entryTime: string; exitTime: string; entryPrice: number; exitPrice: number; type: string; exitReason: string }>;
  positions?: Array<{ instrumentUid: string; averagePositionPrice: any; quantity: any; ticker?: string }>;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candlesData,
  volumeByPrice = [],
  poc,
  vah,
  val,
  signals = [],
  trades = [],
  positions = [],
}) => {
  const chartRef = useRef<ChartJS>(null);

  // Преобразуем время в ISO-строки для оси X
  const labels = candlesData.map(c => new Date(c.time * 1000).toISOString());

  // Данные для свечей
  const candlestickData = candlesData.map(c => ({
    x: new Date(c.time * 1000).toISOString(),
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
  }));

  // Данные для профиля объёма (горизонтальные бары)
  const sortedProfile = [...volumeByPrice].sort((a, b) => b.price - a.price);
  const profileLabels = sortedProfile.map(item => item.price.toFixed(2));
  const profileVolumes = sortedProfile.map(item => item.volume);
  const maxVolume = Math.max(...profileVolumes);
  const profileColors = sortedProfile.map(item => {
    const opacity = item.volume / maxVolume;
    return `rgba(38, 166, 154, ${opacity.toFixed(2)})`;
  });

  // Линии POC, VAH, VAL
  const lineDatasets: any[] = [];
  if (poc !== undefined) {
    lineDatasets.push({
      label: 'POC',
      type: 'line' as const,
      data: labels.map(() => poc),
      borderColor: 'red',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
    });
  }
  if (vah !== undefined) {
    lineDatasets.push({
      label: 'VAH',
      type: 'line' as const,
      data: labels.map(() => vah),
      borderColor: 'green',
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
    });
  }
  if (val !== undefined) {
    lineDatasets.push({
      label: 'VAL',
      type: 'line' as const,
      data: labels.map(() => val),
      borderColor: 'green',
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      yAxisID: 'y',
    });
  }

  // Маркеры сигналов
  const signalScatters = signals.map((sig, idx) => ({
    label: idx === 0 ? 'Signals' : '',
    type: 'scatter' as const,
    data: signals.map(s => ({
      x: new Date(s.time).toISOString(),
      y: s.price,
    })),
    backgroundColor: signals.map(s => s.type === 'BUY' ? 'green' : 'red'),
    borderColor: signals.map(s => s.type === 'BUY' ? 'darkgreen' : 'darkred'),
    borderWidth: 1,
    pointRadius: 5,
    pointStyle: 'circle',
    showLine: false,
    yAxisID: 'y',
    tooltip: {
      callbacks: {
        label: (context: any) => `${signals[context.dataIndex]?.type} @ ${signals[context.dataIndex]?.price}`,
      },
    },
  }));

  // Маркеры выходов (сделок)
  const tradeMarkers = trades.map((t, idx) => ({
    label: idx === 0 ? 'Exits' : '',
    type: 'scatter' as const,
    data: trades.map(trade => ({
      x: new Date(trade.exitTime).toISOString(),
      y: trade.exitPrice,
    })),
    backgroundColor: trades.map(trade => {
      switch (trade.exitReason) {
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
    tooltip: {
      callbacks: {
        label: (context: any) => `${trades[context.dataIndex]?.exitReason} @ ${trades[context.dataIndex]?.exitPrice}`,
      },
    },
  }));

  // Объединяем все датасеты
  const datasets = [
    // Профиль объёма (бары)
    {
      label: 'Volume',
      type: 'bar' as const,
      data: profileVolumes,
      backgroundColor: profileColors,
      borderColor: 'rgba(38, 166, 154, 0.5)',
      borderWidth: 0.5,
      barPercentage: 1.0,
      categoryPercentage: 1.0,
      yAxisID: 'y',
      xAxisID: 'x1',
    },
    // Свечи
    {
      label: 'Candles',
      type: 'candlestick' as const,
      data: candlestickData,
      yAxisID: 'y',
    },
    // Линии уровней
    ...lineDatasets,
    // Маркеры сигналов
    ...signalScatters,
    // Маркеры выходов
    ...tradeMarkers,
  ];

  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      <Chart
        ref={chartRef}
        type="bar" // базовый тип, но каждый датасет имеет свой type
        data={{
          labels: profileLabels.length > 0 ? profileLabels : labels,
          datasets,
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
            },
          },
          scales: {
            x: {
              display: true,
              type: 'timeseries',
              time: {
                unit: 'minute',
                displayFormats: { minute: 'HH:mm' },
              },
              grid: { display: false },
            },
            x1: {
              display: false, // скрытая ось для баров профиля
              position: 'left',
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