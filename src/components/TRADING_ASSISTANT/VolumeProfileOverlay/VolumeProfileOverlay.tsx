import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface Props {
  volumeByPrice: Array<{ price: number; volume: number }>;
  poc?: number;
  vah?: number;
  val?: number;
  visible: boolean;
}

export const VolumeProfileOverlay: React.FC<Props> = ({ volumeByPrice, poc, vah, val, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !visible || !volumeByPrice.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Подготовка данных: сортировка по цене
    const sorted = [...volumeByPrice].sort((a, b) => b.price - a.price);
    const labels = sorted.map(item => item.price.toFixed(2));
    const volumes = sorted.map(item => item.volume);
    const maxVolume = Math.max(...volumes);

    // Цвета для каждого уровня (прозрачность зависит от объёма)
    const backgroundColors = sorted.map(item => {
      const opacity = item.volume / maxVolume;
      return `rgba(38, 166, 154, ${opacity.toFixed(2)})`;
    });

    // Удаляем предыдущий график
    chartRef.current?.destroy();

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Volume',
          data: volumes,
          backgroundColor: backgroundColors,
          borderColor: 'rgba(38, 166, 154, 0.8)',
          borderWidth: 0.5,
        }],
      },
      options: {
        indexAxis: 'y',  // горизонтальные бары
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
            display: false, // скрываем ось объёмов (не важна для визуализации)
            beginAtZero: true,
          },
          y: {
            position: 'right', // ось цен справа
            ticks: {
              autoSkip: true,
              maxTicksLimit: 20,
              font: {
                size: 10,
              },
              color: '#d1d4dc',
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });

    // Опционально: добавляем линии POC, VAH, VAL с помощью chartjs-plugin-annotation
    // Но чтобы не усложнять, пока без них (можно добавить позже)

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [volumeByPrice, visible]);

  if (!visible) return null;

  return (
    <div style={{ width: '100px', height: '400px', flexShrink: 0 }}>
      <canvas ref={canvasRef} />
    </div>
  );
};