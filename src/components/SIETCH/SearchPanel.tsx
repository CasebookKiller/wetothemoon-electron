// src/components/SIETCH/SearchPanel.tsx

import React from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';

export interface SearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  scope: string;
  onScopeChange: (value: string) => void;
  scopeOptions: { label: string; value: string }[];

  entityType: string;
  onEntityTypeChange: (value: string) => void;
  entityTypeOptions: { label: string; value: string }[];

  loading: boolean;
  searchActive: boolean;
  searchCounts?: {
    entity: number;
    relation: number;
    observation: number;
    source: number;
  } | null;
  searchUnionCounts?: {
    entities: number;
    relations: number;
    observations: number;
    sources: number;
  } | null;

  onSearch: () => void;
  onReset: () => void;
  onRefreshAll: () => void;
  onHelp: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  onQueryChange,
  onKeyDown,
  scope,
  onScopeChange,
  scopeOptions,
  entityType,
  onEntityTypeChange,
  entityTypeOptions,
  loading,
  searchActive,
  searchCounts,
  searchUnionCounts,
  onSearch,
  onReset,
  onRefreshAll,
  onHelp,
}) => {
  const showEntityType = scope === 'all' || scope === 'entity';

  const directTotal = searchCounts
    ? (searchCounts.entity || 0) +
      (searchCounts.relation || 0) +
      (searchCounts.observation || 0) +
      (searchCounts.source || 0)
    : 0;

  const unionTotal = searchUnionCounts
    ? (searchUnionCounts.entities || 0) +
      (searchUnionCounts.relations || 0) +
      (searchUnionCounts.observations || 0) +
      (searchUnionCounts.sources || 0)
    : 0;

  return (
    <Panel className="shadow-5 mb-3" header="Поиск">
      <div className="flex flex-wrap align-items-center gap-3 py-2">
        <div className="flex-1" style={{ minWidth: '240px' }}>
          <span className="p-input-icon-left w-full search-input-with-icon">
            <i className="pi pi-search" />
            <InputText
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Название, ИНН, ФИО, predicate, notes…"
              className="w-full text-base"
            />
          </span>
        </div>

        <div style={{ minWidth: '180px' }}>
          <Dropdown
            value={scope}
            options={scopeOptions}
            onChange={(e) => onScopeChange(e.value)}
            placeholder="Область поиска"
            className="w-full"
          />
        </div>

        {showEntityType && (
          <div style={{ minWidth: '180px' }}>
            <Dropdown
              value={entityType}
              options={entityTypeOptions}
              onChange={(e) => onEntityTypeChange(e.value)}
              placeholder="Тип сущности"
              className="w-full"
            />
          </div>
        )}

        <Button
          label={loading ? 'Поиск...' : 'Найти'}
          icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
          className="p-button-raised p-button-accent"
          onClick={onSearch}
          disabled={loading}
        />

        {(searchActive || query) && (
          <Button
            label="Сбросить"
            icon="pi pi-times"
            className="p-button-raised p-button-outlined"
            onClick={onReset}
          />
        )}

        <Button
          label="Обновить всё"
          icon="pi pi-refresh"
          className="p-button-raised p-button-accent"
          onClick={onRefreshAll}
        />

        <Button
          label="Справка"
          icon="pi pi-question-circle"
          className="p-button-raised p-button-accent"
          onClick={onHelp}
          tooltip="Как работать с базой данных"
          tooltipOptions={{ position: 'bottom' }}
        />
      </div>

      {searchActive && (
        <div className="mt-2 text-sm">
          Прямых совпадений: <b>{directTotal}</b>
          {unionTotal > directTotal && searchUnionCounts && (
            <>
              {' · '}показано с контекстом: <b>{unionTotal}</b>{' '}
              <span className="text-500">
                (сущн. {searchUnionCounts.entities} / связи {searchUnionCounts.relations} /
                {' '}набл. {searchUnionCounts.observations} / ист. {searchUnionCounts.sources})
              </span>
            </>
          )}
        </div>
      )}
    </Panel>
  );
};