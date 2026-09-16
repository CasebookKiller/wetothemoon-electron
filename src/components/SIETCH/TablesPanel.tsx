// src/components/SIETCH/TablesPanel.tsx

import React from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';

import { EntitiesTable } from '@/components/SIETCH/DatabaseTables/EntitiesTable';
import { RelationsTable } from '@/components/SIETCH/DatabaseTables/RelationsTable';
import { ObservationsTable } from '@/components/SIETCH/DatabaseTables/ObservationsTable';
import { SourcesTable } from '@/components/SIETCH/DatabaseTables/SourcesTable';

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

  searchActive: boolean;
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
  searchActive,
}) => {
  return (
    <Panel 
      className="shadow-5 mb-3" 
      header="Таблицы"
      footer={
        <>
          {/* Опасная зона — справа */}
          <Button
            label="Опасная зона"
            icon="pi pi-exclamation-octagon"
            className="osint-destructive-soft p-button-sm"
            onClick={onOpenDangerZone}
            tooltip="Полная очистка базы или удаление всех дампов"
            tooltipOptions={{ position: 'left' }}
          />
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
          <EntitiesTable
            value={filteredEntities}
            onRowClick={(row) => onRowClick('entity', row.id)}
            emptyMessage={searchActive ? 'Ничего не найдено' : 'Нет данных'}
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
          <RelationsTable
            value={filteredRelations}
            onRowClick={(row) => onRowClick('relation', row.id)}
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
          <ObservationsTable
            value={filteredObservations}
            onRowClick={(row) => onRowClick('observation', row.id)}
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
          />
        </TabPanel>
      </TabView>
    </Panel>
  );
};