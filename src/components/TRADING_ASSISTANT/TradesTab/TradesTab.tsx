// src/components/TRADING_ASSISTANT/TradesTab/TradesTab.tsx

import React from 'react';
import { Card } from 'primereact/card';
import { EquityChart } from '../EquityChart/EquityChart';

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
  currentTrades: Trade[];
  trades: Trade[];
}

export const TradesTab: React.FC<Props> = ({ currentTrades, trades }) => {
  return (
    <Card className="surface-ground p-2">
      <h4 className="p-mb-2">Trade History</h4>
      {currentTrades.length > 0 ? (
        <div style={{ maxHeight: '400px', overflowY: 'auto', color: '#d1d4dc' }}>
          <table className="p-datatable-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Type</th><th>Entry Time</th><th>Exit Time</th>
                <th>Entry Price</th><th>Exit Price</th><th>Profit</th>
                <th>Exit Reason</th>
              </tr>
            </thead>
            <tbody>
              {currentTrades.map((t: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #444' }}>
                  <td style={{ color: t.type === 'BUY' ? '#4caf50' : '#f44336' }}>{t.type}</td>
                  <td>{new Date(t.entryTime).toLocaleString()}</td>
                  <td>{new Date(t.exitTime).toLocaleString()}</td>
                  <td>{t.entryPrice.toFixed(2)}</td>
                  <td>{t.exitPrice.toFixed(2)}</td>
                  <td className={t.profit >= 0 ? 'text-green-500' : 'text-red-500'}>{t.profit.toFixed(2)}</td>
                  <td>{t.exitReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trades.length > 0 && (
            <div className="mt-3">
              <h4 className="p-mb-2">Equity Curve</h4>
              <EquityChart trades={trades} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-500">No trades yet</p>
      )}
    </Card>
  );
};