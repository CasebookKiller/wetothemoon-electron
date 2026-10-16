// src/components/PRANA_BINDU/PANELS/AutoSyncPanel/AutoSyncPanel.tsx
//
// Блок «Автосинхронизация» — встраивается внутрь панели
// «Синхронизация (API)» как составной блок (не свой Panel).
// Самодостаточен: держит все стейты, читает/пишет настройки,
// дёргает pb:auto-sync-on-start.
//
// onAfterSync — родитель перечитывает свои данные (workouts,
// wellness) после успешного прогона.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Message } from 'primereact/message';
import {
  ALL_AUTO_SYNC_PROVIDERS,
  AUTO_SYNC_PROVIDER_LABELS,
  DEFAULT_AUTO_SYNC_PROVIDERS,
  type AutoSyncProvider,
} from '@/main/services/pranaBindu/spice/types';

interface Props {
  /** Вызывается после успешного прогона автосинка. */
  onAfterSync?: () => void | Promise<void>;
}

export const AutoSyncPanel: React.FC<Props> = ({ onAfterSync }) => {
  const api = (window as any).electronAPI;

  const [autoSyncOnStart, setAutoSyncOnStart] = useState(false);
  const [autoSyncIntervalMin, setAutoSyncIntervalMin] = useState(360);
  const [autoSyncLastAt, setAutoSyncLastAt] = useState<string | null>(null);
  const [autoSyncLastStatus, setAutoSyncLastStatus] = useState<string | null>(
    null
  );
  const [autoSyncRunning, setAutoSyncRunning] = useState(false);
  const [autoSyncResult, setAutoSyncResult] = useState('');
  const [autoSyncError, setAutoSyncError] = useState('');
  const [autoProviders, setAutoProviders] = useState<Set<AutoSyncProvider>>(
    () => new Set(DEFAULT_AUTO_SYNC_PROVIDERS),
  );

  const loadSyncSettings = async () => {
    if (!api?.pb?.syncSettingsGet) return;
    try {
      const res = await api.pb.syncSettingsGet();
      if (res?.success) {
        const d = res.data ?? {};
        setAutoSyncOnStart(!!d.autoOnStart);
        setAutoSyncIntervalMin(
          typeof d.autoIntervalMin === 'number' ? d.autoIntervalMin : 360
        );
        setAutoSyncLastAt(d.lastSyncAt ?? null);
        setAutoSyncLastStatus(d.lastSyncStatus ?? null);
        const provs: AutoSyncProvider[] = Array.isArray(d.autoProviders)
          ? d.autoProviders
          : [...DEFAULT_AUTO_SYNC_PROVIDERS];
        setAutoProviders(new Set(provs));
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadSyncSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автосинк при старте окна — один раз за монтирование.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.pb.autoSyncOnStart?.();
        if (res?.success && res.ran) {
          console.log('[Prana-Bindu] auto-sync при старте:', res);
          if (onAfterSync) await onAfterSync();
          await loadSyncSettings();
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistAutoSync = async (patch: {
    autoOnStart?: boolean;
    autoIntervalMin?: number | null;
    autoProviders?: AutoSyncProvider[];
  }) => {
    if (!api?.pb?.syncSettingsUpdate) return;
    try {
      // mode синхронизируем с autoOnStart — поле устаревшее,
      // но пусть будет консистентно с чекбоксом.
      const payload: Record<string, unknown> = { ...patch };
      if (patch.autoOnStart !== undefined) {
        payload.mode = patch.autoOnStart ? 'auto' : 'manual';
      }
      const res = await api.pb.syncSettingsUpdate(payload);
      if (!res?.success) {
        setAutoSyncError(res?.error ?? 'Не удалось сохранить');
        setTimeout(() => setAutoSyncError(''), 3000);
      }
    } catch (e) {
      setAutoSyncError((e as Error).message);
      setTimeout(() => setAutoSyncError(''), 3000);
    }
  };

  const toggleProvider = (p: AutoSyncProvider) => {
    setAutoProviders((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      void persistAutoSync({ autoProviders: Array.from(next) });
      return next;
    });
  };

  const handleRunAutoSyncNow = async () => {
    if (!api?.pb?.autoSyncOnStart) return;
    setAutoSyncRunning(true);
    setAutoSyncError('');
    setAutoSyncResult('');
    try {
      const res = await api.pb.autoSyncOnStart();
      if (res?.success) {
        if (res.skipped === 'disabled') {
          setAutoSyncResult('Автосинхронизация выключена — пропущено.');
        } else if (res.skipped === 'cooldown') {
          setAutoSyncResult(
            `Пропущено (прошло ${res.elapsedMin} мин из ${res.intervalMin}).`
          );
        } else if (res.ran) {
          const wTotal = (res.workouts ?? []).reduce(
            (s: number, w: any) => s + (w.added ?? 0) + (w.updated ?? 0),
            0
          );
          const well = res.wellness?.added ?? 0;
          setAutoSyncResult(
            `Готово: workouts ${wTotal}, wellness +${well}.`
          );
        }
        if (onAfterSync) await onAfterSync();
        await loadSyncSettings();
      } else {
        setAutoSyncError(res?.error ?? 'Ошибка');
      }
    } catch (e) {
      setAutoSyncError((e as Error).message);
    } finally {
      setAutoSyncRunning(false);
    }
  };

  return (
    <div className="pb-connections__block">
      <div className="pb-connections__title">
        <i className="pi pi-sync" /> Автосинхронизация
        {autoSyncLastAt && (
          <span className="pb-label-ok" style={{ marginLeft: 'auto' }}>
            {autoSyncLastStatus === 'error'
              ? 'ошибка'
              : autoSyncLastStatus === 'partial'
              ? 'частично'
              : 'ок'}
          </span>
        )}
      </div>
      <div className="flex flex-column gap-2">
        <label className="pb-check-row pb-checkbox-dark">
          <Checkbox
            inputId="pb-auto-on-start"
            checked={autoSyncOnStart}
            onChange={(e) => {
              const v = !!e.checked;
              setAutoSyncOnStart(v);
              void persistAutoSync({ autoOnStart: v });
            }}
          />
          <span>
            Синхронизировать workouts и здоровье при старте окна
          </span>
        </label>
        <small className="pb-hint">
          Забирает workouts и wellness за последние 7 дней. Антидребезг —
          не чаще раза в {Math.round(autoSyncIntervalMin / 60)} ч.
          Стримы и план не трогает (это ручные операции).
        </small>

        {autoSyncLastAt && (
          <small className="pb-hint">
            Последняя: {new Date(autoSyncLastAt).toLocaleString('ru-RU')}
          </small>
        )}

        {autoSyncResult && (
          <Message
            severity="success"
            text={autoSyncResult}
            className="w-full"
          />
        )}
        {autoSyncError && (
          <Message
            severity="error"
            text={autoSyncError}
            className="w-full"
          />
        )}

        {/* Список провайдеров — какие участвуют в автосинке */}
        <div className="pb-auto-providers">
          <div className="pb-auto-providers__title">Источники в автосинке</div>
          {ALL_AUTO_SYNC_PROVIDERS.map((p) => {
            const isOn = autoProviders.has(p);
            // A.3–A.5: обработка этих провайдеров ещё не реализована.
            // Флажки работают (сохраняются в БД), но handler пока
            // их игнорирует. После A.3–A.5 они начнут действовать.
            const notYetImplemented = (
              ['zepp-fit', 'strava-fit', 'icu-plan', 'streams', 'thresholds'] as AutoSyncProvider[]
            ).includes(p);
            return (
              <label
                key={p}
                className={`pb-auto-providers__row pb-check-row pb-checkbox-dark ${
                  notYetImplemented ? 'is-pending' : ''
                }`}
                title={
                  notYetImplemented
                    ? 'Сохраняется в настройках, но пока не активно в автосинке (в разработке, шаги A.3–A.5)'
                    : undefined
                }
              >
                <Checkbox
                  inputId={`pb-auto-provider-${p}`}
                  checked={isOn}
                  onChange={() => toggleProvider(p)}
                  disabled={autoSyncRunning}
                />
                <span>{AUTO_SYNC_PROVIDER_LABELS[p]}</span>
                {notYetImplemented && (
                  <span className="pb-auto-providers__pending-tag">скоро</span>
                )}
              </label>
            );
          })}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            label={
              autoSyncRunning
                ? 'Синхронизация…'
                : 'Синхронизировать сейчас'
            }
            icon={
              autoSyncRunning ? 'pi pi-spin pi-spinner' : 'pi pi-play'
            }
            className="pb-soft p-button-sm"
            onClick={handleRunAutoSyncNow}
            disabled={autoSyncRunning}
            tooltip="Запустить те же операции, что делает автосинхронизация — независимо от чекбокса и кулдауна"
          />
        </div>
      </div>
    </div>
  );
};