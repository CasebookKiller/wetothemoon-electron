import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Chart } from 'primereact/chart';
import { TabView, TabPanel } from 'primereact/tabview';
import { Dropdown } from 'primereact/dropdown';
import { groupRunFacts } from '@/components/PRANA_BINDU/UTILS/groupRunFacts';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';

interface Props {
  visible: boolean;
  onHide: () => void;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const HealthDashboardDialog: React.FC<Props> = ({ visible, onHide }) => {
  const api = (window as any).electronAPI;
  const [rangeDays, setRangeDays] = useState(90);
  const [loading, setLoading] = useState(false);
  
  // Данные
  const [weights, setWeights] = useState<any[]>([]);
  const [water, setWater] = useState<Record<string, number>>({});
  const [recovery, setRecovery] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - rangeDays);
    const fromIso = toIsoDate(from);
    const toIso = toIsoDate(to);

    (async () => {
      try {
        const [wRes, watRes, recRes, runRes] = await Promise.all([
          api.pb.listWeights(rangeDays),
          api.pb.getWaterRange(fromIso, toIso),
          api.pb.listRecoveryLogs(fromIso, toIso),
          api.pb.listRunFacts(fromIso, toIso)
        ]);
        if (!alive) return;
        
        setWeights(wRes?.success ? wRes.items ?? [] : []);
        setWater(watRes?.success ? watRes.data ?? {} : {});
        setRecovery(recRes?.success ? recRes.items ?? [] : []);
        setRuns(runRes?.success ? runRes.items ?? [] : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [visible, rangeDays, api]);

  // Общие настройки графиков
  const chartOptions = useMemo(() => {
    const rootStyles = getComputedStyle(document.body);
    const hintColor = rootStyles.getPropertyValue('--tg-hint').trim() || '#708499';
    const borderColor = rootStyles.getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.08)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { position: 'top' as const, align: 'end' as const, labels: { color: hintColor, boxWidth: 12, boxHeight: 2, font: { size: 11 } } },
        tooltip: { backgroundColor: 'rgba(23, 33, 43, 0.95)', borderColor: 'rgba(212, 163, 115, 0.4)', borderWidth: 1, titleColor: '#d4a373', bodyColor: '#f5f5f5', padding: 10, cornerRadius: 6 },
      },
      scales: {
        x: { grid: { color: borderColor, display: false }, ticks: { color: hintColor, font: { size: 10 }, maxRotation: 0 } },
        y: { grid: { color: borderColor }, ticks: { color: hintColor, font: { size: 10 } }, beginAtZero: false },
      },
    };
  }, []);

  // Подготовка данных для графика Веса
  const weightChart = useMemo(() => {
    const sorted = [...weights].reverse(); // От старых к новым
    return {
      labels: sorted.map(w => w.date),
      datasets: [{
        label: 'Вес (кг)',
        data: sorted.map(w => w.weight_kg),
        borderColor: '#d4a373',
        backgroundColor: 'rgba(212, 163, 115, 0.15)',
        tension: 0.3,
        pointRadius: 3,
        fill: true,
      }]
    };
  }, [weights]);

  // Подготовка данных для графика Воды и Км
  const waterDistanceChart = useMemo(() => {
    // 1. Группируем сырые факты в логические тренировки (убираем дубли zepp/dodofo/icu)
    const groupedRuns = groupRunFacts(runs, {});

    // 2. Собираем уникальные даты из воды и сгруппированных пробежек
    const datesSet = new Set([...Object.keys(water), ...groupedRuns.map(g => g.date)]);
    const sortedDates = Array.from(datesSet).sort();

    // 3. Агрегация км по дням (используем только primary запись)
    const kmPerDay: Record<string, number> = {};
    for (const g of groupedRuns) {
      const km = g.primary.actual_km || 0;
      kmPerDay[g.date] = (kmPerDay[g.date] || 0) + km;
    }

    return {
      labels: sortedDates,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Вода (мл)',
          data: sortedDates.map(d => water[d] || 0),
          backgroundColor: 'rgba(106, 178, 242, 0.6)',
          borderColor: '#6ab2f2',
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          type: 'bar' as const,
          label: 'Пробег (км)',
          data: sortedDates.map(d => kmPerDay[d] || 0),
          backgroundColor: 'rgba(212, 163, 115, 0.8)',
          borderColor: '#d4a373',
          borderWidth: 1,
          yAxisID: 'y1',
        }
      ]
    };
  }, [water, runs]);

  const waterDistanceOptions = useMemo(() => {
    const base = { ...chartOptions };
    return {
      ...base,
      scales: {
        ...base.scales,
        y: { 
          ...base.scales.y, 
          position: 'left' as const, 
          title: { display: true, text: 'Вода (мл)', color: '#6ab2f2' },
          beginAtZero: true,
          suggestedMax: 5000, // <-- Увеличиваем потолок, чтобы столбцы воды были ниже
        },
        y1: { 
          ...base.scales.y, 
          position: 'right' as const, 
          grid: { drawOnChartArea: false }, 
          title: { display: true, text: 'Км', color: '#d4a373' },
          beginAtZero: true,  // <-- Начинаем ось км строго с нуля
          suggestedMax: 30,   // <-- Ограничиваем потолок для км
        }
      }
    };
  }, [chartOptions]);

  // Подготовка данных для Сна и RestHR
  const sleepChart = useMemo(() => {
    const sorted = [...recovery].sort((a,b) => a.date.localeCompare(b.date));
    return {
      labels: sorted.map(r => r.date),
      datasets: [
        {
          label: 'Сон (часы)',
          data: sorted.map(r => r.sleep_hours),
          borderColor: '#6ab2f2',
          backgroundColor: 'transparent',
          tension: 0.3,
          spanGaps: true,
          yAxisID: 'y',
        },
        {
          label: 'Пульс покоя (bpm)',
          data: sorted.map(r => r.resting_hr),
          borderColor: '#ec3942',
          backgroundColor: 'transparent',
          tension: 0.3,
          spanGaps: true,
          yAxisID: 'y1',
        }
      ]
    };
  }, [recovery]);

  const sleepOptions = useMemo(() => {
    const base = { ...chartOptions };
    return {
      ...base,
      scales: {
        ...base.scales,
        y: { ...base.scales.y, position: 'left' as const, title: { display: true, text: 'Часы', color: '#6ab2f2' }, min: 0, max: 12 },
        y1: { ...base.scales.y, position: 'right' as const, grid: { drawOnChartArea: false }, title: { display: true, text: 'bpm', color: '#ec3942' } }
      }
    };
  }, [chartOptions]);

  // Подготовка данных для CTL / ATL
  const loadChart = useMemo(() => {
    const sorted = [...recovery].sort((a,b) => a.date.localeCompare(b.date));
    return {
      labels: sorted.map(r => r.date),
      datasets: [
        { label: 'CTL (Форма)', data: sorted.map(r => r.ctl), borderColor: '#6fbf73', backgroundColor: 'transparent', tension: 0.3, spanGaps: true },
        { label: 'ATL (Усталость)', data: sorted.map(r => r.atl), borderColor: '#e8a838', backgroundColor: 'transparent', tension: 0.3, spanGaps: true },
      ]
    };
  }, [recovery]);

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={<span className="p-dialog-title pb-templates__title"><AppIcon name="chart-pie" color="accent" /> Полная аналитика</span>}
      style={{ width: '95vw', height: '90vh' }}
      maximizable
      modal
      className="pb-templates-dialog pb-settings-dialog"
      contentStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '0.5rem', flexShrink: 0 }}>
        <Dropdown
          value={rangeDays}
          options={[
            { label: '30 дней', value: 30 },
            { label: '90 дней', value: 90 },
            { label: '180 дней', value: 180 },
            { label: '365 дней', value: 365 },
          ]}
          onChange={(e) => setRangeDays(e.value)}
          className="pb-wade-programs__dd"
          panelClassName="pb-dropdown-panel"
        />
      </div>

      <TabView className="pb-settings-tabs" style={{ flex: 1, minHeight: 0 }}>
        
        {/* ВКЛАДКА 1: ВЕС */}
        <TabPanel header="Вес">
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              {loading ? <div className="pb-hint" style={{ textAlign: 'center', padding: '2rem' }}>Загрузка...</div> : <Chart type="line" data={weightChart} options={chartOptions} style={{ height: '100%' }} />}
            </div>
          </div>
        </TabPanel>

        {/* ВКЛАДКА 2: ВОДА И КМ */}
        <TabPanel header="Вода и Объём">
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              {loading ? <div className="pb-hint" style={{ textAlign: 'center', padding: '2rem' }}>Загрузка...</div> : <Chart type="bar" data={waterDistanceChart} options={waterDistanceOptions} style={{ height: '100%' }} />}
            </div>
          </div>
        </TabPanel>

        {/* ВКЛАДКА 3: СОН И ПУЛЬС */}
        <TabPanel header="Сон и Восстановление">
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              {loading ? <div className="pb-hint" style={{ textAlign: 'center', padding: '2rem' }}>Загрузка...</div> : <Chart type="line" data={sleepChart} options={sleepOptions} style={{ height: '100%' }} />}
            </div>
          </div>
        </TabPanel>

        {/* ВКЛАДКА 4: НАГРУЗКА */}
        <TabPanel header="Форма и Усталость">
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              {loading ? <div className="pb-hint" style={{ textAlign: 'center', padding: '2rem' }}>Загрузка...</div> : <Chart type="line" data={loadChart} options={chartOptions} style={{ height: '100%' }} />}
            </div>
          </div>
        </TabPanel>

      </TabView>
    </Dialog>
  );
};