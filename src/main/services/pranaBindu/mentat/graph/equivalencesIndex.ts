// src/main/services/pranaBindu/mentat/graph/equivalencesIndex.ts
//
// Индекс на базе EQUIVALENCES: для thenics-элемента находит
// существующие узлы в графе, эквивалентные ему.

import { EQUIVALENCES, type Equivalence } from '../equivalences';

/** thenics.key → equivalence[] */
const THENICS_INDEX = new Map<string, Equivalence[]>();
for (const eq of EQUIVALENCES) {
  const t = eq.refs.thenics;
  if (t?.key) {
    if (!THENICS_INDEX.has(t.key)) THENICS_INDEX.set(t.key, []);
    THENICS_INDEX.get(t.key)!.push(eq);
  }
}

export interface ThenicsMatch {
  graphId: string;
  where: string;
  label?: string;
  shortCode?: string;
}

export function findThenicsMatches(
  thenicsKey: string,
  existing: Set<string>,
  nodeById: Map<string, { props?: { labelRu?: string; label?: string } }>,
): ThenicsMatch[] {
  const eqs = THENICS_INDEX.get(thenicsKey);
  if (!eqs) return [];

  const out: ThenicsMatch[] = [];
  for (const eq of eqs) {
    for (const [cat, ref] of Object.entries(eq.refs)) {
      if (!ref || cat === 'thenics') continue;
      const gid =
        ref.level !== undefined
          ? `ex:${cat}:${ref.key}:${ref.level}`
          : `ex:${cat}:${ref.key}`;
      if (!existing.has(gid)) continue;

      const node = nodeById.get(gid);
      const label = node?.props?.labelRu ?? node?.props?.label;
      const where =
        ref.level !== undefined ? `${cat} · ур. ${ref.level}` : cat;
      const shortCode =
        ref.level !== undefined ? `${cat.toUpperCase()}-L${ref.level}` : cat;

      out.push({ graphId: gid, where, label, shortCode });
    }
  }
  return out;
}