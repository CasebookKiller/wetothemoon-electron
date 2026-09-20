// src/components/SIETCH/DatabaseTables/EntitiesTable.tsx

import React from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';

export interface EntityRow {
  id: number;
  type: string;
  value: string;
  label?: string | null;
  normalized_value?: string | null;
  confidence?: number | null;
  status?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  notes?: string | null;
  origin?: string | null;
}

export interface EntitiesTableProps {
  /** Данные для отображения */
  value: EntityRow[];

  /** Клик по строке (в диалогах обычно открывает детали) */
  onRowClick?: (row: EntityRow) => void;

  /** Кнопка «Открыть в главном окне» (обычно в диалогах) */
  onOpenInMain?: (row: EntityRow) => void;

  /** Компактный режим: без пагинации, меньше отступы (для вложенных таблиц в диалогах) */
  compact?: boolean;

  /** Дополнительный фильтр строк (например, чтобы показать только подтверждённые) */
  filterFn?: (row: EntityRow) => boolean;

  /** Сообщение, если данных нет */
  emptyMessage?: string;

  /** Показывать ли колонку действий (используется, если onOpenInMain задан) */
  showActions?: boolean;

  /** Дополнительный CSS-класс контейнера */
  className?: string;

  /** Мульти-выбор (batch-операции). Если передан onSelectionChange —
   *  в таблице появляется колонка с чекбоксами. */
  selection?: EntityRow[];
  onSelectionChange?: (rows: EntityRow[]) => void;
}

export const EntitiesTable: React.FC<EntitiesTableProps> = ({
  value,
  onRowClick,
  onOpenInMain,
  compact = false,
  filterFn,
  emptyMessage = 'Нет данных',
  showActions,
  className,
  selection,
  onSelectionChange,
}) => {
  const rows = filterFn ? value.filter(filterFn) : value;

  const renderActions = (row: EntityRow) => {
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

  const renderStatus = (row: EntityRow) => {
    const status = row.status || '—';
    const color =
      status === 'confirmed' ? 'green'
      : status === 'false' ? '#ec3942'
      : status === 'hypothesis' ? '#e6a23c'
      : status === 'archived' ? '#888'
      : 'inherit';
    return <span style={{ color }}>{status}</span>;
  };

  const renderDate = (row: EntityRow) => {
    return row.last_seen ? new Date(row.last_seen).toLocaleString() : '—';
  };

  const actionsVisible = showActions ?? !!onOpenInMain;

  const multiSelect = !!onSelectionChange;
  const effectiveSelectionMode = multiSelect
    ? 'checkbox'
    : (onRowClick ? 'single' : undefined);

  return (
    <DataTable
      value={rows}
      className={className}
      paginator={!compact}
      rows={compact ? undefined : 20}
      rowsPerPageOptions={compact ? undefined : [10, 20, 50, 100]}
      responsiveLayout="scroll"
      emptyMessage={emptyMessage}
      selectionMode={effectiveSelectionMode as any}
      selection={multiSelect ? selection : undefined}
      onSelectionChange={
        multiSelect
          ? (e: any) => onSelectionChange!(e.value as EntityRow[])
          : undefined
      }
      dataKey="id"
      onRowClick={onRowClick ? (e) => onRowClick(e.data as EntityRow) : undefined}
      rowHover={!!onRowClick}
      size={compact ? 'small' : 'normal'}
      scrollable={compact}
      scrollHeight={compact ? '300px' : undefined}
    >
      {multiSelect && (
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
      )}
      <Column field="id" header="ID" sortable style={{ width: '4rem' }} />
      <Column field="type" header="Тип" sortable style={{ width: '8rem' }} />
      <Column field="label" header="Название" sortable body={(row: EntityRow) => row.label || row.value} />
      <Column field="value" header="Значение" sortable body={(row: EntityRow) => row.value} />
      <Column field="confidence" header="Уверенность" sortable style={{ width: '7rem' }} body={(row: EntityRow) => row.confidence ?? '—'} />
      <Column field="status" header="Статус" sortable style={{ width: '8rem' }} body={renderStatus} />
      <Column field="last_seen" header="Обновлено" sortable body={renderDate} />
      <Column
        field="origin"
        header="Источник"
        sortable
        style={{ width: '8rem' }}
        body={(row: EntityRow) => {
          const value = row.origin || 'scraper';
          const severity = value === 'manual' ? 'warning' : value === 'import' ? 'success' : 'info';
          const label = value === 'manual' ? 'вручную' : value === 'import' ? 'импорт' : 'авто';
          return <Tag value={label} severity={severity as any} />;
        }}
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