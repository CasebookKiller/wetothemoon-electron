// src/components/PRANA_BINDU/StoryGeneratorDialog.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import { getOsmStyleObject, getSavedLayers, PALETTES, GradientChannel } from './mapStyles';

// ==================== Типы ====================

interface Props {
  visible: boolean;
  onHide: () => void;
  mapRef?: React.RefObject<MapLibreMap | null>;
  initialSnapshot: string | null;
  fact: any;
  streams: any;
  initialTrackSettings: any;
  gradient?: { channel: GradientChannel; palette: string };
}

type LayoutType = 'classic' | 'pills' | 'splits' | 'dotted' | 'receipt' | 'minimal';

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

// Уменьшили Padding до 40 и подняли зум до 0.9, чтобы трек был крупнее
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

function fmtPace(pace: string | null): string {
  return pace ? `${pace}` : '—';
}
function secToPaceStr(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ==================== Компонент ====================

export const StoryGeneratorDialog: React.FC<Props> = ({
  visible,
  onHide,
  fact,
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

  // Загрузка сохраненных настроек
  useEffect(() => {
    const saved =
      loadStoryMapSettings(trackKey) ??
      loadStoryMapSettings(locKey) ??
      DEFAULT_STORY_MAP;
    setMapPadding(saved.mapPadding);
    setMapZoom(saved.mapZoom);
    setMapPan(saved.mapPan);
    setLineWidth(saved.lineWidth);
  }, [trackKey, locKey]);

  // Сохранение настроек
  useEffect(() => {
    if (!visible) return;
    const s = { mapPadding, mapZoom, mapPan, lineWidth };
    if (trackKey) saveStoryMapSettings(trackKey, s);
    if (locKey) saveStoryMapSettings(locKey, s);
  }, [visible, trackKey, locKey, mapPadding, mapZoom, mapPan, lineWidth]);

  // ==================== Вычисляемые ====================

  const elevationGain = useMemo(() => {
    // 1. Пытаемся взять готовое значение из метаданных тренировки (самый точный путь)
    if (fact?.raw_json) {
      try {
        const raw = typeof fact.raw_json === 'string' 
          ? JSON.parse(fact.raw_json) 
          : fact.raw_json;

        // Zepp/FIT хранит в summary.elevationGain
        // intervals.icu хранит в total_elevation_gain или raw.total_elevation_gain
        const gain = 
          raw?.summary?.elevationGain ??
          raw?.total_elevation_gain ??
          raw?.raw?.total_elevation_gain;

        if (typeof gain === 'number' && gain > 0) {
          return Math.round(gain);
        }
      } catch (e) {
        console.warn('[Story] Не удалось распарсить raw_json для высоты', e);
      }
    }

    // 2. Fallback: если метаданных нет, считаем сами из потоков
    if (!streams?.elevationM) return 0;
    const rawElev = streams.elevationM;
    
    // Сглаживание (скользящее среднее по 5 точкам)
    const windowSize = 5;
    const smooth: (number | null)[] = [];
    for (let i = 0; i < rawElev.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(rawElev.length - 1, i + windowSize); j++) {
        if (rawElev[j] != null) {
          sum += rawElev[j]!;
          count++;
        }
      }
      smooth.push(count > 0 ? sum / count : null);
    }

    // Порог 3 метра
    let gain = 0;
    const threshold = 3.0;
    let last = smooth[0] ?? 0;
    
    for (let i = 1; i < smooth.length; i++) {
      const curr = smooth[i];
      if (curr == null) continue;
      const diff = curr - last;
      
      if (diff > threshold) {
        gain += diff;
        last = curr;
      } else if (diff < -threshold) {
        last = curr;
      }
    }
    return Math.round(gain);
  }, [streams, fact]);

  const splits = useMemo(() => {
    console.log('[Story] fact raw:', fact);
    console.log('[Story] streams channels:', Object.keys(streams || {}));
    if (!streams?.distM || !streams?.secT) return [];
    const result: { km: number; paceSec: number }[] = [];
    let lastDist = 0;
    let lastTime = 0;
    let currentKm = 1;
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
        result.push({
          km: parseFloat((totalDist / 1000).toFixed(1)),
          paceSec: (totalTime - lastTime) / ((totalDist - lastDist) / 1000),
        });
      }
    }
    return result;
  }, [streams]);

  // ==================== Инициализация живой карты ====================
  useEffect(() => {
    if (!visible) return;
    if (mapRef.current) return;
    if (!streams?.latlng) return;

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
          const built = buildTrackSource(
            streams.latlng,
            gradient,
            streams,
            initialTrackSettings?.color || '#ff5a00',
          );

          if (!built) {
            console.warn('[Story] buildTrackSource вернул null');
            return;
          }

          map.addSource('active-track', {
            type: 'geojson',
            data: built.sourceData,
          });

          map.addLayer({
            id: 'active-track',
            type: 'line',
            source: 'active-track',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': built.colorExpr,
              'line-width': lineWidth,
              'line-opacity': initialTrackSettings?.opacity ?? 1,
            },
          });

          setMapReady(true);
        });

        mapRef.current = map;
      } catch (err) {
        console.error('[Story] Failed to init map:', err);
      }
    };

    tryInit();

    return () => {
      if (timer) clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, streams]);

  // ==================== Отслеживание реального размера контейнера ====================
  useEffect(() => {
    if (!visible) return;
    let attempts = 0;
    let timer: number | null = null;
    let observer: ResizeObserver | null = null;

    const tryAttach = () => {
      attempts++;
      const el = mapContainerRef.current;
      if (!el) {
        if (attempts < 50) timer = window.setTimeout(tryAttach, 100);
        return;
      }

      const { width, height } = el.getBoundingClientRect();
      if (width > 10 && height > 10) {
        setMapSize({ width, height });
      }

      observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          const { width, height } = entries[0].contentRect;
          if (width > 10 && height > 10) {
            setMapSize({ width, height });
            if (mapRef.current) {
              mapRef.current.resize();
            }
          }
        }
      });
      observer.observe(el);
    };

    tryAttach();

    return () => {
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [visible]);

  // ==================== Камера: вписываем по ширине ====================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mapSize.width < 10 || mapSize.height < 10) return;
    if (!streams?.latlng) return;

    const updateCamera = () => {
      if (!mapRef.current) return;
      const coords = streams.latlng
        .filter((p: any) => p != null)
        .map((p: [number, number]) => [p[1], p[0]]);
      const bounds = getRobustBounds(coords);
      if (!bounds) {
        console.warn('[Story] getRobustBounds вернул null');
        return;
      }

      // Используем cameraForBounds для точного расчета
      // top:0, bottom:0 заставляет MapLibre вписать трек ровно по ширине
      let camera;
      try {
        camera = map.cameraForBounds(bounds, {
          padding: { top: 0, bottom: 0, left: mapPadding, right: mapPadding }
        });
      } catch (e) {
        console.warn('[Story] cameraForBounds error', e);
      }

      if (camera && camera.center) {
        let targetZoom = camera.zoom ?? 14;
        
        // Применяем пользовательский зум (0.9 по умолчанию)
        if (mapZoom !== 1) {
          targetZoom += Math.log2(mapZoom);
        }

        map.jumpTo({
          center: camera.center,
          zoom: targetZoom,
          bearing: 0,
          pitch: 0,
        });
      } else {
        // Если трек - точка (dx=0, dy=0)
        map.jumpTo({
          center: bounds.getCenter(),
          zoom: 15 + (mapZoom !== 1 ? Math.log2(mapZoom) : 0),
          bearing: 0,
          pitch: 0,
        });
      }

      // Сдвиг панорамы
      if (mapPan.x !== 0 || mapPan.y !== 0) {
        map.panBy([-mapPan.x / 2, -mapPan.y / 2], { duration: 0 });
      }
    };

    updateCamera();
    const t = setTimeout(updateCamera, 100);
    return () => clearTimeout(t);
  }, [mapReady, mapSize, mapPadding, mapZoom, mapPan.x, mapPan.y, streams, resetCounter]);

  // ==================== Толщина трека ====================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('active-track')) {
      map.setPaintProperty('active-track', 'line-width', lineWidth);
    }
  }, [mapReady, lineWidth]);

  // ==================== Фото ====================

  const handlePickImage = async () => {
    try {
      const api = (window as any).electronAPI;
      const lastDir = localStorage.getItem('pb.lastImageDir') || undefined;
      const res = await api.pb.pickImage(lastDir);
      if (res.success && res.path) {
        const dir = res.path.substring(
          0,
          Math.max(res.path.lastIndexOf('/'), res.path.lastIndexOf('\\')),
        );
        localStorage.setItem('pb.lastImageDir', dir);

        const dataUrl = await api.pb.readFileBase64(res.path);
        const img = new Image();
        img.onload = () => {
          setPhotoImage(img);
          setBgSource('photo');
          setPhotoOffset({ x: 0, y: 0 });
          setPhotoScale(1);
        };
        img.src = dataUrl;
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ==================== Отрисовка ТОЛЬКО текста и оверлеев на Canvas ====================

  useEffect(() => {
    if (!visible || !canvasReady || !textCanvasRef.current) return;
    setIsRendering(true);
    const canvas = textCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const km = fmtKm(fact.actual_km);
    const time = fmtDuration(fact.duration_sec);
    const pace = fmtPace(fact.actual_pace);
    const hr = fact.avg_hr ?? '—';
    const maxHr = fact.max_hr ?? '—';

    const noBgLayout =
      layout === 'receipt' || layout === 'minimal';

    if (noBgLayout) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      if (bgSource === 'photo' && photoImage) {
        let scale = Math.max(CANVAS_WIDTH / photoImage.width, CANVAS_HEIGHT / photoImage.height);
        scale *= photoScale;
        const w = photoImage.width * scale;
        const h = photoImage.height * scale;
        const x = (CANVAS_WIDTH - w) / 2 + photoOffset.x;
        const y = (CANVAS_HEIGHT - h) / 2 + photoOffset.y;
        ctx.drawImage(photoImage, x, y, w, h);
      }

      const gradientFade = ctx.createLinearGradient(0, CANVAS_HEIGHT * 0.4, 0, CANVAS_HEIGHT);
      gradientFade.addColorStop(0, 'rgba(0,0,0,0)');
      gradientFade.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = gradientFade;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Для сплитов добавляем легкое затемнение, чтобы карта/фото были видны
      if (layout === 'splits') {
        ctx.fillStyle = 'rgba(17, 17, 17, 0.45)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';

    // ---- макеты ----
    if (layout === 'classic') {
      ctx.font = 'bold 140px Inter, sans-serif';
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
      ctx.font = 'bold 50px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText('smth.run', CANVAS_WIDTH - 80, 1810);
    } else if (layout === 'pills') {
      ctx.font = 'bold 60px Inter, sans-serif';
      ctx.fillText('smth.run', 80, 400);
      ctx.font = '50px Inter, sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(fact.date, 80, 480);
      ctx.fillStyle = '#ffffff';
      const drawPill = (text: string, x: number, y: number) => {
        // Уменьшили шрифт (45px) и высоту плашки (80px), 
        // чтобы тексты гарантированно помещались и не наезжали.
        ctx.font = 'bold 45px Inter, sans-serif';
        const w = ctx.measureText(text).width + 80;
        ctx.beginPath();
        ctx.roundRect(x, y, w, 80, 40);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillText(text, x + 40, y + 55);
      };
      drawPill(`РАССТОЯНИЕ ${km} КМ`, 80, 580);
      drawPill(`ВРЕМЯ ${time}`, 80, 680);
      drawPill(`ТЕМП ${pace} / КМ`, 80, 780);
      drawPill(`СР. ПУЛЬС ${hr} УД / МИН`, 80, 880);
      drawPill(`НАБОР ${elevationGain} М`, 80, 980);
    } else if (layout === 'splits') {
      // Добавим подложку под заголовок для читаемости на любом фоне
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(60, 170, 960, 100, 20);
      ctx.fill();

      ctx.font = 'bold 55px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('Промежуточное время по км', CANVAS_WIDTH / 2, 235);
      
      ctx.font = 'bold 50px Inter, sans-serif';
      let y = 400;
      const maxBarWidth = 350; 
      const maxPace = Math.max(...splits.map((s) => s.paceSec));
      const minPace = Math.min(...splits.map((s) => s.paceSec));
      
      splits.forEach((s) => {
        // Подложка под каждую строку (чтобы текст не сливался с картой)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(60, y - 10, 960, 80, 40);
        ctx.fill();

        // Номер километра
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(s.km), 100, y + 45);
        
        // Полоска (акцентный цвет Prana-Bindu)
        const ratio =
          maxPace === minPace ? 1 : (maxPace - s.paceSec) / (maxPace - minPace);
        const barWidth = 100 + ratio * maxBarWidth;
        ctx.fillStyle = '#d4a373';
        ctx.beginPath();
        ctx.roundRect(160, y + 5, barWidth, 50, 25);
        ctx.fill();
        
        // Время темпа
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(secToPaceStr(s.paceSec), CANVAS_WIDTH - 100, y + 45);
        
        y += 95;
      });
      
      // Возвращаем выравнивание для подписи
      ctx.textAlign = 'left';
      ctx.font = 'bold 60px Inter, sans-serif';
      ctx.fillText('smth.run', 80, 1750);
    } else if (layout === 'dotted') {
      ctx.font = 'bold 80px Inter, sans-serif';
      ctx.fillText('smth.run', 80, 350);
      const drawDotted = (label: string, value: string, y: number) => {
        ctx.font = '50px Inter, sans-serif';
        ctx.fillText(label, 80, y);
        const valWidth = ctx.measureText(value).width;
        ctx.fillText(value, CANVAS_WIDTH - 80 - valWidth, y);
        const labelWidth = ctx.measureText(label).width;
        const startX = 80 + labelWidth + 20;
        const endX = CANVAS_WIDTH - 80 - valWidth - 20;
        ctx.beginPath();
        ctx.setLineDash([5, 15]);
        ctx.moveTo(startX, y - 15);
        ctx.lineTo(endX, y - 15);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.setLineDash([]);
      };
      drawDotted('Расстояние', `${km} км`, 700);
      drawDotted('Темп', `${pace} / км`, 800);
      drawDotted('Время', `${time}`, 900);
      drawDotted('Набор высоты', `${elevationGain} м`, 1000);
      drawDotted('Ср. пульс', `${hr} уд / мин`, 1100);
      drawDotted('Макс. пульс', `${maxHr} уд / мин`, 1200);
    } else if (layout === 'receipt') {
      const w = 800;
      const h = 1200;
      const x = (CANVAS_WIDTH - w) / 2;
      const y = (CANVAS_HEIGHT - h) / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - 40);
      for (let i = w; i > 0; i -= 40) {
        ctx.lineTo(x + i - 20, y + h);
        ctx.lineTo(x + i - 40, y + h - 40);
      }
      ctx.lineTo(x, y + h - 40);
      ctx.closePath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = 'bold 70px Inter, sans-serif';
      ctx.fillText('smth.run', CANVAS_WIDTH / 2, y + 150);
      ctx.font = '100px sans-serif';
      ctx.fillText('👟', CANVAS_WIDTH / 2, y + 350);
      ctx.font = 'bold 70px Inter, sans-serif';
      ctx.fillText('ВТОРНИК', CANVAS_WIDTH / 2, y + 550);
      ctx.font = '50px Inter, sans-serif';
      ctx.fillText(fact.date, CANVAS_WIDTH / 2, y + 630);
      ctx.font = 'bold 100px Inter, sans-serif';
      ctx.fillText(km, CANVAS_WIDTH / 2, y + 850);
      ctx.font = '50px Inter, sans-serif';
      ctx.fillText('км', CANVAS_WIDTH / 2, y + 910);
    } else if (layout === 'minimal') {
      ctx.textAlign = 'center';
      const drawCentered = (label: string, value: string, y: number, valueSize: number) => {
        ctx.font = '50px Inter, sans-serif';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(label, CANVAS_WIDTH / 2, y);
        ctx.font = `bold ${valueSize}px Inter, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(value, CANVAS_WIDTH / 2, y + valueSize + 20);
      };
      drawCentered('Расстояние', `${km} км`, 400, 120);
      drawCentered('Темп', `${pace} /км`, 800, 90);
      drawCentered('Время', time, 1150, 90);
      ctx.font = 'bold 60px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('smth.run', CANVAS_WIDTH / 2, 1700);
    }
    setIsRendering(false);
  }, [
    visible,
    canvasReady,
    bgSource,
    photoImage,
    layout,
    fact,
    elevationGain,
    splits,
    photoOffset,
    photoScale,
  ]);

  // ==================== Экспорт PNG ====================

  const handleDownload = () => {
    const map = mapRef.current;
    if (!map) return;

    // Убрали 'splits' из списка макетов без фона
    const noBgLayout = layout === 'receipt' || layout === 'minimal';

    const outCanvas = document.createElement('canvas');
    outCanvas.width = CANVAS_WIDTH;
    outCanvas.height = CANVAS_HEIGHT;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    if (bgSource === 'map' && !noBgLayout) {
      const mapCanvas = map.getCanvas();
      map.triggerRepaint();
      outCtx.drawImage(mapCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (textCanvasRef.current) {
      outCtx.drawImage(textCanvasRef.current, 0, 0);
    }

    const url = outCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `smth-run-${fact.date}.png`;
    a.click();
  };

  // ==================== Управление фото ====================

  const handleMouseDown = (e: React.MouseEvent) => {
    if (bgSource !== 'photo') return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startOffset = { ...photoOffset };

    const onMouseMove = (ev: MouseEvent) => {
      const rect = textCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      setPhotoOffset({
        x: startOffset.x + (ev.clientX - startX) * scaleX,
        y: startOffset.y + (ev.clientY - startY) * scaleY,
      });
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

  // ==================== Рендер ====================

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Генератор сторис"
      style={{ width: '1000px', maxWidth: '95vw' }}
      modal
      className="pb-debug-dialog"
    >
      <div style={{ display: 'flex', gap: '1rem', height: '75vh' }}>
        <div
          className="pb-story-sidebar"
          style={{
            width: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flexShrink: 0,
            overflowY: 'auto',
            paddingRight: '12px',
          }}
        >
          {/* ---- Параметры карты ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">
              Параметры карты
              <Button
                icon="pi pi-refresh"
                text
                className="pb-soft p-button-sm"
                style={{ marginLeft: 'auto', padding: '0.1rem', width: '1.8rem', height: '1.8rem' }}
                onClick={resetMapSettings}
                tooltip="Сбросить к дефолту"
                tooltipOptions={{ position: 'bottom' }}
              />
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                <span>Отступ (Padding)</span>
                <span style={{ fontFamily: 'monospace' }}>{mapPadding}px</span>
              </div>
              <Slider value={mapPadding} min={0} max={500} step={10} onChange={(e) => setMapPadding(e.value as number)} />
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                <span>Зум карты</span>
                <span style={{ fontFamily: 'monospace' }}>{mapZoom.toFixed(2)}×</span>
              </div>
              <Slider value={mapZoom} min={ZOOM_MIN} max={ZOOM_MAX} step={0.05} onChange={(e) => setMapZoom(e.value as number)} />
              <small className="pb-hint" style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }}>
                0.9× — дефолт (чуть шире). Меньше — трек меньше, вокруг больше объектов карты.
              </small>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                <span>Сдвиг X (px)</span>
                <span style={{ fontFamily: 'monospace' }}>{mapPan.x.toFixed(0)}</span>
              </div>
              <Slider
                value={mapPan.x}
                min={-PAN_LIMIT}
                max={PAN_LIMIT}
                step={10}
                onChange={(e) => setMapPan((prev) => ({ ...prev, x: e.value as number }))}
              />
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                <span>Сдвиг Y (px)</span>
                <span style={{ fontFamily: 'monospace' }}>{mapPan.y.toFixed(0)}</span>
              </div>
              <Slider
                value={mapPan.y}
                min={-PAN_LIMIT}
                max={PAN_LIMIT}
                step={10}
                onChange={(e) => setMapPan((prev) => ({ ...prev, y: e.value as number }))}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                <span>Толщина трека</span>
                <span style={{ fontFamily: 'monospace' }}>{lineWidth}px</span>
              </div>
              <Slider value={lineWidth} min={1} max={15} step={1} onChange={(e) => setLineWidth(e.value as number)} />
            </div>
            
            <small className="pb-hint" style={{ fontSize: '0.7rem', marginTop: '0.5rem', display: 'block' }}>
              Карту можно двигать мышью прямо в превью.
            </small>
          </div>

          {/* ---- Фон ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Фон</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button
                label="Карта"
                icon="pi pi-map"
                className={bgSource === 'map' ? 'pb p-button-sm' : 'pb-soft p-button-sm'}
                onClick={() => setBgSource('map')}
              />
              <Button
                label="Загрузить фото"
                icon="pi pi-camera"
                className={bgSource === 'photo' ? 'pb p-button-sm' : 'pb-soft p-button-sm'}
                onClick={handlePickImage}
              />

              {bgSource === 'photo' && (
                <>
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                      <span>Масштаб фото</span>
                      <span style={{ fontFamily: 'monospace' }}>{Math.round(photoScale * 100)}%</span>
                    </div>
                    <Slider value={photoScale} min={0.5} max={5} step={0.1} onChange={(e) => setPhotoScale(e.value as number)} />
                  </div>
                  {(photoOffset.x !== 0 || photoOffset.y !== 0 || photoScale !== 1) && (
                    <Button
                      label="Сбросить фото"
                      icon="pi pi-refresh"
                      className="pb-soft p-button-sm mt-2"
                      onClick={() => {
                        setPhotoOffset({ x: 0, y: 0 });
                        setPhotoScale(1);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* ---- Макет ---- */}
          <div className="pb-connections__block">
            <div className="pb-connections__title">Макет</div>
            <Dropdown
              value={layout}
              options={[
                { label: 'Классика', value: 'classic' },
                { label: 'Плашки', value: 'pills' },
                { label: 'Сплиты по км', value: 'splits' },
                { label: 'Точечный', value: 'dotted' },
                { label: 'Чек (билет)', value: 'receipt' },
                { label: 'Минимализм', value: 'minimal' },
              ]}
              onChange={(e) => setLayout(e.value)}
              panelClassName="pb-dropdown-panel"
            />
          </div>

          <div style={{ marginTop: 'auto' }}>
            <Button
              label="Скачать PNG"
              icon="pi pi-download"
              className="pb w-full"
              onClick={handleDownload}
              disabled={isRendering}
            />
          </div>
        </div>

        {/* ==================== ПРЕВЬЮ ==================== */}
        <div
          style={{
            flex: 1,
            background: '#000',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'relative',
              aspectRatio: '9 / 16',
              height: '100%',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          >
            {/* ЖИВАЯ КАРТА */}
            <div
              ref={mapContainerRef}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                opacity: bgSource === 'map' ? 1 : 0,
                pointerEvents: bgSource === 'map' ? 'auto' : 'none',
                transition: 'opacity 0.2s',
              }}
            />

            {/* ТЕКСТ И ФОТО (прозрачный слой) */}
            <canvas
              ref={(el) => {
                textCanvasRef.current = el;
                if (el && !canvasReady) setCanvasReady(true);
              }}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};