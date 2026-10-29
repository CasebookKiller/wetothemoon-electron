// src/components/PRANA_BINDU/PANELS/WellnessPanel/WellnessPanel.tsx

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Panel } from 'primereact/panel';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { WellnessDrawer, type RecoveryLogLite } from '@/components/PRANA_BINDU/WellnessDrawer';

export interface WellnessPanelHandle {
  reload: () => Promise<void>;
}

interface Props {
  from: Date;
  to: Date;
  className?: string;
  embedded?: boolean;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const WellnessPanel = forwardRef<WellnessPanelHandle, Props>(
  ({ from, to, className, embedded }, ref) => {
    const api = (window as any).electronAPI;

    const [logs, setLogs] = useState<any[]>([]);
    const [selected, setSelected] = useState<RecoveryLogLite | null>(null);
    const [drawerVisible, setDrawerVisible] = useState(false);

    const load = async () => {
      if (!api?.pb?.listRecoveryLogs) return;
      try {
        const res = await api.pb.listRecoveryLogs(
          toIsoDate(from),
          toIsoDate(to)
        );
        if (res?.success) setLogs(res.items ?? []);
      } catch {
        /* ignore */
      }
    };

    useImperativeHandle(ref, () => ({ reload: load }), [from, to]);

    useEffect(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to]);

    const avgRhr =
      logs.filter((x) => x.resting_hr != null).reduce(
        (a, x) => a + x.resting_hr,
        0
      ) / (logs.filter((x) => x.resting_hr != null).length || 1);

    const content = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%' }}>
        <DataTable
          value={logs}
          size="small"
          stripedRows
          scrollable
          // ЖЕСТКАЯ ВЫСОТА ДЛЯ ТЕСТА (85vh диалога минус шапка и табы)
          scrollHeight="flex" 
          emptyMessage="Нет данных за выбранный диапазон. Нажмите «Подтянуть здоровье» в панели «Синхронизация (API)»."
          className="p-datatable-sm pb-runs-table"
          selectionMode="single"
          onRowClick={(e) => {
            setSelected(e.data as RecoveryLogLite);
            setDrawerVisible(true);
          }}
        >
          <Column field="date" header="Дата" style={{ width: '110px' }} />
          <Column
            header="RHR"
            style={{ width: '70px' }}
            body={(r) => {
              const rhrCls =
                r.resting_hr == null
                  ? ''
                  : r.resting_hr <= avgRhr - 2
                  ? 'pb-wellness-table__val--good'
                  : r.resting_hr >= avgRhr + 3
                  ? 'pb-wellness-table__val--warn'
                  : '';
              return <span className={rhrCls}>{r.resting_hr ?? '—'}</span>;
            }}
          />
          <Column
            header="Сон"
            style={{ width: '70px' }}
            body={(r) => (r.sleep_hours != null ? r.sleep_hours.toFixed(1) : '—')}
          />
          <Column
            header="Score"
            style={{ width: '80px' }}
            body={(r) => r.sleep_score ?? '—'}
          />
          <Column
            header="Шаги"
            style={{ width: '100px' }}
            body={(r) => (r.steps != null ? r.steps.toLocaleString('ru-RU') : '—')}
          />
          <Column
            header="CTL"
            style={{ width: '70px' }}
            body={(r) => (
              <span className="pb-wellness-table__val--dim">
                {r.ctl != null ? r.ctl.toFixed(1) : '—'}
              </span>
            )}
          />
          <Column
            header="ATL"
            style={{ width: '70px' }}
            body={(r) => (
              <span className="pb-wellness-table__val--dim">
                {r.atl != null ? r.atl.toFixed(1) : '—'}
              </span>
            )}
          />
        </DataTable>

        <WellnessDrawer
          visible={drawerVisible}
          log={selected}
          onHide={() => setDrawerVisible(false)}
        />
      </div>
    );

    if (embedded) {
      return (
        <div className={className ?? ''} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {content}
        </div>
      );
    }

    return (
      <Panel
        header="Здоровье · intervals.icu"
        className={`shadow-5 mb-3 pb-panel ${className ?? ''}`}
      >
        {content}
      </Panel>
    );
  }
);

WellnessPanel.displayName = 'WellnessPanel';