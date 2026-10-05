// src/components/PRANA_BINDU/DayDrawer.tsx
//
// Единый drawer дня: План / Факт / Wellness.

import React, { useEffect, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { TabView, TabPanel } from 'primereact/tabview';
import { Message } from 'primereact/message';
import { DaySummary } from './DaySummary';
import { PlanEventView } from './views/PlanEventView';
import { WellnessView } from './views/WellnessView';
import { RunFactView } from './views/RunFactView';
import { groupRunFacts, type GroupedRunFact } from './utils/groupRunFacts';
import type { PlanEventLite } from './PlanEventsPanel';
import type { RecoveryLogLite as WellnessLogLite } from './WellnessDrawer';
import type { RecoveryLogLite as SummaryLogLite } from './DaySummary';
import type { RunFactLite } from './RunStreamsDrawer';

interface Props {
  visible: boolean;
  date: string | null;
  onHide: () => void;
  onAfterChange: () => void;
}

function fmtKm(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2);
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}ч ${String(m).padStart(2, '0')}м`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function sourceLabel(f: RunFactLite): string {
  if (f.source === 'fit' && f.origin === 'zepp-app') return 'zepp';
  if (f.source === 'fit' && f.origin) return `fit · ${f.origin}`;
  return f.source ?? '—';
}

export const DayDrawer: React.FC<Props> = ({
  visible,
  date,
  onHide,
  onAfterChange,
}) => {
  const api = (window as any).electronAPI;

  const [plans, setPlans] = useState<PlanEventLite[]>([]);
  const [factGroups, setFactGroups] = useState<GroupedRunFact[]>([]);
  const [wellness, setWellness] = useState<WellnessLogLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [planView, setPlanView] = useState<PlanEventLite | null>(null);
  const [factView, setFactView] = useState<RunFactLite | null>(null);

  const reload = async () => {
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      const [pRes, rRes, wRes] = await Promise.all([
        api.pb.listPlanEvents(date, date),
        api.pb.listRunFacts(date, date),
        api.pb.listRecoveryLogs(date, date),
      ]);
      if (pRes?.success) setPlans(pRes.items ?? []);
      else setPlans([]);
      if (rRes?.success) {
        setFactGroups(groupRunFacts(rRes.items ?? [], {}));
      } else {
        setFactGroups([]);
      }
      if (wRes?.success) setWellness((wRes.items ?? [])[0] ?? null);
      else setWellness(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible || !date) {
      setPlans([]);
      setFactGroups([]);
      setWellness(null);
      setPlanView(null);
      setFactView(null);
      return;
    }
    setPlanView(null);
    setFactView(null);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, date]);

  const handleChanged = () => {
    void reload();
    onAfterChange();
  };

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      style={{ width: '720px', maxWidth: '96vw' }}
      className="pb-drawer pb-day-drawer"
    >
      <div className="pb-drawer__header">
        <div className="pb-drawer__title">
          <i className="pi pi-calendar pb-drawer__icon" />
          {date ?? ''}
        </div>
      </div>

      <DaySummary log={wellness as unknown as SummaryLogLite | null} />

      {loading && <div className="pb-drawer__hint">Загрузка…</div>}
      {error && <Message severity="error" text={error} className="w-full mt-2" />}

      {!loading && (
        <TabView className="pb-day-drawer__tabs">
          <TabPanel header={`План${plans.length ? ` · ${plans.length}` : ''}`}>
            {planView ? (
              <PlanEventView
                event={planView}
                onBack={() => setPlanView(null)}
                onChanged={handleChanged}
              />
            ) : plans.length === 0 ? (
              <div className="pb-drawer__empty">Нет плана на этот день.</div>
            ) : (
              <div className="pb-day-list">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="pb-day-list__item"
                    onClick={() => setPlanView(p)}
                  >
                    <div className="pb-day-list__item-title">
                      {p.name}
                      {p.sport && (
                        <span className="pb-source-badge pb-source-badge--tcx">
                          {p.sport}
                        </span>
                      )}
                    </div>
                    <div className="pb-day-list__item-meta">
                      {p.startTime && p.startTime.length >= 16 && (
                        <span>{p.startTime.slice(11, 16)}</span>
                      )}
                      {p.durationSec != null && p.durationSec > 0 && (
                        <span>{fmtDuration(p.durationSec)}</span>
                      )}
                      {p.distanceM != null && p.distanceM > 0 && (
                        <span>{(p.distanceM / 1000).toFixed(2)} км</span>
                      )}
                      {p.plannedLoad != null && (
                        <span>{Math.round(p.plannedLoad)} TSS</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabPanel>

          <TabPanel header={`Факт${factGroups.length ? ` · ${factGroups.length}` : ''}`}>
            {factView ? (
              <RunFactView
                fact={factView}
                onBack={() => setFactView(null)}
                onChanged={handleChanged}
              />
            ) : factGroups.length === 0 ? (
              <div className="pb-drawer__empty">Нет тренировок за этот день.</div>
            ) : (
              <div className="pb-day-list">
                {factGroups.map((g, idx) => (
                  <button
                    key={`${g.date}-${g.startTime ?? 'notime'}-${idx}`}
                    type="button"
                    className="pb-day-list__item"
                    onClick={() => {
                      setFactView({
                        ...(g.primary as RunFactLite),
                        start_time: g.startTime,
                      });
                    }}
                  >
                    <div className="pb-day-list__item-title">
                      {g.displayName}
                      <span className="pb-source-badges">
                        {g.sources.map((s, i) => (
                          <span
                            key={`${s}-${i}`}
                            className={`pb-source-badge pb-source-badge--${s}`}
                          >
                            {s}
                          </span>
                        ))}
                      </span>
                    </div>
                    <div className="pb-day-list__item-meta">
                      {g.startTime && g.startTime.length >= 16 && (
                        <span>{g.startTime.slice(11, 16)}</span>
                      )}
                      <span>{fmtKm(g.primary.actual_km)} км</span>
                      <span>{g.primary.actual_pace ?? '—'}</span>
                      <span>{fmtDuration(g.primary.duration_sec)}</span>
                      <span>{g.primary.avg_hr ?? '—'} bpm</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabPanel>

          <TabPanel header="Wellness">
            <WellnessView log={wellness} />
          </TabPanel>
        </TabView>
      )}
    </Sidebar>
  );
};