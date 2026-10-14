// src/main/services/pranaBindu/mentat/graph/graphQueries.ts
//
// Навигация по Exercise Graph. Чистые функции над ExerciseGraph.
//
// ВАЖНО: GraphNode<P> в ontology не discriminated — kind не литерал.
// Поэтому используем локальные type-alias + касты через `as`.
// Если ontology когда-нибудь станет discriminated union — убрать эти алиасы.

import type {
  ExerciseGraph,
  GraphNode,
  GraphEdge,
  EdgeKind,
  ExerciseProps,
  PatternProps,
  ProgramProps,
  PatternKey,
} from './ontology';

// ==================== Локальные alias'ы ====================

export type ExerciseNode = GraphNode & { kind: 'exercise'; props: ExerciseProps };
export type PatternNode  = GraphNode & { kind: 'pattern';  props: PatternProps  };
export type ProgramNode  = GraphNode & { kind: 'program';  props: ProgramProps  };

// ==================== Базовые индексы ====================

export interface GraphIndex {
  nodeById: Map<string, GraphNode>;
  outgoing: Map<string, GraphEdge[]>;
  incoming: Map<string, GraphEdge[]>;
}

export function indexGraph(graph: ExerciseGraph): GraphIndex {
  const nodeById = new Map<string, GraphNode>();
  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();

  for (const n of graph.nodes) nodeById.set(n.id, n);
  for (const e of graph.edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    outgoing.get(e.source)!.push(e);
    incoming.get(e.target)!.push(e);
  }
  return { nodeById, outgoing, incoming };
}

// ==================== Соседи ====================

export function outNeighbors(
  idx: GraphIndex,
  nodeId: string,
  kind?: EdgeKind,
): string[] {
  const edges = idx.outgoing.get(nodeId) ?? [];
  return edges
    .filter((e) => !kind || e.kind === kind)
    .map((e) => e.target);
}

export function inNeighbors(
  idx: GraphIndex,
  nodeId: string,
  kind?: EdgeKind,
): string[] {
  const edges = idx.incoming.get(nodeId) ?? [];
  return edges
    .filter((e) => !kind || e.kind === kind)
    .map((e) => e.source);
}

// ==================== Exercise helpers ====================

export function isExercise(n: GraphNode | undefined): n is ExerciseNode {
  return !!n && n.kind === 'exercise';
}

export function isCanonical(n: GraphNode | undefined): boolean {
  return isExercise(n) && (n.props as ExerciseProps).isCanonical === true;
}

export function isConcrete(n: GraphNode | undefined): boolean {
  return isExercise(n) && (n.props as ExerciseProps).isCanonical === false;
}

/** Канон узла (concrete → canonical). Для canonical — сам себя. */
export function getCanonical(
  idx: GraphIndex,
  nodeId: string,
): ExerciseNode | undefined {
  const n = idx.nodeById.get(nodeId);
  if (!n || n.kind !== 'exercise') return undefined;
  const en = n as ExerciseNode;
  if (en.props.isCanonical) return en;

  const targets = outNeighbors(idx, nodeId, 'instance-of');
  for (const t of targets) {
    const tn = idx.nodeById.get(t);
    if (!tn || tn.kind !== 'exercise') continue;
    const ten = tn as ExerciseNode;
    if (ten.props.isCanonical) return ten;
  }
  return undefined;
}

/** Все concrete, инстансы канона. */
export function getConcretes(
  idx: GraphIndex,
  canonicalId: string,
): ExerciseNode[] {
  const sources = inNeighbors(idx, canonicalId, 'instance-of');
  const result: ExerciseNode[] = [];
  for (const s of sources) {
    const n = idx.nodeById.get(s);
    if (n && n.kind === 'exercise' && !(n as ExerciseNode).props.isCanonical) {
      result.push(n as ExerciseNode);
    }
  }
  return result;
}

/** Паттерн(ы) канона. Может быть 1 + secondary. */
export function getPatterns(
  idx: GraphIndex,
  canonicalId: string,
): PatternKey[] {
  const targets = outNeighbors(idx, canonicalId, 'instance-of');
  const result: PatternKey[] = [];
  for (const t of targets) {
    const tn = idx.nodeById.get(t);
    if (tn && tn.kind === 'pattern') {
      result.push((tn as PatternNode).props.key);
    }
  }
  return result;
}

/** Эквиваленты — все соседи по `equivalent-to`. */
export function getEquivalents(
  idx: GraphIndex,
  nodeId: string,
): GraphNode[] {
  const out = outNeighbors(idx, nodeId, 'equivalent-to');
  const inc = inNeighbors(idx, nodeId, 'equivalent-to');
  const ids = new Set<string>([...out, ...inc]);
  const result: GraphNode[] = [];
  for (const id of ids) {
    const n = idx.nodeById.get(id);
    if (n) result.push(n);
  }
  return result;
}

/** Программы, использующие узел (canonical / named). */
export function getProgramsUsing(
  idx: GraphIndex,
  nodeId: string,
): ProgramNode[] {
  const targets = outNeighbors(idx, nodeId, 'used-in');
  const result: ProgramNode[] = [];
  for (const t of targets) {
    const tn = idx.nodeById.get(t);
    if (tn && tn.kind === 'program') result.push(tn as ProgramNode);
  }
  return result;
}

/** Concrete + программы его канона. */
export function getProgramsForConcrete(
  idx: GraphIndex,
  concreteId: string,
): ProgramNode[] {
  const canonical = getCanonical(idx, concreteId);
  if (!canonical) return [];
  return getProgramsUsing(idx, canonical.id);
}

// ==================== Поиск ====================

export interface SearchOptions {
  kind?: GraphNode['kind'];
  catalog?: string;
  limit?: number;
}

export function searchByName(
  idx: GraphIndex,
  query: string,
  opts: SearchOptions = {},
): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const limit = opts.limit ?? 50;
  const result: GraphNode[] = [];

  for (const n of idx.nodeById.values()) {
    if (opts.kind && n.kind !== opts.kind) continue;
    const props = n.props as { label?: string; labelRu?: string };
    const label = (props.label ?? '').toLowerCase();
    const labelRu = (props.labelRu ?? '').toLowerCase();
    if (label.includes(q) || labelRu.includes(q)) {
      if (opts.catalog && n.kind === 'exercise') {
        const p = n.props as ExerciseProps;
        if (p.catalog !== opts.catalog) continue;
      }
      result.push(n);
      if (result.length >= limit) break;
    }
  }
  return result;
}

// ==================== Обходы для UI ====================

export interface PatternSubtree {
  pattern: PatternNode;
  canonicals: Array<{
    canonical: ExerciseNode;
    concretes: ExerciseNode[];
    programs: ProgramNode[];
  }>;
}

export function getPatternSubtree(
  _graph: ExerciseGraph,
  idx: GraphIndex,
  patternKey: PatternKey,
): PatternSubtree | undefined {
  const patId = `pat:${patternKey}`;
  const patNode = idx.nodeById.get(patId);
  if (!patNode || patNode.kind !== 'pattern') return undefined;

  const canonicalIds = inNeighbors(idx, patId, 'instance-of');
  const canonicals: PatternSubtree['canonicals'] = [];

  for (const cid of canonicalIds) {
    const cn = idx.nodeById.get(cid);
    if (!cn || cn.kind !== 'exercise') continue;
    const en = cn as ExerciseNode;
    if (!en.props.isCanonical) continue;
    canonicals.push({
      canonical: en,
      concretes: getConcretes(idx, cid),
      programs: getProgramsUsing(idx, cid),
    });
  }
  return { pattern: patNode as PatternNode, canonicals };
}

export interface ExercisePath {
  concrete: ExerciseNode | null;
  canonical: ExerciseNode | null;
  patterns: PatternNode[];
}

export function getExercisePath(
  idx: GraphIndex,
  nodeId: string,
): ExercisePath | undefined {
  const n = idx.nodeById.get(nodeId);
  if (!n || n.kind !== 'exercise') return undefined;
  const en = n as ExerciseNode;

  const patternsOf = (cid: string): PatternNode[] => {
    const keys = getPatterns(idx, cid);
    const out: PatternNode[] = [];
    for (const k of keys) {
      const p = idx.nodeById.get(`pat:${k}`);
      if (p && p.kind === 'pattern') out.push(p as PatternNode);
    }
    return out;
  };

  if (en.props.isCanonical) {
    return { concrete: null, canonical: en, patterns: patternsOf(nodeId) };
  }

  const canonical = getCanonical(idx, nodeId) ?? null;
  return {
    concrete: en,
    canonical,
    patterns: canonical ? patternsOf(canonical.id) : [],
  };
}

export function summarizeGraph(
  graph: ExerciseGraph,
  _idx: GraphIndex,
): {
  nodes: number;
  edges: number;
  patterns: number;
  canonicals: number;
  concretes: number;
  programs: number;
  byCatalog: Record<string, number>;
} {
  let canonicals = 0;
  let concretes = 0;
  const byCatalog: Record<string, number> = {};

  for (const n of graph.nodes) {
    if (n.kind !== 'exercise') continue;
    const p = n.props as ExerciseProps;
    if (p.isCanonical) canonicals++;
    else {
      concretes++;
      byCatalog[p.catalog] = (byCatalog[p.catalog] ?? 0) + 1;
    }
  }
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    patterns: graph.nodes.filter((n) => n.kind === 'pattern').length,
    canonicals,
    concretes,
    programs: graph.nodes.filter((n) => n.kind === 'program').length,
    byCatalog,
  };
}

export interface EquivalenceGroup {
  members: ExerciseNode[];
  canonicals: Set<string>;
}

export function getEquivalenceGroup(
  idx: GraphIndex,
  startId: string,
): EquivalenceGroup {
  const visited = new Set<string>();
  const queue = [startId];
  const members: ExerciseNode[] = [];
  const canonicals = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const n = idx.nodeById.get(id);
    if (!n) continue;
    if (n.kind === 'exercise') {
      members.push(n as ExerciseNode);
      const c = getCanonical(idx, id);
      if (c) canonicals.add(c.id);
    }
    for (const nb of getEquivalents(idx, id)) {
      if (!visited.has(nb.id)) queue.push(nb.id);
    }
  }
  return { members, canonicals };
}