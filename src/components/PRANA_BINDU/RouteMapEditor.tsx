// src/components/PRANA_BINDU/RouteMapEditor.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';
import {
  Map as MapLibreMap,
  Marker,
  LngLatBounds,
  NavigationControl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { groupRunFacts, type GroupedRunFact } from './UTILS/groupRunFacts';
import {
  RasterLayer,
  getSavedLayers,
  saveLayers,
  getOsmStyleObject,
  DEFAULT_LAYERS,
  TrackSettings,
  getSavedTrackSettings,
  saveTrackSettings,
  DEFAULT_TRACK_SETTINGS,
  GradientChannel,
  GradientSettings,
  getSavedGradient,
  saveGradient,
  PALETTES,
} from './mapStyles';
import { StoryGeneratorDialog } from './StoryGeneratorDialog';
import { TestCandidatesDialog } from './TestCandidatesDialog';

interface Props {
  visible: boolean;
  onHide: () => void;
  initialRunId?: number;
}

type TabType = 'runs' | 'filters' | 'thresholds';

const HEADER_HEIGHT = 56;
const CHUNK_SIZE = 25;

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
  fallbackColor: string
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

// ==================== Утилиты для тестовых отрезков ====================

interface TestPoint {
  lat: number;
  lng: number;
}

interface TestDuration {
  type: 'time' | 'distance';
  value: number; // секунды или метры
}

const TEST_POINT_KEY = 'pb.testPoint';
const TEST_DURATION_KEY = 'pb.testDuration';

function loadTestPoint(): TestPoint | null {
  try {
    const raw = localStorage.getItem(TEST_POINT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.lat === 'number' && typeof p?.lng === 'number') {
      return { lat: p.lat, lng: p.lng };
    }
    return null;
  } catch {
    return null;
  }
}

function saveTestPoint(p: TestPoint | null): void {
  try {
    if (p) localStorage.setItem(TEST_POINT_KEY, JSON.stringify(p));
    else localStorage.removeItem(TEST_POINT_KEY);
  } catch { /* ignore */ }
}

function loadTestDuration(): TestDuration {
  try {
    const raw = localStorage.getItem(TEST_DURATION_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d?.type === 'time' || d?.type === 'distance') {
        return { type: d.type, value: Number(d.value) || 1200 };
      }
    }
  } catch { /* ignore */ }
  return { type: 'time', value: 1200 }; // 20 минут
}

function saveTestDuration(d: TestDuration): void {
  try {
    localStorage.setItem(TEST_DURATION_KEY, JSON.stringify(d));
  } catch { /* ignore */ }
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestIdx(
  latlng: (number | null)[][] | undefined,
  point: TestPoint
): number {
  if (!latlng || latlng.length === 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < latlng.length; i++) {
    const p = latlng[i];
    if (!p || p[0] == null || p[1] == null) continue;
    const d = haversineM(p[0], p[1], point.lat, point.lng);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function findEndIdxByTime(
  secT: number[] | undefined,
  startIdx: number,
  targetSec: number
): number {
  if (!secT || secT.length === 0) return startIdx;
  const startSec = secT[startIdx];
  for (let i = startIdx + 1; i < secT.length; i++) {
    if (secT[i] - startSec >= targetSec) return i;
  }
  return secT.length - 1;
}

function findEndIdxByDist(
  distM: number[] | undefined,
  latlng: (number | null)[][] | undefined,
  startIdx: number,
  targetM: number
): number {
  if (distM && distM.length > 0) {
    const startM = distM[startIdx];
    for (let i = startIdx + 1; i < distM.length; i++) {
      if (distM[i] - startM >= targetM) return i;
    }
    return distM.length - 1;
  }
  // fallback: считаем haversine накоплением
  if (!latlng) return startIdx;
  let cum = 0;
  for (let i = startIdx + 1; i < latlng.length; i++) {
    const a = latlng[i - 1];
    const b = latlng[i];
    if (!a || !b) continue;
    const aLat = a[0];
    const aLng = a[1];
    const bLat = b[0];
    const bLng = b[1];
    if (aLat == null || aLng == null || bLat == null || bLng == null) continue;
    cum += haversineM(aLat, aLng, bLat, bLng);
    if (cum >= targetM) return i;
  }
  return latlng.length - 1;
}

interface SegmentStats {
  durationSec: number;
  distanceM: number;
  paceSecPerKm: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrDriftPct: number | null;
  cadenceAvg: number | null;
}

function computeSegmentStats(
  streams: any,
  startIdx: number,
  endIdx: number
): SegmentStats {
  const secT = streams?.secT as number[] | undefined;
  const distM = streams?.distM as number[] | undefined;
  const hr = streams?.hr as (number | null)[] | undefined;
  const cadence = streams?.cadence as (number | null)[] | undefined;

  const durationSec =
    secT && secT[endIdx] != null && secT[startIdx] != null
      ? secT[endIdx] - secT[startIdx]
      : 0;
  const distanceM =
    distM && distM[endIdx] != null && distM[startIdx] != null
      ? distM[endIdx] - distM[startIdx]
      : 0;
  const paceSecPerKm =
    distanceM > 0 && durationSec > 0
      ? durationSec / (distanceM / 1000)
      : null;

  const hrs = (hr?.slice(startIdx, endIdx + 1) ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  const hrAvg =
    hrs.length > 0 ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;
  const hrMax = hrs.length > 0 ? Math.max(...hrs) : null;

  let hrDriftPct: number | null = null;
  if (hrs.length >= 4) {
    const mid = Math.floor(hrs.length / 2);
    const a1 = hrs.slice(0, mid);
    const a2 = hrs.slice(mid);
    const avg1 = a1.reduce((s, v) => s + v, 0) / a1.length;
    const avg2 = a2.reduce((s, v) => s + v, 0) / a2.length;
    if (avg1 > 0) hrDriftPct = ((avg2 - avg1) / avg1) * 100;
  }

  const cads = (cadence?.slice(startIdx, endIdx + 1) ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  const cadenceAvg =
    cads.length > 0 ? cads.reduce((s, v) => s + v, 0) / cads.length : null;

  return {
    durationSec,
    distanceM,
    paceSecPerKm,
    hrAvg,
    hrMax,
    hrDriftPct,
    cadenceAvg,
  };
}

function fmtSecAsPace(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSecAsDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${String(s).padStart(2, '0')}с`;
  return `${s}с`;
}

// ==================== Компонент ====================

export const RouteMapEditor: React.FC<Props> = ({ visible, onHide, initialRunId }) => {
  const api = (window as any).electronAPI;

  const [rawFacts, setRawFacts] = useState<any[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  const [selectedGroup, setSelectedGroup] = useState<GroupedRunFact | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [streamsPayload, setStreamsPayload] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<TabType>('runs');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Слои карты
  const [layers, setLayers] = useState<RasterLayer[]>(() => getSavedLayers());
  const [activeLayerId, setActiveLayerId] = useState<string>(layers[0]?.id || '');

  // Настройки трека
  const [trackSettings, setTrackSettings] = useState<TrackSettings>(() => getSavedTrackSettings());

  // Настройки градиента
  const [gradient, setGradient] = useState<GradientSettings>(() => getSavedGradient());

  const [loadingStreams, setLoadingStreams] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  // Разметка / тестовая точка
  const [markupMode, setMarkupMode] = useState(false);
  const [testPoint, setTestPoint] = useState<TestPoint | null>(() => loadTestPoint());
  const [testDuration, setTestDuration] = useState<TestDuration>(() => loadTestDuration());
  const [testVisible, setTestVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.testVisible') !== '0';
    } catch {
      return true;
    }
  });
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');

    // Тестовые отрезки (C.2)
  const [segments, setSegments] = useState<
    Array<{
      id: number;
      runFactId: number;
      durationType: 'time' | 'distance';
      durationValue: number;
      distanceM: number;
      durationSec: number;
      paceSecPerKm: number | null;
      hrAvg: number | null;
      hrMax: number | null;
      hrDriftPct: number | null;
      cadenceAvg: number | null;
      note: string | null;
      createdAt: string;
    }>
  >([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [candidatesVisible, setCandidatesVisible] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<
    'all' | 'time-60' | 'time-300' | 'time-600' | 'time-1200' | 'time-1800' | 'distance'
  >('all');

  const testMarkerRef = useRef<Marker | null>(null);
  const testFinishMarkerRef = useRef<Marker | null>(null);
  const markupClickHandlerRef = useRef<((e: any) => void) | null>(null);

  const markersRef = useRef<Marker[]>([]);
  const retryTimerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [storyVisible, setStoryVisible] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);

  // Ref для trackSettings — чтобы draw-эффект видел актуальное значение,
  // но не перерисовывался при каждом изменении width/opacity.
  const trackSettingsRef = useRef(trackSettings);
  useEffect(() => { trackSettingsRef.current = trackSettings; }, [trackSettings]);

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];
  const groupedRuns = useMemo(() => groupRunFacts(rawFacts, {}), [rawFacts]);

  // ==================== Загрузка списка треков ====================
  useEffect(() => {
    if (!visible) return;
    setLoadingFacts(true);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 365);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromIso = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
    const toIso = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`;

    api.pb.listRunFacts(fromIso, toIso)
      .then((res: any) => {
        if (res?.success) setRawFacts(res.items || []);
      })
      .finally(() => setLoadingFacts(false));
  }, [visible, api]);

  // Standalone автовыбор
  useEffect(() => {
    if (visible && initialRunId && groupedRuns.length > 0) {
      const grp = groupedRuns.find(g => g.items.some((it: any) => it.id === initialRunId));
      if (grp) {
        const fact = grp.items.find((it: any) => it.id === initialRunId);
        setSelectedGroup(grp);
        setSelectedSource(fact?.source || grp.primary.source);
      }
    }
  }, [visible, initialRunId, groupedRuns]);

  useEffect(() => { setVisibleCount(CHUNK_SIZE); }, [rawFacts, searchQuery]);

  // Автовыбор последней пробежки при открытии редактора
  useEffect(() => {
    if (visible && !initialRunId && groupedRuns.length > 0 && !selectedGroup) {
      setSelectedGroup(groupedRuns[0]);
      setSelectedSource(groupedRuns[0].primary.source);
    }
  }, [visible, initialRunId, groupedRuns, selectedGroup]);

  // Фильтрация по поисковому запросу
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedRuns;
    const lower = searchQuery.toLowerCase();
    return groupedRuns.filter((g) =>
      g.displayName.toLowerCase().includes(lower)
    );
  }, [groupedRuns, searchQuery]);

  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleCount),
    [filteredGroups, visibleCount]
  );

  // Подгрузка по скроллу
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 50) {
        setVisibleCount(prev => Math.min(prev + CHUNK_SIZE, groupedRuns.length));
      }
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, [filteredGroups.length]);

  // ==================== Инициализация карты ====================
  useEffect(() => {
    if (!visible) return;
    let attempts = 0;
    const maxAttempts = 30;
    const tryInit = () => {
      attempts++;
      const el = mapContainerRef.current;
      if (!el || el.clientWidth < 10 || el.clientHeight < 10) {
        if (attempts < maxAttempts) retryTimerRef.current = window.setTimeout(tryInit, 100);
        return;
      }
      if (mapRef.current) return;
      try {
        const map = new MapLibreMap({
          container: el,
          style: getOsmStyleObject(layers),
          center: [37.618423, 55.751244],
          zoom: 12,
          attributionControl: { compact: true },
          canvasContextAttributes: {
            preserveDrawingBuffer: true, 
          },
        } as any);
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.on('style.load', () => setMapLoaded(true));
        mapRef.current = map;
      } catch (err) {
        console.error('[RouteMapEditor] init error:', err);
      }
    };
    retryTimerRef.current = window.setTimeout(tryInit, 100);
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, [visible]);

  // Ресайз карты при сворачивании/разворачивании левой панели
  useEffect(() => {
    if (mapRef.current) {
      // Небольшая задержка, чтобы CSS успел применить изменения ширины
      const t = setTimeout(() => {
        mapRef.current?.resize();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isLeftPanelOpen]);

    // ==================== Режим разметки: клик по карте ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Снимаем предыдущий обработчик
    if (markupClickHandlerRef.current) {
      map.off('click', markupClickHandlerRef.current);
      markupClickHandlerRef.current = null;
    }

    // Меняем курсор
    const canvas = map.getCanvas();
    canvas.style.cursor = markupMode ? 'crosshair' : '';

    if (!markupMode) return;

    const handler = (e: any) => {
      const { lat, lng } = e.lngLat;
      const p: TestPoint = { lat, lng };
      setTestPoint(p);
      saveTestPoint(p);
    };
    map.on('click', handler);
    markupClickHandlerRef.current = handler;

    return () => {
      if (markupClickHandlerRef.current) {
        map.off('click', markupClickHandlerRef.current);
        markupClickHandlerRef.current = null;
      }
      canvas.style.cursor = '';
    };
  }, [mapLoaded, markupMode]);

  // Сохранение видимости тестового отрезка
  useEffect(() => {
    try {
      localStorage.setItem('pb.testVisible', testVisible ? '1' : '0');
    } catch { /* ignore */ }
  }, [testVisible]);

  // ==================== Загрузка сохранённых тестовых отрезков ====================

  const loadSegments = async () => {
    if (!api?.pb?.testSegmentList) return;
    setSegmentsLoading(true);
    try {
      const res = await api.pb.testSegmentList();
      if (res?.success) {
        setSegments(res.items ?? []);
      }
    } catch (e) {
      console.error('[pb-map] test-segment list error:', e);
    } finally {
      setSegmentsLoading(false);
    }
  };

  // Загружаем при переключении на вкладку «Пороги» или при открытии
  useEffect(() => {
    if (visible && activeTab === 'thresholds') {
      void loadSegments();
    }
  }, [visible, activeTab]);

  // Очистка
  useEffect(() => {
    if (!visible && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = [];
      if (testMarkerRef.current) {
        testMarkerRef.current.remove();
        testMarkerRef.current = null;
      }
      if (testFinishMarkerRef.current) {
        testFinishMarkerRef.current.remove();
        testFinishMarkerRef.current = null;
      }
      markupClickHandlerRef.current = null;
      setMarkupMode(false);
      setMapLoaded(false);
    }
  }, [visible]);

  // Применение стилей слоёв на лету
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    layers.forEach(l => {
      if (map.getLayer(l.id)) {
        map.setLayoutProperty(l.id, 'visibility', l.visible ? 'visible' : 'none');
        map.setPaintProperty(l.id, 'raster-opacity', l.opacity);
        map.setPaintProperty(l.id, 'raster-brightness-min', l.brightnessMin);
        map.setPaintProperty(l.id, 'raster-brightness-max', l.brightnessMax);
        map.setPaintProperty(l.id, 'raster-saturation', l.saturation);
        map.setPaintProperty(l.id, 'raster-contrast', l.contrast);
        map.setPaintProperty(l.id, 'raster-hue-rotate', l.hueRotate);
      }
    });
    saveLayers(layers);
  }, [layers, mapLoaded]);

  // ==================== Загрузка streams при выборе тренировки ====================
  useEffect(() => {
    if (!selectedGroup || !selectedSource) {
      setStreamsPayload(null);
      return;
    }
    const fact = selectedGroup.items.find((it: any) => it.source === selectedSource) || selectedGroup.primary;

    setLoadingStreams(true);
    api.pb.getRunStreamsMeta(fact.id)
      .then((metaRes: any) => {
        let actualSource = fact.source;
        if (metaRes?.success && metaRes.items?.length > 0) {
          const fitStream = metaRes.items.find((s: any) => s.source === 'fit');
          actualSource = fitStream ? 'fit' : metaRes.items[0].source;
        }
        return api.pb.getRunStreams(fact.id, actualSource);
      })
      .then((res: any) => {
        if (res?.success && res.payload) {
          setStreamsPayload(res.payload);
        } else {
          setStreamsPayload(null);
        }
      })
      .catch((err: any) => {
        console.error('[RouteMapEditor] stream error:', err);
        setStreamsPayload(null);
      })
      .finally(() => setLoadingStreams(false));
  }, [selectedGroup, selectedSource, api]);

  // ==================== Отрисовка трека (с градиентом) ====================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Очищаем старые слои и маркеры
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (map.getLayer('active-track-glow')) map.removeLayer('active-track-glow');
    if (map.getLayer('active-track')) map.removeLayer('active-track');
    if (map.getSource('active-track')) map.removeSource('active-track');

    if (!streamsPayload?.latlng || streamsPayload.latlng.length < 2) return;

    const coords: [number, number][] = streamsPayload.latlng
      .filter((p: any) => p != null)
      .map((p: [number, number]) => [p[1], p[0]]);

    if (coords.length < 2) return;

    const ts = trackSettingsRef.current;
    let sourceData: any;
    let colorExpr: any = ts.color;

    if (gradient.channel === 'none') {
      // Одна линия (простой случай)
      sourceData = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      };
    } else {
      // Сегменты с градиентом
      const channelValues = streamsPayload[gradient.channel] as (number | null)[] | undefined;
      const stats = computeStats(channelValues);
      if (stats) {
        colorExpr = buildColorExpression(gradient.channel, gradient.palette, stats, ts.color);
      }

      const step = Math.max(5, Math.floor(coords.length / 1000));
      const features: any[] = [];

      for (let i = 0; i < coords.length - 1; i += step) {
        const endIdx = Math.min(i + step, coords.length - 1);
        const slice = coords.slice(i, endIdx + 1);
        if (slice.length < 2) continue;

        let avg: number | null = null;
        if (channelValues) {
          const segVals = channelValues.slice(i, endIdx + 1);
          const valid = segVals.filter((v): v is number => v != null && Number.isFinite(v));
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

      sourceData = { type: 'FeatureCollection', features };
    }

    map.addSource('active-track', {
      type: 'geojson',
      data: sourceData,
    });
    
    // Если трек скрыт, не рисуем его
    if (!ts.visible) {
       return; // или просто не добавляем слои
    }

    // Glow (опционально)
    if (ts.glow) {
      map.addLayer({
        id: 'active-track-glow',
        type: 'line',
        source: 'active-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ts.color,
          'line-width': ts.width * 3,
          'line-opacity': ts.opacity * 0.3,
          'line-blur': 10,
        },
      });
    }

    // Основной трек
    map.addLayer({
      id: 'active-track',
      type: 'line',
      source: 'active-track',
      layout: { 
        'line-join': 'round', 
        'line-cap': 'round',
        'visibility': ts.visible ? 'visible' : 'none'
      },
      paint: {
        'line-color': colorExpr,
        'line-width': ts.width,
        'line-opacity': ts.opacity,
      },
    });

    const bounds = coords.reduce(
      (b: any, c: any) => b.extend(c),
      new LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 50, duration: 800 });

    markersRef.current.push(
      new Marker({ color: '#6fbf73' }).setLngLat(coords[0]).addTo(map)
    );
  }, [
    streamsPayload,
    mapLoaded,
    gradient.channel,
    gradient.palette,
    trackSettings.glow,
    trackSettings.color,
  ]);

  // ==================== Отрисовка тестовой точки + отрезка ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Убираем старые слои/маркеры
    if (map.getLayer('test-segment-outline')) map.removeLayer('test-segment-outline');
    if (map.getLayer('test-segment')) map.removeLayer('test-segment');
    if (map.getSource('test-segment')) map.removeSource('test-segment');
    if (testMarkerRef.current) {
      testMarkerRef.current.remove();
      testMarkerRef.current = null;
    }
    if (testFinishMarkerRef.current) {
      testFinishMarkerRef.current.remove();
      testFinishMarkerRef.current = null;
    }

    // Полностью скрыто чекбоксом «Тест» — не отрисовываем ничего
    if (!testVisible) return;

    if (!testPoint) return;

    // Маркер старта (перетаскиваемый)
    const startMarker = new Marker({
      color: '#d4a373',
      draggable: true,
    })
      .setLngLat([testPoint.lng, testPoint.lat])
      .addTo(map);

    startMarker.on('dragend', () => {
      const lngLat = startMarker.getLngLat();
      const p: TestPoint = { lat: lngLat.lat, lng: lngLat.lng };
      setTestPoint(p);
      saveTestPoint(p);
    });

    testMarkerRef.current = startMarker;

    // Ищем отрезок на треке
    const latlng = streamsPayload?.latlng as (number | null)[][] | undefined;
    if (!latlng || latlng.length < 2) return;

    const startIdx = findNearestIdx(latlng, testPoint);
    if (startIdx < 0) return;

    let endIdx: number;
    if (testDuration.type === 'time') {
      endIdx = findEndIdxByTime(streamsPayload.secT, startIdx, testDuration.value);
    } else {
      endIdx = findEndIdxByDist(
        streamsPayload.distM,
        latlng,
        startIdx,
        testDuration.value
      );
    }
    if (endIdx <= startIdx) return;

    // Геометрия отрезка (в формате MapLibre [lng, lat])
    const segCoords: [number, number][] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const p = latlng[i];
      if (p && p[0] != null && p[1] != null) {
        segCoords.push([p[1], p[0]]);
      }
    }
    if (segCoords.length < 2) return;

    map.addSource('test-segment', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: segCoords },
      },
    });

    // Тёмная подложка под отрезком (чтобы читался на любом цвете трека)
    map.addLayer({
      id: 'test-segment-outline',
      type: 'line',
      source: 'test-segment',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#000000',
        'line-width': trackSettingsRef.current.width + 6,
        'line-opacity': 0.4,
      },
    });

    map.addLayer({
      id: 'test-segment',
      type: 'line',
      source: 'test-segment',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#d4a373',
        'line-width': trackSettingsRef.current.width + 2,
        'line-opacity': 0.95,
      },
    });

    // Маркер финиша
    const last = latlng[endIdx];
    if (last && last[0] != null && last[1] != null) {
      const finishMarker = new Marker({ color: '#ff5a00' })
        .setLngLat([last[1], last[0]])
        .addTo(map);
      testFinishMarkerRef.current = finishMarker;
    }
  }, [streamsPayload, mapLoaded, testPoint, testDuration, testVisible]);

  // ==================== Хендлеры ====================

  const handleClose = () => {
    setSelectedGroup(null);
    setSelectedSource(null);
    setStreamsPayload(null);
    onHide();
  };

  const handleSliderChange = (layerId: string, key: keyof RasterLayer, val: number) => {
    if (mapRef.current && mapRef.current.getLayer(layerId)) {
      const paintKey = {
        opacity: 'raster-opacity',
        brightnessMin: 'raster-brightness-min',
        brightnessMax: 'raster-brightness-max',
        saturation: 'raster-saturation',
        contrast: 'raster-contrast',
        hueRotate: 'raster-hue-rotate',
      }[key as string];
      if (paintKey) {
        mapRef.current.setPaintProperty(layerId, paintKey as any, val);
      }
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      setLayers(prev => {
        const next = prev.map(l => l.id === layerId ? { ...l, [key]: val } : l);
        saveLayers(next);
        return next;
      });
    }, 50);
  };

  const updateTrackSetting = (key: keyof TrackSettings, val: any) => {
    const next = { ...trackSettings, [key]: val };
    setTrackSettings(next);
    saveTrackSettings(next);

    const map = mapRef.current;
    if (!map) return;
    if (key === 'width') {
      if (map.getLayer('active-track')) map.setPaintProperty('active-track', 'line-width', val);
      if (map.getLayer('active-track-glow')) map.setPaintProperty('active-track-glow', 'line-width', val * 3);
    } else if (key === 'opacity') {
      if (map.getLayer('active-track')) map.setPaintProperty('active-track', 'line-opacity', val);
      if (map.getLayer('active-track-glow')) map.setPaintProperty('active-track-glow', 'line-opacity', val * 0.3);
    } else if (key === 'visible') {
      // Мгновенно скрываем/показываем слои трека
      if (map.getLayer('active-track')) {
        map.setLayoutProperty('active-track', 'visibility', val ? 'visible' : 'none');
      }
      if (map.getLayer('active-track-glow')) {
        map.setLayoutProperty('active-track-glow', 'visibility', val ? 'visible' : 'none');
      }
    }
    // color и glow обрабатываются через перерисовку (в deps draw-эффекта)
  };

  const updateGradient = (patch: Partial<GradientSettings>) => {
    const next = { ...gradient, ...patch };
    setGradient(next);
    saveGradient(next);
  };

  // Показываем min/max выбранного канала
  const gradientStats = useMemo(() => {
    if (gradient.channel === 'none' || !streamsPayload) return null;
    const values = streamsPayload[gradient.channel] as (number | null)[] | undefined;
    return computeStats(values);
  }, [gradient.channel, streamsPayload]);

  const addLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer: RasterLayer = {
      id: newId, name: `Слой ${layers.length + 1}`, visible: true,
      opacity: 0.5, brightnessMin: 0, brightnessMax: 1, saturation: 0, contrast: 0, hueRotate: 0,
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(newId);
    if (mapRef.current) {
      mapRef.current.addLayer({
        id: newId, type: 'raster', source: 'osm-source',
        paint: {
          'raster-opacity': newLayer.opacity,
          'raster-brightness-min': newLayer.brightnessMin,
          'raster-brightness-max': newLayer.brightnessMax,
          'raster-saturation': newLayer.saturation,
          'raster-contrast': newLayer.contrast,
          'raster-hue-rotate': newLayer.hueRotate,
        },
      });
    }
  };

  const removeLayer = (id: string) => {
    if (layers.length <= 1) return;
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) setActiveLayerId(layers[0].id);
    if (mapRef.current && mapRef.current.getLayer(id)) mapRef.current.removeLayer(id);
  };

  const sourceOptions = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.items.map((it: any) => ({
      label: it.source + (it.name ? ` · ${it.name}` : ''),
      value: it.source,
    }));
  }, [selectedGroup]);

  const paletteOptions = useMemo(() => {
    return Object.entries(PALETTES)
      .filter(([, p]) => !p.channels || p.channels.includes(gradient.channel))
      .map(([key, p]) => ({ label: p.label, value: key }));
  }, [gradient.channel]);

  const handlePrevTrack = () => {
    if (!selectedGroup) return;
    const currentIndex = filteredGroups.findIndex(g => g.startTime === selectedGroup.startTime && g.primary.id === selectedGroup.primary.id);
    if (currentIndex > 0) {
      const nextGroup = filteredGroups[currentIndex - 1];
      setSelectedGroup(nextGroup);
      setSelectedSource(nextGroup.primary.source);
    }
  };

  const handleNextTrack = () => {
    if (!selectedGroup) return;
    const currentIndex = filteredGroups.findIndex(g => g.startTime === selectedGroup.startTime && g.primary.id === selectedGroup.primary.id);
    if (currentIndex < filteredGroups.length - 1) {
      const nextGroup = filteredGroups[currentIndex + 1];
      setSelectedGroup(nextGroup);
      setSelectedSource(nextGroup.primary.source);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    const next = layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
    setLayers(next);
    saveLayers(next);
    if (mapRef.current && mapRef.current.getLayer(layerId)) {
      const targetLayer = next.find(l => l.id === layerId);
      mapRef.current.setLayoutProperty(layerId, 'visibility', targetLayer?.visible ? 'visible' : 'none');
    }
  };

  // ==================== Расчёт тестового отрезка ====================

  const segmentInfo = useMemo(() => {
    if (!testPoint || !streamsPayload?.latlng) return null;
    const latlng = streamsPayload.latlng as (number | null)[][];
    const startIdx = findNearestIdx(latlng, testPoint);
    if (startIdx < 0) return null;

    const endIdx =
      testDuration.type === 'time'
        ? findEndIdxByTime(streamsPayload.secT, startIdx, testDuration.value)
        : findEndIdxByDist(
            streamsPayload.distM,
            latlng,
            startIdx,
            testDuration.value
          );
    if (endIdx <= startIdx) return null;

    const stats = computeSegmentStats(streamsPayload, startIdx, endIdx);
    return { startIdx, endIdx, stats };
  }, [testPoint, testDuration, streamsPayload]);

  const handleSaveTest = async () => {
    if (!segmentInfo || !selectedGroup || !testPoint) return;
    const fact =
      selectedGroup.items.find((it: any) => it.source === selectedSource) ||
      selectedGroup.primary;
    if (!fact?.id) return;

    setSaveStatus('saving');
    try {
      const api = (window as any).electronAPI;
      const res = await api.pb.testSegmentCreate({
        runFactId: fact.id,
        startLat: testPoint.lat,
        startLng: testPoint.lng,
        startIdx: segmentInfo.startIdx,
        endIdx: segmentInfo.endIdx,
        durationType: testDuration.type,
        durationValue: testDuration.value,
        distanceM: segmentInfo.stats.distanceM,
        durationSec: segmentInfo.stats.durationSec,
        paceSecPerKm: segmentInfo.stats.paceSecPerKm,
        hrAvg: segmentInfo.stats.hrAvg,
        hrMax: segmentInfo.stats.hrMax,
        hrDriftPct: segmentInfo.stats.hrDriftPct,
        cadenceAvg: segmentInfo.stats.cadenceAvg,
        note: null,
      });
      if (res?.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
        void loadSegments(); // обновим список
      } else {
        console.error('[pb-map] test-segment save error:', res?.error);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (e) {
      console.error('[pb-map] test-segment save:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // ==================== Обработчики для вкладки «Пороги» ====================

  const handleDeleteSegment = async (id: number) => {
    if (!window.confirm('Удалить этот тестовый отрезок?')) return;
    try {
      const res = await api.pb.testSegmentDelete(id);
      if (res?.success) {
        setSegments((prev) => prev.filter((s) => s.id !== id));
      } else {
        console.error('[pb-map] test-segment delete error:', res?.error);
      }
    } catch (e) {
      console.error('[pb-map] test-segment delete:', e);
    }
  };

  const fmtSegDuration = (s: {
    durationType: 'time' | 'distance';
    durationValue: number;
  }): string => {
    if (s.durationType === 'time') {
      const v = s.durationValue;
      if (v < 60) return `${v}с`;
      if (v < 3600) return `${Math.round(v / 60)}м`;
      return `${Math.round(v / 3600)}ч`;
    }
    const v = s.durationValue;
    if (v < 1000) return `${v}м`;
    return `${(v / 1000).toFixed(1)}км`;
  };

  const fmtSegDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return iso;
    }
  };

  const fmtSegPace = (sec: number | null): string => {
    if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  // Название трека по runFactId (fallback — #id)
  const getFactInfo = (runFactId: number): { date: string; name: string } => {
    const fact = rawFacts.find((f) => f.id === runFactId);
    if (!fact) return { date: '—', name: `#${runFactId}` };
    const name = fact.user_name || fact.name || fact.date || `#${runFactId}`;
    return { date: fact.date || '—', name };
  };

  // Фильтрация
  const filteredSegments = useMemo(() => {
    if (segmentFilter === 'all') return segments;
    if (segmentFilter === 'distance') {
      return segments.filter((s) => s.durationType === 'distance');
    }
    const map: Record<string, number> = {
      'time-60': 60,
      'time-300': 300,
      'time-600': 600,
      'time-1200': 1200,
      'time-1800': 1800,
    };
    const target = map[segmentFilter];
    if (target == null) return segments;
    return segments.filter(
      (s) => s.durationType === 'time' && s.durationValue === target
    );
  }, [segments, segmentFilter]);

  // Медианы по отфильтрованным
  const segmentMedians = useMemo(() => {
    if (filteredSegments.length === 0) return null;
    const hrs = filteredSegments
      .map((s) => s.hrAvg)
      .filter((v): v is number => v != null);
    const paces = filteredSegments
      .map((s) => s.paceSecPerKm)
      .filter((v): v is number => v != null);
    const drifts = filteredSegments
      .map((s) => s.hrDriftPct)
      .filter((v): v is number => v != null);
    return {
      hrMedian: median(hrs),
      paceMedian: median(paces),
      driftMedian: median(drifts),
      count: filteredSegments.length,
    };
  }, [filteredSegments]);

  // ==================== Рендер ====================

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header="Картографический редактор"
      maximizable
      modal
      className="pb-debug-dialog pb-map-editor-dialog"
      contentStyle={{ padding: 0, display: 'flex', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {!initialRunId && isLeftPanelOpen && (
          <div style={{ width: '340px', borderRight: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', height: '100%' }}>

            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
              <div className="pb-catalog__chips" style={{ marginBottom: 0 }}>
                <button
                  type="button"
                  className={`pb-catalog__chip ${activeTab === 'runs' ? 'is-on' : ''}`}
                  onClick={() => setActiveTab('runs')}
                >
                  <i className="pi pi-list" style={{ marginRight: '0.35rem' }} /> Треки
                </button>
                <button
                  type="button"
                  className={`pb-catalog__chip ${activeTab === 'filters' ? 'is-on' : ''}`}
                  onClick={() => setActiveTab('filters')}
                >
                  <i className="pi pi-sliders-h" style={{ marginRight: '0.35rem' }} /> Стиль
                </button>
                <button
                  type="button"
                  className={`pb-catalog__chip ${activeTab === 'thresholds' ? 'is-on' : ''}`}
                  onClick={() => setActiveTab('thresholds')}
                >
                  <i className="pi pi-chart-line" style={{ marginRight: '0.35rem' }} /> Пороги
                </button>
              </div>
            </div>

            {activeTab === 'runs' && (
              <>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="pb-run-filters__row">
                    <label className="pb-label">Поиск по названию</label>
                    <span className="pb-run-filters__search-wrap">
                      <i className="pi pi-search" />
                      <InputText
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Утренний, длинная, 1047…"
                        className="pb-run-filters__search"
                      />
                    </span>
                  </div>
                </div>
                <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {loadingFacts && <div className="pb-hint" style={{ textAlign: 'center', padding: '1rem' }}>Загрузка...</div>}
                {!loadingFacts && visibleGroups.map((g, idx) => {
                  const isSelected = selectedGroup?.primary.id === g.primary.id && selectedGroup?.startTime === g.startTime;
                  return (
                    <div
                      key={`${g.date}-${g.startTime ?? idx}-${g.primary.id}`}
                      onClick={() => {
                        setSelectedGroup(g);
                        setSelectedSource(g.primary.source);
                      }}
                      style={{
                        padding: '0.5rem', cursor: 'pointer', borderRadius: '4px', marginBottom: '0.25rem',
                        background: isSelected ? 'rgba(212,163,115,0.15)' : 'transparent',
                        border: isSelected ? '1px solid var(--pb-accent)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.displayName}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }}>{g.date}</span>
                      </div>
                      <div className="pb-source-badges" style={{ marginTop: '0.25rem', alignItems: 'center' }}>
                        {g.sources.map((s: any) => (
                          <span key={s} className={`pb-source-badge pb-source-badge--${s}`}>{s}</span>
                        ))}
                        <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginLeft: 'auto' }}>
                          {g.primary.actual_km ? `${g.primary.actual_km.toFixed(2)} км` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {visibleCount < filteredGroups.length && (
                  <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Button
                      label="Показать ещё"
                      className="pb-soft p-button-sm"
                      onClick={() => setVisibleCount(prev => prev + CHUNK_SIZE)}
                    />
                  </div>
                )}
                </div>
              </>
            )}

            {activeTab === 'filters' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>

                {/* Слои */}
                <div className="pb-connections__block">
                  <div className="pb-connections__title">
                    <i className="pi pi-clone" /> Слои карты
                    <Button
                      icon="pi pi-plus"
                      text
                      className="pb-soft p-button-sm"
                      style={{ marginLeft: 'auto', padding: '0.1rem', width: '1.8rem', height: '1.8rem' }}
                      onClick={addLayer}
                      tooltip="Добавить слой"
                      tooltipOptions={{ position: 'bottom' }}
                    />
                  </div>
                  {layers.map(l => (
                    <div key={l.id}
                      onClick={() => setActiveLayerId(l.id)}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '0.4rem',
                        borderRadius: '4px', cursor: 'pointer', marginBottom: '0.25rem',
                        background: activeLayerId === l.id ? 'rgba(212,163,115,0.1)' : 'transparent',
                        border: activeLayerId === l.id ? '1px solid var(--pb-accent)' : '1px solid transparent',
                      }}
                    >
                      <label className="pb-check-row pb-checkbox-dark" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={l.visible}
                          onChange={(e) => {
                            const next = layers.map(x => x.id === l.id ? { ...x, visible: !!e.checked } : x);
                            setLayers(next);
                            if (mapRef.current && mapRef.current.getLayer(l.id)) {
                              mapRef.current.setLayoutProperty(l.id, 'visibility', (e.checked ? 'visible' : 'none') as any);
                            }
                          }}
                        />
                      </label>
                      <span style={{ marginLeft: '0.5rem', flex: 1, fontSize: '0.8rem' }}>{l.name}</span>
                      <Button
                        icon="pi pi-trash"
                        text
                        className="pb-drawer__name-edit"
                        onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }}
                        tooltip="Удалить слой"
                        tooltipOptions={{ position: 'left' }}
                      />
                    </div>
                  ))}
                </div>

                {/* Настройки активного слоя */}
                {activeLayer && (
                  <div className="pb-connections__block">
                    <div className="pb-connections__title">Свойства: {activeLayer.name}</div>
                    {(['opacity','brightnessMin','brightnessMax','saturation','contrast','hueRotate'] as (keyof RasterLayer)[]).map(k => (
                      <div key={k} style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                          <span>{k === 'brightnessMin' ? 'Яркость (мин)' : k === 'brightnessMax' ? 'Яркость (макс)' : k === 'hueRotate' ? 'Сдвиг цвета (°)' : k}</span>
                          <span style={{ fontFamily: 'monospace' }}>{(activeLayer[k] as number).toFixed(2)}</span>
                        </div>
                        <Slider
                          value={activeLayer[k] as number}
                          min={k === 'hueRotate' ? 0 : k === 'saturation' || k === 'contrast' ? -1 : 0}
                          max={k === 'hueRotate' ? 360 : 1}
                          step={k === 'hueRotate' ? 5 : 0.05}
                          onChange={(e) => handleSliderChange(activeLayerId, k, e.value as number)}
                        />
                      </div>
                    ))}
                    <Button label="Сбросить слой" icon="pi pi-refresh" className="pb-soft p-button-sm w-full mt-3"
                      onClick={() => {
                        const def = DEFAULT_LAYERS.find(d => d.id === 'layer-base')!;
                        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...def, id: l.id, name: l.name } : l));
                      }} />
                  </div>
                )}

                {/* Настройки трека */}
                <div className="pb-connections__block">
                  <div className="pb-connections__title">Настройки трека</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--tg-hint)' }}>Цвет (базовый)</span>
                    <input
                      type="color"
                      value={trackSettings.color}
                      onChange={(e) => updateTrackSetting('color', e.target.value)}
                      style={{ width: '2.5rem', height: '1.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                      <span>Толщина</span>
                      <span style={{ fontFamily: 'monospace' }}>{trackSettings.width}px</span>
                    </div>
                    <Slider
                      value={trackSettings.width}
                      min={1} max={10} step={1}
                      onChange={(e) => updateTrackSetting('width', e.value as number)}
                    />
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                      <span>Прозрачность</span>
                      <span style={{ fontFamily: 'monospace' }}>{trackSettings.opacity.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={trackSettings.opacity}
                      min={0.1} max={1} step={0.1}
                      onChange={(e) => updateTrackSetting('opacity', e.value as number)}
                    />
                  </div>

                  <div className="flex align-items-center mt-3 pb-check-row pb-checkbox-dark" style={{ cursor: 'pointer' }}>
                    <Checkbox
                      checked={trackSettings.glow}
                      onChange={(e) => updateTrackSetting('glow', !!e.checked)}
                    />
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>Свечение под треком</span>
                  </div>

                  <Button
                    label="Сбросить настройки трека"
                    icon="pi pi-refresh"
                    className="pb-soft p-button-sm w-full mt-3"
                    onClick={() => {
                      setTrackSettings(DEFAULT_TRACK_SETTINGS);
                      saveTrackSettings(DEFAULT_TRACK_SETTINGS);
                    }}
                  />
                </div>

                {/* Градиент по данным */}
                <div className="pb-connections__block">
                  <div className="pb-connections__title">Градиент по данным</div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.35rem' }}>Канал</div>
                    <Dropdown
                      value={gradient.channel}
                      options={[
                        { label: 'Нет (сплошной)', value: 'none' },
                        { label: 'Пульс', value: 'hr' },
                        { label: 'Скорость', value: 'speedKmh' },
                        { label: 'Высота', value: 'elevationM' },
                        { label: 'Каденс', value: 'cadence' },
                      ]}
                      onChange={(e) => updateGradient({ channel: e.value })}
                      className="pb-wade-programs__dd w-full"
                      panelClassName="pb-dropdown-panel"
                    />
                  </div>

                  {gradient.channel !== 'none' && (
                    <>
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.35rem' }}>Палитра</div>
                        <Dropdown
                          value={gradient.palette}
                          options={paletteOptions}
                          onChange={(e) => updateGradient({ palette: e.value })}
                          className="pb-wade-programs__dd w-full"
                          panelClassName="pb-dropdown-panel"
                        />
                      </div>

                      {gradientStats && (
                        <div className="pb-hint" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
                          Диапазон: {gradientStats.min.toFixed(1)} – {gradientStats.max.toFixed(1)}
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
            )}

            {activeTab === 'thresholds' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {/* Заголовок + обновить */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span
                    className="pb-hint"
                    style={{ fontSize: '0.75rem', flex: 1 }}
                  >
                    {segments.length === 0
                      ? 'Пока нет сохранённых отрезков'
                      : `Всего: ${segments.length}`}
                  </span>
                  <Button
                    label="Найти кандидатов"
                    icon="pi pi-search"
                    className="pb-soft p-button-sm"
                    onClick={() => setCandidatesVisible(true)}
                    disabled={!testPoint || !selectedGroup}
                    tooltip={!testPoint ? 'Сначала поставьте точку старта (🎯)' : 'Сканировать тренировки и найти подходящие отрезки'}
                    tooltipOptions={{ position: 'bottom' }}
                  />
                  <Button
                    icon="pi pi-refresh"
                    text
                    className="pb-soft p-button-sm"
                    style={{
                      padding: '0.1rem',
                      width: '1.8rem',
                      height: '1.8rem',
                    }}
                    onClick={() => void loadSegments()}
                    disabled={segmentsLoading}
                    tooltip="Обновить"
                    tooltipOptions={{ position: 'bottom' }}
                  />
                </div>

                {/* Фильтр по длительности */}
                <div
                  className="pb-catalog__chips"
                  style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}
                >
                  {[
                    { id: 'all', label: 'Все' },
                    { id: 'time-60', label: '1м' },
                    { id: 'time-300', label: '5м' },
                    { id: 'time-600', label: '10м' },
                    { id: 'time-1200', label: '20м' },
                    { id: 'time-1800', label: '30м' },
                    { id: 'distance', label: 'Дист.' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`pb-catalog__chip ${
                        segmentFilter === f.id ? 'is-on' : ''
                      }`}
                      onClick={() =>
                        setSegmentFilter(f.id as typeof segmentFilter)
                      }
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {segmentsLoading && (
                  <div
                    className="pb-hint"
                    style={{ textAlign: 'center', padding: '0.5rem' }}
                  >
                    <i className="pi pi-spin pi-spinner" /> Загрузка…
                  </div>
                )}

                {/* Медианы */}
                {segmentMedians && segmentMedians.count > 0 && (
                  <div
                    style={{
                      background: 'rgba(212, 163, 115, 0.08)',
                      border: '1px solid rgba(212, 163, 115, 0.3)',
                      borderRadius: 6,
                      padding: '0.5rem 0.6rem',
                      marginBottom: '0.75rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        color: 'var(--pb-accent)',
                        fontWeight: 600,
                        marginBottom: '0.3rem',
                      }}
                    >
                      Медиана {segmentFilter === 'all' ? 'всех' : 'по фильтру'} (
                      {segmentMedians.count}{' '}
                      {segmentMedians.count === 1 ? 'тест' : 'тестов'})
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr',
                        gap: '0.15rem 0.5rem',
                      }}
                    >
                      <span style={{ color: 'var(--tg-hint)' }}>HR:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {segmentMedians.hrMedian != null
                          ? Math.round(segmentMedians.hrMedian)
                          : '—'}{' '}
                        уд/мин
                      </span>
                      <span style={{ color: 'var(--tg-hint)' }}>Темп:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {fmtSegPace(segmentMedians.paceMedian)} /км
                      </span>
                      <span style={{ color: 'var(--tg-hint)' }}>Дрейф:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {segmentMedians.driftMedian != null
                          ? `${
                              segmentMedians.driftMedian >= 0 ? '+' : ''
                            }${segmentMedians.driftMedian.toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>
                    {segmentMedians.count < 3 && (
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--tg-hint)',
                          marginTop: '0.3rem',
                        }}
                      >
                        Для статистики нужно ≥3 теста
                      </div>
                    )}
                  </div>
                )}

                {/* Таблица */}
                {filteredSegments.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.72rem',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--surface-border)',
                            color: 'var(--tg-hint)',
                            textAlign: 'left',
                          }}
                        >
                          <th style={{ padding: '0.4rem 0.3rem' }}>Дата</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Трек</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Длит.</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Темп</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>HR</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Макс</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Дрейф</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSegments.map((s) => {
                          const info = getFactInfo(s.runFactId);
                          return (
                            <tr
                              key={s.id}
                              style={{
                                borderBottom:
                                  '1px solid rgba(255,255,255,0.04)',
                              }}
                            >
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  color: 'var(--tg-hint)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {fmtSegDate(s.createdAt)}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  maxWidth: '100px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={info.name}
                              >
                                {info.name}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {fmtSegDuration(s)}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {fmtSegPace(s.paceSecPerKm)}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {s.hrAvg != null ? Math.round(s.hrAvg) : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {s.hrMax ?? '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                  color:
                                    s.hrDriftPct != null &&
                                    Math.abs(s.hrDriftPct) > 5
                                      ? 'var(--tg-destructive)'
                                      : undefined,
                                }}
                              >
                                {s.hrDriftPct != null
                                  ? `${
                                      s.hrDriftPct >= 0 ? '+' : ''
                                    }${s.hrDriftPct.toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  width: '30px',
                                }}
                              >
                                <Button
                                  icon="pi pi-trash"
                                  text
                                  className="pb-drawer__name-edit"
                                  style={{
                                    width: '1.7rem',
                                    height: '1.7rem',
                                    padding: 0,
                                  }}
                                  onClick={() => void handleDeleteSegment(s.id)}
                                  tooltip="Удалить"
                                  tooltipOptions={{ position: 'left' }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!segmentsLoading &&
                  filteredSegments.length === 0 &&
                  segments.length > 0 && (
                    <div
                      className="pb-hint"
                      style={{
                        textAlign: 'center',
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      Нет отрезков под этот фильтр
                    </div>
                  )}

                {!segmentsLoading && segments.length === 0 && (
                  <div
                    className="pb-hint"
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      border: '1px dashed var(--surface-border)',
                      borderRadius: 6,
                    }}
                  >
                    Поставьте точку старта на карте (🎯), выберите длительность
                    и сохраните тест.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Карта */}
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>

          {loadingStreams && (
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
              <i className="pi pi-spin pi-spinner" />
            </div>
          )}

          {/* Плавающий HUD на карте (Навигация + Источник + Слои) */}
          {selectedGroup && (
            <div style={{
              position: 'absolute', top: 10, left: 10, zIndex: 5,
              display: 'flex', flexDirection: 'column', gap: '0.5rem', 
              pointerEvents: 'none' // Контейнер не перехватывает клики
            }}>
              
              {/* ВЕРХНЯЯ СТРОКА: Свернуть + Навигация + Источник */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                
                {/* Кнопка сворачивания левой панели */}
                {!initialRunId && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(23, 33, 43, 0.85)', borderRadius: '6px', border: '1px solid var(--surface-border)',
                    backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', boxSizing: 'border-box'
                  }}>
                    <Button
                      icon={isLeftPanelOpen ? 'pi pi-angle-double-left' : 'pi pi-angle-double-right'}
                      text
                      className="pb-drawer__name-edit"
                      onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                      tooltip={isLeftPanelOpen ? 'Свернуть панель' : 'Развернуть панель'}
                      tooltipOptions={{ position: 'bottom' }}
                    />
                  </div>
                )}

                {/* Кнопка Сторис */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(23, 33, 43, 0.85)', borderRadius: '6px', border: '1px solid var(--surface-border)',
                  backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', width: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button
                    icon="pi pi-camera"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => {
                      // Всю работу по снимку теперь делает сам StoryGeneratorDialog
                      setMapSnapshot(null);
                      setStoryVisible(true);
                    }}
                    tooltip="Сделать сторис"
                    tooltipOptions={{ position: 'bottom' }}
                  />
                </div>

                                {/* Кнопка Разметка */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: markupMode ? 'rgba(212, 163, 115, 0.2)' : 'rgba(23, 33, 43, 0.85)',
                  borderRadius: '6px',
                  border: `1px solid ${markupMode ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                  backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', width: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button
                    icon="pi pi-map-marker"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => setMarkupMode((v) => !v)}
                    tooltip={markupMode ? 'Выйти из разметки' : 'Разметка: клик по карте — поставить точку старта'}
                    tooltipOptions={{ position: 'bottom' }}
                    style={{ color: markupMode ? 'var(--pb-accent)' : undefined }}
                  />
                </div>

                {/* Панель навигации по трекам */}
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.25rem', 
                  background: 'rgba(23, 33, 43, 0.85)', padding: '0.25rem', 
                  borderRadius: '6px', border: '1px solid var(--surface-border)',
                  backdropFilter: 'blur(4px)',
                  pointerEvents: 'auto', width: 'fit-content', height: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button icon="pi pi-chevron-left" text className="pb-drawer__name-edit" 
                    onClick={handlePrevTrack} disabled={filteredGroups[0]?.primary.id === selectedGroup.primary.id}
                    tooltip="Предыдущий трек" tooltipOptions={{ position: 'bottom' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--pb-accent)', minWidth: '7rem', textAlign: 'center', lineHeight: 1.2 }}>
                    {selectedGroup.displayName} <br/> 
                    <span style={{ color: 'var(--tg-hint)', fontSize: '0.65rem' }}>{selectedGroup.date}</span>
                  </div>
                  <Button icon="pi pi-chevron-right" text className="pb-drawer__name-edit"
                    onClick={handleNextTrack} disabled={filteredGroups[filteredGroups.length - 1]?.primary.id === selectedGroup.primary.id}
                    tooltip="Следующий трек" tooltipOptions={{ position: 'bottom' }}
                  />
                </div>

                {/* Панель выбора источника (если их >1) */}
                {sourceOptions.length > 1 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'rgba(23, 33, 43, 0.85)', padding: '0.4rem 0.5rem',
                    borderRadius: '6px', border: '1px solid var(--surface-border)',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'auto', width: 'fit-content', height: '2.5rem', boxSizing: 'border-box'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--pb-accent)', whiteSpace: 'nowrap' }}>Источник:</span>
                    <Dropdown
                      value={selectedSource}
                      options={sourceOptions}
                      onChange={(e) => setSelectedSource(e.value)}
                      className="pb-wade-programs__dd"
                      style={{ minWidth: '10rem', height: '2rem', fontSize: '0.8rem' }}
                      panelClassName="pb-dropdown-panel"
                    />
                  </div>
                )}
              </div>

              {/* НИЖНЯЯ ПАНЕЛЬ: Слои и Трек (в строку) */}
              <div style={{
                display: 'flex', flexDirection: 'row', gap: '0.75rem', alignItems: 'center',
                background: 'rgba(23, 33, 43, 0.85)', padding: '0.4rem 0.75rem',
                borderRadius: '6px', border: '1px solid var(--surface-border)',
                backdropFilter: 'blur(4px)',
                pointerEvents: 'auto', width: 'fit-content'
              }}>
                <label className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                  <Checkbox 
                    checked={trackSettings.visible} 
                    onChange={(e) => updateTrackSetting('visible', !!e.checked)} 
                  />
                  <span>Трек</span>
                </label>
                {layers.map(l => (
                  <label key={l.id} className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                    <Checkbox 
                      checked={l.visible} 
                      onChange={() => toggleLayerVisibility(l.id)} 
                    />
                    <span>{l.name}</span>
                  </label>
                ))}
                {testPoint && (
                  <label className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                    <Checkbox 
                      checked={testVisible} 
                      onChange={(e) => setTestVisible(!!e.checked)} 
                    />
                    <span>Тест</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Панель метрик теста */}
          {testVisible && segmentInfo && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 100,
                  right: 10,
                  zIndex: 5,
                  background: 'rgba(23, 33, 43, 0.92)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 8,
                  padding: '0.6rem 0.8rem',
                  backdropFilter: 'blur(4px)',
                  minWidth: '200px',
                  fontSize: '0.8rem',
                  pointerEvents: 'auto',
                }}
              >
                <div style={{
                  fontWeight: 600, color: 'var(--pb-accent)',
                  marginBottom: '0.4rem', fontSize: '0.85rem'
                }}>
                  Тестовый отрезок
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.5rem' }}>
                  <span style={{ color: 'var(--tg-hint)' }}>Время:</span>
                  <span style={{ fontFamily: 'monospace' }}>{fmtSecAsDuration(segmentInfo.stats.durationSec)}</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Дистанция:</span>
                  <span style={{ fontFamily: 'monospace' }}>{(segmentInfo.stats.distanceM / 1000).toFixed(2)} км</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Темп:</span>
                  <span style={{ fontFamily: 'monospace' }}>{fmtSecAsPace(segmentInfo.stats.paceSecPerKm)} /км</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Ср. пульс:</span>
                  <span style={{ fontFamily: 'monospace' }}>{segmentInfo.stats.hrAvg != null ? Math.round(segmentInfo.stats.hrAvg) : '—'} уд/мин</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Макс. пульс:</span>
                  <span style={{ fontFamily: 'monospace' }}>{segmentInfo.stats.hrMax ?? '—'} уд/мин</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Дрейф HR:</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {segmentInfo.stats.hrDriftPct != null
                      ? `${segmentInfo.stats.hrDriftPct >= 0 ? '+' : ''}${segmentInfo.stats.hrDriftPct.toFixed(1)}%`
                      : '—'}
                  </span>
                  <span style={{ color: 'var(--tg-hint)' }}>Каденс:</span>
                  <span style={{ fontFamily: 'monospace' }}>{segmentInfo.stats.cadenceAvg != null ? Math.round(segmentInfo.stats.cadenceAvg) : '—'}</span>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveTest}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  className="pb-soft p-button-sm"
                  style={{
                    width: '100%',
                    marginTop: '0.6rem',
                    ...(saveStatus === 'saved' && {
                      color: 'var(--tg-success)',
                      borderColor: 'var(--tg-success)',
                    }),
                    ...(saveStatus === 'error' && {
                      color: 'var(--tg-destructive)',
                      borderColor: 'var(--tg-destructive)',
                    }),
                  }}
                  icon={
                    saveStatus === 'saving'
                      ? 'pi pi-spin pi-spinner'
                      : saveStatus === 'saved'
                      ? 'pi pi-check'
                      : saveStatus === 'error'
                      ? 'pi pi-times'
                      : 'pi pi-save'
                  }
                  label={
                    saveStatus === 'saving'
                      ? 'Сохранение…'
                      : saveStatus === 'saved'
                      ? 'Сохранено'
                      : saveStatus === 'error'
                      ? 'Ошибка сохранения'
                      : 'Сохранить как тест'
                  }
                />
              </div>
          )}

          {/* Панель выбора длительности */}
          {testVisible && testPoint && streamsPayload?.latlng && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                background: 'rgba(23, 33, 43, 0.92)',
                border: '1px solid var(--surface-border)',
                borderRadius: 8,
                padding: '0.4rem 0.6rem',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                pointerEvents: 'auto',
              }}
            >
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--tg-hint)', fontSize: '0.7rem', minWidth: '70px' }}>По времени:</span>
                {[
                  { label: '1м', value: 60 },
                  { label: '5м', value: 300 },
                  { label: '10м', value: 600 },
                  { label: '15м', value: 900 },
                  { label: '20м', value: 1200 },
                  { label: '30м', value: 1800 },
                ].map((o) => {
                  const active = testDuration.type === 'time' && testDuration.value === o.value;
                  return (
                    <button
                      key={`time-${o.value}`}
                      type="button"
                      onClick={() => {
                        const d: TestDuration = { type: 'time', value: o.value };
                        setTestDuration(d);
                        saveTestDuration(d);
                      }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.72rem',
                        border: `1px solid ${active ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                        background: active ? 'rgba(212, 163, 115, 0.15)' : 'transparent',
                        color: active ? 'var(--pb-accent)' : 'var(--tg-text)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--tg-hint)', fontSize: '0.7rem', minWidth: '70px' }}>По дистанции:</span>
                {[
                  { label: '100м', value: 100 },
                  { label: '200м', value: 200 },
                  { label: '400м', value: 400 },
                  { label: '500м', value: 500 },
                  { label: '1км', value: 1000 },
                  { label: '2км', value: 2000 },
                  { label: '5км', value: 5000 },
                ].map((o) => {
                  const active = testDuration.type === 'distance' && testDuration.value === o.value;
                  return (
                    <button
                      key={`dist-${o.value}`}
                      type="button"
                      onClick={() => {
                        const d: TestDuration = { type: 'distance', value: o.value };
                        setTestDuration(d);
                        saveTestDuration(d);
                      }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.72rem',
                        border: `1px solid ${active ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                        background: active ? 'rgba(212, 163, 115, 0.15)' : 'transparent',
                        color: active ? 'var(--pb-accent)' : 'var(--tg-text)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--tg-hint)', textAlign: 'center' }}>
                Маркер можно перетащить. Клик в режиме «Разметка» ставит новую точку.
              </div>
            </div>
          )}

          {/* Хинт: нет точки, но есть трек */}
          {!testPoint && streamsPayload?.latlng && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                background: 'rgba(23, 33, 43, 0.85)',
                border: '1px dashed var(--surface-border)',
                borderRadius: 6,
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--tg-hint)',
                pointerEvents: 'none',
              }}
            >
              🎯 Включите «Разметку» и кликните по карте — поставите точку старта
            </div>
          )}

          <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
      </div>

            {testPoint && (
        <TestCandidatesDialog
          visible={candidatesVisible}
          onHide={() => setCandidatesVisible(false)}
          testPoint={testPoint}
          durationType={testDuration.type}
          durationValue={testDuration.value}
          onSaved={() => {
            void loadSegments();
          }}
        />
      )}

      {selectedGroup && (
        <StoryGeneratorDialog
          visible={storyVisible}
          onHide={() => setStoryVisible(false)}
          mapRef={mapRef}
          initialSnapshot={mapSnapshot}
          fact={selectedGroup.primary}
          streams={streamsPayload}
          initialTrackSettings={trackSettings}
          gradient={gradient}
        />
      )}
    </Dialog>
  );
};