// src/components/PRANA_BINDU/DaySummary.tsx
//
// Компактная строка wellness за один день.
// Используется в шапке DayDrawer и в будущей ячейке FullWeek.

import React from 'react';
import AppIcon from '../COMMON/AppIcon/AppIcon';

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
  waterTotal?: number;
  waterGoal?: number;
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

export const DaySummary: React.FC<Props> = ({ log, className, waterTotal, waterGoal }) => {
  // Функция рендера воды, чтобы не дублировать код в пустом и заполненном дне
  const renderWater = () => {
    if (waterGoal == null || waterTotal == null) return null;
    const isGoalMet = waterTotal >= waterGoal;
    const waterColor = isGoalMet ? '#6ab2f2' : 'var(--pb-accent)';

    return (
      <div 
        title={`Вода: ${waterTotal} / ${waterGoal} мл`} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-start',
          width: '100%', 
          paddingTop: '0.2rem',
          margin: 0,
          paddingLeft: 0,
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {/* Иконка: 1em делает её размер равным размеру текста, flexShrink: 0 запрещает сжиматься */}
          <AppIcon
            name="water"
            set="custom"
            size={14}
            color={isGoalMet ? '#6ab2f2' : 'accent'}
          />
          
          <span style={{ fontSize: '0.75rem', color: waterColor, whiteSpace: 'nowrap' }}>
            {waterTotal} / {waterGoal} мл
          </span>
        </div>
        
        <div style={{ 
          width: '60px', 
          height: '4px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '2px', 
          overflow: 'hidden',
          marginLeft: '0.5rem',
          flexShrink: 0
        }}>
          <div style={{ width: `${Math.min(100, (waterTotal / waterGoal) * 100)}%`, height: '100%', background: waterColor }} />
        </div>
      </div>
    );
  };

  if (!log) {
    return (
      <div className={`pb-day-summary pb-day-summary--empty ${className ?? ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
        <span className="pb-hint">Нет данных о здоровье за этот день</span>
        {renderWater()}
      </div>
    );
  }

  return (
    <div className={`pb-day-summary ${className ?? ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
      
      {/* ВЕРХНЯЯ СТРОКА: Метрики здоровья */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
        <span className="pb-day-summary__item" title="Сон" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
          <AppIcon name="moon-stars" set="custom" size={14} color="accent" />
          {fmtH(log.sleep_hours)}
        </span>
          {log.sleep_score != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim" title="Оценка сна" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
            <AppIcon name="stars" set="custom" size={14} color="accent" />
            {fmtInt(log.sleep_score)}
          </span>
        )}
        <span className="pb-day-summary__item" title="Пульс покоя" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
          <AppIcon name="heart-pulse" set="custom" size={14} color="accent" />
          {fmtInt(log.resting_hr)}
        </span>
        {log.hrv != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim">
            HRV {fmtInt(log.hrv)}
          </span>
        )}
        <span className="pb-day-summary__item" title="Шаги" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
          <AppIcon name="person-walking" set="custom" size={14} color="accent" />
          {fmtSteps(log.steps)}
        </span>
        {log.weight_kg != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim">
            {log.weight_kg.toFixed(1)} кг
          </span>
        )}
        {log.ctl != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim" title={`CTL (Форма): ${log.ctl.toFixed(1)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
            <AppIcon name="bar-chart-line-fill" set="custom" size={14} color="accent" />
            {log.ctl.toFixed(0)}
          </span>
        )}
        {log.atl != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim" title={`ATL (Усталость): ${log.atl.toFixed(1)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
            <AppIcon name="battery-half" set="custom" size={14} color="accent" />
            {log.atl.toFixed(0)}
          </span>
        )}
        {log.stress_avg != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim">
            stress {fmtInt(log.stress_avg)}
          </span>
        )}
      </div>

      {/* НИЖНЯЯ СТРОКА: Вода */}
      {renderWater()}
      
    </div>
  );
};