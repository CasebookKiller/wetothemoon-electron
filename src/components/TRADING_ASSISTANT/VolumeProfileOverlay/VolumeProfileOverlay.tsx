import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  volumeByPrice: Array<{ price: number; volume: number }>;
  poc?: number;
  vah?: number;
  val?: number;
  visible: boolean;
}

export const VolumeProfileOverlay: React.FC<Props> = ({
  volumeByPrice,
  poc,
  vah,
  val,
  visible,
}) => {
  const chartRef = useRef<ChartJS<'bar'>>(null);

  if (!visible || !volumeByPrice.length) return null;

  // Сортировка по цене (для оси Y)
  const sorted = [...volumeByPrice].sort((a, b) => b.price - a.price);
  const labels = sorted.map(item => item.price.toFixed(2));
  const volumes = sorted.map(item => item.volume);
  const maxVolume = Math.max(...volumes);

  // Цвета столбцов (прозрачность по объёму)
  const backgroundColors = sorted.map(item => {
    const opacity = item.volume / maxVolume;
    return `rgba(38, 166, 154, ${opacity.toFixed(2)})`;
  });

  // Вычисляем диапазон цен для позиционирования линий
  const minPrice = sorted.length > 0 ? sorted[sorted.length - 1].price : 0;
  const maxPrice = sorted.length > 0 ? sorted[0].price : 0;
  const priceRange = maxPrice - minPrice || 1;

  const getTopPercent = (price: number) => ((maxPrice - price) / priceRange) * 100;

  return (
    <div style={{ position: 'relative', width: '100px', height: '400px', flexShrink: 0 }}>
      <Chart
        ref={chartRef}
        type="bar"
        data={{
          labels,
          datasets: [{
            label: 'Volume',
            data: volumes,
            backgroundColor: backgroundColors,
            borderColor: 'rgba(38, 166, 154, 0.8)',
            borderWidth: 0.5,
          }],
        }}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `Volume: ${context.raw}`,
              },
            },
          },
          scales: {
            x: {
              display: false,
              beginAtZero: true,
            },
            y: {
              position: 'right',
              ticks: {
                autoSkip: true,
                maxTicksLimit: 20,
                font: { size: 10 },
                color: '#d1d4dc',
              },
              grid: { display: false },
            },
          },
        }}
      />

      {/* Линии уровней (абсолютное позиционирование) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {poc !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: `${getTopPercent(poc)}%`,
              width: '100%',
              height: '2px',
              background: 'red',
              zIndex: 10,
            }}
            title={`POC ${poc}`}
          />
        )}
        {vah !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: `${getTopPercent(vah)}%`,
              width: '100%',
              height: '1px',
              background: 'rgba(0, 255, 0, 0.7)',
              zIndex: 10,
            }}
            title={`VA High ${vah}`}
          />
        )}
        {val !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: `${getTopPercent(val)}%`,
              width: '100%',
              height: '1px',
              background: 'rgba(0, 255, 0, 0.7)',
              zIndex: 10,
            }}
            title={`VA Low ${val}`}
          />
        )}
      </div>
    </div>
  );
};