// src/components/GATEWAY/GatewayProfileMenu/GatewayProfileMenu.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  MoreIcon,
  DownloadAppIcon,
  SettingsMenuIcon,
  HelpIcon,
  LogoutIcon,
  CloseIcon,
} from '@/components/GATEWAY/GatewayIcons/GatewayIcons';


const getApi = () =>
  (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

type ModalKind = null | 'soft' | 'hard';

export const GatewayProfileMenu: React.FC = () => {
  const [userInfo, setUserInfo] = useState<{ name: string; avatarUrl: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const api = getApi();
      if (!api?.gatewayGetUserInfo) return;
      try {
        const r = await api.gatewayGetUserInfo();
        if (r?.success) setUserInfo(r.data);
      } catch (e) { console.warn('[profile-menu]', e); }
    };
    load();
    window.addEventListener('gateway:profile-switched', load);
    window.addEventListener('gateway:logged-in', load);
    return () => {
      window.removeEventListener('gateway:profile-switched', load);
      window.removeEventListener('gateway:logged-in', load);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !e.composedPath().includes(menuRef.current)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  const doSoftLogout = async () => {
    if (busy) return;
    setBusy(true); setModal(null); setIsOpen(false);
    try {
      const api = getApi();
      const r = await api?.gatewayLogout?.();
      if (!r?.success) console.error('logout failed:', r?.error);
      else window.dispatchEvent(new CustomEvent('gateway:logged-out'));
    } finally { setBusy(false); }
  };

  const doHardLogout = async () => {
    if (busy) return;
    setBusy(true); setModal(null); setIsOpen(false);
    try {
      const api = getApi();
      const r = await api?.gatewayHardLogout?.();
      if (!r?.success) console.error('hardLogout failed:', r?.error);
      else window.dispatchEvent(new CustomEvent('gateway:logged-out'));
    } finally { setBusy(false); }
  };

  const handleLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const api = getApi();
      const r = await api?.gatewayLogin?.();
      if (r?.success) {
        const info = await api.gatewayGetUserInfo();
        if (info?.success) setUserInfo(info.data);
        window.dispatchEvent(new CustomEvent('gateway:logged-in'));
      } else {
        alert('Ошибка входа: ' + (r?.error || 'неизвестная'));
      }
    } catch (e: any) {
      alert('Ошибка: ' + (e?.message || String(e)));
    } finally { setBusy(false); }
  };

  const openExternal = (url: string) => {
    const api = getApi();
    if (api?.gatewayOpenExternal) api.gatewayOpenExternal(url);
    else window.open(url, '_blank');
    setIsOpen(false);
  };

  // ─── Не залогинен — кнопка "Войти" ───
  if (userInfo === null) {
    return (
      <div className="_7b40dad f14f3a6d">
        <div className="dc1f7bee _4bcc731">
          <div
            className="_2afd28d"
            tabIndex={0}
            onClick={handleLogin}
            style={{
              justifyContent: 'center', width: '100%',
              opacity: busy ? 0.5 : 1,
              pointerEvents: busy ? 'none' : 'auto',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {busy ? 'Ожидание входа...' : 'Войти в DeepSeek'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Залогинен — профиль + меню ───
  return (
    <>
      <div className="_7b40dad f14f3a6d" ref={menuRef} style={{ position: 'relative' }}>
        <div className="dc1f7bee _4bcc731">
          <div className="_2afd28d" tabIndex={0} onClick={() => setIsOpen((v) => !v)}>
            <div className="ede5bc47">
              <img
                className="fdf01f38"
                src={userInfo.avatarUrl}
                alt=""
                aria-hidden="true"
                style={{ display: 'block' }}
              />
            </div>
            <div className="_9d8da05">{userInfo.name}</div>
            <div className="ds-icon _39cc453" style={{ fontSize: 16, width: 16, height: 16 }}>
              <MoreIcon size={16} />
            </div>
            <div className="ds-focus-ring" />
          </div>
        </div>

        {isOpen && (
          <div
            className="ds-dropdown-menu ds-elevated"
            role="menu"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 12, right: 12,
              zIndex: 100000000,
            }}
          >
            <div className="ds-dropdown-menu-option" onClick={() => openExternal('https://download.deepseek.com/app/')}>
              <div className="ds-dropdown-menu-option__icon"><DownloadAppIcon size={16} /></div>
              <div className="ds-dropdown-menu-option__label">Скачать приложение</div>
            </div>
            <div className="ds-dropdown-menu-option" onClick={() => { alert('Настройки GW: скоро'); setIsOpen(false); }}>
              <div className="ds-dropdown-menu-option__icon"><SettingsMenuIcon size={16} /></div>
              <div className="ds-dropdown-menu-option__label">Настройки</div>
            </div>
            <div className="ds-dropdown-menu-option" onClick={() => openExternal('https://chat.deepseek.com/feedback')}>
              <div className="ds-dropdown-menu-option__icon"><HelpIcon size={16} /></div>
              <div className="ds-dropdown-menu-option__label">Помощь и обратная связь</div>
            </div>

            {/* ── Мягкий выход (отключиться) ── */}
            <div
              className="ds-dropdown-menu-option"
              onClick={() => { setIsOpen(false); setModal('soft'); }}
              title="Сессия сохранится — сможете войти без пароля"
            >
              <div className="ds-dropdown-menu-option__icon"><LogoutIcon size={16} /></div>
              <div className="ds-dropdown-menu-option__label">Отключиться</div>
            </div>

            {/* ── Полный выход (реальный logout) ── */}
            <div
              className="ds-dropdown-menu-option"
              onClick={() => { setIsOpen(false); setModal('hard'); }}
              title="Завершит сессию DeepSeek на этом устройстве"
            >
              <div className="ds-dropdown-menu-option__icon"><CloseIcon size={16} /></div>
              <div className="ds-dropdown-menu-option__label" style={{ color: '#ec3942' }}>
                Выйти из аккаунта
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Модалка: мягкий выход ─── */}
      {modal === 'soft' && (
        <ConfirmModal
          title="Отключиться?"
          body="Приложение отключится от DeepSeek, но сессия сохранится. При следующем «Войти» подключение произойдёт автоматически, без пароля."
          confirmLabel="Отключиться"
          busy={busy}
          danger={false}
          onConfirm={doSoftLogout}
          onCancel={() => setModal(null)}
        />
      )}

      {/* ─── Модалка: полный выход ─── */}
      {modal === 'hard' && (
        <ConfirmModal
          title="Выйти из аккаунта?"
          body="Сессия DeepSeek будет завершена. Следующий вход потребует пароль и, возможно, капчу. Сохранённая сессия будет перемещена в архив (storage.json.bak-…)."
          confirmLabel="Выйти"
          busy={busy}
          danger={true}
          onConfirm={doHardLogout}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  );
};

// ─── Переиспользуемая модалка подтверждения ───
const ConfirmModal: React.FC<{
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  danger: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, body, confirmLabel, busy, danger, onConfirm, onCancel }) => (
  <div
    style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onClick={onCancel}
  >
    <div
      style={{
        background: '#232326', padding: 20, borderRadius: 12,
        color: '#f5f5f5', width: 360,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#8a8a8f', marginBottom: 20, lineHeight: 1.4 }}>
        {body}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          className="ds-button ds-button--outlinedNeutral ds-button--m"
          onClick={onCancel}
          disabled={busy}
        >
          <span className="ds-button__content">Отмена</span>
        </button>
        <button
          className={`ds-button ${danger ? 'ds-button--primary' : 'ds-button--primary'} ds-button--m`}
          onClick={onConfirm}
          disabled={busy}
          style={danger ? { background: '#ec3942', color: '#fff' } : undefined}
        >
          <span className="ds-button__content">{busy ? '…' : confirmLabel}</span>
        </button>
      </div>
    </div>
  </div>
);