// src/components/COMMON/MiniWeek/MiniWeek.tsx
//
// Компактная неделя — 7 ячеек для режима «Неделя» в CalendarPanel.
// Props-only. Ячейка: день недели, число, месяц, две полоски
// (план / факт). Клик по дню — onDayClick.
// Отдельный, более богатый вид недели (со связкой факт↔план,
// wellness, мини-таймлайнами) — FullWeek, отдельным компонентом.

import React, { useMemo } from 'react';
import './MiniWeek.css';

interface Props {
  /** YYYY-MM-DD — понедельник недели. */
  weekStart: string;
  planDays: Set<string>;
  factDays: Set<string>;
  onDayClick?: (date: string) => void;
  className?: string;
}

const DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const MiniWeek: React.FC<Props> = ({
  weekStart,
  planDays,
  factDays,
  onDayClick,
  className,
}) => {
  const today = useMemo(() => toIso(new Date()), []);

  const days = useMemo(() => {
    const start = parseIso(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return {
        iso: toIso(d),
        day: d.getDate(),
        dow: DOW_SHORT[i],
        month: MONTH_SHORT[d.getMonth()],
      };
    });
  }, [weekStart]);

  return (
    <div className={`common-mini-week ${className ?? ''}`}>
      {days.map((d) => {
        const hasPlan = planDays.has(d.iso);
        const hasFact = factDays.has(d.iso);
        const isToday = d.iso === today;
        return (
          <button
            key={d.iso}
            type="button"
            className={`common-mini-week__day ${isToday ? 'is-today' : ''}`}
            onClick={onDayClick ? () => onDayClick(d.iso) : undefined}
            data-date={d.iso}
          >
            <span className="common-mini-week__dow">{d.dow}</span>
            <span className="common-mini-week__num">{d.day}</span>
            <span className="common-mini-week__month">{d.month}</span>
            <span className="common-mini-week__marks">
              <span
                className={`common-mini-week__mark common-mini-week__mark--plan ${
                  hasPlan ? 'is-on' : ''
                }`}
              />
              <span
                className={`common-mini-week__mark common-mini-week__mark--fact ${
                  hasFact ? 'is-on' : ''
                }`}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
};