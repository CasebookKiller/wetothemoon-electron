// wetothemoon-electron/src/pages/DatabasePage/DatabasePage.tsx

import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';
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

type DialogType = 'entity' | 'relation' | 'observation' | 'source';

interface DialogStackItem {
  type: DialogType;
  id: number;
}

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

  // mark_false
  const [falseDialog, setFalseDialog] = useState(false);
  const [falseReason, setFalseReason] = useState('');
  const [falseLoading, setFalseLoading] = useState(false);
  const [falseMessage, setFalseMessage] = useState('');
  const [markTarget, setMarkTarget] = useState<{ table: 'entities' | 'relations' | 'observations'; id: number } | null>(null);

  // Стек диалогов деталей
  const [dialogStack, setDialogStack] = useState<DialogStackItem[]>([]);
  const [dialogCache, setDialogCache] = useState<Record<string, any>>({});
  const [dialogLoading, setDialogLoading] = useState(false);

  const [activeFilter, setActiveFilter] = useState<{ type: DialogType; id: number } | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  const api = (window as any).electronAPI;

  const cacheKey = (type: DialogType, id: number) => `${type}:${id}`;

  const loadDetails = async (type: DialogType, id: number): Promise<any> => {
    switch (type) {
      case 'entity':      return api.getEntityDetails(id);
      case 'relation':    return api.getRelationDetails(id);
      case 'observation': return api.getObservationDetails(id);
      case 'source':      return api.getSourceDetails(id);
    }
  };

  const openDialog = async (type: DialogType, id: number) => {
    const existingIdx = dialogStack.findIndex((it) => it.type === type && it.id === id);
    if (existingIdx >= 0) {
      setDialogStack((prev) => prev.slice(0, existingIdx + 1));
      return;
    }

    const key = cacheKey(type, id);
    if (dialogCache[key]) {
      setDialogStack((prev) => [...prev, { type, id }]);
      return;
    }

    setDialogLoading(true);
    try {
      const res = await loadDetails(type, id);
      if (res.success) {
        setDialogCache((prev) => ({ ...prev, [key]: res.data }));
        setDialogStack((prev) => [...prev, { type, id }]);
      } else {
        setError(res.error || 'Ошибка загрузки деталей');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDialogLoading(false);
    }
  };

  const typeToTabIndex: Record<DialogType, number> = {
    entity: 0,
    relation: 1,
    observation: 2,
    source: 3,
  };

  const openInMainWindow = (type: DialogType, id: number, tabIndex: number) => {
    // Закрыть диалоги, но сохранить кэш, чтобы при возврате данные были мгновенно
    setDialogStack([]);
    setActiveFilter({ type, id });
    setActiveTab(tabIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const entityFilterFn = activeFilter?.type === 'entity'
    ? (row: any) => row.id === activeFilter.id
    : undefined;

  const relationFilterFn = activeFilter?.type === 'relation'
    ? (row: any) => row.id === activeFilter.id
    : undefined;

  const observationFilterFn = activeFilter?.type === 'observation'
    ? (row: any) => row.id === activeFilter.id
    : undefined;

  const sourceFilterFn = activeFilter?.type === 'source'
    ? (row: any) => row.id === activeFilter.id
    : undefined;

  const popDialog = () => {
    setDialogStack((prev) => prev.slice(0, -1));
  };

  const popToIndex = (index: number) => {
    setDialogStack((prev) => prev.slice(0, index + 1));
  };

  const closeAllDialogs = () => {
    setDialogStack([]);
    setDialogCache({});
  };

  const refreshTopDialog = async () => {
    if (dialogStack.length === 0) return;
    const top = dialogStack[dialogStack.length - 1];
    const key = cacheKey(top.type, top.id);
    const res = await loadDetails(top.type, top.id);
    if (res.success) {
      setDialogCache((prev) => ({ ...prev, [key]: res.data }));
    }
  };

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

  const openMarkFalseDialog = (target?: { table: 'entities' | 'relations' | 'observations'; id: number }) => {
    if (target) setMarkTarget(target);
    setFalseReason('');
    setFalseMessage('');
    setFalseDialog(true);
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
        await refreshTopDialog();
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

  const getDialogLabel = (item: DialogStackItem): string => {
    const data = dialogCache[cacheKey(item.type, item.id)];
    switch (item.type) {
      case 'entity':
        return data?.entity?.label || data?.entity?.value || `Сущность #${item.id}`;
      case 'relation':
        return `Связь #${item.id}`;
      case 'observation':
        return `Наблюдение #${item.id}`;
      case 'source':
        return data?.source?.title || `Источник #${item.id}`;
    }
  };

  const renderBreadcrumb = () => (
    <div className="flex align-items-center gap-1 flex-wrap">
      {dialogStack.map((item, index) => {
        const isLast = index === dialogStack.length - 1;
        const label = getDialogLabel(item);
        return (
          <React.Fragment key={cacheKey(item.type, item.id)}>
            {isLast ? (
              <span className="p-panel-title">{label}</span>
            ) : (
              <>
                <a
                  href="#"
                  className="text-primary"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.preventDefault();
                    popToIndex(index);
                  }}
                >
                  {label}
                </a>
                <i className="pi pi-angle-right text-500" />
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderEntityContent = (data: any) => (
    <>
      <DetailFields
        fields={[
          { label: 'ID', value: data.entity.id },
          { label: 'Тип', value: <Tag value={data.entity.type} /> },
          { label: 'Значение (value)', value: data.entity.value },
          { label: 'Название (label)', value: data.entity.label || '—' },
          { label: 'Нормализованное', value: <span className="text-sm text-500">{data.entity.normalized_value}</span> },
          { label: 'Уверенность', value: data.entity.confidence ?? '—' },
          { label: 'Статус', value: data.entity.status },
          { label: 'rusprofile_id', value: data.entity.rusprofile_id || '—' },
          { label: 'Первое появление', value: data.entity.first_seen ? new Date(data.entity.first_seen).toLocaleString() : '—' },
          { label: 'Последнее обновление', value: data.entity.last_seen ? new Date(data.entity.last_seen).toLocaleString() : '—' },
          { label: 'Заметки', span: 2, value: data.entity.notes || '—' },
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

  const renderRelationContent = (data: any) => (
    <DetailFields
      fields={[
        {
          label: 'Исходная сущность',
          value: (
            <a
              href="#"
              style={{ color: 'inherit', textDecoration: 'underline dotted' }}
              onClick={(e) => { e.preventDefault(); openDialog('entity', data.subject_id); }}
            >
              [{data.subject_id}] {data.subject_label} — <i>{data.subject_type}</i>
            </a>
          ),
        },
        { label: 'Связь', value: <b>{data.predicate}</b> },
        {
          label: 'Целевая сущность',
          value: (
            <a
              href="#"
              style={{ color: 'inherit', textDecoration: 'underline dotted' }}
              onClick={(e) => { e.preventDefault(); openDialog('entity', data.object_id); }}
            >
              [{data.object_id}] {data.object_label} — <i>{data.object_type}</i>
            </a>
          ),
        },
        { label: 'Уверенность', value: data.confidence ?? '—' },
        { label: 'Статус', value: data.status },
        { label: 'Действует с', value: data.valid_from || '—' },
        { label: 'Действует до', value: data.valid_to || '—' },
        { label: 'Подтверждение (evidence)', span: 2, value: data.evidence_text || <span className="text-500">—</span> },
        { label: 'Заметки', span: 2, value: data.notes || <span className="text-500">—</span> },
        {
          label: 'Источник',
          span: 2,
          value: data.source_url ? (
            <div>
              <a
                href="#"
                style={{ color: 'inherit', textDecoration: 'underline dotted' }}
                onClick={(e) => { e.preventDefault(); if (data.source_id) openDialog('source', data.source_id); }}
              >
                [{data.source_id}] {data.source_title || 'Источник'}
              </a>
              <div className="text-sm"><a href={data.source_url} target="_blank" rel="noreferrer">{data.source_url}</a></div>
              <div className="text-sm text-500">
                {data.source_type} • {data.source_provider} • {data.source_access_level}
                {data.source_retrieved_at ? ` • получено ${new Date(data.source_retrieved_at).toLocaleString()}` : ''}
              </div>
            </div>
          ) : (
            <span className="text-500">Источник не указан</span>
          ),
        },
        { label: 'Файл дампа', span: 2, value: <span className="text-sm text-500" style={{ wordBreak: 'break-all' }}>{data.raw_file_path || '—'}</span> },
      ]}
    />
  );

  const renderObservationContent = (data: any) => (
    <DetailFields
      fields={[
        {
          label: 'Сущность',
          span: 2,
          value: (
            <a
              href="#"
              style={{ color: 'inherit', textDecoration: 'underline dotted' }}
              onClick={(e) => {
                e.preventDefault();
                openDialog('entity', data.entity_id);
              }}
            >
              [{data.entity_id}] {data.entity_label} — <i>{data.entity_type}</i>
              <div className="text-sm text-500">{data.entity_value}</div>
            </a>
          ),
        },
        { label: 'Атрибут', value: data.attribute },
        {
          label: 'Значение',
          value: <span style={{ wordBreak: 'break-all' }}>{data.value}</span>,
        },
        { label: 'Уверенность', value: data.confidence ?? '—' },
        {
          label: 'Дата наблюдения',
          value: data.observed_at
            ? new Date(data.observed_at).toLocaleString()
            : '—',
        },
        {
          label: 'Источник',
          span: 2,
          value: data.source_url ? (
            <div>
              <a
                href="#"
                style={{ color: 'inherit', textDecoration: 'underline dotted' }}
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
          label: 'Заметки',
          span: 2,
          value: data.notes || <span className="text-500">—</span>,
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
  );

  const renderSourceContent = (data: any) => (
    <>
      <DetailFields
        fields={[
          { label: 'ID', value: data.source.id },
          { label: 'Тип', value: data.source.source_type || '—' },
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
          },
          { label: 'Название', span: 2, value: data.source.title || '—' },
          { label: 'Происхождение', value: data.source.source_kind || '—' },
          { label: 'Провайдер', value: data.source.provider || '—' },
          { label: 'Метод получения', value: data.source.collection_method || '—' },
          { label: 'Надёжность', value: data.source.reliability ?? '—' },
          { label: 'Уровень доступа', value: data.source.access_level || '—' },
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

  const renderDialogContent = (item: DialogStackItem) => {
    const data = dialogCache[cacheKey(item.type, item.id)];
    if (!data) return <p>Загрузка...</p>;

    switch (item.type) {
      case 'entity':
        return renderEntityContent(data);
      case 'relation':
        return renderRelationContent(data);
      case 'observation':
        return renderObservationContent(data);
      case 'source':
        return renderSourceContent(data);
    }
  };

  // Заголовок mark-false зависит от типа
  const getMarkFalseLabel = (): string => {
    if (!markTarget) return 'Пометить как ложную';
    switch (markTarget.table) {
      case 'entities': return 'Пометить сущность как ложную';
      case 'relations': return 'Пометить связь как ложную';
      case 'observations': return 'Пометить наблюдение как ложную';
    }
  };

  return (
    <div className="p-4">
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Панель поиска */}
      <Panel className="shadow-5 mb-3" header="Поиск по сущностям">
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
        {activeFilter && (
          <div className="flex align-items-center gap-2 mb-2">
            <span className="text-sm text-500">Фильтр:</span>
            <div
              className="flex align-items-center gap-2 px-3 py-1 border-round"
              style={{
                background: 'var(--tg-theme-secondary-bg-color)',
                border: '1px solid var(--tg-theme-hint-color)',
              }}
            >
              <span style={{ color: 'var(--tg-theme-accent-text-color)' }}>
                {activeFilter.type === 'entity' ? 'Сущность' :
                activeFilter.type === 'relation' ? 'Связь' :
                activeFilter.type === 'observation' ? 'Наблюдение' : 'Источник'}
                : #{activeFilter.id}
              </span>
              <i
                className="pi pi-times"
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveFilter(null)}
                title="Снять фильтр"
              />
            </div>
          </div>
        )}
        <TabView
          className="my-3"
          activeIndex={activeTab}
          onTabChange={(e) => setActiveTab(e.index)}
        >
          <TabPanel header={`Сущности (${displayEntities.length})`}>
            <EntitiesTable
              value={displayEntities}
              filterFn={entityFilterFn}
              onRowClick={(row) => openDialog('entity', row.id)}
              emptyMessage={searchActive ? 'Ничего не найдено' : 'Нет данных'}
            />
          </TabPanel>

          <TabPanel header={`Связи (${relations.length})`}>
            <RelationsTable
              value={relations}
              filterFn={relationFilterFn}
              onRowClick={(row) => openDialog('relation', row.id)}
            />
          </TabPanel>

          <TabPanel header={`Наблюдения (${observations.length})`}>
            <ObservationsTable
              value={observations}
              filterFn={observationFilterFn}
              onRowClick={(row) => openDialog('observation', row.id)}
            />
          </TabPanel>

          <TabPanel header={`Источники (${sources.length})`}>
            <SourcesTable
              value={sources}
              filterFn={sourceFilterFn}
              onRowClick={(row) => openDialog('source', row.id)}
            />
          </TabPanel>
        </TabView>
      </Panel>

      {/* Диалог пометки как ложной */}
      <Dialog
        visible={falseDialog}
        style={{ width: '500px' }}
        modal
        onHide={() => setFalseDialog(false)}
        header={<span className="p-panel-title">{getMarkFalseLabel()}</span>}
        footer={
          <>
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
            Запись <b>#{markTarget?.id}</b> будет помечена как <code>false</code>.
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

      {/* Единый диалог деталей со стеком */}
      <Dialog
        visible={dialogStack.length > 0}
        style={{ width: '900px' }}
        modal
        onHide={popDialog}
        header={dialogStack.length > 0 ? renderBreadcrumb() : null}
        footer={
          dialogStack.length > 0 ? (
            <div className="p-panel-footer flex justify-content-end gap-2">
              <Button
                label="Открыть в главном окне"
                icon="pi pi-external-link"
                className="osint-soft"
                onClick={() => {
                  const top = dialogStack[dialogStack.length - 1];
                  openInMainWindow(top.type, top.id, typeToTabIndex[top.type]);
                }}
              />
              {['entity', 'relation', 'observation'].includes(dialogStack[dialogStack.length - 1].type) && (
                <Button
                  label="Пометить как ложную"
                  icon="pi pi-exclamation-triangle"
                  className="osint-destructive"
                  onClick={() => {
                    const top = dialogStack[dialogStack.length - 1];
                    openMarkFalseDialog({
                      table: top.type === 'entity' ? 'entities' : top.type === 'relation' ? 'relations' : 'observations',
                      id: top.id,
                    });
                  }}
                />
              )}
              <Button
                label="Закрыть"
                icon="pi pi-times"
                className="osint-soft"
                onClick={closeAllDialogs}
              />
            </div>
          ) : null
        }
      >
        {dialogLoading && <p>Загрузка...</p>}
        {!dialogLoading && dialogStack.length > 0 && renderDialogContent(dialogStack[dialogStack.length - 1])}
      </Dialog>
    </div>
  );
};