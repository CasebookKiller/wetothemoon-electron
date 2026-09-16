import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';

import './DatabasePage.css';

import { SearchPanel } from '@/components/SIETCH/SearchPanel';
import { TablesPanel } from '@/components/SIETCH/TablesPanel';
import { Breadcrumb, type DialogType } from '@/components/SIETCH/Breadcrumb';
import { useDialogStack } from '@/components/SIETCH/useDialogStack';
import { useEditingState } from '@/components/SIETCH/useEditingState';
import { useSensitiveState } from '@/components/SIETCH/useSensitiveState';
import { useCascadingFilter } from '@/components/SIETCH/useCascadingFilter';

import { CreateDialog, type CreateType } from '@/components/SIETCH/CreateDialog';
import { MarkFalseDialog, type MarkFalseTable } from '@/components/SIETCH/MarkFalseDialog';
import { DeleteDialog, type DeleteTarget } from '@/components/SIETCH/DeleteDialog';
import { DangerZoneDialog } from '@/components/SIETCH/DangerZoneDialog';
import { SensitiveVaultDialog } from '@/components/SIETCH/SensitiveVaultDialog';
import { DatabaseHelp } from '@/components/SIETCH/DatabaseHelp';

import { EntityDetailsContent } from '@/components/SIETCH/content/EntityDetailsContent';
import { RelationDetailsContent } from '@/components/SIETCH/content/RelationDetailsContent';
import { ObservationDetailsContent } from '@/components/SIETCH/content/ObservationDetailsContent';
import { SourceDetailsContent } from '@/components/SIETCH/content/SourceDetailsContent';

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

const typeToTabIndex: Record<DialogType, number> = {
  entity: 0,
  relation: 1,
  observation: 2,
  source: 3,
};

export const DatabasePage: React.FC = () => {
  const api = (window as any).electronAPI;

  // ============ Данные ============
  const [entities, setEntities] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState('');

  // ============ Поиск ============
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  // ============ UI-состояния ============
  const [activeTab, setActiveTab] = useState(0);
  const [helpVisible, setHelpVisible] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<CreateType>('entity');
  const [markFalseVisible, setMarkFalseVisible] = useState(false);
  const [markFalseTarget, setMarkFalseTarget] = useState<{ table: MarkFalseTable; id: number } | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [dangerVisible, setDangerVisible] = useState(false);

  // ============ Хуки ============
  const dialogStackHook = useDialogStack();
  const {
    dialogStack,
    dialogCache,
    dialogLoading,
    current,
    currentData,
    cacheKey,
    openDialog,
    popDialog,
    popToIndex,
    closeAllDialogs,
    refreshTopDialog,
    resetCache,
  } = dialogStackHook;

  const editingState = useEditingState({
    onAfterSave: async () => {
      await loadData();
      await refreshTopDialog();
    },
  });
  const {
    editing,
    editForm,
    editSaving,
    editMessage,
    startEditing,
    cancelEditing,
    updateField,
    saveEditing,
    resetEditing,
  } = editingState;

  const sensitiveState = useSensitiveState();

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

  // ============ Загрузка данных ============
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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // При смене верхнего диалога выходим из режима редактирования
    resetEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogStack.length]);

  // ============ Поиск ============
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
    if (e.key === 'Enter') handleSearch();
  };

  // ============ Диалоги ============
  const openInMainWindow = async (type: DialogType, id: number, tabIndex: number) => {
    closeAllDialogs();
    setActiveTab(tabIndex);
    await applyFilter(type, id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMarkFalseDialog = (target: { table: MarkFalseTable; id: number }) => {
    setMarkFalseTarget(target);
    setMarkFalseVisible(true);
  };

  const handleStartEdit = () => {
    if (!current || !currentData) return;
    startEditing(current.type, currentData);
  };

  const handleSaveEdit = async () => {
    if (!current) return;
    await saveEditing(current.type, current.id);
  };

  // ============ Рендер содержимого диалога ============
  const renderDialogContent = () => {
    if (!current || !currentData) return <p>Загрузка...</p>;

    const common = {
      data: currentData,
      editing,
      editForm,
      onEditChange: updateField,
      openDialog,
    };

    switch (current.type) {
      case 'entity':      return <EntityDetailsContent {...common} />;
      case 'relation':    return <RelationDetailsContent {...common} />;
      case 'observation': return <ObservationDetailsContent {...common} />;
      case 'source':      return <SourceDetailsContent {...common} />;
    }
  };

  // ============ Футер диалога ============
  const renderFooter = () => {
    if (!current) return null;
    const canMarkFalse = ['entity', 'relation', 'observation'].includes(current.type);

    return (
      <div className="p-panel-footer flex justify-content-between align-items-center gap-2 flex-wrap">
        <div className="flex align-items-center gap-2">
          {current.type === 'entity' && (
            <Button
              icon="pi pi-shield"
              className="osint-soft p-button-sm"
              tooltip="Чувствительные данные"
              tooltipOptions={{ position: 'top' }}
              onClick={() => {
                sensitiveState.open(
                  current.id,
                  currentData?.entity?.label || currentData?.entity?.value || `#${current.id}`
                );
              }}
            />
          )}
          <Button
            icon="pi pi-external-link"
            className="osint-soft p-button-sm"
            tooltip="Открыть в главном окне"
            tooltipOptions={{ position: 'top' }}
            onClick={() => openInMainWindow(current.type, current.id, typeToTabIndex[current.type])}
          />
          {canMarkFalse && !editing && (
            <Button
              icon="pi pi-exclamation-triangle"
              className="osint-destructive-soft p-button-sm"
              tooltip="Пометить как ложную"
              tooltipOptions={{ position: 'top' }}
              onClick={() =>
                openMarkFalseDialog({
                  table: current.type === 'entity' ? 'entities' : current.type === 'relation' ? 'relations' : 'observations',
                  id: current.id,
                })
              }
            />
          )}
          {canMarkFalse && !editing && (
            <Button
              icon="pi pi-trash"
              className="osint-destructive-soft p-button-sm"
              tooltip="Удалить"
              tooltipOptions={{ position: 'top' }}
              onClick={() => {
                setDeleteTarget({ type: current.type, id: current.id });
                setDeleteVisible(true);
              }}
            />
          )}
        </div>

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
                onClick={handleSaveEdit}
                disabled={editSaving}
              />
            </>
          ) : (
            <>
              <Button
                label="Редактировать"
                icon="pi pi-pencil"
                className="osint-soft p-button-sm"
                onClick={handleStartEdit}
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
  };

  // ============ Рендер ============
  return (
    <div className="p-4">
      {error && <p style={{ color: 'red' }}>{error}</p>}

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
        onRowClick={(type, id) => openDialog(type, id)}
        onCreate={(type) => { setCreateType(type); setCreateDialog(true); }}
        onOpenDangerZone={() => setDangerVisible(true)}
        searchActive={searchActive}
      />

      <CreateDialog
        visible={createDialog}
        createType={createType}
        onHide={() => setCreateDialog(false)}
        onSuccess={async (type, id) => {
          await loadData();
          resetCache();
          await openDialog(type, id);
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
          resetCache();
          await loadData();
        }}
      />

      <DangerZoneDialog
        visible={dangerVisible}
        onHide={() => setDangerVisible(false)}
        onSuccess={async () => {
          closeAllDialogs();
          resetCache();
          await loadData();
        }}
      />

      <SensitiveVaultDialog
        visible={sensitiveState.visible}
        entityId={sensitiveState.entityId}
        entityLabel={sensitiveState.entityLabel}
        onHide={sensitiveState.close}
      />

      <DatabaseHelp
        visible={helpVisible}
        onHide={() => setHelpVisible(false)}
      />

      <Dialog
        visible={dialogStack.length > 0}
        style={{ width: '900px', maxWidth: '95vw' }}
        modal
        onHide={popDialog}
        header={
          dialogStack.length > 0 ? (
            <Breadcrumb
              stack={dialogStack}
              cache={dialogCache}
              cacheKey={cacheKey}
              onNavigate={popToIndex}
            />
          ) : null
        }
        footer={renderFooter()}
      >
        {dialogLoading && <p>Загрузка...</p>}
        {!dialogLoading && renderDialogContent()}
      </Dialog>
    </div>
  );
};