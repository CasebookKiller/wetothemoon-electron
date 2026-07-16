// src/components/TRADING_ASSISTANT/CompactLogPanel/CompactLogPanel.tsx

import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';

interface Props {
  accountId: string;
}

export const CompactLogPanel: React.FC<Props> = ({ accountId }) => {
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOperations = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 3600_000).toISOString().split('T')[0];
      const to = now.toISOString().split('T')[0];
      const data = await api.getOperations(accountId, from, to, '');
      setOperations((data?.operations || []).slice(0, 5));
    } catch (e) { /* тихо */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOperations();
    const interval = setInterval(fetchOperations, 30_000);
    return () => clearInterval(interval);
  }, [accountId]);

  const formatDate = (d: any) => {
    if (!d) return '—';
    const ts = new Date(d.seconds ? d.seconds * 1000 : d);
    return ts.toLocaleString('ru-RU');
  };

  return (
    <div>
      <div className="flex justify-content-between align-items-center mb-2">
        <h5 className="m-0">Последние операции</h5>
        <Button icon="pi pi-refresh" loading={loading} onClick={fetchOperations} className="p-button-sm p-button-secondary" />
      </div>
      <DataTable value={operations} className="p-datatable-sm" emptyMessage="Нет операций" responsiveLayout="scroll">
        <Column header="Время" body={(row: any) => formatDate(row.date)} />
        <Column header="Тип" body={(row: any) => row.type || '—'} />
        <Column header="Инструмент" body={(row: any) => row.ticker || row.figi || '—'} />
        <Column header="Кол-во" body={(row: any) => row.quantity || '—'} />
        <Column header="Сумма" body={(row: any) => {
          const p = row.payment;
          return p ? `${Number(p.units) + Number(p.nano)/1e9} ${p.currency || 'RUB'}` : '—';
        }} />
      </DataTable>
    </div>
  );
};