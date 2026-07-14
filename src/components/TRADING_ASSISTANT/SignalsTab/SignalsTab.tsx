// src/components/TRADING_ASSISTANT/SignalsTab/SignalsTab.tsx

import React from 'react';
import { Card } from 'primereact/card';

interface Props {
  signals: Array<{ type: string; message: string; price: number }>;
}

export const SignalsTab: React.FC<Props> = ({ signals }) => {
  return (
    <Card className="surface-ground p-2">
      <h4 className="p-mb-2">Signals</h4>
      {signals.length > 0 ? (
        <ul className="p-pl-3" style={{ color: '#d1d4dc', maxHeight: '200px', overflowY: 'auto' }}>
          {signals.map((sig, idx) => (
            <li key={idx}><strong>{sig.type}</strong>: {sig.message} @ {sig.price}</li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-500">Ожидание сигналов...</p>
      )}
    </Card>
  );
};