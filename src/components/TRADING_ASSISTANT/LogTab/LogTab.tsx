import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Calendar } from 'primereact/calendar';

interface Operation {
  id?: string;
  parentOperationId?: string;
  type?: string;
  date?: string;
  state?: string;
  quantity?: number;
  figi?: string;
  instrumentUid?: string;
  ticker?: string;
  payment?: any;
  price?: any;
  commission?: any;
}

interface Props {
  accountId: string;
}

export const LogTab: React.FC<Props> = ({ accountId }) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [cursor, setCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const fetchOperations = async (reset = false) => {
    if (!accountId) return;
    setLoading(true);
    const api = (window as any).electronAPI;
    if (!api?.getOperations) return;

    const result = await api.getOperations(accountId, from, to, reset ? '' : cursor);
    if (reset) {
      setOperations(result.operations || []);
    } else {
      setOperations(prev => [...prev, ...(result.operations || [])]);
    }
    setHasMore(result.hasNext || false);
    setCursor(result.nextCursor || '');
    setLoading(false);
  };

  useEffect(() => {
    if (accountId) fetchOperations(true);
  }, [accountId, from, to]);

  const formatCurrency = (value: any): string => {
    if (!value) return '—';
    if (typeof value === 'object' && value.units !== undefined) {
      return `${Number(value.units) + Number(value.nano || 0) / 1e9} ${value.currency || 'RUB'}`;
    }
    return String(value);
  };

  const dateBody = (row: Operation) => {
    if (!row.date) return '—';
    return new Date(row.date).toLocaleString();
  };

  const typeBody = (row: Operation) => {
    const typeMap: Record<string, string> = {
      OPERATION_TYPE_UNSPECIFIED: '—',
      OPERATION_TYPE_BROKER_FEE: 'Комиссия',
      OPERATION_TYPE_DIVIDEND: 'Дивиденды',
      OPERATION_TYPE_BUY: 'Покупка',
      OPERATION_TYPE_SELL: 'Продажа',
    };
    return typeMap[row.type || ''] || row.type || '—';
  };

  return (
    <Card title="Operations Log" className="surface-ground p-0">
      <div className="p-2">
        <div className="flex align-items-center flex-wrap gap-2 mb-2">
          <label className="mr-1">From</label>
          <Calendar
            value={new Date(from)}
            onChange={e => setFrom(e.value?.toISOString().split('T')[0] || '')}
            dateFormat="yy-mm-dd"
            className="p-inputtext-sm"
          />
          <label className="mr-1">To</label>
          <Calendar
            value={new Date(to)}
            onChange={e => setTo(e.value?.toISOString().split('T')[0] || '')}
            dateFormat="yy-mm-dd"
            className="p-inputtext-sm"
          />
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            onClick={() => fetchOperations(true)}
            loading={loading}
            className="p-button-sm p-button-secondary"
          />
        </div>

        <DataTable
          value={operations}
          loading={loading}
          emptyMessage="No operations found"
          className="p-datatable-sm"
          responsiveLayout="scroll"
          paginator
          rows={10}
        >
          <Column header="Date" body={dateBody} sortable sortField="date" />
          <Column header="Type" body={typeBody} sortable sortField="type" />
          <Column header="Ticker" body={row => row.ticker || row.figi || '—'} />
          <Column header="Quantity" body={row => row.quantity || '—'} />
          <Column header="Price" body={row => formatCurrency(row.price)} />
          <Column header="Payment" body={row => formatCurrency(row.payment)} />
          <Column header="Commission" body={row => formatCurrency(row.commission)} />
        </DataTable>

        {hasMore && (
          <div className="flex justify-content-center mt-2">
            <Button
              label="Load more"
              icon="pi pi-chevron-down"
              loading={loading}
              onClick={() => fetchOperations(false)}
              className="p-button-sm p-button-secondary"
            />
          </div>
        )}
      </div>
    </Card>
  );
};