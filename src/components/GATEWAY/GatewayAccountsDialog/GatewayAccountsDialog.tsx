// src/components/GATEWAY/GatewayAccountsDialog/GatewayAccountsDialog.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/COMMON/AppIcon/AppIcon';
import { CloseIcon } from '../GatewayIcons/GatewayIcons';

const getApi = () =>
  (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

interface ProfileInfo {
  id: string;
  name: string;
  cdpPort: number;
  browserKind?: 'yandex' | 'chrome';
  chromeCdpPort?: number;
  hasSession: boolean;
  lastActiveAt: string | null;
}

interface Payload {
  activeId: string;
  profiles: ProfileInfo[];
}

export interface GatewayAccountsDialogProps {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

type BusyKind = null | 'list' | 'select' | 'launch' | 'toggle' | 'create' | 'import' | 'delete';

// ─── Стили (inline, чтобы работало вне ShadowRoot) ───
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 99999,
};

const modalStyle: React.CSSProperties = {
  background: '#1e1e20',
  color: '#f5f5f5',
  padding: 24, borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  width: 720, maxWidth: '92vw', maxHeight: '85vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

export const GatewayAccountsDialog: React.FC<GatewayAccountsDialogProps> = ({
  visible, onClose, onChanged,
}) => {
  const [state, setState] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [error, setError] = useState<string | null>(null);

  // create
  const [creating, setCreating] = useState<{ browserKind: 'yandex' | 'chrome' } | null>(null);
  const [newName, setNewName] = useState('');

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
    setBusy('launch'); setError(null);
    try {
      const api = getApi();
      // С сессией — просто launch(); без сессии — полный switch с логином
      const r = activeProf.hasSession
        ? await api.gatewayLaunch()
        : await api.gatewayProfilesActivate(activeProf.id, { launch: true });
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

  const submitCreate = async () => {
    if (!creating) return;
    const name = newName.trim();
    if (!name) return;
    setBusy('create'); setError(null);
    try {
      const api = getApi();
      const r = await api.gatewayProfilesCreate({ name, browserKind: creating.browserKind });
      if (!r.success) { setError(r.error || 'Не удалось создать'); return; }
      setCreating(null); setNewName('');
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
        style={{ width: 720, maxWidth: '92vw', maxHeight: '85vh' }}
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

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setNewName(''); setCreating({ browserKind: 'yandex' }); }}
            disabled={!!busy}
            className="pb"
          >
            <AppIcon name="add" set="material" size="sm" /> Yandex
          </button>
          <button
            onClick={() => { setNewName(''); setCreating({ browserKind: 'chrome' }); }}
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
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {kind === 'chrome' ? 'Chrome (patchright)' : 'Yandex'}  ·  CDP :{port}
                  </div>
                </div>

                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                  background: kind === 'chrome' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                  color: kind === 'chrome' ? '#22c55e' : '#eab308',
                }}>
                  {kind === 'chrome' ? 'CHROME' : 'YANDEX'}
                </span>

                <button
                  onClick={(e) => { e.stopPropagation(); onToggleKind(p); }}
                  disabled={!!busy}
                  className="pb-icon"
                  title={kind === 'chrome' ? 'Переключить на Yandex' : 'Переключить на Chrome'}
                >
                  <AppIcon name="sync" set="material" size="sm" />
                </button>

                <div style={{ display: 'flex', gap: 2 }}>
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
            <button
              onClick={onLaunch}
              disabled={!active || !!busy}
              className="pb"
              title={active?.hasSession ? 'Запустить браузер для активного профиля' : 'Профиль без сессии — откроется окно входа'}
            >
              {busy === 'launch'
                ? 'Запускаю…'
                : (active?.hasSession ? 'Запустить' : 'Войти')}
            </button>
            <button onClick={onClose} disabled={!!busy} className="pb-soft">
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {/* Create modal */}
      {creating && createPortal(
        <div onClick={() => !busy && setCreating(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: 420, maxHeight: 'auto' }}>
            <div style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>
              Новый профиль · {creating.browserKind === 'chrome' ? 'Chrome (patchright)' : 'Yandex'}
            </div>
            <div style={{ marginBottom: 16, fontSize: 12, color: '#888' }}>
              {creating.browserKind === 'chrome'
                ? 'При первом запуске потребуется вход в DeepSeek в окне Chrome. WAF выдаст новый токен.'
                : 'Стандартный Yandex-профиль, порт CDP назначится автоматически.'}
            </div>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape' && !busy) setCreating(null); }}
              placeholder="Имя профиля"
              disabled={!!busy}
              style={{
                width: '100%', padding: '8px 12px', marginBottom: 20, boxSizing: 'border-box',
                background: '#1a1a1d', border: '1px solid #444', borderRadius: 8,
                color: '#fff', fontSize: 13, outline: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setCreating(null)} disabled={!!busy} className="pb-soft">Отмена</button>
              <button onClick={submitCreate} disabled={!!busy || !newName.trim()} className="pb">
                {busy ? 'Создаю…' : 'Создать'}
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
          <div onClick={e => e.stopPropagation()} style={{ ...modalStyle, width: 420, maxHeight: 'auto' }}>
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