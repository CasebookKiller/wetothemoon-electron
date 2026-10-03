// src/components/PRANA_BINDU/WorkoutTemplatesDialog.tsx
//
// Модалка с библиотекой шаблонов тренировок для ICU.
// Слева — список с фильтром по категории. Справа — текст + копирование.

import React, { useMemo, useState } from 'react';
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

interface Props {
  visible: boolean;
  onHide: () => void;
}

export const WorkoutTemplatesDialog: React.FC<Props> = ({
  visible,
  onHide,
}) => {
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WorkoutTemplate | null>(null);
  const [copied, setCopied] = useState(false);

  const categoryOptions = useMemo(
    () => [
      { label: 'Все категории', value: 'all' },
      ...(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((c) => ({
        label: CATEGORY_LABELS[c],
        value: c,
      })),
    ],
    []
  );

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
          <i className="pi pi-book" /> Библиотека шаблонов
        </span>
      }
      style={{ width: '960px', maxWidth: '96vw' }}
      modal
      maximizable
      className="pb-templates-dialog"
    >
      <div className="pb-templates__toolbar">
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
      </div>

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
    </Dialog>
  );
};