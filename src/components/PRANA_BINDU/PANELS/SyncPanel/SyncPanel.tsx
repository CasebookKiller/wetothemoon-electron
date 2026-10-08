// src/components/PRANA_BINDU/PANELS/SyncPanel/SyncPanel.tsx
//
// Панель «Синхронизация (API)»: диапазон, провайдер, 6 операций
// синхронизации, прогресс-бар заливки потоков, все статусы.
//
// Диапазон (from/to) — controlled: живёт в родителе, потому что
// используется другими панелями (WellnessPanel, MirrorDeleteDialog,
// DeleteGeneratedDialog, DayDrawer, loadRunFacts/loadPlanEvents).
//
// Провайдер и providerCaps — локальные: только здесь и нужны.
//
// AutoSyncPanel встроен внизу панели.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { Panel } from 'primereact/panel';
import { ProgressBar } from 'primereact/progressbar';
import { AutoSyncPanel } from '../AutoSyncPanel/AutoSyncPanel';

// ==================== Провайдеры ====================

interface ProviderOption {
  label: string;
  value: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { label: 'dodofo (активности)', value: 'dodofo' },
  { label: 'intervals.icu (активности + события)', value: 'intervals-icu' },
  { label: 'dofek-zepp (резерв)', value: 'dofek-zepp' },
  { label: 'zepp-mcp (не реализован)', value: 'zepp-mcp' },
  { label: 'zeppbridge (не реализован)', value: 'zeppbridge' },
];

interface ProviderCaps {
  workouts: boolean;
  streams: boolean;
  thresholds: boolean;
  zones: boolean;
  wellness: boolean;
}

// ==================== Утилиты ====================

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultSyncRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from, to };
}

// ==================== Props ====================

interface Props {
  // Диапазон — controlled, живёт в родителе.
  from: Date;
  to: Date;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;

  // Открыть диалог отладки (DodofoDebugDialog рендерится в родителе).
  onOpenDebug: () => void;

  // Коллбэки после успешных операций.
  onAfterSync?: () => void | Promise<void>;
  onAfterThresholds?: () => void | Promise<void>;
  onAfterZones?: () => void | Promise<void>;
  onAfterWellness?: () => void | Promise<void>;

  className?: string;
}

export const SyncPanel: React.FC<Props> = ({
  from,
  to,
  onFromChange,
  onToChange,
  onOpenDebug,
  onAfterSync,
  onAfterThresholds,
  onAfterZones,
  onAfterWellness,
  className,
}) => {
  const api = (window as any).electronAPI;

  const [provider, setProvider] = useState<string>('dodofo');
  const [providerCaps, setProviderCaps] = useState<ProviderCaps | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    added: number;
    updated: number;
    total: number;
  } | null>(null);
  const [syncError, setSyncError] = useState('');

  const [syncingStreams, setSyncingStreams] = useState(false);
  const [overwriteStreams, setOverwriteStreams] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.syncOverwriteStreams') === '1';
    } catch {
      return false;
    }
  });
  const [streamsAllResult, setStreamsAllResult] = useState<{
    fetched: number;
    skipped: number;
    failed: number;
    total: number;
  } | null>(null);
  const [streamsAllError, setStreamsAllError] = useState('');

  const [syncingThresholds, setSyncingThresholds] = useState(false);
  const [thresholdsResult, setThresholdsResult] = useState('');
  const [thresholdsError, setThresholdsError] = useState('');

  const [syncingZones, setSyncingZones] = useState(false);
  const [zonesResult, setZonesResult] = useState('');
  const [zonesError, setZonesError] = useState('');

  const [syncingWellness, setSyncingWellness] = useState(false);
  const [wellnessResult, setWellnessResult] = useState('');
  const [wellnessError, setWellnessError] = useState('');

  const [syncStreamsProgress, setSyncStreamsProgress] = useState<{
    current: number;
    total: number;
    runFactId: number;
    externalId: string | null;
    fetched: number;
    skipped: number;
    failed: number;
  } | null>(null);

  // Загрузка capabilities при смене провайдера
  useEffect(() => {
    (async () => {
      if (!api?.pb?.providerCapabilities) return;
      try {
        const res = await api.pb.providerCapabilities(provider);
        if (res?.success) setProviderCaps(res.data);
        else setProviderCaps(null);
      } catch {
        setProviderCaps(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Подписка на прогресс заливки потоков
  useEffect(() => {
    if (!api?.pb?.onSyncProgress) return;
    api.pb.onSyncProgress((data: any) => setSyncStreamsProgress(data));
    return () => {
      api.pb.removeSyncProgressListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (!api?.pb?.syncNow) {
      setSyncError('electronAPI.pb.syncNow недоступен');
      return;
    }
    setSyncing(true);
    setSyncError('');
    setSyncResult(null);
    try {
      const res = await api.pb.syncNow(
        toIsoDate(from),
        toIsoDate(to),
        provider
      );
      if (res.success) {
        setSyncResult({
          added: res.added ?? 0,
          updated: res.updated ?? 0,
          total: res.total ?? 0,
        });
        if (onAfterSync) await onAfterSync();
      } else {
        setSyncError(res.error ?? 'Неизвестная ошибка');
      }
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAllStreams = async () => {
    if (!api?.pb?.syncRunStreamsAll) {
      setStreamsAllError('electronAPI.pb.syncRunStreamsAll недоступен');
      return;
    }
    setSyncingStreams(true);
    setStreamsAllError('');
    setStreamsAllResult(null);
    setSyncStreamsProgress(null);
    try {
      const res = await api.pb.syncRunStreamsAll(
        toIsoDate(from),
        toIsoDate(to),
        { provider, onlyMissing: !overwriteStreams }
      );
      if (res.success) {
        setStreamsAllResult({
          fetched: res.fetched ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        if (onAfterSync) await onAfterSync();
      } else {
        setStreamsAllError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setStreamsAllError((e as Error).message);
    } finally {
      setSyncingStreams(false);
      setSyncStreamsProgress(null);
    }
  };

  const handleCancelSyncStreams = async () => {
    try {
      await api.pb.syncCancel?.();
    } catch {
      /* ignore */
    }
  };

  const handleSyncThresholds = async () => {
    if (!api?.pb?.syncThresholds) return;
    setSyncingThresholds(true);
    setThresholdsError('');
    setThresholdsResult('');
    try {
      const res = await api.pb.syncThresholds(provider);
      if (res.success) {
        setThresholdsResult((res.applied ?? []).join(' · ') || 'обновлено');
        if (onAfterThresholds) await onAfterThresholds();
      } else {
        setThresholdsError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setThresholdsError((e as Error).message);
    } finally {
      setSyncingThresholds(false);
    }
  };

  const handleSyncZones = async () => {
    if (!api?.pb?.syncZones) return;
    setSyncingZones(true);
    setZonesError('');
    setZonesResult('');
    try {
      const res = await api.pb.syncZones(provider);
      if (res.success) {
        setZonesResult(
          Array.isArray(res.zones) ? res.zones.join(' · ') : 'обновлено'
        );
        if (onAfterZones) await onAfterZones();
      } else {
        setZonesError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setZonesError((e as Error).message);
    } finally {
      setSyncingZones(false);
    }
  };

  const handleSyncWellness = async () => {
    if (!api?.pb?.syncWellness) return;
    setSyncingWellness(true);
    setWellnessError('');
    setWellnessResult('');
    try {
      const res = await api.pb.syncWellness(
        undefined,
        toIsoDate(from),
        toIsoDate(to)
      );

      if (!res.success) {
        setWellnessError(res.error ?? 'Ошибка');
        return;
      }

      const perProvider: Array<{
        provider: string;
        added: number;
        updated: number;
        total: number;
        error?: string;
      }> = res.perProvider ?? [];

      const errors = perProvider.filter((p) => p.error);
      const ok = perProvider.filter((p) => !p.error);

      const summary = `Добавлено ${res.added} · обновлено ${res.updated} · всего ${res.total}`;

      if (errors.length > 0) {
        const errLines = errors
          .map((p) => `${p.provider}: ${p.error}`)
          .join('; ');
        setWellnessError(`${summary}. Ошибки — ${errLines}`);
      }

      if (ok.length > 0) {
        const okLines = ok
          .map((p) => `${p.provider}: +${p.added} ~${p.updated}`)
          .join(' · ');
        setWellnessResult(`${summary} · ${okLines}`);
      } else if (errors.length === 0) {
        setWellnessResult(summary);
      }

      if (onAfterWellness) await onAfterWellness();
    } catch (e) {
      setWellnessError((e as Error).message);
    } finally {
      setSyncingWellness(false);
    }
  };

  const renderProviderForm = () => {
    if (provider === 'dodofo') {
      return (
        <small className="pb-hint">
          dodofo — основной агрегатор. Токен задаётся в панели
          «Подключения» выше.
        </small>
      );
    }
    if (provider === 'intervals-icu') {
      return (
        <small className="pb-hint">
          intervals.icu подключён как источник активностей и wellness.
          API-ключ и athlete ID — в панели «Подключения» выше.
        </small>
      );
    }
    if (provider === 'dofek-zepp') {
      return (
        <small className="pb-hint">
          dofek-zepp — резервный провайдер Zepp. Логин и пароль —
          в панели «Подключения» выше.
        </small>
      );
    }
    return (
      <small className="pb-hint">
        Провайдер «{provider}» пока не реализован.
        Используй dodofo или intervals-icu.
      </small>
    );
  };

  return (
    <Panel
      header="Синхронизация (API)"
      className={`shadow-5 mb-3 pb-panel ${className ?? ''}`}
    >
      <div className="flex flex-column gap-3">
        {/* Диапазон */}
        <div className="flex flex-column gap-2">
          <label className="pb-label">Диапазон</label>
          <div className="flex gap-2 flex-wrap align-items-center">
            <Calendar
              value={from}
              onChange={(e) => onFromChange(e.value as Date)}
              dateFormat="dd.mm.yy"
              placeholder="С"
              showIcon
              className="pb-cal"
              maxDate={to ?? undefined}
            />
            <span className="pb-hint">—</span>
            <Calendar
              value={to}
              onChange={(e) => onToChange(e.value as Date)}
              dateFormat="dd.mm.yy"
              placeholder="По"
              showIcon
              className="pb-cal"
              minDate={from ?? undefined}
            />
            <Button
              label="30 дней"
              icon="pi pi-calendar"
              className="pb-soft p-button-sm"
              onClick={() => {
                const r = defaultSyncRange();
                onFromChange(r.from);
                onToChange(r.to);
              }}
            />
            <Button
              label="За всё время"
              icon="pi pi-calendar-plus"
              className="pb-soft p-button-sm"
              onClick={() => {
                onFromChange(new Date(2020, 0, 1));
                onToChange(new Date());
              }}
            />
            <Button
              label="+30 дней"
              icon="pi pi-calendar"
              className="pb-soft p-button-sm"
              onClick={() => {
                const now = new Date();
                const to2 = new Date();
                to2.setDate(to2.getDate() + 30);
                onFromChange(now);
                onToChange(to2);
              }}
              tooltip="Текущий месяц + следующий"
            />
            <Button
              label="+90 дней"
              icon="pi pi-calendar-plus"
              className="pb-soft p-button-sm"
              onClick={() => {
                const now = new Date();
                const to2 = new Date();
                to2.setDate(to2.getDate() + 90);
                onFromChange(now);
                onToChange(to2);
              }}
              tooltip="Ближайший квартал"
            />
          </div>
        </div>

        {/* Провайдер */}
        <div className="flex flex-column gap-2">
          <label htmlFor="pb-provider" className="pb-label">
            Провайдер
          </label>
          <Dropdown
            inputId="pb-provider"
            value={provider}
            options={PROVIDER_OPTIONS}
            onChange={(e) => setProvider(e.value)}
            className="w-full"
            panelClassName="pb-dropdown-panel"
          />
          {renderProviderForm()}
        </div>

        <hr className="pb-sep" />

        {/* Операции */}
        <div className="flex flex-column gap-2">
          <label className="pb-label">Операции</label>
          <div className="flex gap-2 flex-wrap align-items-center">
            <Button
              label={syncing ? 'Синхронизация...' : 'Синхронизировать'}
              icon={syncing ? 'pi pi-spin pi-spinner' : 'pi pi-sync'}
              className="pb p-button-sm"
              onClick={handleSync}
              disabled={syncing || !providerCaps?.workouts}
              tooltip={
                !providerCaps?.workouts
                  ? `Провайдер «${provider}» не поддерживает список тренировок`
                  : 'Получить список активностей'
              }
            />
            <Button
              label={syncingStreams ? 'Потоки…' : 'Залить потоки'}
              icon={
                syncingStreams
                  ? 'pi pi-spin pi-spinner'
                  : 'pi pi-cloud-download'
              }
              className="pb-soft p-button-sm"
              onClick={handleSyncAllStreams}
              disabled={syncingStreams || !providerCaps?.streams}
              tooltip={
                !providerCaps?.streams
                  ? `Провайдер «${provider}» не поддерживает потоки`
                  : 'Загрузить FIT + потоки за выбранный период'
              }
            />
            <label className="pb-check-row pb-checkbox-dark">
              <Checkbox
                inputId="pb-overwrite-streams"
                checked={overwriteStreams}
                onChange={(e) => {
                  const v = !!e.checked;
                  setOverwriteStreams(v);
                  try {
                    localStorage.setItem(
                      'pb.syncOverwriteStreams',
                      v ? '1' : '0'
                    );
                  } catch {
                    /* ignore */
                  }
                }}
              />
              <span title="Перезаписать .msgpack у фактов, у которых потоки уже сохранены.">
                Перезалить
              </span>
            </label>
            <Button
              label={
                syncingThresholds ? 'Пороги…' : 'Подтянуть пороги'
              }
              icon={
                syncingThresholds
                  ? 'pi pi-spin pi-spinner'
                  : 'pi pi-sliders-h'
              }
              className="pb-soft p-button-sm"
              onClick={handleSyncThresholds}
              disabled={syncingThresholds || !providerCaps?.thresholds}
              tooltip={
                !providerCaps?.thresholds
                  ? `Провайдер «${provider}» не поддерживает пороги`
                  : 'Забрать пороги в профиль'
              }
            />
            <Button
              label={syncingZones ? 'Зоны…' : 'Подтянуть зоны'}
              icon={
                syncingZones ? 'pi pi-spin pi-spinner' : 'pi pi-chart-bar'
              }
              className="pb-soft p-button-sm"
              onClick={handleSyncZones}
              disabled={syncingZones}
              tooltip="Читает HR-зоны из последней активности ICU"
            />
            <Button
              label={
                syncingWellness
                  ? 'Здоровье…'
                  : 'Подтянуть Здоровье (ICU + dodofo)'
              }
              icon={
                syncingWellness ? 'pi pi-spin pi-spinner' : 'pi pi-heart'
              }
              className="pb-soft p-button-sm"
              onClick={handleSyncWellness}
              disabled={syncingWellness}
              tooltip="Сон, HRV, пульс покоя (из intervals.icu и dodofo)"
            />
            <Button
              label="Отладка"
              icon="pi pi-code"
              className="pb-soft p-button-sm"
              onClick={onOpenDebug}
              tooltip="Сырые ответы провайдеров API"
            />
          </div>
          <small className="pb-hint">
            Повторный запуск за тот же период не создаёт дубликаты —
            обновляет существующие записи.
          </small>
        </div>

        {/* Прогресс заливки потоков */}
        {syncingStreams && syncStreamsProgress && (
          <div className="pb-import-progress">
            <div className="pb-import-progress__header">
              <span>
                {syncStreamsProgress.current} / {syncStreamsProgress.total}
                {' · '}
                <code>{syncStreamsProgress.externalId ?? '—'}</code>
              </span>
              <Button
                label="Отмена"
                icon="pi pi-times"
                className="pb-soft p-button-sm"
                onClick={handleCancelSyncStreams}
              />
            </div>
            <ProgressBar
              value={Math.round(
                (syncStreamsProgress.current /
                  syncStreamsProgress.total) *
                  100
              )}
              showValue={false}
              style={{ height: '6px' }}
            />
            <div className="pb-import-progress__stats">
              <span>+{syncStreamsProgress.fetched}</span>
              <span>·{syncStreamsProgress.skipped}</span>
              {syncStreamsProgress.failed > 0 && (
                <span className="pb-import-progress__fail">
                  ✗{syncStreamsProgress.failed}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Статусы */}
        {syncError && (
          <Message severity="error" text={syncError} className="w-full" />
        )}
        {syncResult && (
          <Message
            severity={syncResult.added > 0 ? 'success' : 'info'}
            className="w-full"
            content={
              <span>
                Добавлено: <b>{syncResult.added}</b>
                {' · '}Обновлено: <b>{syncResult.updated}</b>
                {' · '}Всего из источника: <b>{syncResult.total}</b>
              </span>
            }
          />
        )}
        {streamsAllError && (
          <Message severity="error" text={streamsAllError} className="w-full" />
        )}
        {streamsAllResult && (
          <Message
            severity={streamsAllResult.failed > 0 ? 'warn' : 'info'}
            className="w-full"
            content={
              <div>
                <span>
                  Потоки: загружено <b>{streamsAllResult.fetched}</b>
                  {' · '}пропущено <b>{streamsAllResult.skipped}</b>
                  {streamsAllResult.failed > 0 && (
                    <> · ошибок <b>{streamsAllResult.failed}</b></>
                  )}
                </span>
                {streamsAllResult.skipped > 0 && !overwriteStreams && (
                  <div
                    className="pb-hint"
                    style={{ marginTop: '0.4rem' }}
                  >
                    Часть потоков уже была в БД и не обновлялась.
                    Включите «Перезалить», чтобы перекачать с GPS.
                  </div>
                )}
              </div>
            }
          />
        )}
        {thresholdsError && (
          <Message
            severity="error"
            text={thresholdsError}
            className="w-full"
          />
        )}
        {thresholdsResult && (
          <Message
            severity="success"
            className="w-full"
            content={
              <span>
                Пороги обновлены: <b>{thresholdsResult}</b>
              </span>
            }
          />
        )}
        {zonesError && (
          <Message severity="error" text={zonesError} className="w-full" />
        )}
        {zonesResult && (
          <Message
            severity="success"
            className="w-full"
            content={
              <span>
                HR-зоны: <b>{zonesResult}</b>
              </span>
            }
          />
        )}
        {wellnessError && (
          <Message
            severity="error"
            text={wellnessError}
            className="w-full"
          />
        )}
        {wellnessResult && (
          <Message
            severity="success"
            className="w-full"
            content={<span>Здоровье: {wellnessResult}</span>}
          />
        )}

        <hr className="pb-sep" />

        {/* Автосинхронизация — встроена внизу панели */}
        <AutoSyncPanel
          onAfterSync={async () => {
            if (onAfterSync) await onAfterSync();
            if (onAfterWellness) await onAfterWellness();
          }}
        />
      </div>
    </Panel>
  );
};