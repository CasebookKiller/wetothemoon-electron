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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 16 16"
            style={{ 
              color: waterColor, 
              flexShrink: 0 
            }}
          >
            <path d="M.036 3.314a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0L.314 3.964a.5.5 0 0 1-.278-.65m0 3a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0L.314 6.964a.5.5 0 0 1-.278-.65m0 3a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0L.314 9.964a.5.5 0 0 1-.278-.65m0 3a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.757-.703a.5.5 0 0 1-.278-.65"/>
          </svg>
          
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 16 16"
            style={{ 
              color: 'var(--pb-accent)', 
              flexShrink: 0 
            }}
          >
            <path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286"/>
            <path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.73 1.73 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.73 1.73 0 0 0 1.097-1.097zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
          </svg>
          {fmtH(log.sleep_hours)}
        </span>
                {log.sleep_score != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim" title="Оценка сна" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              fill="currentColor"
              viewBox="0 0 16 16"
              style={{ 
                color: 'var(--pb-accent)', 
                flexShrink: 0 
              }}
            >
              <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/>
            </svg>
            {fmtInt(log.sleep_score)}
          </span>
        )}
        <span className="pb-day-summary__item" title="Пульс покоя" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 16 16"
            style={{ 
              color: 'var(--pb-accent)', 
              fontSize: '0.85rem', // Размер как у остальных
              flexShrink: 0 
            }}
          >
            <path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053.918 3.995.78 5.323 1.508 7H.43c-2.128-5.697 4.165-8.83 7.394-5.857q.09.083.176.171a3 3 0 0 1 .176-.17c3.23-2.974 9.522.159 7.394 5.856h-1.078c.728-1.677.59-3.005.108-3.947C13.486.878 10.4.28 8.717 2.01zM2.212 10h1.315C4.593 11.183 6.05 12.458 8 13.795c1.949-1.337 3.407-2.612 4.473-3.795h1.315c-1.265 1.566-3.14 3.25-5.788 5-2.648-1.75-4.523-3.434-5.788-5"/>
            <path d="M10.464 3.314a.5.5 0 0 0-.945.049L7.921 8.956 6.464 5.314a.5.5 0 0 0-.88-.091L3.732 8H.5a.5.5 0 0 0 0 1H4a.5.5 0 0 0 .416-.223l1.473-2.209 1.647 4.118a.5.5 0 0 0 .945-.049l1.598-5.593 1.457 3.642A.5.5 0 0 0 12 9h3.5a.5.5 0 0 0 0-1h-3.162z"/>
          </svg>
          {fmtInt(log.resting_hr)}
        </span>
        {log.hrv != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim">
            HRV {fmtInt(log.hrv)}
          </span>
        )}
        <span className="pb-day-summary__item" title="Шаги" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 16 16"
            style={{ 
              color: 'var(--pb-accent)', 
              fontSize: '0.85rem', // Размер как у остальных иконок
              flexShrink: 0 
            }}
          >
            <path d="M9.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M6.44 3.752A.75.75 0 0 1 7 3.5h1.445c.742 0 1.32.643 1.243 1.38l-.43 4.083a1.8 1.8 0 0 1-.088.395l-.318.906.213.242a.8.8 0 0 1 .114.175l2 4.25a.75.75 0 1 1-1.357.638l-1.956-4.154-1.68-1.921A.75.75 0 0 1 6 8.96l.138-2.613-.435.489-.464 2.786a.75.75 0 1 1-1.48-.246l.5-3a.75.75 0 0 1 .18-.375l2-2.25Z"/>
            <path d="M6.25 11.745v-1.418l1.204 1.375.261.524a.8.8 0 0 1-.12.231l-2.5 3.25a.75.75 0 1 1-1.19-.914zm4.22-4.215-.494-.494.205-1.843.006-.067 1.124 1.124h1.44a.75.75 0 0 1 0 1.5H11a.75.75 0 0 1-.531-.22Z"/>
          </svg>
          {fmtSteps(log.steps)}
        </span>
        {log.weight_kg != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim">
            {log.weight_kg.toFixed(1)} кг
          </span>
        )}
        {log.ctl != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim" title={`CTL (Форма): ${log.ctl.toFixed(1)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              fill="currentColor"
              viewBox="0 0 16 16"
              style={{ 
                color: 'var(--pb-accent)', 
                flexShrink: 0 
              }}
            >
              <path d="M11 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h1V7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7h1z"/>
            </svg>
            {log.ctl.toFixed(0)}
          </span>
        )}
        {log.atl != null && (
          <span className="pb-day-summary__item pb-day-summary__item--dim" title={`ATL (Усталость): ${log.atl.toFixed(1)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              fill="currentColor"
              viewBox="0 0 16 16"
              style={{ 
                color: 'var(--pb-accent)', 
                flexShrink: 0 
              }}
            >
              <path d="M2 6h5v4H2z"/>
              <path d="M2 4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm10 1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 3a1.5 1.5 0 0 1-1.5 1.5v-3A1.5 1.5 0 0 1 16 8"/>
            </svg>
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