import React from 'react';
import { Card } from 'primereact/card';

interface Signal {
  instrumentUid: string;
  time: string;
  type: string;
  price: number;
  level: number;
  message: string;
}

interface Props {
  liveSignals: Signal[];
}

export const SignalsTab: React.FC<Props> = ({ liveSignals }) => {
  return (
    <Card title="Live Signals" className="surface-ground">
      {liveSignals.length > 0 ? (
        <ul style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
          {liveSignals.map((sig, idx) => (
            <li key={idx}><strong>{sig.type}</strong>: {sig.message} @ {sig.price}</li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-500">Ожидание сигналов...</p>
      )}
    </Card>
  );
};