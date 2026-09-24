// src/components/SIETCH/DetailFields.tsx

import React, { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { AutoComplete } from 'primereact/autocomplete';

export interface DetailField {
  /** Подпись поля */
  label: string;
  /** Значение (для режима просмотра) */
  value: React.ReactNode;
  /** Колонки: 1 — половина, 2 — вся ширина */
  span?: 1 | 2;
  /** Дополнительный CSS-класс обёртки */
  className?: string;

  // === Для режима редактирования ===
  /** Можно ли редактировать это поле */
  editable?: boolean;
  /** Ключ поля в editForm */
  editKey?: string;
  /** Тип редактора */
  editType?: 'text' | 'textarea' | 'number' | 'dropdown' | 'autocomplete';
  /** Опции для dropdown / autocomplete */
  editOptions?: { label: string; value: any }[];

  // === Дополнительно для autocomplete ===
  /** Placeholder (autocomplete) */
  editPlaceholder?: string;
  /** Минимальная длина запроса для autocomplete (по умолчанию 0) */
  editMinLength?: number;
  /** Максимум suggestions (по умолчанию 100) */
  editMaxSuggestions?: number;
}

export interface DetailFieldsProps {
  fields: DetailField[];
  className?: string;

  /** Режим редактирования */
  editing?: boolean;
  /** Объект формы: { [editKey]: value } */
  editForm?: Record<string, any> | null;
  /** Колбэк при изменении поля */
  onEditChange?: (key: string, value: any) => void;
}

export const DetailFields: React.FC<DetailFieldsProps> = ({
  fields,
  className,
  editing = false,
  editForm,
  onEditChange,
}) => {
  // Кеш suggestions для autocomplete-полей: editKey → отфильтрованный список.
  // Одно состояние на все autocomplete-поля, ключ — editKey.
  const [suggestions, setSuggestions] = useState<
    Record<string, { label: string; value: any }[]>
  >({});

  const searchOptions = (field: DetailField, query: string) => {
    const key = field.editKey ?? '';
    const all = field.editOptions ?? [];
    const q = (query || '').trim().toLowerCase();
    const filtered = q
      ? all.filter((o) => String(o.label).toLowerCase().includes(q))
      : all;
    const max = field.editMaxSuggestions ?? 100;
    setSuggestions((prev) => ({ ...prev, [key]: filtered.slice(0, max) }));
  };

  return (
    <div className={`grid p-fluid detail-fields ${className || ''}`}>
      {fields.map((field, index) => {
        const colClass = field.span === 2 ? 'col-12' : 'col-12 md:col-6';
        const isEditable = editing && field.editable && !!field.editKey;

        return (
          <div
            className={`${colClass} field detail-field ${field.className || ''}`}
            key={`${field.label}-${index}`}
          >
            <label className="font-bold">{field.label}</label>
            <div className="detail-field__content">
              {isEditable
                ? renderEditor(
                    field,
                    editForm,
                    onEditChange,
                    field.editKey ? suggestions[field.editKey] : undefined,
                    searchOptions
                  )
                : (field.value ?? <span className="text-500">—</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function renderEditor(
  field: DetailField,
  editForm: Record<string, any> | null | undefined,
  onEditChange: ((key: string, value: any) => void) | undefined,
  suggestions: { label: string; value: any }[] | undefined,
  searchOptions: (field: DetailField, query: string) => void
): React.ReactNode {
  const key = field.editKey!;
  const value = editForm?.[key];
  const change = (v: any) => onEditChange?.(key, v);

  switch (field.editType) {
    case 'textarea':
      return (
        <InputTextarea
          value={String(value ?? '')}
          onChange={(e) => change(e.target.value)}
          rows={3}
          autoResize
          className="w-full"
        />
      );

    case 'number':
      return (
        <InputText
          type="number"
          value={String(value ?? 0)}
          onChange={(e) => {
            const num = parseInt(e.target.value);
            change(Number.isNaN(num) ? 0 : num);
          }}
          className="w-full"
        />
      );

    case 'dropdown':
      return (
        <Dropdown
          value={value}
          options={field.editOptions || []}
          onChange={(e) => change(e.value)}
          className="w-full"
        />
      );

    case 'autocomplete': {
      const allOptions = field.editOptions || [];
      const selected = allOptions.find((o) => o.value === value) || null;

      return (
        <AutoComplete
          value={selected}
          suggestions={suggestions || []}
          completeMethod={(e) => searchOptions(field, e.query)}
          field="label"
          dropdown
          forceSelection
          minLength={field.editMinLength ?? 0}
          placeholder={field.editPlaceholder || 'Начните печатать...'}
          onChange={(e) => {
            const v = e.value;
            if (v && typeof v === 'object' && 'value' in v) {
              change(v.value);
            } else if (v === null || v === '') {
              change(null);
            }
          }}
          className="w-full"
          inputClassName="w-full"
        />
      );
    }

    case 'text':
    default:
      return (
        <InputText
          value={String(value ?? '')}
          onChange={(e) => change(e.target.value)}
          className="w-full"
        />
      );
  }
}