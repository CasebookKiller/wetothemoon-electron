// src/components/PRANA_BINDU/FullWeek.tsx
//
// Sticky-полоса недели на всю ширину окна. 7 ячеек по дням,
// сегодня в центре при первом рендере.
//
// Навигация: ← → (клавиатура), Shift+колесо / горизонтальный
// тачпад-скролл, кнопки.
//
// Замок:
//   pinned=true  — вся панель зафиксирована к верху viewport.
//   pinned=false — панель уезжает со скроллом.
//
// Кнопка замка всегда доступна: пока панель видна, она в тулбаре;
// если панель уехала из viewport — в левом верхнем углу окна
// появляется floating-копия. Клик по любой из них прикрепляет
// панель обратно и прокручивает к ней.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from 'primereact/button';
import { DaySummary } from './DaySummary';
import type { RecoveryLogLite } from './WellnessDrawer';
import { groupRunFacts, type GroupedRunFact } from './UTILS/groupRunFacts';
import { LogWorkoutSessionDialog } from './LogWorkoutSessionDialog';

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

  const [logDate, setLogDate] = useState<string | null>(null);
  //const [pinPos, setPinPos] = useState<{ top: number; left: number } | null>(
  //  null
  //);

  // Ссылки
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const lastShiftRef = useRef(0);
  const pinSlotRef = useRef<HTMLDivElement | null>(null);

  // Сохранение настроек
  useEffect(() => {
    try {
      localStorage.setItem(
        'pb.fullweek.collapsed',
        collapsed ? '1' : '0'
      );
    } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('pb.fullweek.pinned', pinned ? '1' : '0');
    } catch { /* ignore */ }
  }, [pinned]);

  // Диапазон — центр ±3
  const range = useMemo(() => {
    return { from: addDays(centerIso, -3), to: addDays(centerIso, 3) };
  }, [centerIso]);

  // Загрузка
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

  // Сдвиг
  const shift = useCallback((dir: -1 | 1) => {
    setCenterIso((iso) => addDays(iso, dir));
  }, []);

  // Сдвиг с throttle — плавнее, чем было
  const shiftThrottled = useCallback(
    (dir: -1 | 1) => {
      const now = Date.now();
      if (now - lastShiftRef.current < 100) return;
      lastShiftRef.current = now;
      shift(dir);
    },
    [shift]
  );

  const goToday = useCallback(() => setCenterIso(todayIso), [todayIso]);

  // Переключение замка: при прикреплении — прокрутка к панели
  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          const el = rootRef.current;
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      return next;
    });
  }, []);

  // Если приложение стартует с pinned=false (сохранено в localStorage),
  // измеряем слот один раз после монтирования, чтобы floating-кнопка
  // встала ровно на его место.
  //useLayoutEffect(() => {
  //  if (pinned) return;
  //  const slot = pinSlotRef.current;
  //  if (!slot) return;
  //  const r = slot.getBoundingClientRect();
  //  setPinPos({ top: r.top, left: r.left });
  //  // eslint-disable-next-line react-hooks/exhaustive-deps
  //}, []);

  // Горячие клавиши ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const anyVisible = (sel: string) =>
        Array.from(document.querySelectorAll(sel)).some((el) => {
          const s = getComputedStyle(el as HTMLElement);
          return s.display !== 'none' && s.visibility !== 'hidden';
        });
      if (anyVisible('.p-dialog')) return;
      if (anyVisible('.p-sidebar')) return;

      e.preventDefault();
      shift(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [shift]);

  // Колесо мыши / тачпад
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    if (
      grid &&
      e.target instanceof HTMLElement &&
      grid.contains(e.target) &&
      grid.scrollWidth > grid.clientWidth + 4
    ) {
      return;
    }

    const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (horiz) {
      if (Math.abs(e.deltaX) < 4) return;
      e.preventDefault();
      shiftThrottled(e.deltaX > 0 ? 1 : -1);
    } else if (e.shiftKey) {
      e.preventDefault();
      shiftThrottled(e.deltaY > 0 ? 1 : -1);
    }
  };

  // Ячейки
  const cells: DayCellData[] = useMemo(() => {
    const planByDate = new Map<string, PlanEventLite[]>();
    for (const p of plans) {
      const list = planByDate.get(p.date) ?? [];
      list.push(p);
      planByDate.set(p.date, list);
    }

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
      const dowIdx = (d.getDay() + 6) % 7;
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

  return (
    <div
      ref={rootRef}
      className={[
        'pb-full-week',
        collapsed ? 'is-collapsed' : '',
        pinned ? 'is-pinned' : 'is-unpinned',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onWheel={handleWheel}
    >
      {/* Toolbar */}
            <div className="pb-full-week__toolbar">
        <div className="pb-full-week__pin-slot" ref={pinSlotRef}>
          <Button
            icon={pinned ? 'pi pi-lock' : 'pi pi-lock-open'}
            className={`pb-soft p-button-sm pb-full-week__pin-btn ${
              !pinned ? 'is-floating' : ''
            }`}
            onClick={togglePin}
            tooltip={pinned ? 'Открепить от верха' : 'Прикрепить к верху'}
            tooltipOptions={{ position: 'bottom' }}
          />
        </div>
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
          tooltip="На день назад (←)"
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
          tooltip="На день вперёд (→)"
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
        <div className="pb-full-week__grid" ref={gridRef}>
          {cells.map((c) => (
            <div
              key={c.iso}
              className={`pb-full-week__day ${
                c.isToday ? 'is-today' : ''
              } ${c.iso === centerIso ? 'is-center' : ''}`}
            >
              <div className="pb-full-week__day-head-row">
                <button
                  type="button"
                  className="pb-full-week__head"
                  onClick={onDayClick ? () => onDayClick(c.iso) : undefined}
                >
                  <span className="pb-full-week__dow">{c.dowShort}</span>
                  <span className="pb-full-week__num">{c.dayNum}</span>
                  <span className="pb-full-week__month">{c.monthShort}</span>
                </button>
                <Button
                  icon="pi pi-plus"
                  text
                  className="pb-full-week__log-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLogDate(c.iso);
                  }}
                  tooltip="Записать факт"
                  tooltipOptions={{ position: 'top' }}
                />
              </div>

              <DaySummary log={c.wellness} />

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

      <LogWorkoutSessionDialog
        visible={!!logDate}
        planEvent={null}
        freeDate={logDate}
        onHide={() => setLogDate(null)}
        onSaved={() => {
          setLogDate(null);
        }}
      />
    </div>
  );
};