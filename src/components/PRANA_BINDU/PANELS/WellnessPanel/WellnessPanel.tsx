// src/components/PRANA_BINDU/PANELS/WellnessPanel/WellnessPanel.tsx
//
// Панель «Здоровье · intervals.icu»: таблица recovery_logs за период,
// клик по строке открывает WellnessDrawer.
//
// Диапазон приходит пропсами (from/to) — родитель хранит его для
// других панелей. Родитель может вызвать reload() через ref после
// sync-wellness.

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { Panel } from 'primereact/panel';
import {
  WellnessDrawer,
  type RecoveryLogLite,
} from '@/components/PRANA_BINDU/WellnessDrawer';

export interface WellnessPanelHandle {
  reload: () => Promise<void>;
}

interface Props {
  /** Нижняя граница диапазона. */
  from: Date;
  /** Верхняя граница диапазона. */
  to: Date;
  className?: string;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const WellnessPanel = forwardRef<WellnessPanelHandle, Props>(
  ({ from, to, className }, ref) => {
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

    return (
      <Panel
        header="Здоровье · intervals.icu"
        className={`shadow-5 mb-3 pb-panel ${className ?? ''}`}
      >
        {logs.length === 0 ? (
          <small className="pb-hint">
            Нет данных за выбранный диапазон. Нажмите «Подтянуть здоровье»
            в панели «Синхронизация (API)».
          </small>
        ) : (
          <div className="pb-wellness-table pb-wellness-table--scrollable">
            <div className="pb-wellness-table__header">
              <span>Дата</span>
              <span title="Пульс покоя">RHR</span>
              <span title="Сон, часов">Сон</span>
              <span title="Sleep score">Score</span>
              <span title="Шаги">Шаги</span>
              <span title="Chronic Training Load">CTL</span>
              <span title="Acute Training Load">ATL</span>
            </div>
            <div className="pb-wellness-table__body">
              {logs.map((r) => {
                const rhrCls =
                  r.resting_hr == null
                    ? ''
                    : r.resting_hr <= avgRhr - 2
                    ? 'pb-wellness-table__val--good'
                    : r.resting_hr >= avgRhr + 3
                    ? 'pb-wellness-table__val--warn'
                    : '';

                return (
                  <div
                    key={r.date}
                    className="pb-wellness-table__row pb-wellness-table__row--clickable"
                    onClick={() => {
                      setSelected(r as RecoveryLogLite);
                      setDrawerVisible(true);
                    }}
                    title="Открыть полную карточку дня"
                  >
                    <span className="pb-wellness-table__date">
                      {r.date}
                    </span>
                    <span className={`pb-wellness-table__val ${rhrCls}`}>
                      {r.resting_hr ?? '—'}
                    </span>
                    <span className="pb-wellness-table__val">
                      {r.sleep_hours != null
                        ? r.sleep_hours.toFixed(1)
                        : '—'}
                    </span>
                    <span className="pb-wellness-table__val">
                      {r.sleep_score ?? '—'}
                    </span>
                    <span className="pb-wellness-table__val">
                      {r.steps != null
                        ? r.steps.toLocaleString('ru-RU')
                        : '—'}
                    </span>
                    <span className="pb-wellness-table__val pb-wellness-table__val--dim">
                      {r.ctl != null ? r.ctl.toFixed(1) : '—'}
                    </span>
                    <span className="pb-wellness-table__val pb-wellness-table__val--dim">
                      {r.atl != null ? r.atl.toFixed(1) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <WellnessDrawer
          visible={drawerVisible}
          log={selected}
          onHide={() => setDrawerVisible(false)}
        />
      </Panel>
    );
  }
);

WellnessPanel.displayName = 'WellnessPanel';