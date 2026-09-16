// src/components/SIETCH/DatabasePage/content/RelationDetailsContent.tsx

import React from 'react';
import { DetailFields } from '@/components/SIETCH/DetailFields';
import { OriginTag } from '../OriginTag';
import { OriginWarningBanner } from '../OriginWarningBanner';
import type { DialogType } from './EntityDetailsContent';

export interface RelationDetailsContentProps {
  data: any;
  editing: boolean;
  editForm: any;
  onEditChange: (key: string, value: any) => void;
  openDialog: (type: DialogType, id: number) => void;
}

const linkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline dotted',
};

export const RelationDetailsContent: React.FC<RelationDetailsContentProps> = ({
  data,
  editing,
  editForm,
  onEditChange,
  openDialog,
}) => (
  <>
    {editing && <OriginWarningBanner origin={data.origin} />}

    <DetailFields
      editing={editing}
      editForm={editForm}
      onEditChange={onEditChange}
      fields={[
        {
          label: 'Исходная сущность',
          value: (
            <a
              href="#"
              style={linkStyle}
              onClick={(e) => { e.preventDefault(); openDialog('entity', data.subject_id); }}
            >
              [{data.subject_id}] {data.subject_label} — <i>{data.subject_type}</i>
            </a>
          ),
        },
        {
          label: 'Связь',
          value: <b>{data.predicate}</b>,
          editable: true,
          editKey: 'predicate',
          editType: 'text',
        },
        {
          label: 'Целевая сущность',
          value: (
            <a
              href="#"
              style={linkStyle}
              onClick={(e) => { e.preventDefault(); openDialog('entity', data.object_id); }}
            >
              [{data.object_id}] {data.object_label} — <i>{data.object_type}</i>
            </a>
          ),
        },
        {
          label: 'Уверенность',
          value: data.confidence ?? '—',
          editable: true,
          editKey: 'confidence',
          editType: 'number',
        },
        {
          label: 'Статус',
          value: data.status,
          editable: true,
          editKey: 'status',
          editType: 'dropdown',
          editOptions: [
            { label: 'unverified', value: 'unverified' },
            { label: 'hypothesis', value: 'hypothesis' },
            { label: 'confirmed', value: 'confirmed' },
            { label: 'false', value: 'false' },
            { label: 'archived', value: 'archived' },
          ],
        },
        { label: 'Источник записи', value: <OriginTag origin={data.origin} /> },
        {
          label: 'Действует с',
          value: data.valid_from || '—',
          editable: true,
          editKey: 'valid_from',
          editType: 'text',
        },
        {
          label: 'Действует до',
          value: data.valid_to || '—',
          editable: true,
          editKey: 'valid_to',
          editType: 'text',
        },
        {
          label: 'Подтверждение (evidence)',
          span: 2,
          value: data.evidence_text || <span className="text-500">—</span>,
          editable: true,
          editKey: 'evidence_text',
          editType: 'textarea',
        },
        {
          label: 'Заметки',
          span: 2,
          value: data.notes || <span className="text-500">—</span>,
          editable: true,
          editKey: 'notes',
          editType: 'textarea',
        },
        {
          label: 'Источник',
          span: 2,
          value: data.source_url ? (
            <div>
              <a
                href="#"
                style={linkStyle}
                onClick={(e) => {
                  e.preventDefault();
                  if (data.source_id) openDialog('source', data.source_id);
                }}
              >
                [{data.source_id}] {data.source_title || 'Источник'}
              </a>
              <div className="text-sm">
                <a href={data.source_url} target="_blank" rel="noreferrer">
                  {data.source_url}
                </a>
              </div>
              <div className="text-sm text-500">
                {data.source_type} • {data.source_provider} • {data.source_access_level}
                {data.source_retrieved_at
                  ? ` • получено ${new Date(data.source_retrieved_at).toLocaleString()}`
                  : ''}
              </div>
            </div>
          ) : (
            <span className="text-500">Источник не указан</span>
          ),
        },
        {
          label: 'Файл дампа',
          span: 2,
          value: (
            <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
              {data.raw_file_path || '—'}
            </span>
          ),
        },
      ]}
    />
  </>
);