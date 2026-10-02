// src/components/PRANA_BINDU/PlanEventDrawer.tsx
//
// Drawer с деталями события плана: описание конструктора,
// разобранные шаги, zoneTimes.

import React from 'react';
import { Sidebar } from 'primereact/sidebar';
import type { PlanEventLite } from './PlanEventsPanel';

interface Props {
  visible: boolean;
  event: PlanEventLite | null;
  onHide: () => void;
}

interface StepShape {
  type?: string;
  duration?: number;
  distance?: number;
  hrZone?: number;
  paceZone?: number;
  powerZone?: number;
  reps?: number;
}

function fmtDuration(sec?: number): string {
  if (sec == null || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}с`;
}

function fmtDistance(m?: number): string {
  if (m == null || m <= 0) return '';
  if (m >= 1000) return `${(m / 1000).toFixed(2)} км`;
  return `${Math.round(m)} м`;
}

function stepLine(s: StepShape, i: number): string {
  const parts: string[] = [];
  if (s.type) parts.push(s.type);
  if (s.reps) parts.push(`×${s.reps}`);
  if (s.distance) parts.push(fmtDistance(s.distance));
  if (s.duration) parts.push(fmtDuration(s.duration));
  const targets: string[] = [];
  if (s.hrZone) targets.push(`HR Z${s.hrZone}`);
  if (s.paceZone) targets.push(`Pace Z${s.paceZone}`);
  if (s.powerZone) targets.push(`Power Z${s.powerZone}`);
  if (targets.length > 0) parts.push(targets.join(' · '));
  return parts.join(' · ') || `шаг ${i + 1}`;
}

export const PlanEventDrawer: React.FC<Props> = ({
  visible,
  event,
  onHide,
}) => {
  if (!event) return null;

  const steps = (event.steps as StepShape[] | undefined) ?? [];
  const zoneTimes = (event as any).zoneTimes as
    | Array<{ zone: string; secs: number }>
    | undefined;

  const startTime = event.startTime ?? '';
  const timeOnly = startTime.length >= 16 ? startTime.slice(11, 16) : '';

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      style={{ width: '520px', maxWidth: '96vw' }}
      className="pb-drawer"
    >
      <div className="pb-drawer__header">
        <div className="pb-drawer__title">
          <i className="pi pi-calendar pb-drawer__icon" />
          {event.date}
          {timeOnly && timeOnly !== '00:00' && (
            <span className="pb-drawer__count"> {timeOnly}</span>
          )}
        </div>
      </div>

      <div className="pb-plan-event__name">{event.name}</div>

      <div className="pb-plan-event__meta">
        {event.sport && (
          <span className="pb-source-badge pb-source-badge--tcx">
            {event.sport}
          </span>
        )}
        <span className="pb-source-badge pb-source-badge--manual">
          {event.category}
        </span>
        {event.distanceM != null && event.distanceM > 0 && (
          <span className="pb-plan-event__chip">
            <i className="pi pi-map-marker" /> {fmtDistance(event.distanceM)}
          </span>
        )}
        {event.durationSec != null && event.durationSec > 0 && (
          <span className="pb-plan-event__chip">
            <i className="pi pi-clock" /> {fmtDuration(event.durationSec)}
          </span>
        )}
        {event.plannedLoad != null && (
          <span className="pb-plan-event__chip">
            <i className="pi pi-bolt" /> {Math.round(event.plannedLoad)} TSS
          </span>
        )}
      </div>

      {event.pairedActivityId && (
        <div className="pb-plan-event__paired">
          <i className="pi pi-check-circle" /> Связано с тренировкой
          #{event.pairedActivityId}
        </div>
      )}

      {/* Описание — обычно это текст конструктора ICU */}
      {(event as any).description && (
        <>
          <div className="pb-drawer__section-title">Описание</div>
          <pre className="pb-plan-event__description">
            {(event as any).description.trim()}
          </pre>
        </>
      )}

      {/* Шаги */}
      <div className="pb-drawer__section-title">
        Шаги {steps.length > 0 && (
          <span className="pb-drawer__count">({steps.length})</span>
        )}
      </div>
      {steps.length === 0 ? (
        <div className="pb-drawer__empty">
          У события нет структурированных шагов.
        </div>
      ) : (
        <div className="pb-plan-event__steps">
          {steps.map((s, i) => (
            <div key={i} className="pb-plan-event__step">
              <span className="pb-plan-event__step-num">{i + 1}</span>
              <span className="pb-plan-event__step-text">{stepLine(s, i)}</span>
            </div>
          ))}
        </div>
      )}

      {/* zoneTimes — предсказание времени в зонах */}
      {zoneTimes && zoneTimes.some((z) => z.secs > 0) && (
        <>
          <div className="pb-drawer__section-title">
            Время в зонах (предсказание)
          </div>
          <div className="pb-plan-event__zones">
            {zoneTimes
              .filter((z) => z.secs > 0)
              .map((z) => (
                <span key={z.zone} className="pb-plan-event__zone">
                  <b>{z.zone}</b> {fmtDuration(z.secs)}
                </span>
              ))}
          </div>
        </>
      )}
    </Sidebar>
  );
};