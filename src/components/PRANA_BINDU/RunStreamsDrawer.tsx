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
import { GpsMapView } from './GpsMapView';
import { InputText } from 'primereact/inputtext';

/**
 * Порог, при котором две записи считаются одной тренировкой
 * из разных источников (не утро+вечер).
 * Синхронизировано с PranaBinduPage.tsx.
 */
const SAME_WORKOUT_WINDOW_MIN = 30;
const SAME_WORKOUT_WINDOW_MS = SAME_WORKOUT_WINDOW_MIN * 60 * 1000;

export interface RunFactLite {
  id: number;
  date: string;
  start_time?: string | null;
  source: string | null;
  origin?: string | null;
  name?: string | null;        // ← новое
  user_name?: string | null;   // ← новое
  actual_km: number | null;
  actual_pace: string | null;
  duration_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  gps_quality?: string | null;   // ← новое
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

function normalizeGpsQuality(v: unknown): 'good' | 'poor' | 'lost' {
  if (v === 'poor' || v === 'lost' || v === 'good') return v;
  return 'good';
}

// ==================== SourcePanel ====================

const SourcePanel: React.FC<{
  fact: RunFactLite;
  onAfterSync: () => void;
}> = ({ fact, onAfterSync }) => {
  const api = (window as any).electronAPI;

  const [metas, setMetas] = useState<RunStreamMeta[]>([]);
  const [streamsPayload, setStreamsPayload] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [localUserName, setLocalUserName] = useState<string | null>(
    fact.user_name ?? null
  );

  useEffect(() => {
    setLocalUserName(fact.user_name ?? null);
  }, [fact.id, fact.user_name]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setInfo('');
    setStreamsPayload(null);
    (async () => {
      try {
        const res = await api.pb.getRunStreamsMeta(fact.id);
        if (res?.success && Array.isArray(res.items) && res.items.length > 0) {
          setMetas(res.items);
          // Подтягиваем payload первого источника — для карты
          const firstSource = res.items[0].source;
          const p = await api.pb.getRunStreams(fact.id, firstSource);
          if (p?.success) setStreamsPayload(p.payload);
        } else {
          setMetas([]);
        }
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

  const [editingName, setEditingName] = useState(false);
  const [userNameDraft, setUserNameDraft] = useState('');

  const startEditName = () => {
    setUserNameDraft(fact.user_name ?? '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = userNameDraft.trim() || null;
    const res = await api.pb.updateRunFactName(fact.id, trimmed);
    if (res?.success) {
      setLocalUserName(trimmed);
      setEditingName(false);
      onAfterSync();
    } else {
      setError(res?.error ?? 'Не удалось сохранить название');
    }
  };

  const cancelEditName = () => {
    setEditingName(false);
    setUserNameDraft('');
  };

  return (
    <div className="pb-source-panel">
      <div className="pb-source-panel__source">
        <span className="pb-source-panel__badge">{sourceLabel(fact)}</span>
      </div>

      <div className="pb-drawer__names">
        {!editingName ? (
          <>
            <span className="pb-drawer__name-primary">
              {localUserName || fact.name || (
                <span className="pb-drawer__empty-inline">Без названия</span>
              )}
            </span>
            <Button
              icon="pi pi-pencil"
              text
              className="pb-drawer__name-edit"
              onClick={startEditName}
              tooltip="Переименовать"
              tooltipOptions={{ position: 'left' }}
            />
          </>
        ) : (
          <>
            <InputText
              value={userNameDraft}
              onChange={(e) => setUserNameDraft(e.target.value)}
              placeholder="Своё название (пусто = сброс)"
              className="pb-drawer__name-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') cancelEditName();
              }}
            />
            <Button
              icon="pi pi-check"
              text
              className="pb-drawer__name-edit"
              onClick={saveName}
              tooltip="Сохранить"
              tooltipOptions={{ position: 'left' }}
            />
            <Button
              icon="pi pi-times"
              text
              className="pb-drawer__name-edit"
              onClick={cancelEditName}
              tooltip="Отмена"
              tooltipOptions={{ position: 'left' }}
            />
          </>
        )}
      </div>

      {localUserName && fact.name && (
        <div className="pb-drawer__name-original">
          провайдерское: {fact.name}
        </div>
      )}

      <div className="pb-drawer__section-title">Сводка</div>
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

      {streamsPayload?.latlng && (
        <>
          <div className="pb-drawer__section-title">Карта</div>
          <GpsMapView
            latlng={streamsPayload.latlng}
            hr={streamsPayload.hr}
            elevation={streamsPayload.elevationM}
            gpsQuality={normalizeGpsQuality(fact.gps_quality)}
            height={280}
          />
        </>
      )}

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
          const all: RunFactLite[] = res.items.map((r: any) => ({
            id: r.id,
            date: r.date,
            start_time: r.start_time ?? null,
            source: r.source,
            origin: r.origin ?? null,
            name: r.name ?? null,            // ← добавить
            user_name: r.user_name ?? null,  // ← добавить
            actual_km: r.actual_km,
            actual_pace: r.actual_pace,
            duration_sec: r.duration_sec,
            avg_hr: r.avg_hr,
            max_hr: r.max_hr,
            gps_quality: r.gps_quality ?? null,   // ← новое
          }));

          // Фильтр: только источники, относящиеся к той же тренировке,
          // что и кликнутая строка.
          const anchorMs = runFact.start_time
            ? new Date(runFact.start_time).getTime()
            : null;

          const filtered = anchorMs
            ? all.filter((f) => {
                const ms = f.start_time
                  ? new Date(f.start_time).getTime()
                  : null;
                // Нет времени хотя бы у одного → та же тренировка
                if (anchorMs == null || ms == null) return true;
                return Math.abs(ms - anchorMs) <= SAME_WORKOUT_WINDOW_MS;
              })
            : all;

          setFacts(filtered.length > 0 ? filtered : [runFact]);
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
  }, [visible, runFact?.date, runFact?.id, runFact?.start_time]);

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