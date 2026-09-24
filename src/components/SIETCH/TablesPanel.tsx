// src/components/SIETCH/TablesPanel.tsx

import React, { useState } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';

import { EntitiesTable } from '@/components/SIETCH/DatabaseTables/EntitiesTable';
import { RelationsTable } from '@/components/SIETCH/DatabaseTables/RelationsTable';
import { ObservationsTable } from '@/components/SIETCH/DatabaseTables/ObservationsTable';
import { SourcesTable } from '@/components/SIETCH/DatabaseTables/SourcesTable';

import { AuditLogTab } from './AuditLogTab';

import type { ActiveFilter } from './useCascadingFilter';
import type { CreateType } from './CreateDialog';

export type DialogType = 'entity' | 'relation' | 'observation' | 'source';

export interface TablesPanelProps {
  filteredEntities: any[];
  filteredRelations: any[];
  filteredObservations: any[];
  filteredSources: any[];

  activeFilter: ActiveFilter | null;
  onClearFilter: () => void;

  activeTab: number;
  onTabChange: (index: number) => void;

  onRowClick: (type: DialogType, id: number) => void;
  onCreate: (type: CreateType) => void;
  onOpenDangerZone: () => void;
  onOpenBackup: () => void;    // ← новое

  searchActive: boolean;

  /** Batch-пометка как false. Приходит из родителя; открывает
   *  MarkFalseDialog с массивом ids. */
  onMarkFalseBatch: (table: 'entities' | 'relations' | 'observations', ids: number[]) => void;

  directMatchEntityIds?: number[];
  directMatchRelationIds?: number[];
  directMatchObservationIds?: number[];
  directMatchSourceIds?: number[];
}

const FILTER_LABELS: Record<ActiveFilter['type'], string> = {
  entity: 'Сущность',
  relation: 'Связь',
  observation: 'Наблюдение',
  source: 'Источник',
};

export const TablesPanel: React.FC<TablesPanelProps> = ({
  filteredEntities,
  filteredRelations,
  filteredObservations,
  filteredSources,
  activeFilter,
  onClearFilter,
  activeTab,
  onTabChange,
  onRowClick,
  onCreate,
  onOpenDangerZone,
  onOpenBackup,               // ← новое
  searchActive,
  onMarkFalseBatch,
  directMatchEntityIds,
  directMatchRelationIds,
  directMatchObservationIds,
  directMatchSourceIds,
}) => {
  // Выделение для batch-операций — отдельно по каждой таблице
  const [selectedEntities, setSelectedEntities] = useState<any[]>([]);
  const [selectedRelations, setSelectedRelations] = useState<any[]>([]);
  const [selectedObservations, setSelectedObservations] = useState<any[]>([]);

  const exportMenuRef = React.useRef<Menu>(null);

  const exportItems: MenuItem[] = [
    {
      label: 'Сущности → CSV',
      icon: 'pi pi-download',
      command: async () => {
        const api = (window as any).electronAPI;
        const res = await api.exportEntitiesCsv();
        if (res?.success) console.log('CSV сохранён:', res.filePath);
        else if (!res?.canceled) console.error('Ошибка экспорта:', res?.error);
      },
    },
    {
      label: 'Связи → CSV',
      icon: 'pi pi-download',
      command: async () => {
        const api = (window as any).electronAPI;
        const res = await api.exportRelationsCsv();
        if (res?.success) console.log('CSV сохранён:', res.filePath);
        else if (!res?.canceled) console.error('Ошибка экспорта:', res?.error);
      },
    },
    {
      label: 'Наблюдения → CSV',
      icon: 'pi pi-download',
      command: async () => {
        const api = (window as any).electronAPI;
        const res = await api.exportObservationsCsv();
        if (res?.success) console.log('CSV сохранён:', res.filePath);
        else if (!res?.canceled) console.error('Ошибка экспорта:', res?.error);
      },
    },
    {
      label: 'Источники → CSV',
      icon: 'pi pi-download',
      command: async () => {
        const api = (window as any).electronAPI;
        const res = await api.exportSourcesCsv();
        if (res?.success) console.log('CSV сохранён:', res.filePath);
        else if (!res?.canceled) console.error('Ошибка экспорта:', res?.error);
      },
    },
    { separator: true },
    {
      label: 'Backup БД…',
      icon: 'pi pi-save',
      command: () => {
        onOpenBackup();
      },
    },
    { separator: true },
        {
      label: 'Восстановить из backup…',
      icon: 'pi pi-upload',
      command: async () => {
        const api = (window as any).electronAPI;
        if (!window.confirm('Восстановление заменит текущую базу. Продолжить?')) return;
        const res = await api.backupRestore();
        if (res?.success) {
          const parts = ['База восстановлена.'];
          if (typeof res.rawDumpsRestored === 'number' && res.rawDumpsRestored > 0) {
            parts.push(`Файлов дампов восстановлено: ${res.rawDumpsRestored}.`);
          }
          parts.push('Закройте и перезапустите приложение, чтобы изменения вступили в силу.');
          alert(parts.join(' '));
        } else if (!res?.canceled) {
          alert(`Ошибка: ${res?.error}`);
        }
      },
    },
  ];

  const renderSelectionToolbar = (
    selected: any[],
    clear: () => void,
    table: 'entities' | 'relations' | 'observations'
  ) => {
    if (selected.length === 0) return null;
    return (
      <div
        className="flex align-items-center gap-2 mb-2 p-2 border-round"
        style={{
          background: 'var(--tg-theme-secondary-bg-color)',
          border: '1px solid var(--tg-theme-hint-color)',
        }}
      >
        <span className="text-sm">Выбрано: <b>{selected.length}</b></span>
        <Button
          label="Пометить как false"
          icon="pi pi-exclamation-triangle"
          className="osint-destructive-soft p-button-sm"
          onClick={() => onMarkFalseBatch(table, selected.map((r) => r.id))}
        />
        <Button
          label="Снять выделение"
          icon="pi pi-times"
          className="osint-soft p-button-sm"
          onClick={clear}
        />
      </div>
    );
  };

  return (
    <Panel 
      className="shadow-5 mb-3" 
      header="Таблицы"
      footer={
        <>
          <div className="flex align-items-center gap-2">
            <Menu model={exportItems} popup ref={exportMenuRef} id="export_menu" />
            <Button
              label="Экспорт"
              icon="pi pi-download"
              className="osint-soft p-button-sm"
              onClick={(e) => exportMenuRef.current?.toggle(e)}
              aria-controls="export_menu"
              aria-haspopup
              tooltip="Выгрузить таблицы в CSV"
              tooltipOptions={{ position: 'left' }}
            />
            <Button
              label="Опасная зона"
              icon="pi pi-exclamation-octagon"
              className="osint-destructive-soft p-button-sm"
              onClick={onOpenDangerZone}
              tooltip="Полная очистка базы или удаление всех дампов"
              tooltipOptions={{ position: 'left' }}
            />
          </div>
        </>
      }
    >
      <div className="flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        {/* Чип активного фильтра — слева */}
        <div className="flex align-items-center gap-2 flex-wrap">
          {activeFilter && (
            <>
              <span className="text-sm text-500">Фильтр:</span>
              <div
                className="flex align-items-center gap-2 px-3 py-1 border-round"
                style={{
                  background: 'var(--tg-theme-secondary-bg-color)',
                  border: '1px solid var(--tg-theme-hint-color)',
                }}
              >
                <span style={{ color: 'var(--tg-theme-accent-text-color)' }}>
                  {FILTER_LABELS[activeFilter.type]}: #{activeFilter.id}
                </span>
                <i
                  className="pi pi-times"
                  style={{ cursor: 'pointer' }}
                  onClick={onClearFilter}
                  title="Снять фильтр"
                />
              </div>
            </>
          )}
        </div>

        
      </div>

      <TabView
        className="my-3"
        activeIndex={activeTab}
        onTabChange={(e) => onTabChange(e.index)}
      >
        <TabPanel header={`Сущности (${filteredEntities.length})`}>
          <div className="flex justify-content-end mb-2">
            <Button
              label="Создать сущность"
              icon="pi pi-plus"
              className="osint-soft p-button-sm"
              onClick={() => onCreate('entity')}
            />
          </div>
          {renderSelectionToolbar(selectedEntities, () => setSelectedEntities([]), 'entities')}
          <EntitiesTable
            value={filteredEntities}
            onRowClick={(row) => onRowClick('entity', row.id)}
            emptyMessage={searchActive ? 'Ничего не найдено' : 'Нет данных'}
            selection={selectedEntities}
            onSelectionChange={setSelectedEntities}
            directMatchIds={directMatchEntityIds}
          />
        </TabPanel>

        <TabPanel header={`Связи (${filteredRelations.length})`}>
          <div className="flex justify-content-end mb-2">
            <Button
              label="Создать связь"
              icon="pi pi-plus"
              className="osint-soft p-button-sm"
              onClick={() => onCreate('relation')}
            />
          </div>
          {renderSelectionToolbar(selectedRelations, () => setSelectedRelations([]), 'relations')}
          <RelationsTable
            value={filteredRelations}
            onRowClick={(row) => onRowClick('relation', row.id)}
            selection={selectedRelations}
            onSelectionChange={setSelectedRelations}
            directMatchIds={directMatchRelationIds}
          />
        </TabPanel>

        <TabPanel header={`Наблюдения (${filteredObservations.length})`}>
          <div className="flex justify-content-end mb-2">
            <Button
              label="Создать наблюдение"
              icon="pi pi-plus"
              className="osint-soft p-button-sm"
              onClick={() => onCreate('observation')}
            />
          </div>
          {renderSelectionToolbar(selectedObservations, () => setSelectedObservations([]), 'observations')}
          <ObservationsTable
            value={filteredObservations}
            onRowClick={(row) => onRowClick('observation', row.id)}
            selection={selectedObservations}
            onSelectionChange={setSelectedObservations}
            directMatchIds={directMatchObservationIds}
          />
        </TabPanel>

        <TabPanel header={`Источники (${filteredSources.length})`}>
          <div className="flex justify-content-end mb-2">
            <Button
              label="Создать источник"
              icon="pi pi-plus"
              className="osint-soft p-button-sm"
              onClick={() => onCreate('source')}
            />
          </div>
          <SourcesTable
            value={filteredSources}
            onRowClick={(row) => onRowClick('source', row.id)}
            directMatchIds={directMatchSourceIds}
          />
        </TabPanel>

        <TabPanel header="Журнал изменений">
          <AuditLogTab />
        </TabPanel>
      </TabView>
    </Panel>
  );
};