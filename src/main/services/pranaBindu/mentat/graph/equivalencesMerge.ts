// src/main/services/pranaBindu/mentat/graph/equivalencesMerge.ts
//
// Объединяет seed (EQUIVALENCES) и DB (Melange equivalences) в плоские пары.
// Определяет для thenics-элемента: linked (подтверждено в DB) /
// candidate (seed или key-match, требует подтверждения) / active.

import { EQUIVALENCES } from '../equivalences';
import type { Equivalence } from '../../melange/repositories/equivalencesRepo';

export interface Pair {
  source: string;
  sourceKey: string;
  sourceLevel: string | null;
  target: string;
  targetKey: string;
  targetLevel: string | null;
  confidence: string;
}

/** Seed (EQUIVALENCES.ts) → плоские пары thenics↔target. */
export function seedToPairs(): Pair[] {
  const pairs: Pair[] = [];
  for (const eq of EQUIVALENCES) {
    const refs = Object.entries(eq.refs).filter(([, r]) => r);
    const thenicsRef = refs.find(([k]) => k === 'thenics');
    if (!thenicsRef) continue;
    const tKey = thenicsRef[1]!.key;
    for (const [cat, ref] of refs) {
      if (cat === 'thenics' || !ref) continue;
      pairs.push({
        source: 'thenics',
        sourceKey: tKey,
        sourceLevel: null,
        target: cat,
        targetKey: ref.key,
        targetLevel: ref.level != null ? String(ref.level) : null,
        confidence: 'seed',
      });
    }
  }
  return pairs;
}

/** Melange equivalences → плоские пары. */
export function dbToPairs(items: Equivalence[]): Pair[] {
  return items.map((e) => ({
    source: e.source,
    sourceKey: e.sourceKey,
    sourceLevel: e.sourceLevel,
    target: e.target,
    targetKey: e.targetKey,
    targetLevel: e.targetLevel,
    confidence: e.confidence,
  }));
}

/** graph-id узла, соответствующего target-части пары. */
export function pairToGraphId(pair: Pair): string {
  if (pair.targetLevel != null) {
    return `ex:${pair.target}:${pair.targetKey}:${pair.targetLevel}`;
  }
  return `ex:${pair.target}:${pair.targetKey}`;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_\s]/g, '');
}

/** Нормализованный ключ → [graphId] существующих канонов. */
export function buildKeyIndex(graph: {
  canonicals: Array<{ id: string; graphKey?: string; catalog: string }>;
}): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  const push = (k: string, gid: string) => {
    const nk = normalize(k);
    if (!idx.has(nk)) idx.set(nk, []);
    idx.get(nk)!.push(gid);
  };
  for (const c of graph.canonicals) {
    const gid = `ex:canonical:${c.id}`;
    push(c.id, gid);
    if (c.graphKey) push(c.graphKey, gid);
  }
  return idx;
}

export interface ThenicsStatus {
  /** Пары из DB, уже подтверждённые пользователем. */
  linked: Pair[];
  /** Пары из seed или найденные по key-match. Требуют подтверждения. */
  candidates: Pair[];
}

export function findThenicsStatus(
  thenicsKey: string,
  thenicsLevel: string | undefined,
  dbPairs: Pair[],
  seedPairs: Pair[],
  existingGraphIds: Set<string>,
  keyIndex: Map<string, string[]>,
): ThenicsStatus {
  const linked: Pair[] = [];
  const candidates: Pair[] = [];

  // Отклонённые пары — куда больше не смотреть
  const rejected = new Set<string>();
  for (const p of dbPairs) {
    if (
      p.confidence === 'negative' &&
      p.source === 'thenics' &&
      p.sourceKey === thenicsKey
    ) {
      rejected.add(
        `${p.target}:${p.targetKey}:${p.targetLevel ?? ''}`,
      );
    }
  }

  const isInGraph = (p: Pair) => existingGraphIds.has(pairToGraphId(p));
  const keyOf = (p: Pair) =>
    `${p.target}:${p.targetKey}:${p.targetLevel ?? ''}`;

  // 1. DB — positives
  for (const p of dbPairs) {
    if (p.source !== 'thenics' || p.sourceKey !== thenicsKey) continue;
    if (p.confidence === 'negative') continue;
    if (rejected.has(keyOf(p))) continue;
    if (isInGraph(p)) linked.push(p);
  }

  // 2. Seed — candidates, если не в rejected и не в linked
  const linkedKeys = new Set(linked.map(keyOf));
  for (const p of seedPairs) {
    if (p.source !== 'thenics' || p.sourceKey !== thenicsKey) continue;
    const k = keyOf(p);
    if (linkedKeys.has(k)) continue;
    if (rejected.has(k)) continue;
    if (!isInGraph(p)) continue;
    candidates.push(p);
  }

   // 3. Key-match — если seed и DB не дали ничего
   if (candidates.length === 0 && linked.length === 0) {
     const nk = normalize(thenicsKey);
     const gids = keyIndex.get(nk) ?? [];
     for (const gid of gids) {
       if (!existingGraphIds.has(gid)) continue;

      // gid вида `ex:canonical:<key>` не несёт каталог. Если пропустить
      // его дальше, target становится строкой 'canonical', в UI уезжает
      // «≈ CANONICAL», а при подтверждении в БД уходит мусорная строка.
      // Связь с каноном должна быть явной в EQUIVALENCES.
      if (gid.startsWith('ex:canonical:')) continue;

       const parts = gid.split(':');
      if (parts.length < 4) continue;
      const [, catalog, key, levelStr] = parts;
      if (rejected.has(`${catalog}:${key}:${levelStr}`)) continue;
       candidates.push({
         source: 'thenics',
         sourceKey: thenicsKey,
         sourceLevel: thenicsLevel ?? null,
        target: catalog,
        targetKey: key,
        targetLevel: levelStr,
         confidence: 'auto',
       });
     }
   }

  return { linked, candidates };
}