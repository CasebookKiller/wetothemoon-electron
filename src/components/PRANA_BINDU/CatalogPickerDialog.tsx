// src/components/PRANA_BINDU/CatalogPickerDialog.tsx
//
// Выбор упражнений из каталога.
// Табы категорий + collapse прогрессий + глобальный поиск.
// Плоский список named внутри таба «Named» с подтабами.
// «Все» — все прогрессии (collapse) + все named.
//
// Избранное и «уже добавлено» — итерация 2.

import React, { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { AppDialog } from '@/components/COMMON/AppDialog/AppDialog';
import { AppDialogFooter } from '@/components/COMMON/AppDialog/AppDialogFooter';
import {
  PROGRESSIONS_CATALOG,
  NAMED_EXERCISES,
} from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import type {
  CatalogEntry,
  NamedExercise,
} from '@/main/services/pranaBindu/mentat/types';

export interface PickedExercise {
  movementKey: string;
  level?: number;
  label: string;
  isTimeBased: boolean;
}

interface Props {
  visible: boolean;
  onHide: () => void;
  onPick: (items: PickedExercise[]) => void;
}

// ==================== Табы ====================

type TabId =
  | 'wade'
  | 'cali'
  | 'runner'
  | 'core'
  | 'posture'
  | 'weightloss'
  | 'named'
  | 'all';

const TABS: { id: TabId; label: string }[] = [
  { id: 'wade', label: 'Wade' },
  { id: 'cali', label: 'Cali' },
  { id: 'runner', label: 'Runner' },
  { id: 'core', label: 'Core' },
  { id: 'posture', label: 'Осанка' },
  { id: 'weightloss', label: 'Жиросжигание' },
  { id: 'named', label: 'Named' },
  { id: 'all', label: 'Все' },
];

type NamedCategory = 'drill' | 'plyo' | 'warmup' | 'run-basic' | 'prehab';

const NAMED_CATEGORIES: { id: NamedCategory; label: string }[] = [
  { id: 'drill', label: 'Drills' },
  { id: 'plyo', label: 'Plyo' },
  { id: 'warmup', label: 'Warmup' },
  { id: 'run-basic', label: 'Run-basic' },
  { id: 'prehab', label: 'Prehab' },
];

// ==================== Утилиты ====================

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
}

function levelKey(progKey: string, level: number): string {
  return `progression:${progKey}:${level}`;
}

function namedKey(key: string): string {
  return `named:${key}`;
}

// ==================== Компонент ====================

export const CatalogPickerDialog: React.FC<Props> = ({
  visible,
  onHide,
  onPick,
}) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<TabId>('wade');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [namedSubTab, setNamedSubTab] = useState<NamedCategory>('drill');

  const resetState = () => {
    setSearch('');
    setSelected(new Set());
    setExpanded(new Set());
    setNamedSubTab('drill');
  };

  const handleClose = () => {
    resetState();
    onHide();
  };

  const progressionsByCategory = useMemo(() => {
    const map: Record<string, CatalogEntry[]> = {};
    for (const p of PROGRESSIONS_CATALOG) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, []);

  const namedByCategory = useMemo(() => {
    const map: Record<string, NamedExercise[]> = {};
    for (const n of NAMED_EXERCISES) {
      if (!map[n.category]) map[n.category] = [];
      map[n.category].push(n);
    }
    return map;
  }, []);

  // Глобальный поиск
  const searchResults = useMemo(() => {
    const q = normalize(search);
    if (!q) return null;

    const out: Array<{
      key: string;
      label: string;
      badge: string;
    }> = [];

    for (const p of PROGRESSIONS_CATALOG) {
      for (const lvl of p.levels) {
        const matches =
          normalize(p.label).includes(q) ||
          normalize(p.icuName).includes(q) ||
          normalize(lvl.name).includes(q) ||
          (lvl.nameRu ? normalize(lvl.nameRu).includes(q) : false) ||
          p.key.includes(q);
        if (!matches) continue;
        const prefix = p.category === 'wade' ? 'W' : 'L';
        out.push({
          key: levelKey(p.key, lvl.level),
          label: `${p.label} · ${lvl.nameRu ?? lvl.name}`,
          badge: `${prefix}${lvl.level}`,
        });
      }
    }

    for (const n of NAMED_EXERCISES) {
      const matches =
        normalize(n.label).includes(q) ||
        normalize(n.icuName).includes(q) ||
        (n.nameRu ? normalize(n.nameRu).includes(q) : false) ||
        n.key.includes(q);
      if (!matches) continue;
      out.push({
        key: namedKey(n.key),
        label: `${n.label}${n.nameRu ? ` · ${n.nameRu}` : ''}`,
        badge: n.category,
      });
    }

    return out;
  }, [search]);

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    const picked: PickedExercise[] = [];

    for (const p of PROGRESSIONS_CATALOG) {
      for (const lvl of p.levels) {
        const k = levelKey(p.key, lvl.level);
        if (!selected.has(k)) continue;
        const prefix = p.category === 'wade' ? 'W' : 'L';
        picked.push({
          movementKey: p.key,
          level: lvl.level,
          label: `${lvl.nameRu ?? lvl.name} ${prefix}${lvl.level}`,
          isTimeBased: (lvl.benchmarkLadder?.[0] ?? '').endsWith('s'),
        });
      }
    }

    for (const n of NAMED_EXERCISES) {
      const k = namedKey(n.key);
      if (!selected.has(k)) continue;
      picked.push({
        movementKey: n.key,
        label: n.label,
        isTimeBased: (n.defaultDuration ?? '').endsWith('s'),
      });
    }

    onPick(picked);
    resetState();
    onHide();
  };

  // Рендер одной плоской строки
  const renderRow = (key: string, label: string, badge: string) => {
    const isSelected = selected.has(key);
    return (
      <label
        key={key}
        className={`pb-catalog-picker__row ${isSelected ? 'is-selected' : ''}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelected(key)}
        />
        <span className="pb-catalog-picker__row-name">{label}</span>
        <span className="pb-catalog-picker__row-badge">{badge}</span>
      </label>
    );
  };

  // Рендер прогрессии с collapse
  const renderProgression = (p: CatalogEntry) => {
    const isOpen = expanded.has(p.key);
    const prefix = p.category === 'wade' ? 'W' : 'L';
    return (
      <div key={p.key} className="pb-catalog__progression">
        <button
          type="button"
          className={`pb-catalog__progression-head ${isOpen ? 'is-expanded' : ''}`}
          onClick={() => toggleExpanded(p.key)}
        >
          <i
            className={`pb-catalog__chev pi ${
              isOpen ? 'pi-chevron-down' : 'pi-chevron-right'
            }`}
          />
          <span className="pb-catalog__progression-name">{p.label}</span>
          <span className="pb-catalog__progression-icu">{p.icuName}</span>
          <span className="pb-catalog__progression-badge">
            {p.levels.length} ур.
          </span>
        </button>
        {isOpen && (
          <div className="pb-catalog__levels">
            {p.levels.map((lvl) => {
              const key = levelKey(p.key, lvl.level);
              const isSelected = selected.has(key);
              return (
                <label
                  key={key}
                  className={`pb-catalog-picker__level ${
                    isSelected ? 'is-selected' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(key)}
                  />
                  <span className="pb-catalog__level-code">
                    {prefix}
                    {lvl.level}
                  </span>
                  <span className="pb-catalog__level-name">{lvl.name}</span>
                  {lvl.nameRu && (
                    <span className="pb-catalog__level-hint">{lvl.nameRu}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    // Поиск
    if (searchResults !== null) {
      if (searchResults.length === 0) {
        return <div className="pb-hint">Ничего не найдено</div>;
      }
      return (
        <>
          <div className="pb-hint">Найдено: {searchResults.length}</div>
          <div className="pb-catalog-picker__list">
            {searchResults.map((r) => renderRow(r.key, r.label, r.badge))}
          </div>
        </>
      );
    }

    // Named
    if (tab === 'named') {
      const items = namedByCategory[namedSubTab] ?? [];
      return (
        <>
          <div className="pb-catalog__chips">
            {NAMED_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pb-catalog__chip ${
                  namedSubTab === c.id ? 'is-on' : ''
                }`}
                onClick={() => setNamedSubTab(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="pb-catalog-picker__list">
            {items.length === 0 ? (
              <div className="pb-hint">Нет элементов</div>
            ) : (
              items.map((n) =>
                renderRow(namedKey(n.key), n.label, n.category),
              )
            )}
          </div>
        </>
      );
    }

    // Все
    if (tab === 'all') {
      return (
        <>
          <div className="pb-catalog__section-title">Прогрессии</div>
          {PROGRESSIONS_CATALOG.map((p) => renderProgression(p))}
          <div
            className="pb-catalog__section-title"
            style={{ marginTop: '0.75rem' }}
          >
            Named
          </div>
          <div className="pb-catalog-picker__list">
            {NAMED_EXERCISES.map((n) =>
              renderRow(namedKey(n.key), n.label, n.category),
            )}
          </div>
        </>
      );
    }

    // Категория (Wade / Cali / Runner / Core / Posture / Weightloss)
    const progs = progressionsByCategory[tab] ?? [];
    if (progs.length === 0) {
      return (
        <div className="pb-hint">В этой категории пока нет прогрессий</div>
      );
    }
    return <>{progs.map((p) => renderProgression(p))}</>;
  };

  return (
    <AppDialog
      visible={visible}
      onHide={handleClose}
      title="Выбрать из каталога"
      titleIcon="pi-book"
      className="pb-create-dialog pb-catalog-picker"
      style={{ width: '680px', maxWidth: '96vw' }}
      modal
      dismissableMask
      closeOnEscape
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию, ключу, icuName..."
        className="pb-edge-form__select"
      />

      {searchResults === null && (
        <div className="pb-catalog__chips" style={{ marginTop: '0.5rem' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pb-catalog__chip ${tab === t.id ? 'is-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="pb-catalog-picker__content">{renderTabContent()}</div>

      <AppDialogFooter>
        <Button
          label="Отмена"
          className="pb-soft p-button-sm"
          onClick={handleClose}
        />
        <Button
          label={`Добавить (${selected.size})`}
          icon="pi pi-plus"
          className="pb p-button-sm"
          disabled={selected.size === 0}
          onClick={handleAdd}
        />
      </AppDialogFooter>
    </AppDialog>
  );
};