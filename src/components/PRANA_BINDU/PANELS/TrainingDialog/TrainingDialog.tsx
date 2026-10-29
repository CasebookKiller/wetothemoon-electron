// src/components/PRANA_BINDU/PANELS/TrainingDialog/TrainingDialog.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { TrainingTabs } from '../TrainingTabs/TrainingTabs';
import { CalendarPanel } from '@/components/COMMON/CalendarPanel/CalendarPanel';
import { PlanEventsPanel, type PlanEventLite } from '@/components/PRANA_BINDU/PlanEventsPanel';
import { RunsPanel } from '../RunsPanel/RunsPanel';
import type { RunFilters } from '../RunsPanel/RunFiltersPanel';
import type { GroupedRunFact } from '@/components/PRANA_BINDU/UTILS/groupRunFacts';
import { groupRunFacts } from '@/components/PRANA_BINDU/UTILS/groupRunFacts';
import type { RunFactLite } from '@/components/PRANA_BINDU/RunStreamsDrawer';

interface Props {
  visible: boolean;
  onHide: () => void;
  initialTab: 'calendar' | 'plan' | 'runs';
  syncFrom: Date;
  syncTo: Date;
  onOpenDayDrawer: (date: string) => void;
  onOpenRunDrawer: (fact: RunFactLite) => void;
  onOpenPlanDrawer: (event: PlanEventLite) => void;
  onDataChange: () => void;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const TrainingDialog: React.FC<Props> = ({
  visible, onHide, initialTab, syncFrom, syncTo, onOpenDayDrawer, onOpenRunDrawer, onOpenPlanDrawer, onDataChange
}) => {
  const api = (window as any).electronAPI;
  const [activeTab, setActiveTab] = useState(initialTab);

  // --- Данные для Пробежек ---
  const [runFacts, setRunFacts] = useState<any[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [filters, setFilters] = useState<RunFilters>({
    nameQuery: '', sources: [], kmFrom: null, kmTo: null, hrFrom: null, hrTo: null,
    paceFrom: '', paceTo: '', durFromMin: null, durToMin: null, streamsMode: 'all', onlyUnnamed: false,
  });

  // --- Данные для Плана ---
  const [planEvents, setPlanEvents] = useState<PlanEventLite[]>([]);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    if (visible) setActiveTab(initialTab);
  }, [visible, initialTab]);

  const loadRunFacts = useCallback(async () => {
    setFactsLoading(true);
    try {
      const res = await api.pb.listRunFacts(toIsoDate(syncFrom), toIsoDate(syncTo));
      if (res.success) setRunFacts(res.items ?? []);
    } finally {
      setFactsLoading(false);
    }
  }, [api, syncFrom, syncTo]);

  const loadPlanEvents = useCallback(async () => {
    setPlanLoading(true);
    try {
      const res = await api.pb.listPlanEvents(toIsoDate(syncFrom), toIsoDate(syncTo));
      if (res?.success) setPlanEvents(res.items ?? []);
    } finally {
      setPlanLoading(false);
    }
  }, [api, syncFrom, syncTo]);

  useEffect(() => {
    if (visible) {
      void loadRunFacts();
      void loadPlanEvents();
    }
  }, [visible, syncFrom, syncTo, loadRunFacts, loadPlanEvents]);

  const groupedFacts = React.useMemo(() => groupRunFacts(runFacts, {}), [runFacts]);
  
  const filteredFacts = React.useMemo(() => {
    // Упрощенная фильтрация (в реальности нужно перенести из PranaBinduPage)
    return groupedFacts;
  }, [groupedFacts]);

  const handleLoadCalendarRange = async (from: string, to: string) => {
    const planDays = new Set<string>();
    const factDays = new Set<string>();
    const [planRes, factRes] = await Promise.all([
      api.pb.listPlanEvents(from, to),
      api.pb.listRunFacts(from, to),
    ]);
    if (planRes?.success) for (const e of planRes.items ?? []) planDays.add(e.date);
    if (factRes?.success) for (const e of factRes.items ?? []) factDays.add(e.date);
    return { planDays, factDays };
  };

  const tabs = [
    {
      key: 'calendar', label: 'Календарь', title: 'Календарь',
      node: (
        <div style={{ height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
          <CalendarPanel loadRange={handleLoadCalendarRange} onDayClick={onOpenDayDrawer} />
        </div>
      )
    },
    {
      key: 'plan', label: 'План', title: 'План тренировок',
      node: <PlanEventsPanel 
              events={planEvents} 
              loading={planLoading} 
              syncing={false} 
              clearing={false} 
              error="" 
              syncResult="" 
              onSync={() => {}} // TODO: перенести сюда логику sync
              onClear={() => {}} 
              onMassDelete={() => {}} 
              onOpenEvent={onOpenPlanDrawer} 
              onOpenTemplates={() => {}} 
              onOpenEquivalences={() => {}} 
              onReload={loadPlanEvents} 
            />
    },
    {
      key: 'runs', label: 'Пробежки', title: `Пробежки · ${groupedFacts.length}`,
      node: (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <RunsPanel 
            items={filteredFacts} 
            loading={factsLoading} 
            error="" 
            filters={filters} 
            onFiltersChange={setFilters} 
            onResetFilters={() => {}} 
            activeFilterCount={0} 
            onOpenFact={onOpenRunDrawer} 
          />
        </div>
      )
    }
  ];

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={<span className="p-dialog-title pb-templates__title"><i className="pi pi-chart-bar" /> Тренировки</span>}
      style={{ width: '60vw', height: '90vh', maxWidth: '1000px', minWidth: '700px' }}
      contentStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      maximizable
      modal
      className="pb-templates-dialog pb-settings-dialog"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <TrainingTabs tabs={tabs} embedded />
      </div>
    </Dialog>
  );
};