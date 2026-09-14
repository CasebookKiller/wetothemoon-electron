// src/components/SIETCH/DetailFields.tsx

import React from 'react';

export interface DetailField {
  /** Подпись поля (например, «Тип», «Уверенность») */
  label: string;
  /** Значение. Может быть строкой, числом, JSX (ссылка, тег) */
  value: React.ReactNode;
  /**
   * Сколько колонок занимает поле:
   * - 1 (по умолчанию) — половина ширины (на десктопе)
   * - 2 — вся ширина
   * На мобильных всегда вся ширина.
   */
  span?: 1 | 2;
  /** Дополнительный CSS-класс для обёртки поля */
  className?: string;
}

export interface DetailFieldsProps {
  fields: DetailField[];
  /** Дополнительный класс контейнера */
  className?: string;
}

export const DetailFields: React.FC<DetailFieldsProps> = ({ fields, className }) => {
  return (
    <div className={`grid p-fluid ${className || ''}`}>
      {fields.map((field, index) => {
        const colClass = field.span === 2 ? 'col-12' : 'col-12 md:col-6';
        return (
          <div className={`${colClass} field`} key={`${field.label}-${index}`}>
            <label className="font-bold">{field.label}</label>
            <div>{field.value ?? <span className="text-500">—</span>}</div>
          </div>
        );
      })}
    </div>
  );
};