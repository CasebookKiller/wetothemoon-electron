// src/components/SIETCH/DatabaseTables/SourcesTable.tsx

import React from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';

export interface SourceRow {
  id: number;
  url: string;
  title?: string | null;
  source_type?: string | null;
  source_kind?: string | null;
  provider?: string | null;
  collection_method?: string | null;
  authority_basis?: string | null;
  reliability?: number | null;
  access_level?: string | null;
  retrieved_at?: string | null;
  local_path?: string | null;
  sha256?: string | null;
  notes?: string | null;

  origin?: string | null;
}

export interface SourcesTableProps {
  /** Данные для отображения */
  value: SourceRow[];

  /** Клик по строке (в диалогах обычно открывает детали источника) */
  onRowClick?: (row: SourceRow) => void;

  /** Кнопка «Открыть в главном окне» */
  onOpenInMain?: (row: SourceRow) => void;

  /** Компактный режим: без пагинации, скролл (для вложенных таблиц в диалогах) */
  compact?: boolean;

  /** Дополнительный фильтр строк */
  filterFn?: (row: SourceRow) => boolean;

  /** Сообщение, если данных нет */
  emptyMessage?: string;

  /** Показывать колонку действий */
  showActions?: boolean;

  /** Дополнительный CSS-класс */
  className?: string;
}

export const SourcesTable: React.FC<SourcesTableProps> = ({
  value,
  onRowClick,
  onOpenInMain,
  compact = false,
  filterFn,
  emptyMessage = 'Нет данных',
  showActions,
  className,
}) => {
  const rows = filterFn ? value.filter(filterFn) : value;

  const renderActions = (row: SourceRow) => {
    if (!onOpenInMain) return null;
    return (
      <Button
        icon="pi pi-external-link"
        className="osint-soft p-button-sm"
        tooltip="Открыть в главном окне"
        tooltipOptions={{ position: 'left' }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenInMain(row);
        }}
      />
    );
  };

  const renderTitle = (row: SourceRow) => {
    return row.title || <span className="text-500">—</span>;
  };

  const renderUrl = (row: SourceRow) => {
    if (!row.url) return <span className="text-500">—</span>;
    // Обрезаем длинные URL для аккуратного вида
    const display = row.url.length > 60 ? row.url.slice(0, 57) + '…' : row.url;
    return (
      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        title={row.url}
        onClick={(e) => e.stopPropagation()}
        style={{ wordBreak: 'break-all' }}
      >
        {display}
      </a>
    );
  };

  const renderAccessLevel = (row: SourceRow) => {
    const level = row.access_level || '';
    if (!level) return <span className="text-500">—</span>;
    const severity =
      level === 'public' ? 'success'
      : level === 'internal' ? 'info'
      : level === 'confidential' ? 'warning'
      : level === 'restricted' ? 'danger'
      : null;
    return severity ? <Tag value={level} severity={severity as any} /> : level;
  };

  const renderReliability = (row: SourceRow) => {
    const r = row.reliability;
    if (r == null) return <span className="text-500">—</span>;
    const color =
      r >= 80 ? 'green'
      : r >= 60 ? '#e6a23c'
      : r >= 40 ? '#ec9c42'
      : '#ec3942';
    return <span style={{ color, fontWeight: 600 }}>{r}</span>;
  };

  const renderDate = (row: SourceRow) => {
    return row.retrieved_at ? new Date(row.retrieved_at).toLocaleString() : '—';
  };

  const actionsVisible = showActions ?? !!onOpenInMain;

  // В compact режиме скрываем часть колонок
  const showProvider = !compact;
  const showAccess = !compact;
  const showReliability = !compact;

  return (
    <DataTable
      value={rows}
      className={className}
      paginator={!compact}
      rows={compact ? undefined : 20}
      rowsPerPageOptions={compact ? undefined : [10, 20, 50, 100]}
      responsiveLayout="scroll"
      emptyMessage={emptyMessage}
      selectionMode={onRowClick ? 'single' : undefined}
      onRowClick={onRowClick ? (e) => onRowClick(e.data as SourceRow) : undefined}
      rowHover={!!onRowClick}
      size={compact ? 'small' : 'normal'}
      scrollable={compact}
      scrollHeight={compact ? '300px' : undefined}
    >
      <Column field="id" header="ID" sortable style={{ width: '4rem' }} />
      <Column
        field="title"
        header="Название"
        sortable
        body={renderTitle}
        style={{ minWidth: '12rem' }}
      />
      <Column
        field="url"
        header="URL"
        body={renderUrl}
        style={{ minWidth: '16rem' }}
      />
      <Column
        field="source_type"
        header="Тип"
        sortable
        style={{ width: '9rem' }}
        body={(row: SourceRow) => row.source_type || '—'}
      />

      {showProvider && (
        <Column
          field="provider"
          header="Провайдер"
          sortable
          style={{ minWidth: '10rem' }}
          body={(row: SourceRow) => row.provider || <span className="text-500">—</span>}
        />
      )}

      {showReliability && (
        <Column
          field="reliability"
          header="Надёжность"
          sortable
          style={{ width: '7rem' }}
          body={renderReliability}
        />
      )}

      {showAccess && (
        <Column
          field="access_level"
          header="Доступ"
          sortable
          style={{ width: '8rem' }}
          body={renderAccessLevel}
        />
      )}

      <Column
        field="retrieved_at"
        header="Дата получения"
        sortable
        style={{ width: '11rem' }}
        body={renderDate}
      />

      {actionsVisible && (
        <Column
          header=""
          body={renderActions}
          style={{ width: '3rem' }}
          bodyStyle={{ textAlign: 'center' }}
        />
      )}
    </DataTable>
  );
};