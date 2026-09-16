// src/components/SIETCH/AuditLogTable.tsx

import React from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';

export interface AuditLogEntry {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
}

export interface AuditLogTableProps {
  value: AuditLogEntry[];
  onRowClick?: (row: AuditLogEntry) => void;
}

const ACTION_SEVERITY: Record<string, string> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  mark_false: 'warning',
  clear_all: 'danger',
};

export const AuditLogTable: React.FC<AuditLogTableProps> = ({ value, onRowClick }) => {
  const renderAction = (row: AuditLogEntry) => (
    <Tag
      value={row.action}
      severity={(ACTION_SEVERITY[row.action] || 'info') as any}
    />
  );

  const renderDate = (row: AuditLogEntry) =>
    row.changed_at ? new Date(row.changed_at).toLocaleString() : '—';

  const renderReason = (row: AuditLogEntry) => {
    const text = row.reason || row.new_value || row.old_value || '';
    return (
      <span
        style={{
          display: 'inline-block',
          maxWidth: '28rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          verticalAlign: 'middle',
        }}
        title={text}
      >
        {text || '—'}
      </span>
    );
  };

  return (
    <DataTable
      value={value}
      paginator
      rows={30}
      rowsPerPageOptions={[20, 30, 50, 100]}
      responsiveLayout="scroll"
      emptyMessage="Записей в журнале нет"
      selectionMode={onRowClick ? 'single' : undefined}
      onRowClick={onRowClick ? (e) => onRowClick(e.data as AuditLogEntry) : undefined}
      rowHover={!!onRowClick}
      size="small"
    >
      <Column field="id" header="ID" sortable style={{ width: '5rem' }} />
      <Column field="changed_at" header="Дата" sortable body={renderDate} style={{ width: '11rem' }} />
      <Column field="action" header="Действие" sortable body={renderAction} style={{ width: '9rem' }} />
      <Column field="table_name" header="Таблица" sortable style={{ width: '9rem' }} />
      <Column field="record_id" header="Запись" sortable style={{ width: '6rem' }} />
      <Column header="Причина / значение" body={renderReason} style={{ minWidth: '20rem' }} />
      <Column field="changed_by" header="Кто" style={{ width: '8rem' }} body={(r: AuditLogEntry) => r.changed_by || '—'} />
    </DataTable>
  );
};