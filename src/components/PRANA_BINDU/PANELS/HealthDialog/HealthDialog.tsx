import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { WellnessPanel } from '../WellnessPanel/WellnessPanel';
import { NutritionPanel } from '../NutritionPanel/NutritionPanel';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';

interface Props {
  visible: boolean;
  onHide: () => void;
  initialTab: 'wellness' | 'nutrition';
  syncFrom: Date;
  syncTo: Date;
}

export const HealthDialog: React.FC<Props> = ({ visible, onHide, initialTab, syncFrom, syncTo }) => {
  const [activeIndex, setActiveIndex] = useState(initialTab === 'wellness' ? 0 : 1);

  // Синхронизация вкладки при открытии
  React.useEffect(() => {
    if (visible) setActiveIndex(initialTab === 'wellness' ? 0 : 1);
  }, [visible, initialTab]);

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={<span className="p-dialog-title pb-templates__title"><AppIcon name="heart" color="accent" /> Здоровье и Восстановление</span>}
      style={{ width: '900px', height: '85vh', maxWidth: '96vw' }}
      maximizable
      modal
      contentStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      className="pb-templates-dialog pb-settings-dialog"
    >
      <TabView
        activeIndex={activeIndex}
        onTabChange={(e) => setActiveIndex(e.index)}
        className="pb-settings-tabs"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <TabPanel header="Здоровье (Wellness)">
          <div className="pb-settings-tab-content" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, paddingRight: '0.5rem', overflow: 'hidden' }}>
            <WellnessPanel from={syncFrom} to={syncTo} embedded />
          </div>
        </TabPanel>
        <TabPanel header="Вода и Питание">
          <div className="pb-settings-tab-content" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <NutritionPanel embedded />
          </div>
        </TabPanel>
      </TabView>
    </Dialog>
  );
};