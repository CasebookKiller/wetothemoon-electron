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
  DEFAULT_TRACK_SETTINGS, // <-- добавили
} from './mapStyles';

interface Props {
  visible: boolean;
  onHide: () => void;
  initialRunId?: number;
}

type TabType = 'runs' | 'filters';

const HEADER_HEIGHT = 56;
const CHUNK_SIZE = 25;

export const RouteMapEditor: React.FC<Props> = ({ visible, onHide, initialRunId }) => {
  const api = (window as any).electronAPI;

  const [rawFacts, setRawFacts] = useState<any[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  const [selectedGroup, setSelectedGroup] = useState<GroupedRunFact | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('runs');
  
  // Состояния слоёв и трека
  const [layers, setLayers] = useState<RasterLayer[]>(() => getSavedLayers());
  const [activeLayerId, setActiveLayerId] = useState<string>(layers[0]?.id || '');
  const [trackSettings, setTrackSettings] = useState<TrackSettings>(() => getSavedTrackSettings());
  
  const [loadingStreams, setLoadingStreams] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const retryTimerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];
  const groupedRuns = useMemo(() => groupRunFacts(rawFacts, {}), [rawFacts]);

  // Загрузка данных
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

  // Инициализация карты
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
        });
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

  // Отрисовка трека с учётом trackSettings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !selectedGroup || !selectedSource) return;
    const fact = selectedGroup.items.find((it: any) => it.source === selectedSource) || selectedGroup.primary;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    // Удаляем старые слои трека
    if (map.getLayer('active-track-glow')) map.removeLayer('active-track-glow');
    if (map.getLayer('active-track')) map.removeLayer('active-track');
    if (map.getSource('active-track')) map.removeSource('active-track');

    setLoadingStreams(true);
    // Сначала узнаем, под каким source сохранены потоки для этого факта.
    // Для ICU они сохраняются как 'fit'.
    api.pb.getRunStreamsMeta(fact.id)
      .then((metaRes: any) => {
        let actualSource = fact.source;
        if (metaRes?.success && metaRes.items && metaRes.items.length > 0) {
          // Приоритет: если есть 'fit' — берем его, иначе первый доступный
          const fitStream = metaRes.items.find((s: any) => s.source === 'fit');
          actualSource = fitStream ? 'fit' : metaRes.items[0].source;
        }
        return api.pb.getRunStreams(fact.id, actualSource);
      })
      .then((res: any) => {
        if (!res?.success || !res.payload?.latlng) return;
        const coords = res.payload.latlng
          .filter((p: any) => p != null)
          .map((p: [number, number]) => [p[1], p[0]]);
        if (coords.length < 2) return;

        map.addSource('active-track', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
        });

        // Слой свечения (подложка), если включен
        if (trackSettings.glow) {
          map.addLayer({
            id: 'active-track-glow',
            type: 'line',
            source: 'active-track',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': trackSettings.color,
              'line-width': trackSettings.width * 3,
              'line-opacity': trackSettings.opacity * 0.3,
              'line-blur': 10,
            },
          });
        }

        // Основной слой трека
        map.addLayer({
          id: 'active-track',
          type: 'line',
          source: 'active-track',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 
            'line-color': trackSettings.color, 
            'line-width': trackSettings.width,
            'line-opacity': trackSettings.opacity,
          },
        });

        const bounds = coords.reduce((b: any, c: any) => b.extend(c), new LngLatBounds(coords[0], coords[0]));
        map.fitBounds(bounds, { padding: 50, duration: 800 });
        markersRef.current.push(new Marker({ color: '#6fbf73' }).setLngLat(coords[0]).addTo(map));
      })
      .catch((err: any) => console.error('[RouteMapEditor] stream error:', err))
      .finally(() => setLoadingStreams(false));
  }, [selectedGroup, selectedSource, mapLoaded, api, trackSettings]);

  const handleClose = () => {
    setSelectedGroup(null);
    setSelectedSource(null);
    onHide();
  };

  // --- Быстрое обновление карты без ререндера React ---
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

    // Мгновенно обновляем на карте
    const map = mapRef.current;
    if (map) {
      if (key === 'color') {
        if (map.getLayer('active-track')) map.setPaintProperty('active-track', 'line-color', val);
        if (map.getLayer('active-track-glow')) map.setPaintProperty('active-track-glow', 'line-color', val);
      } else if (key === 'width') {
        if (map.getLayer('active-track')) map.setPaintProperty('active-track', 'line-width', val);
        if (map.getLayer('active-track-glow')) map.setPaintProperty('active-track-glow', 'line-width', val * 3);
      } else if (key === 'opacity') {
        if (map.getLayer('active-track')) map.setPaintProperty('active-track', 'line-opacity', val);
        if (map.getLayer('active-track-glow')) map.setPaintProperty('active-track-glow', 'line-opacity', val * 0.3);
      } else if (key === 'glow') {
        // Если включили/выключили свечение, нужно перерисовать трек.
        // Вызываем перерисовку через изменение стейта (React useEffect сработает заново).
        setTrackSettings({ ...next });
      }
    }
  };

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

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header="Картографический редактор"
      maximizable
      style={{ width: '95vw', height: '90vh' }}
      modal
      className="pb-debug-dialog"
      contentStyle={{
        padding: 0, display: 'flex', overflow: 'hidden',
        height: `calc(90vh - ${HEADER_HEIGHT}px)`,
      }}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        
        {/* Левая панель */}
        {!initialRunId && (
          <div style={{ width: '340px', borderRight: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Табы в стиле чипсов */}
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

            {/* Вкладка ТРЕКИ */}
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

            {/* Вкладка СТИЛЬ (Слои) */}
            {activeTab === 'filters' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {/* 1. Слои карты */}
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

                {/* 2. Настройки активного слоя */}
                {activeLayer && (
                  <div className="pb-connections__block mb-2">
                    <div className="pb-connections__title">
                      Свойства: {activeLayer.name}
                    </div>
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

                {/* 3. Настройки трека (перенесены сюда) */}
                <div className="pb-connections__block">
                  <div className="pb-connections__title">Настройки трека</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--tg-hint)' }}>Цвет</span>
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

              </div>
            )}

          </div>
        )}

        {/* Правая панель — Карта */}
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          {selectedGroup && sourceOptions.length > 1 && (
            <div style={{
              position: 'absolute', top: 10, left: 10, zIndex: 5,
              background: 'rgba(23, 33, 43, 0.85)', padding: '0.5rem', borderRadius: '6px',
              border: '1px solid var(--surface-border)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--pb-accent)' }}>Источник:</span>
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
          {loadingStreams && (
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
              <i className="pi pi-spin pi-spinner" />
            </div>
          )}
          <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
      </div>
    </Dialog>
  );
};