// src/components/PRANA_BINDU/ExerciseGraph/FiltersBar.tsx

import React from 'react';
import { InputText } from 'primereact/inputtext';
import { InputSwitch } from 'primereact/inputswitch';
import type { Filters } from './types';

export type LayoutMode = 'linear' | 'radial';

interface PatternLite {
  key: string;
  label: string;
  labelRu?: string;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  totalCount: number;
  visibleCount: number;
  layoutMode: LayoutMode;
  onLayoutModeChange: (m: LayoutMode) => void;
  /** Паттерны из графа (приходят как узлы kind='pattern'). */
  patterns: PatternLite[];
  onSave?: () => void;
  onReset?: () => void;
  onRefresh?: () => void;
  sideOpen?: boolean;
  onToggleSide?: () => void;
  onOpenCreate?: (kind: 'pattern' | 'canonical' | 'exercise') => void;
}

export const FiltersBar: React.FC<Props> = ({
  filters,
  onChange,
  totalCount,
  visibleCount,
  layoutMode,
  onLayoutModeChange,
  patterns,
  onSave,
  onReset,
  onRefresh,
  sideOpen,
  onToggleSide,
  onOpenCreate,
}) => {
  const togglePattern = (key: string): void => {
    const next = new Set(filters.patterns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...filters, patterns: next });
  };

  return (
    <div className="pb-graph-view__filters">
      {/* Строка 1: поиск, тумблеры, режим */}
      <div className="pb-graph-view__toolbar">
        <span className="pb-templates__search-wrap">
          <i className="pi pi-search" />
          <InputText
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Поиск по названию"
            className="pb-templates__search"
          />
        </span>

        <label className="pb-graph-view__filter-toggle">
          <InputSwitch
            className="pb-graph-toggle"
            checked={filters.showConcrete}
            onChange={(e) => onChange({ ...filters, showConcrete: !!e.value })}
          />
          <span>Уровни</span>
        </label>

        <label className="pb-graph-view__filter-toggle">
          <InputSwitch
            className="pb-graph-toggle"
            checked={filters.showNamed}
            onChange={(e) => onChange({ ...filters, showNamed: !!e.value })}
          />
          <span>Named</span>
        </label>

        <label className="pb-graph-view__filter-toggle">
          <InputSwitch
            className="pb-graph-toggle"
            checked={filters.showThenics}
            onChange={(e) => onChange({ ...filters, showThenics: !!e.value })}
          />
          <span>Thenics</span>
        </label>

        <label className="pb-graph-view__filter-toggle">
          <InputSwitch
            className="pb-graph-toggle"
            checked={filters.onlyWithProgression}
            onChange={(e) =>
              onChange({ ...filters, onlyWithProgression: !!e.value })
            }
          />
          <span>Только прогрессии</span>
        </label>

        <div
          className="pb-runs-view-switch"
          role="group"
          aria-label="Режим раскладки"
        >
          <button
            type="button"
            className={layoutMode === 'linear' ? 'is-active' : ''}
            onClick={() => onLayoutModeChange('linear')}
            title="Линейная раскладка (dagre)"
          >
            <i className="pi pi-align-left" /> Слои
          </button>
          <button
            type="button"
            className={layoutMode === 'radial' ? 'is-active' : ''}
            onClick={() => onLayoutModeChange('radial')}
            title="Радиальная раскладка"
          >
            <i className="pi pi-circle" /> Круг
          </button>
        </div>

        <button
          type="button"
          className="pb-graph-chip"
          onClick={onRefresh}
          title="Перезагрузить граф"
        >
          <i className="pi pi-refresh" />
        </button>
        <button
          type="button"
          className="pb-graph-chip"
          onClick={onReset}
          title="Сбросить к эталону (удалить user.json)"
        >
          <i className="pi pi-undo" />
        </button>

        <button
          type="button"
          className="pb-graph-chip"
          onClick={() => onOpenCreate?.('pattern')}
          title="Добавить паттерн (семью)"
        >
          <i className="pi pi-plus" /> Паттерн
        </button>
        <button
          type="button"
          className="pb-graph-chip"
          onClick={() => onOpenCreate?.('canonical')}
          title="Добавить группу (canonical)"
        >
          <i className="pi pi-plus" /> Группа
        </button>
        <button
          type="button"
          className="pb-graph-chip"
          onClick={() => onOpenCreate?.('exercise')}
          title="Добавить упражнение"
        >
          <i className="pi pi-plus" /> Упражнение
        </button>

        <button
          type="button"
          className="pb-graph-chip"
          onClick={onToggleSide}
          title={sideOpen ? 'Скрыть панель' : 'Показать панель'}
        >
          <i className={sideOpen ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'} />
        </button>
        <span className="pb-graph-view__count pb-hint">
          {visibleCount} / {totalCount}
        </span>
      </div>

      {/* Строка 2: чипы паттернов — из графа */}
      <div className="pb-graph-view__pattern-chips">
        <button
          type="button"
          className={`pb-graph-chip ${
            filters.patterns.size === 0 ? 'is-on' : ''
          }`}
          onClick={() => onChange({ ...filters, patterns: new Set() })}
          title="Показать все паттерны"
        >
          Все
        </button>
        {patterns.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`pb-graph-chip ${
              filters.patterns.has(p.key) ? 'is-on' : ''
            }`}
            onClick={() => togglePattern(p.key)}
            title={`${p.labelRu ?? p.label} · ${p.key}`}
          >
            {p.labelRu ?? p.label}
          </button>
        ))}
      </div>
    </div>
  );
};