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
  //const [falseDialog, setFalseDialog] = useState(false);
  //const [falseReason, setFalseReason] = useState('');
  //const [falseLoading, setFalseLoading] = useState(false);
  //const [falseMessage, setFalseMessage] = useState('');
  //const [markTarget, setMarkTarget] = useState<{ table: 'entities' | 'relations' | 'observations'; id: number } | null>(null);

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
  //const [createForm, setCreateForm] = useState<any>(null);
  //const [createSaving, setCreateSaving] = useState(false);
  //const [createMessage, setCreateMessage] = useState('');
  const [entityDropdownOptions, setEntityDropdownOptions] = useState<{ label: string; value: number }[]>([]);

  const [helpVisible, setHelpVisible] = useState(false);

  //const [deleteDialog, setDeleteDialog] = useState(false);
  //const [deleteForce, setDeleteForce] = useState(false);
  //const [deleteSaving, setDeleteSaving] = useState(false);
  //const [deleteMessage, setDeleteMessage] = useState('');
  //const [deleteStats, setDeleteStats] = useState<{ observations?: number; relations?: number } | null>(null);

  //const [dangerDialog, setDangerDialog] = useState(false);
  //const [dangerMode, setDangerMode] = useState<'tables' | 'dumps' | 'both'>('tables');
  //const [dangerConfirmText, setDangerConfirmText] = useState('');
  //const [dangerSaving, setDangerSaving] = useState(false);
  //const [dangerMessage, setDangerMessage] = useState('');

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

  /*const openCreateEntityDialog = () => {
    setCreateType('entity');
    setCreateForm({
      type: 'company',
      value: '',
      label: '',
      confidence: 50,
      status: 'unverified',
      notes: '',
    });
    setCreateMessage('');
    setCreateDialog(true);
  };*/

  const openCreateDialog = (type: CreateType) => {
    setCreateType(type);
    setCreateDialog(true);
  };

  /*const saveCreateEntity = async () => {
    if (!createForm) return;
    if (!createForm.value?.trim()) {
      setCreateMessage('Поле «Значение» обязательно');
      return;
    }
    if (!createForm.type) {
      setCreateMessage('Выберите тип');
      return;
    }

    setCreateSaving(true);
    setCreateMessage('');
    try {
      const res = await api.createEntity(createForm);
      if (res.success) {
        setCreateMessage('Создано');
        await loadData();
        setTimeout(async () => {
          closeCreateDialog();
          if (res.id) await openDialog('entity', res.id);
        }, 500);
      } else {
        setCreateMessage(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setCreateMessage((e as Error).message);
    } finally {
      setCreateSaving(false);
    }
  };*/

  /*const openCreateRelationDialog = () => {
    setCreateForm({
      subject_id: null,
      predicate: 'associated_with',
      object_id: null,
      source_id: null,
      valid_from: '',
      valid_to: '',
      evidence_text: '',
      confidence: 50,
      status: 'unverified',
      notes: '',
    });
    setCreateType('relation');
    setCreateMessage('');
    setCreateDialog(true);
    // подгрузим актуальные опции на случай, если появились новые сущности
    loadEntityDropdownOptions();
  };*/

  /*const saveCreateRelation = async () => {
    if (!createForm) return;
    if (!createForm.subject_id || !createForm.object_id) {
      setCreateMessage('Выберите исходную и целевую сущности');
      return;
    }
    if (!createForm.predicate?.trim()) {
      setCreateMessage('Укажите тип связи');
      return;
    }

    setCreateSaving(true);
    setCreateMessage('');
    try {
      const res = await api.createRelation(createForm);
      if (res.success) {
        setCreateMessage('Создано');
        await loadData();
        setTimeout(async () => {
          closeCreateDialog();
          if (res.id) await openDialog('relation', res.id);
        }, 500);
      } else {
        setCreateMessage(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setCreateMessage((e as Error).message);
    } finally {
      setCreateSaving(false);
    }
  };*/

  /*const openCreateObservationDialog = () => {
    setCreateType('observation');
    setCreateForm({
      entity_id: null,
      attribute: '',
      value: '',
      source_id: null,
      confidence: 50,
      notes: '',
    });
    setCreateMessage('');
    setCreateDialog(true);
    loadEntityDropdownOptions();
  };*/

  /*const saveCreateObservation = async () => {
    if (!createForm) return;
    if (!createForm.entity_id) {
      setCreateMessage('Выберите сущность');
      return;
    }
    if (!createForm.attribute?.trim()) {
      setCreateMessage('Укажите атрибут');
      return;
    }
    if (!createForm.value?.trim()) {
      setCreateMessage('Укажите значение');
      return;
    }

    setCreateSaving(true);
    setCreateMessage('');
    try {
      const res = await api.createObservation(createForm);
      if (res.success) {
        setCreateMessage('Создано');
        await loadData();
        setTimeout(async () => {
          closeCreateDialog();
          if (res.id) await openDialog('observation', res.id);
        }, 500);
      } else {
        setCreateMessage(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setCreateMessage((e as Error).message);
    } finally {
      setCreateSaving(false);
    }
  };*/

  /*const saveCreateSource = async () => {
    if (!createForm) return;
    if (!createForm.url?.trim()) {
      setCreateMessage('Укажите URL или локальный путь');
      return;
    }

    setCreateSaving(true);
    setCreateMessage('');
    try {
      const res = await api.createSource(createForm);
      if (res.success) {
        setCreateMessage('Создано');
        await loadData();
        setTimeout(async () => {
          closeCreateDialog();
          if (res.id) await openDialog('source', res.id);
        }, 500);
      } else {
        setCreateMessage(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setCreateMessage((e as Error).message);
    } finally {
      setCreateSaving(false);
    }
  };*/

  /*const openCreateSourceDialog = () => {
    setCreateType('source');
    setCreateForm({
      url: '',
      title: '',
      source_type: 'website',
      source_kind: 'public_web',
      provider: '',
      collection_method: 'manual',
      authority_basis: '',
      reliability: 50,
      access_level: 'public',
      notes: '',
    });
    setCreateMessage('');
    setCreateDialog(true);
  };*/

  /*const closeCreateDialog = () => {
    setCreateDialog(false);
    setCreateForm(null);
    setCreateMessage('');
  };*/

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

  /*const handleMarkFalseSubmit = async () => {
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
  };*/

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

  const renderEntityContent = (data: any) => (
    <>
      {editing && (
        <div
          className="mb-3 p-2 border-round flex align-items-start gap-2"
          style={{
            background: 'rgba(236, 156, 66, 0.08)',
            border: '1px solid rgba(236, 156, 66, 0.4)',
          }}
        >
          <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec9c42' }} />
          <div className="text-sm">
            {data.entity.origin === 'manual' ? (
              <>
                <b>Ручная запись.</b> Изменения сохраняются, скрапер её не перезапишет.
              </>
            ) : (
              <>
                <b>Запись собрана автоматически</b> (источник: rusprofile).
                При следующей дозагрузке полей <code>value</code>, <code>label</code> и др.
                они могут быть обновлены. После сохранения эта запись станет{' '}
                <code>manual</code> и скрапер её не тронет.
              </>
            )}
          </div>
        </div>
      )}  
      <DetailFields
        editing={editing}
        editForm={editForm}
        onEditChange={(key, value) =>
          setEditForm((prev: any) => ({ ...(prev || {}), [key]: value }))
        }
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
          { label: 'Источник записи', value: renderOrigin(data.entity.origin) },
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

  const renderRelationContent = (data: any) => (
    <>
      {editing && (
        <div
          className="mb-3 p-2 border-round flex align-items-start gap-2"
          style={{
            background: 'rgba(236, 156, 66, 0.08)',
            border: '1px solid rgba(236, 156, 66, 0.4)',
          }}
        >
          <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec9c42' }} />
          <div className="text-sm">
            {data.origin === 'manual' ? (
              <>
                <b>Ручная запись.</b> Изменения сохраняются, скрапер её не перезапишет.
              </>
            ) : (
              <>
                <b>Запись собрана автоматически.</b> После сохранения она станет{' '}
                <code>manual</code> и скрапер её не тронет.
              </>
            )}
          </div>
        </div>
      )}

      <DetailFields
        editing={editing}
        editForm={editForm}
        onEditChange={(key, value) =>
          setEditForm((prev: any) => ({ ...(prev || {}), [key]: value }))
        }
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
          {
            label: 'Связь',
            value: <b>{data.predicate}</b>,
            editable: true,
            editKey: 'predicate',
            editType: 'text',
          },
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
          {
            label: 'Уверенность',
            value: data.confidence ?? '—',
            editable: true,
            editKey: 'confidence',
            editType: 'number',
          },
          {
            label: 'Статус',
            value: data.status,
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
          { label: 'Источник записи', value: renderOrigin(data.origin) },
          {
            label: 'Действует с',
            value: data.valid_from || '—',
            editable: true,
            editKey: 'valid_from',
            editType: 'text',
          },
          {
            label: 'Действует до',
            value: data.valid_to || '—',
            editable: true,
            editKey: 'valid_to',
            editType: 'text',
          },
          {
            label: 'Подтверждение (evidence)',
            span: 2,
            value: data.evidence_text || <span className="text-500">—</span>,
            editable: true,
            editKey: 'evidence_text',
            editType: 'textarea',
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

  const renderObservationContent = (data: any) => (
    <>
      {editing && (
        <div
          className="mb-3 p-2 border-round flex align-items-start gap-2"
          style={{
            background: 'rgba(236, 156, 66, 0.08)',
            border: '1px solid rgba(236, 156, 66, 0.4)',
          }}
        >
          <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec9c42' }} />
          <div className="text-sm">
            {data.origin === 'manual' ? (
              <>
                <b>Ручная запись.</b> Изменения сохраняются, скрапер её не перезапишет.
              </>
            ) : (
              <>
                <b>Запись собрана автоматически.</b> После сохранения она станет{' '}
                <code>manual</code> и скрапер её не тронет.
              </>
            )}
          </div>
        </div>
      )}

      <DetailFields
        editing={editing}
        editForm={editForm}
        onEditChange={(key, value) =>
          setEditForm((prev: any) => ({ ...(prev || {}), [key]: value }))
        }
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
          { label: 'Источник записи', value: renderOrigin(data.origin) },
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

  const renderSourceContent = (data: any) => (
    <>
      {editing && (
        <div
          className="mb-3 p-2 border-round flex align-items-start gap-2"
          style={{
            background: 'rgba(236, 156, 66, 0.08)',
            border: '1px solid rgba(236, 156, 66, 0.4)',
          }}
        >
          <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec9c42' }} />
          <div className="text-sm">
            {data.source.origin === 'manual' ? (
              <>
                <b>Ручная запись.</b> Изменения сохраняются, скрапер её не перезапишет.
              </>
            ) : (
              <>
                <b>Запись собрана автоматически.</b> После сохранения она станет{' '}
                <code>manual</code> и скрапер её не тронет.
              </>
            )}
          </div>
        </div>
      )}

      <DetailFields
        editing={editing}
        editForm={editForm}
        onEditChange={(key, value) =>
          setEditForm((prev: any) => ({ ...(prev || {}), [key]: value }))
        }
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
          { label: 'Источник записи', value: renderOrigin(data.source.origin) },
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

        <TabPanel header={`Связи (${filteredRelations.length})`}>
          <RelationsTable
            value={filteredRelations}
            onRowClick={(row) => openDialog('relation', row.id)}
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

  const sourceDropdownOptions = [
    { label: '— Не указан —', value: null },
    ...sources.map((s: any) => ({
      label: `[${s.id}] ${s.title || s.url}`,
      value: s.id,
    })),
  ];

  const renderOrigin = (origin?: string) => {
    const value = origin || 'scraper';
    const severity =
      value === 'manual' ? 'warning'
      : value === 'import' ? 'success'
      : 'info';
    const label =
      value === 'manual' ? 'вручную'
      : value === 'import' ? 'импорт'
      : 'автоматически';
    return <Tag value={label} severity={severity as any} />;
  };

  // Заголовок mark-false зависит от типа
  /*const getMarkFalseLabel = (): string => {
    if (!markTarget) return 'Пометить как ложную';
    switch (markTarget.table) {
      case 'entities': return 'Пометить сущность как ложную';
      case 'relations': return 'Пометить связь как ложную';
      case 'observations': return 'Пометить наблюдение как ложную';
    }
  };*/

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

  /*const openDeleteDialog = () => {
    setDeleteForce(false);
    setDeleteMessage('');
    setDeleteStats(null);
    setDeleteDialog(true);
  };*/

  /*const closeDeleteDialog = () => {
    setDeleteDialog(false);
    setDeleteMessage('');
    setDeleteStats(null);
    setDeleteForce(false);
  };*/

  /*const performDelete = async () => {
    if (dialogStack.length === 0) return;
    const top = dialogStack[dialogStack.length - 1];
    setDeleteSaving(true);
    setDeleteMessage('');
    try {
      let res: any;
      if (top.type === 'entity') {
        res = await api.deleteEntity(top.id, deleteForce);
      } else if (top.type === 'relation') {
        res = await api.deleteRelation(top.id);
      } else if (top.type === 'observation') {
        res = await api.deleteObservation(top.id);
      } else if (top.type === 'source') {
        res = await api.deleteSource(top.id, deleteForce);
      }

      if (res?.success) {
        setDeleteMessage('Удалено');
        closeAllDialogs();
        closeDeleteDialog();
        await loadData();
      } else {
        setDeleteMessage(`Ошибка: ${res?.error || 'неизвестная'}`);
        if (res?.stats) setDeleteStats(res.stats);
      }
    } catch (e) {
      setDeleteMessage((e as Error).message);
    } finally {
      setDeleteSaving(false);
    }
  };*/

  /*const openDangerDialog = () => {
    setDangerMode('tables');
    setDangerConfirmText('');
    setDangerMessage('');
    setDangerDialog(true);
  };*/

  /*const closeDangerDialog = () => {
    if (dangerSaving) return;
    setDangerDialog(false);
    setDangerConfirmText('');
    setDangerMessage('');
  };*/

  /*const performDangerAction = async () => {
    if (dangerConfirmText.trim() !== 'УДАЛИТЬ') {
      setDangerMessage('Введите слово УДАЛИТЬ заглавными буквами');
      return;
    }
    setDangerSaving(true);
    setDangerMessage('');
    try {
      if (dangerMode === 'tables' || dangerMode === 'both') {
        const res = await api.clearAllTables();
        if (!res.success) {
          setDangerMessage(`Ошибка очистки таблиц: ${res.error}`);
          return;
        }
      }
      if (dangerMode === 'dumps' || dangerMode === 'both') {
        const res = await api.deleteAllDumps();
        if (!res.success) {
          setDangerMessage(`Ошибка удаления дампов: ${res.error}`);
          return;
        }
        if (res.errors?.length) {
          console.warn('Ошибки удаления некоторых дампов:', res.errors);
        }
      }

      setDangerMessage('Готово');
      closeAllDialogs();
      await loadData();
      setTimeout(() => closeDangerDialog(), 800);
    } catch (e) {
      setDangerMessage((e as Error).message);
    } finally {
      setDangerSaving(false);
    }
  };*/

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