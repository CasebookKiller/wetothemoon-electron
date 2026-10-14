// src/components/PRANA_BINDU/ExerciseGraph/EdgeLegend.tsx

import React from 'react';

const ITEMS: Array<{
  label: string;
  stroke: string;
  dash?: string;
  width?: number;
}> = [
  { label: '← вход   ·   выход →', stroke: '#708499', width: 3 },
  { label: 'Прогрессия',        stroke: '#4aa8ff', width: 2 },
  { label: 'Тех. усложнение',   stroke: '#4aa8ff', dash: '4 3', width: 1.5 },
  { label: 'Используется в',    stroke: 'rgba(120, 160, 220, 0.85)', dash: '3 4', width: 1.4 },
  { label: 'Эквивалент',        stroke: '#d4a373', dash: '4 4', width: 1.5 },
  { label: 'Требует',           stroke: '#ec5b5b', width: 1.5 },
  { label: 'Тренирует ткань',   stroke: '#6fbf73', width: 1.5 },
  { label: 'Учит навыку',       stroke: '#26c6da', width: 1.5 },
  { label: 'Разогревает',       stroke: '#e8a838', width: 1.5 },
];

export const EdgeLegend: React.FC = () => (
  <div className="pb-graph-view__legend">
    {ITEMS.map((it) => (
      <div key={it.label} className="pb-graph-view__legend-row">
        <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden="true">
          <line
            x1="0"
            y1="4"
            x2="24"
            y2="4"
            stroke={it.stroke}
            strokeWidth={it.width ?? 1}
            strokeDasharray={it.dash}
            strokeLinecap="round"
          />
        </svg>
        <span>{it.label}</span>
      </div>
    ))}
  </div>
);