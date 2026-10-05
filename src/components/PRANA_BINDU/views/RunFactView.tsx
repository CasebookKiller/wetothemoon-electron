// src/components/PRANA_BINDU/views/RunFactView.tsx
//
// Полная карточка пробежки без Sidebar — для вкладки «Факт» в DayDrawer.
// Функциональность идентична RunStreamsDrawer: группировка источников
// одной тренировки, вкладки, streams meta, карта, график, sync.
// Сверху — кнопка «← К дню».

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { RunStreamsChart } from '../RunStreamsChart';
import { GpsMapView } from '../GpsMapView';
import type { RunFactLite } from '../RunStreamsDrawer';

/**
 * Порог, при котором две записи считаются одной тренировкой
 * из разных источников (не утро+вечер).
 * Синхронизировано с PranaBinduPage.tsx и RunStreamsDrawer.tsx.
 */
const SAME_WORKOUT_WINDOW_MIN = 30;
const SAME_WORKOUT_WINDOW_MS = SAME_WORKOUT_WINDOW_MIN * 60 * 1000;

interface Props {
  fact: RunFactLite;
  onBack: () => void;
  onChanged: () => void;
}

interface RunStreamMeta {
  run_fact_id: number;
  source: string;
  point_count: number | null;
  size_bytes: number;
  fetched_at: string;
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
  if (f.source === 'fit' && f.origin === 'zepp-app') return 'zepp';
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
        const p = await api.pb.getRunStreams(fact.id, res.source ?? metas[0]?.source);
        if (p?.success) setStreamsPayload(p.payload);
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

      {fact.name && (
        <div className="pb-drawer__provider-name">
          <span className="pb-drawer__label">Провайдерское:</span>
          <span className="pb-drawer__provider-value">{fact.name}</span>
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

// ==================== RunFactView ====================

export const RunFactView: React.FC<Props> = ({
  fact,
  onBack,
  onChanged,
}) => {
  const api = (window as any).electronAPI;

  const [facts, setFacts] = useState<RunFactLite[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [groupEditingName, setGroupEditingName] = useState(false);
  const [groupUserNameDraft, setGroupUserNameDraft] = useState('');
  const [groupUserName, setGroupUserName] = useState<string | null>(null);

  useEffect(() => {
    setLoadingFacts(true);
    setActiveIndex(0);

    (async () => {
      try {
        const res = await api.pb.listRunFactsByDate(fact.date);
        if (res?.success && Array.isArray(res.items) && res.items.length > 0) {
          const all: RunFactLite[] = res.items.map((r: any) => ({
            id: r.id,
            date: r.date,
            start_time: r.start_time ?? null,
            source: r.source,
            origin: r.origin ?? null,
            name: r.name ?? null,
            user_name: r.user_name ?? null,
            actual_km: r.actual_km,
            actual_pace: r.actual_pace,
            duration_sec: r.duration_sec,
            avg_hr: r.avg_hr,
            max_hr: r.max_hr,
            gps_quality: r.gps_quality ?? null,
          }));

          const anchorMs = fact.start_time
            ? new Date(fact.start_time).getTime()
            : null;

          const filtered = anchorMs
            ? all.filter((f) => {
                const ms = f.start_time
                  ? new Date(f.start_time).getTime()
                  : null;
                if (anchorMs == null || ms == null) return true;
                return Math.abs(ms - anchorMs) <= SAME_WORKOUT_WINDOW_MS;
              })
            : all;

          setFacts(filtered.length > 0 ? filtered : [fact]);
        } else {
          setFacts([fact]);
        }
      } catch {
        setFacts([fact]);
      } finally {
        setLoadingFacts(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fact.id, fact.date, fact.start_time]);

  useEffect(() => {
    if (facts.length === 0) {
      setGroupUserName(null);
      return;
    }
    const first = facts.find((f) => f.user_name)?.user_name ?? null;
    setGroupUserName(first);
  }, [facts]);

  const hasMulti = facts.length > 1;

  const startGroupEditName = () => {
    setGroupUserNameDraft(groupUserName ?? '');
    setGroupEditingName(true);
  };

  const cancelGroupEditName = () => {
    setGroupEditingName(false);
    setGroupUserNameDraft('');
  };

  const saveGroupName = async () => {
    const trimmed = groupUserNameDraft.trim() || null;
    const ids = facts.map((f) => f.id);
    const res = await api.pb.updateRunGroupName(ids, trimmed);
    if (res?.success) {
      setGroupUserName(trimmed);
      setFacts((prev) => prev.map((f) => ({ ...f, user_name: trimmed })));
      setGroupEditingName(false);
      onChanged();
    } else {
      console.error('[RunFactView] saveGroupName:', res?.error);
    }
  };

  return (
    <div className="pb-run-fact-view">
      {/* Навигация назад */}
      <div className="pb-plan-event-view__back">
        <Button
          label="← К дню"
          icon="pi pi-arrow-left"
          className="pb-soft p-button-sm"
          onClick={onBack}
        />
        {hasMulti && (
          <span className="pb-drawer__count">
            источников: {facts.length}
          </span>
        )}
      </div>

      {/* Название группы */}
      {!loadingFacts && facts.length > 0 && (() => {
        const activeFact = facts[activeIndex] ?? facts[0];
        const providerName = activeFact?.name ?? null;
        const canCopy = providerName != null;
        return (
          <div className="pb-drawer__group-name-row">
            {!groupEditingName ? (
              <>
                <span className="pb-drawer__group-name">
                  {groupUserName || (
                    <span className="pb-drawer__empty-inline">
                      Без названия — задайте своё
                    </span>
                  )}
                </span>
                {canCopy && (
                  <Button
                    icon="pi pi-copy"
                    text
                    className="pb-drawer__name-edit"
                    onClick={async () => {
                      const ids = facts.map((f) => f.id);
                      const res = await api.pb.updateRunGroupName(ids, providerName);
                      if (res?.success) {
                        setGroupUserName(providerName);
                        setFacts((prev) =>
                          prev.map((f) => ({ ...f, user_name: providerName }))
                        );
                        onChanged();
                      }
                    }}
                    tooltip={
                      providerName === groupUserName
                        ? `Уже скопировано: ${providerName}`
                        : `Скопировать: ${providerName}`
                    }
                    tooltipOptions={{ position: 'bottom' }}
                  />
                )}
                <Button
                  icon="pi pi-pencil"
                  text
                  className="pb-drawer__name-edit"
                  onClick={startGroupEditName}
                  tooltip="Переименовать"
                  tooltipOptions={{ position: 'bottom' }}
                />
              </>
            ) : (
              <>
                <InputText
                  value={groupUserNameDraft}
                  onChange={(e) => setGroupUserNameDraft(e.target.value)}
                  placeholder="Название тренировки (пусто = сброс)"
                  className="pb-drawer__name-input"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveGroupName();
                    if (e.key === 'Escape') cancelGroupEditName();
                  }}
                />
                <Button
                  icon="pi pi-check"
                  text
                  className="pb-drawer__name-edit"
                  onClick={saveGroupName}
                  tooltip="Сохранить"
                  tooltipOptions={{ position: 'bottom' }}
                />
                <Button
                  icon="pi pi-times"
                  text
                  className="pb-drawer__name-edit"
                  onClick={cancelGroupEditName}
                  tooltip="Отмена"
                  tooltipOptions={{ position: 'bottom' }}
                />
              </>
            )}
          </div>
        );
      })()}

      {loadingFacts && (
        <div className="pb-drawer__hint">Загрузка источников…</div>
      )}

      {!loadingFacts && !hasMulti && facts[0] && (
        <SourcePanel fact={facts[0]} onAfterSync={onChanged} />
      )}

      {!loadingFacts && hasMulti && (
        <TabView
          activeIndex={activeIndex}
          onTabChange={(e) => setActiveIndex(e.index)}
          onWheel={(e: React.WheelEvent<HTMLDivElement>) => {
            const nav = (e.currentTarget as HTMLElement).querySelector(
              '.p-tabview-nav'
            ) as HTMLElement | null;
            if (!nav) return;
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              nav.scrollLeft += e.deltaY;
            }
          }}
        >
          {facts.map((f) => (
            <TabPanel key={f.id} header={sourceLabel(f)}>
              <SourcePanel fact={f} onAfterSync={onChanged} />
            </TabPanel>
          ))}
        </TabView>
      )}
    </div>
  );
};