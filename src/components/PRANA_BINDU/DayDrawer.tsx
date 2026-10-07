// src/components/PRANA_BINDU/DayDrawer.tsx
//
// Единый drawer дня: План / Факт / Wellness.

import React, { useEffect, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { TabView, TabPanel } from 'primereact/tabview';
import { Message } from 'primereact/message';
import { Button } from 'primereact/button';
import { DaySummary } from './DaySummary';
import { PlanEventView } from './views/PlanEventView';
import { WellnessView } from './views/WellnessView';
import { RunFactView } from './views/RunFactView';
import { LogWorkoutSessionDialog } from './LogWorkoutSessionDialog';
import type { PlanEventLite } from './PlanEventsPanel';
import type { RecoveryLogLite as WellnessLogLite } from './WellnessDrawer';
import type { RecoveryLogLite as SummaryLogLite } from './DaySummary';
import type { RunFactLite } from './RunStreamsDrawer';
import { groupRunFacts, type GroupedRunFact } from './utils/groupRunFacts';
import type { WorkoutSession, SessionExercise } from '@/main/services/pranaBindu/core/types';
import { CATEGORY_LABELS } from '@/main/services/pranaBindu/mentat/programs';
import { findProgressionsByKey } from '@/main/services/pranaBindu/mentat/exerciseCatalog';

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

/** Краткая строка для одного упражнения из workout_session. */
function exerciseSummary(ex: SessionExercise): string {
  if (ex.skipped || !ex.actualSets || ex.actualSets.length === 0) {
    return '— пропущено';
  }
  const allSame = ex.actualSets.every((v) => v === ex.actualSets![0]);
  if (allSame) {
    return `${ex.actualSets.length}×${ex.actualSets[0]}${
      ex.isTimeBased ? 'с' : ''
    }`;
  }
  return ex.actualSets.join(' / ');
}

export const DayDrawer: React.FC<Props> = ({
  visible,
  date,
  onHide,
  onAfterChange,
}) => {
  const api = (window as any).electronAPI;

  const [plans, setPlans] = useState<PlanEventLite[]>([]);
  const [facts, setFacts] = useState<RunFactLite[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [wellness, setWellness] = useState<WellnessLogLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [planView, setPlanView] = useState<PlanEventLite | null>(null);
  const [factView, setFactView] = useState<RunFactLite | null>(null);

  // Диалог ввода факта: с планом или свободный
  const [logTarget, setLogTarget] = useState<PlanEventLite | null>(null);
  const [logVisible, setLogVisible] = useState(false);
  const [freeLogVisible, setFreeLogVisible] = useState(false);

  const reload = async () => {
    if (!date) return;
    setLoading(true);
    setError('');
    try {
      const [pRes, rRes, wRes, sRes] = await Promise.all([
        api.pb.listPlanEvents(date, date),
        api.pb.listRunFacts(date, date),
        api.pb.listRecoveryLogs(date, date),
        api.pb.listWorkoutSessions(date, date),
      ]);
      if (pRes?.success) setPlans(pRes.items ?? []);
      else setPlans([]);
      if (rRes?.success) setFacts(rRes.items ?? []);
      else setFacts([]);
      if (wRes?.success) setWellness((wRes.items ?? [])[0] ?? null);
      else setWellness(null);
      if (sRes?.success) setSessions(sRes.items ?? []);
      else setSessions([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible || !date) {
      setPlans([]);
      setFacts([]);
      setSessions([]);
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

  const factGroups = React.useMemo(
    () => groupRunFacts(facts, {}),
    [facts]
  );

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
          {/* ПЛАН */}
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
                  <div
                    key={p.id}
                    className="pb-day-list__item pb-day-list__item--with-action"
                    onClick={() => setPlanView(p)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPlanView(p);
                      }
                    }}
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
                    <Button
                      icon="pi pi-check"
                      text
                      className="pb-day-list__log-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLogTarget(p);
                        setLogVisible(true);
                      }}
                      tooltip="Записать результат"
                      tooltipOptions={{ position: 'left' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabPanel>

          {/* ФАКТ */}
          <TabPanel
            header={`Факт${
              factGroups.length + sessions.length
                ? ` · ${factGroups.length + sessions.length}`
                : ''
            }`}
          >
            {factView ? (
              <RunFactView
                fact={factView}
                onBack={() => setFactView(null)}
                onChanged={handleChanged}
              />
            ) : (
              <>
                {/* Тулбар: счётчик слева, кнопка справа */}
                <div className="pb-day-fact__toolbar">
                  <span className="pb-day-fact__toolbar-count pb-hint">
                    {sessions.length + factGroups.length > 0
                      ? `${sessions.length + factGroups.length} запис${
                          sessions.length + factGroups.length === 1 ? 'ь' : 'и'
                        }`
                      : 'Пусто'}
                  </span>
                  <Button
                    label="Записать"
                    icon="pi pi-plus"
                    className="pb-soft p-button-sm"
                    onClick={() => setFreeLogVisible(true)}
                  />
                </div>

                {/* Силовые факты (workout_sessions) */}
                {sessions.length > 0 && (
                  <div className="pb-day-fact__section">
                    <div className="pb-day-fact__section-title">
                      Упражнения
                    </div>
                    <div className="pb-day-list">
                      {sessions.map((s) => (
                        <div
                          key={s.id}
                          className="pb-day-list__item pb-day-list__item--session"
                        >
                          <div className="pb-day-list__item-title">
                            {s.programKey
                              ? `Программа: ${s.programKey}`
                              : 'Свободная сессия'}
                            {s.isTest && (
                              <span className="pb-source-badge pb-source-badge--dodofo">
                                тест
                              </span>
                            )}
                            {s.generatorCategory &&
                              CATEGORY_LABELS[s.generatorCategory as keyof typeof CATEGORY_LABELS] && (
                                <span className="pb-source-badge pb-source-badge--manual">
                                  {CATEGORY_LABELS[
                                    s.generatorCategory as keyof typeof CATEGORY_LABELS
                                  ]}
                                </span>
                              )}
                          </div>
                          <div className="pb-day-fact__session-list">
                            {s.exercises.map((ex, i) => {
                              const prog = findProgressionsByKey(ex.movementKey);
                              const lvl = prog?.levels.find((l) => l.level === ex.level);
                              // Wade → W<N>, остальные категории (runner/cali/core/posture/hiit) → L<N>.
                              const prefix = prog?.category === 'wade' ? 'W' : 'L';
                              const label = lvl?.name ?? prog?.label ?? ex.movementKey;
                              const lvlTag = ex.level != null ? `${prefix}${ex.level}` : null;
                              const lvlRu = lvl?.nameRu ?? null;

                              return (
                                <div key={i} className="pb-day-fact__ex-row">
                                  <span className="pb-day-fact__ex-key">
                                    {label}
                                    {lvlTag && (
                                      <>
                                        {' '}
                                        <span className="pb-day-fact__ex-lvl">{lvlTag}</span>
                                      </>
                                    )}
                                  </span>
                                  {lvlRu && (
                                    <span className="pb-day-fact__ex-lvl-ru">{lvlRu}</span>
                                  )}
                                  <span className="pb-day-fact__ex-actual">
                                    {exerciseSummary(ex)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="pb-day-list__item-meta">
                            {s.rpe != null && <span>RPE {s.rpe}</span>}
                            {s.notes && (
                              <span title={s.notes}>{s.notes}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Пробежки (run_facts) */}
                {factGroups.length > 0 && (
                  <div className="pb-day-fact__section">
                    <div className="pb-day-fact__section-title">
                      Пробежки
                    </div>
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
                  </div>
                )}

                {/* Совсем пусто */}
                {sessions.length === 0 && factGroups.length === 0 && (
                  <div className="pb-drawer__empty">
                    Нет тренировок за этот день. Можно записать факт
                    вручную — кнопка выше.
                  </div>
                )}
              </>
            )}
          </TabPanel>

          {/* WELLNESS */}
          <TabPanel header="Wellness">
            <WellnessView log={wellness} />
          </TabPanel>
        </TabView>
      )}

      {/* Диалог записи факта для конкретного плана */}
      <LogWorkoutSessionDialog
        visible={logVisible}
        planEvent={logTarget}
        onHide={() => {
          setLogVisible(false);
          setLogTarget(null);
        }}
        onSaved={handleChanged}
      />

      {/* Диалог записи свободного факта (без плана) */}
      <LogWorkoutSessionDialog
        visible={freeLogVisible}
        planEvent={null}
        freeDate={date}
        onHide={() => setFreeLogVisible(false)}
        onSaved={handleChanged}
      />
    </Sidebar>
  );
};