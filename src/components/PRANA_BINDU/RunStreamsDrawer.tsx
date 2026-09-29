// src/components/PRANA_BINDU/RunStreamsDrawer.tsx
//
// Drawer с деталями одного дня.
// Если за дату есть несколько источников (dodofo + fit) — показывает TabView,
// по вкладке на источник. Внутри каждой вкладки — сводка, график, потоки.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Sidebar } from 'primereact/sidebar';
import { TabView, TabPanel } from 'primereact/tabview';
import { RunStreamsChart } from './RunStreamsChart';

export interface RunFactLite {
  id: number;
  date: string;
  source: string | null;
  origin?: string | null;
  actual_km: number | null;
  actual_pace: string | null;
  duration_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
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

// ==================== Форматтеры ====================

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

function sourceLabel(f: RunFactLite): string {
  if (f.source === 'fit' && f.origin) return `fit · ${f.origin}`;
  return f.source ?? '—';
}

// ==================== SourcePanel ====================

const SourcePanel: React.FC<{
  fact: RunFactLite;
  onAfterSync: () => void;
}> = ({ fact, onAfterSync }) => {
  const api = (window as any).electronAPI;

  const [metas, setMetas] = useState<RunStreamMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setInfo('');
    (async () => {
      try {
        const res = await api.pb.getRunStreamsMeta(fact.id);
        if (res?.success) setMetas(res.items ?? []);
        else setError(res?.error ?? 'Ошибка загрузки метаданных');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fact.id]);

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setInfo('');
    try {
      const res = await api.pb.syncRunStreams(fact.id);
      if (res?.success) {
        if (res.alreadyInDb) {
          setInfo(
            `Уже в БД: ${res.pointCount ?? '—'} точек, ${fmtSize(res.sizeBytes ?? 0)}`
          );
        } else {
          setInfo(
            `Загружено: ${res.pointCount ?? '—'} точек, ${fmtSize(res.sizeBytes ?? 0)}, за ${res.fetchMs ?? '—'} мс`
          );
        }
        const reload = await api.pb.getRunStreamsMeta(fact.id);
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
    <div className="pb-source-panel">
      <div className="pb-source-panel__source">
        <span className="pb-source-panel__badge">{sourceLabel(fact)}</span>
      </div>

      <div className="pb-drawer__summary">
        <div className="pb-drawer__row">
          <span className="pb-drawer__label">Дистанция</span>
          <span>{fmtKm(fact.actual_km)} км</span>
        </div>
        <div className="pb-drawer__row">
          <span className="pb-drawer__label">Время</span>
          <span>{fmtDuration(fact.duration_sec)}</span>
        </div>
        <div className="pb-drawer__row">
          <span className="pb-drawer__label">Темп</span>
          <span>{fact.actual_pace ?? '—'}</span>
        </div>
        <div className="pb-drawer__row">
          <span className="pb-drawer__label">Ср. / макс. пульс</span>
          <span>
            {fact.avg_hr ?? '—'} / {fact.max_hr ?? '—'}
          </span>
        </div>
      </div>

      {hasStreams && metas[0] && (
        <>
          <div className="pb-drawer__section-title">График</div>
          <RunStreamsChart
            runFactId={fact.id}
            source={metas[0].source}
            refreshKey={metas[0].fetched_at}
          />
        </>
      )}

      <div className="pb-drawer__section-title">
        Потоки{' '}
        {hasStreams && (
          <span className="pb-drawer__count">({metas.length})</span>
        )}
      </div>

      {loading && <div className="pb-drawer__hint">Загрузка…</div>}

      {!loading && !hasStreams && (
        <div className="pb-drawer__empty">Потоки ещё не загружены.</div>
      )}

      {!loading && hasStreams && (
        <div className="pb-drawer__streams">
          {metas.map((m) => (
            <div
              key={`${m.run_fact_id}-${m.source}`}
              className="pb-drawer__stream-item"
            >
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

      {error && (
        <Message severity="error" text={error} className="w-full mt-2" />
      )}
      {info && (
        <Message severity="success" text={info} className="w-full mt-2" />
      )}

      <div className="pb-drawer__actions">
        <Button
          label={
            syncing
              ? 'Загрузка…'
              : hasStreams
              ? 'Обновить потоки'
              : 'Загрузить потоки'
          }
          icon={syncing ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-download'}
          className="pb p-button-sm"
          onClick={handleSync}
          disabled={syncing}
        />
      </div>
    </div>
  );
};

// ==================== RunStreamsDrawer ====================

export const RunStreamsDrawer: React.FC<Props> = ({
  visible,
  runFact,
  onHide,
  onAfterSync,
}) => {
  const api = (window as any).electronAPI;

  const [facts, setFacts] = useState<RunFactLite[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!visible || !runFact) return;
    setLoadingFacts(true);
    setActiveIndex(0);

    (async () => {
      try {
        const res = await api.pb.listRunFactsByDate(runFact.date);
        if (res?.success && Array.isArray(res.items) && res.items.length > 0) {
          const items: RunFactLite[] = res.items.map((r: any) => ({
            id: r.id,
            date: r.date,
            source: r.source,
            origin: r.origin ?? null,
            actual_km: r.actual_km,
            actual_pace: r.actual_pace,
            duration_sec: r.duration_sec,
            avg_hr: r.avg_hr,
            max_hr: r.max_hr,
          }));
          setFacts(items);
        } else {
          setFacts([runFact]);
        }
      } catch {
        setFacts([runFact]);
      } finally {
        setLoadingFacts(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, runFact?.date, runFact?.id]);

  const hasMulti = facts.length > 1;

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      style={{ width: '560px', maxWidth: '96vw' }}
      className="pb-drawer"
    >
      <div className="pb-drawer__header">
        <div className="pb-drawer__title">
          <i className="pi pi-chart-line pb-drawer__icon" />
          {runFact?.date ?? ''}
          {hasMulti && (
            <span className="pb-drawer__count">
              {' '}
              · источников: {facts.length}
            </span>
          )}
        </div>
      </div>

      {loadingFacts && (
        <div className="pb-drawer__hint">Загрузка источников…</div>
      )}

      {!loadingFacts && !hasMulti && facts[0] && (
        <SourcePanel fact={facts[0]} onAfterSync={onAfterSync} />
      )}

      {!loadingFacts && hasMulti && (
        <TabView
          activeIndex={activeIndex}
          onTabChange={(e) => setActiveIndex(e.index)}
        >
          {facts.map((f) => (
            <TabPanel key={f.id} header={sourceLabel(f)}>
              <SourcePanel fact={f} onAfterSync={onAfterSync} />
            </TabPanel>
          ))}
        </TabView>
      )}
    </Sidebar>
  );
};