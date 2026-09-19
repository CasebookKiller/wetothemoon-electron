// src/components/SIETCH/DatabaseTables/ObservationsTable.tsx

import React from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';

export interface ObservationRow {
  id: number;
  entity_id: number;
  attribute: string;
  value: string;
  confidence?: number | null;
  observed_at?: string | null;
  notes?: string | null;

  // Сущность (JOIN)
  entity_label?: string | null;
  entity_type?: string | null;

  // Источник (LEFT JOIN)
  source_id?: number | null;
  source_url?: string | null;
  source_title?: string | null;
  source_provider?: string | null;

  origin?: string | null;
}

export interface ObservationsTableProps {
  value: ObservationRow[];

  /**
   * Какую колонку сущности показывать:
   * - true  — показываем колонку «Сущность» (главное окно, диалог источника)
   * - false — скрываем (в диалоге сущности все наблюдения и так относятся к одной сущности)
   */
  showEntity?: boolean;

  /** Клик по строке (в диалогах обычно открывает детали наблюдения) */
  onRowClick?: (row: ObservationRow) => void;

  /** Клик по названию сущности (cross-navigation) */
  onEntityClick?: (row: ObservationRow) => void;

  /** Клик по источнику (cross-navigation) */
  onSourceClick?: (row: ObservationRow) => void;

  /** Кнопка «Открыть в главном окне» */
  onOpenInMain?: (row: ObservationRow) => void;

  /** Компактный режим (без пагинации, скролл) */
  compact?: boolean;

  /** Дополнительный фильтр строк */
  filterFn?: (row: ObservationRow) => boolean;

  /** Сообщение, если данных нет */
  emptyMessage?: string;

  /** Показывать колонку действий */
  showActions?: boolean;

  /** Дополнительный CSS-класс */
  className?: string;

  /** Мульти-выбор (batch-операции). Если передан onSelectionChange —
   *  в таблице появляется колонка с чекбоксами. */
  selection?: ObservationRow[];
  onSelectionChange?: (rows: ObservationRow[]) => void;
}

export const ObservationsTable: React.FC<ObservationsTableProps> = ({
  value,
  showEntity = true,
  onRowClick,
  onEntityClick,
  onSourceClick,
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

  const renderActions = (row: ObservationRow) => {
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

  const renderEntity = (row: ObservationRow) => {
    const text = `[${row.entity_id}] ${row.entity_label || '—'}${row.entity_type ? ` (${row.entity_type})` : ''}`;
    if (onEntityClick) {
      return (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEntityClick(row);
          }}
          style={{ color: 'inherit', textDecoration: 'underline dotted' }}
          title="Открыть сущность"
        >
          {text}
        </a>
      );
    }
    return text;
  };

  const renderSource = (row: ObservationRow) => {
    if (!row.source_id) return <span className="text-500">—</span>;
    const text = row.source_title || row.source_url || `[${row.source_id}]`;
    const content = onSourceClick ? (
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSourceClick(row);
        }}
        style={{ color: 'inherit', textDecoration: 'underline dotted' }}
        title="Открыть источник"
      >
        {text}
      </a>
    ) : row.source_url ? (
      <a href={row.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        {text}
      </a>
    ) : (
      text
    );
    return (
      <div>
        {content}
        {row.source_provider && (
          <div className="text-xs text-500">{row.source_provider}</div>
        )}
      </div>
    );
  };

  const renderDate = (row: ObservationRow) => {
    return row.observed_at ? new Date(row.observed_at).toLocaleString() : '—';
  };

  const renderOrigin = (row: ObservationRow) => {
    const value = row.origin || 'scraper';
    const severity = value === 'manual' ? 'warning' : value === 'import' ? 'success' : 'info';
    const label = value === 'manual' ? 'вручную' : value === 'import' ? 'импорт' : 'авто';
    return <Tag value={label} severity={severity as any} />;
  };

  const actionsVisible = showActions ?? !!onOpenInMain;

  // В compact-режиме скрываем notes и часть колонок
  const showNotes = !compact;

  const multiSelect = !!onSelectionChange;
  const effectiveSelectionMode = multiSelect
    ? 'multiple'
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
          ? (e: any) => onSelectionChange!(e.value as ObservationRow[])
          : undefined
      }
      dataKey="id"
      onRowClick={onRowClick ? (e) => onRowClick(e.data as ObservationRow) : undefined}
      rowHover={!!onRowClick}
      size={compact ? 'small' : 'normal'}
      scrollable={compact}
      scrollHeight={compact ? '300px' : undefined}
    >
      {multiSelect && (
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
      )}
      
      <Column field="id" header="ID" sortable style={{ width: '4rem' }} />

      {showEntity && (
        <Column
          header="Сущность"
          body={renderEntity}
          style={{ minWidth: '14rem' }}
        />
      )}

      <Column
        field="attribute"
        header="Атрибут"
        sortable
        style={{ minWidth: '10rem' }}
        body={(row: ObservationRow) => <b>{row.attribute}</b>}
      />

      <Column
        field="value"
        header="Значение"
        sortable
        style={{ minWidth: '14rem' }}
        body={(row: ObservationRow) => (
          <span style={{ wordBreak: 'break-word' }}>{row.value}</span>
        )}
      />

      <Column
        field="confidence"
        header="Уверенность"
        sortable
        style={{ width: '7rem' }}
        body={(row: ObservationRow) => row.confidence ?? '—'}
      />

      <Column
        field="observed_at"
        header="Дата"
        sortable
        style={{ width: '11rem' }}
        body={renderDate}
      />

      {!compact && (
        <Column
          header="Источник"
          body={renderSource}
          style={{ minWidth: '14rem' }}
        />
      )}

      {showNotes && (
        <Column
          field="notes"
          header="Заметки"
          style={{ minWidth: '10rem' }}
          body={(row: ObservationRow) => row.notes || <span className="text-500">—</span>}
        />
      )}

      <Column
        field="origin"
        header="Источник"
        sortable
        style={{ width: '7rem' }}
        body={renderOrigin}
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