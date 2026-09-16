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

  type: string;
  onTypeChange: (value: string) => void;
  typeOptions: { label: string; value: string }[];

  loading: boolean;
  searchActive: boolean;
  resultCount: number;

  onSearch: () => void;
  onReset: () => void;
  onRefreshAll: () => void;
  onHelp: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  query,
  onQueryChange,
  onKeyDown,
  type,
  onTypeChange,
  typeOptions,
  loading,
  searchActive,
  resultCount,
  onSearch,
  onReset,
  onRefreshAll,
  onHelp,
}) => (
  <Panel className="shadow-5 mb-3" header="Поиск по сущностям">
    <div className="flex flex-wrap align-items-center gap-3 py-2">
      <div className="flex-1" style={{ minWidth: '240px' }}>
        <span className="p-input-icon-left w-full search-input-with-icon">
          <i className="pi pi-search" />
          <InputText
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Название, ИНН, ФИО и т.п."
            className="w-full text-base"
          />
        </span>
      </div>

      <div style={{ minWidth: '180px' }}>
        <Dropdown
          value={type}
          options={typeOptions}
          onChange={(e) => onTypeChange(e.value)}
          placeholder="Тип сущности"
          className="w-full"
        />
      </div>

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
        Найдено: <b>{resultCount}</b> записей
      </div>
    )}
  </Panel>
);