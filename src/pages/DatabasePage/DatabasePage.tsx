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
            <DataTable
              value={displayEntities}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              responsiveLayout="scroll"
              emptyMessage={searchActive ? 'Ничего не найдено' : 'Нет данных'}
              selectionMode="single"
              onRowClick={(e) => openEntityDetails(e.data.id)}
              rowHover
            >
              <Column field="id" header="ID" sortable />
              <Column field="type" header="Тип" sortable />
              <Column field="label" header="Название" sortable />
              <Column field="value" header="Значение" sortable />
              <Column field="confidence" header="Уверенность" sortable />
              <Column field="status" header="Статус" sortable />
              <Column field="last_seen" header="Обновлено" sortable />
            </DataTable>
          </TabPanel>

          <TabPanel header={`Связи (${relations.length})`}>
            <DataTable
              value={relations}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              responsiveLayout="scroll"
              selectionMode="single"
              onRowClick={(e) => openRelationDetails(e.data.id)}
              rowHover
            >
              <Column field="id" header="ID" sortable />
              <Column field="subject_label" header="Исходная сущность" sortable />
              <Column field="predicate" header="Тип связи" sortable />
              <Column field="object_label" header="Целевая сущность" sortable />
              <Column field="confidence" header="Уверенность" sortable />
              <Column field="status" header="Статус" sortable />
            </DataTable>
          </TabPanel>

          <TabPanel header={`Наблюдения (${observations.length})`}>
            <DataTable
              value={observations}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              responsiveLayout="scroll"
              selectionMode="single"
              onRowClick={(e) => openObservationDetails(e.data.id)}
              rowHover
            >
              <Column field="id" header="ID" sortable />
              <Column field="entity_label" header="Сущность" sortable />
              <Column field="attribute" header="Атрибут" sortable />
              <Column field="value" header="Значение" sortable />
              <Column field="observed_at" header="Дата" sortable />
            </DataTable>
          </TabPanel>

          <TabPanel header={`Источники (${sources.length})`}>
            <DataTable
              value={sources}
              paginator
              rows={20}
              rowsPerPageOptions={[10, 20, 50, 100]}
              className="db-entities-table"
              responsiveLayout="scroll"
            >
              <Column field="id" header="ID" sortable />
              <Column field="url" header="URL" sortable />
              <Column field="title" header="Название" sortable />
              <Column field="source_type" header="Тип" sortable />
              <Column field="retrieved_at" header="Дата получения" sortable />
            </DataTable>
          </TabPanel>
        </TabView>
      </Panel>

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
          <div className="p-fluid">
            <div className="field">
              <label className="font-bold">Исходная сущность</label>
              <div>
                [{relationDetails.subject_id}] {relationDetails.subject_label} — <i>{relationDetails.subject_type}</i>
                <div className="text-sm text-500">{relationDetails.subject_value}</div>
              </div>
            </div>

            <div className="field">
              <label className="font-bold">Связь</label>
              <div><b>{relationDetails.predicate}</b></div>
            </div>

            <div className="field">
              <label className="font-bold">Целевая сущность</label>
              <div>
                [{relationDetails.object_id}] {relationDetails.object_label} — <i>{relationDetails.object_type}</i>
                <div className="text-sm text-500">{relationDetails.object_value}</div>
              </div>
            </div>

            <div className="field">
              <label className="font-bold">Источник</label>
              {relationDetails.source_url ? (
                <div>
                  [{relationDetails.source_id}] {relationDetails.source_title || 'Источник'}
                  <div className="text-sm">
                    <a href={relationDetails.source_url} target="_blank" rel="noreferrer">
                      {relationDetails.source_url}
                    </a>
                  </div>
                  <div className="text-sm text-500">
                    {relationDetails.source_type} • {relationDetails.source_provider} • {relationDetails.source_access_level}
                    {relationDetails.source_retrieved_at ? ` • получено ${new Date(relationDetails.source_retrieved_at).toLocaleString()}` : ''}
                  </div>
                </div>
              ) : (
                <div className="text-500">Источник не указан</div>
              )}
            </div>

            <div className="field">
              <label className="font-bold">Подтверждение (evidence)</label>
              <div>{relationDetails.evidence_text || <span className="text-500">—</span>}</div>
            </div>

            <div className="grid">
              <div className="col-6">
                <label className="font-bold">Уверенность</label>
                <div>{relationDetails.confidence ?? '—'}</div>
              </div>
              <div className="col-6">
                <label className="font-bold">Статус</label>
                <div>{relationDetails.status}</div>
              </div>
              <div className="col-6">
                <label className="font-bold">Действует с</label>
                <div>{relationDetails.valid_from || '—'}</div>
              </div>
              <div className="col-6">
                <label className="font-bold">Действует до</label>
                <div>{relationDetails.valid_to || '—'}</div>
              </div>
            </div>

            <div className="field">
              <label className="font-bold">Заметки</label>
              <div>{relationDetails.notes || <span className="text-500">—</span>}</div>
            </div>

            <div className="field">
              <label className="font-bold">Файл дампа</label>
              <div className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
                {relationDetails.raw_file_path || '—'}
              </div>
            </div>
          </div>
        )}
      </Dialog>

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
          <TabView>
            <TabPanel header="Общие сведения">
              <div className="grid">
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">ID</label>
                  <div>{entityDetails.entity.id}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Тип</label>
                  <div><Tag value={entityDetails.entity.type} /></div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Значение (value)</label>
                  <div>{entityDetails.entity.value}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Название (label)</label>
                  <div>{entityDetails.entity.label || '—'}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Нормализованное</label>
                  <div className="text-sm text-500">{entityDetails.entity.normalized_value}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Уверенность</label>
                  <div>{entityDetails.entity.confidence ?? '—'}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Статус</label>
                  <div>{entityDetails.entity.status}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">rusprofile_id</label>
                  <div>{entityDetails.entity.rusprofile_id || '—'}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Первое появление</label>
                  <div>{entityDetails.entity.first_seen ? new Date(entityDetails.entity.first_seen).toLocaleString() : '—'}</div>
                </div>
                <div className="col-12 md:col-6 field">
                  <label className="font-bold">Последнее обновление</label>
                  <div>{entityDetails.entity.last_seen ? new Date(entityDetails.entity.last_seen).toLocaleString() : '—'}</div>
                </div>
                <div className="col-12 field">
                  <label className="font-bold">Заметки</label>
                  <div>{entityDetails.entity.notes || '—'}</div>
                </div>
                <div className="col-12 field">
                  <label className="font-bold">Файл дампа</label>
                  <div className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
                    {entityDetails.entity.raw_file_path || '—'}
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel header={`Наблюдения (${entityDetails.observations.length})`}>
              {entityDetails.observations.length === 0 ? (
                <p className="text-500">Наблюдений нет.</p>
              ) : (
                <DataTable value={entityDetails.observations} responsiveLayout="scroll">
                  <Column field="id" header="ID" />
                  <Column field="attribute" header="Атрибут" />
                  <Column field="value" header="Значение" />
                  <Column field="confidence" header="Уверенность" />
                  <Column field="observed_at" header="Дата" body={(row) => row.observed_at ? new Date(row.observed_at).toLocaleString() : '—'} />
                  <Column field="source_title" header="Источник" body={(row) => row.source_url ? <a href={row.source_url} target="_blank" rel="noreferrer">{row.source_title || row.source_url}</a> : '—'} />
                </DataTable>
              )}
            </TabPanel>

            <TabPanel header={`Исходящие связи (${entityDetails.relations_out.length})`}>
              {entityDetails.relations_out.length === 0 ? (
                <p className="text-500">Нет исходящих связей.</p>
              ) : (
                <DataTable value={entityDetails.relations_out} responsiveLayout="scroll">
                  <Column field="id" header="ID" />
                  <Column field="predicate" header="Предикат" />
                  <Column field="object_label" header="Целевая сущность" body={(row) => `[${row.object_id}] ${row.object_label} (${row.object_type})`} />
                  <Column field="confidence" header="Уверенность" />
                  <Column field="status" header="Статус" />
                  <Column field="valid_from" header="С" />
                  <Column field="valid_to" header="По" />
                </DataTable>
              )}
            </TabPanel>

            <TabPanel header={`Входящие связи (${entityDetails.relations_in.length})`}>
              {entityDetails.relations_in.length === 0 ? (
                <p className="text-500">Нет входящих связей.</p>
              ) : (
                <DataTable value={entityDetails.relations_in} responsiveLayout="scroll">
                  <Column field="id" header="ID" />
                  <Column field="subject_label" header="Исходная сущность" body={(row) => `[${row.subject_id}] ${row.subject_label} (${row.subject_type})`} />
                  <Column field="predicate" header="Предикат" />
                  <Column field="confidence" header="Уверенность" />
                  <Column field="status" header="Статус" />
                  <Column field="valid_from" header="С" />
                  <Column field="valid_to" header="По" />
                </DataTable>
              )}
            </TabPanel>

            <TabPanel header={`Источники (${entityDetails.sources.length})`}>
              {entityDetails.sources.length === 0 ? (
                <p className="text-500">Источников нет.</p>
              ) : (
                <DataTable value={entityDetails.sources} responsiveLayout="scroll">
                  <Column field="id" header="ID" />
                  <Column field="title" header="Название" />
                  <Column field="url" header="URL" body={(row) => <a href={row.url} target="_blank" rel="noreferrer">{row.url}</a>} />
                  <Column field="source_type" header="Тип" />
                  <Column field="provider" header="Провайдер" />
                  <Column field="access_level" header="Доступ" />
                  <Column field="retrieved_at" header="Получено" body={(row) => row.retrieved_at ? new Date(row.retrieved_at).toLocaleString() : '—'} />
                </DataTable>
              )}
            </TabPanel>
          </TabView>
        )}
      </Dialog>

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
          <div className="p-fluid">
            <div className="field">
              <label className="font-bold">Сущность</label>
              <div>
                [{observationDetails.entity_id}] {observationDetails.entity_label} — <i>{observationDetails.entity_type}</i>
                <div className="text-sm text-500">{observationDetails.entity_value}</div>
              </div>
            </div>

            <div className="grid">
              <div className="col-12 md:col-6 field">
                <label className="font-bold">Атрибут</label>
                <div>{observationDetails.attribute}</div>
              </div>
              <div className="col-12 md:col-6 field">
                <label className="font-bold">Значение</label>
                <div style={{ wordBreak: 'break-all' }}>{observationDetails.value}</div>
              </div>
              <div className="col-12 md:col-6 field">
                <label className="font-bold">Уверенность</label>
                <div>{observationDetails.confidence ?? '—'}</div>
              </div>
              <div className="col-12 md:col-6 field">
                <label className="font-bold">Дата наблюдения</label>
                <div>
                  {observationDetails.observed_at
                    ? new Date(observationDetails.observed_at).toLocaleString()
                    : '—'}
                </div>
              </div>
            </div>

            <div className="field">
              <label className="font-bold">Источник</label>
              {observationDetails.source_url ? (
                <div>
                  [{observationDetails.source_id}] {observationDetails.source_title || 'Источник'}
                  <div className="text-sm">
                    <a href={observationDetails.source_url} target="_blank" rel="noreferrer">
                      {observationDetails.source_url}
                    </a>
                  </div>
                  <div className="text-sm text-500">
                    {observationDetails.source_type} • {observationDetails.source_provider} • {observationDetails.source_access_level}
                    {observationDetails.source_retrieved_at
                      ? ` • получено ${new Date(observationDetails.source_retrieved_at).toLocaleString()}`
                      : ''}
                  </div>
                </div>
              ) : (
                <div className="text-500">Источник не указан</div>
              )}
            </div>

            <div className="field">
              <label className="font-bold">Заметки</label>
              <div>{observationDetails.notes || <span className="text-500">—</span>}</div>
            </div>

            <div className="field">
              <label className="font-bold">Файл дампа</label>
              <div className="text-sm text-500" style={{ wordBreak: 'break-all' }}>
                {observationDetails.raw_file_path || '—'}
              </div>
            </div>
          </div>
        )}
      </Dialog>

    </div>
  );
};