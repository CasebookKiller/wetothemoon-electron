// src/pages/PranaBinduPage/PranaBinduPage.tsx

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Panel } from 'primereact/panel';
import {
  RunStreamsDrawer,
  type RunFactLite,
} from '@/components/PRANA_BINDU/RunStreamsDrawer';
import { DodofoDebugDialog } from '@/components/PRANA_BINDU/DodofoDebugDialog';

import './PranaBinduPage.css';

interface ProviderOption {
  label: string;
  value: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { label: 'dodofo (основной)', value: 'dodofo' },
  { label: 'dofek-zepp (резерв)', value: 'dofek-zepp' },
  { label: 'zepp-mcp (не реализован)', value: 'zepp-mcp' },
  { label: 'zeppbridge (не реализован)', value: 'zeppbridge' },
];

const MODULES = [
  { name: 'Stillsuit', description: 'Марафон: пульс, темп, экономичность' },
  { name: 'Crysknife', description: 'Big-6: сила, контроль, сухожилия' },
  { name: 'Mentat', description: 'Календарь, периодизация, подводка к старту' },
  { name: 'Water Discipline', description: 'Сон, HRV, гидратация, восстановление' },
  { name: 'Spice', description: 'Аналитика, Google Fit, Zepp, dodofo' },
];

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

function fmtKm(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(2);
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const PranaBinduPage: React.FC = () => {
  const api = (window as any).electronAPI;

  const [provider, setProvider] = useState<string>('dodofo');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Синхронизация
  const initialRange = defaultSyncRange();
  const [syncFrom, setSyncFrom] = useState<Date>(initialRange.from);
  const [syncTo, setSyncTo] = useState<Date>(initialRange.to);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    added: number;
    updated: number;
    total: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<string>('');

  // dodofo
  const [dodofoToken, setDodofoToken] = useState('');
  const [hasDodofoToken, setHasDodofoToken] = useState(false);

  // Zepp (резерв)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Таблица пробежек
  const [runFacts, setRunFacts] = useState<any[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [factsError, setFactsError] = useState('');

  // Потоки
  const [streamsMap, setStreamsMap] = useState<Record<number, any[]>>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedFact, setSelectedFact] = useState<RunFactLite | null>(null);
  const [syncingStreams, setSyncingStreams] = useState(false);
  const [streamsAllResult, setStreamsAllResult] = useState<{
    fetched: number;
    skipped: number;
    failed: number;
    total: number;
  } | null>(null);
  const [streamsAllError, setStreamsAllError] = useState('');

  const [syncingThresholds, setSyncingThresholds] = useState(false);
  const [thresholdsResult, setThresholdsResult] = useState<string>('');
  const [thresholdsError, setThresholdsError] = useState('');

  // Debug
  const [debugVisible, setDebugVisible] = useState(false);


  // ==================== Загрузка потоков (map) ====================

  const loadStreamsMap = async (items: any[]) => {
    console.log('[loadStreamsMap] start, items:', items.length);
    if (!api?.pb?.listRunStreamsBatch || items.length === 0) {
      console.log('[loadStreamsMap] skip');
      setStreamsMap({});
      return;
    }
    try {
      const ids = items.map((x) => x.id);
      console.log('[loadStreamsMap] ids:', ids);
      const res = await api.pb.listRunStreamsBatch(ids);
      console.log('[loadStreamsMap] res.success:', res?.success, 'keys:', Object.keys(res?.data ?? {}));
      //if (res?.success) setStreamsMap(res.data ?? {});
      if (res?.success) {
        const raw = res.data ?? {};
        const normalized: Record<number, any[]> = {};
        for (const [k, v] of Object.entries(raw)) {
          normalized[Number(k)] = v as any[];
        }
        setStreamsMap(normalized);
      }
    } catch (e) {
      console.error('[loadStreamsMap] ERROR:', e);
    }
  };

  // ==================== Загрузка списка пробежек ====================

  const loadRunFacts = async (from?: Date, to?: Date) => {
    if (!api?.pb?.listRunFacts) return;
    setFactsLoading(true);
    setFactsError('');
    try {
      const f = toIsoDate(from ?? syncFrom);
      const t = toIsoDate(to ?? syncTo);
      const res = await api.pb.listRunFacts(f, t);
      if (res.success) {
        const items = res.items ?? [];
        setRunFacts(items);
        await loadStreamsMap(items);
      } else {
        setFactsError(res.error ?? 'Ошибка загрузки');
      }
    } catch (e) {
      setFactsError((e as Error).message);
    } finally {
      setFactsLoading(false);
    }
  };

  // Загрузка токена + пробежек при монтировании
  useEffect(() => {
    (async () => {
      if (!api?.pb?.dodofoTokenStatus) return;
      try {
        const res = await api.pb.dodofoTokenStatus();
        if (res?.success) setHasDodofoToken(!!res.hasToken);
      } catch {
        // ignore
      }
    })();
    loadRunFacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сброс статуса при смене провайдера
  useEffect(() => {
    setStatus('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // ==================== Проверка доступности ====================

  const handleCheck = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен — модуль ещё не собран');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const res = await api.pb.zeppCheckProvider(provider);
      setStatus(JSON.stringify(res));
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Синхронизация тренировок ====================

  const handleSync = async () => {
    if (!api?.pb?.syncNow) {
      setSyncError('electronAPI.pb.syncNow недоступен');
      return;
    }
    if (!syncFrom || !syncTo) {
      setSyncError('Укажите обе даты');
      return;
    }
    setSyncing(true);
    setSyncError('');
    setSyncResult(null);
    try {
      const res = await api.pb.syncNow(
        toIsoDate(syncFrom),
        toIsoDate(syncTo)
      );
      if (res.success) {
        setSyncResult({
          added: res.added ?? 0,
          updated: res.updated ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setSyncError(res.error ?? 'Неизвестная ошибка');
      }
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  // ==================== Массовая заливка потоков ====================

  const handleSyncAllStreams = async () => {
    if (!api?.pb?.syncRunStreamsAll) {
      setStreamsAllError('electronAPI.pb.syncRunStreamsAll недоступен');
      return;
    }
    if (!syncFrom || !syncTo) {
      setStreamsAllError('Укажите обе даты');
      return;
    }
    setSyncingStreams(true);
    setStreamsAllError('');
    setStreamsAllResult(null);
    try {
      const res = await api.pb.syncRunStreamsAll(
        toIsoDate(syncFrom),
        toIsoDate(syncTo)
      );
      if (res.success) {
        setStreamsAllResult({
          fetched: res.fetched ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setStreamsAllError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setStreamsAllError((e as Error).message);
    } finally {
      setSyncingStreams(false);
    }
  };

  // ==================== Синхронизация порогов ====================

  const handleSyncThresholds = async () => {
    if (!api?.pb?.syncThresholds) {
      setThresholdsError('electronAPI.pb.syncThresholds недоступен');
      return;
    }
    setSyncingThresholds(true);
    setThresholdsError('');
    setThresholdsResult('');
    try {
      const res = await api.pb.syncThresholds();
      if (res.success) {
        setThresholdsResult(
          (res.applied ?? []).join(' · ') || 'обновлено'
        );
      } else {
        setThresholdsError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setThresholdsError((e as Error).message);
    } finally {
      setSyncingThresholds(false);
    }
  };

  // ==================== dodofo ====================

  const handleSaveDodofo = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен');
      return;
    }
    if (!dodofoToken.trim()) {
      setStatus('Введите токен dodofo');
      return;
    }
    setLoading(true);
    setStatus('Сохранение токена...');
    try {
      const res = await api.pb.dodofoConnect(dodofoToken.trim());
      if (res.success) {
        setStatus('Токен сохранён и проверен');
        setHasDodofoToken(true);
        setDodofoToken('');
      } else {
        setStatus(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Zepp (резерв) ====================

  const handleConnectZepp = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен');
      return;
    }
    if (!email || !password) {
      setStatus('Введите email и пароль');
      return;
    }
    setLoading(true);
    setStatus('Подключение...');
    try {
      const res = await api.pb.zeppConnect(email, password);
      if (res.success) {
        setStatus(
          `Успех: userId=${res.userId}, authHost=${res.authHost}, dataHost=${res.dataHost}`
        );
        setPassword('');
      } else {
        setStatus(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Рендер формы по провайдеру ====================

  const renderProviderForm = () => {
    if (provider === 'dodofo') {
      return (
        <>
          <div className="flex flex-column gap-2">
            <label htmlFor="pb-dodofo-token" className="pb-label">
              Личный токен dodofo
              {hasDodofoToken && <span className="pb-label-ok">✓ сохранён</span>}
            </label>
            <InputText
              id="pb-dodofo-token"
              value={dodofoToken}
              onChange={(e) => setDodofoToken(e.target.value)}
              placeholder="dodofo_..."
              className="w-full"
            />
            <small className="pb-hint">
              Токен создаётся в профиле dodofo.ru и действует от твоего имени.
              Хранится зашифрованным.
            </small>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              label={loading ? 'Сохранение...' : 'Сохранить токен'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
              className="pb p-button-sm"
              onClick={handleSaveDodofo}
              disabled={loading || !dodofoToken.trim()}
            />
            <Button
              label={loading ? 'Проверка...' : 'Проверить доступность'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
              className="pb-soft p-button-sm"
              onClick={handleCheck}
              disabled={loading}
            />
          </div>
        </>
      );
    }

    if (provider === 'dofek-zepp') {
      return (
        <>
          <div className="flex flex-column gap-2">
            <label htmlFor="pb-email" className="pb-label">Email Zepp</label>
            <InputText
              id="pb-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full"
            />
          </div>

          <div className="flex flex-column gap-2">
            <label htmlFor="pb-password" className="pb-label">Пароль Zepp</label>
            <InputText
              id="pb-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full"
            />
          </div>

          <small className="pb-hint">
            Резервный способ. Основной — dodofo (проще, не требует пароля).
          </small>

          <div className="flex gap-2 flex-wrap">
            <Button
              label={loading ? 'Подключение...' : 'Подключить'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'}
              className="pb p-button-sm"
              onClick={handleConnectZepp}
              disabled={loading || !email || !password}
            />
            <Button
              label={loading ? 'Проверка...' : 'Проверить доступность'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
              className="pb-soft p-button-sm"
              onClick={handleCheck}
              disabled={loading}
            />
          </div>
        </>
      );
    }

    // zepp-mcp / zeppbridge — заглушки
    return (
      <>
        <small className="pb-hint">
          Провайдер «{provider}» пока не реализован. Используй dodofo
          или dofek-zepp.
        </small>
        <div className="flex gap-2 flex-wrap">
          <Button
            label={loading ? 'Проверка...' : 'Проверить доступность'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
            className="pb-soft p-button-sm"
            onClick={handleCheck}
            disabled={loading}
          />
        </div>
      </>
    );
  };

  return (
    <div className="pb-page p-4">
      <div className="mb-4">
        <h1 className="pb-title">
          <i className="pi pi-wave-pulse pb-title-icon" />
          Prana-Bindu
        </h1>
        <p className="pb-subtitle">Тренировки тела: бег и сила</p>
      </div>

      <div className="grid mb-3">
        {MODULES.map((m) => (
          <div key={m.name} className="col-12 md:col-6 lg:col-4 p-2">
            <div className="surface-card p-3 shadow-2 border-round h-full">
              <div className="pb-module-name">{m.name}</div>
              <div className="pb-module-desc">{m.description}</div>
            </div>
          </div>
        ))}
      </div>

      <Panel header="Синхронизация" className="shadow-5 mb-3 pb-panel">
        <div className="flex flex-column gap-3">
          <div className="flex flex-column gap-2">
            <label htmlFor="pb-provider" className="pb-label">Провайдер</label>
            <Dropdown
              inputId="pb-provider"
              value={provider}
              options={PROVIDER_OPTIONS}
              onChange={(e) => setProvider(e.value)}
              className="w-full"
            />
          </div>

          {renderProviderForm()}

          <hr className="pb-sep" />

          <div className="flex flex-column gap-2">
            <label className="pb-label">Диапазон ручной синхронизации</label>
            <div className="flex gap-2 flex-wrap align-items-center">
              <Calendar
                value={syncFrom}
                onChange={(e) => setSyncFrom(e.value as Date)}
                dateFormat="dd.mm.yy"
                placeholder="С"
                showIcon
                className="pb-cal"
                maxDate={syncTo ?? undefined}
              />
              <span className="pb-hint">—</span>
              <Calendar
                value={syncTo}
                onChange={(e) => setSyncTo(e.value as Date)}
                dateFormat="dd.mm.yy"
                placeholder="По"
                showIcon
                className="pb-cal"
                minDate={syncFrom ?? undefined}
                maxDate={new Date()}
              />
              <Button
                label={syncing ? 'Синхронизация...' : 'Синхронизировать'}
                icon={syncing ? 'pi pi-spin pi-spinner' : 'pi pi-sync'}
                className="pb p-button-sm"
                onClick={handleSync}
                disabled={
                  syncing ||
                  !hasDodofoToken ||
                  provider !== 'dodofo' ||
                  !syncFrom ||
                  !syncTo
                }
                tooltip={
                  provider !== 'dodofo'
                    ? 'Синхронизация пока только для dodofo'
                    : !hasDodofoToken
                    ? 'Сначала сохраните токен dodofo'
                    : undefined
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
                disabled={
                  syncingStreams ||
                  !hasDodofoToken ||
                  provider !== 'dodofo' ||
                  !syncFrom ||
                  !syncTo
                }
                tooltip="Загрузить секундные потоки за выбранный период (для тренировок без потоков)"
              />
              <Button
                label={syncingThresholds ? 'Пороги…' : 'Подтянуть пороги'}
                icon={
                  syncingThresholds
                    ? 'pi pi-spin pi-spinner'
                    : 'pi pi-sliders-h'
                }
                className="pb-soft p-button-sm"
                onClick={handleSyncThresholds}
                disabled={
                  syncingThresholds || !hasDodofoToken || provider !== 'dodofo'
                }
                tooltip="Забрать пороги (restHR и др.) из dodofo в профиль"
              />
              <Button
                label="Отладка"
                icon="pi pi-code"
                className="pb-soft p-button-sm"
                onClick={() => setDebugVisible(true)}
                tooltip="Сырые ответы dodofo API"
              />
            </div>
            <small className="pb-hint">
              Повторный запуск за тот же период не создаёт дубликаты —
              обновляет существующие записи.
            </small>
          </div>

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
                <span>
                  Потоки: загружено <b>{streamsAllResult.fetched}</b>
                  {' · '}пропущено <b>{streamsAllResult.skipped}</b>
                  {streamsAllResult.failed > 0 && (
                    <> · ошибок <b>{streamsAllResult.failed}</b></>
                  )}
                </span>
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
              content={<span>Пороги обновлены: <b>{thresholdsResult}</b></span>}
            />
          )}

          {status && (
            <div className="pb-status">
              <code>{status}</code>
            </div>
          )}
        </div>
      </Panel>

      <Panel
        header={`Пробежки (${runFacts.length})`}
        className="shadow-5 mb-3 pb-panel"
      >
        {factsError && (
          <Message severity="error" text={factsError} className="w-full mb-2" />
        )}

        <DataTable
          value={runFacts}
          loading={factsLoading}
          size="small"
          stripedRows
          scrollable
          scrollHeight="420px"
          emptyMessage="За выбранный период пробежек нет"
          className="p-datatable-sm"
          selectionMode="single"
          onRowClick={(e) => {
            setSelectedFact(e.data as RunFactLite);
            setDrawerVisible(true);
          }}
        >
          <Column
            header=""
            style={{ width: '40px', textAlign: 'center' }}
            body={(r) =>
              streamsMap[r.id]?.length ? (
                <i
                  className="pi pi-chart-line"
                  style={{ color: 'var(--pb-accent)' }}
                  title={`Потоков: ${streamsMap[r.id].length}`}
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
            style={{ width: '110px' }}
          />
          <Column
            field="actual_km"
            header="Км"
            body={(r) => fmtKm(r.actual_km)}
            sortable
            style={{ width: '80px' }}
          />
          <Column
            field="actual_pace"
            header="Темп"
            style={{ width: '80px' }}
          />
          <Column
            field="duration_sec"
            header="Время"
            body={(r) => fmtDuration(r.duration_sec)}
            style={{ width: '100px' }}
          />
          <Column
            field="avg_hr"
            header="Ср. пульс"
            style={{ width: '100px' }}
          />
          <Column
            field="max_hr"
            header="Макс. пульс"
            body={(r) => r.max_hr ?? '—'}
            style={{ width: '110px' }}
          />
          <Column
            field="source"
            header="Источник"
            style={{ width: '100px' }}
          />
        </DataTable>
      </Panel>

      <DodofoDebugDialog
        visible={debugVisible}
        onHide={() => setDebugVisible(false)}
        initialRunFactId={selectedFact?.id ?? null}
      />

      <RunStreamsDrawer
        visible={drawerVisible}
        runFact={selectedFact}
        onHide={() => setDrawerVisible(false)}
        onAfterSync={() => loadRunFacts()}
      />
    </div>
  );
};