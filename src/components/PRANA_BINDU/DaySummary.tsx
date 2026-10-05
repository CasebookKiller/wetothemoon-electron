// src/components/PRANA_BINDU/DaySummary.tsx
//
// Компактная строка wellness за один день.
// Используется в шапке DayDrawer и в будущей ячейке FullWeek.

import React from 'react';

export interface RecoveryLogLite {
  date: string;
  resting_hr: number | null;
  hrv: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  steps: number | null;
  weight_kg: number | null;
  ctl: number | null;
  atl: number | null;
  stress_avg: number | null;
  auto_source: string | null;
}

interface Props {
  log: RecoveryLogLite | null;
  className?: string;
}

function fmtH(h: number | null): string {
  if (h == null) return '—';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}ч${String(mm).padStart(2, '0')}`;
}

function fmtInt(v: number | null): string {
  return v == null ? '—' : String(Math.round(v));
}

function fmtSteps(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export const DaySummary: React.FC<Props> = ({ log, className }) => {
  if (!log) {
    return (
      <div className={`pb-day-summary pb-day-summary--empty ${className ?? ''}`}>
        <span className="pb-hint">Нет данных wellness за этот день</span>
      </div>
    );
  }

  return (
    <div className={`pb-day-summary ${className ?? ''}`}>
      <span className="pb-day-summary__item">
        <i className="pi pi-moon" /> {fmtH(log.sleep_hours)}
      </span>
      {log.sleep_score != null && (
        <span className="pb-day-summary__item pb-day-summary__item--dim">
          score {fmtInt(log.sleep_score)}
        </span>
      )}
      <span className="pb-day-summary__item">
        <i className="pi pi-heart" /> {fmtInt(log.resting_hr)}
      </span>
      {log.hrv != null && (
        <span className="pb-day-summary__item pb-day-summary__item--dim">
          HRV {fmtInt(log.hrv)}
        </span>
      )}
      <span className="pb-day-summary__item">
        <i className="pi pi-chart-line" /> {fmtSteps(log.steps)}
      </span>
      {log.weight_kg != null && (
        <span className="pb-day-summary__item pb-day-summary__item--dim">
          {log.weight_kg.toFixed(1)} кг
        </span>
      )}
      {log.ctl != null && (
        <span className="pb-day-summary__item pb-day-summary__item--dim">
          CTL {log.ctl.toFixed(0)}
        </span>
      )}
      {log.atl != null && (
        <span className="pb-day-summary__item pb-day-summary__item--dim">
          ATL {log.atl.toFixed(0)}
        </span>
      )}
      {log.stress_avg != null && (
        <span className="pb-day-summary__item pb-day-summary__item--dim">
          stress {fmtInt(log.stress_avg)}
        </span>
      )}
    </div>
  );
};