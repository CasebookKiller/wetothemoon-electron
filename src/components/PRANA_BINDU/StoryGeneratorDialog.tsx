// src/components/PRANA_BINDU/StoryGeneratorDialog.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';
import { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import { getOsmStyleObject, getSavedLayers, PALETTES, GradientChannel } from './mapStyles';
import { drawMultiChart, type ChartPanelConfig } from './UTILS/chartRender';
import { getSavedChartColors } from './UTILS/chartColors';
import {
  STORY_PRESETS,
  StoryPlatformId,
  LogoPosition,
  LOGO_POSITION_LABELS,
  getPreset,
} from './UTILS/storyPresets';

// ==================== Типы ====================

interface Props {
  visible: boolean;
  onHide: () => void;
  mapRef?: React.RefObject<MapLibreMap | null>;
  initialSnapshot: string | null;
  fact: any;
  displayName?: string;
  streams: any;
  initialTrackSettings: any;
  gradient?: { channel: GradientChannel; palette: string };
}

interface StoryElements {
  showTitle: boolean;
  titleText: string;
  titleOffsetY: number;
  titleEmbed: boolean; // ← НОВОЕ: встроить в макет
  showMap: boolean;
  showLogo: boolean;
  logoText: string;
  logoPosition: LogoPosition;
  logoSize: number;
  globalDarkening: number;
  charts: {
    hr: boolean;
    pace: boolean;
    cadence: boolean;
    elevation: boolean;
  };
  contentOffsetY: number;
  chartsOffsetY: number;
  chartsFillOpacity: number;
  chartsFullHeight: boolean;
  chartsMarginTop: number;
  chartsMarginBottom: number;
  chartsHeightRatios: {
    hr: number;
    pace: number;
    cadence: number;
    elevation: number;
  };
  metricsShow: boolean;
  metricsOffsetY: number;
  metricsItems: {
    distance: boolean;
    time: boolean;
    pace: boolean;
    hr: boolean;
    elevation: boolean;
  };
}

type LayoutType = 'classic' | 'pills' | 'splits' | 'dotted' | 'receipt' | 'minimal' | 'charts' | 'poster' | 'grid' | 'load' | 'zones';

interface CustomStoryPreset {
  id: string;
  name: string;
  layout: LayoutType;
  platformId: StoryPlatformId;
  elements: StoryElements;
  savedAt: string;
}

const DEFAULT_ELEMENTS: StoryElements = {
  showTitle: false,
  titleText: '',
  titleOffsetY: 0,
  titleEmbed: false,
  showMap: true,
  showLogo: true,
  logoText: 'smth.run',
  logoPosition: 'br',
  logoSize: 44,
  globalDarkening: 0,
  charts: { hr: false, pace: false, cadence: false, elevation: false },
  contentOffsetY: 0,
  chartsOffsetY: 0,
  chartsFillOpacity: 0.15,
  chartsFullHeight: false,
  chartsHeightRatios: { hr: 1, pace: 1, cadence: 1, elevation: 1 },
  chartsMarginTop: 0,
  chartsMarginBottom: 0,
  metricsShow: false,
  metricsOffsetY: 0,
  metricsItems: { distance: true, time: true, pace: true, hr: false, elevation: false },
};

const CUSTOM_PRESETS_KEY = 'pb.story.customPresets';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const PAN_LIMIT = 500;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;

// ==================== Утилиты для градиента ====================

function computeStats(values: (number | null)[] | undefined): { min: number; max: number } | null {
  if (!values || values.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
      count++;
    }
  }
  return count > 0 ? { min, max } : null;
}

function buildColorExpression(
  channel: GradientChannel,
  paletteKey: string,
  dataStats: { min: number; max: number } | null,
  fallbackColor: string,
): any {
  if (channel === 'none' || !dataStats) return fallbackColor;
  const palette = PALETTES[paletteKey];
  if (!palette) return fallbackColor;

  const stops = palette.stops.map((s) => {
    const actualV = palette.absolute
      ? s.v
      : dataStats.min + (dataStats.max - dataStats.min) * s.v;
    return [actualV, s.c];
  });

  return [
    'coalesce',
    ['interpolate', ['linear'], ['get', channel], ...stops.flat()],
    fallbackColor,
  ];
}

function buildTrackSource(
  latlng: [number, number][],
  gradient: { channel: GradientChannel; palette: string } | undefined,
  streams: any,
  fallbackColor: string,
): { sourceData: any; colorExpr: any } | null {
  const coords: [number, number][] = latlng
    .filter((p: any) => p != null)
    .map((p: [number, number]) => [p[1], p[0]]);

  if (coords.length < 2) return null;

  if (!gradient || gradient.channel === 'none') {
    return {
      sourceData: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
      colorExpr: fallbackColor,
    };
  }

  const channelValues = streams?.[gradient.channel] as (number | null)[] | undefined;
  const stats = computeStats(channelValues);
  const colorExpr = buildColorExpression(
    gradient.channel,
    gradient.palette,
    stats,
    fallbackColor,
  );

  const step = Math.max(5, Math.floor(coords.length / 1000));
  const features: any[] = [];

  for (let i = 0; i < coords.length - 1; i += step) {
    const endIdx = Math.min(i + step, coords.length - 1);
    const slice = coords.slice(i, endIdx + 1);
    if (slice.length < 2) continue;

    let avg: number | null = null;
    if (channelValues) {
      const segVals = channelValues.slice(i, endIdx + 1);
      const valid = segVals.filter(
        (v): v is number => v != null && Number.isFinite(v),
      );
      if (valid.length > 0) {
        avg = valid.reduce((a, b) => a + b, 0) / valid.length;
      }
    }

    features.push({
      type: 'Feature',
      properties: avg != null ? { [gradient.channel]: avg } : {},
      geometry: { type: 'LineString', coordinates: slice },
    });
  }

  return {
    sourceData: { type: 'FeatureCollection', features },
    colorExpr,
  };
}

// ==================== Настройки по умолчанию ====================

const DEFAULT_STORY_MAP = {
  mapPadding: 40,
  mapZoom: 0.9,
  mapPan: { x: 0, y: 0 },
  lineWidth: 4,
};

type StoryMapSettings = typeof DEFAULT_STORY_MAP;
const SETTINGS_PREFIX = 'pb.story.mapSettings.v2';

function clamp(val: any, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function getRobustBounds(coords: [number, number][]): LngLatBounds | null {
  if (coords.length < 2) return null;
  const fullBounds = coords.reduce(
    (b, c) => b.extend(c),
    new LngLatBounds(coords[0], coords[0]),
  );
  if (coords.length < 4) return fullBounds;
  const lngs = coords.map((c) => c[0]).sort((a, b) => a - b);
  const lats = coords.map((c) => c[1]).sort((a, b) => a - b);
  const q = 0.02;
  const iLo = Math.floor(lngs.length * q);
  const iHi = Math.floor(lngs.length * (1 - q));
  const minLng = lngs[iLo];
  const maxLng = lngs[iHi];
  const minLat = lats[iLo];
  const maxLat = lats[iHi];
  if (!(minLng < maxLng && minLat < maxLat)) return fullBounds;
  return new LngLatBounds([minLng, minLat], [maxLng, maxLat]);
}

function getLocationKey(latlng: [number, number][] | undefined): string | null {
  if (!latlng || latlng.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of latlng) {
    if (!p) continue;
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  }
  const cLat = ((minLat + maxLat) / 2).toFixed(2);
  const cLng = ((minLng + maxLng) / 2).toFixed(2);
  return `${cLat},${cLng}`;
}

function loadStoryMapSettings(key: string | null): StoryMapSettings | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(`${SETTINGS_PREFIX}.${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      mapPadding: clamp(parsed?.mapPadding, 0, 500, DEFAULT_STORY_MAP.mapPadding),
      mapZoom: clamp(parsed?.mapZoom, ZOOM_MIN, ZOOM_MAX, DEFAULT_STORY_MAP.mapZoom),
      mapPan: {
        x: clamp(parsed?.mapPan?.x, -PAN_LIMIT, PAN_LIMIT, 0),
        y: clamp(parsed?.mapPan?.y, -PAN_LIMIT, PAN_LIMIT, 0),
      },
      lineWidth: clamp(parsed?.lineWidth, 1, 15, DEFAULT_STORY_MAP.lineWidth),
    };
  } catch {
    return null;
  }
}

function saveStoryMapSettings(key: string | null, s: StoryMapSettings): void {
  if (!key) return;
  try {
    localStorage.setItem(`${SETTINGS_PREFIX}.${key}`, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ==================== Хелперы форматирования ====================

function fmtKm(v: number | null): string {
  return v == null ? '—' : v.toFixed(2).replace('.', ',');
}
function fmtDuration(sec: number | null): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h} ч ${m} м` : `${m} мин. ${String(s).padStart(2, '0')} с.`;
}

function fmtDurationShort(sec: number | null): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtPace(pace: string | null): string {
  return pace ? `${pace}` : '—';
}
function secToPaceStr(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function resolveFactTitle(fact: any, displayName?: string): string {
  const userPart = typeof fact?.user_name === 'string' ? fact.user_name.trim() : '';
  const groupPart = typeof displayName === 'string' ? displayName.trim() : '';
  const providerPart = typeof fact?.name === 'string' ? fact.name.trim() : '';
  const datePart = fact?.date ? ' ' + fact.date : '';
  return userPart || groupPart || providerPart || `Пробежка${datePart}`;
}

function normalizeElements(raw: any): StoryElements {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DEFAULT_ELEMENTS,
    ...safe,
    charts: { ...DEFAULT_ELEMENTS.charts, ...safe?.charts },
    titleOffsetY: clamp(safe?.titleOffsetY, -500, 1000, 0),
    titleEmbed: !!safe?.titleEmbed,
    contentOffsetY: clamp(safe?.contentOffsetY, -1000, 1200, 0),
    chartsOffsetY: clamp(safe?.chartsOffsetY, -1000, 1200, 0),
    chartsFillOpacity: clamp(safe?.chartsFillOpacity, 0.05, 0.4, 0.15),
    chartsFullHeight: !!safe?.chartsFullHeight,
    chartsHeightRatios: { ...DEFAULT_ELEMENTS.chartsHeightRatios, ...(safe?.chartsHeightRatios ?? {}) },
    chartsMarginTop: clamp(safe?.chartsMarginTop, 0, 1000, 0),
    chartsMarginBottom: clamp(safe?.chartsMarginBottom, 0, 1000, 0),
    metricsShow: !!safe?.metricsShow,
    metricsOffsetY: clamp(safe?.metricsOffsetY, -1000, 1000, 0),
    metricsItems: { ...DEFAULT_ELEMENTS.metricsItems, ...(safe?.metricsItems ?? {}) },
    logoSize: clamp(safe?.logoSize, 20, 120, 44),
    globalDarkening: clamp(safe?.globalDarkening, 0, 0.8, 0),
  };
}

// ==================== Компонент ====================

export const StoryGeneratorDialog: React.FC<Props> = ({
  visible,
  onHide,
  fact,
  displayName,
  streams,
  initialTrackSettings,
  gradient,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const [resetCounter, setResetCounter] = useState(0);
  const [layout, setLayout] = useState<LayoutType>('classic');
  const chartColors = useMemo(() => getSavedChartColors(), []);

  const [bgSource, setBgSource] = useState<'map' | 'photo'>('map');
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });

  const [isRendering, setIsRendering] = useState(false);

  const locKey = useMemo(() => getLocationKey(streams?.latlng), [streams]);
  const trackKey = fact?.id ? `track-${fact.id}` : null;

  const [mapPadding, setMapPadding] = useState(DEFAULT_STORY_MAP.mapPadding);
  const [mapZoom, setMapZoom] = useState(DEFAULT_STORY_MAP.mapZoom);
  const [mapPan, setMapPan] = useState(DEFAULT_STORY_MAP.mapPan);
  const [lineWidth, setLineWidth] = useState(
    initialTrackSettings?.width ?? DEFAULT_STORY_MAP.lineWidth,
  );

  // ==================== Платформа и safe zones ====================
  const [platformId, setPlatformId] = useState<StoryPlatformId>(() => {
    try {
      const v = localStorage.getItem('pb.story.platform') as StoryPlatformId | null;
      if (v && STORY_PRESETS.some((p) => p.id === v)) return v;
    } catch { /* ignore */ }
    return 'reels';
  });
  const [showSafeZones, setShowSafeZones] = useState(false);
  const preset = useMemo(() => getPreset(platformId), [platformId]);

  useEffect(() => {
    try { localStorage.setItem('pb.story.platform', platformId); } catch { /* ignore */ }
  }, [platformId]);

  // ==================== Элементы на сторис ====================
  const [elements, setElements] = useState<StoryElements>(() => {
    try {
      const raw = localStorage.getItem('pb.story.elements');
      if (raw) return normalizeElements(JSON.parse(raw));
    } catch { /* ignore */ }
    return normalizeElements({
      titleText: resolveFactTitle(fact, displayName),
    });
  });

  useEffect(() => {
    try { localStorage.setItem('pb.story.elements', JSON.stringify(elements)); } catch { /* ignore */ }
  }, [elements]);

  // ==================== Синхронизация названия ====================
  useEffect(() => {
    if (!fact?.id) return;
    const factTitle = resolveFactTitle(fact, displayName);
    let nextTitle = factTitle;
    try {
      const saved = localStorage.getItem(`pb.story.title.${fact.id}`);
      if (saved !== null) nextTitle = saved;
    } catch { /* ignore */ }
    setElements((prev) => prev.titleText === nextTitle ? prev : { ...prev, titleText: nextTitle });
  }, [fact?.id, fact?.user_name, fact?.name, fact?.date, displayName]);

  useEffect(() => {
    if (!fact?.id) return;
    const factTitle = resolveFactTitle(fact, displayName);
    try {
      if (elements.titleText && elements.titleText !== factTitle) {
        localStorage.setItem(`pb.story.title.${fact.id}`, elements.titleText);
      } else {
        localStorage.removeItem(`pb.story.title.${fact.id}`);
      }
    } catch { /* ignore */ }
  }, [fact?.id, fact?.user_name, fact?.name, fact?.date, displayName, elements.titleText]);

  // ==================== Пользовательские пресеты ====================
  const [customPresets, setCustomPresets] = useState<CustomStoryPreset[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
      if (raw) return JSON.parse(raw) as CustomStoryPreset[];
    } catch { /* ignore */ }
    return [];
  });
  const [presetNameInput, setPresetNameInput] = useState('');

  useEffect(() => {
    try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets)); } catch { /* ignore */ }
  }, [customPresets]);

  // Загрузка/сохранение карты
  useEffect(() => {
    const saved = loadStoryMapSettings(trackKey) ?? loadStoryMapSettings(locKey) ?? DEFAULT_STORY_MAP;
    setMapPadding(saved.mapPadding);
    setMapZoom(saved.mapZoom);
    setMapPan(saved.mapPan);
    setLineWidth(saved.lineWidth);
  }, [trackKey, locKey]);

  useEffect(() => {
    if (!visible) return;
    const s = { mapPadding, mapZoom, mapPan, lineWidth };
    if (trackKey) saveStoryMapSettings(trackKey, s);
    if (locKey) saveStoryMapSettings(locKey, s);
  }, [visible, trackKey, locKey, mapPadding, mapZoom, mapPan, lineWidth]);

  // ==================== Вычисляемые ====================

  const elevationGain = useMemo(() => {
    if (fact?.raw_json) {
      try {
        const raw = typeof fact.raw_json === 'string' ? JSON.parse(fact.raw_json) : fact.raw_json;
        const gain = raw?.summary?.elevationGain ?? raw?.total_elevation_gain ?? raw?.raw?.total_elevation_gain;
        if (typeof gain === 'number' && gain > 0) return Math.round(gain);
      } catch (e) { console.warn('[Story] error parse elevation', e); }
    }
    if (!streams?.elevationM) return 0;
    const rawElev = streams.elevationM;
    const windowSize = 5;
    const smooth: (number | null)[] = [];
    for (let i = 0; i < rawElev.length; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(rawElev.length - 1, i + windowSize); j++) {
        if (rawElev[j] != null) { sum += rawElev[j]!; count++; }
      }
      smooth.push(count > 0 ? sum / count : null);
    }
    let gain = 0;
    const threshold = 3.0;
    let last = smooth[0] ?? 0;
    for (let i = 1; i < smooth.length; i++) {
      const curr = smooth[i];
      if (curr == null) continue;
      const diff = curr - last;
      if (diff > threshold) { gain += diff; last = curr; }
      else if (diff < -threshold) { last = curr; }
    }
    return Math.round(gain);
  }, [streams, fact]);

  const splits = useMemo(() => {
    if (!streams?.distM || !streams?.secT) return [];
    const result: { km: number; paceSec: number }[] = [];
    let lastDist = 0, lastTime = 0, currentKm = 1;
    for (let i = 0; i < streams.distM.length; i++) {
      if (streams.distM[i] >= currentKm * 1000) {
        const dist = streams.distM[i] - lastDist;
        const time = streams.secT[i] - lastTime;
        result.push({ km: currentKm, paceSec: time / (dist / 1000) });
        lastDist = streams.distM[i];
        lastTime = streams.secT[i];
        currentKm++;
      }
    }
    if (streams.distM.length > 0 && lastDist < streams.distM[streams.distM.length - 1]) {
      const totalDist = streams.distM[streams.distM.length - 1];
      const totalTime = streams.secT[streams.secT.length - 1];
      if (totalDist - lastDist > 50) {
        result.push({ km: parseFloat((totalDist / 1000).toFixed(1)), paceSec: (totalTime - lastTime) / ((totalDist - lastDist) / 1000) });
      }
    }
    return result;
  }, [streams]);

  // ==================== Инициализация карты ====================
  useEffect(() => {
    if (!visible || mapRef.current || !streams?.latlng) return;
    let attempts = 0;
    let timer: number | null = null;

    const tryInit = () => {
      attempts++;
      const el = mapContainerRef.current;
      if (!el || el.clientWidth < 10 || el.clientHeight < 10) {
        if (attempts < 50) timer = window.setTimeout(tryInit, 100);
        return;
      }
      try {
        const map = new MapLibreMap({
          container: el,
          style: getOsmStyleObject(getSavedLayers()),
          center: [37.618423, 55.751244],
          zoom: 12,
          attributionControl: false,
          canvasContextAttributes: { preserveDrawingBuffer: true },
        } as any);
        map.setPixelRatio(2);
        map.on('error', (e) => console.error('[Story] map error:', e));
        map.on('load', () => {
          const built = buildTrackSource(streams.latlng, gradient, streams, initialTrackSettings?.color || '#ff5a00');
          if (!built) return;
          map.addSource('active-track', { type: 'geojson', data: built.sourceData });
          map.addLayer({
            id: 'active-track', type: 'line', source: 'active-track',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': built.colorExpr, 'line-width': lineWidth, 'line-opacity': initialTrackSettings?.opacity ?? 1 },
          });
          setMapReady(true);
        });
        mapRef.current = map;
      } catch (err) { console.error('[Story] Failed to init map:', err); }
    };
    tryInit();
    return () => {
      if (timer) clearTimeout(timer);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      setMapReady(false);
    };
  }, [visible, streams]);

  // Отслеживание размера
  useEffect(() => {
    if (!visible) return;
    let attempts = 0;
    let timer: number | null = null;
    let observer: ResizeObserver | null = null;
    const tryAttach = () => {
      attempts++;
      const el = mapContainerRef.current;
      if (!el) { if (attempts < 50) timer = window.setTimeout(tryAttach, 100); return; }
      const { width, height } = el.getBoundingClientRect();
      if (width > 10 && height > 10) setMapSize({ width, height });
      observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          const { width, height } = entries[0].contentRect;
          if (width > 10 && height > 10) {
            setMapSize({ width, height });
            if (mapRef.current) mapRef.current.resize();
          }
        }
      });
      observer.observe(el);
    };
    tryAttach();
    return () => { if (timer) clearTimeout(timer); if (observer) observer.disconnect(); };
  }, [visible]);

  // Камера
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mapSize.width < 10 || mapSize.height < 10 || !streams?.latlng) return;
    const updateCamera = () => {
      if (!mapRef.current) return;
      const coords = streams.latlng.filter((p: any) => p != null).map((p: [number, number]) => [p[1], p[0]]);
      const bounds = getRobustBounds(coords);
      if (!bounds) return;
      let camera;
      try {
        camera = map.cameraForBounds(bounds, { padding: { top: 0, bottom: 0, left: mapPadding, right: mapPadding } });
      } catch (e) { console.warn('[Story] cameraForBounds error', e); }
      if (camera && camera.center) {
        let targetZoom = camera.zoom ?? 14;
        if (mapZoom !== 1) targetZoom += Math.log2(mapZoom);
        map.jumpTo({ center: camera.center, zoom: targetZoom, bearing: 0, pitch: 0 });
      } else {
        map.jumpTo({ center: bounds.getCenter(), zoom: 15 + (mapZoom !== 1 ? Math.log2(mapZoom) : 0), bearing: 0, pitch: 0 });
      }
      if (mapPan.x !== 0 || mapPan.y !== 0) map.panBy([-mapPan.x / 2, -mapPan.y / 2], { duration: 0 });
    };
    updateCamera();
    const t = setTimeout(updateCamera, 100);
    return () => clearTimeout(t);
  }, [mapReady, mapSize, mapPadding, mapZoom, mapPan.x, mapPan.y, streams, resetCounter]);

  // Толщина трека
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer('active-track')) return;
    map.setPaintProperty('active-track', 'line-width', lineWidth);
  }, [mapReady, lineWidth]);

  const handlePickImage = async () => {
    try {
      const api = (window as any).electronAPI;
      const lastDir = localStorage.getItem('pb.lastImageDir') || undefined;
      const res = await api.pb.pickImage(lastDir);
      if (res.success && res.path) {
        const dir = res.path.substring(0, Math.max(res.path.lastIndexOf('/'), res.path.lastIndexOf('\\')));
        localStorage.setItem('pb.lastImageDir', dir);
        const dataUrl = await api.pb.readFileBase64(res.path);
        const img = new Image();
        img.onload = () => { setPhotoImage(img); setBgSource('photo'); setPhotoOffset({ x: 0, y: 0 }); setPhotoScale(1); };
        img.src = dataUrl;
      }
    } catch (e) { console.error(e); }
  };

  // ==================== Отрисовка canvas ====================
  useEffect(() => {
    if (!visible || !canvasReady || !textCanvasRef.current) return;
    setIsRendering(true);
    
    const canvas = textCanvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const km = fmtKm(fact.actual_km);
    const time = fmtDuration(fact.duration_sec);
    const pace = fmtPace(fact.actual_pace);
    const hr = fact.avg_hr ?? '—';
    const maxHr = fact.max_hr ?? '—';

    if (bgSource === 'photo' && photoImage) {
      let scale = Math.max(CANVAS_WIDTH / photoImage.width, CANVAS_HEIGHT / photoImage.height);
      scale *= photoScale;
      const w = photoImage.width * scale;
      const h = photoImage.height * scale;
      const x = (CANVAS_WIDTH - w) / 2 + photoOffset.x;
      const y = (CANVAS_HEIGHT - h) / 2 + photoOffset.y;
      ctx.drawImage(photoImage, x, y, w, h);
    }

    if (elements.globalDarkening > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${elements.globalDarkening})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    const gradientFade = ctx.createLinearGradient(0, CANVAS_HEIGHT * 0.4, 0, CANVAS_HEIGHT);
    gradientFade.addColorStop(0, 'rgba(0,0,0,0)');
    gradientFade.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = gradientFade;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (layout === 'splits') {
      ctx.fillStyle = 'rgba(17, 17, 17, 0.45)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else if (layout === 'receipt') {
      ctx.fillStyle = 'rgba(17, 17, 17, 0.75)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else if (layout === 'minimal') {
      ctx.fillStyle = 'rgba(17, 17, 17, 0.65)'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';

    ctx.save();
    if (elements.contentOffsetY !== 0) ctx.translate(0, elements.contentOffsetY);
    
    if (layout !== 'charts') {
      if (layout === 'classic') {
        // Встраиваем название над дистанцией, чтобы оно было частью блока
        if (elements.titleEmbed && elements.showTitle && elements.titleText) {
          ctx.textAlign = 'left';
          ctx.font = 'bold 48px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 10;
          // y=1460 — прямо над цифрой 5,60 (которая на 1550)
          ctx.fillText(elements.titleText, 80, 1460 + elements.titleOffsetY);
          ctx.shadowBlur = 0; // Сбрасываем тень
        }
        
        ctx.font = 'bold 140px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        const kmWidth = ctx.measureText(km).width;
        ctx.fillText(km, 80, 1550);
        ctx.font = 'bold 50px Inter, sans-serif';
        ctx.fillText('км', 80 + kmWidth + 15, 1550);
        ctx.font = 'bold 60px Inter, sans-serif';
        ctx.fillText(`${time}`, 80, 1650);
        ctx.fillText(`${pace} / км`, 80, 1730);
        ctx.font = '40px Inter, sans-serif';
        ctx.fillStyle = '#d4a373';
        ctx.fillText(`Ср. пульс: ${hr} уд / мин`, 80, 1810);
      } else if (layout === 'pills') {
        if (elements.titleEmbed && elements.showTitle && elements.titleText) {
          ctx.textAlign = 'center';
          ctx.font = 'bold 55px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(elements.titleText, CANVAS_WIDTH / 2, 380 + elements.titleOffsetY);
        }
        ctx.textAlign = 'left';
        ctx.font = '50px Inter, sans-serif'; ctx.fillStyle = '#aaaaaa'; ctx.fillText(fact.date, 80, 480); ctx.fillStyle = '#ffffff';
        
        const pillTexts: string[] = [];
        if (elements.metricsItems.distance) pillTexts.push(`РАССТОЯНИЕ ${km} КМ`);
        if (elements.metricsItems.time) pillTexts.push(`ВРЕМЯ ${time}`);
        if (elements.metricsItems.pace) pillTexts.push(`ТЕМП ${pace} / КМ`);
        if (elements.metricsItems.hr && fact.avg_hr) pillTexts.push(`СР. ПУЛЬС ${hr} УД / МИН`);
        if (elements.metricsItems.elevation && elevationGain > 0) pillTexts.push(`НАБОР ${elevationGain} М`);
        
        const drawPill = (text: string, x: number, y: number) => {
          ctx.font = 'bold 45px Inter, sans-serif';
          const w = ctx.measureText(text).width + 80;
          ctx.beginPath(); 
          ctx.roundRect(x, y, w, 80, 40);
          ctx.fillStyle = 'rgba(23, 33, 43, 0.6)'; 
          ctx.fill();
          ctx.strokeStyle = '#d4a373'; ctx.lineWidth = 4; ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, x + 40, y + 55);
        };
        
        let pillY = 580;
        for (const text of pillTexts) {
          drawPill(text, 80, pillY);
          pillY += 100;
        }
      } else if (layout === 'splits') {
        const headerY = 170 + elements.titleOffsetY;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.beginPath(); ctx.roundRect(60, headerY, 960, 100, 20); ctx.fill();
        ctx.font = 'bold 55px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
        const headerText = (elements.titleEmbed && elements.showTitle && elements.titleText) 
          ? elements.titleText 
          : 'Промежуточное время по км';
        ctx.fillText(headerText, CANVAS_WIDTH / 2, headerY + 65);
        ctx.font = 'bold 50px Inter, sans-serif';
        
        const topY = 350;
        const bottomY = CANVAS_HEIGHT - preset.safeBottom - 100;
        const availableHeight = bottomY - topY;
        const rowHeight = Math.min(95, availableHeight / splits.length);
        const barHeight = rowHeight * 0.6;
        const barYOffset = rowHeight * 0.2;
        
        let y = topY;
        const maxBarWidth = 350;
        const maxPace = splits.length > 0 ? Math.max(...splits.map((s) => s.paceSec)) : 0;
        const minPace = splits.length > 0 ? Math.min(...splits.map((s) => s.paceSec)) : 0;
        
        splits.forEach((s) => {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; 
          ctx.beginPath(); 
          ctx.roundRect(60, y - 10, 960, rowHeight, 40); 
          ctx.fill();
          
          ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; 
          ctx.fillText(String(s.km), 100, y + rowHeight * 0.6);
          
          const ratio = maxPace === minPace ? 1 : (maxPace - s.paceSec) / (maxPace - minPace);
          const barWidth = 100 + ratio * maxBarWidth;
          
          ctx.shadowColor = 'rgba(212, 163, 115, 0.5)';
          ctx.shadowBlur = 10;
          
          ctx.fillStyle = 'rgba(212, 163, 115, 0.25)'; 
          ctx.strokeStyle = '#d4a373'; 
          ctx.lineWidth = 3;
          ctx.beginPath(); 
          ctx.roundRect(160, y + barYOffset, barWidth, barHeight, barHeight / 2); 
          ctx.fill(); 
          ctx.stroke();
          
          ctx.shadowBlur = 0;
          
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'right'; 
          ctx.fillText(secToPaceStr(s.paceSec), CANVAS_WIDTH - 100, y + rowHeight * 0.6);
          
          y += rowHeight;
        });
      } else if (layout === 'dotted') {
        if (elements.titleEmbed && elements.showTitle && elements.titleText) {
          ctx.textAlign = 'center';
          ctx.font = 'bold 60px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(elements.titleText, CANVAS_WIDTH / 2, 450 + elements.titleOffsetY);
          ctx.textAlign = 'left';
        }
        const drawDotted = (label: string, value: string, y: number) => {
          ctx.font = '50px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
          ctx.fillText(label, 80, y);
          const valWidth = ctx.measureText(value).width;
          ctx.fillText(value, CANVAS_WIDTH - 80 - valWidth, y);
          const labelWidth = ctx.measureText(label).width;
          const startX = 80 + labelWidth + 20; const endX = CANVAS_WIDTH - 80 - valWidth - 20;
          ctx.beginPath(); ctx.setLineDash([5, 15]); ctx.moveTo(startX, y - 15); ctx.lineTo(endX, y - 15);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]);
        };
        drawDotted('Расстояние', `${km} км`, 700);
        drawDotted('Темп', `${pace} / км`, 800);
        drawDotted('Время', `${time}`, 900);
        drawDotted('Набор высоты', `${elevationGain} м`, 1000);
        drawDotted('Ср. пульс', `${hr} уд / мин`, 1100);
        drawDotted('Макс. пульс', `${maxHr} уд / мин`, 1200);
      } else if (layout === 'receipt') {
        const w = 800; const h = 1200;
        const x = (CANVAS_WIDTH - w) / 2; const y = (CANVAS_HEIGHT - h) / 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - 40);
        for (let i = w; i > 0; i -= 40) { ctx.lineTo(x + i - 20, y + h); ctx.lineTo(x + i - 40, y + h - 40); }
        ctx.lineTo(x, y + h - 40); ctx.closePath(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke();
        ctx.textAlign = 'center'; ctx.font = '100px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('👟', CANVAS_WIDTH / 2, y + 350);
        ctx.font = 'bold 70px Inter, sans-serif'; 
        const receiptTitle = (elements.titleEmbed && elements.showTitle && elements.titleText) ? elements.titleText : 'ВТОРНИК';
        ctx.fillText(receiptTitle, CANVAS_WIDTH / 2, y + 550 + elements.titleOffsetY);
        ctx.font = '50px Inter, sans-serif'; ctx.fillText(fact.date, CANVAS_WIDTH / 2, y + 630);
        ctx.font = 'bold 100px Inter, sans-serif'; ctx.fillText(km, CANVAS_WIDTH / 2, y + 850);
        ctx.font = '50px Inter, sans-serif'; ctx.fillText('км', CANVAS_WIDTH / 2, y + 910);
      } else if (layout === 'minimal') {
        if (elements.titleEmbed && elements.showTitle && elements.titleText) {
          ctx.textAlign = 'center';
          ctx.font = 'bold 50px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(elements.titleText, CANVAS_WIDTH / 2, 250 + elements.titleOffsetY);
        }
        ctx.textAlign = 'center';
        const drawCentered = (label: string, value: string, y: number, valueSize: number) => {
          ctx.font = '50px Inter, sans-serif'; ctx.fillStyle = '#aaaaaa'; ctx.fillText(label, CANVAS_WIDTH / 2, y);
          ctx.font = `bold ${valueSize}px Inter, sans-serif`; ctx.fillStyle = '#ffffff'; ctx.fillText(value, CANVAS_WIDTH / 2, y + valueSize + 20);
        };
        drawCentered('Расстояние', `${km} км`, 400, 120);
        drawCentered('Темп', `${pace} /км`, 800, 90);
        drawCentered('Время', time, 1150, 90);
      } else if (layout === 'poster') {
        // ---- ПОСТЕР (КАРТОЧКА) ----
        const cardW = 840;
        const cardH = 1000;
        const cardX = (CANVAS_WIDTH - cardW) / 2;
        const cardY = (CANVAS_HEIGHT - cardH) / 2;

        ctx.fillStyle = 'rgba(23, 33, 43, 0.85)';
        ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 40); ctx.fill();
        ctx.strokeStyle = 'rgba(212, 163, 115, 0.3)'; ctx.lineWidth = 4; ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#d4a373';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.fillText((elements.titleText || fact.date).toUpperCase(), CANVAS_WIDTH / 2, cardY + 100);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 220px Inter, sans-serif';
        ctx.fillText(km, CANVAS_WIDTH / 2, cardY + 360);
        ctx.font = 'bold 60px Inter, sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('КМ', CANVAS_WIDTH / 2, cardY + 430);

        ctx.beginPath();
        ctx.moveTo(cardX + 100, cardY + 500); ctx.lineTo(cardX + cardW - 100, cardY + 500);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.stroke();

        ctx.textAlign = 'left';
        ctx.font = 'bold 60px Inter, sans-serif'; // Уменьшили шрифт
        ctx.fillStyle = '#ffffff';
        ctx.fillText(time, cardX + 80, cardY + 620);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = '#d4a373';
        ctx.fillText(`${pace} /км`, cardX + cardW - 80, cardY + 620);

        ctx.textAlign = 'center';
        ctx.font = 'bold 40px Inter, sans-serif';
        ctx.fillStyle = '#aaaaaa';
        let extraStr = `❤️ ${hr} уд/мин`;
        if (elevationGain > 0) extraStr += `   ⛰ ${elevationGain} м`;
        ctx.fillText(extraStr, CANVAS_WIDTH / 2, cardY + 800);
      } else if (layout === 'grid') {
        // ---- СЕТКА (ДАШБОРД) ----
        const gridX = 80; const gridY = 600;
        const cellW = (CANVAS_WIDTH - gridX * 2 - 40) / 2;
        const cellH = 280;
        const gap = 40;

        // Парсим калории и метаданные
        let cals = null;
        try {
          const raw = typeof fact.raw_json === 'string' ? JSON.parse(fact.raw_json) : fact.raw_json;
          cals = (raw?.raw || raw)?.calories || raw?.calories;
        } catch (e) { /* ignore */ }

        const drawCell = (col: number, row: number, label: string, value: string, color: string) => {
          const x = gridX + col * (cellW + gap); const y = gridY + row * (cellH + gap);
          ctx.fillStyle = 'rgba(23, 33, 43, 0.7)'; ctx.beginPath(); ctx.roundRect(x, y, cellW, cellH, 24); ctx.fill();
          ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y + 40, 8, cellH - 80, 4); ctx.fill();
          ctx.textAlign = 'left'; ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 28px Inter, sans-serif'; ctx.fillText(label, x + 40, y + 80);
          
          // Умный подбор шрифта в зависимости от длины строки
          let fontSize = 70;
          if (value.length > 8) fontSize = 50;
          if (value.length > 12) fontSize = 40;
          
          ctx.fillStyle = '#ffffff'; ctx.font = `bold ${fontSize}px Inter, sans-serif`; ctx.fillText(value, x + 40, y + 200);
        };

        ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 60px Inter, sans-serif';
        ctx.fillText(elements.titleText || 'Тренировка', CANVAS_WIDTH / 2, 400);
        ctx.font = '40px Inter, sans-serif'; ctx.fillStyle = '#d4a373'; ctx.fillText(fact.date, CANVAS_WIDTH / 2, 470);

        drawCell(0, 0, 'ДИСТАНЦИЯ', `${km} км`, '#e53935');
        drawCell(1, 0, 'ВРЕМЯ', fmtDurationShort(fact.duration_sec), '#4fc3f7');
        drawCell(0, 1, 'ТЕМП', `${pace} /км`, '#d4a373');
        drawCell(1, 1, 'СР. ПУЛЬС', `${hr}`, '#ff40ff');
        drawCell(0, 2, 'КАЛОРИИ', cals ? `${cals} ккал` : '—', '#ffb800');
        drawCell(1, 2, 'НАБОР', elevationGain > 0 ? `${elevationGain} м` : '—', '#6fbf73');
      } else if (layout === 'load') {
        // ---- НАГРУЗКА (TSS, CTL, ATL) ----
        let tss = 0, ctl = 0, atl = 0;
        try {
          const raw = typeof fact.raw_json === 'string' ? JSON.parse(fact.raw_json) : fact.raw_json;
          const meta = raw?.raw || raw;
          // Ищем во всех возможных местах
          tss = meta?.training_load ?? meta?.icu_training_load ?? 0;
          ctl = meta?.ctl ?? meta?.icu_ctl ?? 0;
          atl = meta?.atl ?? meta?.icu_atl ?? 0;
        } catch (e) { /* ignore */ }

        ctx.textAlign = 'center';
        
        // Заголовок
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 50px Inter, sans-serif';
        ctx.fillText('НАГРУЗКА (TSS)', CANVAS_WIDTH / 2, 400);

        // Огромная цифра
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 300px Inter, sans-serif';
        ctx.fillText(String(Math.round(tss)), CANVAS_WIDTH / 2, 700);

        // CTL и ATL
        const barY = 1000;
        const barW = 600;
        const barX = (CANVAS_WIDTH - barW) / 2;

        // CTL (Фитнес)
        ctx.textAlign = 'left'; ctx.fillStyle = '#6fbf73'; ctx.font = 'bold 40px Inter, sans-serif';
        ctx.fillText(`Фитнес (CTL): ${ctl.toFixed(1)}`, barX, barY);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(barX, barY + 20, barW, 30, 15); ctx.fill();
        ctx.fillStyle = '#6fbf73'; ctx.beginPath(); ctx.roundRect(barX, barY + 20, Math.min(barW, (ctl / 100) * barW), 30, 15); ctx.fill();

        // ATL (Усталость)
        ctx.textAlign = 'left'; ctx.fillStyle = '#ec3942'; ctx.font = 'bold 40px Inter, sans-serif';
        ctx.fillText(`Усталость (ATL): ${atl.toFixed(1)}`, barX, barY + 150);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(barX, barY + 170, barW, 30, 15); ctx.fill();
        ctx.fillStyle = '#ec3942'; ctx.beginPath(); ctx.roundRect(barX, barY + 170, Math.min(barW, (atl / 100) * barW), 30, 15); ctx.fill();
      } else if (layout === 'zones') {
        // ---- ПУЛЬСОВЫЕ ЗОНЫ ----
        let hrZones: number[] = []; // Границы зон (bpm)
        let zoneTimes: number[] = []; // Время в зонах (сек)

        try {
          const raw = typeof fact.raw_json === 'string' ? JSON.parse(fact.raw_json) : fact.raw_json;
          const meta = raw?.raw || raw;
          
          // 1. Пробуем взять готовые данные
          hrZones = meta?.hr_zones ?? meta?.icu_hr_zones ?? [];
          const rawTimes = meta?.icu_zone_times ?? meta?.hr_zone_times;
          
          if (Array.isArray(rawTimes)) {
            if (typeof rawTimes[0] === 'number') zoneTimes = rawTimes;
            else if (typeof rawTimes[0] === 'object') zoneTimes = rawTimes.map((z: any) => z.secs || 0);
          }

          // 2. Если данных нет, но есть пульс — считаем сами!
          if (zoneTimes.length === 0 && hrZones.length > 0 && streams?.hr && streams?.secT) {
            // Создаем массив для 7 зон (Z1-Z7)
            zoneTimes = new Array(hrZones.length + 1).fill(0);
            
            for (let i = 0; i < streams.hr.length; i++) {
              const h = streams.hr[i];
              if (h == null) continue;
              
              // Длительность точки (1 сек по умолчанию)
              const dt = i > 0 ? (streams.secT[i] - streams.secT[i-1]) : 1;
              
              // Определяем зону
              let z = 0;
              for (let j = 0; j < hrZones.length; j++) {
                if (h >= hrZones[j]) z = j + 1;
              }
              zoneTimes[z] += dt;
            }
          }
        } catch (e) { /* ignore */ }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 70px Inter, sans-serif';
        ctx.fillText('Время в зонах', CANVAS_WIDTH / 2, 400);

        if (zoneTimes.length > 0) {
          // Считаем сумму, чтобы найти проценты
          const total = zoneTimes.reduce((acc, val) => acc + (val || 0), 0);
          const zoneColors = ['#708499', '#6fbf73', '#d4a373', '#ffb800', '#ec3942', '#a6298c', '#5c3c92'];
          
          const startY = 600;
          const rowH = Math.min(120, 1000 / zoneTimes.length); // Сжимаем, если зон много
          
          zoneTimes.forEach((secs, i) => {
            const percent = total > 0 ? (secs / total) * 100 : 0;
            const y = startY + i * rowH;
            
            // Название зоны (Z1, Z2...)
            ctx.textAlign = 'left';
            ctx.fillStyle = zoneColors[i % zoneColors.length];
            ctx.font = 'bold 40px Inter, sans-serif';
            ctx.fillText(`Z${i + 1}`, 100, y + 40);

            // Полоска (фон)
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath(); ctx.roundRect(200, y, 700, 60, 30); ctx.fill();

            // Полоска (заполнение)
            if (percent > 0) {
              ctx.fillStyle = zoneColors[i % zoneColors.length];
              ctx.beginPath(); ctx.roundRect(200, y, Math.max(10, (percent / 100) * 700), 60, 30); ctx.fill();
            }

            // Процент
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Inter, sans-serif';
            ctx.fillText(`${Math.round(percent)}%`, 940, y + 45);
          });
        } else {
          ctx.fillStyle = '#aaaaaa';
          ctx.font = '40px Inter, sans-serif';
          ctx.fillText('Нет данных о зонах (и потоках пульса)', CANVAS_WIDTH / 2, 700);
        }
      } else if (layout === 'poster') {
        // ---- ПОСТЕР (КАРТОЧКА) ----
        const cardW = 840;
        const cardH = 1000;
        const cardX = (CANVAS_WIDTH - cardW) / 2;
        const cardY = (CANVAS_HEIGHT - cardH) / 2;

        ctx.fillStyle = 'rgba(23, 33, 43, 0.85)';
        ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 40); ctx.fill();
        ctx.strokeStyle = 'rgba(212, 163, 115, 0.3)'; ctx.lineWidth = 4; ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#d4a373';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.fillText((elements.titleText || fact.date).toUpperCase(), CANVAS_WIDTH / 2, cardY + 100);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 220px Inter, sans-serif';
        ctx.fillText(km, CANVAS_WIDTH / 2, cardY + 360);
        ctx.font = 'bold 60px Inter, sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('КМ', CANVAS_WIDTH / 2, cardY + 430);

        ctx.beginPath();
        ctx.moveTo(cardX + 100, cardY + 500); ctx.lineTo(cardX + cardW - 100, cardY + 500);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.stroke();

        ctx.textAlign = 'left';
        ctx.font = 'bold 80px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(time, cardX + 100, cardY + 620);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = '#d4a373';
        ctx.fillText(`${pace} /км`, cardX + cardW - 100, cardY + 620);

        ctx.textAlign = 'center';
        ctx.font = 'bold 40px Inter, sans-serif';
        ctx.fillStyle = '#aaaaaa';
        let extraStr = `❤️ ${hr} уд/мин`;
        if (elevationGain > 0) extraStr += `   ⛰ ${elevationGain} м`;
        ctx.fillText(extraStr, CANVAS_WIDTH / 2, cardY + 800);
      } else if (layout === 'grid') {
        // ---- СЕТКА (ДАШБОРД) ----
        const gridX = 80; const gridY = 600;
        const cellW = (CANVAS_WIDTH - gridX * 2 - 40) / 2;
        const cellH = 280;
        const gap = 40;

        // Парсим калории и метаданные
        let cals = null;
        try {
          const raw = typeof fact.raw_json === 'string' ? JSON.parse(fact.raw_json) : fact.raw_json;
          cals = (raw?.raw || raw)?.calories || raw?.calories;
        } catch (e) { /* ignore */ }

        const drawCell = (col: number, row: number, label: string, value: string, color: string) => {
          const x = gridX + col * (cellW + gap); const y = gridY + row * (cellH + gap);
          ctx.fillStyle = 'rgba(23, 33, 43, 0.7)'; ctx.beginPath(); ctx.roundRect(x, y, cellW, cellH, 24); ctx.fill();
          ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y + 40, 8, cellH - 80, 4); ctx.fill();
          ctx.textAlign = 'left'; ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 28px Inter, sans-serif'; ctx.fillText(label, x + 40, y + 80);
          ctx.fillStyle = '#ffffff'; ctx.font = 'bold 70px Inter, sans-serif'; ctx.fillText(value, x + 40, y + 200);
        };

        ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 60px Inter, sans-serif';
        ctx.fillText(elements.titleText || 'Тренировка', CANVAS_WIDTH / 2, 400);
        ctx.font = '40px Inter, sans-serif'; ctx.fillStyle = '#d4a373'; ctx.fillText(fact.date, CANVAS_WIDTH / 2, 470);

        drawCell(0, 0, 'ДИСТАНЦИЯ', `${km} км`, '#e53935');
        drawCell(1, 0, 'ВРЕМЯ', time, '#4fc3f7');
        drawCell(0, 1, 'ТЕМП', `${pace} /км`, '#d4a373');
        drawCell(1, 1, 'СР. ПУЛЬС', `${hr}`, '#ff40ff');
        drawCell(0, 2, 'КАЛОРИИ', cals ? `${cals} ккал` : '—', '#ffb800');
        drawCell(1, 2, 'НАБОР', elevationGain > 0 ? `${elevationGain} м` : '—', '#6fbf73');
      } else if (layout === 'load') {
        // ---- НАГРУЗКА (TSS, CTL, ATL) ----
        let tss = 0, ctl = 0, atl = 0;
        try {
          const raw = typeof fact.raw_json === 'string' ? JSON.parse(fact.raw_json) : fact.raw_json;
          const meta = raw?.raw || raw;
          tss = meta?.training_load || 0;
          ctl = meta?.ctl || 0;
          atl = meta?.atl || 0;
        } catch (e) { /* ignore */ }

        ctx.textAlign = 'center';
        
        // Заголовок
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 50px Inter, sans-serif';
        ctx.fillText('НАГРУЗКА (TSS)', CANVAS_WIDTH / 2, 400);

        // Огромная цифра
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 300px Inter, sans-serif';
        ctx.fillText(String(Math.round(tss)), CANVAS_WIDTH / 2, 700);

        // CTL и ATL
        const barY = 1000;
        const barW = 600;
        const barX = (CANVAS_WIDTH - barW) / 2;

        // CTL (Фитнес)
        ctx.textAlign = 'left'; ctx.fillStyle = '#6fbf73'; ctx.font = 'bold 40px Inter, sans-serif';
        ctx.fillText(`Фитнес (CTL): ${ctl.toFixed(1)}`, barX, barY);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(barX, barY + 20, barW, 30, 15); ctx.fill();
        ctx.fillStyle = '#6fbf73'; ctx.beginPath(); ctx.roundRect(barX, barY + 20, Math.min(barW, (ctl / 100) * barW), 30, 15); ctx.fill();

        // ATL (Усталость)
        ctx.textAlign = 'left'; ctx.fillStyle = '#ec3942'; ctx.font = 'bold 40px Inter, sans-serif';
        ctx.fillText(`Усталость (ATL): ${atl.toFixed(1)}`, barX, barY + 150);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(barX, barY + 170, barW, 30, 15); ctx.fill();
        ctx.fillStyle = '#ec3942'; ctx.beginPath(); ctx.roundRect(barX, barY + 170, Math.min(barW, (atl / 100) * barW), 30, 15); ctx.fill();
      } else if (layout === 'zones') {
        // ---- ПУЛЬСОВЫЕ ЗОНЫ ----
        let hrZones: number[] = [];
        try {
          const raw = typeof fact.raw_json === 'string' ? JSON.parse(fact.raw_json) : fact.raw_json;
          hrZones = (raw?.raw || raw)?.hr_zones || [];
        } catch (e) { /* ignore */ }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 70px Inter, sans-serif';
        ctx.fillText('Время в зонах', CANVAS_WIDTH / 2, 400);

        if (hrZones.length > 0) {
          // Считаем сумму, чтобы найти проценты
          const total = hrZones.reduce((acc, val) => acc + (val || 0), 0);
          const zoneColors = ['#708499', '#6fbf73', '#d4a373', '#ffb800', '#ec3942', '#a6298c', '#5c3c92'];
          
          const startY = 600;
          const rowH = 120;
          
          hrZones.forEach((secs, i) => {
            const percent = total > 0 ? (secs / total) * 100 : 0;
            const y = startY + i * rowH;
            
            // Название зоны (Z1, Z2...)
            ctx.textAlign = 'left';
            ctx.fillStyle = zoneColors[i % zoneColors.length];
            ctx.font = 'bold 40px Inter, sans-serif';
            ctx.fillText(`Z${i + 1}`, 100, y + 40);

            // Полоска (фон)
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath(); ctx.roundRect(200, y, 700, 60, 30); ctx.fill();

            // Полоска (заполнение)
            if (percent > 0) {
              ctx.fillStyle = zoneColors[i % zoneColors.length];
              ctx.beginPath(); ctx.roundRect(200, y, Math.max(10, (percent / 100) * 700), 60, 30); ctx.fill();
            }

            // Процент
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Inter, sans-serif';
            ctx.fillText(`${Math.round(percent)}%`, 940, y + 45);
          });
        } else {
          ctx.fillStyle = '#aaaaaa';
          ctx.font = '40px Inter, sans-serif';
          ctx.fillText('Нет данных о зонах', CANVAS_WIDTH / 2, 700);
        }
      }
    }
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';

    let titleBottomY = preset.safeTop + 20;
    if (!elements.titleEmbed && elements.showTitle && elements.titleText) {
      titleBottomY = preset.safeTop + 70 + 20; 
    }

    const panels: ChartPanelConfig[] = [];
    if (elements.charts.hr) panels.push({ channel: 'hr', label: 'Пульс', unit: 'уд/мин', enabled: true, heightRatio: elements.chartsHeightRatios.hr || 1 });
    if (elements.charts.pace) panels.push({ channel: 'pace', label: 'Темп', unit: '/км', enabled: true, heightRatio: elements.chartsHeightRatios.pace || 1 });
    if (elements.charts.cadence) panels.push({ channel: 'cadence', label: 'Каденс', unit: 'шаг/мин', enabled: true, heightRatio: elements.chartsHeightRatios.cadence || 1 });
    if (elements.charts.elevation) panels.push({ channel: 'elevation', label: 'Высота', unit: 'м', enabled: true, heightRatio: elements.chartsHeightRatios.elevation || 1 });

    if (panels.length > 0 && streams) {
      ctx.save();
      if (elements.chartsOffsetY !== 0) ctx.translate(0, elements.chartsOffsetY);

      const cw = CANVAS_WIDTH - preset.safeLeft - preset.safeRight - 40;
      const cx = preset.safeLeft + 20;
      const isFullHeight = elements.chartsFullHeight || layout === 'charts';
      const dpr = window.devicePixelRatio || 1;

      const LABEL_WIDTH = 70;
      const chartW = cw - LABEL_WIDTH;
      const chartX = cx + LABEL_WIDTH;

      const drawPanel = (p: any, currentY: number, h: number) => {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.roundRect(cx, currentY, cw, h, 12); ctx.fill();
        ctx.clip();

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = chartW * dpr;
        tempCanvas.height = h * dpr;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          tempCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawMultiChart(tempCtx, {
            width: chartW, height: h, panels: [p], colors: chartColors, data: streams,
            xAxis: 'distance', lineWidth: 2, fillOpacity: elements.chartsFillOpacity,
            backgroundColor: null, showAxes: false,
          });
          ctx.drawImage(tempCanvas, chartX, currentY, chartW, h);
        }
        ctx.restore();

        ctx.save();
        ctx.translate(cx + LABEL_WIDTH / 2, currentY + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.fillStyle = chartColors[p.channel as keyof typeof chartColors] || '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.label, 0, 0);
        ctx.restore();
      };

      if (isFullHeight) {
        const topY = titleBottomY + 20 + elements.chartsMarginTop;
        const bottomY = CANVAS_HEIGHT - preset.safeBottom - 20 - elements.chartsMarginBottom;
        const metricsHeight = elements.metricsShow ? 80 : 0;
        const availableHeight = bottomY - topY - metricsHeight;

        if (availableHeight > 0) {
          const ratios = panels.map((p) => p.heightRatio || 1);
          const sumRatios = ratios.reduce((a, b) => a + b, 0);
          let currentY = topY;
          const gap = 10;

          for (let i = 0; i < panels.length; i++) {
            const p = panels[i];
            const h = (availableHeight - gap * (panels.length - 1)) * (ratios[i] / sumRatios);
            drawPanel(p, currentY, h);
            currentY += h + gap;
          }
        }
      } else {
        const chartH = panels.length > 2 ? 100 : 130;
        const gap = 14;
        let cy = titleBottomY + 20;
        for (const p of panels) {
          drawPanel(p, cy, chartH);
          cy += chartH + gap;
        }
      }
      ctx.restore();
    }

    if (elements.metricsShow) {
      ctx.save();
      ctx.translate(0, elements.metricsOffsetY);
      
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';

      const parts: string[] = [];
      if (elements.metricsItems.distance) parts.push(`${fmtKm(fact.actual_km)} км`);
      if (elements.metricsItems.time) parts.push(fmtDuration(fact.duration_sec));
      if (elements.metricsItems.pace) parts.push(`${fmtPace(fact.actual_pace)} /км`);
      if (elements.metricsItems.hr && fact.avg_hr) parts.push(`${fact.avg_hr} уд/мин`);
      if (elements.metricsItems.elevation && elevationGain > 0) parts.push(`${elevationGain} м`);

      const text = parts.join('  ·  ');
      const textWidth = ctx.measureText(text).width;
      const x = (CANVAS_WIDTH - textWidth) / 2;
      const y = CANVAS_HEIGHT - preset.safeBottom - 20;
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    // Заголовок поверх всего (только если НЕ включено встраивание)
    if (!elements.titleEmbed && elements.showTitle && elements.titleText) {
      ctx.save();
      ctx.font = 'bold 48px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
      ctx.textAlign = 'center';
      const titleY = preset.safeTop + 70 + elements.titleOffsetY;
      ctx.fillText(elements.titleText, CANVAS_WIDTH / 2, titleY);
      ctx.restore();
    }

    if (elements.showLogo && elements.logoText) {
      ctx.save();
      ctx.font = `bold ${elements.logoSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
      const pad = 30;
      const pos = elements.logoPosition;
      if (pos === 'br') {
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(elements.logoText, CANVAS_WIDTH - preset.safeRight - pad, CANVAS_HEIGHT - preset.safeBottom - pad);
      } else if (pos === 'bl') {
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(elements.logoText, preset.safeLeft + pad, CANVAS_HEIGHT - preset.safeBottom - pad);
      } else if (pos === 'tr') {
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(elements.logoText, CANVAS_WIDTH - preset.safeRight - pad, preset.safeTop + pad);
      } else if (pos === 'tl') {
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(elements.logoText, preset.safeLeft + pad, preset.safeTop + pad);
      }
      ctx.restore();
    }

    setIsRendering(false);
  }, [
    visible, canvasReady, bgSource, photoImage, layout, fact, elevationGain,
    splits, photoOffset, photoScale, elements, preset, streams, chartColors
  ]);

  const handleDownload = () => {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = CANVAS_WIDTH;
    outCanvas.height = CANVAS_HEIGHT;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    if (bgSource === 'map' && elements.showMap && mapRef.current) {
      const mapCanvas = mapRef.current.getCanvas();
      mapRef.current.triggerRepaint();
      outCtx.drawImage(mapCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      outCtx.fillStyle = '#0d0d0d'; outCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    if (textCanvasRef.current) outCtx.drawImage(textCanvasRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const mime = preset.recommendedFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = preset.recommendedFormat === 'jpg' ? 'jpg' : 'png';
    const url = outCanvas.toDataURL(mime, 0.92);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smth-run-${fact.date}.${ext}`;
    a.click();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (bgSource !== 'photo') return;
    const startX = e.clientX; const startY = e.clientY;
    const startOffset = { ...photoOffset };
    const onMouseMove = (ev: MouseEvent) => {
      const rect = textCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_WIDTH / rect.width; const scaleY = CANVAS_HEIGHT / rect.height;
      setPhotoOffset({ x: startOffset.x + (ev.clientX - startX) * scaleX, y: startOffset.y + (ev.clientY - startY) * scaleY });
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (bgSource !== 'photo') return;
    setPhotoScale((prev) => Math.max(0.5, Math.min(5, prev - e.deltaY * 0.001)));
  };

  const resetMapSettings = () => {
    setMapPadding(DEFAULT_STORY_MAP.mapPadding);
    setMapZoom(DEFAULT_STORY_MAP.mapZoom);
    setMapPan({ x: 0, y: 0 });
    setLineWidth(DEFAULT_STORY_MAP.lineWidth);
    setResetCounter((c) => c + 1);
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="pi pi-camera" style={{ fontSize: '1.05rem', color: 'var(--pb-accent)' }} />
          Генератор сторис
        </span>
      }
      style={{ width: '1000px', maxWidth: '95vw' }}
      modal
      className="pb-debug-dialog"
    >
      <div style={{ display: 'flex', gap: '1rem', height: '75vh' }}>
        <div
          className="pb-story-sidebar"
          style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0, overflowY: 'auto', paddingRight: '12px' }}
        >
          {/* ---- Платформа ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Платформа</div>
            <Dropdown value={platformId} options={STORY_PRESETS.map((p) => ({ label: p.label, value: p.id }))} onChange={(e) => setPlatformId(e.value)} panelClassName="pb-dropdown-panel" style={{ width: '100%', marginTop: '0.5rem' }} />
            <label className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', cursor: 'pointer' }}>
              <Checkbox checked={showSafeZones} onChange={(e) => setShowSafeZones(!!e.checked)} />
              <span>Показать safe zones</span>
            </label>
            {preset.hint && <small className="pb-hint" style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.7rem' }}>{preset.hint}</small>}
          </div>

          {/* ---- Параметры карты ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">
              Параметры карты
              <Button icon="pi pi-refresh" text className="pb-soft p-button-sm" style={{ marginLeft: 'auto', padding: '0.1rem', width: '1.8rem', height: '1.8rem' }} onClick={resetMapSettings} tooltip="Сбросить к дефолту" tooltipOptions={{ position: 'bottom' }} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Отступ (Padding)</span><span style={{ fontFamily: 'monospace' }}>{mapPadding}px</span></div>
              <Slider value={mapPadding} min={0} max={500} step={10} onChange={(e) => setMapPadding(e.value as number)} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Зум карты</span><span style={{ fontFamily: 'monospace' }}>{mapZoom.toFixed(2)}×</span></div>
              <Slider value={mapZoom} min={ZOOM_MIN} max={ZOOM_MAX} step={0.05} onChange={(e) => setMapZoom(e.value as number)} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Сдвиг X (px)</span><span style={{ fontFamily: 'monospace' }}>{mapPan.x.toFixed(0)}</span></div>
              <Slider value={mapPan.x} min={-PAN_LIMIT} max={PAN_LIMIT} step={10} onChange={(e) => setMapPan((prev) => ({ ...prev, x: e.value as number }))} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Сдвиг Y (px)</span><span style={{ fontFamily: 'monospace' }}>{mapPan.y.toFixed(0)}</span></div>
              <Slider value={mapPan.y} min={-PAN_LIMIT} max={PAN_LIMIT} step={10} onChange={(e) => setMapPan((prev) => ({ ...prev, y: e.value as number }))} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Толщина трека</span><span style={{ fontFamily: 'monospace' }}>{lineWidth}px</span></div>
              <Slider value={lineWidth} min={1} max={15} step={1} onChange={(e) => setLineWidth(e.value as number)} />
            </div>
          </div>

          {/* ---- Фон ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Фон</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button label="Карта" icon="pi pi-map" className={bgSource === 'map' ? 'pb p-button-sm' : 'pb-soft p-button-sm'} onClick={() => setBgSource('map')} />
              <Button label="Загрузить фото" icon="pi pi-camera" className={bgSource === 'photo' ? 'pb p-button-sm' : 'pb-soft p-button-sm'} onClick={handlePickImage} />

              {/* Ползунок затемнения */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}>
                  <span>Затемнение фона</span>
                  <span style={{ fontFamily: 'monospace' }}>{Math.round(elements.globalDarkening * 100)}%</span>
                </div>
                <Slider value={elements.globalDarkening} min={0} max={0.8} step={0.05} onChange={(e) => setElements({ ...elements, globalDarkening: e.value as number })} />
              </div>

              {bgSource === 'photo' && (
                <>
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Масштаб фото</span><span style={{ fontFamily: 'monospace' }}>{Math.round(photoScale * 100)}%</span></div>
                    <Slider value={photoScale} min={0.5} max={5} step={0.1} onChange={(e) => setPhotoScale(e.value as number)} />
                  </div>
                  {(photoOffset.x !== 0 || photoOffset.y !== 0 || photoScale !== 1) && (
                    <Button label="Сбросить фото" icon="pi pi-refresh" className="pb-soft p-button-sm mt-2" onClick={() => { setPhotoOffset({ x: 0, y: 0 }); setPhotoScale(1); }} />
                  )}
                </>
              )}
            </div>
          </div>

          {/* ---- Макет ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Макет</div>
            <Dropdown value={layout} options={[
              { label: 'Классика', value: 'classic' }, 
              { label: 'Плашки', value: 'pills' }, 
              { label: 'Сплиты по км', value: 'splits' }, 
              { label: 'Точечный', value: 'dotted' }, 
              { label: 'Чек (билет)', value: 'receipt' }, 
              { label: 'Минимализм', value: 'minimal' }, 
              { label: 'Графики', value: 'charts' },
              { label: 'Постер (Карточка)', value: 'poster' },
              { label: 'Сетка (Дашборд)', value: 'grid' },
              { label: 'Нагрузка (TSS)', value: 'load' },
              { label: 'Пульсовые зоны', value: 'zones' }
            ]} onChange={(e) => setLayout(e.value)} panelClassName="pb-dropdown-panel" />
          </div>

          {/* ---- Элементы ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Элементы на сторис</div>

            {/* Название */}
            <label className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', cursor: 'pointer' }}>
              <Checkbox checked={elements.showTitle} onChange={(e) => setElements({ ...elements, showTitle: !!e.checked })} />
              <span>Название пробежки</span>
            </label>
            {elements.showTitle && (
              <>
                <InputText value={elements.titleText} onChange={(e) => setElements({ ...elements, titleText: e.target.value })} style={{ width: '100%', marginTop: '0.25rem' }} placeholder="Название" />
                <label className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', cursor: 'pointer' }}>
                  <Checkbox checked={elements.titleEmbed} onChange={(e) => setElements({ ...elements, titleEmbed: !!e.checked })} />
                  <span>Встроить в дизайн макета</span>
                </label>
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}>
                    <span>Смещение названия (Y)</span>
                    <span style={{ fontFamily: 'monospace' }}>{elements.titleOffsetY > 0 ? '+' : ''}{Math.round(elements.titleOffsetY)} px</span>
                  </div>
                  <Slider value={elements.titleOffsetY} min={-500} max={1000} step={20} onChange={(e) => setElements({ ...elements, titleOffsetY: e.value as number })} />
                </div>
              </>
            )}

            {/* Карта */}
            <label className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', cursor: 'pointer' }}>
              <Checkbox checked={elements.showMap} onChange={(e) => setElements({ ...elements, showMap: !!e.checked })} />
              <span>Трек на карте</span>
            </label>

            {/* Графики */}
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.35rem' }}>Графики:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
              {([['hr', 'Пульс'], ['pace', 'Скорость'], ['cadence', 'Каденс'], ['elevation', 'Высота']] as const).map(([key, label]) => (
                <label key={key} className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                  <Checkbox checked={elements.charts[key]} onChange={(e) => setElements({ ...elements, charts: { ...elements.charts, [key]: !!e.checked } })} />
                  <span style={{ fontSize: '0.8rem' }}>{label}</span>
                </label>
              ))}
            </div>

            {/* Настройки графиков */}
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}>
                <span>Прозрачность заливки</span>
                <span style={{ fontFamily: 'monospace' }}>{Math.round(elements.chartsFillOpacity * 100)}%</span>
              </div>
              <Slider value={elements.chartsFillOpacity} min={0.05} max={0.4} step={0.05} onChange={(e) => setElements({ ...elements, chartsFillOpacity: e.value as number })} />
            </div>

            <label className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', cursor: 'pointer' }}>
              <Checkbox checked={elements.chartsFullHeight} onChange={(e) => setElements({ ...elements, chartsFullHeight: !!e.checked })} />
              <span>Растянуть графики на всю высоту</span>
            </label>

            {elements.chartsFullHeight && (
              <div style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.5rem' }}>Соотношение высот:</div>
                {([['hr', 'Пульс'], ['pace', 'Скорость'], ['cadence', 'Каденс'], ['elevation', 'Высота']] as const).map(([key, label]) =>
                  elements.charts[key] ? (
                    <div key={key} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.3rem' }}>
                        <span>{label}</span><span style={{ fontFamily: 'monospace' }}>{elements.chartsHeightRatios[key].toFixed(1)}×</span>
                      </div>
                      <Slider value={elements.chartsHeightRatios[key]} min={0.5} max={3} step={0.1} onChange={(e) => setElements({ ...elements, chartsHeightRatios: { ...elements.chartsHeightRatios, [key]: e.value as number } })} />
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* Метрики */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
              <label className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <Checkbox checked={elements.metricsShow} onChange={(e) => setElements({ ...elements, metricsShow: !!e.checked })} />
                <span>Показывать метрики</span>
              </label>
              
              {elements.metricsShow && (
                <div style={{ marginTop: '0.75rem' }}>
                  {/* Смещение метрик */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}>
                      <span>Смещение метрик (Y)</span>
                      <span style={{ fontFamily: 'monospace' }}>{elements.metricsOffsetY > 0 ? '+' : ''}{Math.round(elements.metricsOffsetY)} px</span>
                    </div>
                    <Slider value={elements.metricsOffsetY} min={-1000} max={1000} step={20} onChange={(e) => setElements({ ...elements, metricsOffsetY: e.value as number })} />
                  </div>

                  {/* Сетка чекбоксов */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 0.2rem' }}>
                    {([['distance', 'Расстояние'], ['time', 'Время'], ['pace', 'Темп'], ['hr', 'Пульс'], ['elevation', 'Набор']] as const).map(([key, label]) => (
                      <label key={key} className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
                        <Checkbox checked={elements.metricsItems[key]} onChange={(e) => setElements({ ...elements, metricsItems: { ...elements.metricsItems, [key]: !!e.checked } })} />
                        <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Лого */}
            <label className="pb-checkbox-dark" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', cursor: 'pointer', borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
              <Checkbox checked={elements.showLogo} onChange={(e) => setElements({ ...elements, showLogo: !!e.checked })} />
              <span>Логотип / Водяной знак</span>
            </label>
            {elements.showLogo && (
              <div style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <InputText value={elements.logoText} onChange={(e) => setElements({ ...elements, logoText: e.target.value })} style={{ width: '100%' }} placeholder="smth.run" />
                <Dropdown value={elements.logoPosition} options={(Object.keys(LOGO_POSITION_LABELS) as LogoPosition[]).map((k) => ({ label: LOGO_POSITION_LABELS[k], value: k }))} onChange={(e) => setElements({ ...elements, logoPosition: e.value })} panelClassName="pb-dropdown-panel" style={{ width: '100%', marginTop: '0.5rem' }} />
                
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}>
                    <span>Размер логотипа</span><span style={{ fontFamily: 'monospace' }}>{elements.logoSize}px</span>
                  </div>
                  <Slider value={elements.logoSize} min={20} max={120} step={2} onChange={(e) => setElements({ ...elements, logoSize: e.value as number })} />
                </div>
              </div>
            )}
          </div>

          {/* ---- Смещения ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Смещения</div>
            <small className="pb-hint" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.7rem' }}>Двигайте блоки по вертикали, чтобы они не наезжали друг на друга.</small>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Контент макета (Y)</span><span style={{ fontFamily: 'monospace' }}>{elements.contentOffsetY > 0 ? '+' : ''}{Math.round(elements.contentOffsetY)} px</span></div>
              <Slider value={elements.contentOffsetY} min={-1000} max={1200} step={20} onChange={(e) => setElements({ ...elements, contentOffsetY: e.value as number })} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Графики (Y)</span><span style={{ fontFamily: 'monospace' }}>{elements.chartsOffsetY > 0 ? '+' : ''}{Math.round(elements.chartsOffsetY)} px</span></div>
              <Slider value={elements.chartsOffsetY} min={-1000} max={1200} step={20} onChange={(e) => setElements({ ...elements, chartsOffsetY: e.value as number })} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Графики: отступ сверху</span><span style={{ fontFamily: 'monospace' }}>{Math.round(elements.chartsMarginTop)} px</span></div>
              <Slider value={elements.chartsMarginTop} min={0} max={1000} step={20} onChange={(e) => setElements({ ...elements, chartsMarginTop: e.value as number })} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.4rem' }}><span>Графики: отступ снизу</span><span style={{ fontFamily: 'monospace' }}>{Math.round(elements.chartsMarginBottom)} px</span></div>
              <Slider value={elements.chartsMarginBottom} min={0} max={1000} step={20} onChange={(e) => setElements({ ...elements, chartsMarginBottom: e.value as number })} />
            </div>
          </div>

          {/* ---- Мои пресеты ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Мои пресеты</div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              <InputText value={presetNameInput} onChange={(e) => setPresetNameInput(e.target.value)} placeholder="Название пресета" style={{ flex: 1 }} />
              <Button icon="pi pi-save" tooltip="Сохранить" tooltipOptions={{ position: 'bottom' }} className="pb-soft p-button-sm" style={{ width: '2.8rem', padding: 0 }} onClick={() => {
                  const name = presetNameInput.trim(); if (!name) return;
                  setCustomPresets([{ id: `preset-${Date.now()}`, name, layout, platformId, elements: { ...elements, charts: { ...elements.charts } }, savedAt: new Date().toISOString() }, ...customPresets]);
                  setPresetNameInput('');
                }} disabled={!presetNameInput.trim()} />
            </div>
            {customPresets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                {customPresets.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.5rem', border: '1px solid var(--pb-border, #333)', borderRadius: '6px' }}>
                    <span style={{ flex: 1, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <Button icon="pi pi-check" className="pb-soft p-button-sm" style={{ width: '2.5rem', height: '2.5rem', padding: 0 }} tooltip="Применить" tooltipOptions={{ position: 'bottom' }} onClick={() => { setLayout(p.layout); setPlatformId(p.platformId); setElements(normalizeElements(p.elements)); }} />
                    <Button icon="pi pi-trash" className="pb-destructive-soft p-button-sm" style={{ width: '2.5rem', height: '2.5rem', padding: 0 }} tooltip="Удалить" tooltipOptions={{ position: 'bottom' }} onClick={() => setCustomPresets(customPresets.filter((x) => x.id !== p.id))} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 'auto' }}>
            <Button label={`Скачать ${preset.recommendedFormat.toUpperCase()}`} icon="pi pi-download" className="pb w-full" onClick={handleDownload} disabled={isRendering} />
          </div>
        </div>

        {/* ==================== ПРЕВЬЮ ==================== */}
        <div style={{ flex: 1, background: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'relative', aspectRatio: '9 / 16', height: '100%', maxWidth: '100%', overflow: 'hidden' }} onMouseDown={handleMouseDown} onWheel={handleWheel}>
            {/* ЖИВАЯ КАРТА */}
            <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, zIndex: 1, opacity: bgSource === 'map' && elements.showMap ? 1 : 0, pointerEvents: bgSource === 'map' && elements.showMap ? 'auto' : 'none', transition: 'opacity 0.2s' }} />

            {/* Чёрный фон под фото/текст, если карта выключена */}
            {!(bgSource === 'map' && elements.showMap) && (<div style={{ position: 'absolute', inset: 0, background: '#0d0d0d', zIndex: 0 }} />)}

            {/* ТЕКСТ И ФОТО */}
            <canvas ref={(el) => { textCanvasRef.current = el; if (el && !canvasReady) setCanvasReady(true); }} style={{ position: 'absolute', inset: 0, zIndex: 2, width: '100%', height: '100%', pointerEvents: 'none' }} />

            {/* SAFE ZONES */}
            {showSafeZones && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${(preset.safeTop / CANVAS_HEIGHT) * 100}%`, background: 'rgba(255,60,60,0.16)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(preset.safeBottom / CANVAS_HEIGHT) * 100}%`, background: 'rgba(255,60,60,0.16)' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${(preset.safeLeft / CANVAS_WIDTH) * 100}%`, background: 'rgba(255,60,60,0.16)' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${(preset.safeRight / CANVAS_WIDTH) * 100}%`, background: 'rgba(255,60,60,0.16)' }} />
                <div style={{ position: 'absolute', top: `${(preset.safeTop / CANVAS_HEIGHT) * 100}%`, bottom: `${(preset.safeBottom / CANVAS_HEIGHT) * 100}%`, left: `${(preset.safeLeft / CANVAS_WIDTH) * 100}%`, right: `${(preset.safeRight / CANVAS_WIDTH) * 100}%`, border: '3px dashed rgba(255,255,255,0.7)' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};