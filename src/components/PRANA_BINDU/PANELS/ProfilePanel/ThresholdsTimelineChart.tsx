// src/components/PRANA_BINDU/PANELS/ProfilePanel/ThresholdsTimelineChart.tsx
//
// График динамики LTHR / HRmax / RestHR по rolling-окну.

import React, { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

interface TimelinePoint {
  date: string;
  lthr: number | null;
  hrmax: number | null;
  resthr: number | null;
  testsUsed: number;
  source: 'test_segments' | 'autoscan' | 'insufficient';
}

interface Props {
  lthrTestDuration: number;
  onlyClean: boolean;
}

type PeriodMonths = 6 | 12 | 24;
type WindowDays = 30 | 60 | 90;

export const ThresholdsTimelineChart: React.FC<Props> = ({
  lthrTestDuration,
  onlyClean,
}) => {
  const api = (window as any).electronAPI;

  const [periodMonths, setPeriodMonths] = useState<PeriodMonths>(12);
  const [windowDays, setWindowDays] = useState<WindowDays>(60);

  const [showLthr, setShowLthr] = useState(true);
  const [showHrmax, setShowHrmax] = useState(true);
  const [showResthr, setShowResthr] = useState(true);

  const [points, setPoints] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - periodMonths);
      const pad = (n: number) => String(n).padStart(2, '0');
      const iso = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      const res = await api.pb.thresholdsTimeline({
        from: iso(from),
        to: iso(to),
        windowDays,
        stepDays: 14,
        lthrTestDuration,
        onlyClean,
      });
      if (!res?.success) {
        setError(res?.error ?? 'Ошибка загрузки');
        return;
      }
      setPoints(res.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMonths, windowDays, lthrTestDuration, onlyClean]);

  const chartData = useMemo(() => {
    const labels = points.map((p) => p.date);
    const datasets: any[] = [];

    if (showLthr) {
      datasets.push({
        label: 'LTHR',
        data: points.map((p) => p.lthr),
        borderColor: '#d4a373',
        backgroundColor: 'rgba(212, 163, 115, 0.15)',
        borderWidth: 2.5,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#d4a373',
      });
    }
    if (showHrmax) {
      datasets.push({
        label: 'HRmax',
        data: points.map((p) => p.hrmax),
        borderColor: '#ff6b6b',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [6, 4],
        tension: 0.3,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#ff6b6b',
      });
    }
    if (showResthr) {
      datasets.push({
        label: 'RestHR',
        data: points.map((p) => p.resthr),
        borderColor: '#6ab2f2',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#6ab2f2',
      });
    }

    return { labels, datasets };
  }, [points, showLthr, showHrmax, showResthr]);

  const chartOptions = useMemo(() => {
    const rootStyles = getComputedStyle(document.body);
    const hintColor = rootStyles.getPropertyValue('--tg-hint').trim() || '#708499';
    const borderColor = rootStyles.getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.08)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top' as const,
          align: 'end' as const,
          labels: {
            color: hintColor,
            boxWidth: 12,
            boxHeight: 2,
            usePointStyle: false,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(23, 33, 43, 0.95)',
          borderColor: 'rgba(212, 163, 115, 0.4)',
          borderWidth: 1,
          titleColor: '#d4a373',
          bodyColor: '#f5f5f5',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            afterBody: (items: any[]) => {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const p = points[idx];
              if (!p) return '';
              return `Тестов: ${p.testsUsed} · ${p.source === 'test_segments' ? 'по тестам' : 'нет данных'}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: borderColor, display: false },
          ticks: { color: hintColor, font: { size: 10 }, maxRotation: 0 },
        },
        y: {
          grid: { color: borderColor },
          ticks: { color: hintColor, font: { size: 10 } },
          // Разный диапазон для LTHR/HRmax (100-200) и RestHR (40-70),
          // поэтому оставляем авто-масштаб по видимым линиям
          beginAtZero: false,
        },
      },
    };
  }, [points]);

  const isEmpty = !loading && points.length > 0 && points.every((p) => p.lthr == null && p.hrmax == null && p.resthr == null);

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--pb-accent)' }}>
          <i className="pi pi-chart-line" /> Динамика порогов
        </span>

        <Dropdown
          value={periodMonths}
          options={[
            { label: '6 мес.', value: 6 },
            { label: '12 мес.', value: 12 },
            { label: '24 мес.', value: 24 },
          ]}
          onChange={(e) => setPeriodMonths(e.value)}
          className="pb-wade-programs__dd"
          style={{ minWidth: '7rem' }}
          panelClassName="pb-dropdown-panel"
        />

        <Dropdown
          value={windowDays}
          options={[
            { label: 'Окно 30 дн.', value: 30 },
            { label: 'Окно 60 дн.', value: 60 },
            { label: 'Окно 90 дн.', value: 90 },
          ]}
          onChange={(e) => setWindowDays(e.value)}
          className="pb-wade-programs__dd"
          style={{ minWidth: '9rem' }}
          panelClassName="pb-dropdown-panel"
        />

        <label className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
          <Checkbox checked={showLthr} onChange={(e) => setShowLthr(!!e.checked)} />
          <span style={{ marginLeft: '0.3rem' }}>LTHR</span>
        </label>
        <label className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
          <Checkbox checked={showHrmax} onChange={(e) => setShowHrmax(!!e.checked)} />
          <span style={{ marginLeft: '0.3rem' }}>HRmax</span>
        </label>
        <label className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
          <Checkbox checked={showResthr} onChange={(e) => setShowResthr(!!e.checked)} />
          <span style={{ marginLeft: '0.3rem' }}>RestHR</span>
        </label>

        <Button
          icon="pi pi-refresh"
          text
          className="pb-soft p-button-sm"
          style={{ marginLeft: 'auto', padding: '0.1rem', width: '1.8rem', height: '1.8rem' }}
          onClick={() => void load()}
          disabled={loading}
          tooltip="Обновить"
          tooltipOptions={{ position: 'bottom' }}
        />
      </div>

      {error && (
        <div style={{ color: 'var(--tg-destructive)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tg-hint)' }}>
          <i className="pi pi-spin pi-spinner" style={{ marginRight: '0.5rem' }} />
          Считаем…
        </div>
      )}

      {!loading && isEmpty && (
        <div
          className="pb-hint"
          style={{
            padding: '1rem',
            textAlign: 'center',
            border: '1px dashed var(--surface-border)',
            borderRadius: 6,
            fontSize: '0.8rem',
          }}
        >
          Пока нет данных для графика. Сохраните хотя бы 3 теста{' '}
          {lthrTestDuration < 60
            ? `${lthrTestDuration}с`
            : `${Math.round(lthrTestDuration / 60)}м`}{' '}
          через редактор карт (🎯 → «💾 Сохранить как тест»).
        </div>
      )}

      {!loading && !isEmpty && points.length > 0 && (
        <div style={{ height: '280px', position: 'relative' }}>
          <Chart type="line" data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
};