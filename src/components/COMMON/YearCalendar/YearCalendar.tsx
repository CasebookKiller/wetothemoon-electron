// src/components/COMMON/YearCalendar/YearCalendar.tsx
//
// Год как 12 мини-месяцев. Каждый день — кнопка с точкой-маркером:
//   teal   — был план на этот день
//   green  — была пробежка
//   обе    — полу-полу метка
// Props-only.

import React, { useMemo } from 'react';
import './YearCalendar.css';

interface Props {
  year: number;
  /** Множество дат 'YYYY-MM-DD' с планом. */
  planDays: Set<string>;
  /** Множество дат 'YYYY-MM-DD' с фактом. */
  factDays: Set<string>;
  onDayClick?: (date: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const DOW_LABELS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];

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
  // Понедельник = 0
  const dow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: DayCell[] = [];
  for (let i = 0; i < dow; i++) {
    cells.push({ date: '', day: 0, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toIso(year, month, d), day: d, inMonth: true });
  }
  // Дополняем до 42 ячеек (6×7) — все месяцы одной высоты.
  while (cells.length < 42) {
    cells.push({ date: '', day: 0, inMonth: false });
  }
  return cells;
}

export const YearCalendar: React.FC<Props> = ({
  year,
  planDays,
  factDays,
  onDayClick,
  className,
}) => {
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, m) => buildMonthGrid(year, m)),
    [year]
  );

  return (
    <div className={`common-year-cal ${className ?? ''}`}>
      {months.map((cells, m) => (
        <div key={m} className="common-year-cal__month">
          <div className="common-year-cal__month-title">
            {MONTH_NAMES[m]}
          </div>
          <div className="common-year-cal__dow">
            {DOW_LABELS.map((d, i) => (
              <span key={i} className="common-year-cal__dow-cell">
                {d}
              </span>
            ))}
          </div>
          <div className="common-year-cal__grid">
            {cells.map((c, i) => {
              if (!c.inMonth) {
                return (
                  <span
                    key={i}
                    className="common-year-cal__cell common-year-cal__cell--empty"
                  />
                );
              }
              const hasPlan = planDays.has(c.date);
              const hasFact = factDays.has(c.date);
              const cls = [
                'common-year-cal__cell',
                hasPlan && 'has-plan',
                hasFact && 'has-fact',
                hasPlan && hasFact && 'has-both',
              ]
                .filter(Boolean)
                .join(' ');
              const parts = [c.date];
              if (hasPlan) parts.push('план');
              if (hasFact) parts.push('факт');
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={onDayClick ? () => onDayClick(c.date) : undefined}
                  data-tip={parts.join(' · ')}
                >
                  <span className="common-year-cal__day-num">{c.day}</span>
                  <span className="common-year-cal__marker" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};