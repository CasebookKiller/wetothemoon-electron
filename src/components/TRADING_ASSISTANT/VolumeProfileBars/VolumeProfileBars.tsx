// src/components/VolumeProfileBars/VolumeProfileBars.tsx
import React from 'react';

interface VolumeProfileBarsProps {
  data: Array<{ price: number; volume: number }>;
  maxVolume: number;
  minPrice: number;
  maxPrice: number;
  height: number; // высота в пикселях, должна совпадать с высотой графика
}

const VolumeProfileBars: React.FC<VolumeProfileBarsProps> = ({ data, maxVolume, minPrice, maxPrice, height }) => {
  const priceRange = maxPrice - minPrice || 1; // избегаем деления на ноль

  return (
    <div style={{ position: 'relative', width: '100px', height: `${height}px`, overflow: 'hidden', background: '#1e1e1e' }}>
      {data.map((item) => {
        const volumePercent = (item.volume / maxVolume) * 100;
        // Позиция по вертикали: чем выше цена, тем выше полоска
        const topPercent = ((maxPrice - item.price) / priceRange) * 100;
        const barHeight = Math.max(2, height / data.length); // минимальная высота полоски 2px

        return (
          <div
            key={item.price}
            style={{
              position: 'absolute',
              left: 0,
              top: `${topPercent}%`,
              height: `${barHeight}px`,
              width: `${volumePercent}%`,
              background: volumePercent > 50 ? '#ff6b6b' : '#ffa8a8', // красный для больших объёмов
              opacity: 0.8,
            }}
          />
        );
      })}
    </div>
  );
};

export default VolumeProfileBars;