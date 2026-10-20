import type { StyleSpecification } from 'maplibre-gl';

export interface RasterLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  brightnessMin: number;
  brightnessMax: number;
  saturation: number;
  contrast: number;
  hueRotate: number;
}

export const DEFAULT_LAYERS: RasterLayer[] = [
  {
    id: 'layer-base',
    name: 'Базовый (Тёмный)',
    visible: true,
    opacity: 1,
    brightnessMin: 0.1,
    brightnessMax: 0.4,
    saturation: -0.8,
    contrast: 0.2,
    hueRotate: 0,
  },
  {
    id: 'layer-overlay',
    name: 'Оверлей (Цвет)',
    visible: false,
    opacity: 0.3,
    brightnessMin: 0.8,
    brightnessMax: 0.2,
    saturation: 0.8,
    contrast: -0.2,
    hueRotate: 180,
  },
];

export function getSavedLayers(): RasterLayer[] {
  try {
    const saved = localStorage.getItem('pb.mapLayers');
    return saved ? JSON.parse(saved) : DEFAULT_LAYERS;
  } catch {
    return DEFAULT_LAYERS;
  }
}

export function saveLayers(layers: RasterLayer[]) {
  localStorage.setItem('pb.mapLayers', JSON.stringify(layers));
}

export function getOsmStyleObject(layers: RasterLayer[]): StyleSpecification {
  const mapLayers: any[] = layers.map((l) => ({
    id: l.id,
    type: 'raster',
    source: 'osm-source',
    layout: { visibility: l.visible ? 'visible' : 'none' },
    paint: {
      'raster-opacity': l.opacity,
      'raster-brightness-min': l.brightnessMin,
      'raster-brightness-max': l.brightnessMax,
      'raster-saturation': l.saturation,
      'raster-contrast': l.contrast,
      'raster-hue-rotate': l.hueRotate,
    },
  }));

  return {
    version: 8,
    sources: {
      'osm-source': {
        type: 'raster',
        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: mapLayers,
  };
}

export interface TrackSettings {
  color: string;
  width: number;
  opacity: number;
  glow: boolean;
}

export const DEFAULT_TRACK_SETTINGS: TrackSettings = {
  color: '#d4a373',
  width: 4,
  opacity: 1,
  glow: true, // свечение под линией
};

export function getSavedTrackSettings(): TrackSettings {
  try {
    const saved = localStorage.getItem('pb.trackSettings');
    return saved ? JSON.parse(saved) : DEFAULT_TRACK_SETTINGS;
  } catch {
    return DEFAULT_TRACK_SETTINGS;
  }
}

export function saveTrackSettings(settings: TrackSettings) {
  localStorage.setItem('pb.trackSettings', JSON.stringify(settings));
}