// src/components/SIETCH/AuditLogTab.tsx

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Calendar } from 'primereact/calendar';
import { Dialog } from 'primereact/dialog';
import { DetailFields } from '@/components/SIETCH/DetailFields';
import { AuditLogTable, type AuditLogEntry } from './AuditLogTable';

const PAGE_SIZE = 200;

const actionOptions = [
  { label: 'Все действия', value: null },
  { label: 'create', value: 'create' },
  { label: 'update', value: 'update' },
  { label: 'delete', value: 'delete' },
  { label: 'mark_false', value: 'mark_false' },
  { label: 'clear_all', value: 'clear_all' },
];

export const AuditLogTab: React.FC = () => {
  const api = (window as any).electronAPI;

  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filterTable, setFilterTable] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);

  const [tableOptions, setTableOptions] = useState<{ label: string; value: string | null }[]>([]);

  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const filters: any = {};
      if (filterTable) filters.table_name = filterTable;
      if (filterAction) filters.action = filterAction;
      if (filterSearch.trim()) filters.search = filterSearch.trim();
      if (filterDateFrom) filters.date_from = filterDateFrom.toISOString().slice(0, 10);
      if (filterDateTo) filters.date_to = filterDateTo.toISOString().slice(0, 10);

      const res = await api.getAuditLog(filters, PAGE_SIZE, 0);
      if (res.success) {
        setItems(res.items || []);
        setTotal(res.total || 0);
      } else {
        setError(res.error || 'Ошибка загрузки журнала');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      const [tablesRes] = await Promise.all([api.getAuditLogTables()]);
      if (tablesRes?.success) {
        setTableOptions([
          { label: 'Все таблицы', value: null },
          ...(tablesRes.items || []).map((t: string) => ({ label: t, value: t })),
        ]);
      }
    } catch (e) {
      console.error('Не удалось загрузить фильтры журнала:', e);
    }
  };

  useEffect(() => {
    loadFilters();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFilters = () => {
    setFilterTable(null);
    setFilterAction(null);
    setFilterSearch('');
    setFilterDateFrom(null);
    setFilterDateTo(null);
  };

  const openDetails = (row: AuditLogEntry) => {
    setSelected(row);
    setDetailsVisible(true);
  };

  return (
    <div>
      {/* Панель фильтров */}
      <div className="flex flex-wrap align-items-center gap-2 mb-3 audit-log-filters">
        <div style={{ minWidth: '180px' }}>
          <Dropdown
            value={filterTable}
            options={tableOptions}
            onChange={(e) => setFilterTable(e.value)}
            placeholder="Таблица"
            className="w-full"
          />
        </div>

        <div style={{ minWidth: '160px' }}>
          <Dropdown
            value={filterAction}
            options={actionOptions}
            onChange={(e) => setFilterAction(e.value)}
            placeholder="Действие"
            className="w-full"
          />
        </div>

        <div style={{ minWidth: '200px', flex: 1 }}>
          <span className="p-input-icon-left w-full search-input-with-icon">
            <i className="pi pi-search" />
            <InputText
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder="Поиск по причине или значению"
              className="w-full"
            />
          </span>
        </div>

        <Calendar
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.value as Date | null)}
          placeholder="От"
          showIcon
          dateFormat="yy-mm-dd"
          style={{ width: '140px' }}
        />
        <Calendar
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.value as Date | null)}
          placeholder="До"
          showIcon
          dateFormat="yy-mm-dd"
          style={{ width: '140px' }}
        />

        <Button
          label={loading ? 'Загрузка...' : 'Применить'}
          icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-filter'}
          className="osint p-button-sm"
          onClick={load}
          disabled={loading}
        />
        <Button
          label="Сбросить"
          icon="pi pi-times"
          className="osint-soft p-button-sm"
          onClick={() => { resetFilters(); setTimeout(load, 0); }}
          disabled={loading}
        />
      </div>

      <div className="text-sm text-500 mb-2">
        Всего записей: <b>{total}</b>
        {items.length < total && <> (показаны первые {items.length})</>}
      </div>

      {error && <p className="p-error">{error}</p>}

      <AuditLogTable value={items} onRowClick={openDetails} />

      <Dialog
        visible={detailsVisible}
        style={{ width: '720px', maxWidth: '95vw' }}
        modal
        onHide={() => setDetailsVisible(false)}
        header={<span className="p-panel-title">Запись журнала #{selected?.id}</span>}
        footer={
          <div className="p-panel-footer flex justify-content-end">
            <Button
              label="Закрыть"
              icon="pi pi-times"
              className="osint-soft"
              onClick={() => setDetailsVisible(false)}
            />
          </div>
        }
      >
        {selected && (
          <DetailFields
            fields={[
              { label: 'ID', value: selected.id },
              { label: 'Дата', value: new Date(selected.changed_at).toLocaleString() },
              { label: 'Действие', value: selected.action },
              { label: 'Таблица', value: selected.table_name },
              { label: 'Запись', value: `#${selected.record_id}` },
              { label: 'Кто', value: selected.changed_by || '—' },
              {
                label: 'Причина',
                span: 2,
                value: selected.reason || <span className="text-500">—</span>,
              },
              {
                label: 'Старое значение',
                span: 2,
                value: selected.old_value ? (
                  <pre
                    className="text-sm p-2 border-round"
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      background: 'var(--tg-theme-secondary-bg-color)',
                    }}
                  >
                    {prettyJson(selected.old_value)}
                  </pre>
                ) : (
                  <span className="text-500">—</span>
                ),
              },
              {
                label: 'Новое значение',
                span: 2,
                value: selected.new_value ? (
                  <pre
                    className="text-sm p-2 border-round"
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      background: 'var(--tg-theme-secondary-bg-color)',
                    }}
                  >
                    {prettyJson(selected.new_value)}
                  </pre>
                ) : (
                  <span className="text-500">—</span>
                ),
              },
            ]}
          />
        )}
      </Dialog>
    </div>
  );
};

function prettyJson(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    return JSON.stringify(obj, null, 2);
  } catch {
    return raw;
  }
}