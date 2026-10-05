// src/components/COMMON/CalendarPanel/CalendarPanel.tsx
//
// Контейнер календарей: [Год] [Квартал] [Месяц] [Неделя].
// Данные подгружает через переданный loadRange callback.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { YearCalendar } from '../YearCalendar/YearCalendar';
import { QuarterCalendar } from '../QuarterCalendar/QuarterCalendar';
import { MiniWeek } from '../MiniWeek/MiniWeek';
import './CalendarPanel.css';

export type CalendarMode = 'year' | 'quarter' | 'month' | 'week';

interface Props {
  loadRange: (
    from: string,
    to: string
  ) => Promise<{ planDays: Set<string>; factDays: Set<string> }>;
  onDayClick?: (date: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

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

/** Понедельник недели, в которую попадает дата. */
function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // Пн = 0
  r.setDate(r.getDate() - dow);
  return r;
}

function quarterStartMonth(month: number): number {
  return Math.floor(month / 3) * 3;
}

function quarterLabel(year: number, startMonth: number): string {
  return `Q${Math.floor(startMonth / 3) + 1} ${year}`;
}

function fmtWeekRange(fromIso: string, toIsoStr: string): string {
  const f = parseIso(fromIso);
  const t = parseIso(toIsoStr);
  const fm = MONTH_SHORT[f.getMonth()];
  const tm = MONTH_SHORT[t.getMonth()];

  if (f.getFullYear() !== t.getFullYear()) {
    return `${f.getDate()} ${fm} ${f.getFullYear()} – ${t.getDate()} ${tm} ${t.getFullYear()}`;
  }
  if (f.getMonth() === t.getMonth()) {
    return `${f.getDate()} – ${t.getDate()} ${fm} ${t.getFullYear()}`;
  }
  return `${f.getDate()} ${fm} – ${t.getDate()} ${tm} ${t.getFullYear()}`;
}

export const CalendarPanel: React.FC<Props> = ({
  loadRange,
  onDayClick,
  className,
}) => {
  const today = useMemo(() => new Date(), []);

  const [mode, setMode] = useState<CalendarMode>('year');

  // Год
  const [year, setYear] = useState(today.getFullYear());

  // Квартал
  const [qYear, setQYear] = useState(today.getFullYear());
  const [qStartMonth, setQStartMonth] = useState(
    quarterStartMonth(today.getMonth())
  );

  // Месяц
  const [mYear, setMYear] = useState(today.getFullYear());
  const [mMonth, setMMonth] = useState(today.getMonth());

  // Неделя — ISO понедельника недели
  const [wStartIso, setWStartIso] = useState<string>(
    () => toIso(mondayOf(new Date()))
  );

  const [planDays, setPlanDays] = useState<Set<string>>(new Set());
  const [factDays, setFactDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Интервал зависит от режима
  const range = useMemo(() => {
    if (mode === 'year') {
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    if (mode === 'month') {
      const lastDay = new Date(mYear, mMonth + 1, 0).getDate();
      return {
        from: `${mYear}-${pad2(mMonth + 1)}-01`,
        to: `${mYear}-${pad2(mMonth + 1)}-${pad2(lastDay)}`,
      };
    }
    if (mode === 'week') {
      const s = parseIso(wStartIso);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return { from: wStartIso, to: toIso(e) };
    }
    // quarter
    const m1 = qStartMonth;
    const m2 = qStartMonth + 2;
    const lastDay = new Date(qYear, m2 + 1, 0).getDate();
    return {
      from: `${qYear}-${pad2(m1 + 1)}-01`,
      to: `${qYear}-${pad2(m2 + 1)}-${pad2(lastDay)}`,
    };
  }, [mode, year, qYear, qStartMonth, mYear, mMonth, wStartIso]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadRange(range.from, range.to)
      .then((r) => {
        if (!alive) return;
        setPlanDays(r.planDays);
        setFactDays(r.factDays);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [range.from, range.to, loadRange]);

  const shift = (dir: -1 | 1) => {
    if (mode === 'year') {
      setYear((y) => y + dir);
    } else if (mode === 'quarter') {
      let m = qStartMonth + dir * 3;
      let y = qYear;
      while (m < 0) { m += 12; y -= 1; }
      while (m > 9) { m -= 12; y += 1; }
      setQStartMonth(m);
      setQYear(y);
    } else if (mode === 'month') {
      let m = mMonth + dir;
      let y = mYear;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      setMMonth(m);
      setMYear(y);
    } else if (mode === 'week') {
      const d = parseIso(wStartIso);
      d.setDate(d.getDate() + dir * 7);
      setWStartIso(toIso(d));
    }
  };

  const headerLabel = useMemo(() => {
    if (mode === 'year') return String(year);
    if (mode === 'quarter') return quarterLabel(qYear, qStartMonth);
    if (mode === 'month') return `${MONTH_NAMES[mMonth]} ${mYear}`;
    // week
    const s = parseIso(wStartIso);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return fmtWeekRange(wStartIso, toIso(e));
  }, [mode, year, qYear, qStartMonth, mYear, mMonth, wStartIso]);

  return (
    <div className={`common-cal-panel ${className ?? ''}`}>
      <div className="common-cal-panel__toolbar">
        <div className="common-cal-panel__modes">
          <button
            type="button"
            className={mode === 'year' ? 'is-active' : ''}
            onClick={() => setMode('year')}
          >
            Год
          </button>
          <button
            type="button"
            className={mode === 'quarter' ? 'is-active' : ''}
            onClick={() => setMode('quarter')}
          >
            Квартал
          </button>
          <button
            type="button"
            className={mode === 'month' ? 'is-active' : ''}
            onClick={() => setMode('month')}
          >
            Месяц
          </button>
          <button
            type="button"
            className={mode === 'week' ? 'is-active' : ''}
            onClick={() => setMode('week')}
          >
            Неделя
          </button>
        </div>

        <div className="common-cal-panel__nav">
          <Button
            icon="pi pi-chevron-left"
            className="pb-soft p-button-sm"
            onClick={() => shift(-1)}
            disabled={loading}
            tooltip="Назад"
          />
          <span className="common-cal-panel__label">{headerLabel}</span>
          <Button
            icon="pi pi-chevron-right"
            className="pb-soft p-button-sm"
            onClick={() => shift(1)}
            disabled={loading}
            tooltip="Вперёд"
          />
          {loading && (
            <i className="pi pi-spin pi-spinner common-cal-panel__spin" />
          )}
        </div>

        <div className="common-cal-panel__legend pb-hint">
          <span className="common-cal-panel__dot common-cal-panel__dot--plan" /> план
          <span className="common-cal-panel__sep">·</span>
          <span className="common-cal-panel__dot common-cal-panel__dot--fact" /> факт
        </div>
      </div>

      <div className="common-cal-panel__body">
        {mode === 'year' && (
          <YearCalendar
            year={year}
            planDays={planDays}
            factDays={factDays}
            onDayClick={onDayClick}
          />
        )}
        {mode === 'quarter' && (
          <QuarterCalendar
            year={qYear}
            startMonth={qStartMonth}
            monthCount={3}
            planDays={planDays}
            factDays={factDays}
            onDayClick={onDayClick}
          />
        )}
        {mode === 'month' && (
          <QuarterCalendar
            year={mYear}
            startMonth={mMonth}
            monthCount={1}
            planDays={planDays}
            factDays={factDays}
            onDayClick={onDayClick}
          />
        )}
        {mode === 'week' && (
          <MiniWeek
            weekStart={wStartIso}
            planDays={planDays}
            factDays={factDays}
            onDayClick={onDayClick}
          />
        )}
      </div>
    </div>
  );
};