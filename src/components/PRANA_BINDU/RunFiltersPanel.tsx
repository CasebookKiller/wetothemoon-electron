// src/components/PRANA_BINDU/RunFiltersPanel.tsx
//
// Панель фильтров для таблицы пробежек.
// Глупый компонент: получает filters + onChange, ничего не знает
// про IPC и БД.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { RadioButton } from 'primereact/radiobutton';

export interface RunFilters {
  /** Строка поиска по названию (displayName + name в выбранных источниках). */
  nameQuery: string;
  /** Выбранные бейджи-источники. Пусто = фильтр не действует. */
  sources: string[];
  kmFrom: number | null;
  kmTo: number | null;
  hrFrom: number | null;
  hrTo: number | null;
  /** Темп в формате "M:SS". */
  paceFrom: string;
  paceTo: string;
  /** Длительность в минутах. */
  durFromMin: number | null;
  durToMin: number | null;
  streamsMode: 'all' | 'with' | 'without';
}

const SOURCE_BADGES = [
  { label: 'fit', value: 'fit' },
  { label: 'zepp', value: 'zepp' },
  { label: 'tcx', value: 'tcx' },
  { label: 'dodofo', value: 'dodofo' },
  { label: 'intervals-icu', value: 'intervals-icu' },
  { label: 'strava-csv', value: 'strava-csv' },
];

export const EMPTY_FILTERS: RunFilters = {
  nameQuery: '',
  sources: [],
  kmFrom: null,
  kmTo: null,
  hrFrom: null,
  hrTo: null,
  paceFrom: '',
  paceTo: '',
  durFromMin: null,
  durToMin: null,
  streamsMode: 'all',
};

interface Props {
  filters: RunFilters;
  onChange: (next: RunFilters) => void;
  onReset: () => void;
  activeCount: number;
  defaultExpanded?: boolean;
}

export const RunFiltersPanel: React.FC<Props> = ({
  filters,
  onChange,
  onReset,
  activeCount,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Локальное значение инпута поиска. Наверх (в filters.nameQuery)
  // уходит с задержкой, чтобы не пересчитывать filteredFacts
  // и не ререндерить таблицу на каждый keystroke.
  const [nameInput, setNameInput] = useState(filters.nameQuery);

  // Синхронизация снаружи (например, при onReset).
  useEffect(() => {
    if (filters.nameQuery !== nameInput) {
      setNameInput(filters.nameQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.nameQuery]);

  // Debounce: отдаём значение наверх через 300 мс тишины.
  useEffect(() => {
    if (nameInput === filters.nameQuery) return;
    const t = setTimeout(() => {
      onChange({ ...filters, nameQuery: nameInput });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput]);

  const upd = <K extends keyof RunFilters>(key: K, value: RunFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleSource = (v: string) => {
    const has = filters.sources.includes(v);
    upd(
      'sources',
      has ? filters.sources.filter((x) => x !== v) : [...filters.sources, v]
    );
  };

  return (
    <div className="pb-run-filters">
      <div className="pb-run-filters__bar">
        <Button
          label={`Фильтры${activeCount > 0 ? ` (${activeCount})` : ''}`}
          icon={expanded ? 'pi pi-chevron-up' : 'pi pi-filter'}
          className={activeCount > 0 ? 'pb p-button-sm' : 'pb-soft p-button-sm'}
          onClick={() => setExpanded((x) => !x)}
        />
        {activeCount > 0 && (
          <Button
            label="Сбросить"
            icon="pi pi-filter-slash"
            className="pb-soft p-button-sm"
            onClick={onReset}
          />
        )}
      </div>

      {expanded && (
        <div className="pb-run-filters__body">
          {/* Поиск + чипы-источники */}
          <div className="pb-run-filters__row">
            <label className="pb-label">Поиск по названию</label>
            <span className="pb-run-filters__search-wrap">
              <i className="pi pi-search" />
              <InputText
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Утренний, длинная, 1047…"
                className="pb-run-filters__search"
              />
            </span>
            <div className="pb-run-filters__chips-row">
              <span className="pb-hint">Источники:</span>
              {SOURCE_BADGES.map((b) => {
                const on = filters.sources.includes(b.value);
                return (
                  <button
                    key={b.value}
                    type="button"
                    className={`pb-run-filters__chip ${on ? 'is-on' : ''}`}
                    onClick={() => toggleSource(b.value)}
                    title={
                      on
                        ? `Убрать фильтр по «${b.label}»`
                        : `Показывать только «${b.label}»`
                    }
                  >
                    <span
                      className={`pb-source-badge pb-source-badge--${b.value}`}
                    >
                      {b.label}
                    </span>
                    {on && <i className="pi pi-check" />}
                  </button>
                );
              })}
              {filters.sources.length > 0 && (
                <button
                  type="button"
                  className="pb-run-filters__chip-clear"
                  onClick={() => upd('sources', [])}
                  title="Снять все источники"
                >
                  <i className="pi pi-times" />
                </button>
              )}
            </div>
          </div>

          {/* Числовые диапазоны */}
          <div className="pb-run-filters__grid">
            <div className="pb-run-filters__range">
              <label className="pb-label">Км</label>
              <div className="flex align-items-center gap-1">
                <InputNumber
                  value={filters.kmFrom}
                  onValueChange={(e) => upd('kmFrom', e.value ?? null)}
                  placeholder="от"
                  minFractionDigits={1}
                  maxFractionDigits={2}
                  min={0}
                  className="pb-run-filters__num"
                />
                <span className="pb-hint">—</span>
                <InputNumber
                  value={filters.kmTo}
                  onValueChange={(e) => upd('kmTo', e.value ?? null)}
                  placeholder="до"
                  minFractionDigits={1}
                  maxFractionDigits={2}
                  min={0}
                  className="pb-run-filters__num"
                />
              </div>
            </div>

            <div className="pb-run-filters__range">
              <label className="pb-label">Ср. пульс</label>
              <div className="flex align-items-center gap-1">
                <InputNumber
                  value={filters.hrFrom}
                  onValueChange={(e) => upd('hrFrom', e.value ?? null)}
                  placeholder="от"
                  min={0}
                  className="pb-run-filters__num"
                />
                <span className="pb-hint">—</span>
                <InputNumber
                  value={filters.hrTo}
                  onValueChange={(e) => upd('hrTo', e.value ?? null)}
                  placeholder="до"
                  min={0}
                  className="pb-run-filters__num"
                />
              </div>
            </div>

            <div className="pb-run-filters__range">
              <label className="pb-label">Темп (M:SS)</label>
              <div className="flex align-items-center gap-1">
                <InputText
                  value={filters.paceFrom}
                  onChange={(e) => upd('paceFrom', e.target.value)}
                  placeholder="5:00"
                  className="pb-run-filters__pace"
                />
                <span className="pb-hint">—</span>
                <InputText
                  value={filters.paceTo}
                  onChange={(e) => upd('paceTo', e.target.value)}
                  placeholder="9:00"
                  className="pb-run-filters__pace"
                />
              </div>
            </div>

            <div className="pb-run-filters__range">
              <label className="pb-label">Длительность (мин)</label>
              <div className="flex align-items-center gap-1">
                <InputNumber
                  value={filters.durFromMin}
                  onValueChange={(e) => upd('durFromMin', e.value ?? null)}
                  placeholder="от"
                  min={0}
                  className="pb-run-filters__num"
                />
                <span className="pb-hint">—</span>
                <InputNumber
                  value={filters.durToMin}
                  onValueChange={(e) => upd('durToMin', e.value ?? null)}
                  placeholder="до"
                  min={0}
                  className="pb-run-filters__num"
                />
              </div>
            </div>
          </div>

          {/* Потоки */}
          <div className="pb-run-filters__row">
            <label className="pb-label">Потоки</label>
            <div className="pb-run-filters__radio-row">
              {[
                { v: 'all', label: 'Все' },
                { v: 'with', label: 'Только с потоками' },
                { v: 'without', label: 'Только без потоков' },
              ].map((o) => (
                <label key={o.v} className="pb-run-filters__radio">
                  <RadioButton
                    inputId={`streams-${o.v}`}
                    name="streamsMode"
                    value={o.v}
                    checked={filters.streamsMode === o.v}
                    onChange={() =>
                      upd('streamsMode', o.v as RunFilters['streamsMode'])
                    }
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};