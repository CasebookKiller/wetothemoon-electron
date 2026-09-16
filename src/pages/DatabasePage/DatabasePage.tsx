// wetothemoon-electron/src/pages/DatabasePage/DatabasePage.tsx

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';

import './DatabasePage.css';

import { DatabaseHelp } from '@/components/SIETCH/DatabaseHelp';

import { SensitiveVaultDialog } from '@/components/SIETCH/SensitiveVaultDialog';

import { MarkFalseDialog, type MarkFalseTable } from '@/components/SIETCH/MarkFalseDialog';
import { DeleteDialog, type DeleteTarget } from '@/components/SIETCH/DeleteDialog';
import { DangerZoneDialog } from '@/components/SIETCH/DangerZoneDialog';

import { CreateDialog } from '@/components/SIETCH/CreateDialog';

import { EntityDetailsContent } from '@/components/SIETCH/content/EntityDetailsContent';
import type { DialogType } from '@/components/SIETCH/TablesPanel';
import { RelationDetailsContent } from '@/components/SIETCH/content/RelationDetailsContent';
import { ObservationDetailsContent } from '@/components/SIETCH/content/ObservationDetailsContent';
import { SourceDetailsContent } from '@/components/SIETCH/content/SourceDetailsContent';

import { useCascadingFilter } from '@/components/SIETCH/useCascadingFilter';
import { SearchPanel } from '@/components/SIETCH/SearchPanel';
import { TablesPanel } from '@/components/SIETCH/TablesPanel';

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

  const typeToTabIndex: Record<DialogType, number> = {
    entity: 0,
    relation: 1,
    observation: 2,
    source: 3,
  };

  const handleRowClick = (type: DialogType, id: number) => {
    openDialog(type, id);
  };

  const openInMainWindow = async (type: DialogType, id: number, tabIndex: number) => {
    closeAllDialogs();
    setActiveTab(tabIndex);
    await applyFilter(type, id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const {
    activeFilter,
    applyFilter,
    clearFilter,
    filteredEntities,
    filteredRelations,
    filteredObservations,
    filteredSources,
  } = useCascadingFilter({
    displayEntities,
    relations,
    observations,
    sources,
  });

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
      <SearchPanel
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onKeyDown={handleSearchKeyDown}
        type={searchType}
        onTypeChange={setSearchType}
        typeOptions={entityTypeOptions}
        loading={searchLoading}
        searchActive={searchActive}
        resultCount={searchResults.length}
        onSearch={handleSearch}
        onReset={handleResetSearch}
        onRefreshAll={loadData}
        onHelp={() => setHelpVisible(true)}
      />

      <TablesPanel
        filteredEntities={filteredEntities}
        filteredRelations={filteredRelations}
        filteredObservations={filteredObservations}
        filteredSources={filteredSources}
        activeFilter={activeFilter}
        onClearFilter={clearFilter}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRowClick={handleRowClick}
        onCreate={(type) => {
          setCreateType(type);
          setCreateDialog(true);
        }}
        onOpenDangerZone={() => setDangerVisible(true)}
        searchActive={searchActive}
      />

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