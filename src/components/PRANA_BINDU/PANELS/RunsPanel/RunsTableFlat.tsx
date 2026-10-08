// src/components/PRANA_BINDU/RunsPanel/RunsTableFlat.tsx
//
// Плоский вид таблицы пробежек: одна строка на группу источников.
// Виртуализация включена — с 900+ датами остаётся отзывчивым.

import React from 'react';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import type { RunFactLite } from '../../RunStreamsDrawer';
import type { GroupedRunFact } from '../../UTILS/groupRunFacts';
import type { RunsTableProps } from './types';
import { fmtDuration, fmtKm } from './utils';

const RunsTableFlatInner: React.FC<RunsTableProps> = ({
  items,
  loading,
  onOpenFact,
}) => {
  return (
    <DataTable
      value={items}
      loading={loading}
      size="small"
      stripedRows
      scrollable
      scrollHeight="520px"
      virtualScrollerOptions={{ itemSize: 38 }}
      emptyMessage="За выбранный период пробежек нет"
      className="p-datatable-sm"
      selectionMode="single"
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
        field="date"
        header="Дата"
        sortable
        style={{ width: '140px' }}
        body={(r: GroupedRunFact) => {
          let time = '';
          if (r.startTime) {
            const t = new Date(r.startTime);
            if (!Number.isNaN(t.getTime())) {
              time = ` ${String(t.getHours()).padStart(2, '0')}:${String(
                t.getMinutes()
              ).padStart(2, '0')}`;
            }
          }
          return (
            <span title={`Источников: ${r.count}`}>
              {r.date}
              {time}
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
        sortable
        sortField="primary.actual_km"
        style={{ width: '80px' }}
        body={(r: GroupedRunFact) => fmtKm(r.primary.actual_km)}
      />
      <Column
        header="Темп"
        style={{ width: '80px' }}
        body={(r: GroupedRunFact) => r.primary.actual_pace ?? '—'}
      />
      <Column
        header="Время"
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
  );
};

export const RunsTableFlat = React.memo(RunsTableFlatInner);