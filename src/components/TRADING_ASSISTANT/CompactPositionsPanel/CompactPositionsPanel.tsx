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
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const [posData, ordData] = await Promise.all([
        api.getPositions(accountId),
        api.getOrders(accountId),
      ]);
      const combined = [
        ...(posData?.money || []),
        ...(posData?.securities || []),
      ];
      setPositions(combined);
      setOrders(ordData || []);
    } catch (e) { /* тихо */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [accountId]);

  return (
    <div>
      <div className="flex justify-content-between align-items-center mb-2">
        <h5 className="m-0">Позиции и ордера</h5>
        <Button icon="pi pi-refresh" loading={loading} onClick={fetchData} className="p-button-sm p-button-secondary" />
      </div>

      <h6 className="m-1">Позиции</h6>
      <DataTable value={positions} className="p-datatable-sm" emptyMessage="Нет открытых позиций" responsiveLayout="scroll">
        <Column header="Инструмент" body={(row: any) => row.ticker || row.instrumentUid?.slice(0,8) || row.currency || '—'} />
        <Column header="Кол-во" body={(row: any) => row.quantity ?? row.balance ?? '—'} />
        <Column header="Цена" body={(row: any) => {
          const p = row.averagePositionPrice;
          return p ? `${Number(p.units) + Number(p.nano)/1e9}` : '—';
        }} />
      </DataTable>

      <h6 className="m-1 mt-2">Активные ордера</h6>
      <DataTable value={orders} className="p-datatable-sm" emptyMessage="Нет активных ордеров" responsiveLayout="scroll">
        <Column header="Инструмент" body={(row: any) => row.ticker || row.instrumentUid?.slice(0,8) || '—'} />
        <Column header="Тип" body={(row: any) => row.direction} />
        <Column header="Кол-во" body={(row: any) => row.lotsRequested} />
        <Column header="Цена" body={(row: any) => {
          const p = row.initialOrderPrice;
          return p ? `${Number(p.units) + Number(p.nano)/1e9}` : '—';
        }} />
        <Column header="Статус" body={(row: any) => row.executionReportStatus} />
      </DataTable>
    </div>
  );
};