// src/components/COMMON/MiniTimeline/MiniTimeline.tsx
//
// Мини-версия WorkoutTimeline для встраивания в ячейки календарей.
// Props-only, без интерактива и тултипов. Те же цвета зон.

import React from 'react';
import './MiniTimeline.css';

export interface MiniTimelineStep {
  durationSec: number;
  zone?: number;
}

interface Props {
  steps: MiniTimelineStep[];
  /** Высота полосы в пикселях. Дефолт 14. */
  height?: number;
  className?: string;
}

const ZONE_COLORS: Record<number, string> = {
  1: '#009e80',
  2: '#009e00',
  3: '#ffcb0e',
  4: '#ff7f0e',
  5: '#dd0447',
  6: '#6633cc',
  7: '#9933cc',
};

export const MiniTimeline: React.FC<Props> = ({
  steps,
  height = 14,
  className,
}) => {
  if (steps.length === 0) {
    return (
      <div
        className={`common-mini-timeline common-mini-timeline--empty ${
          className ?? ''
        }`}
        style={{ height }}
      />
    );
  }

  const total =
    steps.reduce((s, x) => s + (x.durationSec || 0), 0) || 1;

  return (
    <div
      className={`common-mini-timeline ${className ?? ''}`}
      style={{ height }}
      role="img"
      aria-label={`Мини-таймлайн, ${steps.length} шагов`}
    >
      {steps.map((s, i) => {
        const color = s.zone
          ? ZONE_COLORS[s.zone] ?? '#708499'
          : '#708499';
        const w = (s.durationSec || 1) / total;
        const hPct = s.zone ? 45 + (Math.min(s.zone, 7) - 1) * 9 : 40;
        return (
          <div
            key={i}
            className="common-mini-timeline__step"
            style={{ flex: `${w} 0 0` }}
          >
            <div
              className="common-mini-timeline__bar"
              style={{
                background: color,
                height: `${Math.max(30, Math.min(100, hPct))}%`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};