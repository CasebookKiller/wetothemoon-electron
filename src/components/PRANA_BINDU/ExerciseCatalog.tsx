// src/components/PRANA_BINDU/ExerciseCatalog.tsx
//
// Каталог упражнений: прогрессии W1..W10 / L1..L10 и именованные
// упражнения без уровней (СБУ, плио, разминка). Клик по [→]
// копирует готовую cue-строку для ICU.

import React, { useMemo, useState } from 'react';
import {
  PROGRESSIONS_CATALOG,
  NAMED_EXERCISES,
  levelToZone,
} from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import type {
  CatalogEntry,
  NamedExercise,
  NamedExerciseCategory,
  ExerciseCategory,
} from '@/main/services/pranaBindu/mentat/types';

interface Props {
  onCopy: (line: string) => void;
  className?: string;
}

type FilterKey = 'all' | ExerciseCategory | NamedExerciseCategory;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'wade', label: 'Wade' },
  { key: 'cali', label: 'Cali' },
  { key: 'runner', label: 'Runner' },
  { key: 'core', label: 'Кор' },
  { key: 'posture', label: 'Осанка' },
  { key: 'weightloss', label: 'HIIT' },
  { key: 'drill', label: 'СБУ' },
  { key: 'plyo', label: 'Plyo' },
  { key: 'warmup', label: 'Warmup' },
  { key: 'run-basic', label: 'Run-basic' },
];

const DEFAULT_PROGRESSION_DURATION = '30s';

const ZONE_COLORS: Record<number, string> = {
  1: '#009e80',
  2: '#009e00',
  3: '#ffcb0e',
  4: '#ff7f0e',
  5: '#dd0447',
  6: '#6633cc',
  7: '#9933cc',
};

function zoneBg(z: number): string {
  return ZONE_COLORS[z] ?? '#708499';
}

function progressionPrefix(cat: ExerciseCategory): 'W' | 'L' {
  return cat === 'wade' ? 'W' : 'L';
}

function buildProgressionLine(entry: CatalogEntry, level: number): string {
  const prefix = progressionPrefix(entry.category);
  const zone = levelToZone(level);
  return `- ${entry.icuName} ${prefix}${level} ${DEFAULT_PROGRESSION_DURATION} Z${zone} Pace`;
}

function buildNamedLine(ex: NamedExercise): string {
  const dur = ex.defaultDuration ?? '30s';
  const zone = ex.defaultZone ?? 1;
  return `- ${ex.icuName} ${dur} Z${zone} Pace`;
}

export const ExerciseCatalog: React.FC<Props> = ({ onCopy, className }) => {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const PROGRESSION_CATEGORIES = new Set([
    'wade', 'cali', 'runner', 'core', 'posture', 'weightloss',
  ]);

  const filteredProgressions = useMemo(() => {
    if (filter === 'all') return PROGRESSIONS_CATALOG;
    if (PROGRESSION_CATEGORIES.has(filter)) {
      return PROGRESSIONS_CATALOG.filter((e) => e.category === filter);
    }
    return [];
  }, [filter]);

  const filteredNamed = useMemo(() => {
    if (filter === 'all') return NAMED_EXERCISES;
    return NAMED_EXERCISES.filter((e) => e.category === filter);
  }, [filter]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={`pb-catalog ${className ?? ''}`}>
      <div className="pb-catalog__chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`pb-catalog__chip ${filter === f.key ? 'is-on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredProgressions.length > 0 && (
        <div className="pb-catalog__section">
          <div className="pb-catalog__section-title">
            Прогрессии (W1..W10 · L1..L10)
          </div>
          {filteredProgressions.map((entry) => {
            const isExpanded = expanded.has(entry.key);
            const prefix = progressionPrefix(entry.category);
            return (
              <div key={entry.key} className="pb-catalog__progression">
                <button
                  type="button"
                  className={`pb-catalog__progression-head ${
                    isExpanded ? 'is-expanded' : ''
                  }`}
                  onClick={() => toggle(entry.key)}
                >
                  <i
                    className={`pi ${
                      isExpanded ? 'pi-chevron-down' : 'pi-chevron-right'
                    } pb-catalog__chev`}
                  />
                  <span className="pb-catalog__progression-name">
                    {entry.label}
                  </span>
                  <span className="pb-catalog__progression-icu">
                    ({entry.icuName})
                  </span>
                  <span className="pb-catalog__progression-badge">
                    {prefix}1..{prefix}10
                  </span>
                </button>
                {isExpanded && (
                  <div className="pb-catalog__levels">
                    {entry.levels.map((lvl) => {
                      const line = buildProgressionLine(entry, lvl.level);
                      const zone = levelToZone(lvl.level);
                      return (
                        <div key={lvl.level} className="pb-catalog__level">
                          <span className="pb-catalog__level-code">
                            {prefix}
                            {lvl.level}
                          </span>
                          <span className="pb-catalog__level-name">
                            {lvl.name}
                          </span>
                          {lvl.hint && (
                            <span className="pb-catalog__level-hint">
                              {lvl.hint}
                            </span>
                          )}
                          <span
                            className="pb-catalog__level-zone"
                            style={{ background: zoneBg(zone) }}
                          >
                            Z{zone}
                          </span>
                          <button
                            type="button"
                            className="pb-catalog__copy-btn"
                            onClick={() => onCopy(line)}
                            title={`Копировать: ${line}`}
                          >
                            <i className="pi pi-arrow-right" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filteredNamed.length > 0 && (
        <div className="pb-catalog__section">
          <div className="pb-catalog__section-title">
            Упражнения без уровней
          </div>
          <div className="pb-catalog__named-list">
            {filteredNamed.map((ex) => {
              const line = buildNamedLine(ex);
              return (
                <div key={ex.key} className="pb-catalog__named-row">
                  <span className="pb-catalog__named-name">{ex.label}</span>
                  <span className="pb-catalog__named-meta">
                    {ex.defaultDuration} · Z{ex.defaultZone ?? 1}
                  </span>
                  {ex.hint && (
                    <span className="pb-catalog__named-hint">{ex.hint}</span>
                  )}
                  <button
                    type="button"
                    className="pb-catalog__copy-btn"
                    onClick={() => onCopy(line)}
                    title={`Копировать: ${line}`}
                  >
                    <i className="pi pi-arrow-right" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};