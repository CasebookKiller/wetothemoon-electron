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
      console.log('[Positions] raw positions:', posData);
      console.log('[Orders] raw orders:', ordData);
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

  // Закрытие позиции (уже было)
  const handleClosePosition = async (row: any) => {
    if (!row.instrumentUid) return;
    let totalQuantity = 0;
    if (row.quantity?.units) {
      totalQuantity = Math.abs(Number(row.quantity.units) + Number(row.quantity.nano || 0) / 1e9);
    } else if (row.balance !== undefined) {
      const balance = Math.abs(Number(row.balance) || 0);
      const blocked = Math.abs(Number(row.blocked) || 0);
      totalQuantity = balance + blocked;
    }
    if (totalQuantity <= 0) return;
    const balanceNum = row.quantity?.units 
      ? Number(row.quantity.units) 
      : Number(row.balance || 0);
    const direction = balanceNum >= 0 ? 'long' : 'short';

    const api = (window as any).electronAPI;
    if (!api?.closePosition) return;
    try {
      const result = await api.closePosition(row.instrumentUid, accountId, totalQuantity, direction);
      if (result.success) fetchData();
      else console.error(`[CompactPositions] Ошибка закрытия: ${result.error}`);
    } catch (err) {
      console.error('[CompactPositions] Исключение при закрытии позиции:', err);
    }
  };

  // 👇 Отмена ордера
  const handleCancelOrder = async (orderId: string) => {
    const api = (window as any).electronAPI;
    if (!api?.cancelOrder) return;
    try {
      const result = await api.cancelOrder(orderId, accountId);
      if (result.success) {
        console.log(`[CompactPositions] Ордер ${orderId} отменён`);
        fetchData();
      } else {
        console.error(`[CompactPositions] Ошибка отмены ордера: ${result.error}`);
      }
    } catch (err) {
      console.error('[CompactPositions] Исключение при отмене ордера:', err);
    }
  };

  // Шаблоны кнопок
  const positionActionsTemplate = (row: any) => {
    if (!row.instrumentUid) return null;
    return (
      <Button
        icon="pi pi-times"
        className="p-button-sm p-button-danger p-1"
        onClick={() => handleClosePosition(row)}
        tooltip="Закрыть позицию"
        tooltipOptions={{ position: 'top' }}
      />
    );
  };

  const orderActionsTemplate = (row: any) => {
    if (!row.orderId) return null;
    return (
      <Button
        icon="pi pi-times"
        className="p-button-sm p-button-danger p-1"
        onClick={() => handleCancelOrder(row.orderId)}
        tooltip="Отменить ордер"
        tooltipOptions={{ position: 'top' }}
      />
    );
  };

  return (
    <div>
      <div className="flex justify-content-between align-items-center mt-2 mb-2">
        <h5 className="m-0">Позиции и ордера</h5>
        <Button icon="pi pi-refresh" loading={loading} onClick={fetchData} className="p-button-sm p-button-secondary p-1 px-2" />
      </div>

      <h6 className="m-1">Позиции</h6>
      <DataTable value={positions} className="p-datatable-sm" emptyMessage="Нет открытых позиций" responsiveLayout="scroll">
        <Column header="Инструмент" body={(row: any) => row.ticker || row.instrumentUid?.slice(0,8) || row.currency || '—'} />
        <Column header="Кол-во" body={(row: any) => {
          if (row.quantity?.units !== undefined) {
            return Number(row.quantity.units) + Number(row.quantity.nano || 0) / 1e9;
          }
          if (row.balance !== undefined) return `${row.balance} / ${row.blocked || 0}`;
          return '—';
        }} />
        <Column header="Цена" body={(row: any) => {
          const p = row.averagePositionPrice ?? row.currentPrice;
          if (p && p.units !== undefined) {
            return `${Number(p.units) + Number(p.nano || 0) / 1e9}`;
          }
          return row.currency ? `1 ${row.currency}` : '—';
        }} />
        <Column header="Действия" body={positionActionsTemplate} style={{ width: '80px', textAlign: 'center' }} />
      </DataTable>

      <h6 className="m-1 mt-2">Активные ордера</h6>
      <DataTable value={orders} className="p-datatable-sm" emptyMessage="Нет активных ордеров" responsiveLayout="scroll">
        <Column header="Инструмент" body={(row: any) => row.ticker || row.instrumentUid?.slice(0,8) || '—'} />
        <Column header="Тип" body={(row: any) => row.direction} />
        <Column
          header="Кол-во"
          body={(row: any) => {
            if (row.quantity?.units !== undefined) {
              return Math.abs(Number(row.quantity.units) + Number(row.quantity.nano || 0) / 1e9);
            }
            if (row.balance !== undefined) return `${Math.abs(Number(row.balance))} / ${row.blocked || 0}`;
            return '—';
          }} 
        />
        <Column header="Цена" body={(row: any) => {
          const p = row.initialOrderPrice;
          return p ? `${Number(p.units) + Number(p.nano)/1e9}` : '—';
        }} />
        <Column header="Статус" body={(row: any) => row.executionReportStatus} />
        {/* 👇 Новая колонка с кнопкой отмены */}
        <Column header="Действия" body={orderActionsTemplate} style={{ width: '80px', textAlign: 'center' }} />
      </DataTable>
    </div>
  );
};