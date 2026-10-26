// src/components/PRANA_BINDU/FullscreenChartsDialog.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Slider } from 'primereact/slider';
import { Dropdown } from 'primereact/dropdown';
import {
  drawMultiChart,
  DEFAULT_PANELS,
  type ChartPanelConfig,
  type ChartRawData,
} from './UTILS/chartRender';
import {
  getSavedChartColors,
  saveChartColors,
  resetChartColors,
  type ChannelColorSet,
} from './UTILS/chartColors';

interface Props {
  visible: boolean;
  onHide: () => void;
  runFactId: number | null;
  source: string;
}

function fmtValue(channel: string, val: number | null | undefined, unit: string) {
  if (val == null || !Number.isFinite(val)) return '—';
  if (channel === 'pace') {
    if (val <= 2) return '—';
    const sec = 3600 / val;
    return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} ${unit}`;
  }
  if (channel === 'elevation') {
    return `${val.toFixed(1)} ${unit}`;
  }
  return `${Math.round(val)} ${unit}`;
}

export const FullscreenChartsDialog: React.FC<Props> = ({
  visible,
  onHide,
  runFactId,
  source,
}) => {
  const api = (window as any).electronAPI;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ChartRawData | null>(null);
  const [error, setError] = useState('');

  const [panels, setPanels] = useState<ChartPanelConfig[]>(() =>
    JSON.parse(JSON.stringify(DEFAULT_PANELS))
  );
  const [colors, setColors] = useState<ChannelColorSet>(() => getSavedChartColors());
  const [xAxis, setXAxis] = useState<'time' | 'distance'>('time');
  const [fillOpacity, setFillOpacity] = useState(0.15);
  
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<string | null>(null);

  // Отслеживаем реальный размер контейнера
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 700 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        if (width > 10 && height > 10) {
          setCanvasSize({ width, height });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]); // Пересоздаем при открытии (т.к. размеры меняются)

  useEffect(() => {
    if (!visible || !runFactId || !source) return;
    setLoading(true);
    setError('');
    setPayload(null);

    api.pb.getRunStreams(runFactId, source)
      .then((res: any) => {
        if (res?.success && res.payload) {
          setPayload(res.payload as ChartRawData);
        } else {
          setError(res?.error || 'Не удалось загрузить потоки');
        }
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [visible, runFactId, source, api]);

  // Рендер холста с реальными размерами
  useEffect(() => {
    if (!visible || !payload || !canvasRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvasSize.width;
      const H = canvasSize.height;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      drawMultiChart(ctx, {
        width: W,
        height: H,
        panels,
        colors,
        data: payload,
        xAxis,
        fillOpacity,
        lineWidth: 1.5,
        backgroundColor: '#1a1a1a',
        showAxes: true,
        hoverIndex,
      });
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, payload, panels, colors, xAxis, fillOpacity, hoverIndex, canvasSize]);

  const updateColor = (channel: keyof ChannelColorSet, val: string) => {
    const next = { ...colors, [channel]: val };
    setColors(next);
    saveChartColors(next);
  };

  const updatePanel = (channel: string, patch: Partial<ChartPanelConfig>) => {
    setPanels((prev) =>
      prev.map((p) => (p.channel === channel ? { ...p, ...patch } : p))
    );
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart-${runFactId}-${source}.png`;
    a.click();
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !payload) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Координаты теперь совпадают с логическими (т.к. мы рисуем 1:1)
    const W = rect.width;
    // Отступы должны совпадать с теми, что в chartRender.ts
    const PADDING_LEFT = 60;
    const PADDING_RIGHT = 12;
    const plotW = W - PADDING_LEFT - PADDING_RIGHT;
    
    const plotX = x - PADDING_LEFT;
    const xPct = plotX / plotW;
    
    if (xPct < 0 || xPct > 1) {
      setHoverIndex(null);
      setHoverTime(null);
      return;
    }
    
    const xs = xAxis === 'time' ? (payload.secT || payload.sec_t) : (payload.distM || payload.dist_m);
    
    if (xs && xs.length > 1) {
      const xMin = xs[0];
      const xMax = xs[xs.length - 1];
      const targetX = xMin + xPct * (xMax - xMin);
      
      // Бинарный поиск ближайшего индекса по значению
      let lo = 0;
      let hi = xs.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (xs[mid] < targetX) lo = mid + 1;
        else hi = mid;
      }
      let idx = lo;
      // Проверяем соседа слева (какой ближе)
      if (idx > 0 && Math.abs(xs[idx - 1] - targetX) < Math.abs(xs[idx] - targetX)) {
        idx = idx - 1;
      }
      
      if (idx >= 0 && idx < xs.length) {
        if (idx !== hoverIndex) {
          setHoverIndex(idx);
          const timeVal = xs[idx];
          if (xAxis === 'time') {
            const h = Math.floor(timeVal / 3600);
            const m = Math.floor((timeVal % 3600) / 60);
            const s = Math.round(timeVal % 60);
            setHoverTime(h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`);
          } else {
            setHoverTime(`${(timeVal / 1000).toFixed(2)} км`);
          }
        }
      }
    }
  }, [payload, xAxis, hoverIndex]);

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoverTime(null);
  };

  const getStatusData = () => {
    if (!payload) return [];
    const activePanels = panels.filter(p => p.enabled);
    
    if (hoverIndex !== null) {
      return activePanels.map(p => {
        let val: number | null = null;
        if (p.channel === 'hr') val = payload.hr?.[hoverIndex] ?? null;
        if (p.channel === 'pace') val = payload.speedKmh?.[hoverIndex] ?? null;
        if (p.channel === 'cadence') val = payload.cadence?.[hoverIndex] ?? null;
        if (p.channel === 'elevation') val = payload.elevationM?.[hoverIndex] ?? null;
        return {
          label: p.label,
          value: fmtValue(p.channel, val, p.unit),
          color: colors[p.channel as keyof ChannelColorSet]
        };
      });
    } else {
      return activePanels.map(p => {
        let arr: (number | null)[] | undefined;
        if (p.channel === 'hr') arr = payload.hr;
        if (p.channel === 'pace') arr = payload.speedKmh;
        if (p.channel === 'cadence') arr = payload.cadence;
        if (p.channel === 'elevation') arr = payload.elevationM;
        
        if (!arr) return { label: p.label, value: '—', color: colors[p.channel as keyof ChannelColorSet] };
        
        const valid = arr.filter((v): v is number => v != null && Number.isFinite(v));
        const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
        
        return {
          label: p.label,
          value: fmtValue(p.channel, avg, p.unit),
          color: colors[p.channel as keyof ChannelColorSet]
        };
      });
    }
  };

  const statusData = getStatusData();

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Аналитика тренировки"
      style={{ width: '95vw', maxWidth: '1400px', height: '90vh' }}
      maximizable
      modal
      className="pb-debug-dialog pb-map-editor-dialog"
      contentStyle={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* ЛЕВАЯ ПАНЕЛЬ НАСТРОЕК */}
        <div
          className="pb-story-sidebar"
          style={{
            width: '320px',
            flexShrink: 0,
            borderRight: '1px solid var(--surface-border)',
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div className="pb-connections__block">
            <div className="pb-connections__title">Каналы</div>
            {panels.map((p) => {
              const hasData = p.channel === 'hr' ? !!payload?.hr :
                              p.channel === 'pace' ? !!payload?.speedKmh :
                              p.channel === 'cadence' ? !!payload?.cadence :
                              p.channel === 'elevation' ? !!payload?.elevationM :
                              p.channel === 'power' ? !!payload?.power : false;
              
              return (
                <div key={p.channel} style={{ marginTop: '0.75rem', opacity: hasData ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label className="pb-check-row pb-checkbox-dark" style={{ cursor: hasData ? 'pointer' : 'default' }}>
                      <Checkbox
                        checked={p.enabled && hasData}
                        onChange={(e) => updatePanel(p.channel, { enabled: !!e.checked })}
                        disabled={!hasData}
                      />
                      <span style={{ fontWeight: 600 }}>{p.label}</span>
                    </label>
                    <input
                      type="color"
                      value={colors[p.channel as keyof ChannelColorSet]}
                      onChange={(e) => updateColor(p.channel as keyof ChannelColorSet, e.target.value)}
                      disabled={!hasData}
                      style={{ width: '2rem', height: '1.5rem', border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 'auto' }}
                    />
                  </div>
                  {p.enabled && hasData && (
                    <div style={{ marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--tg-hint)' }}>
                        <span>Высота панели</span>
                        <span>{p.heightRatio}x</span>
                      </div>
                      <Slider
                        value={p.heightRatio}
                        min={0.5} max={3} step={0.5}
                        onChange={(e) => updatePanel(p.channel, { heightRatio: e.value as number })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pb-connections__block">
            <div className="pb-connections__title">Оси и вид</div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.35rem' }}>Ось X</div>
              <Dropdown
                value={xAxis}
                options={[
                  { label: 'Время', value: 'time' },
                  { label: 'Дистанция', value: 'distance' }
                ]}
                onChange={(e) => setXAxis(e.value)}
                className="w-full"
                panelClassName="pb-dropdown-panel"
              />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--tg-hint)' }}>
                <span>Прозрачность заливки</span>
                <span>{Math.round(fillOpacity * 100)}%</span>
              </div>
              <Slider
                value={fillOpacity}
                min={0.05} max={0.4} step={0.05}
                onChange={(e) => setFillOpacity(e.value as number)}
              />
            </div>
            <Button
              label="Сбросить цвета"
              icon="pi pi-refresh"
              className="pb-soft p-button-sm w-full mt-3"
              onClick={() => setColors(resetChartColors())}
            />
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <Button
              label="Скачать PNG"
              icon="pi pi-download"
              className="pb w-full"
              onClick={handleDownload}
              disabled={!payload}
            />
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ С ГРАФИКОМ */}
        <div
          style={{
            flex: 1,
            background: '#1a1a1a',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* СТРОКА СТАТУСА (HEADER) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              padding: '0 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: '#111',
              color: '#fff',
              fontSize: '1rem',
              minHeight: '50px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: 'var(--pb-accent)',
                fontFamily: 'monospace',
                minWidth: '80px',
                fontSize: '1.25rem',
              }}
            >
              {hoverTime ?? (xAxis === 'time' ? 'Время' : 'Дист.')}
            </div>
            
            {statusData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                <span style={{ color: '#999' }}>{d.label}:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '1.05rem' }}>{d.value}</span>
              </div>
            ))}
          </div>

          {/* КАНВАС */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem', color: 'var(--pb-accent)' }} /></div>}
            {error && <div style={{ color: 'var(--tg-destructive)', margin: 'auto' }}>{error}</div>}
            {!loading && !error && payload && (
              <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block', // Убрали object-fit: contain, теперь растягивается
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};