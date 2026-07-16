// src/components/TRADING_ASSISTANT/CompactLogPanel/CompactLogPanel.tsx

import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';

interface Props {
  accountId: string;
}

export const CompactLogPanel: React.FC<Props> = ({ accountId }) => {
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const fetchOperations = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const data = await api.getOperations(accountId, from, to, '');
      setOperations(data?.operations || []);
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

  const exportCSV = () => {
    if (operations.length === 0) return;
    const header = 'Date,Type,Ticker,Quantity,Price,Payment,Commission';
    const rows = operations.map(op => [
      formatDate(op.date),
      op.type || '',
      op.ticker || op.figi || '',
      op.quantity ?? '',
      op.price ? `${Number(op.price.units) + Number(op.price.nano)/1e9} ${op.price.currency || 'RUB'}` : '',
      op.payment ? `${Number(op.payment.units) + Number(op.payment.nano)/1e9} ${op.payment.currency || 'RUB'}` : '',
      op.commission ? `${Number(op.commission.units) + Number(op.commission.nano)/1e9} ${op.commission.currency || 'RUB'}` : '',
    ].join(',')).join('\n');
    const csv = header + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `operations_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const json = JSON.stringify(operations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `operations_${from}_${to}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-content-between align-items-center mb-2">
        <h5 className="m-0">Операции</h5>
        <div className="flex gap-1">
          <Button icon="pi pi-download" loading={loading} onClick={exportCSV} className="p-button-sm p-button-success" tooltip="CSV" />
          <Button icon="pi pi-file" onClick={exportJSON} className="p-button-sm p-button-secondary" tooltip="JSON" />
          <Button icon="pi pi-refresh" loading={loading} onClick={fetchOperations} className="p-button-sm p-button-secondary" />
        </div>
      </div>

      <div className="flex align-items-center gap-2 mb-2">
        <label className="mr-1">С</label>
        <Calendar value={new Date(from)} onChange={e => setFrom(e.value?.toISOString().split('T')[0] || '')} dateFormat="yy-mm-dd" className="p-inputtext-sm" />
        <label className="mr-1">По</label>
        <Calendar value={new Date(to)} onChange={e => setTo(e.value?.toISOString().split('T')[0] || '')} dateFormat="yy-mm-dd" className="p-inputtext-sm" />
      </div>

      <DataTable value={operations.slice(0, 50)} className="p-datatable-sm" emptyMessage="Нет операций" responsiveLayout="scroll">
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