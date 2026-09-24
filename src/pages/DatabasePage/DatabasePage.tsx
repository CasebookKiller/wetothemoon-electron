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

import {
  CreateDialog,
  type CreateType,
  type CreateDialogInitialValues,
} from '@/components/SIETCH/CreateDialog';
import { MarkFalseDialog, type MarkFalseTable } from '@/components/SIETCH/MarkFalseDialog';
import { DeleteDialog, type DeleteTarget } from '@/components/SIETCH/DeleteDialog';
import { DangerZoneDialog } from '@/components/SIETCH/DangerZoneDialog';
import { RepresentativeDialog } from '@/components/SIETCH/RepresentativeDialog';
import { BackupDialog } from '@/components/SIETCH/BackupDialog';    // ← новое
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
  { label: 'Суд', value: 'court' },
  { label: 'Судебное дело', value: 'court_case' },
  { label: 'Судья', value: 'judge' },
  { label: 'Домен', value: 'domain' },
  { label: 'Email', value: 'email' },
  { label: 'Телефон', value: 'phone' },
  { label: 'Адрес', value: 'address' },
  { label: 'Документ', value: 'document' },
  { label: 'Прочее', value: 'other' },
];

const searchScopeOptions = [
  { label: 'Все таблицы', value: 'all' },
  { label: 'Только сущности', value: 'entity' },
  { label: 'Только связи', value: 'relation' },
  { label: 'Только наблюдения', value: 'observation' },
  { label: 'Только источники', value: 'source' },
];

const typeToTabIndex: Record<DialogType, number> = {
  entity: 0,
  relation: 1,
  observation: 2,
  source: 3,
  // журнал недоступен из диалогов — индекс 4 не используется
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
  const [searchScope, setSearchScope] = useState<string>('all');
  const [searchEntityType, setSearchEntityType] = useState<string>('all');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchUnionIds, setSearchUnionIds] = useState<{
    entities: number[];
    relations: number[];
    observations: number[];
    sources: number[];
  } | null>(null);
  const [searchMatchedIds, setSearchMatchedIds] = useState<{
    entities: number[];
    relations: number[];
    observations: number[];
    sources: number[];
  } | null>(null);
  const [searchCounts, setSearchCounts] = useState<{
    entity: number;
    relation: number;
    observation: number;
    source: number;
  } | null>(null);
  const [searchUnionCounts, setSearchUnionCounts] = useState<{
    entities: number;
    relations: number;
    observations: number;
    sources: number;
  } | null>(null);

  // ============ UI-состояния ============
  const [activeTab, setActiveTab] = useState(0);
  const [helpVisible, setHelpVisible] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<CreateType>('entity');
  const [markFalseVisible, setMarkFalseVisible] = useState(false);
  const [markFalseTarget, setMarkFalseTarget] = useState<{ table: MarkFalseTable; ids: number[] } | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [dangerVisible, setDangerVisible] = useState(false);
  const [backupVisible, setBackupVisible] = useState(false);           // ← новое

  const [createDialogInitialValues, setCreateDialogInitialValues] = useState<CreateDialogInitialValues | null>(null);
  // ← новое:
  const [repDialogVisible, setRepDialogVisible] = useState(false);
  const [repDialogFixedCase, setRepDialogFixedCase] = useState<number | null>(null);
  const [repDialogFixedRepresentative, setRepDialogFixedRepresentative] = useState<number | null>(null);

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

  /**
   * Сортирует строки: сначала прямые совпадения (по matchedIds),
   * затем связанные. Внутри каждой группы — порядок сохраняется
   * (обычно id DESC из SQL).
   */
  const sortByMatch = <T extends { id: number }>(
    rows: T[],
    matchedIds: number[]
  ): T[] => {
    const matchedSet = new Set(matchedIds);
    const direct: T[] = [];
    const related: T[] = [];
    for (const r of rows) {
      if (matchedSet.has(r.id)) direct.push(r);
      else related.push(r);
    }
    return [...direct, ...related];
  };

  // Поиск: если активен — режем все 4 таблицы по unionIds из searchAll.
  // Фильтр по типу сущности применяем только к сущностям и только
  // когда scope = 'all' или 'entity'.
  const entityTypeFilterActive =
    searchActive &&
    (searchScope === 'all' || searchScope === 'entity') &&
    searchEntityType !== 'all';

  const matchedEntityIds = searchMatchedIds?.entities || [];
  const matchedRelationIds = searchMatchedIds?.relations || [];
  const matchedObservationIds = searchMatchedIds?.observations || [];
  const matchedSourceIds = searchMatchedIds?.sources || [];

  const displayEntities = searchActive && searchUnionIds
    ? sortByMatch(
        entities
          .filter((e) => searchUnionIds.entities.includes(e.id))
          .filter((e) => !entityTypeFilterActive || e.type === searchEntityType),
        matchedEntityIds
      )
    : entities;

  const displayRelations = searchActive && searchUnionIds
    ? sortByMatch(
        relations.filter((r) => searchUnionIds.relations.includes(r.id)),
        matchedRelationIds
      )
    : relations;

  const displayObservations = searchActive && searchUnionIds
    ? sortByMatch(
        observations.filter((o) => searchUnionIds.observations.includes(o.id)),
        matchedObservationIds
      )
    : observations;

  const displaySources = searchActive && searchUnionIds
    ? sortByMatch(
        sources.filter((s) => searchUnionIds.sources.includes(s.id)),
        matchedSourceIds
      )
    : sources;

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
    relations: displayRelations,
    observations: displayObservations,
    sources: displaySources,
  });

  // ============ Загрузка данных ============
  const loadData = async () => {
    try {
      const [ent, rel, obs, src] = await Promise.all([
        api.getEntities(5000, 0),      // ← лимит 500
        api.getRelations(5000, 0),     // ← 500
        api.getObservations(5000, 0),  // ← 500
        api.getSources(5000, 0),       // ← 500
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
      setSearchUnionIds(null);
      setSearchCounts(null);
      setSearchUnionCounts(null);
      return;
    }
    setSearchLoading(true);
    setError('');
    try {
      const kinds = searchScope === 'all' ? undefined : [searchScope];
      const res = await api.searchAll(searchQuery.trim(), kinds, 500, 0);
      if (res.success) {
        setSearchUnionIds(res.unionIds || null);
        setSearchMatchedIds(res.matchedIds || null);
        setSearchCounts(res.counts || null);
        setSearchUnionCounts(
          res.unionIds
            ? {
                entities: res.unionIds.entities?.length || 0,
                relations: res.unionIds.relations?.length || 0,
                observations: res.unionIds.observations?.length || 0,
                sources: res.unionIds.sources?.length || 0,
              }
            : null
        );
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
    setSearchScope('all');
    setSearchEntityType('all');
    setSearchActive(false);
    setSearchUnionIds(null);
    setSearchMatchedIds(null);
    setSearchCounts(null);
    setSearchUnionCounts(null);
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

  const openMarkFalseDialog = (target: { table: MarkFalseTable; ids: number[] }) => {
    setMarkFalseTarget(target);
    setMarkFalseVisible(true);
  };

  const handleMarkFalseBatch = (
    table: 'entities' | 'relations' | 'observations',
    ids: number[]
  ) => {
    openMarkFalseDialog({ table, ids });
  };

  const handleStartEdit = () => {
    if (!current || !currentData) return;
    startEditing(current.type, currentData);
  };

  const openRepresentativeDialog = (entityId: number, entityType: string) => {
    if (entityType === 'court_case') {
      setRepDialogFixedCase(entityId);
      setRepDialogFixedRepresentative(null);
    } else if (entityType === 'person') {
      setRepDialogFixedRepresentative(entityId);
      setRepDialogFixedCase(null);
    } else {
      return; // не поддерживаем
    }
    setRepDialogVisible(true);
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
          
                    {current.type === 'entity' &&
          (currentData?.entity?.type === 'court_case' ||
            currentData?.entity?.type === 'person') && (
            <Button
              icon="pi pi-user-plus"
              className="osint-soft p-button-sm"
              tooltip={
                currentData.entity.type === 'court_case'
                  ? 'Добавить представителя в это дело'
                  : 'Добавить как представителя в деле'
              }
              tooltipOptions={{ position: 'top' }}
              onClick={() =>
                openRepresentativeDialog(current.id, currentData.entity.type)
              }
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
                  ids: [current.id],
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
        scope={searchScope}
        onScopeChange={setSearchScope}
        scopeOptions={searchScopeOptions}
        entityType={searchEntityType}
        onEntityTypeChange={setSearchEntityType}
        entityTypeOptions={entityTypeOptions}
        loading={searchLoading}
        searchActive={searchActive}
        searchCounts={searchCounts}
        searchUnionCounts={searchUnionCounts}
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
        onOpenBackup={() => setBackupVisible(true)}                        // ← новое
        onMarkFalseBatch={handleMarkFalseBatch}
        searchActive={searchActive}
        directMatchEntityIds={searchActive ? matchedEntityIds : undefined}
        directMatchRelationIds={searchActive ? matchedRelationIds : undefined}
        directMatchObservationIds={searchActive ? matchedObservationIds : undefined}
        directMatchSourceIds={searchActive ? matchedSourceIds : undefined}
      />

      <CreateDialog
        visible={createDialog}
        createType={createType}
        initialValues={createDialogInitialValues}
        onHide={() => {
          setCreateDialog(false);
          setCreateDialogInitialValues(null);
        }}
        onSuccess={async (type, id) => {
          setCreateDialogInitialValues(null);
          await loadData();
          resetCache();
          await openDialog(type, id);
        }}
      />

      <RepresentativeDialog
        visible={repDialogVisible}
        fixedCaseId={repDialogFixedCase}
        fixedRepresentativeId={repDialogFixedRepresentative}
        onHide={() => {
          setRepDialogVisible(false);
          setRepDialogFixedCase(null);
          setRepDialogFixedRepresentative(null);
        }}
        onSuccess={async () => {
          await loadData();
          await refreshTopDialog();
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

      <BackupDialog                                                         // ← новое
        visible={backupVisible}
        onHide={() => setBackupVisible(false)}
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