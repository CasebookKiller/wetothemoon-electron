import React from 'react';
import { Card } from 'primereact/card';

interface Trade {
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  profit: number;
  profitPercent: number;
  exitReason: string;
}

interface Props {
  trades: Trade[];
}

export const TradesTab: React.FC<Props> = ({ trades }) => {
  return (
    <Card title="Trade History" className="surface-ground">
      {trades.length > 0 ? (
        <div style={{ maxHeight: '400px', overflowY: 'auto', color: '#d1d4dc' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Type</th><th>Entry Time</th><th>Exit Time</th>
                <th>Entry Price</th><th>Exit Price</th><th>Profit</th>
                <th>Exit Reason</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ color: t.type === 'BUY' ? '#4caf50' : '#f44336' }}>{t.type}</td>
                  <td>{new Date(t.entryTime).toLocaleString()}</td>
                  <td>{new Date(t.exitTime).toLocaleString()}</td>
                  <td>{t.entryPrice.toFixed(2)}</td>
                  <td>{t.exitPrice.toFixed(2)}</td>
                  <td className={t.profit >= 0 ? 'positive' : 'negative'}>{t.profit.toFixed(2)}</td>
                  <td>{t.exitReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-500">No trades yet</p>
      )}
    </Card>
  );
};