// src/components/PRANA_BINDU/FullWeek.tsx
//
// Sticky-полоса недели на всю ширину окна. 7 ячеек по дням,
// сегодня в центре при первом рендере. В ячейке: дата, wellness
// (DaySummary), список плана, список факта.
//
// Самодостаточен: сам грузит plan_events / run_facts / recovery_logs
// за видимый диапазон через IPC. UI-события прокидывает наружу
// через onDayClick / onOpenPlanEvent / onOpenRunFact.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { DaySummary } from './DaySummary';
import type { RecoveryLogLite } from './WellnessDrawer';
import { groupRunFacts, type GroupedRunFact } from './utils/groupRunFacts';

interface Props {
  onDayClick?: (date: string) => void;
  onOpenPlanEvent?: (eventId: number) => void;
  onOpenRunFact?: (factId: number) => void;
  className?: string;
}

interface PlanEventLite {
  id: number;
  date: string;
  name: string;
  sport?: string | null;
  category?: string | null;
  startTime?: string | null;
  durationSec?: number | null;
  distanceM?: number | null;
  externalId?: string | null;
}

interface RunFactLite {
  id: number;
  date: string;
  user_name?: string | null;
  name?: string | null;
  source: string | null;
  origin?: string | null;
  actual_km: number | null;
  actual_pace: string | null;
  duration_sec: number | null;
  avg_hr: number | null;
}

interface DayCellData {
  iso: string;
  dowShort: string;
  dayNum: number;
  monthShort: string;
  isToday: boolean;
  plans: PlanEventLite[];
  factGroups: GroupedRunFact[];
  wellness: RecoveryLogLite | null;
}

const DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(s: string, delta: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + delta);
  return toIso(d);
}

function fmtKm(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2);
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}ч${String(m).padStart(2, '0')}` : `${m}м`;
}

/*function sourceBadge(source: string | null, origin?: string | null): string {
  if (source === 'fit' && origin === 'zepp-app') return 'zepp';
  if (source === 'fit' && origin) return 'fit';
  return source ?? '—';
}*/

export const FullWeek: React.FC<Props> = ({
  onDayClick,
  onOpenPlanEvent,
  onOpenRunFact,
  className,
}) => {
  const api = (window as any).electronAPI;

  const todayIso = useMemo(() => toIso(new Date()), []);
  const [centerIso, setCenterIso] = useState<string>(todayIso);

  const [plans, setPlans] = useState<PlanEventLite[]>([]);
  const [facts, setFacts] = useState<RunFactLite[]>([]);
  const [wellness, setWellness] = useState<RecoveryLogLite[]>([]);
  const [loading, setLoading] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.fullweek.collapsed') === '1';
    } catch {
      return false;
    }
  });

  const [pinned, setPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.fullweek.pinned') !== '0';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        'pb.fullweek.collapsed',
        collapsed ? '1' : '0'
      );
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('pb.fullweek.pinned', pinned ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [pinned]);

  // Видимый диапазон — центр ±3
  const range = useMemo(() => {
    return { from: addDays(centerIso, -3), to: addDays(centerIso, 3) };
  }, [centerIso]);

  // Загрузка данных под диапазон
  useEffect(() => {
    if (!api?.pb?.listPlanEvents) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [pRes, rRes, wRes] = await Promise.all([
          api.pb.listPlanEvents(range.from, range.to),
          api.pb.listRunFacts(range.from, range.to),
          api.pb.listRecoveryLogs(range.from, range.to),
        ]);
        if (!alive) return;
        setPlans(pRes?.success ? pRes.items ?? [] : []);
        setFacts(rRes?.success ? rRes.items ?? [] : []);
        setWellness(wRes?.success ? wRes.items ?? [] : []);
      } catch {
        if (!alive) return;
        setPlans([]);
        setFacts([]);
        setWellness([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [range.from, range.to, api]);

  // Собираем 7 ячеек
  const cells: DayCellData[] = useMemo(() => {
    const planByDate = new Map<string, PlanEventLite[]>();
    for (const p of plans) {
      const list = planByDate.get(p.date) ?? [];
      list.push(p);
      planByDate.set(p.date, list);
    }

    // Группируем пробежки: одна тренировка — одна плитка,
    // источники собираются в массив.
    const allGroups = groupRunFacts(facts, {});
    const factByDate = new Map<string, GroupedRunFact[]>();
    for (const g of allGroups) {
      const list = factByDate.get(g.date) ?? [];
      list.push(g);
      factByDate.set(g.date, list);
    }

    const wellnessByDate = new Map<string, RecoveryLogLite>();
    for (const w of wellness) {
      wellnessByDate.set(w.date, w);
    }

    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(centerIso, i - 3);
      const d = parseIso(iso);
      const dowIdx = (d.getDay() + 6) % 7; // Пн = 0
      return {
        iso,
        dowShort: DOW_SHORT[dowIdx],
        dayNum: d.getDate(),
        monthShort: MONTH_SHORT[d.getMonth()],
        isToday: iso === todayIso,
        plans: planByDate.get(iso) ?? [],
        factGroups: factByDate.get(iso) ?? [],
        wellness: wellnessByDate.get(iso) ?? null,
      };
    });
  }, [centerIso, plans, facts, wellness, todayIso]);

  const shift = (dir: -1 | 1) => {
    setCenterIso((iso) => addDays(iso, dir));
  };

  const goToday = () => setCenterIso(todayIso);

  return (
    <div
      className={[
        'pb-full-week',
        collapsed ? 'is-collapsed' : '',
        pinned ? '' : 'is-unpinned',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Toolbar */}
      <div className="pb-full-week__toolbar">
        <Button
          icon={pinned ? 'pi pi-lock' : 'pi pi-lock-open'}
          className="pb-soft p-button-sm"
          onClick={() => setPinned((v) => !v)}
          tooltip={
            pinned ? 'Открепить от верха' : 'Прикрепить к верху'
          }
          tooltipOptions={{ position: 'bottom' }}
        />
        <Button
          icon={collapsed ? 'pi pi-angle-down' : 'pi pi-angle-up'}
          className="pb-soft p-button-sm"
          onClick={() => setCollapsed((v) => !v)}
          tooltip={collapsed ? 'Развернуть' : 'Свернуть'}
          tooltipOptions={{ position: 'bottom' }}
        />
        <Button
          icon="pi pi-chevron-left"
          className="pb-soft p-button-sm"
          onClick={() => shift(-1)}
          tooltip="На день назад"
          tooltipOptions={{ position: 'bottom' }}
        />
        <Button
          label="Сегодня"
          icon="pi pi-calendar"
          className="pb-soft p-button-sm"
          onClick={goToday}
          disabled={centerIso === todayIso}
        />
        <Button
          icon="pi pi-chevron-right"
          className="pb-soft p-button-sm"
          onClick={() => shift(1)}
          tooltip="На день вперёд"
          tooltipOptions={{ position: 'bottom' }}
        />

        <span className="pb-full-week__range pb-hint">
          {range.from} — {range.to}
          {collapsed && (
            <>
              {' · '}
              <span className="pb-full-week__mini-summary">
                план {cells.reduce((s, c) => s + c.plans.length, 0)} ·
                факт {cells.reduce((s, c) => s + c.factGroups.length, 0)}
              </span>
            </>
          )}
        </span>

        {loading && (
          <i className="pi pi-spin pi-spinner pb-full-week__spin" />
        )}

        <div className="pb-full-week__legend pb-hint">
          <span className="pb-full-week__dot pb-full-week__dot--plan" /> план
          <span className="pb-full-week__sep">·</span>
          <span className="pb-full-week__dot pb-full-week__dot--fact" /> факт
        </div>
      </div>

      {/* 7 ячеек */}
      {!collapsed && (
        <div className="pb-full-week__grid">
        {cells.map((c) => (
          <div
            key={c.iso}
            className={`pb-full-week__day ${
              c.isToday ? 'is-today' : ''
            } ${c.iso === centerIso ? 'is-center' : ''}`}
          >
            <button
              type="button"
              className="pb-full-week__head"
              onClick={
                onDayClick ? () => onDayClick(c.iso) : undefined
              }
            >
              <span className="pb-full-week__dow">{c.dowShort}</span>
              <span className="pb-full-week__num">{c.dayNum}</span>
              <span className="pb-full-week__month">{c.monthShort}</span>
            </button>

            {/* Wellness */}
            <DaySummary log={c.wellness} />

            {/* План */}
            {c.plans.length > 0 && (
              <div className="pb-full-week__section">
                <div className="pb-full-week__section-title">План</div>
                <div className="pb-full-week__items">
                  {c.plans.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pb-full-week__item pb-full-week__item--plan"
                      onClick={
                        onOpenPlanEvent
                          ? () => onOpenPlanEvent(p.id)
                          : undefined
                      }
                    >
                      <span className="pb-full-week__item-name">
                        {p.name}
                      </span>
                      <span className="pb-full-week__item-meta">
                        {p.sport && <span>{p.sport}</span>}
                        {p.distanceM != null && p.distanceM > 0 && (
                          <span>{fmtKm(p.distanceM / 1000)} км</span>
                        )}
                        {p.durationSec != null && p.durationSec > 0 && (
                          <span>{fmtDuration(p.durationSec)}</span>
                        )}
                      </span>
                    </button>
                  ))}
                  {c.plans.length > 4 && (
                    <span className="pb-full-week__more pb-hint">
                      +{c.plans.length - 4} ещё
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Факт */}
            {c.factGroups.length > 0 && (
              <div className="pb-full-week__section">
                <div className="pb-full-week__section-title">Факт</div>
                <div className="pb-full-week__items">
                  {c.factGroups.slice(0, 3).map((g) => (
                    <button
                      key={`${g.date}-${g.startTime ?? 'notime'}-${g.primary.id}`}
                      type="button"
                      className="pb-full-week__item pb-full-week__item--fact"
                      onClick={
                        onOpenRunFact
                          ? () => onOpenRunFact(g.primary.id)
                          : undefined
                      }
                    >
                      <span className="pb-full-week__item-name">
                        {g.displayName}
                      </span>
                      <span className="pb-full-week__item-meta">
                        <span className="pb-full-week__dots">
                          {g.sources.map((s, i) => (
                            <span
                              key={`${s}-${i}`}
                              className={`pb-source-dot pb-source-dot--${s}`}
                              title={s}
                            />
                          ))}
                        </span>
                        <span>{fmtKm(g.primary.actual_km)} км</span>
                        {g.primary.avg_hr != null && (
                          <span>{Math.round(g.primary.avg_hr)} bpm</span>
                        )}
                      </span>
                    </button>
                  ))}
                  {c.factGroups.length > 3 && (
                    <span className="pb-full-week__more pb-hint">
                      +{c.factGroups.length - 3} ещё
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Пусто */}
            {c.plans.length === 0 &&
              c.factGroups.length === 0 &&
              !c.wellness && (
                <div className="pb-full-week__empty pb-hint">
                  Нет данных
                </div>
              )}
          </div>
        ))}
        </div>
      )}
    </div>
  );
};