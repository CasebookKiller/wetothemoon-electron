// src/components/PRANA_BINDU/DodofoDebugDialog.tsx
//
// Отладочная панель: сырые ответы dodofo API.
// Показывает thresholds / zones / streams для одной тренировки.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputNumber } from 'primereact/inputnumber';
import { Message } from 'primereact/message';

interface Props {
  visible: boolean;
  onHide: () => void;
  initialRunFactId?: number | null;
}

interface DebugState {
  loading: boolean;
  error: string;
  raw: unknown;
  meta?: { fetchMs?: number; sizeBytes?: number };
}

const EMPTY: DebugState = { loading: false, error: '', raw: null };

interface ChannelStat {
  key: string;
  length: number;
  uniq: number;
  min: number;
  max: number;
  avg: number;
  stddev: number;
  flat: 'ok' | 'low' | 'flat';
}

function analyzeChannels(payload: unknown): ChannelStat[] {
  if (!payload || typeof payload !== 'object') return [];
  const stats: ChannelStat[] = [];

  for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
    if (!Array.isArray(val) || val.length === 0) continue;
    if (typeof val[0] !== 'number') continue;

    const nums = (val as number[]).filter(
      (x) => typeof x === 'number' && Number.isFinite(x)
    );
    if (nums.length === 0) continue;

    const uniq = new Set(nums).size;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance =
      nums.reduce((a, b) => a + (b - avg) ** 2, 0) / nums.length;
    const stddev = Math.sqrt(variance);

    let flat: 'ok' | 'low' | 'flat' = 'ok';
    if (uniq <= 2) flat = 'flat';
    else if (uniq < 20 || stddev < 1) flat = 'low';

    stats.push({ key, length: nums.length, uniq, min, max, avg, stddev, flat });
  }

  return stats;
}

const FLAT_META: Record<
  ChannelStat['flat'],
  { icon: string; label: string; cls: string }
> = {
  ok:   { icon: 'pi pi-check-circle', label: 'OK',      cls: 'pb-chan--ok' },
  low:  { icon: 'pi pi-exclamation-triangle', label: 'Low var', cls: 'pb-chan--low' },
  flat: { icon: 'pi pi-times-circle', label: 'Flat',    cls: 'pb-chan--flat' },
};

export const DodofoDebugDialog: React.FC<Props> = ({
  visible,
  onHide,
  initialRunFactId,
}) => {
  const api = (window as any).electronAPI;

  const [runFactId, setRunFactId] = useState<number | null>(
    initialRunFactId ?? null
  );

  const [thresholds, setThresholds] = useState<DebugState>(EMPTY);
  const [zones, setZones] = useState<DebugState>(EMPTY);
  const [streams, setStreams] = useState<DebugState>(EMPTY);

  useEffect(() => {
    if (visible) {
      setRunFactId(initialRunFactId ?? null);
    }
  }, [visible, initialRunFactId]);

  const loadThresholds = async () => {
    setThresholds({ loading: true, error: '', raw: null });
    try {
      const res = await api.pb.debugThresholds();
      if (res?.success) {
        setThresholds({
          loading: false,
          error: '',
          raw: res.data,
          meta: { fetchMs: res.fetchMs },
        });
      } else {
        setThresholds({
          loading: false,
          error: res?.error ?? 'Ошибка',
          raw: null,
        });
      }
    } catch (e) {
      setThresholds({ loading: false, error: (e as Error).message, raw: null });
    }
  };

  const loadZones = async () => {
    setZones({ loading: true, error: '', raw: null });
    try {
      const res = await api.pb.debugZones();
      if (res?.success) {
        setZones({
          loading: false,
          error: '',
          raw: res.data,
          meta: { fetchMs: res.fetchMs },
        });
      } else {
        setZones({
          loading: false,
          error: res?.error ?? 'Ошибка',
          raw: null,
        });
      }
    } catch (e) {
      setZones({ loading: false, error: (e as Error).message, raw: null });
    }
  };

  const loadStreams = async () => {
    if (runFactId == null) {
      setStreams({
        loading: false,
        error: 'Укажите run_fact id',
        raw: null,
      });
      return;
    }
    setStreams({ loading: true, error: '', raw: null });
    try {
      // debugStreams дёргает dodofo API напрямую, не читает из БД.
      const res = await api.pb.debugStreams(runFactId, { writeFile: false });
      if (res?.success) {
        setStreams({
          loading: false,
          error: '',
          raw: res.data,
          meta: { fetchMs: res.fetchMs },
        });
      } else {
        setStreams({
          loading: false,
          error: res?.error ?? 'Ошибка',
          raw: null,
        });
      }
    } catch (e) {
      setStreams({ loading: false, error: (e as Error).message, raw: null });
    }
  };

  const copyToClipboard = (label: string, raw: unknown) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
      console.log(`[debug] Скопировано: ${label}`);
    } catch {
      // ignore
    }
  };

  const renderState = (
    state: DebugState,
    label: string,
    onReload: () => void
  ) => {
    if (state.loading) {
      return <div className="pb-debug__hint">Загрузка…</div>;
    }
    if (state.error) {
      return (
        <>
          <Message severity="error" text={state.error} className="w-full mb-2" />
          <Button
            label="Повторить"
            icon="pi pi-refresh"
            className="pb-soft p-button-sm"
            onClick={onReload}
          />
        </>
      );
    }
    if (!state.raw) {
      return (
        <>
          <div className="pb-debug__hint">Нет данных. Нажмите «Загрузить».</div>
          <Button
            label="Загрузить"
            icon="pi pi-cloud-download"
            className="pb p-button-sm"
            onClick={onReload}
          />
        </>
      );
    }
    return (
      <>
        <div className="pb-debug__meta">
          {state.meta?.fetchMs != null && (
            <span>fetch {state.meta.fetchMs} мс</span>
          )}
          {state.meta?.sizeBytes != null && (
            <span>{state.meta.sizeBytes} Б</span>
          )}
          <Button
            label="Загрузить заново"
            icon="pi pi-refresh"
            className="pb-soft p-button-sm"
            onClick={onReload}
          />
          <Button
            label="Копировать JSON"
            icon="pi pi-copy"
            className="pb-soft p-button-sm"
            onClick={() => copyToClipboard(label, state.raw)}
          />
        </div>
        <pre className="pb-debug__pre">
          {JSON.stringify(state.raw, null, 2)}
        </pre>
      </>
    );
  };

    const renderStreamsState = () => {
    if (streams.loading) {
      return <div className="pb-debug__hint">Загрузка…</div>;
    }
    if (streams.error) {
      return (
        <>
          <Message severity="error" text={streams.error} className="w-full mb-2" />
          <Button
            label="Повторить"
            icon="pi pi-refresh"
            className="pb-soft p-button-sm"
            onClick={loadStreams}
          />
        </>
      );
    }
    if (!streams.raw) {
      return (
        <>
          <div className="pb-debug__hint">Нет данных. Нажмите «Загрузить».</div>
          <Button
            label="Загрузить"
            icon="pi pi-cloud-download"
            className="pb p-button-sm"
            onClick={loadStreams}
          />
        </>
      );
    }

    const channels = analyzeChannels(streams.raw);

    return (
      <>
        <div className="pb-debug__meta">
          {streams.meta?.sizeBytes != null && (
            <span>{streams.meta.sizeBytes} Б</span>
          )}
          <Button
            label="Загрузить заново"
            icon="pi pi-refresh"
            className="pb-soft p-button-sm"
            onClick={loadStreams}
          />
          <Button
            label="Копировать JSON"
            icon="pi pi-copy"
            className="pb-soft p-button-sm"
            onClick={() => copyToClipboard('streams', streams.raw)}
          />
        </div>

        {channels.length > 0 && (
          <div className="pb-chan-list">
            <div className="pb-chan-list__title">
              Каналы ({channels.length}):
            </div>
            {channels.map((c) => {
              const meta = FLAT_META[c.flat];
              return (
                <div key={c.key} className={`pb-chan ${meta.cls}`}>
                  <i className={meta.icon} />
                  <span className="pb-chan__key">{c.key}</span>
                  <span className="pb-chan__badge">{meta.label}</span>
                  <span className="pb-chan__meta">
                    n={c.length} · уник={c.uniq} · σ={c.stddev.toFixed(2)} ·{' '}
                    {c.min.toFixed(1)}…{c.max.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <pre className="pb-debug__pre">
          {JSON.stringify(streams.raw, null, 2)}
        </pre>
      </>
    );
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <span className="p-dialog-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <i className="pi pi-code" />
          Отладка dodofo API
        </span>
      }
      style={{ width: '900px', maxWidth: '96vw' }}
      modal
      maximizable
      className="pb-debug-dialog"
    >
      <div className="pb-debug__body">
                <div className="pb-debug__runfact">
          <label className="pb-label">run_fact id для streams</label>
          <InputNumber
            value={runFactId}
            onValueChange={(e) => setRunFactId(e.value ?? null)}
            placeholder="напр. 85"
            showButtons
            buttonLayout="horizontal"
            incrementButtonIcon="pi pi-plus"
            decrementButtonIcon="pi pi-minus"
            min={1}
            className="pb-debug__input"
          />
          <small className="pb-hint pb-debug__runfact-hint">
            Из таблицы «Пробежки» — id виден в DevTools или в БД.
          </small>
        </div>

        <TabView>
          <TabPanel header="Thresholds">
            {renderState(thresholds, 'thresholds', loadThresholds)}
          </TabPanel>
          <TabPanel header="Zones">
            {renderState(zones, 'zones', loadZones)}
          </TabPanel>
          <TabPanel header="Streams">
            {renderStreamsState()}
          </TabPanel>
        </TabView>
      </div>
    </Dialog>
  );
};