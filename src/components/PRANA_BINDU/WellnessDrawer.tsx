// src/components/PRANA_BINDU/WellnessDrawer.tsx
//
// Drawer с полной карточкой дня из recovery_logs.
// Секции: Сон / Сердце / Нагрузка / Тело / Самочувствие.
// Пустые секции скрываются.

import React from 'react';
import { Sidebar } from 'primereact/sidebar';

export interface RecoveryLogLite {
  date: string;
  resting_hr: number | null;
  hrv: number | null;
  hrv_sdnn: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  sleep_quality: number | null;
  sleep_total_min: number | null;
  deep_min: number | null;
  rem_min: number | null;
  light_min: number | null;
  awake_min: number | null;
  steps: number | null;
  weight_kg: number | null;
  vo2max: number | null;
  body_battery_charged: number | null;
  body_battery_drained: number | null;
  stress_avg: number | null;
  auto_source: string | null;
  ctl: number | null;
  atl: number | null;
  ramp_rate: number | null;
  readiness: number | null;
  soreness: number | null;
  fatigue: number | null;
  stress: number | null;
  mood: number | null;
  motivation: number | null;
  injury: number | null;
  avg_sleeping_hr: number | null;
  baevsky_si: number | null;
  sp_o2: number | null;
  systolic: number | null;
  diastolic: number | null;
}

interface Props {
  visible: boolean;
  log: RecoveryLogLite | null;
  onHide: () => void;
}

function fmtMin(min: number | null): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}м`;
  return `${h}ч ${String(m).padStart(2, '0')}м`;
}

function fmtNum(v: number | null, digits = 1): string {
  if (v == null) return '—';
  return v.toFixed(digits);
}

function fmtInt(v: number | null): string {
  if (v == null) return '—';
  return String(Math.round(v));
}

// --- Секции ---

interface RowDef {
  label: string;
  value: string;
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: RowDef[];
}) {
  const visible = rows.filter((r) => r.value !== '—');
  if (visible.length === 0) return null;
  return (
    <>
      <div className="pb-drawer__section-title">{title}</div>
      <div className="pb-drawer__summary">
        {visible.map((r) => (
          <div key={r.label} className="pb-drawer__row">
            <span className="pb-drawer__label">{r.label}</span>
            <span>{r.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export const WellnessDrawer: React.FC<Props> = ({
  visible,
  log,
  onHide,
}) => {
  if (!log) return null;

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      style={{ width: '480px', maxWidth: '96vw' }}
      className="pb-drawer"
    >
      <div className="pb-drawer__header">
        <div className="pb-drawer__title">
          <i className="pi pi-heart pb-drawer__icon" />
          {log.date}
          {log.auto_source && (
            <span className="pb-source-badge pb-source-badge--manual">
              {log.auto_source}
            </span>
          )}
        </div>
      </div>

      {/* СОН */}
      <Section
        title="Сон"
        rows={[
          { label: 'Продолжительность', value: log.sleep_hours != null ? `${fmtNum(log.sleep_hours)} ч` : '—' },
          { label: 'Sleep score', value: fmtInt(log.sleep_score) },
          { label: 'Total time', value: fmtMin(log.sleep_total_min) },
          { label: 'Deep', value: fmtMin(log.deep_min) },
          { label: 'REM', value: fmtMin(log.rem_min) },
          { label: 'Light', value: fmtMin(log.light_min) },
          { label: 'Awake', value: fmtMin(log.awake_min) },
          { label: 'Sleep quality', value: fmtInt(log.sleep_quality) },
        ]}
      />

      {/* СЕРДЦЕ */}
      <Section
        title="Сердце"
        rows={[
          { label: 'Resting HR', value: fmtInt(log.resting_hr) },
          { label: 'HRV', value: fmtInt(log.hrv) },
          { label: 'HRV SDNN', value: fmtNum(log.hrv_sdnn) },
          { label: 'Avg sleeping HR', value: fmtInt(log.avg_sleeping_hr) },
          { label: 'SpO₂', value: log.sp_o2 != null ? `${log.sp_o2}%` : '—' },
          { label: 'Systolic / Diastolic', value: log.systolic != null && log.diastolic != null ? `${log.systolic}/${log.diastolic}` : '—' },
          { label: 'Baevsky SI', value: fmtNum(log.baevsky_si, 2) },
        ]}
      />

      {/* НАГРУЗКА */}
      <Section
        title="Нагрузка"
        rows={[
          { label: 'CTL (fitness)', value: fmtNum(log.ctl) },
          { label: 'ATL (fatigue)', value: fmtNum(log.atl) },
          { label: 'Ramp rate', value: fmtNum(log.ramp_rate, 2) },
          { label: 'Readiness', value: fmtInt(log.readiness) },
        ]}
      />

      {/* ТЕЛО */}
      <Section
        title="Тело"
        rows={[
          { label: 'Вес', value: log.weight_kg != null ? `${fmtNum(log.weight_kg)} кг` : '—' },
          { label: 'Шаги', value: log.steps != null ? log.steps.toLocaleString('ru-RU') : '—' },
          { label: 'VO2max', value: fmtNum(log.vo2max, 1) },
          { label: 'Body battery', value: log.body_battery_charged != null || log.body_battery_drained != null
            ? `+${fmtInt(log.body_battery_charged)} / −${fmtInt(log.body_battery_drained)}`
            : '—' },
          { label: 'Stress avg', value: fmtInt(log.stress_avg) },
        ]}
      />

      {/* САМОЧУВСТВИЕ */}
      <Section
        title="Самочувствие"
        rows={[
          { label: 'Soreness', value: fmtInt(log.soreness) },
          { label: 'Fatigue', value: fmtInt(log.fatigue) },
          { label: 'Stress', value: fmtInt(log.stress) },
          { label: 'Mood', value: fmtInt(log.mood) },
          { label: 'Motivation', value: fmtInt(log.motivation) },
          { label: 'Injury', value: fmtInt(log.injury) },
        ]}
      />
    </Sidebar>
  );
};