// src/components/PRANA_BINDU/RunsPanel/RunsTableGrouped.tsx
//
// Вид с группировкой по дням: заголовок дня + строки-пробежки под ним.
// rowGroupMode="subheader" из PrimeReact (несовместимо с виртуализацией).
// Вместо пагинации — прогрессивная подгрузка: сначала 100 групп, при
// скролле к концу добавляем ещё 100.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Button } from 'primereact/button';
import type { RunFactLite } from '../../RunStreamsDrawer';
import type { GroupedRunFact } from '../../UTILS/groupRunFacts';
import type { RunsTableProps } from './types';
import {
  countByDate,
  fmtDayHeader,
  fmtDuration,
  fmtKm,
  pluralRun,
} from './utils';

const CHUNK_SIZE = 25;
const SCROLL_THRESHOLD_PX = 50;

const RunsTableGroupedInner: React.FC<RunsTableProps> = ({
  items,
  loading,
  onOpenFact,
}) => {
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  // При смене items (фильтр, диапазон) — сбрасываем на первую порцию.
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [items]);

  // Подгрузка по скроллу к концу.
  useEffect(() => {
    const wrapper = tableRef.current?.querySelector(
      '.p-datatable-wrapper'
    ) as HTMLElement | null;
    if (!wrapper) return;

    const onScroll = () => {
      const nearEnd =
        wrapper.scrollTop + wrapper.clientHeight >=
        wrapper.scrollHeight - SCROLL_THRESHOLD_PX;
      if (!nearEnd) return;
      setVisibleCount((prev) => {
        if (prev >= items.length) return prev;
        return Math.min(prev + CHUNK_SIZE, items.length);
      });
    };

    wrapper.addEventListener('scroll', onScroll, { passive: true });
    return () => wrapper.removeEventListener('scroll', onScroll);
  }, [items.length]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  const runsPerDay = useMemo(() => countByDate(visibleItems), [visibleItems]);

  const hasMore = visibleCount < items.length;
  const remaining = items.length - visibleCount;

  return (
    <div className="pb-runs-table-wrap" ref={tableRef}>
      <DataTable
        value={visibleItems}
        loading={loading}
        size="small"
        stripedRows
        scrollable
        scrollHeight="flex"
        emptyMessage="За выбранный период пробежек нет"
        className="p-datatable-sm pb-runs-table"
        selectionMode="single"
        rowGroupMode="subheader"
        groupRowsBy="date"
        rowGroupHeaderTemplate={(data: GroupedRunFact) => {
          const { date, dow } = fmtDayHeader(data.date);
          const n = runsPerDay[data.date] ?? 1;
          return (
            <div className="pb-runs-day-header">
              <i className="pi pi-calendar pb-runs-day-header__icon" />
              <span className="pb-runs-day-header__date">{date}</span>
              <span className="pb-runs-day-header__dow">{dow}</span>
              <span className="pb-runs-day-header__count">
                {n} {pluralRun(n)}
              </span>
            </div>
          );
        }}
        onRowClick={(e) => {
          const g = e.data as GroupedRunFact;
          onOpenFact({
            ...(g.primary as RunFactLite),
            start_time: g.startTime,
          } as RunFactLite);
        }}
      >
        <Column
          header=""
          style={{ width: '40px', textAlign: 'center' }}
          body={(r: GroupedRunFact) =>
            r.hasStreams ? (
              <i
                className="pi pi-chart-line"
                style={{ color: 'var(--pb-accent)' }}
                title="Есть потоки"
              />
            ) : (
              <i
                className="pi pi-minus"
                style={{ opacity: 0.25 }}
                title="Потоков нет"
              />
            )
          }
        />
        <Column
          header="Время"
          style={{ width: '70px' }}
          body={(r: GroupedRunFact) => {
            if (!r.startTime) return '—';
            const t = new Date(r.startTime);
            if (Number.isNaN(t.getTime())) return '—';
            return (
              <span className="pb-runs-time">
                {String(t.getHours()).padStart(2, '0')}:
                {String(t.getMinutes()).padStart(2, '0')}
              </span>
            );
          }}
        />
        <Column
          header="Название"
          style={{ width: '220px' }}
          body={(r: GroupedRunFact) => r.displayName}
        />
        <Column
          header="Км"
          style={{ width: '80px' }}
          body={(r: GroupedRunFact) => fmtKm(r.primary.actual_km)}
        />
        <Column
          header="Темп"
          style={{ width: '80px' }}
          body={(r: GroupedRunFact) => r.primary.actual_pace ?? '—'}
        />
        <Column
          header="Длительность"
          style={{ width: '100px' }}
          body={(r: GroupedRunFact) => fmtDuration(r.primary.duration_sec)}
        />
        <Column
          header="Ср. пульс"
          style={{ width: '100px' }}
          body={(r: GroupedRunFact) => r.primary.avg_hr ?? '—'}
        />
        <Column
          header="Макс. пульс"
          style={{ width: '110px' }}
          body={(r: GroupedRunFact) => r.primary.max_hr ?? '—'}
        />
        <Column
          header="Источники"
          style={{ width: '160px' }}
          body={(r: GroupedRunFact) => (
            <div className="pb-source-badges">
              {r.sources.map((s: any, i: any) => (
                <span
                  key={`${r.date}-${s}-${i}`}
                  className={`pb-source-badge pb-source-badge--${s}`}
                  title={s}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        />
      </DataTable>

      {/* Футер: счётчик + кнопка «Показать все» */}
      <div className="pb-runs-more">
        <span className="pb-runs-more__counter">
          {visibleItems.length} из {items.length}
        </span>
        {hasMore ? (
          <Button
            label={`Показать ещё ${Math.min(CHUNK_SIZE, remaining)}`}
            icon="pi pi-chevron-down"
            className="pb-soft p-button-sm pb-runs-more__btn"
            onClick={() =>
              setVisibleCount((prev) =>
                Math.min(prev + CHUNK_SIZE, items.length)
              )
            }
          />
        ) : (
          <span className="pb-runs-more__end">всё</span>
        )}
      </div>
    </div>
  );
};

export const RunsTableGrouped = React.memo(RunsTableGroupedInner);