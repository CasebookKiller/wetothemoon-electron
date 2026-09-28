// src/components/PRANA_BINDU/RunStreamsDrawer.tsx
//
// Drawer с деталями тренировки и метаданными потоков.
// Пока — без графиков, только список источников.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Sidebar } from 'primereact/sidebar';

export interface RunFactLite {
  id: number;
  date: string;
  actual_km: number | null;
  actual_pace: string | null;
  duration_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  source: string | null;
}

interface RunStreamMeta {
  run_fact_id: number;
  source: string;
  point_count: number | null;
  size_bytes: number;
  fetched_at: string;
}

interface Props {
  visible: boolean;
  runFact: RunFactLite | null;
  onHide: () => void;
  onAfterSync: () => void;
}

function fmtKm(v: number | null): string {
  return v == null ? '—' : v.toFixed(2);
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}ч ${String(m).padStart(2, '0')}м`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const RunStreamsDrawer: React.FC<Props> = ({
  visible,
  runFact,
  onHide,
  onAfterSync,
}) => {
  const api = (window as any).electronAPI;

  const [metas, setMetas] = useState<RunStreamMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!visible || !runFact) return;
    setError('');
    setInfo('');
    setLoading(true);
    (async () => {
      try {
        const res = await api.pb.getRunStreamsMeta(runFact.id);
        if (res?.success) setMetas(res.items ?? []);
        else setError(res?.error ?? 'Ошибка загрузки метаданных');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, runFact?.id]);

  const handleSync = async () => {
    if (!runFact) return;
    setSyncing(true);
    setError('');
    setInfo('');
    try {
      const res = await api.pb.syncRunStreams(runFact.id);
      if (res?.success) {
        setInfo(
          `Загружено: ${res.pointCount} точек, ${fmtSize(res.sizeBytes)}, за ${res.fetchMs} мс`
        );
        const reload = await api.pb.getRunStreamsMeta(runFact.id);
        if (reload?.success) setMetas(reload.items ?? []);
        onAfterSync();
      } else {
        setError(res?.error ?? 'Не удалось загрузить потоки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const hasStreams = metas.length > 0;

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      style={{ width: '520px', maxWidth: '95vw' }}
      className="pb-drawer"
    >
      <div className="pb-drawer__header">
        <div className="pb-drawer__title">
          <i className="pi pi-chart-line pb-drawer__icon" />
          Тренировка {runFact?.date ?? ''}
        </div>
        {runFact?.id != null && (
          <div className="pb-drawer__id">#{runFact.id}</div>
        )}
      </div>

      {runFact && (
        <div className="pb-drawer__summary">
          <div className="pb-drawer__row">
            <span className="pb-drawer__label">Дистанция</span>
            <span>{fmtKm(runFact.actual_km)} км</span>
          </div>
          <div className="pb-drawer__row">
            <span className="pb-drawer__label">Время</span>
            <span>{fmtDuration(runFact.duration_sec)}</span>
          </div>
          <div className="pb-drawer__row">
            <span className="pb-drawer__label">Темп</span>
            <span>{runFact.actual_pace ?? '—'}</span>
          </div>
          <div className="pb-drawer__row">
            <span className="pb-drawer__label">Ср. / макс. пульс</span>
            <span>
              {runFact.avg_hr ?? '—'} / {runFact.max_hr ?? '—'}
            </span>
          </div>
          <div className="pb-drawer__row">
            <span className="pb-drawer__label">Источник</span>
            <span>{runFact.source ?? '—'}</span>
          </div>
        </div>
      )}

      <div className="pb-drawer__section-title">
        Потоки {hasStreams && <span className="pb-drawer__count">({metas.length})</span>}
      </div>

      {loading && <div className="pb-drawer__hint">Загрузка…</div>}

      {!loading && !hasStreams && (
        <div className="pb-drawer__empty">
          Потоки ещё не загружены.
        </div>
      )}

      {!loading && hasStreams && (
        <div className="pb-drawer__streams">
          {metas.map((m) => (
            <div key={`${m.run_fact_id}-${m.source}`} className="pb-drawer__stream-item">
              <div className="pb-drawer__stream-source">
                <i className="pi pi-database" /> {m.source}
              </div>
              <div className="pb-drawer__stream-meta">
                <span>{m.point_count ?? '—'} точек</span>
                <span className="pb-drawer__dot">·</span>
                <span>{fmtSize(m.size_bytes)}</span>
                <span className="pb-drawer__dot">·</span>
                <span>{fmtTime(m.fetched_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <Message severity="error" text={error} className="w-full mt-2" />}
      {info && <Message severity="success" text={info} className="w-full mt-2" />}

      <div className="pb-drawer__actions">
        <Button
          label={syncing ? 'Загрузка…' : hasStreams ? 'Обновить потоки' : 'Загрузить потоки'}
          icon={syncing ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-download'}
          className="pb p-button-sm"
          onClick={handleSync}
          disabled={syncing || !runFact}
        />
        <Button
          label="Закрыть"
          icon="pi pi-times"
          className="pb-soft p-button-sm"
          onClick={onHide}
          disabled={syncing}
        />
      </div>
    </Sidebar>
  );
};