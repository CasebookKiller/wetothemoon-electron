// src/components/PRANA_BINDU/RouteMapEditor.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
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

interface Props {
  visible: boolean;
  onHide: () => void;
  initialRunId?: number;
}

type TabType = 'runs' | 'filters';

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

  useEffect(() => { setVisibleCount(CHUNK_SIZE); }, [rawFacts]);

  const visibleGroups = useMemo(
    () => groupedRuns.slice(0, visibleCount),
    [groupedRuns, visibleCount]
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
  }, [groupedRuns.length]);

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
          // В новых версиях MapLibre настройки WebGL-контекста передаются сюда
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

  // Очистка
  useEffect(() => {
    if (!visible && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = [];
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
    const currentIndex = groupedRuns.findIndex(g => g.startTime === selectedGroup.startTime && g.primary.id === selectedGroup.primary.id);
    if (currentIndex > 0) {
      const nextGroup = groupedRuns[currentIndex - 1];
      setSelectedGroup(nextGroup);
      setSelectedSource(nextGroup.primary.source);
    }
  };

  const handleNextTrack = () => {
    if (!selectedGroup) return;
    const currentIndex = groupedRuns.findIndex(g => g.startTime === selectedGroup.startTime && g.primary.id === selectedGroup.primary.id);
    if (currentIndex < groupedRuns.length - 1) {
      const nextGroup = groupedRuns[currentIndex + 1];
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
              </div>
            </div>

            {activeTab === 'runs' && (
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
                {visibleCount < groupedRuns.length && (
                  <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <Button
                      label="Показать ещё"
                      className="pb-soft p-button-sm"
                      onClick={() => setVisibleCount(prev => prev + CHUNK_SIZE)}
                    />
                  </div>
                )}
              </div>
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

                {/* Панель навигации по трекам */}
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.25rem', 
                  background: 'rgba(23, 33, 43, 0.85)', padding: '0.25rem', 
                  borderRadius: '6px', border: '1px solid var(--surface-border)',
                  backdropFilter: 'blur(4px)',
                  pointerEvents: 'auto', width: 'fit-content', height: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button icon="pi pi-chevron-left" text className="pb-drawer__name-edit" 
                    onClick={handlePrevTrack} disabled={groupedRuns[0]?.primary.id === selectedGroup.primary.id}
                    tooltip="Предыдущий трек" tooltipOptions={{ position: 'bottom' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--pb-accent)', minWidth: '7rem', textAlign: 'center', lineHeight: 1.2 }}>
                    {selectedGroup.displayName} <br/> 
                    <span style={{ color: 'var(--tg-hint)', fontSize: '0.65rem' }}>{selectedGroup.date}</span>
                  </div>
                  <Button icon="pi pi-chevron-right" text className="pb-drawer__name-edit"
                    onClick={handleNextTrack} disabled={groupedRuns[groupedRuns.length - 1]?.primary.id === selectedGroup.primary.id}
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
              </div>
            </div>
          )}

          <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
      </div>

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