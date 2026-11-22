// src/components/GATEWAY/GatewayAccountsButton/GatewayAccountsButton.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { AppIcon } from '@/components/COMMON/AppIcon/AppIcon';
import { GatewayAccountsDialog } from '../GatewayAccountsDialog/GatewayAccountsDialog';

const getApi = () =>
  (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

interface ProfileInfo {
  id: string;
  name: string;
  browserKind?: 'yandex' | 'chrome';
  cdpPort: number;
  chromeCdpPort?: number;
  hasSession: boolean;
}

interface GatewayAccountsButtonProps {
  /** Колбэк при открытии диалога — родитель скрывает TopControlPanel. */
  onOpen?: () => void;
}

export const GatewayAccountsButton: React.FC<GatewayAccountsButtonProps> = ({ onOpen }) => {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<ProfileInfo | null>(null);

  const refresh = useCallback(async () => {
    const api = getApi();
    if (!api?.gatewayProfilesList) return;
    try {
      const r = await api.gatewayProfilesList();
      if (r.success && r.data) {
        const p = r.data.profiles.find((x: ProfileInfo) => x.id === r.data.activeId);
        setActive(p ?? null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const onSwitched = () => refresh();
    window.addEventListener('gateway:profile-switched', onSwitched);
    return () => window.removeEventListener('gateway:profile-switched', onSwitched);
  }, [refresh]);

  const kind: 'yandex' | 'chrome' = active?.browserKind === 'chrome' ? 'chrome' : 'yandex';
  const label = active
    ? `${active.name} · ${kind === 'chrome' ? 'Chrome' : 'Yandex'}`
    : 'Аккаунт';
  const iconName = kind === 'chrome' ? 'public' : 'language';

  return (
    <>
      <Button
        className="pb-soft"
        onClick={() => { onOpen?.(); setVisible(true); }}
        tooltip="Управление аккаунтами"
        tooltipOptions={{ position: 'bottom' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AppIcon name={iconName} set="material" size="sm" />
          <span>{label}</span>
        </div>
      </Button>
      <GatewayAccountsDialog
        visible={visible}
        onClose={() => setVisible(false)}
        onChanged={refresh}
      />
    </>
  );
};

export default GatewayAccountsButton;