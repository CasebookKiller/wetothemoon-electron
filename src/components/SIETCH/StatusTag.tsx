// src/components/SIETCH/StatusTag.tsx

import React from 'react';
import { Tag } from 'primereact/tag';

export interface StatusTagProps {
  status?: string | null;
}

/**
 * Цвета статусов записей.
 * Ключи — lowercase, потому что в БД они хранятся как 'confirmed', 'false' и т.д.
 */
const STATUS_COLORS: Record<string, string> = {
  confirmed:  '#22c55e',   // зелёный
  false:      '#ec3942',   // красный (destructive)
  hypothesis: '#e6a23c',   // оранжевый
  archived:   '#888888',   // серый
  unverified: '#3b82f6',   // синий (нейтральный)
};

const DEFAULT_COLOR = '#9ca3af'; // серый — для неизвестных статусов

export const StatusTag: React.FC<StatusTagProps> = ({ status }) => {
  const s = (status || '').trim();
  if (!s) return <span className="text-500">—</span>;

  const color = STATUS_COLORS[s.toLowerCase()] || DEFAULT_COLOR;

  return (
    <Tag
      value={s}
      style={{
        backgroundColor: 'transparent',
        color,
        border: `1px solid ${color}`,
        fontSize: '0.75rem',
        padding: '0.15rem 0.5rem',
        fontWeight: 500,
      }}
    />
  );
};