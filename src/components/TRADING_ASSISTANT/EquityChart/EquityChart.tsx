// src/components/TradingAssistant/EquityChart.tsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-luxon';

ChartJS.register(TimeScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface Trade {
  entryTime: string;
  exitTime: string;
  profit: number;
}

interface EquityChartProps {
  trades: Trade[];
  initialCapital?: number;
}

export const EquityChart: React.FC<EquityChartProps> = ({ trades, initialCapital = 100000 }) => {
  // 1. Безусловный лог – увидим, вызывается ли компонент
  console.log('[EquityChart] render, trades:', trades?.length);

  // 2. Всегда возвращаем контейнер с фоном и рамкой, чтобы проверить, виден ли он
  return (
    <div style={{
      width: '100%',
      height: '300px',
      position: 'relative',
    }}>
      <p style={{ color: '#fff', margin: 0 }}>
        EquityChart placeholder (trades: {trades?.length})
      </p>
      {trades.length > 0 && (
        <Line
          data={{
            datasets: [{
              label: 'Equity',
              data: (() => {
                let capital = initialCapital;
                const pts = [{ x: new Date(trades[0].entryTime).getTime(), y: capital }];
                for (const t of trades) {
                  capital += t.profit;
                  pts.push({ x: new Date(t.exitTime).getTime(), y: capital });
                }
                // Если все точки в одном дне – раздвигаем
                const minDist = 3600000; // 1 час
                for (let i = 1; i < pts.length; i++) {
                  if (pts[i].x <= pts[i - 1].x) pts[i].x = pts[i - 1].x + minDist;
                }
                return pts;
              })(),
              borderColor: '#4caf50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              fill: true,
              pointRadius: 0,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                type: 'time',
                time: { unit: 'day', displayFormats: { day: 'MMM dd' } },
                grid: { display: false },
              },
              y: {
                ticks: { callback: (v) => Number(v).toFixed(0) },
                grid: { color: '#2a2e39' },
              },
            },
          }}
        />
      )}
    </div>
  );
};