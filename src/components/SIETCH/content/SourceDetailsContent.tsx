// src/components/SIETCH/content/SourceDetailsContent.tsx

import React from 'react';
import { TabView, TabPanel } from 'primereact/tabview';
import { DetailFields } from '@/components/SIETCH/DetailFields';
import { OriginTag } from '../OriginTag';
import { OriginWarningBanner } from '../OriginWarningBanner';
import { ObservationsTable } from '@/components/SIETCH/DatabaseTables/ObservationsTable';
import { RelationsTable } from '@/components/SIETCH/DatabaseTables/RelationsTable';
import { EntitiesTable } from '@/components/SIETCH/DatabaseTables/EntitiesTable';
import type { DialogType } from './EntityDetailsContent';

export interface SourceDetailsContentProps {
  data: any;
  editing: boolean;
  editForm: any;
  onEditChange: (key: string, value: any) => void;
  openDialog: (type: DialogType, id: number) => void;
}

export const SourceDetailsContent: React.FC<SourceDetailsContentProps> = ({
  data,
  editing,
  editForm,
  onEditChange,
  openDialog,
}) => (
  <>
    {editing && <OriginWarningBanner origin={data.source.origin} />}

    <DetailFields
      editing={editing}
      editForm={editForm}
      onEditChange={onEditChange}
      fields={[
        { label: 'ID', value: data.source.id },
        {
          label: 'Тип',
          value: data.source.source_type || '—',
          editable: true,
          editKey: 'source_type',
          editType: 'dropdown',
          editOptions: [
            { label: 'website', value: 'website' },
            { label: 'social', value: 'social' },
            { label: 'registry', value: 'registry' },
            { label: 'document', value: 'document' },
            { label: 'cli', value: 'cli' },
            { label: 'search', value: 'search' },
            { label: 'screenshot', value: 'screenshot' },
            { label: 'company_system', value: 'company_system' },
            { label: 'court', value: 'court' },
            { label: 'other', value: 'other' },
          ],
        },
        {
          label: 'URL',
          span: 2,
          value: data.source.url ? (
            <a
              href={data.source.url}
              target="_blank"
              rel="noreferrer"
              style={{ wordBreak: 'break-all' }}
            >
              {data.source.url}
            </a>
          ) : (
            '—'
          ),
          editable: true,
          editKey: 'url',
          editType: 'text',
        },
        {
          label: 'Название',
          span: 2,
          value: data.source.title || '—',
          editable: true,
          editKey: 'title',
          editType: 'text',
        },
        {
          label: 'Происхождение',
          value: data.source.source_kind || '—',
          editable: true,
          editKey: 'source_kind',
          editType: 'dropdown',
          editOptions: [
            { label: 'public_web', value: 'public_web' },
            { label: 'internal_person', value: 'internal_person' },
            { label: 'internal_document', value: 'internal_document' },
            { label: 'official_registry', value: 'official_registry' },
            { label: 'company_system', value: 'company_system' },
            { label: 'cli_tool', value: 'cli_tool' },
            { label: 'personal_observation', value: 'personal_observation' },
          ],
        },
        {
          label: 'Провайдер',
          value: data.source.provider || '—',
          editable: true,
          editKey: 'provider',
          editType: 'text',
        },
        {
          label: 'Метод получения',
          value: data.source.collection_method || '—',
          editable: true,
          editKey: 'collection_method',
          editType: 'dropdown',
          editOptions: [
            { label: 'browser', value: 'browser' },
            { label: 'api', value: 'api' },
            { label: 'export', value: 'export' },
            { label: 'official_export', value: 'official_export' },
            { label: 'interview', value: 'interview' },
            { label: 'email', value: 'email' },
            { label: 'internal_chat', value: 'internal_chat' },
            { label: 'theharvester', value: 'theharvester' },
            { label: 'whois', value: 'whois' },
            { label: 'dig', value: 'dig' },
            { label: 'manual', value: 'manual' },
          ],
        },
        {
          label: 'Надёжность',
          value: data.source.reliability ?? '—',
          editable: true,
          editKey: 'reliability',
          editType: 'number',
        },
        {
          label: 'Уровень доступа',
          value: data.source.access_level || '—',
          editable: true,
          editKey: 'access_level',
          editType: 'dropdown',
          editOptions: [
            { label: 'public', value: 'public' },
            { label: 'internal', value: 'internal' },
            { label: 'confidential', value: 'confidential' },
            { label: 'restricted', value: 'restricted' },
          ],
        },
        { label: 'Источник записи', value: <OriginTag origin={data.source.origin} /> },
        {
          label: 'Дата получения',
          value: data.source.retrieved_at
            ? new Date(data.source.retrieved_at).toLocaleString()
            : '—',
        },
        {
          label: 'Основание доступа',
          span: 2,
          value: data.source.authority_basis || '—',
          editable: true,
          editKey: 'authority_basis',
          editType: 'textarea',
        },
        {
          label: 'Локальный путь',
          span: 2,
          value: (
            <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
              {data.source.local_path || '—'}
            </span>
          ),
        },
        {
          label: 'SHA-256',
          span: 2,
          value: (
            <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
              {data.source.sha256 || '—'}
            </span>
          ),
        },
        {
          label: 'Заметки',
          span: 2,
          value: data.source.notes || '—',
          editable: true,
          editKey: 'notes',
          editType: 'textarea',
        },
      ]}
    />

    <TabView className="mt-3">
      <TabPanel header={`Наблюдения (${data.observations.length})`}>
        <ObservationsTable
          value={data.observations}
          showEntity
          onRowClick={(row) => openDialog('observation', row.id)}
          onEntityClick={(row) => openDialog('entity', row.entity_id)}
          compact
          emptyMessage="Наблюдений нет"
        />
      </TabPanel>
      <TabPanel header={`Связи (${data.relations.length})`}>
        <RelationsTable
          value={data.relations}
          side="both"
          onRowClick={(row) => openDialog('relation', row.id)}
          onSubjectClick={(row) => openDialog('entity', row.subject_id)}
          onObjectClick={(row) => openDialog('entity', row.object_id)}
          compact
          emptyMessage="Связей нет"
        />
      </TabPanel>
      <TabPanel header={`Сущности (${data.entities.length})`}>
        <EntitiesTable
          value={data.entities}
          onRowClick={(row) => openDialog('entity', row.id)}
          compact
          emptyMessage="Связанных сущностей нет"
        />
      </TabPanel>
    </TabView>
  </>
);