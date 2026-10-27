// src/components/PRANA_BINDU/UTILS/coverageThresholds.ts
//
// Пороги автоопределения пробежек по атомам (B.1).
// Хранятся в localStorage. Сброс — кнопкой «Сбросить к дефолтам».

export interface CoverageThresholds {
  /** Минимальный coverage для used (%). */
  coverageUsed: number;
  /** Минимальный coverage для similar (%). */
  coverageSimilar: number;
  /** Мин. ratio длины трек/эталон для loop. */
  ratioLoopMin: number;
  /** Мин. ratio длины трек/эталон для linear. */
  ratioLinearMin: number;
  /** Макс. ratio длины трек/эталон для linear. */
  ratioLinearMax: number;
  /** Макс. медиана отклонения от эталона (м). */
  medianMaxM: number;
  /** Радиус (м) для расчета покрытия эталона (coveragePct). */
  coverageRadiusM: number;
  /** Радиус (м) для расчета метров на эталоне (metersOnRef). */
  onRefRadiusM: number;
  /** Количество контрольных точек для подсчёта поворотов (3..12). */
  checkpointCount: number;
}

export const DEFAULT_COVERAGE_THRESHOLDS: CoverageThresholds = {
  coverageUsed: 70,
  coverageSimilar: 40,
  ratioLoopMin: 0.9,
  ratioLinearMin: 0.75,
  ratioLinearMax: 1.25,
  medianMaxM: 100,
  coverageRadiusM: 20,
  onRefRadiusM: 50,
  // 6 КП вместо захардкоженных 4: для сложных маршрутов с детурами
  // (круг с лестницами, восьмёрка) медиана по 6 точкам точнее.
  checkpointCount: 6,
};

const KEY = 'pb.coverageThresholds';

export function getSavedCoverageThresholds(): CoverageThresholds {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_COVERAGE_THRESHOLDS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_COVERAGE_THRESHOLDS };
    }
    // Merge с дефолтами — чтобы новые поля автоматически подхватились
    // (например, checkpointCount появился позже, чем первые сохранения).
    return { ...DEFAULT_COVERAGE_THRESHOLDS, ...parsed };
  } catch {
    return { ...DEFAULT_COVERAGE_THRESHOLDS };
  }
}

export function saveCoverageThresholds(t: CoverageThresholds): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}