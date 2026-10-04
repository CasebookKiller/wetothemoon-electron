// src/components/PRANA_BINDU/WorkoutTimeline.tsx
//
// Адаптивный таймлайн: вся тренировка растягивается/сжимается
// по ширине контейнера. Каждая колонка — пропорционально длительности.
// Вертикальный маркер под мышью, как в ICU.
// Глупый компонент.

import React, { useMemo, useState } from 'react';

export interface TimelineStep {
  label: string;
  durationSec: number;
  zone?: number;   // 1..7
}

interface Props {
  steps: TimelineStep[];
  height?: number;
  className?: string;
}

const ZONE_COLORS: Record<number, string> = {
  1: '#009e80',  // было '#009e00'  ← Z1 = teal (как в ICU)
  2: '#009e00',  // было '#009e80'  ← Z2 = green
  3: '#ffcb0e',
  4: '#ff7f0e',
  5: '#dd0447',
  6: '#6633cc',
  7: '#9933cc',
};

/** Высота колонки в % от общей: Z1 низкая, Z6/Z7 — почти полная. */
function zoneHeightPct(zone: number | undefined): number {
  if (!zone || zone < 1) return 30;
  const clamped = Math.min(zone, 7);
  return 25 + (clamped - 1) * 15;
}

function zoneColor(zone: number | undefined): string {
  if (!zone || zone < 1) return '#708499';
  return ZONE_COLORS[zone] ?? '#708499';
}

function fmtSec(s: number): string {
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}ч ${String(m).padStart(2, '0')}м`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${m}м`;
  }
  return `${s}с`;
}

export const WorkoutTimeline: React.FC<Props> = ({
  steps,
  height = 110,
  className,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(-1);

  const totalSec = useMemo(
    () => steps.reduce((s, x) => s + (x.durationSec || 0), 0),
    [steps]
  );

  if (steps.length === 0) {
    return (
      <div className={`pb-timeline pb-timeline--empty ${className ?? ''}`}>
        <span className="pb-hint">Нет шагов для отображения</span>
      </div>
    );
  }

  const hovered = hoverIdx != null ? steps[hoverIdx] : null;

  return (
    <div className={`pb-timeline ${className ?? ''}`}>
      <div className="pb-timeline__headline">
        {hovered ? (
          <span className="pb-timeline__hover-info">
            <b>{hovered.label}</b>
            <span className="pb-timeline__hover-sep">·</span>
            {fmtSec(hovered.durationSec)}
            {hovered.zone && (
              <>
                <span className="pb-timeline__hover-sep">·</span>
                <span
                  className="pb-timeline__zone-chip"
                  style={{ background: zoneColor(hovered.zone) }}
                >
                  Z{hovered.zone}
                </span>
              </>
            )}
          </span>
        ) : (
          <span className="pb-hint">
            всего {fmtSec(totalSec)} · {steps.length} шагов
          </span>
        )}
      </div>

      <div
        className="pb-timeline__track"
        style={{ height: `${height}px` }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverX(e.clientX - rect.left);
        }}
        onMouseLeave={() => {
          setHoverIdx(null);
          setHoverX(-1);
        }}
      >
        {steps.map((step, i) => {
          const w = step.durationSec || 1;
          const color = zoneColor(step.zone);
          const hPct = zoneHeightPct(step.zone);
          const isHovered = hoverIdx === i;
          return (
            <div
              key={i}
              className={`pb-timeline__step ${isHovered ? 'is-hovered' : ''}`}
              style={{ flex: `${w} 0 0` }}
              onMouseEnter={() => setHoverIdx(i)}
            >
              <div
                className="pb-timeline__bar"
                style={{ background: color, height: `${hPct}%` }}
              />
            </div>
          );
        })}

        {hoverX >= 0 && (
          <div
            className="pb-timeline__marker"
            style={{ left: `${hoverX}px` }}
          />
        )}
      </div>
    </div>
  );
};