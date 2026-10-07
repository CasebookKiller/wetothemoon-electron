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
  // v20
  sources_json: string | null;
  calories_active: number | null;
  calories_total: number | null;
  body_fat_pct: number | null;
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

/**
 * Источники за день — парсим sources_json, при отсутствии падаем
 * на legacy-поле auto_source (старые записи до v20).
 */
function parseSources(log: RecoveryLogLite): string[] {
  if (log.sources_json) {
    try {
      const p = JSON.parse(log.sources_json);
      if (Array.isArray(p)) {
        const items = p.filter((x): x is string => typeof x === 'string');
        if (items.length > 0) return items;
      }
    } catch {
      /* ignore */
    }
  }
  return log.auto_source ? [log.auto_source] : [];
}

/** CSS-класс бейджа — берём из общего набора sourceBadge. */
function sourceBadgeClass(name: string): string {
  if (name === 'intervals-icu') return 'pb-source-badge--intervals-icu';
  if (name === 'dodofo') return 'pb-source-badge--dodofo';
  if (name === 'zepp' || name === 'zepp-app') return 'pb-source-badge--zepp';
  return 'pb-source-badge--manual';
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
          {parseSources(log).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className={`pb-source-badge ${sourceBadgeClass(s)}`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* СОН */}
      <Section
        title="Сон"
        rows={[
          { label: 'Продолжительность', value: log.sleep_hours != null ? `${fmtNum(log.sleep_hours)} ч` : '—' },
          { label: 'Оценка сна',        value: fmtInt(log.sleep_score) },
          { label: 'Общее время',       value: fmtMin(log.sleep_total_min) },
          { label: 'Глубокий',          value: fmtMin(log.deep_min) },
          { label: 'REM',               value: fmtMin(log.rem_min) },
          { label: 'Лёгкий',            value: fmtMin(log.light_min) },
          { label: 'Бодрствование',     value: fmtMin(log.awake_min) },
          { label: 'Качество сна',      value: fmtInt(log.sleep_quality) },
        ]}
      />

      {/* СЕРДЦЕ */}
      <Section
        title="Сердце"
        rows={[
          { label: 'Пульс покоя',       value: fmtInt(log.resting_hr) },
          { label: 'HRV',               value: fmtInt(log.hrv) },
          { label: 'SDNN',              value: fmtNum(log.hrv_sdnn) },
          { label: 'Ср. пульс во сне',  value: fmtInt(log.avg_sleeping_hr) },
          { label: 'SpO₂',              value: log.sp_o2 != null ? `${log.sp_o2}%` : '—' },
          { label: 'Давление',          value: log.systolic != null && log.diastolic != null ? `${log.systolic}/${log.diastolic}` : '—' },
          { label: 'Индекс Баевского',  value: fmtNum(log.baevsky_si, 2) },
        ]}
      />

      {/* НАГРУЗКА */}
      <Section
        title="Нагрузка"
        rows={[
          { label: 'CTL (форма)',       value: fmtNum(log.ctl) },
          { label: 'ATL (усталость)',   value: fmtNum(log.atl) },
          { label: 'Скорость роста',    value: fmtNum(log.ramp_rate, 2) },
          { label: 'Готовность',        value: fmtInt(log.readiness) },
        ]}
      />

      {/* ТЕЛО */}
      <Section
        title="Тело"
        rows={[
          { label: 'Вес',           value: log.weight_kg != null ? `${fmtNum(log.weight_kg)} кг` : '—' },
          { label: 'Шаги',          value: log.steps != null ? log.steps.toLocaleString('ru-RU') : '—' },
          { label: 'VO2max',        value: fmtNum(log.vo2max, 1) },
          { label: 'Body battery', value: log.body_battery_charged != null || log.body_battery_drained != null
            ? `+${fmtInt(log.body_battery_charged)} / −${fmtInt(log.body_battery_drained)}`
            : '—' },
          { label: 'Средний стресс', value: fmtInt(log.stress_avg) },
        ]}
      />

      {/* ЭНЕРГИЯ (v20 — dodofo) */}
      <Section
        title="Энергия"
        rows={[
          {
            label: 'Активные калории',
            value:
              log.calories_active != null
                ? `${Math.round(log.calories_active).toLocaleString('ru-RU')} ккал`
                : '—',
          },
          {
            label: 'Калории всего',
            value:
              log.calories_total != null
                ? `${Math.round(log.calories_total).toLocaleString('ru-RU')} ккал`
                : '—',
          },
          { 
            label: 'Жир',
            value:
              log.body_fat_pct != null 
                ? `${log.body_fat_pct.toFixed(1)} %` 
                : '—' },
        ]}
      />

      {/* САМОЧУВСТВИЕ */}
      <Section
        title="Самочувствие"
        rows={[
          { label: 'Крепатура',    value: fmtInt(log.soreness) },
          { label: 'Усталость',    value: fmtInt(log.fatigue) },
          { label: 'Стресс',       value: fmtInt(log.stress) },
          { label: 'Настроение',   value: fmtInt(log.mood) },
          { label: 'Мотивация',    value: fmtInt(log.motivation) },
          { label: 'Боль',         value: fmtInt(log.injury) },
        ]}
      />







    </Sidebar>
  );
};