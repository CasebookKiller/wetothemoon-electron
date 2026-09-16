// src/components/SIETCH/content/EntityDetailsContent.tsx

import React from 'react';
import { Tag } from 'primereact/tag';
import { TabView, TabPanel } from 'primereact/tabview';
import { DetailFields } from '@/components/SIETCH/DetailFields';
import { OriginTag } from '../OriginTag';
import { OriginWarningBanner } from '../OriginWarningBanner';
import { ObservationsTable } from '@/components/SIETCH/DatabaseTables/ObservationsTable';
import { RelationsTable } from '@/components/SIETCH/DatabaseTables/RelationsTable';
import { SourcesTable } from '@/components/SIETCH/DatabaseTables/SourcesTable';

export type DialogType = 'entity' | 'relation' | 'observation' | 'source';

export interface EntityDetailsContentProps {
  data: any;
  editing: boolean;
  editForm: any;
  onEditChange: (key: string, value: any) => void;
  openDialog: (type: DialogType, id: number) => void;
}

export const EntityDetailsContent: React.FC<EntityDetailsContentProps> = ({
  data,
  editing,
  editForm,
  onEditChange,
  openDialog,
}) => (
  <>
    {editing && <OriginWarningBanner origin={data.entity.origin} />}

    <DetailFields
      editing={editing}
      editForm={editForm}
      onEditChange={onEditChange}
      fields={[
        { label: 'ID', value: data.entity.id },
        {
          label: 'Тип',
          value: <Tag value={data.entity.type} />,
          editable: true,
          editKey: 'type',
          editType: 'dropdown',
          editOptions: [
            { label: 'Юрлицо', value: 'company' },
            { label: 'ИП', value: 'entrepreneur' },
            { label: 'Физлицо', value: 'person' },
            { label: 'Домен', value: 'domain' },
            { label: 'Email', value: 'email' },
            { label: 'Телефон', value: 'phone' },
            { label: 'IP', value: 'ip' },
            { label: 'Адрес', value: 'address' },
            { label: 'Документ', value: 'document' },
            { label: 'Прочее', value: 'other' },
          ],
        },
        {
          label: 'Значение (value)',
          value: data.entity.value,
          editable: true,
          editKey: 'value',
          editType: 'text',
        },
        {
          label: 'Название (label)',
          value: data.entity.label || '—',
          editable: true,
          editKey: 'label',
          editType: 'text',
        },
        {
          label: 'Нормализованное',
          value: <span className="text-sm text-500">{data.entity.normalized_value}</span>,
        },
        {
          label: 'Уверенность',
          value: data.entity.confidence ?? '—',
          editable: true,
          editKey: 'confidence',
          editType: 'number',
        },
        {
          label: 'Статус',
          value: data.entity.status,
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
        { label: 'rusprofile_id', value: data.entity.rusprofile_id || '—' },
        { label: 'Источник записи', value: <OriginTag origin={data.entity.origin} /> },
        {
          label: 'Первое появление',
          value: data.entity.first_seen
            ? new Date(data.entity.first_seen).toLocaleString()
            : '—',
        },
        {
          label: 'Последнее обновление',
          value: data.entity.last_seen
            ? new Date(data.entity.last_seen).toLocaleString()
            : '—',
        },
        {
          label: 'Заметки',
          span: 2,
          value: data.entity.notes || '—',
          editable: true,
          editKey: 'notes',
          editType: 'textarea',
        },
        {
          label: 'Файл дампа',
          span: 2,
          value: (
            <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
              {data.entity.raw_file_path || '—'}
            </span>
          ),
        },
      ]}
    />

    <TabView className="mt-3">
      <TabPanel header={`Наблюдения (${data.observations.length})`}>
        <ObservationsTable
          value={data.observations}
          showEntity={false}
          onRowClick={(row) => openDialog('observation', row.id)}
          onSourceClick={(row) => row.source_id && openDialog('source', row.source_id)}
          compact
          emptyMessage="Наблюдений нет"
        />
      </TabPanel>
      <TabPanel header={`Исходящие связи (${data.relations_out.length})`}>
        <RelationsTable
          value={data.relations_out}
          side="outgoing"
          onRowClick={(row) => openDialog('relation', row.id)}
          onObjectClick={(row) => openDialog('entity', row.object_id)}
          compact
          emptyMessage="Нет исходящих связей"
        />
      </TabPanel>
      <TabPanel header={`Входящие связи (${data.relations_in.length})`}>
        <RelationsTable
          value={data.relations_in}
          side="incoming"
          onRowClick={(row) => openDialog('relation', row.id)}
          onSubjectClick={(row) => openDialog('entity', row.subject_id)}
          compact
          emptyMessage="Нет входящих связей"
        />
      </TabPanel>
      <TabPanel header={`Источники (${data.sources.length})`}>
        <SourcesTable
          value={data.sources}
          onRowClick={(row) => openDialog('source', row.id)}
          compact
          emptyMessage="Источников нет"
        />
      </TabPanel>
    </TabView>
  </>
);