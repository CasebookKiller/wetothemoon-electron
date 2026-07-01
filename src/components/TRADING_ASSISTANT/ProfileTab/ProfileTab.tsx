// src/components/TRADING_ASSISTANT/ProfileTab/ProfileTab.tsx

import React from 'react';
import { Card } from 'primereact/card';

interface VolumeProfileLevels {
  instrumentUid: string;
  timestamp: string;
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  hvn: number[];
  lvn: number[];
  totalVolume: number;
  volumeByPrice: Array<{ price: number; volume: number }>;
}

interface Props {
  profile: VolumeProfileLevels | null;
}

export const ProfileTab: React.FC<Props> = ({ profile }) => {
  if (!profile) {
    return (
      <Card title="Volume Profile" className="surface-ground">
        <p className="text-center text-500">Нет данных профиля</p>
      </Card>
    );
  }

  return (
    <Card title="Volume Profile Data" className="surface-ground">
      <div style={{ color: '#d1d4dc', marginBottom: '10px' }}>
        <p>POC: {profile.poc.toFixed(2)}</p>
        <p>Value Area: {profile.valueAreaLow.toFixed(2)} – {profile.valueAreaHigh.toFixed(2)}</p>
        <p>Total Volume: {profile.totalVolume}</p>
      </div>
      {profile.volumeByPrice?.length > 0 && (
        <>
          <h4>Top 10 Levels</h4>
          <ul style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
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