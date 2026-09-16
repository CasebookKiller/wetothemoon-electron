// src/components/SIETCH/content/ObservationDetailsContent.tsx

import React from 'react';
import { DetailFields } from '@/components/SIETCH/DetailFields';
import { OriginTag } from '../OriginTag';
import { OriginWarningBanner } from '../OriginWarningBanner';
import type { DialogType } from './EntityDetailsContent';

export interface ObservationDetailsContentProps {
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

export const ObservationDetailsContent: React.FC<ObservationDetailsContentProps> = ({
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
          label: 'Сущность',
          span: 2,
          value: (
            <a
              href="#"
              style={linkStyle}
              onClick={(e) => { e.preventDefault(); openDialog('entity', data.entity_id); }}
            >
              [{data.entity_id}] {data.entity_label} — <i>{data.entity_type}</i>
              <div className="text-sm text-500">{data.entity_value}</div>
            </a>
          ),
        },
        {
          label: 'Атрибут',
          value: data.attribute,
          editable: true,
          editKey: 'attribute',
          editType: 'text',
        },
        {
          label: 'Значение',
          value: <span style={{ wordBreak: 'break-all' }}>{data.value}</span>,
          editable: true,
          editKey: 'value',
          editType: 'text',
        },
        {
          label: 'Уверенность',
          value: data.confidence ?? '—',
          editable: true,
          editKey: 'confidence',
          editType: 'number',
        },
        { label: 'Источник записи', value: <OriginTag origin={data.origin} /> },
        {
          label: 'Дата наблюдения',
          value: data.observed_at
            ? new Date(data.observed_at).toLocaleString()
            : '—',
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