// src/components/PRANA_BINDU/DayDrawer.tsx
//
// Единый drawer дня: План / Факт / Wellness.

import React, { useEffect, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { TabView, TabPanel } from 'primereact/tabview';
import { Message } from 'primereact/message';
import { Button } from 'primereact/button';
import { DaySummary } from './DaySummary';
import { PlanEventView } from './VIEWS/PlanEventView';
import { WellnessView } from './VIEWS/WellnessView';
import { RunFactView } from './VIEWS/RunFactView';
import { LogWorkoutSessionDialog } from './LogWorkoutSessionDialog';
import type { PlanEventLite } from './PlanEventsPanel';
import type { RecoveryLogLite as WellnessLogLite } from './WellnessDrawer';
import type { RecoveryLogLite as SummaryLogLite } from './DaySummary';
import type { RunFactLite } from './RunStreamsDrawer';
import { groupRunFacts, type GroupedRunFact } from './UTILS/groupRunFacts';
import type { WorkoutSession, SessionExercise } from '@/main/services/pranaBindu/core/types';
import { CATEGORY_LABELS } from '@/main/services/pranaBindu/mentat/programs';
import {
  findProgressionsByKey,
  findNamedByKey,
} from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import { useEquivalencesMap } from './HOOKS/useEquivalencesMap';
import AppIcon from '../COMMON/AppIcon/AppIcon';


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

/** Упражнение считается пропущенным, если skipped=true или нет actualSets. */
function isExerciseSkipped(ex: SessionExercise): boolean {
  return ex.skipped === true || !ex.actualSets || ex.actualSets.length === 0;
}

/**
 * Раскрыть упражнение в UI: название, уровень, русский перевод, эквиваленты.
 * Работает и для прогрессий (progression / W-L префикс), и для named.
 */
function describeExercise(
  ex: SessionExercise,
  lookupByTarget: (
    catalog: string,
    key: string,
    level: number | undefined,
  ) => Array<{ label: string; fullLabel: string }>,
): {
  label: string;
  lvlTag: string | null;
  lvlRu: string | null;
  eqHints: Array<{ label: string; fullLabel: string }>;
} {
  const prog = findProgressionsByKey(ex.movementKey);

  // 1. Прогрессия
  if (prog) {
    const lvl = prog.levels.find((l) => l.level === ex.level);
    const prefix = prog.category === 'wade' ? 'W' : 'L';
    return {
      label: lvl?.name ?? prog.label ?? ex.movementKey,
      lvlTag: ex.level != null ? `${prefix}${ex.level}` : null,
      lvlRu: lvl?.nameRu ?? null,
      eqHints: lookupByTarget(prog.category, ex.movementKey, ex.level),
    };
  }

  // 2. Named-упражнение (drill / plyo / warmup / run-basic / prehab)
  const named = findNamedByKey(ex.movementKey);
  if (named) {
    return {
      label: named.label,
      lvlTag: null,
      lvlRu: named.nameRu ?? null,
      eqHints: [],
    };
  }

  // 3. Ничего не нашли — как есть
  return {
    label: ex.movementKey,
    lvlTag: null,
    lvlRu: null,
    eqHints: [],
  };
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
    // Программные сессии (programKey != null) — отдельные карточки.
  // Свободные (programKey == null) — все в одну «Свободную сессию»,
  // упражнения плоским списком, отсортированным по createdAt.
  const programSessions = React.useMemo(
    () => sessions.filter((s) => s.programKey != null),
    [sessions]
  );
  const freeSessions = React.useMemo(
    () =>
      sessions
        .filter((s) => s.programKey == null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [sessions]
  );

  /**
   * Группы свободных сессий по времени (±30 мин).
   * Сессии, сохранённые подряд, попадают в одну карточку.
   * Между группами — отдельные карточки.
   */
  interface FreeGroup {
    ids: number[];
    createdAt: string;
    exercises: Array<{ ex: SessionExercise; session: WorkoutSession }>;
    isAllSkipped: boolean;
  }

  const freeGroups = React.useMemo<FreeGroup[]>(() => {
    if (freeSessions.length === 0) return [];
    const WINDOW_MS = 30 * 60 * 1000;
    const out: WorkoutSession[][] = [];
    let current: WorkoutSession[] = [];

    for (const s of freeSessions) {
      if (current.length === 0) {
        current.push(s);
        continue;
      }
      const last = current[current.length - 1];
      const dt =
        new Date(s.createdAt).getTime() -
        new Date(last.createdAt).getTime();
      if (dt <= WINDOW_MS) {
        current.push(s);
      } else {
        out.push(current);
        current = [s];
      }
    }
    if (current.length > 0) out.push(current);

    return out.map((g) => ({
      ids: g.map((s) => s.id),
      createdAt: g[0].createdAt,
      exercises: g.flatMap((s) =>
        s.exercises.map((ex) => ({ ex, session: s }))
      ),
      isAllSkipped:
        g.length > 0 &&
        g.every((s) =>
          s.exercises.length > 0 &&
          s.exercises.every((ex) => isExerciseSkipped(ex)),
        ),
    }));
  }, [freeSessions]);

  const { lookupByTarget } = useEquivalencesMap();

  /**
   * Удалить сессии по id. Множественное удаление — все id
   * удаляются циклом, потом reload.
   */
  const handleDeleteSessions = React.useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;
      const msg =
        ids.length === 1
          ? 'Удалить эту запись?'
          : `Удалить ${ids.length} записи?`;
      if (!window.confirm(`${msg}\nЭто действие нельзя отменить.`)) return;
      try {
        for (const id of ids) {
          await api.pb.deleteWorkoutSession(id);
        }
        await reload();
        onAfterChange();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, onAfterChange],
  );

  // Для карточек сессий: все ли упражнения пропущены (для бейджа
  // и приглушения).
  const programSessionStatus = React.useMemo(() => {
    const m = new Map<number, boolean>();
    for (const s of programSessions) {
      m.set(
        s.id,
        s.exercises.length > 0 &&
          s.exercises.every((ex) => isExerciseSkipped(ex)),
      );
    }
    return m;
  }, [programSessions]);

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
          <AppIcon name="calendar" size="md" color="accent" className="pb-drawer__icon" />
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
                      {/* 1. Программные сессии — каждая отдельно */}
                      {programSessions.map((s) => {
                        const isAllSkipped =
                          programSessionStatus.get(s.id) === true;
                        return (
                        <div
                          key={s.id}
                          className={`pb-day-list__item pb-day-list__item--session${
                            isAllSkipped ? ' is-all-skipped' : ''
                          }`}
                        >
                          <div className="pb-day-list__item-title">
                            <span className="pb-day-list__item-title-text">
                              {`Программа: ${s.programKey}`}
                              {isAllSkipped && (
                                <span className="pb-source-badge pb-source-badge--skipped">
                                  пропущено
                                </span>
                              )}
                              {s.isTest && (
                                <span className="pb-source-badge pb-source-badge--dodofo">
                                  тест
                                </span>
                              )}
                              {s.generatorCategory &&
                                CATEGORY_LABELS[
                                  s.generatorCategory as keyof typeof CATEGORY_LABELS
                                ] && (
                                  <span className="pb-source-badge pb-source-badge--manual">
                                    {
                                      CATEGORY_LABELS[
                                        s.generatorCategory as keyof typeof CATEGORY_LABELS
                                      ]
                                    }
                                  </span>
                                )}
                            </span>
                            <Button
                              icon="pi pi-trash"
                              text
                              className="pb-day-list__delete-btn"
                              onClick={() => handleDeleteSessions([s.id])}
                              tooltip="Удалить запись"
                              tooltipOptions={{ position: 'left' }}
                            />
                          </div>
                          <div className="pb-day-fact__session-list">
                            {s.exercises.map((ex, i) => {
                              const d = describeExercise(ex, lookupByTarget);

                              return (
                                <div
                                  key={i}
                                  className="pb-day-fact__ex-row"
                                >
                                  <span className="pb-day-fact__ex-key">
                                    {d.label}
                                    {d.lvlTag && (
                                      <>
                                        {' '}
                                        <span className="pb-day-fact__ex-lvl">
                                          {d.lvlTag}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                  {d.lvlRu && (
                                    <span className="pb-day-fact__ex-lvl-ru">
                                      {d.lvlRu}
                                    </span>
                                  )}
                                  {d.eqHints.length > 0 && (
                                    <span
                                      className="pb-exercise-equiv"
                                      title={`≈ ${d.eqHints
                                        .map((h) => h.fullLabel)
                                        .join('\n≈ ')}`}
                                    >
                                      ≈{' '}
                                      {d.eqHints
                                        .map((h) => h.label)
                                        .join(', ')}
                                    </span>
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
                        );
                      })}

                      {/* 2. Свободные сессии — группы по ±30 мин */}
                      {freeGroups.map((g, gi) => (
                        <div
                          key={`${g.createdAt}-${gi}`}
                          className={`pb-day-list__item pb-day-list__item--session${
                            g.isAllSkipped ? ' is-all-skipped' : ''
                          }`}
                        >
                          <div className="pb-day-list__item-title">
                            <span className="pb-day-list__item-title-text">
                              {`Свободная сессия${
                                g.exercises.length > 1
                                  ? ` · ${g.exercises.length} упражнения`
                                  : ''
                              }`}
                              {g.isAllSkipped && (
                                <span className="pb-source-badge pb-source-badge--skipped">
                                  пропущено
                                </span>
                              )}
                            </span>
                            <Button
                              icon="pi pi-trash"
                              text
                              className="pb-day-list__delete-btn"
                              onClick={() => handleDeleteSessions(g.ids)}
                              tooltip={
                                g.ids.length === 1
                                  ? 'Удалить запись'
                                  : `Удалить группу (${g.ids.length})`
                              }
                              tooltipOptions={{ position: 'left' }}
                            />
                          </div>
                          <div className="pb-day-fact__session-list">
                            {g.exercises.map(({ ex, session }, i) => {
                              const d = describeExercise(ex, lookupByTarget);

                              let timeStr = '';
                              try {
                                const dt = new Date(session.createdAt);
                                if (!Number.isNaN(dt.getTime())) {
                                  timeStr = `${String(dt.getHours()).padStart(
                                    2,
                                    '0'
                                  )}:${String(dt.getMinutes()).padStart(2, '0')}`;
                                }
                              } catch {
                                /* ignore */
                              }

                              return (
                                <div
                                  key={i}
                                  className="pb-day-fact__ex-row"
                                >
                                  {timeStr && (
                                    <span className="pb-day-fact__ex-time">
                                      {timeStr}
                                    </span>
                                  )}
                                  <span className="pb-day-fact__ex-key">
                                    {d.label}
                                    {d.lvlTag && (
                                      <>
                                        {' '}
                                        <span className="pb-day-fact__ex-lvl">
                                          {d.lvlTag}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                  {d.lvlRu && (
                                    <span className="pb-day-fact__ex-lvl-ru">
                                      {d.lvlRu}
                                    </span>
                                  )}
                                  {d.eqHints.length > 0 && (
                                    <span
                                      className="pb-exercise-equiv"
                                      title={`≈ ${d.eqHints
                                        .map((h) => h.fullLabel)
                                        .join('\n≈ ')}`}
                                    >
                                      ≈{' '}
                                      {d.eqHints
                                        .map((h) => h.label)
                                        .join(', ')}
                                    </span>
                                  )}
                                  {session.isTest && (
                                    <span className="pb-source-badge pb-source-badge--dodofo">
                                      тест
                                    </span>
                                  )}
                                  <span className="pb-day-fact__ex-actual">
                                    {exerciseSummary(ex)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {/* Общий notes */}
                          {(() => {
                            const notes = Array.from(
                              new Set(
                                g.exercises
                                  .map(({ session }) => session.notes)
                                  .filter((n): n is string => !!n)
                              )
                            );
                            if (notes.length === 0) return null;
                            return (
                              <div className="pb-day-list__item-meta">
                                {notes.map((n) => (
                                  <span key={n}>{n}</span>
                                ))}
                              </div>
                            );
                          })()}
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
          <TabPanel header="Здоровье">
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