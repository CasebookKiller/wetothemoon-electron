// src/components/SIETCH/DatabaseTables/RelationsTable.tsx

import React from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';

export interface RelationRow {
  id: number;              // ← было id?: number
  predicate: string;
  confidence?: number | null;
  status?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  evidence_text?: string | null;
  notes?: string | null;

  // Стороны связи — тоже обязательные, они всегда приходят из БД
  subject_id: number;      // ← было subject_id?: number
  subject_label?: string | null;
  subject_type?: string | null;

  object_id: number;       // ← было object_id?: number
  object_label?: string | null;
  object_type?: string | null;

  source_id?: number | null;
  source_url?: string | null;
  source_title?: string | null;

  origin?: string | null;
}

export interface RelationsTableProps {
  value: RelationRow[];

  /**
   * Какую сторону показывать:
   * - 'both'      — обе стороны (используется в главном окне и в диалоге источника)
   * - 'outgoing'  — фиксирован subject, показываем object (исходящие связи сущности)
   * - 'incoming'  — фиксирован object, показываем subject (входящие связи сущности)
   */
  side?: 'both' | 'outgoing' | 'incoming';

  /** Клик по строке (в диалогах обычно открывает детали связи) */
  onRowClick?: (row: RelationRow) => void;

  /** Клик по названию субъекта (для cross-navigation на сущность) */
  onSubjectClick?: (row: RelationRow) => void;

  /** Клик по названию объекта (для cross-navigation на сущность) */
  onObjectClick?: (row: RelationRow) => void;

  /** Кнопка «Открыть в главном окне» */
  onOpenInMain?: (row: RelationRow) => void;

  /** Компактный режим для диалогов (без пагинации, со скроллом) */
  compact?: boolean;

  /** Дополнительный фильтр строк */
  filterFn?: (row: RelationRow) => boolean;

  /** Сообщение, если данных нет */
  emptyMessage?: string;

  /** Показывать колонку действий */
  showActions?: boolean;

  /** Дополнительный CSS-класс */
  className?: string;

  /** Мульти-выбор (batch-операции). Если передан onSelectionChange —
   *  в таблице появляется колонка с чекбоксами. */
  selection?: RelationRow[];
  onSelectionChange?: (rows: RelationRow[]) => void;
}

export const RelationsTable: React.FC<RelationsTableProps> = ({
  value,
  side = 'both',
  onRowClick,
  onSubjectClick,
  onObjectClick,
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

  const renderActions = (row: RelationRow) => {
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

  const renderStatus = (row: RelationRow) => {
    const status = row.status || '—';
    const color =
      status === 'confirmed' ? 'green'
      : status === 'false' ? '#ec3942'
      : status === 'hypothesis' ? '#e6a23c'
      : status === 'archived' ? '#888'
      : 'inherit';
    return <span style={{ color }}>{status}</span>;
  };

  const renderEntityLink = (
    id: number | undefined,
    label: string | null | undefined,
    type: string | null | undefined,
    onClick?: () => void,
  ) => {
    const text = `[${id ?? '?'}] ${label || '—'}${type ? ` (${type})` : ''}`;
    if (onClick) {
      return (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
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

  const renderSubject = (row: RelationRow) =>
    renderEntityLink(row.subject_id, row.subject_label, row.subject_type, onSubjectClick ? () => onSubjectClick(row) : undefined);

  const renderObject = (row: RelationRow) =>
    renderEntityLink(row.object_id, row.object_label, row.object_type, onObjectClick ? () => onObjectClick(row) : undefined);

  const renderOrigin = (row: RelationRow) => {
    const value = row.origin || 'scraper';
    const severity = value === 'manual' ? 'warning' : value === 'import' ? 'success' : 'info';
    const label = value === 'manual' ? 'вручную' : value === 'import' ? 'импорт' : 'авто';
    return <Tag value={label} severity={severity as any} />;
  };

  const actionsVisible = showActions ?? !!onOpenInMain;

  // Какие колонки показывать в зависимости от side
  const showSubject = side === 'both' || side === 'incoming';
  const showObject = side === 'both' || side === 'outgoing';

  // В compact-режиме убираем часть колонок, чтобы не перегружать
  const showDates = !compact;

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
          ? (e: any) => onSelectionChange!(e.value as RelationRow[])
          : undefined
      }
      dataKey="id"
      onRowClick={onRowClick ? (e) => onRowClick(e.data as RelationRow) : undefined}
      rowHover={!!onRowClick}
      size={compact ? 'small' : 'normal'}
      scrollable={compact}
      scrollHeight={compact ? '300px' : undefined}
    >
      {multiSelect && (
        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
      )}
      
      <Column field="id" header="ID" sortable style={{ width: '4rem' }} />

      {showSubject && (
        <Column
          header="Исходная сущность"
          body={renderSubject}
          style={{ minWidth: '14rem' }}
        />
      )}

      <Column
        field="predicate"
        header="Тип связи"
        sortable
        body={(row: RelationRow) => <b>{row.predicate}</b>}
        style={{ minWidth: '10rem' }}
      />

      {showObject && (
        <Column
          header="Целевая сущность"
          body={renderObject}
          style={{ minWidth: '14rem' }}
        />
      )}

      <Column
        field="confidence"
        header="Уверенность"
        sortable
        style={{ width: '7rem' }}
        body={(row: RelationRow) => row.confidence ?? '—'}
      />

      <Column
        field="status"
        header="Статус"
        sortable
        style={{ width: '8rem' }}
        body={renderStatus}
      />

      {showDates && (
        <>
          <Column
            field="valid_from"
            header="С"
            sortable
            style={{ width: '7rem' }}
            body={(row: RelationRow) => row.valid_from || '—'}
          />
          <Column
            field="valid_to"
            header="По"
            sortable
            style={{ width: '7rem' }}
            body={(row: RelationRow) => row.valid_to || '—'}
          />
        </>
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