// src/components/SIETCH/DetailFields.tsx

import React from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';

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
  editType?: 'text' | 'textarea' | 'number' | 'dropdown';
  /** Опции для dropdown */
  editOptions?: { label: string; value: any }[];
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
                ? renderEditor(field, editForm, onEditChange)
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
  editForm?: Record<string, any> | null,
  onEditChange?: (key: string, value: any) => void
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