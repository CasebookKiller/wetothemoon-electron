// src/components/PRANA_BINDU/UTILS/chartColors.ts
//
// Цвета каналов для мульти-графиков (ICU-style).
// Хранятся в localStorage, дефолты — ICU-палитра.

export interface ChannelColorSet {
  hr: string;
  pace: string;
  cadence: string;
  elevation: string;
  power: string;
}

/**
 * Дефолтные цвета из intervals.icu (которые тебе нравятся).
 */
export const ICU_DEFAULT_COLORS: ChannelColorSet = {
  hr: '#ff4444',
  pace: '#74ecff',
  cadence: '#ff40ff',
  elevation: '#ffffff',
  power: '#ffb800',
};

/**
 * Опциональный PB-стиль (если захочешь переключиться).
 */
export const PB_STYLE_COLORS: ChannelColorSet = {
  hr: '#ff4444',
  pace: '#6ab2f2',
  cadence: '#ff40ff',
  elevation: '#d4a373',
  power: '#ffb800',
};

const KEY = 'pb.chartColors';

export function getSavedChartColors(): ChannelColorSet {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...ICU_DEFAULT_COLORS };
    const parsed = JSON.parse(raw);
    return { ...ICU_DEFAULT_COLORS, ...parsed };
  } catch {
    return { ...ICU_DEFAULT_COLORS };
  }
}

export function saveChartColors(c: ChannelColorSet): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function resetChartColors(): ChannelColorSet {
  const def = { ...ICU_DEFAULT_COLORS };
  saveChartColors(def);
  return def;
}