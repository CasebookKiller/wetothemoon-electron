// src/main/services/pranaBindu/mentat/graph/schema.ts
//
// Формат JSON-файла графа.

import { DifficultyBand } from './ontology';

export interface GraphJson {
  id: string;
  label: string;
  labelRu?: string;
  patterns: PatternJson[];
  catalogs: CatalogJson[];
  canonicals: CanonicalJson[];
  nodes: NodeJson[];
  edges: EdgeJson[];
  programs: ProgramJson[];
}

export interface PatternJson {
  id: string;
  label: string;
  labelRu?: string;
  pos?: { x: number; y: number };   // ← новое
}

export interface CatalogJson {
  id: string;
  label: string;
  labelRu?: string;
  pos?: { x: number; y: number };   // ← новое
}

export interface CanonicalJson {
  id: string;
  label: string;
  labelRu?: string;
  pattern: string | null;
  secondaryPattern?: string | null;
  catalog: string;
  icuName?: string;
  isStatic?: boolean;
  graphKey?: string;
  iconKey?: string;
  pos?: { x: number; y: number };   // ← новое
}

export interface NodeJson {
  id: string;
  canonical: string;
  level?: number;
  label: string;
  labelRu?: string;
  benchmark?: string[];
  /** Упражнение выполняется отдельно на каждую сторону (L и R). */
  perSide?: boolean;
  tags?: string[];
  icuName?: string;
  /** Thenics-band (1..4). Независим от `level`, кодирует метку Thenics. */
  band?: DifficultyBand;
  /** Позиция на канвасе. Сохраняется, когда пользователь таскал узел. */
  pos?: { x: number; y: number };
  /** Перебивает iconKey родительского canonical. */
  iconKey?: string;
}

export interface EdgeJson {
  from: string;
  to: string;
  kind?: string;
  note?: string;
}

export interface ProgramJson {
  id: string;
  label: string;
  labelRu?: string;
  category: string;
  canonicals: string[];
  pos?: { x: number; y: number };   // ← новое
}