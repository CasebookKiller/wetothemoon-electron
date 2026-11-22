// src/components/GATEWAY/GatewayAccountsDialog/GatewayAccountsDialog.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/COMMON/AppIcon/AppIcon';
import { CloseIcon } from '../GatewayIcons/GatewayIcons';
import { HandoffTab } from './HandoffTab';
import { Dropdown } from 'primereact/dropdown';

const getApi = () =>
  (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

const formatLockTime = (ts?: number | null): string => {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

interface ProfileInfo {
  id: string;
  name: string;
  cdpPort: number;
  browserKind?: 'yandex' | 'chrome';
  chromeCdpPort?: number;
  hasSession: boolean;
  lastActiveAt: string | null;
  rateLimitedUntil?: number | null;   // ms timestamp, временный лимит
  bannedAt?: number | null;           // ms timestamp, бан (нужен ручной разбан)
  /** Multi-provider: 'deepseek' (default) | 'gigachat' */
  provider?: 'deepseek' | 'gigachat';
}

interface Payload {
  activeId: string;
  profiles: ProfileInfo[];
}

export interface GatewayAccountsDialogProps {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
  initialTab?: 'profiles' | 'handoff';
  handoffModuleId?: string;
}

type BusyKind = null | 'list' | 'select' | 'launch' | 'toggle' | 'create' | 'edit' | 'import' | 'delete';

// ─── Стили (inline, чтобы работало вне ShadowRoot) ───
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: '#1e1e20',
  color: '#f5f5f5',
  padding: 24, borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  width: 720, maxWidth: '92vw', height: '85vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  overflow: 'hidden',
};

// Компактная модалка (create/edit/import/delete) — тот же визуальный язык,
// но без фиксированной высоты. maxHeight вместо height, чтобы длинные
// формы скроллились, а короткие не растягивались.
// Фон, border, radius, shadow — из класса ds-modal-content (как главный диалог).
// Оставляем только структурные размеры.
const compactModalStyle: React.CSSProperties = {
  color: '#f5f5f5',
  padding: 24,
  width: 420, maxWidth: '92vw',
  maxHeight: '85vh',
  overflowY: 'auto',
};

export const GatewayAccountsDialog: React.FC<GatewayAccountsDialogProps> = ({
  visible, onClose, onChanged, initialTab, handoffModuleId,
}) => {
  const [state, setState] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'profiles' | 'handoff'>(initialTab ?? 'profiles');

  useEffect(() => {
    if (visible) setTab(initialTab ?? 'profiles');
  }, [visible, initialTab]);

  // create
  // Форма создания/редактирования (5.1): mode, поля, provider.
  type FormState = {
    mode: 'create' | 'edit';
    id?: string;
    name: string;
    browserKind: 'yandex' | 'chrome';
    provider: 'deepseek' | 'gigachat';
  };
  const [form, setForm] = useState<FormState | null>(null);

  // import cookies
  const [importing, setImporting] = useState<{ id: string; name: string } | null>(null);
  const [importJson, setImportJson] = useState('');

  // delete
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(async () => {
    const api = getApi();
    if (!api?.gatewayProfilesList) { setError('profiles IPC не готов'); return; }
    setBusy('list'); setError(null);
    try {
      const r = await api.gatewayProfilesList();
      if (r.success && r.data) setState(r.data);
      else setError(r.error || 'Не удалось получить профили');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setBusy(null); }
  }, []);

  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);

  // P0.5: real-time обновление бейджей rate-limit/ban при открытом диалоге
  useEffect(() => {
    if (!visible) return;
    const api = getApi();
    if (!api?.onGatewayBridgeEvent) return;
    const unsub = api.onGatewayBridgeEvent((event: { type: string }) => {
      const t = event?.type;
      if (
        t === 'profile:rate-limited' ||
        t === 'profile:banned' ||
        t === 'profile:switched'
      ) {
        void refresh();
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [visible, refresh]);

  // Тикер: пере-рендер каждые 30 сек, чтобы бейдж «⏸ до HH:MM» исчезал по истечении
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [visible]);

  const onSelect = async (id: string) => {
    if (!state || id === state.activeId) return;
    setBusy('select'); setError(null);
    try {
      const api = getApi();
      const r = await api.gatewayProfilesActivate(id, { launch: false });
      if (!r.success) { setError(r.error || 'Не удалось переключить'); return; }
      await refresh();
      onChanged?.();
      window.dispatchEvent(new CustomEvent('gateway:profile-switched', { detail: { id } }));
    } finally { setBusy(null); }
  };

  const onLaunch = async () => {
    if (!state) return;
    const activeProf = state.profiles.find(p => p.id === state.activeId);
    if (!activeProf) return;
    // Защита: забаненный профиль не запускаем.
    // Rate-limit — разрешено (можно открыть браузер и скопировать последние сообщения).
    if (activeProf.bannedAt) return;
    setBusy('launch'); setError(null);
    try {
      const api = getApi();
      // Multi-provider: launch-by-profile роутит по provider
      // (deepseek → legacy launch, gigachat → pool.acquire + adapter.connect)
      const r = await api.gatewayLaunchByProfile(activeProf.id);
      if (!r.success) { setError(r.error || 'Не удалось запустить'); return; }
      await refresh();
      onChanged?.();
      if (r.data?.status === 'login_required') {
        window.dispatchEvent(new CustomEvent('gateway:need-login', { detail: { id: activeProf.id } }));
      }
    } finally { setBusy(null); }
  };

  const onToggleKind = async (p: ProfileInfo) => {
    const next: 'yandex' | 'chrome' = p.browserKind === 'chrome' ? 'yandex' : 'chrome';
    const msg = next === 'chrome'
      ? `Переключить "${p.name}" на Chrome (patchright)?\n\n` +
        `• Профиль Chrome создастся пустым — при первом запуске потребуется вход.\n` +
        `• Текущая Yandex-сессия сохранится (можно откатить обратно).\n\nПродолжить?`
      : `Переключить "${p.name}" обратно на Yandex?`;
    if (!window.confirm(msg)) return;
    setBusy('toggle'); setError(null);
    try {
      const api = getApi();
      const r = await api.gatewayProfilesUpdate(p.id, { browserKind: next });
      if (!r.success) { setError(r.error || 'Не удалось переключить'); return; }
      await refresh(); onChanged?.();
    } finally { setBusy(null); }
  };

  const submitForm = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) return;
    setBusy(form.mode === 'create' ? 'create' : 'edit'); setError(null);
    try {
      const api = getApi();
      const r = form.mode === 'create'
        ? await api.gatewayProfilesCreate({
            name,
            browserKind: form.browserKind,
            provider: form.provider,
          })
        : await api.gatewayProfilesUpdate(form.id!, {
            name,
            browserKind: form.browserKind,
            provider: form.provider,
          });
      if (!r.success) { setError(r.error || 'Не удалось сохранить'); return; }
      setForm(null);
      await refresh(); onChanged?.();
    } finally { setBusy(null); }
  };

  const submitImport = async () => {
    if (!importing) return;
    setBusy('import'); setError(null);
    try {
      const api = getApi();
      const r = await api.gatewayProfilesImportCookies(importing.id, importJson);
      if (!r.success) { setError(r.error || 'Импорт не удался'); return; }
      setImporting(null); setImportJson('');
      await refresh(); onChanged?.();
    } finally { setBusy(null); }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    setBusy('delete'); setError(null);
    try {
      const api = getApi();
      const r = await api.gatewayProfilesDelete(deleting.id, { deleteFiles: false });
      if (!r.success) { setError(r.error || 'Не удалось удалить'); return; }
      setDeleting(null);
      await refresh(); onChanged?.();
    } finally { setBusy(null); }
  };

  if (!visible) return null;

  const active = state?.profiles.find(p => p.id === state.activeId);

  return createPortal(
    <div onClick={() => !busy && onClose()} style={overlayStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="ds-modal-content ds-elevated ds-modal-content--dialog"
        style={{
          width: 720,
          maxWidth: '92vw',
          maxHeight: '85vh',
          ...(tab === 'handoff'
            ? { display: 'flex' as const, flexDirection: 'column' as const, minHeight: 0, overflow: 'hidden' as const }
            : null),
        }}
      >
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Аккаунты Gateway</div>
          <button
            onClick={onClose}
            disabled={!!busy}
            className="pb-icon"
            title="Закрыть"
            style={{ width: 28, height: 28, minWidth: 28, padding: 0, background: 'transparent', border: 'none', color: '#888', cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setTab('profiles')}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: tab === 'profiles' ? '2px solid #4a9eff' : '2px solid transparent',
              color: tab === 'profiles' ? '#fff' : '#888',
              padding: '8px 16px', cursor: 'pointer', borderRadius: 0,
            }}
          >Профили</button>
          <button
            onClick={() => setTab('handoff')}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: tab === 'handoff' ? '2px solid #4a9eff' : '2px solid transparent',
              color: tab === 'handoff' ? '#fff' : '#888',
              padding: '8px 16px', cursor: 'pointer', borderRadius: 0,
            }}
          >Handoff</button>
        </div>

        {tab === 'profiles' && (<>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setForm({ mode: 'create', name: '', browserKind: 'yandex', provider: 'deepseek' })}
            disabled={!!busy}
            className="pb"
          >
            <AppIcon name="add" set="material" size="sm" /> Yandex
          </button>
          <button
            onClick={() => setForm({ mode: 'create', name: '', browserKind: 'chrome', provider: 'deepseek' })}
            disabled={!!busy}
            className="pb"
          >
            <AppIcon name="add" set="material" size="sm" /> Chrome
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={refresh} disabled={!!busy} className="pb-icon" title="Обновить">
            <AppIcon name="refresh" set="material" size="sm" />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!state && <div style={{ padding: 20, textAlign: 'center', opacity: 0.6 }}>Загрузка…</div>}
          {state && state.profiles.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', opacity: 0.6 }}>Нет профилей</div>
          )}
          {state?.profiles.map(p => {
            const kind = p.browserKind === 'chrome' ? 'chrome' : 'yandex';
            const isActive = p.id === state.activeId;
            const port = kind === 'chrome' ? (p.chromeCdpPort ?? p.cdpPort + 100) : p.cdpPort;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr auto auto auto',
                  gap: 10, alignItems: 'center',
                  padding: '8px 12px', borderRadius: 8,
                  background: isActive ? 'rgba(77,107,254,0.15)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? 'rgba(77,107,254,0.4)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: `2px solid ${isActive ? '#4d6bfe' : '#555'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4d6bfe' }} />}
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isActive ? '#fff' : '#e0e0e0' }}>
                    {p.name}
                    {!p.hasSession && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#f59e0b' }}>⚠ нет сессии</span>
                    )}
                    {p.bannedAt ? (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', fontWeight: 500 }}>⛔ забанен</span>
                    ) : (p.rateLimitedUntil && p.rateLimitedUntil > Date.now()) ? (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#f59e0b', fontWeight: 500 }}>
                        ⏸ до {formatLockTime(p.rateLimitedUntil)}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{kind === 'chrome' ? 'Chrome (patchright)' : 'Yandex'}  ·  CDP :{port}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                      background: p.provider === 'gigachat' ? 'rgba(16,185,129,0.15)' : 'rgba(77,107,254,0.15)',
                      color: p.provider === 'gigachat' ? '#10b981' : '#4d6bfe',
                    }}>
                      {p.provider === 'gigachat' ? 'GG' : 'DS'}
                    </span>
                  </div>
                </div>

                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                  background: kind === 'chrome' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                  color: kind === 'chrome' ? '#22c55e' : '#eab308',
                }}>
                  {kind === 'chrome' ? 'CHROME' : 'YANDEX'}
                </span>

                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setError(null);
                      setForm({
                        mode: 'edit',
                        id: p.id,
                        name: p.name,
                        browserKind: kind,
                        provider: p.provider ?? 'deepseek',
                      });
                    }}
                    disabled={!!busy}
                    className="pb-icon"
                    title="Редактировать"
                  >
                    <AppIcon name="mode_edit" set="material" size="sm" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImportJson(''); setError(null);
                      setImporting({ id: p.id, name: p.name });
                    }}
                    disabled={!!busy}
                    className="pb-icon"
                    title="Импорт cookies"
                  >
                    <AppIcon name="upload" set="material" size="sm" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setError(null);
                      setDeleting({ id: p.id, name: p.name });
                    }}
                    disabled={!!busy || isActive}
                    className="pb-icon pb-icon--danger"
                    title="Удалить"
                  >
                    <AppIcon name="delete" set="material" size="sm" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{
            color: '#ffb0b0', fontSize: 12, marginBottom: 12, padding: '8px 12px',
            background: 'rgba(220,60,60,0.1)', borderRadius: 6, border: '1px solid rgba(220,60,60,0.3)',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#888' }}>
            {state && `Всего: ${state.profiles.length}  ·  активный: ${active?.name ?? '—'}`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(() => {
              const isRL = !!(active?.rateLimitedUntil && active.rateLimitedUntil > Date.now());
              const isBanned = !!active?.bannedAt;
              const amber = '#f59e0b';
              const amberBg = 'rgba(245,158,11,0.18)';
              return (
                <button
                  onClick={onLaunch}
                  disabled={!active || !!busy || isBanned}
                  className="pb"
                  style={
                    isRL
                      ? {
                          borderColor: 'rgba(245,158,11,0.7)',
                          color: amber,
                          background: 'transparent',
                        }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    if (isRL) {
                      e.currentTarget.style.background = amberBg;
                      e.currentTarget.style.color = amber;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isRL) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = amber;
                    }
                  }}
                  title={
                    isBanned
                      ? 'Профиль забанен — нужен ручной разбан'
                      : isRL
                        ? `Временный лимит до ${formatLockTime(active?.rateLimitedUntil)} — браузер откроется для просмотра/копирования, но отправка сообщений будет недоступна`
                        : (active?.hasSession ? 'Запустить браузер для активного профиля' : 'Профиль без сессии — откроется окно входа')
                  }
                >
                  {busy === 'launch'
                    ? 'Запускаю…'
                    : (active?.hasSession ? 'Запустить' : 'Войти')}
                </button>
              );
            })()}
            <button onClick={onClose} disabled={!!busy} className="pb-soft">
              Закрыть
            </button>
          </div>
        </div>
        </>)}
        {tab === 'handoff' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {state
              ? <HandoffTab moduleId={handoffModuleId ?? 'gateway'} profileId={state.activeId} />
              : <div style={{ padding: 20, textAlign: 'center', opacity: 0.6 }}>Загрузка…</div>}
          </div>
        )}
      </div>

      {/* Create modal */}
      {form && createPortal(
        <div onClick={() => !busy && setForm(null)} style={overlayStyle}>
          <div
            onClick={e => e.stopPropagation()}
            className="ds-modal-content ds-elevated ds-modal-content--dialog"
            style={compactModalStyle}
          >
            <div style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>
              {form.mode === 'create' ? 'Новый профиль' : 'Редактировать профиль'}
            </div>
            <div style={{ marginBottom: 16, fontSize: 12, color: '#888' }}>
              {form.mode === 'edit'
                ? 'Имя, браузер и провайдер можно изменить. Смена браузера использует отдельный userData (старая сессия сохраняется).'
                : (form.browserKind === 'chrome'
                    ? 'При первом запуске потребуется вход в браузере. WAF выдаст новый токен.'
                    : 'Стандартный Yandex-профиль, порт CDP назначится автоматически.')}
            </div>

            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Имя</label>
            <input
              autoFocus
              className="p-inputtext p-component"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') submitForm(); if (e.key === 'Escape' && !busy) setForm(null); }}
              placeholder="Имя профиля"
              disabled={!!busy}
              style={{
                width: '100%', padding: '6px 10px', marginBottom: 14, boxSizing: 'border-box',
                background: '#1e1e20', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                color: '#f5f5f5', fontSize: 13, outline: 'none'
              }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Браузер</label>
            <Dropdown
              value={form.browserKind}
              options={[
                { label: 'Yandex', value: 'yandex' },
                { label: 'Chrome (patchright)', value: 'chrome' },
              ]}
              onChange={(e) => setForm({ ...form, browserKind: e.value as 'yandex' | 'chrome' })}
              disabled={!!busy}
              style={{ width: '100%', marginBottom: 14 }}
              appendTo={document.body}
              pt={{
                root: { style: { zIndex: 2147483000 } },
                panel: { style: { zIndex: 2147483000 } },
              }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Провайдер</label>
            <Dropdown
              value={form.provider}
              options={[
                { label: 'DeepSeek (по умолчанию)', value: 'deepseek' },
                { label: 'GigaChat', value: 'gigachat' },
              ]}
              onChange={(e) => setForm({ ...form, provider: e.value as 'deepseek' | 'gigachat' })}
              disabled={!!busy}
              style={{ width: '100%', marginBottom: 20 }}
              appendTo={document.body}
              pt={{
                root: { style: { zIndex: 2147483000 } },
                panel: { style: { zIndex: 2147483000 } },
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setForm(null)} disabled={!!busy} className="pb-soft">Отмена</button>
              <button onClick={submitForm} disabled={!!busy || !form.name.trim()} className="pb">
                {busy ? (form.mode === 'create' ? 'Создаю…' : 'Сохраняю…') : (form.mode === 'create' ? 'Создать' : 'Сохранить')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import cookies modal */}
      {importing && createPortal(
        <div onClick={() => !busy && setImporting(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: 560, maxHeight: 'auto' }}>
            <div style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>Импорт cookies: {importing.name}</div>
            <div style={{ marginBottom: 16, fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              1. Cookie-Editor → Export → JSON на chat.deepseek.com.<br />
              2. Вставьте JSON ниже.<br />
              ⚠️ Импорт перезапускает браузер профиля.
            </div>
            <textarea
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder='[{"domain":"chat.deepseek.com","name":"ds_session_id","value":"..."}]'
              disabled={!!busy}
              style={{
                width: '100%', height: 180, marginBottom: 20, boxSizing: 'border-box',
                fontFamily: 'monospace', fontSize: 11, background: '#1a1a1d',
                border: '1px solid #444', borderRadius: 8, color: '#fff', padding: 12, resize: 'vertical', outline: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setImporting(null)} disabled={!!busy} className="pb-soft">Отмена</button>
              <button onClick={submitImport} disabled={!!busy || !importJson.trim()} className="pb">
                {busy ? 'Импортирую…' : 'Импортировать'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm */}
      {deleting && createPortal(
        <div onClick={() => !busy && setDeleting(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: 420, height: 'auto', maxHeight: '85vh' }}>
            <div style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>Удалить профиль «{deleting.name}»?</div>
            <div style={{ marginBottom: 20, fontSize: 12, color: '#888' }}>
              Профиль исчезнет из списка. Файлы сессии на диске останутся.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeleting(null)} disabled={!!busy} className="pb-soft">Отмена</button>
              <button
                onClick={submitDelete}
                disabled={!!busy}
                className="pb-destructive"
              >
                {busy ? 'Удаляю…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
};

export default GatewayAccountsDialog;