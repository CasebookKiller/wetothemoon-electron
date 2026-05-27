import React from 'react';

interface VolumeProfileBarsProps {
  data: Array<{ price: number; volume: number }>;
  maxVolume: number;
  minPrice: number;
  maxPrice: number;
  height: number;
  poc?: number;
  vah?: number;
  val?: number;
}

const VolumeProfileBars: React.FC<VolumeProfileBarsProps> = ({
  data,
  maxVolume,
  minPrice,
  maxPrice,
  height,
  poc,
  vah,
  val,
}) => {
  const priceRange = maxPrice - minPrice || 1;

  const getTopPercent = (price: number) => ((maxPrice - price) / priceRange) * 100;

  return (
    <div style={{ position: 'relative', width: '100px', height: `${height}px`, overflow: 'hidden', background: '#1e1e1e' }}>
      {data.map((item) => {
        const volumePercent = (item.volume / maxVolume) * 100;
        const topPercent = getTopPercent(item.price);
        const barHeight = Math.max(2, height / data.length);

        return (
          <div
            key={item.price}
            style={{
              position: 'absolute',
              left: 0,
              top: `${topPercent}%`,
              height: `${barHeight}px`,
              width: `${volumePercent}%`,
              background: volumePercent > 50 ? '#ff6b6b' : '#ffa8a8',
              opacity: 0.8,
            }}
          />
        );
      })}

      {/* Линии уровней */}
      {poc !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: `${getTopPercent(poc)}%`,
            width: '100%',
            height: '2px',
            background: 'red',
            zIndex: 10,
            pointerEvents: 'none',
          }}
          title={`POC ${poc}`}
        />
      )}
      {vah !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: `${getTopPercent(vah)}%`,
            width: '100%',
            height: '1px',
            background: 'rgba(0, 255, 0, 0.7)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
          title={`VA High ${vah}`}
        />
      )}
      {val !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: `${getTopPercent(val)}%`,
            width: '100%',
            height: '1px',
            background: 'rgba(0, 255, 0, 0.7)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
          title={`VA Low ${val}`}
        />
      )}
    </div>
  );
};

export default VolumeProfileBars;