// src/components/PRANA_BINDU/PANELS/RunsPanel/RunsPanel.tsx
//
// Панель «Пробежки»: фильтры + таблица в двух видах (плоский / по дням).
// Логика загрузки данных и state фильтров — в родителе (PranaBinduPage).
// Здесь только UI и переключатель вида.

import React, { useState } from 'react';
import { Panel } from 'primereact/panel';
import { Message } from 'primereact/message';
import { RunFiltersPanel } from './RunFiltersPanel';
import { RunsTableFlat } from './RunsTableFlat';
import { RunsTableGrouped } from './RunsTableGrouped';
import type { RunsPanelProps, RunsViewMode } from './types';

import './RunsPanel.css';

const VIEW_MODE_KEY = 'pb.runsViewMode';

function loadViewMode(): RunsViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    return v === 'grouped' ? 'grouped' : 'flat';
  } catch {
    return 'flat';
  }
}

function saveViewMode(m: RunsViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, m);
  } catch {
    /* ignore */
  }
}

export const RunsPanel: React.FC<RunsPanelProps> = ({
  items,
  loading,
  error,
  filteredCount,
  totalCount,
  rawCount,
  filters,
  onFiltersChange,
  onResetFilters,
  activeFilterCount,
  onOpenFact,
}) => {
  const [viewMode, setViewMode] = useState<RunsViewMode>(() => loadViewMode());

  const changeMode = (m: RunsViewMode) => {
    setViewMode(m);
    saveViewMode(m);
  };

  const headerText =
    activeFilterCount > 0
      ? `Пробежки (${filteredCount} из ${totalCount})`
      : `Пробежки (${totalCount}${
          totalCount !== rawCount ? ` · ${rawCount} записей` : ''
        })`;

  return (
    <Panel header={headerText} className="shadow-5 mb-3 pb-panel">
      <div className="pb-runs-panel__toolbar">
        <RunFiltersPanel
          filters={filters}
          onChange={onFiltersChange}
          onReset={onResetFilters}
          activeCount={activeFilterCount}
        />
        <div
          className="pb-runs-view-switch"
          role="group"
          aria-label="Вид таблицы"
        >
          <button
            type="button"
            className={viewMode === 'flat' ? 'is-active' : ''}
            onClick={() => changeMode('flat')}
            title="Плоский — одна строка на группу источников"
          >
            <i className="pi pi-list" /> Список
          </button>
          <button
            type="button"
            className={viewMode === 'grouped' ? 'is-active' : ''}
            onClick={() => changeMode('grouped')}
            title="С группировкой по дням — заголовок дня"
          >
            <i className="pi pi-calendar" /> По дням
          </button>
        </div>
      </div>

      {error && (
        <Message severity="error" text={error} className="w-full mb-2" />
      )}

      {viewMode === 'flat' ? (
        <RunsTableFlat
          items={items}
          loading={loading}
          onOpenFact={onOpenFact}
        />
      ) : (
        <RunsTableGrouped
          items={items}
          loading={loading}
          onOpenFact={onOpenFact}
        />
      )}
    </Panel>
  );
};