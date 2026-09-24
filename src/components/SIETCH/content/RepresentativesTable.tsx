// src/components/SIETCH/content/RepresentativesTable.tsx

import React, { useMemo } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';

export interface RepresentativesTableProps {
  /** Отфильтрованные relations (predicate='represents', via=дело) */
  relations: any[];
  /** Открыть карточку сущности (стороны или представителя) */
  onOpenEntity: (id: number) => void;
  /** Открыть связь */
  onOpenRelation: (id: number) => void;
}

interface RepRow {
  id: number;               // relation id
  partyId: number;
  partyLabel: string;
  partyType: string;
  repId: number;
  repLabel: string;
  repType: string;
  evidence_text: string | null;
  valid_from: string | null;
  valid_to: string | null;
  status: string | null;
}

export const RepresentativesTable: React.FC<RepresentativesTableProps> = ({
  relations,
  onOpenEntity,
  onOpenRelation,
}) => {
  const rows = useMemo<RepRow[]>(() => {
    return (relations || []).map((r) => ({
      id: r.id,
      partyId: r.object_id,
      partyLabel: r.object_label || r.object_value || `#${r.object_id}`,
      partyType: r.object_type || 'other',
      repId: r.subject_id,
      repLabel: r.subject_label || r.subject_value || `#${r.subject_id}`,
      repType: r.subject_type || 'person',
      evidence_text: r.evidence_text || null,
      valid_from: r.valid_from || null,
      valid_to: r.valid_to || null,
      status: r.status || null,
    }));
  }, [relations]);

  const renderParty = (row: RepRow) => (
    <a
      href="#"
      style={{ color: 'inherit', textDecoration: 'underline dotted' }}
      onClick={(e) => {
        e.preventDefault();
        onOpenEntity(row.partyId);
      }}
      title="Открыть сторону дела"
    >
      {row.partyLabel}
    </a>
  );

  const renderRep = (row: RepRow) => (
    <a
      href="#"
      style={{ color: 'inherit', textDecoration: 'underline dotted' }}
      onClick={(e) => {
        e.preventDefault();
        onOpenEntity(row.repId);
      }}
      title="Открыть представителя"
    >
      {row.repLabel}
    </a>
  );

  const renderDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString() : <span className="text-500">—</span>;

  const renderActions = (row: RepRow) => (
    <Button
      icon="pi pi-external-link"
      className="osint-soft p-button-sm"
      tooltip="Открыть связь"
      tooltipOptions={{ position: 'left' }}
      onClick={() => onOpenRelation(row.id)}
    />
  );

  return (
    <DataTable
      value={rows}
      size="small"
      responsiveLayout="scroll"
      rowHover
      emptyMessage="Представители не добавлены"
    >
      <Column
        field="partyLabel"
        header="Сторона"
        body={renderParty}
        sortable
        style={{ minWidth: '14rem' }}
      />
      <Column
        field="repLabel"
        header="Представитель"
        body={renderRep}
        sortable
        style={{ minWidth: '14rem' }}
      />
      <Column
        field="evidence_text"
        header="Роль / основание"
        body={(r: RepRow) =>
          r.evidence_text || <span className="text-500">—</span>
        }
        style={{ minWidth: '12rem' }}
      />
      <Column
        field="valid_from"
        header="С"
        body={(r: RepRow) => renderDate(r.valid_from)}
        style={{ width: '7rem' }}
      />
      <Column
        field="valid_to"
        header="По"
        body={(r: RepRow) => renderDate(r.valid_to)}
        style={{ width: '7rem' }}
      />
      <Column
        header=""
        body={renderActions}
        style={{ width: '3rem' }}
        bodyStyle={{ textAlign: 'center' }}
      />
    </DataTable>
  );
};