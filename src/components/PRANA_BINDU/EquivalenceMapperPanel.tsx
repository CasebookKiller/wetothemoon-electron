// src/components/PRANA_BINDU/EquivalenceMapperPanel.tsx
//
// Вкладка «Соответствия» внутри WorkoutTemplatesDialog.
// Пока единственный источник — Thenics (25 движений в сэмпле).
// Целевые каталоги — Wade / Cali / Runner / Core / Posture / Weightloss.
//
// Размечаем одно соответствие на одно Thenics-движение. Если связь
// уже есть — форма подставляет её, сохранение обновляет.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import {
  THENICS_CATALOG,
  findThenicsByKey,
  type ThenicsEntry,
  type ThenicsLevel,
} from '@/main/services/pranaBindu/mentat/thenicsCatalog';
import {
  PROGRESSIONS_CATALOG,
  findProgressionsByKey,
} from '@/main/services/pranaBindu/mentat/exerciseCatalog';

const LEVELS: ThenicsLevel[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Pro',
];

const LEVEL_LABELS: Record<ThenicsLevel, string> = {
  Beginner: 'Beginner',
  Intermediate: 'Intermediate',
  Advanced: 'Advanced',
  Pro: 'Pro',
};

/** Группы мышц, которые встречаются в THENICS_CATALOG. */
const MUSCLE_GROUPS = [
  'Arms',
  'Back',
  'Chest',
  'Abs',
  'Legs',
  'Shoulders',
];

const TARGET_CATEGORIES = [
  { label: 'Wade (Big-6)', value: 'wade' },
  { label: 'Cali', value: 'cali' },
  { label: 'Runner', value: 'runner' },
  { label: 'Core', value: 'core' },
  { label: 'Осанка', value: 'posture' },
  { label: 'Жиросжигание', value: 'weightloss' },
];

interface Equivalence {
  id: number;
  source: string;
  sourceKey: string;
  sourceLevel: string | null;
  target: string;
  targetKey: string;
  targetLevel: string | null;
  confidence: string;
  note: string | null;
}

interface Props {
  className?: string;
  /** Вызывается после успешного save/delete — чтобы родитель обновил счётчики. */
  onChanged?: () => void;
}

export const EquivalenceMapperPanel: React.FC<Props> = ({
  className,
  onChanged,
}) => {
  const api = (window as any).electronAPI;

  const [items, setItems] = useState<Equivalence[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);

  const [levelFilter, setLevelFilter] = useState<Set<ThenicsLevel>>(
    () => new Set()
  );
  const [muscleFilter, setMuscleFilter] = useState<Set<string>>(
    () => new Set()
  );

  const [targetCategory, setTargetCategory] = useState<string>('wade');
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [targetLevel, setTargetLevel] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = async () => {
    try {
      const res = await api.pb.listEquivalences();
      if (res?.success) setItems(res.items ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const mappedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const e of items) {
      if (e.source === 'thenics') s.add(e.sourceKey);
    }
    return s;
  }, [items]);

  const visibleList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THENICS_CATALOG.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (onlyUnmapped && mappedKeys.has(e.key)) return false;
      if (levelFilter.size > 0 && !levelFilter.has(e.level)) return false;
      if (muscleFilter.size > 0) {
        const muscles = e.muscles ?? [];
        const hit = muscles.some((m) => muscleFilter.has(m));
        if (!hit) return false;
      }
      return true;
    });
  }, [query, onlyUnmapped, mappedKeys, levelFilter, muscleFilter]);

  const selectedEntry: ThenicsEntry | undefined = selectedKey
    ? findThenicsByKey(selectedKey)
    : undefined;

  const targetProgressions = useMemo(
    () => PROGRESSIONS_CATALOG.filter((p) => p.category === targetCategory),
    [targetCategory]
  );

  const targetLevels = useMemo(() => {
    if (!targetKey) return [];
    return findProgressionsByKey(targetKey)?.levels ?? [];
  }, [targetKey]);

  // При выборе движения — подтягиваем существующую связь (если есть).
  useEffect(() => {
    if (!selectedEntry) return;
    setError('');
    setInfo('');
    const existing = items.find(
      (e) => e.source === 'thenics' && e.sourceKey === selectedEntry.key
    );
    if (existing) {
      setTargetCategory(existing.target);
      setTargetKey(existing.targetKey);
      setTargetLevel(
        existing.targetLevel != null ? Number(existing.targetLevel) : null
      );
      setNote(existing.note ?? '');
    } else {
      setTargetCategory('wade');
      setTargetKey(null);
      setTargetLevel(null);
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntry?.key]);

  const handleSave = async () => {
    if (!selectedEntry || !targetCategory || !targetKey) {
      setError('Выберите целевую категорию и прогрессию');
      return;
    }
    if (targetLevel == null) {
      setError('Выберите уровень');
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await api.pb.setEquivalence({
        source: 'thenics',
        sourceKey: selectedEntry.key,
        sourceLevel: selectedEntry.level,
        target: targetCategory,
        targetKey,
        targetLevel: String(targetLevel),
        confidence: 'manual',
        note: note.trim() || null,
      });
      if (res?.success) {
        setInfo(res.inserted ? 'Связь добавлена' : 'Связь обновлена');
        await load();
        onChanged?.();
      } else {
        setError(res?.error ?? 'Не удалось сохранить');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    const existing = items.find(
      (e) => e.source === 'thenics' && e.sourceKey === selectedEntry.key
    );
    if (!existing) {
      setError('Связь ещё не сохранена');
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await api.pb.deleteEquivalence(existing.id);
      if (res?.success) {
        setInfo('Связь удалена');
        setTargetKey(null);
        setTargetLevel(null);
        setNote('');
        await load();
        onChanged?.();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleLevel = (lvl: ThenicsLevel) => {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  const toggleMuscle = (m: string) => {
    setMuscleFilter((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const resetFilters = () => {
    setLevelFilter(new Set());
    setMuscleFilter(new Set());
    setQuery('');
    setOnlyUnmapped(false);
  };

  const hasActiveFilters =
    query.trim() !== '' ||
    onlyUnmapped ||
    levelFilter.size > 0 ||
    muscleFilter.size > 0;

  const targetProgLabel = targetKey
    ? findProgressionsByKey(targetKey)?.label ?? targetKey
    : '';
  const targetLvlLabel = targetLevel
    ? targetLevels.find((l) => l.level === targetLevel)?.name ?? ''
    : '';

  const totalMapped = mappedKeys.size;
  const totalCount = THENICS_CATALOG.length;

  return (
    <div className={`pb-equiv ${className ?? ''}`}>
      {/* Toolbar */}
      <div className="pb-equiv__toolbar">
        <span className="pb-hint">
          Источник: <b>Thenics</b> · {totalMapped} из {totalCount} размечено
        </span>
        <span className="pb-equiv__spacer" />
        <span className="pb-equiv__search-wrap">
          <i className="pi pi-search" />
          <InputText
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск…"
            className="pb-equiv__search"
          />
        </span>
        <label className="pb-check-row pb-checkbox-dark">
          <Checkbox
            inputId="pb-equiv-only-unmapped"
            checked={onlyUnmapped}
            onChange={(e) => setOnlyUnmapped(!!e.checked)}
          />
          <span>Только неразмеченные</span>
        </label>
        {hasActiveFilters && (
          <Button
            label="Сбросить"
            icon="pi pi-filter-slash"
            className="pb-soft p-button-sm pb-equiv__reset-btn"
            onClick={resetFilters}
            tooltip="Сбросить все фильтры"
          />
        )}
      </div>

      {/* Фильтры: уровни и мышцы */}
      <div className="pb-equiv__filters">
        <div className="pb-equiv__filter-row">
          <span className="pb-equiv__filter-label">Уровень:</span>
          {LEVELS.map((lvl) => {
            const on = levelFilter.has(lvl);
            return (
              <button
                key={lvl}
                type="button"
                className={`pb-equiv__filter-chip pb-equiv__filter-chip--${lvl.toLowerCase()}${
                  on ? ' is-on' : ''
                }`}
                onClick={() => toggleLevel(lvl)}
                title={on ? `Убрать ${lvl}` : `Только ${lvl}`}
              >
                {LEVEL_LABELS[lvl]}
              </button>
            );
          })}
        </div>
        <div className="pb-equiv__filter-row">
          <span className="pb-equiv__filter-label">Мышцы:</span>
          {MUSCLE_GROUPS.map((m) => {
            const on = muscleFilter.has(m);
            return (
              <button
                key={m}
                type="button"
                className={`pb-equiv__filter-chip${on ? ' is-on' : ''}`}
                onClick={() => toggleMuscle(m)}
                title={on ? `Убрать ${m}` : `Только ${m}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Split */}
      <div className="pb-equiv__body">
        <div className="pb-equiv__list">
          {visibleList.length === 0 ? (
            <div className="pb-templates__empty">Ничего не найдено</div>
          ) : (
            visibleList.map((e) => {
              const isMapped = mappedKeys.has(e.key);
              const isActive = selectedKey === e.key;
              return (
                <button
                  key={e.key}
                  type="button"
                  className={`pb-equiv__item ${isActive ? 'is-active' : ''}`}
                  onClick={() => setSelectedKey(e.key)}
                >
                  <div className="pb-equiv__item-body">
                    <div className="pb-equiv__item-name">
                      {e.name}
                      {e.nameRu && (
                        <span className="pb-equiv__item-name-ru"> · {e.nameRu}</span>
                      )}
                    </div>
                    <div className="pb-equiv__item-meta">
                      <span className={`pb-equiv__lvl pb-equiv__lvl--${e.level.toLowerCase()}`}>
                        {e.level}
                      </span>
                    </div>
                  </div>
                  {isMapped && (
                    <i
                      className="pi pi-check pb-equiv__check"
                      title="Размечено"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="pb-equiv__detail">
          {!selectedEntry ? (
            <div className="pb-templates__empty">
              Выберите движение слева
            </div>
          ) : (
            <>
              <div className="pb-equiv__title">
                {selectedEntry.name}
                {selectedEntry.nameRu && (
                  <span className="pb-equiv__title-ru"> · {selectedEntry.nameRu}</span>
                )}
              </div>
              <div className="pb-equiv__meta">
                <span className={`pb-equiv__lvl pb-equiv__lvl--${selectedEntry.level.toLowerCase()}`}>
                  {selectedEntry.level}
                </span>
                {selectedEntry.muscles && (
                  <span className="pb-hint">{selectedEntry.muscles.join(' · ')}</span>
                )}
              </div>

              <div className="pb-equiv__form">
                <div className="pb-equiv__row">
                  <label className="pb-equiv__row-label">Категория</label>
                  <Dropdown
                    value={targetCategory}
                    options={TARGET_CATEGORIES}
                    onChange={(e) => {
                      setTargetCategory(e.value);
                      setTargetKey(null);
                      setTargetLevel(null);
                    }}
                    className="pb-equiv__dd"
                    panelClassName="pb-dropdown-panel"
                  />
                </div>

                <div className="pb-equiv__row">
                  <label className="pb-equiv__row-label">Прогрессия</label>
                  <Dropdown
                    value={targetKey}
                    options={targetProgressions.map((p) => ({
                      label: `${p.label} (${p.icuName})`,
                      value: p.key,
                    }))}
                    onChange={(e) => {
                      setTargetKey(e.value);
                      setTargetLevel(null);
                    }}
                    placeholder="Выбрать"
                    className="pb-equiv__dd"
                    panelClassName="pb-dropdown-panel"
                  />
                </div>

                <div className="pb-equiv__row">
                  <label className="pb-equiv__row-label">Уровень</label>
                  <Dropdown
                    value={targetLevel}
                    options={targetLevels.map((l) => ({
                      label: `L${l.level} · ${l.name}${l.nameRu ? ` · ${l.nameRu}` : ''}`,
                      value: l.level,
                    }))}
                    onChange={(e) => setTargetLevel(e.value)}
                    placeholder="Выбрать"
                    disabled={!targetKey}
                    className="pb-equiv__dd"
                    panelClassName="pb-dropdown-panel"
                  />
                </div>

                <div className="pb-equiv__row pb-equiv__row--full">
                  <label className="pb-equiv__row-label">Заметка</label>
                  <InputTextarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Опционально"
                    rows={2}
                    autoResize
                    className="pb-equiv__note"
                  />
                </div>
              </div>

              {targetKey && targetLevel != null && (
                <div className="pb-equiv__preview">
                  <i className="pi pi-arrow-right" />{' '}
                  <b>{selectedEntry.name}</b>{' '}
                  <span className="pb-hint">({selectedEntry.level})</span> ≈{' '}
                  <b>{targetProgLabel} L{targetLevel}</b>{' '}
                  {targetLvlLabel && (
                    <span className="pb-hint">· {targetLvlLabel}</span>
                  )}
                </div>
              )}

              {error && (
                <Message severity="error" text={error} className="w-full" />
              )}
              {info && (
                <Message severity="success" text={info} className="w-full" />
              )}

              <div className="pb-equiv__actions">
                <Button
                  label={saving ? 'Сохранение…' : 'Сохранить связь'}
                  icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
                  className="pb p-button-sm"
                  onClick={handleSave}
                  disabled={saving || !targetKey || targetLevel == null}
                />
                {mappedKeys.has(selectedEntry.key) && (
                  <Button
                    label="Удалить связь"
                    icon="pi pi-trash"
                    className="pb-destructive-soft p-button-sm"
                    onClick={handleDelete}
                    disabled={saving}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};