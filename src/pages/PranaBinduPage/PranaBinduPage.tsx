// src/pages/PranaBinduPage/PranaBinduPage.tsx

import React, { useEffect, useState } from 'react';
import { FullWeek } from '@/components/PRANA_BINDU/FullWeek';
import { Dashboard } from '@/components/PRANA_BINDU/PANELS/Dashboard/Dashboard';
import { TrainingDialog } from '@/components/PRANA_BINDU/PANELS/TrainingDialog/TrainingDialog';
import { HealthDialog } from '@/components/PRANA_BINDU/PANELS/HealthDialog/HealthDialog';
import { HealthDashboardDialog } from '@/components/PRANA_BINDU/PANELS/HealthDashboard/HealthDashboardDialog';
import { SettingsDialog } from '@/components/PRANA_BINDU/SettingsDialog/SettingsDialog';
import { DayDrawer } from '@/components/PRANA_BINDU/DayDrawer';
import { RouteMapEditor } from '@/components/PRANA_BINDU/RouteMapEditor';
import { ExerciseGraphDialog } from '@/components/PRANA_BINDU/ExerciseGraph/ExerciseGraphDialog';
import { RunStreamsDrawer, type RunFactLite } from '@/components/PRANA_BINDU/RunStreamsDrawer';
import { PlanEventDrawer } from '@/components/PRANA_BINDU/PlanEventDrawer';
import type { PlanEventLite } from '@/components/PRANA_BINDU/PlanEventsPanel';
import { CheckReminderDialog } from '@/components/PRANA_BINDU/CheckReminderDialog';
import { WorkoutTemplatesDialog } from '@/components/PRANA_BINDU/WorkoutTemplatesDialog';
import { addLocale, locale } from 'primereact/api';
import { Toast } from 'primereact/toast';
import './PranaBinduPage.css';

// Настройка локали
addLocale('ru', { firstDayOfWeek: 1, dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'], dayNamesShort: ['Вос', 'Пон', 'Вто', 'Сре', 'Чет', 'Пят', 'Суб'], dayNamesMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'], monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'], today: 'Сегодня', clear: 'Очистить' });
locale('ru');

export const PranaBinduPage: React.FC = () => {
  const api = (window as any).electronAPI;
  const toastRef = React.useRef<Toast>(null);

  // Диапазон для запросов
  const [syncFrom, setSyncFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
  const [syncTo, setSyncTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; });

  const [refreshKey, setRefreshKey] = useState(0);

  // Состояния диалогов
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [standaloneRunId, setStandaloneRunId] = useState<number | null>(null);
  const [graphVisible, setGraphVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [reminderDue, setReminderDue] = useState<string[]>([]);

  // Тяжелые диалоги
  const [trainingVisible, setTrainingVisible] = useState(false);
  const [trainingTab, setTrainingTab] = useState<'calendar' | 'plan' | 'runs'>('runs');

  const [healthVisible, setHealthVisible] = useState(false);
  const [healthTab, setHealthTab] = useState<'wellness' | 'nutrition'>('wellness');
  const [analyticsVisible, setAnalyticsVisible] = useState(false);

  // Drawer'ы
  const [dayDrawerDate, setDayDrawerDate] = useState<string | null>(null);
  const [runDrawerFact, setRunDrawerFact] = useState<RunFactLite | null>(null);
  const [planDrawerEvent, setPlanDrawerEvent] = useState<PlanEventLite | null>(null);

  useEffect(() => {
    document.body.setAttribute('data-module', 'prana-bindu');
    return () => document.body.removeAttribute('data-module');
  }, []);

  const handleRefreshAll = () => setRefreshKey(k => k + 1);

  const handleOpenTraining = (tab: 'calendar' | 'plan' | 'runs') => {
    setTrainingTab(tab);
    setTrainingVisible(true);
  };

  const handleOpenHealth = (tab: 'wellness' | 'nutrition') => {
    setHealthTab(tab);
    setHealthVisible(true);
  };

  return (
    <div className="pb-page-root">
      <FullWeek
        key={`fw-refresh-${refreshKey}`}
        onDayClick={(d) => setDayDrawerDate(d)}
        onOpenPlanEvent={(event) => {
           setPlanDrawerEvent(event);
        }}
        onOpenRunFact={(fact) => {
           setRunDrawerFact(fact);
        }}
        onOpenSettings={() => setSettingsVisible(true)}
        onOpenExercises={() => setTemplatesVisible(true)}
        onOpenGraph={() => setGraphVisible(true)}
        onOpenMap={() => { setStandaloneRunId(null); setMapVisible(true); }}
      />

      <div className="pb-page p-4">
        <div className="pb-page__content" style={{ maxWidth: '1400px', margin: '0 auto' }}>
          
          {/* 1. Новый Дашборд с виджетами */}
          <Dashboard
            refreshKey={refreshKey}
            onOpenTraining={handleOpenTraining}
            onOpenHealth={handleOpenHealth}
            onOpenAnalytics={() => setAnalyticsVisible(true)}
          />

          {/* 2. Карточки модулей (Stillsuit, Crysknife и т.д.) */}
          <div className="grid mt-4">
            {[
              { name: 'Stillsuit', description: 'Марафон: пульс, темп, экономичность' },
              { name: 'Crysknife', description: 'Big-6: сила, контроль, сухожилия' },
              { name: 'Mentat', description: 'Календарь, периодизация, подводка к старту' },
              { name: 'Water Discipline', description: 'Сон, HRV, гидратация, восстановление' },
              { name: 'Spice', description: 'Аналитика, Google Fit, Zepp, dodofo' },
            ].map((m) => (
              <div key={m.name} className="col-12 md:col-6 lg:col-3 p-2">
                <div className="surface-card p-3 shadow-2 border-round h-full">
                  <div className="pb-module-name">{m.name}</div>
                  <div className="pb-module-desc">{m.description}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* === ВСЕ ДИАЛОГИ И DRAWER'Ы === */}

      <TrainingDialog
        visible={trainingVisible}
        initialTab={trainingTab}
        onHide={() => setTrainingVisible(false)}
        syncFrom={syncFrom}
        syncTo={syncTo}
        onOpenDayDrawer={(d) => { setTrainingVisible(false); setDayDrawerDate(d); }}
        onOpenRunDrawer={(f) => { setTrainingVisible(false); setRunDrawerFact(f); }}
        onOpenPlanDrawer={(p) => { setTrainingVisible(false); setPlanDrawerEvent(p); }}
        onDataChange={handleRefreshAll}
      />

      <HealthDialog
        visible={healthVisible}
        initialTab={healthTab}
        onHide={() => setHealthVisible(false)}
        syncFrom={syncFrom}
        syncTo={syncTo}
      />

      <HealthDashboardDialog
        visible={analyticsVisible}
        onHide={() => setAnalyticsVisible(false)}
      />

      <SettingsDialog
        visible={settingsVisible}
        onHide={() => setSettingsVisible(false)}
        onAfterSync={handleRefreshAll}
        onAfterWellness={handleRefreshAll}
        syncFrom={syncFrom}
        syncTo={syncTo}
        onSyncFromChange={setSyncFrom}
        onSyncToChange={setSyncTo}
      />

      <DayDrawer
        visible={!!dayDrawerDate}
        date={dayDrawerDate}
        onHide={() => setDayDrawerDate(null)}
        onAfterChange={handleRefreshAll}
      />

      <RunStreamsDrawer
        visible={!!runDrawerFact}
        runFact={runDrawerFact}
        onHide={() => setRunDrawerFact(null)}
        onAfterSync={handleRefreshAll}
        onOpenFullMap={(id) => { setRunDrawerFact(null); setStandaloneRunId(id); setMapVisible(true); }}
      />

      <PlanEventDrawer
        visible={!!planDrawerEvent}
        event={planDrawerEvent}
        onHide={() => setPlanDrawerEvent(null)}
        onSaved={handleRefreshAll}
      />

      <RouteMapEditor
        visible={mapVisible}
        initialRunId={standaloneRunId ?? undefined}
        onHide={() => { setMapVisible(false); setStandaloneRunId(null); }}
      />

      <ExerciseGraphDialog
        visible={graphVisible}
        onHide={() => setGraphVisible(false)}
      />

      <WorkoutTemplatesDialog
        visible={templatesVisible}
        onHide={() => setTemplatesVisible(false)}
      />

      <Toast ref={toastRef} position="top-right" />
    </div>
  );
};