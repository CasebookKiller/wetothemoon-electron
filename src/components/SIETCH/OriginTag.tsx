// src/components/SIETCH/OriginTag.tsx

import React from 'react';
import { Tag } from 'primereact/tag';

export const OriginTag: React.FC<{ origin?: string | null }> = ({ origin }) => {
  const value = origin || 'scraper';
  const severity =
    value === 'manual' ? 'warning'
    : value === 'import' ? 'success'
    : 'info';
  const label =
    value === 'manual' ? 'вручную'
    : value === 'import' ? 'импорт'
    : 'авто';
  return <Tag value={label} severity={severity as any} />;
};