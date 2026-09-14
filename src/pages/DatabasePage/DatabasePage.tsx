import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Tag } from 'primereact/tag';

import './DatabasePage.css';
import { EntitiesTable } from '@/components/SIETCH/DatabaseTables/EntitiesTable';
import { RelationsTable } from '@/components/SIETCH/DatabaseTables/RelationsTable';
import { ObservationsTable } from '@/components/SIETCH/DatabaseTables/ObservationsTable';
import { SourcesTable } from '@/components/SIETCH/DatabaseTables/SourcesTable';
import { DetailFields } from '@/components/SIETCH/DetailFields';

export const DatabasePage: React.FC = () => {
  const [entities, setEntities] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState('');

  // Поиск
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  const [relationDialog, setRelationDialog] = useState(false);
  const [relationDetails, setRelationDetails] = useState<any>(null);
  const [relationLoading, setRelationLoading] = useState(false);

  const [falseDialog, setFalseDialog] = useState(false);
  const [falseReason, setFalseReason] = useState('');
  const [falseLoading, setFalseLoading] = useState(false);
  const [falseMessage, setFalseMessage] = useState('');

  const [entityDialog, setEntityDialog] = useState(false);
  const [entityDetails, setEntityDetails] = useState<any>(null);
  const [entityLoading, setEntityLoading] = useState(false);

  const [markTarget, setMarkTarget] = useState<{ table: 'entities' | 'relations' | 'observations'; id: number } | null>(null);

  const [observationDialog, setObservationDialog] = useState(false);
  const [observationDetails, setObservationDetails] = useState<any>(null);
  const [observationLoading, setObservationLoading] = useState(false);

  const [sourceDialog, setSourceDialog] = useState(false);
  const [sourceDetails, setSourceDetails] = useState<any>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const api = (window as any).electronAPI;

  const entityTypeOptions = [
    { label: 'Все', value: 'all' },
    { label: 'Юрлицо', value: 'company' },
    { label: 'ИП', value: 'entrepreneur' },
    { label: 'Физлицо', value: 'person' },
    { label: 'Домен', value: 'domain' },
    { label: 'Email', value: 'email' },
    { label: 'Телефон', value: 'phone' },
    { label: 'Адрес', value: 'address' },
    { label: 'Документ', value: 'document' },
    { label: 'Прочее', value: 'other' },
  ];

  const loadData = async () => {
    try {
      const [ent, rel, obs, src] = await Promise.all([
        api.getEntities(200, 0),
        api.getRelations(200, 0),
        api.getObservations(200, 0),
        api.getSources(200, 0),
      ]);
      setEntities(ent);
      setRelations(rel);
      setObservations(obs);
      setSources(src);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchActive(false);
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setError('');
    try {
      const res = await api.searchEntities(searchQuery.trim(), searchType, 200, 0);
      if (res.success) {
        setSearchResults(res.items || []);
        setSearchActive(true);
      } else {
        setError(res.error || 'Ошибка поиска');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setSearchType('all');
    setSearchResults([]);
    setSearchActive(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openRelationDetails = async (relationId: number) => {
    setRelationLoading(true);
    setRelationDetails(null);
    setRelationDialog(true);
    try {
      const res = await api.getRelationDetails(relationId);
      if (res.success) setRelationDetails(res.data);
      else setError(res.error || 'Ошибка загрузки деталей связи');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRelationLoading(false);
    }
  };

  const openMarkFalseDialog = (target?: { table: 'entities' | 'relations' | 'observations'; id: number }) => {
    if (target) setMarkTarget(target);
    setFalseReason('');
    setFalseMessage('');
    setFalseDialog(true);
  };

  const openEntityDetails = async (entityId: number) => {
    setEntityLoading(true);
    setEntityDetails(null);
    setEntityDialog(true);
    try {
      const res = await api.getEntityDetails(entityId);
      if (res.success) setEntityDetails(res.data);
      else setError(res.error || 'Ошибка загрузки деталей сущности');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEntityLoading(false);
    }
  };

  const openObservationDetails = async (observationId: number) => {
    setObservationLoading(true);
    setObservationDetails(null);
    setObservationDialog(true);
    try {
      const res = await api.getObservationDetails(observationId);
      if (res.success) setObservationDetails(res.data);
      else setError(res.error || 'Ошибка загрузки деталей наблюдения');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setObservationLoading(false);
    }
  };

  const openSourceDetails = async (sourceId: number) => {
    setSourceLoading(true);
    setSourceDetails(null);
    setSourceDialog(true);
    try {
      const res = await api.getSourceDetails(sourceId);
      if (res.success) setSourceDetails(res.data);
      else setError(res.error || 'Ошибка загрузки деталей источника');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSourceLoading(false);
    }
  };

  const handleMarkFalseSubmit = async () => {
    if (!markTarget) return;
    if (!falseReason.trim()) {
      setFalseMessage('Укажите причину');
      return;
    }

    setFalseLoading(true);
    setFalseMessage('');
    try {
      const res = await api.markFalse(markTarget.table, markTarget.id, falseReason.trim());
      if (res.success) {
        setFalseMessage('Запись помечена как ложная');
        await loadData();
        if (markTarget.table === 'relations' && relationDetails?.id === markTarget.id) {
          const detailsRes = await api.getRelationDetails(markTarget.id);
          if (detailsRes.success) setRelationDetails(detailsRes.data);
        }
        if (markTarget.table === 'entities' && entityDetails?.entity?.id === markTarget.id) {
          const detailsRes = await api.getEntityDetails(markTarget.id);
          if (detailsRes.success) setEntityDetails(detailsRes.data);
        }
        if (markTarget.table === 'observations' && observationDetails?.id === markTarget.id) {
          const detailsRes = await api.getObservationDetails(markTarget.id);
          if (detailsRes.success) setObservationDetails(detailsRes.data);
        }
        setTimeout(() => setFalseDialog(false), 800);
      } else {
        setFalseMessage(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setFalseMessage((e as Error).message);
    } finally {
      setFalseLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const displayEntities = searchActive ? searchResults : entities;

  return (
    <div className="p-4">
      {error && <p style={{ color: 'red' }}>{error}</p>}


      {/* Панель поиска */}
      <Panel className="shadow-5 mb-3" 
        header="Поиск по сущностям"
      >
        <div className="flex flex-wrap align-items-center gap-3 py-2">
          <div className="flex-1" style={{ minWidth: '240px' }}>
            <span className="p-input-icon-left w-full search-input-with-icon">
              <i className="pi pi-search" />
              <InputText
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Название, ИНН, ФИО и т.п."
                className="w-full text-base"
              />
            </span>
          </div>
          <div style={{ minWidth: '180px' }}>
            <Dropdown
              value={searchType}
              options={entityTypeOptions}
              onChange={(e) => setSearchType(e.value)}
              placeholder="Тип сущности"
              className="w-full"
            />
          </div>
          <Button
            label={searchLoading ? 'Поиск...' : 'Найти'}
            icon={searchLoading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
            className="p-button-raised p-button-accent"
            onClick={handleSearch}
            disabled={searchLoading}
          />
          {(searchActive || searchQuery) && (
            <Button
              label="Сбросить"
              icon="pi pi-times"
              className="p-button-raised p-button-outlined"
              onClick={handleResetSearch}
            />
          )}
          <Button
            label="Обновить всё"
            icon="pi pi-refresh"
            className="p-button-raised p-button-accent"
            onClick={loadData}
          />
        </div>

        {searchActive && (
          <div className="mt-2 text-sm">
            Найдено: <b>{searchResults.length}</b> записей
          </div>
        )}
      </Panel>

      {/* Панель таблиц */}
      <Panel className="shadow-5 mb-3" header="Таблицы">
        <TabView className="my-3">
          <TabPanel header={`Сущности (${displayEntities.length})`}>
            <EntitiesTable
              value={displayEntities}
              onRowClick={(row) => openEntityDetails(row.id)}
              emptyMessage={searchActive ? 'Ничего не найдено' : 'Нет данных'}
            />
          </TabPanel>

          <TabPanel header={`Связи (${relations.length})`}>
            <RelationsTable
              value={relations}
              onRowClick={(row) => openRelationDetails(row.id)}
            />
          </TabPanel>

          <TabPanel header={`Наблюдения (${observations.length})`}>
            <ObservationsTable
              value={observations}
              onRowClick={(row) => openObservationDetails(row.id)}
            />
          </TabPanel>

          <TabPanel header={`Источники (${sources.length})`}>
            <SourcesTable
              value={sources}
              onRowClick={(row) => openSourceDetails(row.id)}
            />
          </TabPanel>
        </TabView>
      </Panel>

      {/* Диалог сущности */} 
      <Dialog
        visible={entityDialog}
        style={{ width: '900px' }}
        modal
        onHide={() => setEntityDialog(false)}
        header={
          <span className="p-panel-title">
            {entityDetails?.entity
              ? `${entityDetails.entity.label || entityDetails.entity.value}`
              : 'Загрузка...'}
          </span>
        }
        footer={
          <div className="p-panel-footer flex justify-content-end gap-2">
            <Button
              label="Пометить как ложную"
              icon="pi pi-exclamation-triangle"
              className="osint-destructive"
              onClick={() => {
                // Открыть mark_false для текущей сущности
                setMarkTarget({ table: 'entities', id: entityDetails?.entity?.id });
                openMarkFalseDialog();
              }}
              disabled={!entityDetails?.entity || entityDetails.entity.status === 'false'}
            />
            <Button
              label="Закрыть"
              icon="pi pi-times"
              className="osint"
              onClick={() => setEntityDialog(false)}
            />
          </div>
        }
      >
        {entityLoading && <p>Загрузка...</p>}
        {!entityLoading && entityDetails && (
          <>
            <DetailFields
              fields={[
                { label: 'ID', value: entityDetails.entity.id },
                { label: 'Тип', value: <Tag value={entityDetails.entity.type} /> },
                { label: 'Значение (value)', value: entityDetails.entity.value },
                { label: 'Название (label)', value: entityDetails.entity.label || '—' },
                {
                  label: 'Нормализованное',
                  value: <span className="text-sm text-500">{entityDetails.entity.normalized_value}</span>,
                },
                { label: 'Уверенность', value: entityDetails.entity.confidence ?? '—' },
                { label: 'Статус', value: entityDetails.entity.status },
                { label: 'rusprofile_id', value: entityDetails.entity.rusprofile_id || '—' },
                {
                  label: 'Первое появление',
                  value: entityDetails.entity.first_seen
                    ? new Date(entityDetails.entity.first_seen).toLocaleString()
                    : '—',
                },
                {
                  label: 'Последнее обновление',
                  value: entityDetails.entity.last_seen
                    ? new Date(entityDetails.entity.last_seen).toLocaleString()
                    : '—',
                },
                { label: 'Заметки', span: 2, value: entityDetails.entity.notes || '—' },
                {
                  label: 'Файл дампа',
                  span: 2,
                  value: (
                    <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
                      {entityDetails.entity.raw_file_path || '—'}
                    </span>
                  ),
                },
              ]}
            />

            <TabView className="mt-3">
              <TabPanel header={`Наблюдения (${entityDetails.observations.length})`}>
                <ObservationsTable
                  value={entityDetails.observations}
                  showEntity={false}
                  onRowClick={(row) => openObservationDetails(row.id)}
                  onSourceClick={(row) => row.source_id && openSourceDetails(row.source_id)}
                  compact
                  emptyMessage="Наблюдений нет"
                />
              </TabPanel>

              <TabPanel header={`Исходящие связи (${entityDetails.relations_out.length})`}>
                <RelationsTable
                  value={entityDetails.relations_out}
                  side="outgoing"
                  onRowClick={(row) => openRelationDetails(row.id)}
                  onObjectClick={(row) => openEntityDetails(row.object_id)}
                  compact
                  emptyMessage="Нет исходящих связей"
                />
              </TabPanel>

              <TabPanel header={`Входящие связи (${entityDetails.relations_in.length})`}>
                <RelationsTable
                  value={entityDetails.relations_in}
                  side="incoming"
                  onRowClick={(row) => openRelationDetails(row.id)}
                  onSubjectClick={(row) => openEntityDetails(row.subject_id)}
                  compact
                  emptyMessage="Нет входящих связей"
                />
              </TabPanel>

              <TabPanel header={`Источники (${entityDetails.sources.length})`}>
                <SourcesTable
                  value={entityDetails.sources}
                  onRowClick={(row) => openSourceDetails(row.id)}
                  compact
                  emptyMessage="Источников нет"
                />
              </TabPanel>
            </TabView>
          </>
        )}
      </Dialog>

      {/* Диалог связи */}
      <Dialog
        visible={relationDialog}
        style={{ width: '700px' }}
        modal
        onHide={() => setRelationDialog(false)}
        header={
          <span className="p-panel-title">
            {relationDetails ? `Связь #${relationDetails.id}` : 'Загрузка...'}
          </span>
        }
        footer={
          <div className="p-panel-footer flex justify-content-end gap-2">
            <Button
              label="Пометить как ложную"
              icon="pi pi-exclamation-triangle"
              className="osint-destructive"
              onClick={() => openMarkFalseDialog({ table: 'relations', id: relationDetails?.id })}
              disabled={relationDetails?.status === 'false'}
            />
            <Button
              label="Закрыть"
              icon="pi pi-times"
              className="osint"
              onClick={() => setRelationDialog(false)}
            />
          </div>
        }
      >
        {relationLoading && <p>Загрузка...</p>}
        {!relationLoading && relationDetails && (
          <DetailFields
            fields={[
              {
                label: 'Исходная сущность',
                span: 1,
                value: (
                  <div>
                    [{relationDetails.subject_id}] {relationDetails.subject_label} — <i>{relationDetails.subject_type}</i>
                    <div className="text-sm text-500">{relationDetails.subject_value}</div>
                  </div>
                ),
              },
              {
                label: 'Связь',
                span: 1,
                value: <b>{relationDetails.predicate}</b>,
              },
              {
                label: 'Целевая сущность',
                span: 1,
                value: (
                  <div>
                    [{relationDetails.object_id}] {relationDetails.object_label} — <i>{relationDetails.object_type}</i>
                    <div className="text-sm text-500">{relationDetails.object_value}</div>
                  </div>
                ),
              },
              {
                label: 'Уверенность',
                value: relationDetails.confidence ?? '—',
              },
              {
                label: 'Статус',
                value: relationDetails.status,
              },
              {
                label: 'Действует с',
                value: relationDetails.valid_from || '—',
              },
              {
                label: 'Действует до',
                value: relationDetails.valid_to || '—',
              },
              {
                label: 'Подтверждение (evidence)',
                span: 2,
                value: relationDetails.evidence_text || <span className="text-500">—</span>,
              },
              {
                label: 'Заметки',
                span: 2,
                value: relationDetails.notes || <span className="text-500">—</span>,
              },
              {
                label: 'Источник',
                span: 2,
                value: relationDetails.source_url ? (
                  <div>
                    [{relationDetails.source_id}] {relationDetails.source_title || 'Источник'}
                    <div className="text-sm">
                      <a href={relationDetails.source_url} target="_blank" rel="noreferrer">
                        {relationDetails.source_url}
                      </a>
                    </div>
                    <div className="text-sm text-500">
                      {relationDetails.source_type} • {relationDetails.source_provider} • {relationDetails.source_access_level}
                      {relationDetails.source_retrieved_at
                        ? ` • получено ${new Date(relationDetails.source_retrieved_at).toLocaleString()}`
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
                    {relationDetails.raw_file_path || '—'}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Dialog>

      {/* Диалог пометки связи как ложной */}
      <Dialog
        visible={falseDialog}
        style={{ width: '500px' }}
        modal
        onHide={() => setFalseDialog(false)}
        header={
          <span className="p-panel-title">Пометить связь как ложную</span>
        }
        footer={
          <>
            {/* Футер диалога mark-false — просто кнопки, без p-panel-footer */}
            <Button
              label="Отмена"
              icon="pi pi-times"
              className="osint"
              onClick={() => setFalseDialog(false)}
              disabled={falseLoading}
            />
            <Button
              label={falseLoading ? 'Отправка...' : 'Пометить'}
              icon={falseLoading ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              className="osint-destructive"
              onClick={handleMarkFalseSubmit}
              disabled={falseLoading || !falseReason.trim()}
            />
          </>
        }
      >
        <div className="p-fluid">
          <p className="text-sm text-500">
            Связь <b>#{relationDetails?.id}</b> будет помечена как <code>false</code>.
            Причина сохранится в поле <code>notes</code> и в журнале изменений.
          </p>
          <div className="field mt-3">
            <label htmlFor="falseReason" className="font-bold">Причина *</label>
            <InputTextarea
              id="falseReason"
              value={falseReason}
              onChange={(e) => setFalseReason(e.target.value)}
              rows={3}
              autoResize
              placeholder="Например: ошибочно сопоставлено с другой организацией"
              className="w-full"
            />
          </div>
          {falseMessage && (
            <p className={falseMessage.startsWith('Ошибка') ? 'p-error' : 'p-success'}>
              {falseMessage}
            </p>
          )}
        </div>
      </Dialog>

      {/* Диалог наблюдения */}
      <Dialog
        visible={observationDialog}
        style={{ width: '700px' }}
        modal
        onHide={() => setObservationDialog(false)}
        header={
          <span className="p-panel-title">
            {observationDetails ? `Наблюдение #${observationDetails.id}` : 'Загрузка...'}
          </span>
        }
        footer={
          <div className="p-panel-footer flex justify-content-end gap-2">
            <Button
              label="Пометить как ложную"
              icon="pi pi-exclamation-triangle"
              className="osint-destructive"
              onClick={() => {
                if (observationDetails?.id) {
                  openMarkFalseDialog({ table: 'observations', id: observationDetails.id });
                }
              }}
              disabled={!observationDetails}
            />
            <Button
              label="Закрыть"
              icon="pi pi-times"
              className="osint-soft"
              onClick={() => setObservationDialog(false)}
            />
          </div>
        }
      >
        {observationLoading && <p>Загрузка...</p>}
        {!observationLoading && observationDetails && (
          <DetailFields
            fields={[
              {
                label: 'Сущность',
                span: 2,
                value: (
                  <div>
                    [{observationDetails.entity_id}] {observationDetails.entity_label} — <i>{observationDetails.entity_type}</i>
                    <div className="text-sm text-500">{observationDetails.entity_value}</div>
                  </div>
                ),
              },
              { label: 'Атрибут', value: observationDetails.attribute },
              { label: 'Значение', value: <span style={{ wordBreak: 'break-all' }}>{observationDetails.value}</span> },
              { label: 'Уверенность', value: observationDetails.confidence ?? '—' },
              {
                label: 'Дата наблюдения',
                value: observationDetails.observed_at
                  ? new Date(observationDetails.observed_at).toLocaleString()
                  : '—',
              },
              {
                label: 'Источник',
                span: 2,
                value: observationDetails.source_url ? (
                  <div>
                    [{observationDetails.source_id}] {observationDetails.source_title || 'Источник'}
                    <div className="text-sm">
                      <a href={observationDetails.source_url} target="_blank" rel="noreferrer">
                        {observationDetails.source_url}
                      </a>
                    </div>
                    <div className="text-sm text-500">
                      {observationDetails.source_type} • {observationDetails.source_provider} • {observationDetails.source_access_level}
                    </div>
                  </div>
                ) : (
                  <span className="text-500">Источник не указан</span>
                ),
              },
              {
                label: 'Заметки',
                span: 2,
                value: observationDetails.notes || <span className="text-500">—</span>,
              },
              {
                label: 'Файл дампа',
                span: 2,
                value: (
                  <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
                    {observationDetails.raw_file_path || '—'}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Dialog>

      {/* Диалог источника */}
      <Dialog
        visible={sourceDialog}
        style={{ width: '900px' }}
        modal
        onHide={() => setSourceDialog(false)}
        header={
          <span className="p-panel-title">
            {sourceDetails
              ? `Источник #${sourceDetails.source.id}`
              : 'Загрузка...'}
          </span>
        }
        footer={
          <div className="p-panel-footer flex justify-content-end gap-2">
            <Button
              label="Закрыть"
              icon="pi pi-times"
              className="osint-soft"
              onClick={() => setSourceDialog(false)}
            />
          </div>
        }
      >
        {sourceLoading && <p>Загрузка...</p>}
        {!sourceLoading && sourceDetails && (
          <>
            <DetailFields
              fields={[
                { label: 'ID', value: sourceDetails.source.id },
                { label: 'Тип', value: sourceDetails.source.source_type || '—' },
                {
                  label: 'URL',
                  span: 2,
                  value: sourceDetails.source.url ? (
                    <a
                      href={sourceDetails.source.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ wordBreak: 'break-all' }}
                    >
                      {sourceDetails.source.url}
                    </a>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Название', span: 2, value: sourceDetails.source.title || '—' },
                { label: 'Происхождение', value: sourceDetails.source.source_kind || '—' },
                { label: 'Провайдер', value: sourceDetails.source.provider || '—' },
                { label: 'Метод получения', value: sourceDetails.source.collection_method || '—' },
                { label: 'Надёжность', value: sourceDetails.source.reliability ?? '—' },
                { label: 'Уровень доступа', value: sourceDetails.source.access_level || '—' },
                {
                  label: 'Дата получения',
                  value: sourceDetails.source.retrieved_at
                    ? new Date(sourceDetails.source.retrieved_at).toLocaleString()
                    : '—',
                },
                { label: 'Основание доступа', span: 2, value: sourceDetails.source.authority_basis || '—' },
                {
                  label: 'Локальный путь',
                  span: 2,
                  value: (
                    <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
                      {sourceDetails.source.local_path || '—'}
                    </span>
                  ),
                },
                {
                  label: 'SHA-256',
                  span: 2,
                  value: (
                    <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
                      {sourceDetails.source.sha256 || '—'}
                    </span>
                  ),
                },
                { label: 'Заметки', span: 2, value: sourceDetails.source.notes || '—' },
              ]}
            />

            <TabView className="mt-3">
              <TabPanel header={`Наблюдения (${sourceDetails.observations.length})`}>
                <ObservationsTable
                  value={sourceDetails.observations}
                  showEntity
                  onRowClick={(row) => openObservationDetails(row.id)}
                  onEntityClick={(row) => openEntityDetails(row.entity_id)}
                  compact
                  emptyMessage="Наблюдений нет"
                />
              </TabPanel>

              <TabPanel header={`Связи (${sourceDetails.relations.length})`}>
                <RelationsTable
                  value={sourceDetails.relations}
                  side="both"
                  onRowClick={(row) => openRelationDetails(row.id)}
                  onSubjectClick={(row) => openEntityDetails(row.subject_id)}
                  onObjectClick={(row) => openEntityDetails(row.object_id)}
                  compact
                  emptyMessage="Связей нет"
                />
              </TabPanel>

              <TabPanel header={`Сущности (${sourceDetails.entities.length})`}>
                <EntitiesTable
                  value={sourceDetails.entities}
                  onRowClick={(row) => openEntityDetails(row.id)}
                  compact
                  emptyMessage="Связанных сущностей нет"
                />
              </TabPanel>
            </TabView>
          </>
        )}
      </Dialog>

    </div>
  );
};