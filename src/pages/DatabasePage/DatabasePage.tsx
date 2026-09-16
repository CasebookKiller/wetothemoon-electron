// wetothemoon-electron/src/pages/DatabasePage/DatabasePage.tsx

import React, { useEffect, useState } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';

import './DatabasePage.css';
import { EntitiesTable } from '@/components/SIETCH/DatabaseTables/EntitiesTable';
import { RelationsTable } from '@/components/SIETCH/DatabaseTables/RelationsTable';
import { ObservationsTable } from '@/components/SIETCH/DatabaseTables/ObservationsTable';
import { SourcesTable } from '@/components/SIETCH/DatabaseTables/SourcesTable';
import { DetailFields } from '@/components/SIETCH/DetailFields';

import { DatabaseHelp } from '@/components/SIETCH/DatabaseHelp';

import { SensitiveVaultDialog } from '@/components/SIETCH/SensitiveVaultDialog';

import { MarkFalseDialog, type MarkFalseTable } from '@/components/SIETCH/MarkFalseDialog';
import { DeleteDialog, type DeleteTarget } from '@/components/SIETCH/DeleteDialog';
import { DangerZoneDialog } from '@/components/SIETCH/DangerZoneDialog';

import { CreateDialog, type CreateType } from '@/components/SIETCH/CreateDialog';

import { EntityDetailsContent, type DialogType } from '@/components/SIETCH/content/EntityDetailsContent';
import { RelationDetailsContent } from '@/components/SIETCH/content/RelationDetailsContent';
import { ObservationDetailsContent } from '@/components/SIETCH/content/ObservationDetailsContent';
import { SourceDetailsContent } from '@/components/SIETCH/content/SourceDetailsContent';

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

  // Стек диалогов деталей
  const [dialogStack, setDialogStack] = useState<DialogStackItem[]>([]);
  const [dialogCache, setDialogCache] = useState<Record<string, any>>({});
  const [dialogLoading, setDialogLoading] = useState(false);

  const [activeFilter, setActiveFilter] = useState<{ type: DialogType; id: number } | null>(null);
  const [relatedIds, setRelatedIds] = useState<{
    entityIds: Set<number>;
    relationIds: Set<number>;
    observationIds: Set<number>;
    sourceIds: Set<number>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  const [createDialog, setCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<'entity' | 'relation' | 'observation' | 'source'>('entity');
  const [entityDropdownOptions, setEntityDropdownOptions] = useState<{ label: string; value: number }[]>([]);

  const [helpVisible, setHelpVisible] = useState(false);

  const [sensitiveDialogVisible, setSensitiveDialogVisible] = useState(false);
  const [sensitiveEntityId, setSensitiveEntityId] = useState<number | null>(null);
  const [sensitiveEntityLabel, setSensitiveEntityLabel] = useState<string>('');

  const [markFalseTarget, setMarkFalseTarget] = useState<{ table: MarkFalseTable; id: number } | null>(null);
  const [markFalseVisible, setMarkFalseVisible] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const [dangerVisible, setDangerVisible] = useState(false);


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
    setEditing(false);
    setEditForm(null);
    setEditMessage('');
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

  const openCreateDialog = (type: CreateType) => {
    setCreateType(type);
    setCreateDialog(true);
  };

  const typeToTabIndex: Record<DialogType, number> = {
    entity: 0,
    relation: 1,
    observation: 2,
    source: 3,
  };

  const openInMainWindow = async (type: DialogType, id: number, tabIndex: number) => {
    setDialogStack([]);
    setActiveFilter({ type, id });
    setActiveTab(tabIndex);
    try {
      const res = await api.getRelatedIds(type, id);
      if (res.success && res.data) {
        setRelatedIds({
          entityIds: new Set(res.data.entityIds),
          relationIds: new Set(res.data.relationIds),
          observationIds: new Set(res.data.observationIds),
          sourceIds: new Set(res.data.sourceIds),
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilter = () => {
    setActiveFilter(null);
    setRelatedIds(null);
  };

  const popDialog = () => {
    setEditing(false);
    setEditForm(null);
    setEditMessage('');
    setDialogStack((prev) => prev.slice(0, -1));
  };

  const popToIndex = (index: number) => {
    setEditing(false);
    setEditForm(null);
    setEditMessage('');
    setDialogStack((prev) => prev.slice(0, index + 1));
  };

  const closeAllDialogs = () => {
    setDialogStack([]);
    setDialogCache({});
    setEditing(false);
    setEditForm(null);
    setEditMessage('');
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

      await loadEntityDropdownOptions();   // ← добавить
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

  const openMarkFalseDialog = (target: { table: MarkFalseTable; id: number }) => {
    setMarkFalseTarget(target);
    setMarkFalseVisible(true);
  };

  const startEditing = (type: DialogType, data: any) => {
    if (type === 'entity') {
      setEditForm({
        type: data.entity.type,
        value: data.entity.value,
        label: data.entity.label || '',
        confidence: data.entity.confidence ?? 50,
        status: data.entity.status,
        notes: data.entity.notes || '',
      });
    } else if (type === 'relation') {
      setEditForm({
        predicate: data.predicate,
        confidence: data.confidence ?? 50,
        status: data.status,
        valid_from: data.valid_from || '',
        valid_to: data.valid_to || '',
        evidence_text: data.evidence_text || '',
        notes: data.notes || '',
      });
    } else if (type === 'observation') {
      setEditForm({
        attribute: data.attribute,
        value: data.value,
        confidence: data.confidence ?? 50,
        notes: data.notes || '',
      });
    } else if (type === 'source') {
      setEditForm({
        url: data.source.url,
        title: data.source.title || '',
        source_type: data.source.source_type || '',
        source_kind: data.source.source_kind || '',
        provider: data.source.provider || '',
        collection_method: data.source.collection_method || '',
        authority_basis: data.source.authority_basis || '',
        reliability: data.source.reliability ?? 50,
        access_level: data.source.access_level || 'public',
        notes: data.source.notes || '',
      });
    }
    setEditMessage('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm(null);
    setEditMessage('');
  };

  const saveEditing = async () => {
    if (!editForm || dialogStack.length === 0) return;
    const top = dialogStack[dialogStack.length - 1];
    setEditSaving(true);
    setEditMessage('');
    try {
      let res: any;
      if (top.type === 'entity') {
        res = await api.updateEntity(top.id, editForm);
      } else if (top.type === 'relation') {
        res = await api.updateRelation(top.id, editForm);
      } else if (top.type === 'observation') {
        res = await api.updateObservation(top.id, editForm);
      } else if (top.type === 'source') {
        res = await api.updateSource(top.id, editForm);
      }

      if (res?.success) {
        setEditMessage('Сохранено');
        await loadData();
        await refreshTopDialog();
        setTimeout(() => {
          setEditing(false);
          setEditForm(null);
          setEditMessage('');
        }, 600);
      } else {
        setEditMessage(`Ошибка: ${res?.error || 'неизвестная'}`);
      }
    } catch (e) {
      setEditMessage((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const displayEntities = searchActive ? searchResults : entities;

    const filteredEntities = relatedIds
    ? displayEntities.filter((r) => relatedIds.entityIds.has(r.id))
    : displayEntities;

  const filteredRelations = relatedIds
    ? relations.filter((r) => relatedIds.relationIds.has(r.id))
    : relations;

  const filteredObservations = relatedIds
    ? observations.filter((r) => relatedIds.observationIds.has(r.id))
    : observations;

  const filteredSources = relatedIds
    ? sources.filter((r) => relatedIds.sourceIds.has(r.id))
    : sources;

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

  const renderDialogContent = (item: DialogStackItem) => {
    const data = dialogCache[cacheKey(item.type, item.id)];
    if (!data) return <p>Загрузка...</p>;

    const onEditChange = (key: string, value: any) =>
      setEditForm((prev: any) => ({ ...(prev || {}), [key]: value }));

    switch (item.type) {
      case 'entity':
        return (
          <EntityDetailsContent
            data={data}
            editing={editing}
            editForm={editForm}
            onEditChange={onEditChange}
            openDialog={openDialog}
          />
        );
      case 'relation':
        return (
          <RelationDetailsContent
            data={data}
            editing={editing}
            editForm={editForm}
            onEditChange={onEditChange}
            openDialog={openDialog}
          />
        );
      case 'observation':
        return (
          <ObservationDetailsContent
            data={data}
            editing={editing}
            editForm={editForm}
            onEditChange={onEditChange}
            openDialog={openDialog}
          />
        );
      case 'source':
        return (
          <SourceDetailsContent
            data={data}
            editing={editing}
            editForm={editForm}
            onEditChange={onEditChange}
            openDialog={openDialog}
          />
        );
    }
  };

  const sourceDropdownOptions = [
    { label: '— Не указан —', value: null },
    ...sources.map((s: any) => ({
      label: `[${s.id}] ${s.title || s.url}`,
      value: s.id,
    })),
  ];

  const loadEntityDropdownOptions = async () => {
    try {
      const res = await api.listEntitiesDropdown();
      if (res.success) {
        setEntityDropdownOptions(
          (res.items || []).map((e: any) => ({
            label: `[${e.id}] ${e.label} (${e.type})`,
            value: e.id,
          }))
        );
      }
    } catch (e) {
      console.error('Не удалось загрузить список сущностей:', e);
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
          <Button
            label="Справка"
            icon="pi pi-question-circle"
            className="p-button-raised p-button-accent"
            onClick={() => setHelpVisible(true)}
            tooltip="Как работать с базой данных"
            tooltipOptions={{ position: 'bottom' }}
          />
        </div>

        {searchActive && (
          <div className="mt-2 text-sm">
            Найдено: <b>{searchResults.length}</b> записей
          </div>
        )}
      </Panel>

      {/* Панель таблиц */}
      <Panel
        className="shadow-5 mb-3"
        header="Таблицы"
        footer={
          <div className="flex justify-content-end mb-2">
            <Button
              label="Опасная зона"
              icon="pi pi-exclamation-octagon"
              className="osint-destructive-soft p-button-sm"
              onClick={() => setDangerVisible(true)}
              tooltip="Полная очистка базы или удаление всех дампов"
              tooltipOptions={{ position: 'left' }}
            />
          </div>
        }
      >
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
                onClick={clearFilter}
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
          <TabPanel header={`Сущности (${filteredEntities.length})`}>
            <div className="flex justify-content-end mb-2">
              <Button
                label="Создать сущность"
                icon="pi pi-plus"
                className="osint-soft p-button-sm"
                onClick={() => openCreateDialog('entity')}
              />
            </div>
            <EntitiesTable
              value={filteredEntities}
              onRowClick={(row) => openDialog('entity', row.id)}
              emptyMessage={searchActive ? 'Ничего не найдено' : 'Нет данных'}
            />
          </TabPanel>

          <TabPanel header={`Связи (${filteredRelations.length})`}>
            <div className="flex justify-content-end mb-2">
              <Button
                label="Создать связь"
                icon="pi pi-plus"
                className="osint-soft p-button-sm"
                onClick={() => openCreateDialog('relation')}
              />
            </div>
            <RelationsTable
              value={filteredRelations}
              onRowClick={(row) => openDialog('relation', row.id)}
            />
          </TabPanel>

          <TabPanel header={`Наблюдения (${filteredObservations.length})`}>
            <div className="flex justify-content-end mb-2">
              <Button
                label="Создать наблюдение"
                icon="pi pi-plus"
                className="osint-soft p-button-sm"
                onClick={() => openCreateDialog('observation')}
              />
            </div>
            <ObservationsTable
              value={filteredObservations}
              onRowClick={(row) => openDialog('observation', row.id)}
            />
          </TabPanel>

          <TabPanel header={`Источники (${filteredSources.length})`}>
            <div className="flex justify-content-end mb-2">
              <Button
                label="Создать источник"
                icon="pi pi-plus"
                className="osint-soft p-button-sm"
                onClick={() => openCreateDialog('source')}
              />
            </div>
            <SourcesTable
              value={filteredSources}
              onRowClick={(row) => openDialog('source', row.id)}
            />
          </TabPanel>
        </TabView>
      </Panel>

      {/* Единый диалог деталей со стеком */}
      <Dialog
        visible={dialogStack.length > 0}
        style={{ width: '900px' }}
        modal
        onHide={popDialog}
        header={dialogStack.length > 0 ? renderBreadcrumb() : null}
        footer={
          dialogStack.length > 0 ? (
            (() => {
              const top = dialogStack[dialogStack.length - 1];
              const isEntity = top.type === 'entity';
              const canMarkFalse = ['entity', 'relation', 'observation'].includes(top.type);

              return (
                <div className="p-panel-footer flex justify-content-between align-items-center gap-2 flex-wrap">
                  {/* Левая группа: вспомогательные действия (иконки) */}
                  <div className="flex align-items-center gap-2">
                    {isEntity && (
                      <Button
                        icon="pi pi-shield"
                        className="osint-soft p-button-sm"
                        tooltip="Чувствительные данные"
                        tooltipOptions={{ position: 'top' }}
                        onClick={() => {
                          const data = dialogCache[cacheKey(top.type, top.id)];
                          setSensitiveEntityId(top.id);
                          setSensitiveEntityLabel(data?.entity?.label || data?.entity?.value || `#${top.id}`);
                          setSensitiveDialogVisible(true);
                        }}
                      />
                    )}

                    <Button
                      icon="pi pi-external-link"
                      className="osint-soft p-button-sm"
                      tooltip="Открыть в главном окне"
                      tooltipOptions={{ position: 'top' }}
                      onClick={() => openInMainWindow(top.type, top.id, typeToTabIndex[top.type])}
                    />

                    {canMarkFalse && !editing && (
                      <Button
                        icon="pi pi-exclamation-triangle"
                        className="osint-destructive-soft p-button-sm"
                        tooltip="Пометить как ложную"
                        tooltipOptions={{ position: 'top' }}
                        onClick={() => {
                          const top = dialogStack[dialogStack.length - 1];
                          openMarkFalseDialog({
                            table: top.type === 'entity' ? 'entities' : top.type === 'relation' ? 'relations' : 'observations',
                            id: top.id,
                          });
                        }}
                      />
                    )}

                    {canMarkFalse && !editing && (
                      <Button
                        icon="pi pi-trash"
                        className="osint-destructive-soft p-button-sm"
                        tooltip="Удалить"
                        tooltipOptions={{ position: 'top' }}
                        onClick={() => {
                          const top = dialogStack[dialogStack.length - 1];
                          setDeleteTarget({ type: top.type, id: top.id });
                          setDeleteVisible(true);
                        }}
                      />
                    )}
                  </div>

                  {/* Правая группа: основные действия (с текстом) */}
                  <div className="flex align-items-center gap-2">
                    {editing ? (
                      <>
                        <Button
                          label="Отмена"
                          icon="pi pi-times"
                          className="osint-soft p-button-sm"
                          onClick={cancelEditing}
                          disabled={editSaving}
                        />
                        <Button
                          label={editSaving ? 'Сохранение...' : 'Сохранить'}
                          icon={editSaving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
                          className="osint p-button-sm"
                          onClick={saveEditing}
                          disabled={editSaving}
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          label="Редактировать"
                          icon="pi pi-pencil"
                          className="osint-soft p-button-sm"
                          onClick={() => {
                            const data = dialogCache[cacheKey(top.type, top.id)];
                            if (data) startEditing(top.type, data);
                          }}
                        />
                        <Button
                          label="Закрыть"
                          icon="pi pi-times"
                          className="osint p-button-sm"
                          onClick={closeAllDialogs}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })()
          ) : null
        }
      >
        {dialogLoading && <p>Загрузка...</p>}
        {!dialogLoading && dialogStack.length > 0 && renderDialogContent(dialogStack[dialogStack.length - 1])}
      </Dialog>

      {/* Диалог создания */}
      <CreateDialog
        visible={createDialog}
        createType={createType}
        onHide={() => setCreateDialog(false)}
        onSuccess={async (type, id) => {
          await loadData();
          // Открыть созданный объект в стеке
          const dialogType =
            type === 'entity' ? 'entity' :
            type === 'relation' ? 'relation' :
            type === 'observation' ? 'observation' : 'source';
          await openDialog(dialogType, id);
        }}
      />

      <MarkFalseDialog
        visible={markFalseVisible}
        target={markFalseTarget}
        onHide={() => setMarkFalseVisible(false)}
        onSuccess={async () => {
          await loadData();
          await refreshTopDialog();
        }}
      />

      <DeleteDialog
        visible={deleteVisible}
        target={deleteTarget}
        onHide={() => setDeleteVisible(false)}
        onSuccess={async () => {
          closeAllDialogs();
          await loadData();
        }}
      />

      <DangerZoneDialog
        visible={dangerVisible}
        onHide={() => setDangerVisible(false)}
        onSuccess={async () => {
          closeAllDialogs();
          await loadData();
        }}
      />

      { /* Чувствительные данные */ }
      <SensitiveVaultDialog
        visible={sensitiveDialogVisible}
        entityId={sensitiveEntityId}
        entityLabel={sensitiveEntityLabel}
        onHide={() => setSensitiveDialogVisible(false)}
      />

      { /* Помощь */ }
      <DatabaseHelp visible={helpVisible} onHide={() => setHelpVisible(false)} />
    </div>
  );
};