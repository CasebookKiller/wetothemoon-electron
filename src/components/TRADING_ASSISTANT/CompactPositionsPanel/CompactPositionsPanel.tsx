// src/components/TRADING_ASSISTANT/CompactPositionsPanel/CompactPositionsPanel.tsx

import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';

interface Props {
  accountId: string;
}

export const CompactPositionsPanel: React.FC<Props> = ({ accountId }) => {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const data = await api.getPositions(accountId);
      const combined = [...(data?.money || []), ...(data?.securities || [])];
      setPositions(combined);
    } catch (e) { /* тихо */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 10_000);
    return () => clearInterval(interval);
  }, [accountId]);

  return (
    <div>
      <div className="flex justify-content-between align-items-center mb-2">
        <h5 className="m-0">Позиции</h5>
        <Button icon="pi pi-refresh" loading={loading} onClick={fetchPositions} className="p-button-sm p-button-secondary" />
      </div>
      <DataTable value={positions} className="p-datatable-sm" emptyMessage="Нет открытых позиций" responsiveLayout="scroll">
        <Column header="Инструмент" body={(row: any) => row.ticker || row.instrumentUid?.slice(0,8) || row.currency || '—'} />
        <Column header="Кол-во" body={(row: any) => row.quantity ?? row.balance ?? '—'} />
        <Column header="Цена" body={(row: any) => {
          const p = row.averagePositionPrice;
          return p ? `${Number(p.units) + Number(p.nano)/1e9}` : '—';
        }} />
      </DataTable>
    </div>
  );
};