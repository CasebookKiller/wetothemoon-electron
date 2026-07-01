// src/components/TRADING_ASSISTANT/PositionsOrdersTab/PositionsOrdersTab.tsx

import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

interface Props {
  accountId: string;
}

export const PositionsOrdersTab: React.FC<Props> = ({ accountId }) => {
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!accountId) return;
    setLoading(true);
    const api = (window as any).electronAPI;
    if (api) {
      const [posData, ordData] = await Promise.all([
        api.getPositions(accountId),
        api.getOrders(accountId),
      ]);
      // Объединяем денежные позиции и ценные бумаги
      const combined = [
        ...(posData?.money || []),
        ...(posData?.securities || []),
      ];
      setPositions(combined);
      setOrders(ordData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [accountId]);

  const cancelOrder = (orderId: string) => {
    const api = (window as any).electronAPI;
    if (api?.cancelOrder) {
      api.cancelOrder(orderId, accountId).then(() => fetchData());
    }
  };

  const closePosition = async (instrumentUid: string, quantity: number, isLong: boolean) => {
    const api = (window as any).electronAPI;
    if (api?.closePosition) {
      const direction = isLong ? 'long' : 'short';
      // Передаём 4 аргумента, как ожидает обработчик
      const result = await api.closePosition(instrumentUid, accountId, quantity, direction);
      if (result.success) {
        console.log('Позиция закрыта, ордер:', result.orderId);
        fetchData();
      } else {
        alert('Ошибка закрытия: ' + result.error);
      }
    }
  };

  const quantityTemplate = (row: any) => {
    if (row.quantity !== undefined) return row.quantity;
    if (row.balance !== undefined) return row.balance;
    return '—';
  };

  const priceTemplate = (row: any) => {
    if (row.averagePositionPrice) return `${Number(row.averagePositionPrice.units) + Number(row.averagePositionPrice.nano) / 1e9}`;
    if (row.initialOrderPrice) return `${Number(row.initialOrderPrice.units) + Number(row.initialOrderPrice.nano) / 1e9}`;
    return '—';
  };

  const tickerTemplate = (row: any) => {
    if (row.ticker) return row.ticker;
    if (row.instrumentUid) return row.instrumentUid.slice(0, 8);
    if (row.currency) return row.currency;
    return '—';
  };

  return (
    <Card title="Positions & Orders" className="surface-ground p-0">
      <div className="p-2">
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          onClick={fetchData}
          loading={loading}
          className="p-button-sm p-button-secondary p-mb-2"
        />

        <h4 className="p-mb-2">Open Positions</h4>
        <DataTable value={positions} emptyMessage="No open positions" className="p-datatable-sm" responsiveLayout="scroll">
          <Column header="Ticker" body={tickerTemplate} />
          <Column header="Type" body={row => row.instrumentType || 'CASH'} />
          <Column header="Quantity" body={quantityTemplate} />
          <Column header="Avg Price" body={priceTemplate} />
          <Column header="Current P/L" body={() => '—'} />
          <Column body={row => {
            const qty = row.quantity ?? row.balance ?? 0;
            const absQty = Math.abs(Number(qty));
            const isLong = Number(qty) > 0;
            if (!row.instrumentUid || row.instrumentUid === 'RUB' || absQty === 0) return null;
            return (
              <Button
                icon="pi pi-times"
                className="p-button-sm p-button-danger"
                onClick={() => closePosition(row.instrumentUid, absQty, isLong)}
                tooltip="Close position"
              />
            );
          }} />
        </DataTable>

        <h4 className="p-mb-2 p-mt-3">Active Orders</h4>
        <DataTable value={orders} emptyMessage="No active orders" className="p-datatable-sm" responsiveLayout="scroll">
          <Column header="Ticker" body={tickerTemplate} />
          <Column header="Type" body={row => row.direction} />
          <Column header="Qty" body={row => row.lotsRequested} />
          <Column header="Price" body={priceTemplate} />
          <Column header="Status" body={row => row.executionReportStatus} />
          <Column body={row => (
            <Button
              icon="pi pi-ban"
              className="p-button-sm p-button-warning"
              onClick={() => cancelOrder(row.orderId)}
              tooltip="Cancel order"
            />
          )} />
        </DataTable>
      </div>
    </Card>
  );
};