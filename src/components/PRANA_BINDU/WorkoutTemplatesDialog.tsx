// src/components/PRANA_BINDU/WorkoutTemplatesDialog.tsx
//
// Модалка с библиотекой шаблонов тренировок для ICU.
// Слева — список с фильтром по категории. Справа — текст + копирование.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import {
  WORKOUT_TEMPLATES,
  CATEGORY_LABELS,
  type WorkoutTemplate,
  type TemplateCategory,
} from '@/main/services/pranaBindu/mentat/workoutTemplates';
import { WorkoutTimeline, type TimelineStep } from './WorkoutTimeline';
import { parseWorkoutText } from '@/main/services/pranaBindu/mentat/workoutParser';
import { ExerciseCatalog } from './ExerciseCatalog';
import { WadeProgramsPanel } from './WadeProgramsPanel';
import { EquivalenceMapperPanel } from './EquivalenceMapperPanel';

interface Props {
  visible: boolean;
  onHide: () => void;
  initialMode?: 'templates' | 'catalog' | 'programs' | 'equivalences';
}

export const WorkoutTemplatesDialog: React.FC<Props> = ({
  visible,
  onHide,
  initialMode,
}) => {
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WorkoutTemplate | null>(null);
  const [copied, setCopied] = useState(false);

  const [mode, setMode] = useState<
    'templates' | 'catalog' | 'programs' | 'equivalences'
  >('templates');
  const [lastCopied, setLastCopied] = useState('');

  useEffect(() => {
    if (visible && initialMode) {
      setMode(initialMode);
    }
  }, [visible, initialMode]);

  const handleCatalogCopy = async (line: string) => {
    try {
      await navigator.clipboard.writeText(line);
      setLastCopied(line);
      setTimeout(() => setLastCopied(''), 2500);
    } catch {
      // ignore
    }
  };

  const categoryOptions = useMemo(() => {
    // Показываем только те категории, в которых есть хотя бы один шаблон.
    // Иначе пустые категории (например, 'strength-big6' — там пока
    // нет ни одного шаблона Wade Big-6) мусорят в фильтре.
    const present = new Set(WORKOUT_TEMPLATES.map((t) => t.category));
    return [
      { label: 'Все категории', value: 'all' as const },
      ...(Object.keys(CATEGORY_LABELS) as TemplateCategory[])
        .filter((c) => present.has(c))
        .map((c) => ({
          label: CATEGORY_LABELS[c],
          value: c,
        })),
    ];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WORKOUT_TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        t.text.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  const previewTimeline: TimelineStep[] = useMemo(() => {
    if (!selected) return [];
    const parsed = parseWorkoutText(selected.text);
    return parsed.flatSteps
      .filter((s) => s.durationSec != null || s.distanceM != null)
      .map((s, i) => {
        let durationSec = s.durationSec ?? 0;
        if (!durationSec && s.distanceM) {
          durationSec = Math.round(s.distanceM / 2.22);
        }
        if (!durationSec) durationSec = 60;
        return {
          label: s.label || `Шаг ${i + 1}`,
          durationSec,
          zone: s.zone,
        };
      });
  }, [selected]);

  const handleCopy = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <span className="p-dialog-title pb-templates__title">
          <i className="pi pi-book" /> Упражнения
        </span>
      }
      style={{ width: '960px', maxWidth: '96vw' }}
      modal
      maximizable
      className="pb-templates-dialog"
    >
      <div className="pb-templates__toolbar">
        <div className="pb-templates__mode-switch">
          <button
            type="button"
            className={mode === 'templates' ? 'is-active' : ''}
            onClick={() => setMode('templates')}
          >
            Шаблоны
          </button>
          <button
            type="button"
            className={mode === 'catalog' ? 'is-active' : ''}
            onClick={() => setMode('catalog')}
          >
            Каталог
          </button>
          <button
            type="button"
            className={mode === 'programs' ? 'is-active' : ''}
            onClick={() => setMode('programs')}
          >
            Программы
          </button>
          <button
            type="button"
            className={mode === 'equivalences' ? 'is-active' : ''}
            onClick={() => setMode('equivalences')}
          >
            Соответствия
          </button>
        </div>

        {mode === 'templates' && (
          <>
            <Dropdown
                value={category}
                options={categoryOptions}
                onChange={(e) => setCategory(e.value)}
                className="pb-templates__cat"
                panelClassName="pb-dropdown-panel"
              />
              <span className="pb-templates__search-wrap">
                <i className="pi pi-search" />
                <InputText
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по названию или тексту…"
                  className="pb-templates__search"
                />
              </span>
              <span className="pb-hint">
                {filtered.length} из {WORKOUT_TEMPLATES.length}
              </span>
          </>
        )}
      </div>

      {mode === 'templates' && (
        <div className="pb-templates__body">
          {/* Слева — список */}
          <div className="pb-templates__list">
            {filtered.length === 0 ? (
              <div className="pb-templates__empty">Ничего не найдено</div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`pb-templates__item ${
                    selected?.id === t.id ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setSelected(t);
                    setCopied(false);
                  }}
                >
                  <div className="pb-templates__item-name">{t.name}</div>
                  {t.description && (
                    <div className="pb-templates__item-desc">
                      {t.description}
                    </div>
                  )}
                  <div className="pb-templates__item-cat">
                    {CATEGORY_LABELS[t.category]}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Справа — текст */}
          <div className="pb-templates__preview">
            {!selected ? (
              <div className="pb-templates__empty">
                Выберите шаблон слева
              </div>
            ) : (
              <>
                {/* Заголовок с кнопкой */}
                <div className="pb-templates__preview-head">
                  <div className="pb-templates__preview-title-block">
                    <div className="pb-templates__preview-name">
                      {selected.name}
                      {selected.verified && (
                        <span
                          className="pb-templates__verified"
                          title="Шаблон проверен в конструкторе ICU"
                        >
                          <i className="pi pi-check" /> проверено
                        </span>
                      )}
                    </div>
                    {selected.description && (
                      <div className="pb-templates__preview-desc">
                        {selected.description}
                      </div>
                    )}
                  </div>
                  <Button
                    label={copied ? 'Скопировано' : 'Копировать'}
                    icon={copied ? 'pi pi-check' : 'pi pi-copy'}
                    className={copied ? 'pb p-button-sm' : 'pb-soft p-button-sm'}
                    onClick={handleCopy}
                  />
                </div>

                {/* Сам шаблон — самый крупный элемент */}
                <pre className="pb-templates__code">{selected.text}</pre>
                {previewTimeline.length > 0 && (
                  <div className="pb-templates__timeline">
                    <WorkoutTimeline steps={previewTimeline} height={90} />
                  </div>
                )}

                {/* Как использовать */}
                {selected.usage && (
                  <div className="pb-templates__usage">
                    <div className="pb-templates__usage-title">
                      <i className="pi pi-info-circle" /> Как использовать
                    </div>
                    <div className="pb-templates__usage-text">
                      {selected.usage
                        .split('\n')
                        .map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Message внизу */}
                <Message
                  severity="info"
                  className="w-full"
                  content={
                    <span>
                      Скопируйте текст и вставьте его в поле создания
                      тренировки в ICU: Calendar → Add workout →
                      текстовое поле.
                    </span>
                  }
                />
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'catalog' && (
        <div className="pb-catalog__body">
          <ExerciseCatalog onCopy={handleCatalogCopy} />
          {lastCopied && (
            <div className="pb-catalog__copied">
              <i className="pi pi-check" /> Скопировано: <code>{lastCopied}</code>
            </div>
          )}
        </div>
      )}

      {mode === 'programs' && (
        <div className="pb-catalog__body">
          <WadeProgramsPanel />
        </div>
      )}

      {mode === 'equivalences' && (
        <div className="pb-catalog__body">
          <EquivalenceMapperPanel />
        </div>
      )}

    </Dialog>
  );
};