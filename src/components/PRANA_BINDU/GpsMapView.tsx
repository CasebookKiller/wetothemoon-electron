// src/components/PRANA_BINDU/GpsMapView.tsx
//
// Карта GPS-трека. MapLibre GL.
// Глупый компонент — принимает latlng и опциональные каналы.

import React, { useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  LngLatBounds,
  NavigationControl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getSavedLayers, getOsmStyleObject } from './mapStyles';

interface Props {
  latlng: ([number, number] | null)[];
  hr?: (number | null)[];
  elevation?: (number | null)[];
  gpsQuality: 'good' | 'poor' | 'lost';
  height?: number;
  colorBy?: 'none' | 'hr' | 'pace' | 'elevation';
}

const STYLE_DARK = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'esri-tiles',
      type: 'raster' as const,
      source: 'esri',
      minzoom: 0,
      maxzoom: 16,
    },
  ],
};

export const GpsMapView: React.FC<Props> = ({
  latlng,
  hr,
  gpsQuality,
  height = 320,
  colorBy = 'none',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    // Читаем настройки слоёв, сохранённые в редакторе.
    // Если там пусто — используем дефолтный стиль Eclipse.
    const savedLayers = getSavedLayers();
    const hasCustomLayers = savedLayers && savedLayers.length > 0;
    
    // Если хочешь, чтобы по умолчанию (без настроек редактора) был Eclipse,
    // а с настройками — твой кастомный OSM, делаем так:
    const initialStyle = hasCustomLayers 
      ? getOsmStyleObject(savedLayers) 
      : 'https://tiles.versatiles.org/styles/eclipse/style.json';

    const map = new MapLibreMap({
      container: containerRef.current,
      style: initialStyle, // <-- теперь используется динамический стиль
      center: [37.618423, 55.751244],
      zoom: 12,
      attributionControl: { compact: true },
    });

    map.addControl(
      new NavigationControl({ showCompass: false }),
      'top-right'
    );

    map.setMissingStyleImageResolver((id: string) => {
      if (!map.hasImage(id)) {
        map.addImage(id, {
          width: 1,
          height: 1,
          data: new Uint8Array(4),
        } as any);
      }
    });
    
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      if (map.getLayer('track')) map.removeLayer('track');
      if (map.getSource('track')) map.removeSource('track');

      const valid = latlng.filter(
        (p): p is [number, number] => p != null
      );

      if (gpsQuality === 'lost' || valid.length < 2) return;

      const coords = valid.map(([lat, lng]) => [lng, lat]);

      map.addSource('track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });

      map.addLayer({
        id: 'track',
        type: 'line',
        source: 'track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#d4a373',
          'line-width': 3,
          'line-opacity': gpsQuality === 'poor' ? 0.7 : 1,
        },
      });

      const bounds = coords.reduce(
        (b, c) =>
          b.extend(c as [number, number]),
        new LngLatBounds(
          coords[0] as [number, number],
          coords[0] as [number, number]
        )
      );
      map.fitBounds(bounds, { padding: 30, duration: 0 });

      const start = coords[0];
      const end = coords[coords.length - 1];

      new Marker({ color: '#6fbf73' })
        .setLngLat(start as [number, number])
        .addTo(map);
      new Marker({ color: '#ec3942' })
        .setLngLat(end as [number, number])
        .addTo(map);
    };

    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latlng, gpsQuality]);

  if (gpsQuality === 'lost') {
    return (
      <div className="pb-map pb-map--lost" style={{ height }}>
        <i className="pi pi-map" />
        <div>Трек недоступен</div>
        <small>GPS потерян на всей тренировке</small>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pb-map"
      style={{ height }}
    />
  );
};