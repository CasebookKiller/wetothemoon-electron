// src/components/COMMON/QuarterCalendar/QuarterCalendar.tsx
//
// Календарь на N месяцев: 1 — месяц, 3 — квартал.
// Ячейка-день крупнее, чем в годовом. В ячейке две полоски:
//   верхняя — план (teal)
//   нижняя  — факт (accent-цвет, override на уровне модуля)
// Props-only, ничего не грузит само.

import React, { useMemo } from 'react';
import './QuarterCalendar.css';

interface Props {
  year: number;
  /** 0..11 — месяц начала диапазона. */
  startMonth: number;
  /** Сколько месяцев показать. 3 — квартал, 1 — месяц. */
  monthCount?: 1 | 3;
  planDays: Set<string>;
  factDays: Set<string>;
  onDayClick?: (date: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const DOW_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
}

function buildMonthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: DayCell[] = [];
  for (let i = 0; i < dow; i++) {
    cells.push({ date: '', day: 0, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toIso(year, month, d), day: d, inMonth: true });
  }
  while (cells.length < 42) {
    cells.push({ date: '', day: 0, inMonth: false });
  }
  return cells;
}

export const QuarterCalendar: React.FC<Props> = ({
  year,
  startMonth,
  monthCount = 3,
  planDays,
  factDays,
  onDayClick,
  className,
}) => {
  const months = useMemo(() => {
    return Array.from({ length: monthCount }, (_, offset) =>
      buildMonthGrid(year, startMonth + offset)
    );
  }, [year, startMonth, monthCount]);

  return (
    <div
      className={`common-quarter-cal ${
        monthCount === 1 ? 'common-quarter-cal--single' : ''
      } ${className ?? ''}`}
      style={
        { ['--q-month-count' as string]: String(monthCount) } as React.CSSProperties
      }
    >
      {months.map((cells, mIdx) => {
        const monthIndex = startMonth + mIdx;
        return (
          <div key={mIdx} className="common-quarter-cal__month">
            <div className="common-quarter-cal__month-title">
              {MONTH_NAMES[monthIndex]} {year}
            </div>
            <div className="common-quarter-cal__dow">
              {DOW_LABELS.map((d, i) => (
                <span key={i} className="common-quarter-cal__dow-cell">
                  {d}
                </span>
              ))}
            </div>
            <div className="common-quarter-cal__grid">
              {cells.map((c, i) => {
                if (!c.inMonth) {
                  return (
                    <span
                      key={i}
                      className="common-quarter-cal__cell common-quarter-cal__cell--empty"
                    />
                  );
                }
                const hasPlan = planDays.has(c.date);
                const hasFact = factDays.has(c.date);
                return (
                  <button
                    key={i}
                    type="button"
                    className="common-quarter-cal__cell"
                    onClick={
                      onDayClick ? () => onDayClick(c.date) : undefined
                    }
                    data-date={c.date}
                  >
                    <span className="common-quarter-cal__day-num">
                      {c.day}
                    </span>
                    <span className="common-quarter-cal__marks">
                      <span
                        className={`common-quarter-cal__mark common-quarter-cal__mark--plan ${
                          hasPlan ? 'is-on' : ''
                        }`}
                      />
                      <span
                        className={`common-quarter-cal__mark common-quarter-cal__mark--fact ${
                          hasFact ? 'is-on' : ''
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};