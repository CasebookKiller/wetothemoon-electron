// src/components/PRANA_BINDU/RunsPanel/RunsTableGrouped.tsx
//
// Вид с группировкой по дням: заголовок дня + строки-пробежки под ним.
// rowGroupMode="subheader" из PrimeReact. Виртуализация отключена —
// subheader-режим требует, чтобы все строки были в DOM.

import React, { useMemo } from 'react';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import type { RunFactLite } from '../RunStreamsDrawer';
import type { GroupedRunFact } from '../UTILS/groupRunFacts';
import type { RunsTableProps } from './types';
import {
  countByDate,
  fmtDayHeader,
  fmtDuration,
  fmtKm,
  pluralRun,
} from './utils';

const RunsTableGroupedInner: React.FC<RunsTableProps> = ({
  items,
  loading,
  onOpenFact,
}) => {
  const runsPerDay = useMemo(() => countByDate(items), [items]);

  return (
    <div className="pb-runs-table-wrap">
      <DataTable
        value={items}
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
        paginator
        rows={25}
        rowsPerPageOptions={[25, 50, 100, 250, 500, 1000]}
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
        currentPageReportTemplate="{first}–{last} из {totalRecords}"
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
              {r.sources.map((s, i) => (
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
    </div>
  );
};

export const RunsTableGrouped = React.memo(RunsTableGroupedInner);