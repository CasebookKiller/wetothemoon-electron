import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';

interface Props {
  chart: IChartApi | null;
  volumeByPrice: Array<{ price: number; volume: number }>;
  maxVolume: number;
}

export const VolumeProfileOverlay: React.FC<Props> = ({ chart, volumeByPrice, maxVolume }) => {
  const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  useEffect(() => {
    if (!chart || !volumeByPrice.length) return;

    // Удаляем старые линии
    seriesRef.current.forEach(s => {
      try { chart.removeSeries(s); } catch {}
    });
    seriesRef.current = [];

    // Топ-20 уровней по объёму
    const topLevels = [...volumeByPrice]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);

    const now = Math.floor(Date.now() / 1000);
    const startOfDay = now - (now % 86400);

    topLevels.forEach(({ price, volume }) => {
      const opacity = volume / maxVolume;
      const color = `rgba(38, 166, 154, ${opacity.toFixed(2)})`;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData([
        { time: startOfDay as any, value: price },
        { time: now as any, value: price },
      ]);
      seriesRef.current.push(series);
    });
  }, [chart, volumeByPrice, maxVolume]);

  return null;
};