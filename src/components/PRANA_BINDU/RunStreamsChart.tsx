// src/components/PRANA_BINDU/RunStreamsChart.tsx
//
// График одного канала из payload run_streams.
// X-ось — sec_t / dist_m / poly_sec_t, Y — любой числовой массив.
// Для HR дополнительно рисуем LTHR и HRmax из profile.
//
// Диагностика: считаем число уникальных значений и stddev.
// Если данных подозрительно мало — показываем предупреждение.

import React, { useEffect, useMemo, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { Chart } from 'primereact/chart';
import { Message } from 'primereact/message';

interface Props {
  runFactId: number | null;
  source: string;
  refreshKey?: string | number;
}

interface StreamsPayload {
  [key: string]: unknown;
}

const ACCENT = '#d4a373';

function fmtNum(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

export const RunStreamsChart: React.FC<Props> = ({
  runFactId,
  source,
  refreshKey,
}) => {
  const api = (window as any).electronAPI;

  const [payload, setPayload] = useState<StreamsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [xAxis, setXAxis] = useState<string>('sec_t');
  const [yChannel, setYChannel] = useState<string>('hr');
  const [profile, setProfile] = useState<any>(null);

  // Загрузка payload
  useEffect(() => {
    if (runFactId == null || !source) return;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await api.pb.getRunStreams(runFactId, source);
        if (res?.success) {
          setPayload(res.payload ?? null);
        } else {
          setError(res?.error ?? 'Не удалось загрузить потоки');
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFactId, source, refreshKey]);

  // Профиль — для порогов на HR-графике
  useEffect(() => {
    (async () => {
      try {
        const res = await api.pb.getProfile();
        if (res?.success) setProfile(res.data);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Доступные каналы
  const { xOptions, yOptions } = useMemo(() => {
    if (!payload) return { xOptions: [] as any[], yOptions: [] as any[] };
    const xOpts: { label: string; value: string }[] = [];
    const yOpts: { label: string; value: string }[] = [];

    for (const [key, val] of Object.entries(payload)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'number') {
        if (key === 'sec_t' || key === 'dist_m' || key === 'poly_sec_t') {
          xOpts.push({ label: key, value: key });
        }
        yOpts.push({ label: key, value: key });
      }
    }
    return { xOptions: xOpts, yOptions: yOpts };
  }, [payload]);

  // Автовыбор X
  useEffect(() => {
    if (!xOptions.length) return;
    if (!xOptions.some((o) => o.value === xAxis)) {
      const hasSecT = xOptions.find((o) => o.value === 'sec_t');
      setXAxis(hasSecT ? 'sec_t' : xOptions[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xOptions]);

  // Автовыбор Y
  useEffect(() => {
    if (!yOptions.length) return;
    if (!yOptions.some((o) => o.value === yChannel)) {
      const hasHr = yOptions.find((o) => o.value === 'hr');
      setYChannel(hasHr ? 'hr' : yOptions[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yOptions]);

  // Данные, опции, статистика
  const { chartData, chartOptions, stats, flatWarning } = useMemo(() => {
    const empty = {
      chartData: null as any,
      chartOptions: null as any,
      stats: null as any,
      flatWarning: null as string | null,
    };
    if (!payload) return empty;

    const xs = payload[xAxis] as number[] | undefined;
    const ys = payload[yChannel] as number[] | undefined;
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length < 2) {
      return empty;
    }

    const len = Math.min(xs.length, ys.length);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < len; i++) {
      const x = xs[i];
      const y = ys[i];
      if (
        typeof x === 'number' &&
        typeof y === 'number' &&
        Number.isFinite(x) &&
        Number.isFinite(y)
      ) {
        points.push({ x, y });
      }
    }

    if (points.length < 2) return empty;

    const yVals = points.map((p) => p.y);
    const min = Math.min(...yVals);
    const max = Math.max(...yVals);
    const avg = yVals.reduce((a, b) => a + b, 0) / yVals.length;
    const variance =
      yVals.reduce((a, b) => a + (b - avg) ** 2, 0) / yVals.length;
    const stddev = Math.sqrt(variance);
    const uniq = new Set(yVals).size;

    // Эвристика «данные подозрительно плоские»:
    //  - мало уникальных значений (< 20) при большом числе точек (> 100)
    //  - очень маленький stddev (< 1)
    let flatWarning: string | null = null;
    if (yVals.length > 100 && uniq < 20) {
      flatWarning = `Подозрительно мало уникальных значений: ${uniq} из ${yVals.length}. Возможно, источник отдаёт сглаженный сигнал.`;
    } else if (yVals.length > 100 && stddev < 1) {
      flatWarning = `Стандартное отклонение ${stddev.toFixed(2)} — данные почти плоские. Возможно, источник сглаживает сигнал.`;
    }

    const datasets: any[] = [
      {
        label: yChannel,
        data: points,
        borderColor: ACCENT,
        backgroundColor: 'rgba(212, 163, 115, 0.12)',
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.5,
        fill: false,
        spanGaps: false,
      },
    ];

    // Пороговые линии для HR
    if (yChannel === 'hr' && profile) {
      const x0 = points[0].x;
      const x1 = points[points.length - 1].x;

      if (Number.isFinite(profile.lactateThresholdHr)) {
        datasets.push({
          label: `LTHR ${profile.lactateThresholdHr}`,
          data: [
            { x: x0, y: profile.lactateThresholdHr },
            { x: x1, y: profile.lactateThresholdHr },
          ],
          borderColor: '#e8a838',
          borderDash: [6, 4],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        });
      }
      if (Number.isFinite(profile.maxHr)) {
        datasets.push({
          label: `HRmax ${profile.maxHr}`,
          data: [
            { x: x0, y: profile.maxHr },
            { x: x1, y: profile.maxHr },
          ],
          borderColor: '#ec3942',
          borderDash: [6, 4],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        });
      }
    }

    // Y-ось: tight fit к диапазону данных с запасом 10 %.
    // Без beginAtZero — иначе Chart.js прижмёт данные к верхней кромке.
    const yPadding = Math.max((max - min) * 0.1, 1);
    const yMin = min - yPadding;
    const yMax = max + yPadding;

    const xLabel =
      xAxis === 'sec_t'
        ? 'время, сек'
        : xAxis === 'dist_m'
        ? 'дистанция, м'
        : xAxis === 'poly_sec_t'
        ? 'секунда'
        : xAxis;

    const options: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      normalized: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#a0aec0',
            boxWidth: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.parsed.y;
              return `${ctx.dataset.label}: ${fmtNum(v)}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: xLabel, color: '#a0aec0' },
          ticks: { color: '#a0aec0', maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          type: 'linear',
          title: { display: true, text: yChannel, color: '#a0aec0' },
          ticks: { color: '#a0aec0' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: false,
          min: yMin,
          max: yMax,
        },
      },
    };

    return {
      chartData: { datasets },
      chartOptions: options,
      stats: { min, max, avg, stddev, uniq, count: yVals.length },
      flatWarning,
    };
  }, [payload, xAxis, yChannel, profile]);

  if (loading) {
    return <div className="pb-drawer__hint">Загрузка потоков…</div>;
  }
  if (error) {
    return <Message severity="error" text={error} className="w-full" />;
  }
  if (!payload) return null;

  return (
    <div className="pb-chart">
      <div className="pb-chart__controls">
        <div className="pb-chart__control">
          <label className="pb-label">Ось X</label>
          <Dropdown
            value={xAxis}
            options={xOptions}
            onChange={(e) => setXAxis(e.value)}
            className="pb-chart__dropdown"
          />
        </div>
        <div className="pb-chart__control">
          <label className="pb-label">Канал</label>
          <Dropdown
            value={yChannel}
            options={yOptions}
            onChange={(e) => setYChannel(e.value)}
            className="pb-chart__dropdown"
          />
        </div>
      </div>

      {stats && (
        <div className="pb-chart__stats">
          <span>
            мин <b>{fmtNum(stats.min)}</b>
          </span>
          <span>
            сред <b>{fmtNum(stats.avg)}</b>
          </span>
          <span>
            макс <b>{fmtNum(stats.max)}</b>
          </span>
          <span>
            σ <b>{fmtNum(stats.stddev, 2)}</b>
          </span>
          <span>
            уник <b>{stats.uniq}</b>
          </span>
          <span>
            точек <b>{stats.count}</b>
          </span>
        </div>
      )}

      {flatWarning && (
        <Message severity="warn" text={flatWarning} className="w-full" />
      )}

      {chartData && chartOptions ? (
        <div className="pb-chart__canvas">
          <Chart type="line" data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className="pb-drawer__hint">
          Недостаточно данных для графика
        </div>
      )}
    </div>
  );
};