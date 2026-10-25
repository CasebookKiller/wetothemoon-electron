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
  visible: boolean;
}

export const DEFAULT_TRACK_SETTINGS: TrackSettings = {
  color: '#d4a373',
  width: 4,
  opacity: 1,
  glow: true,
  visible: true,
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

// ==================== Градиент трека по данным ====================

export type GradientChannel = 'none' | 'hr' | 'speedKmh' | 'elevationM' | 'cadence';

export interface GradientSettings {
  channel: GradientChannel;
  palette: string;
}

export const DEFAULT_GRADIENT: GradientSettings = {
  channel: 'none',
  palette: 'hr-zones',
};

export interface PaletteStop {
  v: number;
  c: string;
}

export interface Palette {
  label: string;
  /** Если true — stops.v используются как есть. Если false — normalized 0..1. */
  absolute?: boolean;
  /** Ограничение палитры по каналам (hr-зоны только для пульса). */
  channels?: GradientChannel[];
  stops: PaletteStop[];
}

export const PALETTES: Record<string, Palette> = {
  'hr-zones': {
    label: 'Пульс (зоны)',
    absolute: true,
    channels: ['hr'],
    stops: [
      { v: 100, c: '#4fc3f7' },
      { v: 125, c: '#81c784' },
      { v: 145, c: '#ffd54f' },
      { v: 160, c: '#ff9800' },
      { v: 185, c: '#e53935' },
    ],
  },
  thermal: {
    label: 'Термо (синий→красный)',
    stops: [
      { v: 0, c: '#313695' },
      { v: 0.25, c: '#4575b4' },
      { v: 0.5, c: '#ffffbf' },
      { v: 0.75, c: '#f46d43' },
      { v: 1, c: '#a50026' },
    ],
  },
  viridis: {
    label: 'Viridis',
    stops: [
      { v: 0, c: '#440154' },
      { v: 0.25, c: '#3b528b' },
      { v: 0.5, c: '#21918c' },
      { v: 0.75, c: '#5ec962' },
      { v: 1, c: '#fde725' },
    ],
  },
  'accent-glow': {
    label: 'Prana-Bindu (accent)',
    stops: [
      { v: 0, c: '#4a3520' },
      { v: 0.5, c: '#8a6a3a' },
      { v: 1, c: '#d4a373' },
    ],
  },
};

export function getSavedGradient(): GradientSettings {
  try {
    const saved = localStorage.getItem('pb.trackGradient');
    return saved ? JSON.parse(saved) : DEFAULT_GRADIENT;
  } catch {
    return DEFAULT_GRADIENT;
  }
}

export function saveGradient(g: GradientSettings) {
  localStorage.setItem('pb.trackGradient', JSON.stringify(g));
}

/**
 * Перехватывает запросы тайлов OSM и перенаправляет их
 * на Electron-протокол pb-tile://, чтобы работал дисковый кеш.
 */
export function tileTransformRequest(url: string, resourceType: string) {
  if (resourceType === 'Tile' && url.includes('openstreetmap.org')) {
    return { url: url.replace('https://', 'pb-tile://') };
  }
  return { url };
}