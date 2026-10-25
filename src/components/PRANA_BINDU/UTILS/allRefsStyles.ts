// src/components/PRANA_BINDU/UTILS/allRefsStyles.ts
//
// Стили эталонов в режиме «Показать все эталоны» (B.5).
// Хранятся в localStorage, применяются на карте.

export interface RefLineStyle {
  color: string;
  width: number;
  opacity: number;
  dashed: boolean;
}

export interface AllRefsStyles {
  used: RefLineStyle;
  similar: RefLineStyle;
  unused: RefLineStyle;
}

export const DEFAULT_ALL_REFS_STYLES: AllRefsStyles = {
  used: { color: '#6ab2f2', width: 4, opacity: 0.9, dashed: false },
  similar: { color: '#e8a838', width: 3, opacity: 0.85, dashed: true },
  unused: { color: '#8a8a8a', width: 2, opacity: 0.6, dashed: true },
};

const KEY = 'pb.allRefsStyles';

export function getSavedAllRefsStyles(): AllRefsStyles {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_ALL_REFS_STYLES));
    const parsed = JSON.parse(raw);
    return {
      used: { ...DEFAULT_ALL_REFS_STYLES.used, ...(parsed.used || {}) },
      similar: { ...DEFAULT_ALL_REFS_STYLES.similar, ...(parsed.similar || {}) },
      unused: { ...DEFAULT_ALL_REFS_STYLES.unused, ...(parsed.unused || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_ALL_REFS_STYLES));
  }
}

export function saveAllRefsStyles(s: AllRefsStyles): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}