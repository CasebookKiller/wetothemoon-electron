// src/components/SIETCH/DetailFields.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { AutoComplete } from 'primereact/autocomplete';
import { Calendar } from 'primereact/calendar';

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
  editable?: boolean;
  editKey?: string;
  editType?: 'text' | 'textarea' | 'number' | 'dropdown' | 'autocomplete' | 'date';
  editOptions?: { label: string; value: any }[];

  // === Дополнительно для autocomplete ===
  editPlaceholder?: string;
  editMinLength?: number;
  editMaxSuggestions?: number;
}

export interface DetailFieldsProps {
  fields: DetailField[];
  className?: string;
  editing?: boolean;
  editForm?: Record<string, any> | null;
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

/**
 * Локальный компонент для autocomplete.
 *
 * ВАЖНО: `suggestions` живёт ЗДЕСЬ, а не в родителе.
 * Иначе каждый keystroke вызывает ре-рендер DetailFields,
 * `value={selected}` обнуляется (пока ничего не выбрано),
 * и поле очищается.
 */
/**
 * Самописный autocomplete: InputText + выпадающий список.
 * Не используем PrimeReact AutoComplete — там нет inputValue до v11,
 * а value-объект конфликтует с редактированием строки.
 */
const AutoCompleteField: React.FC<{
  allOptions: { label: string; value: any }[];
  value: any;
  placeholder?: string;
  minLength?: number;
  maxSuggestions?: number;
  onChange: (v: any) => void;
}> = ({ allOptions, value, placeholder, maxSuggestions, onChange }) => {
  const [query, setQuery] = useState<string>('');
  const [open, setOpen] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Синхронизация внешнего value → строка в input
  useEffect(() => {
    const found = allOptions.find((o) => o.value === value);
    setQuery(found ? String(found.label) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Фильтрация: от любого вхождения в label, case-insensitive
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const limit = maxSuggestions ?? 50;
    if (!q) return allOptions.slice(0, limit);
    return allOptions
      .filter((o) => String(o.label).toLowerCase().includes(q))
      .slice(0, limit);
  }, [q, allOptions, maxSuggestions]);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <InputText
        value={query}
        placeholder={placeholder || 'Начните печатать...'}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          if (!v) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        className="w-full"
      />

      {open && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '240px',
            overflowY: 'auto',
            margin: 0,
            marginTop: '2px',
            padding: '0.25rem 0',
            listStyle: 'none',
            background: 'var(--tg-theme-secondary-bg-color, #fff)',
            border: '1px solid rgba(128,128,128,0.3)',
            borderRadius: '4px',
            zIndex: 1000,
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
          }}
        >
          {filtered.length === 0 && (
            <li
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.9rem',
                opacity: 0.6,
              }}
            >
              Ничего не найдено
            </li>
          )}
          {filtered.map((o: any) => (
            <li
              key={o.value}
              // onMouseDown с preventDefault — чтобы input не терял фокус
              // до того, как onClick сработает
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(String(o.label));
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                padding: '0.35rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  'rgba(0, 157, 234, 0.15)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Строка ISO YYYY-MM-DD → Date | null.
 * Пустое/невалидное значение → null (Calendar покажет пустое поле).
 */
function parseDateValue(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  // ISO-дата (YYYY-MM-DD) или ISO-datetime (YYYY-MM-DDTHH:MM...)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

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

    case 'autocomplete':
      return (
        <AutoCompleteField
          allOptions={field.editOptions || []}
          value={value}
          placeholder={field.editPlaceholder}
          minLength={field.editMinLength}
          maxSuggestions={field.editMaxSuggestions}
          onChange={change}
        />
      );

    case 'date':
    return (
      <Calendar
        value={parseDateValue(value)}
        onChange={(e) => {
          const d = e.value as Date | null;
          if (!d) {
            change(null);
            return;
          }
          // YYYY-MM-DD (локальная дата, без TZ-сдвигов)
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          change(`${yyyy}-${mm}-${dd}`);
        }}
        dateFormat="dd.mm.yy"
        showIcon
        showButtonBar
        placeholder="дд.мм.гг"
        className="w-full"
        inputClassName="w-full"
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