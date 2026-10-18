// src/components/PRANA_BINDU/PANELS/SettingsDialog/SettingsDialog.tsx
//
// Модалка настроек Prana-Bindu.
// Четыре панели, которые раньше были на главном скролле:
//   Профиль       — ProfilePanel
//   Подключения   — ConnectionsPanel
//   Синхронизация — SyncPanel (+ AutoSyncPanel внутри)
//   Импорт        — ImportPanel
//
// WellnessPanel остаётся на главной — это данные дня, не настройка.
// После sync-wellness внутри модалки → onAfterWellness() наружу,
// чтобы родитель перезагрузил WellnessPanel на главной.

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';

import {
  ProfilePanel,
  type ProfilePanelHandle,
} from '../PANELS/ProfilePanel/ProfilePanel';
import { ConnectionsPanel } from '../PANELS/ConnectionsPanel/ConnectionsPanel';
import { SyncPanel } from '../PANELS/SyncPanel/SyncPanel';
import { ImportPanel } from '../PANELS/ImportPanel/ImportPanel';

interface Props {
  visible: boolean;
  onHide: () => void;
  onAfterSync?: () => void | Promise<void>;
  onAfterWellness?: () => void | Promise<void>;
  onOpenDebug?: () => void;
  /** Диапазон синка — общий с главной. */
  syncFrom: Date;
  syncTo: Date;
  onSyncFromChange: (d: Date) => void;
  onSyncToChange: (d: Date) => void;
}

export const SettingsDialog: React.FC<Props> = ({
  visible,
  onHide,
  onAfterSync,
  onAfterWellness,
  onOpenDebug,
  syncFrom,
  syncTo,
  onSyncFromChange,
  onSyncToChange,
}) => {
  const profilePanelRef = useRef<ProfilePanelHandle>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!visible) setActiveIndex(0);
  }, [visible]);

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <span className="p-dialog-title pb-templates__title">
          <i className="pi pi-cog" /> Настройки
        </span>
      }
      style={{ width: '960px', height: '85vh', maxWidth: '96vw' }}
      maximizable
      modal
      className="pb-templates-dialog pb-settings-dialog"
    >
      <TabView
        activeIndex={activeIndex}
        onTabChange={(e) => setActiveIndex(e.index)}
        className="pb-settings-tabs"
      >
        <TabPanel header="Профиль">
          <div className="pb-settings-tab-content">
            <ProfilePanel ref={profilePanelRef} embedded />
          </div>
        </TabPanel>

        <TabPanel header="Подключения">
          <div className="pb-settings-tab-content">
            <ConnectionsPanel embedded />
          </div>
        </TabPanel>

        <TabPanel header="Синхронизация">
          <div className="pb-settings-tab-content">
            <SyncPanel
              embedded
              from={syncFrom}
              to={syncTo}
              onFromChange={onSyncFromChange}
              onToChange={onSyncToChange}
              onOpenDebug={onOpenDebug ?? (() => {})}
              onAfterSync={onAfterSync}
              onAfterThresholds={async () => {
                await profilePanelRef.current?.reload();
              }}
              onAfterZones={async () => {
                await profilePanelRef.current?.reload();
              }}
              onAfterWellness={onAfterWellness}
            />
          </div>
        </TabPanel>

        <TabPanel header="Импорт">
          <div className="pb-settings-tab-content">
            <ImportPanel embedded onAfterImport={onAfterSync} />
          </div>
        </TabPanel>
      </TabView>
    </Dialog>
  );
};