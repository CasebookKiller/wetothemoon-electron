// src/main/services/pranaBindu/mentat/graph/sources.ts
//
// Каталог "кубиков" для палитры edit mode. Read-only.
// WADE_SEED читаем напрямую. Thenics — как внешний справочник.

import { THENICS_CATALOG } from '../thenicsCatalog';
import { WADE_SEED } from './data';
import type { GraphJson } from './schema';
import { canonicalExerciseId } from './ontology';

export interface PaletteItem {
  /** Уникальный id для UI. */
  id: string;
  /** Что это: canonical / concrete / external. */
  kind: 'canonical' | 'concrete' | 'external';
  label: string;
  labelRu?: string;
  /** Доп. метаданные для показа. */
  meta?: string;
  /** Graph-id, если этот item попадёт в граф. Используется для проверки дублей. */
  graphId?: string;
    /** Заполняется в IPC-хендлере: true, если уже есть в графе. */
  inGraph?: boolean;
  /** Исходный источник. */
  source: 'wade' | 'thenics';
  /** Payload — на будущее для добавления в граф. */
  existingGraphId?: string;
  existingShort?: string;
  existingLabel?: string;
  /** Заполняется в IPC: три состояния для UI. */
  state?: 'active' | 'linked' | 'candidate';
  /** Пара для confirm-диалога (только для state='candidate'). */
  candidate?: {
    source: string;
    sourceKey: string;
    sourceLevel: string | null;
    target: string;
    targetKey: string;
    targetLevel: string | null;
  };
  payload: Record<string, unknown>;
}

export interface PaletteGroup {
  id: string;
  label: string;
  labelRu: string;
  items: PaletteItem[];
}

// ==================== Wade ====================

export function buildWadePalette(graph: GraphJson): PaletteGroup[] {
  const canonicals: PaletteItem[] = graph.canonicals.map((c) => ({
    id: `wade:canonical:${c.id}`,
    kind: 'canonical',
    label: c.label,
    labelRu: c.labelRu,
    meta: `${c.catalog} · ${c.pattern ?? '—'}`,
    source: 'wade',
    graphId: `ex:canonical:${c.id}`,
    payload: c as unknown as Record<string, unknown>,
  }));

  const concretes: PaletteItem[] = graph.nodes.map((n) => {
    const canon = graph.canonicals.find((c) => c.id === n.canonical);
    const graphKey = canon?.graphKey ?? canon?.id ?? n.canonical;
    const graphId = n.level !== undefined
      ? `ex:${canon?.catalog ?? 'wade'}:${graphKey}:${n.level}`
      : `ex:${canon?.catalog ?? 'wade'}:${graphKey}`;
    return {
      id: `wade:concrete:${n.id}`,
      kind: 'concrete',
      label: n.label,
      labelRu: n.labelRu,
      meta: canon ? `${canon.labelRu ?? canon.label} · ур. ${n.level ?? '—'}` : '—',
      source: 'wade',
      graphId,
      payload: n as unknown as Record<string, unknown>,
    };
  });

  return [
    { id: 'wade-canonicals', label: 'Wade · Canonicals', labelRu: 'Wade · Каноны', items: canonicals },
    { id: 'wade-concretes',  label: 'Wade · Levels',     labelRu: 'Wade · Уровни', items: concretes },
  ];
}

// ==================== Thenics ====================

export function buildThenicsPalette(): PaletteGroup {
  const items: PaletteItem[] = THENICS_CATALOG.map((t) => ({
    id: `thenics:${t.key}`,
    kind: 'external',
    label: t.name,
    labelRu: t.nameRu,
    meta: `${t.level}${t.muscles ? ' · ' + t.muscles.slice(0, 2).join(', ') : ''}`,
    graphId: thenicsGraphId(t.key),
    source: 'thenics',
    payload: t as unknown as Record<string, unknown>,
  }));

  return {
    id: 'thenics',
    label: 'Thenics',
    labelRu: 'Thenics',
    items,
  };
}

/** JSON-id, под которым новый Thenics-канон попадёт в user.json. */
export function thenicsJsonId(key: string): string {
  return `thenics-${key}`;
}

/** Graph-id, под которым он появится в графе. */
export function thenicsGraphId(key: string): string {
  return canonicalExerciseId(thenicsJsonId(key));
}

// ==================== Точка входа ====================

export function buildPalette(graph: GraphJson): PaletteGroup[] {
  return [
    ...buildWadePalette(graph),
    buildThenicsPalette(),
  ];
}

