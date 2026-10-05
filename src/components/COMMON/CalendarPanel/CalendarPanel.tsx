// src/components/COMMON/CalendarPanel/CalendarPanel.tsx
//
// Контейнер календарей: [Год] [Квартал] [Месяц] [Неделя].
// Пока год / квартал / месяц; недельный — заглушка.
// Данные подгружает через переданный loadRange callback.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { YearCalendar } from '../YearCalendar/YearCalendar';
import { QuarterCalendar } from '../QuarterCalendar/QuarterCalendar';
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function quarterStartMonth(month: number): number {
  return Math.floor(month / 3) * 3;
}

function quarterLabel(year: number, startMonth: number): string {
  return `Q${Math.floor(startMonth / 3) + 1} ${year}`;
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
    // quarter
    const m1 = qStartMonth;
    const m2 = qStartMonth + 2;
    const lastDay = new Date(qYear, m2 + 1, 0).getDate();
    return {
      from: `${qYear}-${pad2(m1 + 1)}-01`,
      to: `${qYear}-${pad2(m2 + 1)}-${pad2(lastDay)}`,
    };
  }, [mode, year, qYear, qStartMonth, mYear, mMonth]);

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
    }
  };

  const headerLabel = useMemo(() => {
    if (mode === 'year') return String(year);
    if (mode === 'quarter') return quarterLabel(qYear, qStartMonth);
    if (mode === 'month') return `${MONTH_NAMES[mMonth]} ${mYear}`;
    return 'Неделя';
  }, [mode, year, qYear, qStartMonth, mYear, mMonth]);

  const canShift = mode !== 'week';

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
            disabled={!canShift || loading}
            tooltip="Назад"
          />
          <span className="common-cal-panel__label">{headerLabel}</span>
          <Button
            icon="pi pi-chevron-right"
            className="pb-soft p-button-sm"
            onClick={() => shift(1)}
            disabled={!canShift || loading}
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
          <div className="common-cal-panel__stub">
            <i className="pi pi-calendar" />
            <span>
              Недельный календарь появится позже — сейчас год, квартал
              и месяц.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};