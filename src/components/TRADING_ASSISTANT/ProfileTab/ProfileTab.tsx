// src/components/TRADING_ASSISTANT/ProfileTab/ProfileTab.tsx

import React from 'react';
import { Card } from 'primereact/card';

interface VolumeProfileLevels {
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  totalVolume: number;
  volumeByPrice?: Array<{ price: number; volume: number }>;
}

interface Props {
  profile: VolumeProfileLevels | null;
}

export const ProfileTab: React.FC<Props> = ({ profile }) => {
  if (!profile) {
    return (
      <Card className="surface-ground p-2">
        <p className="text-center text-500">Нет данных профиля</p>
      </Card>
    );
  }

  return (
    <Card className="surface-ground p-2">
      <h4 className="p-mb-2">Volume Profile Data</h4>
      <div className="p-mb-2" style={{ color: '#d1d4dc' }}>
        <p>POC: {profile.poc.toFixed(2)}</p>
        <p>Value Area: {profile.valueAreaLow.toFixed(2)} – {profile.valueAreaHigh.toFixed(2)}</p>
        <p>Total Volume: {profile.totalVolume}</p>
      </div>
      {profile.volumeByPrice && profile.volumeByPrice.length > 0 && (
        <>
          <h5>Top 10 Levels</h5>
          <ul className="p-pl-3" style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
            {profile.volumeByPrice
              .sort((a, b) => b.volume - a.volume)
              .slice(0, 10)
              .map(({ price, volume }) => (
                <li key={price}>{price.toFixed(2)} – {volume.toFixed(0)}</li>
              ))}
          </ul>
        </>
      )}
    </Card>
  );
};