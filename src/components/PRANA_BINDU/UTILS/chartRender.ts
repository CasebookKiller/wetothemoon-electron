// src/components/PRANA_BINDU/UTILS/chartRender.ts
//
// Универсальный canvas-рендер мульти-графиков (ICU-style).
// Используется:
//   - в FullscreenChartsDialog (интерактивный просмотр);
//   - в StoryGeneratorDialog (экспорт в PNG).

import type { ChannelColorSet } from './chartColors';

export type ChartChannel =
  | 'hr'
  | 'pace'
  | 'cadence'
  | 'elevation'
  | 'power';

export interface ChartPanelConfig {
  channel: ChartChannel;
  label: string;
  unit: string;
  enabled: boolean;
  heightRatio: number;
}

export interface ChartRawData {
  secT?: number[];
  sec_t?: number[];
  distM?: number[];
  dist_m?: number[];
  hr?: (number | null)[];
  speedKmh?: (number | null)[];
  speed_kmh?: (number | null)[];
  cadence?: (number | null)[];
  elevationM?: (number | null)[];
  elevation_m?: (number | null)[];
  power?: (number | null)[];
  power_w?: (number | null)[];
}

export interface ChartRenderOptions {
  width: number;
  height: number;
  panels: ChartPanelConfig[];
  colors: ChannelColorSet;
  data: ChartRawData;
  xAxis: 'time' | 'distance';
  lineWidth?: number;
  fillOpacity?: number;
  backgroundColor?: string | null;
  showAxes?: boolean;
  hoverIndex?: number | null;
}

// ==================== Утилиты ====================

function pickArray(
  data: ChartRawData,
  keys: (keyof ChartRawData)[],
): number[] | null {
  for (const k of keys) {
    const v = data[k];
    if (Array.isArray(v) && v.length > 0) return v as number[];
  }
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmtInt(v: number): string {
  return String(Math.round(v));
}

function fmtPaceSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtElapsedShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(1)} км`;
}

// ==================== Подготовка канала ====================

interface PreparedPanel {
  channel: ChartChannel;
  label: string;
  unit: string;
  values: number[];
  color: string;
  heightRatio: number;
  isPace: boolean;
  formatter: 'int' | 'pace';
}

function preparePanel(
  channel: ChartChannel,
  colors: ChannelColorSet,
  data: ChartRawData,
): PreparedPanel | null {
  let values: number[] = [];
  let isPace = false;
  let formatter: 'int' | 'pace' = 'int';
  let label = '';
  let unit = '';

  if (channel === 'hr') {
    const arr = pickArray(data, ['hr']);
    if (!arr) return null;
    values = arr.filter((v): v is number => v != null && Number.isFinite(v));
    label = 'Пульс';
    unit = 'уд/мин';
    formatter = 'int';
  } else if (channel === 'pace') {
    const speed = pickArray(data, ['speedKmh', 'speed_kmh']);
    if (!speed) return null;
    values = speed
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 2)
      .map((v) => 3600 / v);
    label = 'Темп';
    unit = '/км';
    formatter = 'pace';
    isPace = true;
  } else if (channel === 'cadence') {
    const arr = pickArray(data, ['cadence']);
    if (!arr) return null;
    values = arr.filter((v): v is number => v != null && Number.isFinite(v));
    label = 'Каденс';
    unit = 'шаг/мин';
    formatter = 'int';
  } else if (channel === 'elevation') {
    const arr = pickArray(data, ['elevationM', 'elevation_m']);
    if (!arr) return null;
    values = arr.filter((v): v is number => v != null && Number.isFinite(v));
    label = 'Высота';
    unit = 'м';
    formatter = 'int';
  } else if (channel === 'power') {
    const arr = pickArray(data, ['power', 'power_w']);
    if (!arr) return null;
    values = arr.filter((v): v is number => v != null && Number.isFinite(v));
    label = 'Мощность';
    unit = 'Вт';
    formatter = 'int';
  }

  if (values.length < 2) return null;

  const colorKey = channel;
  return {
    channel,
    label,
    unit,
    values,
    color: colors[colorKey],
    heightRatio: 1,
    isPace,
    formatter,
  };
}

// ==================== Основной рендер ====================

export function drawMultiChart(
  ctx: CanvasRenderingContext2D,
  opts: ChartRenderOptions,
): number {
  const W = opts.width;
  const H = opts.height;
  const lineWidth = opts.lineWidth ?? 1.5;
  const fillOpacity = opts.fillOpacity ?? 0.15;
  const showAxes = opts.showAxes !== false;

  ctx.clearRect(0, 0, W, H);
  if (opts.backgroundColor) {
    ctx.save();
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const enabled = opts.panels.filter((p) => p.enabled);
  const prepared: PreparedPanel[] = [];
  for (const cfg of enabled) {
    const p = preparePanel(cfg.channel, opts.colors, opts.data);
    if (!p) continue;
    p.label = cfg.label;
    p.unit = cfg.unit;
    p.heightRatio = Math.max(0.5, Math.min(4, cfg.heightRatio));
    prepared.push(p);
  }

  if (prepared.length === 0) return 0;

  const xs =
    opts.xAxis === 'time'
      ? pickArray(opts.data, ['secT', 'sec_t'])
      : pickArray(opts.data, ['distM', 'dist_m']);
  if (!xs || xs.length < 2) return 0;

  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const xRange = xMax - xMin || 1;

  const PADDING_LEFT = showAxes ? 60 : 8;
  const PADDING_RIGHT = showAxes ? 12 : 8;
  const PADDING_TOP = 6;
  const PADDING_BOTTOM = showAxes ? 28 : 6;
  const PANEL_GAP = 4;

  const totalRatio = prepared.reduce((s, p) => s + p.heightRatio, 0);
  const availableH = H - PADDING_TOP - PADDING_BOTTOM - PANEL_GAP * (prepared.length - 1);
  const plotW = W - PADDING_LEFT - PADDING_RIGHT;

  let cursorY = PADDING_TOP;

  for (const p of prepared) {
    const panelH = (availableH * p.heightRatio) / totalRatio;
    drawPanel(ctx, p, xs, xMin, xRange, PADDING_LEFT, cursorY, plotW, panelH, {
      lineWidth,
      fillOpacity,
      showAxes,
      hoverIndex: opts.hoverIndex,
    });
    cursorY += panelH + PANEL_GAP;
  }

  if (showAxes) {
    drawXAxis(ctx, xs, xMin, xMax, PADDING_LEFT, cursorY, plotW, opts.xAxis);
  }

  return cursorY;
}

// ==================== Панель ====================

function drawPanel(
  ctx: CanvasRenderingContext2D,
  p: PreparedPanel,
  xs: number[],
  xMin: number,
  xRange: number,
  offsetX: number,
  offsetY: number,
  w: number,
  h: number,
  opts: {
    lineWidth: number;
    fillOpacity: number;
    showAxes: boolean;
    hoverIndex?: number | null;
  },
): void {
  const { values, color, formatter, isPace } = p;
  const len = Math.min(xs.length, values.length);

  let vmin = Infinity;
  let vmax = -Infinity;
  let vsum = 0;
  let vcnt = 0;
  for (let i = 0; i < len; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < vmin) vmin = v;
    if (v > vmax) vmax = v;
    vsum += v;
    vcnt++;
  }
  if (vcnt === 0) return;
  const vavg = vsum / vcnt;
  const vrange = vmax - vmin || 1;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < len; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    const x = offsetX + ((xs[i] - xMin) / xRange) * w;
    let ratio: number;
    if (isPace) {
      ratio = (v - vmin) / vrange;
    } else {
      ratio = 1 - (v - vmin) / vrange;
    }
    const y = offsetY + ratio * h;
    points.push({ x, y });
  }
  if (points.length < 2) return;

  // Заливка
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, offsetY + h);
  for (const pt of points) ctx.lineTo(pt.x, pt.y);
  ctx.lineTo(points[points.length - 1].x, offsetY + h);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(color, opts.fillOpacity);
  ctx.fill();
  ctx.restore();

  // Линия
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // Подписи
  if (opts.showAxes) {
    ctx.save();
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const labelMin = isPace ? fmtPaceSec(vmax) : fmtInt(vmin);
    const labelMax = isPace ? fmtPaceSec(vmin) : fmtInt(vmax);
    ctx.fillText(labelMax, offsetX - 6, offsetY);
    ctx.textBaseline = 'bottom';
    ctx.fillText(labelMin, offsetX - 6, offsetY + h);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    const avgStr = formatter === 'pace' ? fmtPaceSec(vavg) : fmtInt(vavg);
    ctx.fillText(`${avgStr} ${p.unit}`, offsetX + 6, offsetY + 2);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(p.label, offsetX + 6, offsetY + h - 14);
    ctx.restore();
  }

  // Отрисовка перекрестия (ИСПРАВЛЕНО)
  if (opts.hoverIndex != null && opts.hoverIndex >= 0 && opts.hoverIndex < len) {
    // 1. Вычисляем точную X-координату курсора по времени
    const targetX = offsetX + ((xs[opts.hoverIndex] - xMin) / xRange) * w;
    
    // 2. Ищем ближайшую точку в массиве, чтобы поставить кружок
    let closestPt: { x: number; y: number } | null = null;
    let minDist = Infinity;
    for (const pt of points) {
      const d = Math.abs(pt.x - targetX);
      if (d < minDist) {
        minDist = d;
        closestPt = pt;
      }
    }

    ctx.save();
    
    // Вертикальная линия строго под курсором
    ctx.beginPath();
    ctx.moveTo(targetX, offsetY);
    ctx.lineTo(targetX, offsetY + h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    
    // Точка на графике
    if (closestPt) {
      ctx.beginPath();
      ctx.arc(closestPt.x, closestPt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ==================== Ось X ====================

function drawXAxis(
  ctx: CanvasRenderingContext2D,
  xs: number[],
  xMin: number,
  xMax: number,
  offsetX: number,
  offsetY: number,
  w: number,
  mode: 'time' | 'distance',
): void {
  const tickCount = 6;
  ctx.save();
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i <= tickCount; i++) {
    const v = xMin + ((xMax - xMin) * i) / tickCount;
    const x = offsetX + ((v - xMin) / (xMax - xMin || 1)) * w;
    const label = mode === 'time' ? fmtElapsedShort(v) : fmtDistance(v);
    ctx.fillText(label, x, offsetY + 6);

    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export const DEFAULT_PANELS: ChartPanelConfig[] = [
  { channel: 'hr',        label: 'Пульс',     unit: 'уд/мин', enabled: true,  heightRatio: 1 },
  { channel: 'pace',      label: 'Темп',      unit: '/км',    enabled: true,  heightRatio: 1 },
  { channel: 'cadence',   label: 'Каденс',    unit: 'шаг/мин', enabled: false, heightRatio: 1 },
  { channel: 'elevation', label: 'Высота',    unit: 'м',      enabled: false, heightRatio: 1 },
  { channel: 'power',     label: 'Мощность',  unit: 'Вт',     enabled: false, heightRatio: 1 },
];