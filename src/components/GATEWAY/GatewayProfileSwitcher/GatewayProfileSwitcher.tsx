// src/components/GATEWAY/GatewayProfileSwitcher/GatewayProfileSwitcher.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

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

interface Option {
  label: string;
  value: string;
  tooltip: string;
}

export const GatewayProfileSwitcher: React.FC = () => {
  const [state, setState] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const [importing, setImporting] = useState<{
    profileId: string;
    profileName: string;
  } | null>(null);
  const [importJson, setImportJson] = useState('');

  const refresh = useCallback(async () => {
    const api = getApi();
    if (!api?.gatewayProfilesList) {
      setError('profiles IPC не готов');
      return;
    }
    try {
      const r = await api.gatewayProfilesList();
      if (r.success && r.data) { setState(r.data); setError(null); }
      else setError(r.error || 'Не удалось');
    } catch (e: any) {
      console.error('[profiles] list error:', e);
      setError(e?.message || String(e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onSwitch = async (id: string) => {
    if (id === state?.activeId) return;
    setBusy(true); setError(null);
    try {
      const api = getApi();
      const r = await api.gatewayProfilesActivate(id);
      if (!r.success) {
        setError(r.error || 'Не удалось переключиться');
      } else {
        await refresh();
        if (r.status === 'login_required') {
          console.log('[profiles] switch: login required for', id);
          window.dispatchEvent(new CustomEvent('gateway:need-login', { detail: { id } }));
        } else {
          console.log('[profiles] switch: logged in to', id);
        }
        window.dispatchEvent(new CustomEvent('gateway:profile-switched', { detail: { id } }));
      }
    } finally { setBusy(false); }
  };

  const openCreate = () => {
    setNewName('');
    setError(null);
    setCreating(true);
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true); setError(null);
    try {
      const api = getApi();
      const r = await api.gatewayProfilesCreate({ name });
      if (!r.success) {
        setError(r.error || 'Не удалось создать');
      } else {
        setCreating(false);
        setNewName('');
        await refresh();
      }
    } catch (e: any) {
      console.error('[profiles] create error:', e);
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <span style={{ fontSize: 11, color: 'var(--tg-theme-hint-color, #888)', whiteSpace: 'nowrap' }}>
        Профили: {error ?? '…'}
      </span>
    );
  }

  const active = state.profiles.find((p) => p.id === state.activeId);

  const options: Option[] = state.profiles.map((p) => ({
    label: `${p.name} ${p.hasSession ? '✓' : '⚠'}`,
    value: p.id,
    tooltip: `${p.name}  ·  ${p.browserKind === 'chrome' ? 'Chrome' : 'Yandex'} CDP :${p.browserKind === 'chrome' ? (p.chromeCdpPort ?? p.cdpPort + 100) : p.cdpPort}  ·  ${p.hasSession ? 'сессия есть' : 'нет сессии'}`,
  }));

  return (
    <>
      <span className="gateway-profile-switcher">
        <span className="gateway-profile-switcher__label">Аккаунт:</span>

        <Dropdown
          value={state.activeId}
          options={options}
          optionLabel="label"
          optionValue="value"
          onChange={(e) => onSwitch(e.value)}
          disabled={busy}
          itemTemplate={(opt: Option) => (
            <div title={opt.tooltip}>{opt.label}</div>
          )}
          className="gateway-profile-switcher__dropdown"
          panelStyle={{ fontSize: 12 }}
        />

        <Button
          icon="pi pi-plus"
          className="gateway-profile-switcher__plus"
          onClick={openCreate}
          disabled={busy}
          tooltip="Создать профиль"
          tooltipOptions={{ position: 'bottom' }}
        />

        <Button
          icon="pi pi-upload"
          className="gateway-profile-switcher__plus"
          onClick={() => {
            if (active) {
              setImportJson('');
              setError(null);
              setImporting({ profileId: active.id, profileName: active.name });
            }
          }}
          disabled={busy || !active}
          tooltip="Импорт cookies для активного профиля"
          tooltipOptions={{ position: 'bottom' }}
        />

        <Button
          icon="pi pi-times"
          className="gateway-profile-switcher__plus gateway-profile-switcher__plus--danger"
          onClick={async () => {
            if (busy) return;
            const msg =
              'Убить ВСЕ Yandex-процессы GW?\n\n' +
              '• Освободятся порты 9322/9323\n' +
              '• Несохранённые сообщения в PW потеряются\n' +
              '• После — «Запустить» заново\n\n' +
              'Продолжить?';
            if (!window.confirm(msg)) return;
            setBusy(true);
            setError(null);
            try {
              const api = getApi();
              const r = await api.gatewayKillAllZombies();
              if (!r.success) {
                setError(r.error || 'Не удалось убить');
              } else {
                console.log(`[kill-zombies] killed=${r.data?.killed ?? 0}`);
                window.dispatchEvent(new CustomEvent('gateway:zombies-killed'));
                await refresh();
              }
            } catch (e: any) {
              setError(e?.message || String(e));
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          tooltip="Убить зомби-Yandex (все профили)"
          tooltipOptions={{ position: 'bottom' }}
        />

        {active && !active.hasSession && (
          <span
            className="gateway-profile-switcher__hint"
            title="Нажми Запустить и войди в DeepSeek вторым аккаунтом"
          >
            ⚠ вход
          </span>
        )}
        {busy && <span style={{ color: 'var(--tg-theme-hint-color, #888)' }}>…</span>}
        {error && !creating && (
          <span className="gateway-profile-switcher__error">{error}</span>
        )}
      </span>

      {creating && createPortal(
        <div
          onClick={() => !busy && setCreating(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--tg-theme-bg-color, #1a1a1d)',
              color: 'var(--tg-theme-text-color, #f5f5f5)',
              padding: 20,
              borderRadius: 8,
              border: '1px solid var(--tg-theme-hint-color, #444)',
              minWidth: 320,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
              Новый профиль
            </div>
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--tg-theme-hint-color, #888)' }}>
              Имя (например, acc2). Порт CDP назначится автоматически.
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate();
                if (e.key === 'Escape' && !busy) setCreating(false);
              }}
              className="p-inputtext"
              placeholder="acc2"
              style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
              disabled={busy}
            />
            {error && (
              <div style={{
                color: 'var(--tg-theme-destructive-text-color, #ec3942)',
                fontSize: 12, marginBottom: 8,
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                label="Отмена"
                className="pb-soft"
                onClick={() => setCreating(false)}
                disabled={busy}
              />
              <Button
                label={busy ? 'Создаю…' : 'Создать'}
                className="pb"
                onClick={submitCreate}
                disabled={busy || !newName.trim()}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

            {importing && createPortal(
        <div
          onClick={() => !busy && setImporting(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--tg-theme-bg-color, #1a1a1d)',
              color: 'var(--tg-theme-text-color, #f5f5f5)',
              padding: 20, borderRadius: 8,
              border: '1px solid var(--tg-theme-hint-color, #444)',
              width: 520, maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              Импорт cookies: {importing.profileName}
            </div>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--tg-theme-hint-color, #888)' }}>
              1. Откройте chat.deepseek.com в мобильном браузере (Edge Canary с Cookie-Editor),
              войдите в нужный аккаунт.
              <br/>
              2. Cookie-Editor → Export → JSON.
              <br/>
              3. Вставьте JSON ниже.
            </div>
            <textarea
              autoFocus
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[{"domain":"chat.deepseek.com","name":"ds_session_id","value":"...",...}]'
              className="p-inputtext"
              style={{
                width: '100%',
                height: 180,
                marginBottom: 12,
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                fontSize: 11,
                resize: 'vertical',
              }}
              disabled={busy}
            />
            {error && (
              <div style={{
                color: 'var(--tg-theme-destructive-text-color, #ec3942)',
                fontSize: 12, marginBottom: 8,
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                label="Отмена"
                className="pb-soft"
                onClick={() => setImporting(null)}
                disabled={busy}
              />
              <Button
                label={busy ? 'Импортирую…' : 'Импортировать'}
                className="pb"
                disabled={busy || !importJson.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const api = getApi();
                    const r = await api.gatewayProfilesImportCookies(
                      importing.profileId,
                      importJson
                    );
                    if (!r.success) {
                      setError(r.error || 'Импорт не удался');
                    } else {
                      setImporting(null);
                      setImportJson('');
                      await refresh();
                      window.dispatchEvent(new CustomEvent('gateway:profile-switched', {
                        detail: { id: importing.profileId },
                      }));
                    }
                  } catch (e: any) {
                    setError(e?.message || String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};