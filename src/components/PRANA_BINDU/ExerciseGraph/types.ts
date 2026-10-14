// src/components/PRANA_BINDU/ExerciseGraph/types.ts

export type NodeRole =
  | 'pattern'
  | 'canonical'
  | 'concrete'
  | 'program'
  | 'catalog'
  | 'modality'
  | 'tissue'
  | 'skill';

export interface Filters {
  catalogs: Set<string>;
  patterns: Set<string>;
  showConcrete: boolean;
  showNamed: boolean;
  showThenics: boolean;
  onlyWithProgression: boolean;
  search: string;
}

export const EMPTY_FILTERS: Filters = {
  catalogs: new Set(),
  patterns: new Set(),
  showConcrete: false,
  showNamed: false,
  showThenics: false,
  onlyWithProgression: false,
  search: '',
};

/**
 * Буквенная метка типа движения.
 * Используется в footer'е узла, пока нет кастомных SVG.
 * Позже можно заменить на иконки, сохранив ключ.
 */
export type ExerciseIconKey =
  // Верх тела
  | 'PU' | 'PL' | 'RW' | 'SA'
  // Низ тела
  | 'SQ' | 'HG' | 'AK'
  // Кор
  | 'LR' | 'BR' | 'CA'
  // Специальные
  | 'HS' | 'BL' | 'LC' | 'DR' | 'PLY' | 'MOB' | 'CF'
  // Prehab
  | 'KN' | 'HP' | 'SPN' | 'SH';

/** Задел на статистику. Пока не заполняется. */
export interface NodeStats {
  sessionsCount?: number;
  totalReps?: number;
  totalTimeSec?: number;
  maxReps?: number;
  lastDoneAt?: string;
}

export interface ViewNodeData {
  id: string;
  role: NodeRole;
  depth: number;

  label: string;
  labelRu?: string;

  pattern?: string;
  catalog?: string;
  level?: number;
  isStatic?: boolean;

  /** Бейдж справа в header: 'W5', 'L3'. Для concrete с perSide — 'W5 · L/R'. */
  badge?: string;

  /** Буквенная метка типа движения (PU / PL / …). */
  exerciseIcon?: ExerciseIconKey;

  /** Текст футера: 'N канонов' / 'N уровней' / 'N движений'. */
  footerText?: string;

  /** Для Thenics-узлов: '≈ Wade L5'. */
  approximateTo?: string;

  /** Задел на будущее. */
  stats?: NodeStats;

  /** Иконки паттернов (только для catalog). */
  icons?: string[];

  /** Сохранённая позиция (если пользователь таскал узел). */
  _explicitPos?: { x: number; y: number };

  [key: string]: unknown;
}