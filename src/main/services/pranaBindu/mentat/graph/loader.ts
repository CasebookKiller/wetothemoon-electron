// src/main/services/pranaBindu/mentat/graph/loader.ts
//
// Загрузка GraphJson → GraphNode[] + GraphEdge[].

import type {
  GraphJson,
  CanonicalJson,
  NodeJson,
  EdgeJson,
} from './schema';
import type {
  GraphNode,
  GraphEdge,
  EdgeKind,
  ExerciseProps,
  PatternProps,
  CatalogProps,
  ProgramProps,
} from './ontology';
import {
  patternId,
  canonicalExerciseId,
  concreteExerciseId,
  catalogId,
  programId,
} from './ontology';

export class GraphLoadError extends Error {
  constructor(graphId: string, msg: string) {
    super(`[graph:${graphId}] ${msg}`);
    this.name = 'GraphLoadError';
  }
}

export interface LoadedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function loadGraph(json: GraphJson): LoadedGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenNodeIds = new Set<string>();
  const seenEdgeIds = new Set<string>();

  const pushNode = (n: GraphNode): void => {
    if (seenNodeIds.has(n.id)) return;
    seenNodeIds.add(n.id);
    nodes.push(n);
  };
  const pushEdge = (
    kind: EdgeKind,
    source: string,
    target: string,
    props?: Record<string, unknown>,
  ): void => {
    const id = `${kind}:${source}->${target}`;
    if (seenEdgeIds.has(id)) return;
    seenEdgeIds.add(id);
    edges.push({ id, kind, source, target, props });
  };

  // ---------- 1. Patterns ----------
  for (const p of json.patterns) {
    pushNode({
      id: patternId(p.id),
      kind: 'pattern',
      props: {
        kind: 'pattern',
        key: p.id as PatternProps['key'],
        label: p.label,
        labelRu: p.labelRu,
        pos: p.pos,
      } as PatternProps,
    });
  }

  // ---------- 2. Catalogs ----------
  for (const c of json.catalogs) {
    pushNode({
      id: catalogId(c.id),
      kind: 'catalog',
      props: {
        kind: 'catalog',
        id: c.id as CatalogProps['id'],
        label: c.label,
        labelRu: c.labelRu,
        pos: c.pos,
      } as CatalogProps,
    });
  }

  // ---------- 3. Canonicals ----------
  const canonById = new Map<string, CanonicalJson>();
  for (const c of json.canonicals) {
    canonById.set(c.id, c);
    const gid = canonicalExerciseId(c.id);

    pushNode({
      id: gid,
      kind: 'exercise',
      props: {
        kind: 'exercise',
        key: c.id,
        label: c.label,
        labelRu: c.labelRu,
        catalog: c.catalog as ExerciseProps['catalog'],
        isCanonical: true,
        isStatic: c.isStatic ?? false,
        icuName: c.icuName,
        iconKey: c.iconKey,
        pattern: c.pattern ?? undefined,
        pos: c.pos,
      } as ExerciseProps,
    });

    if (c.pattern) {
      pushEdge('instance-of', gid, patternId(c.pattern));
    }
    pushEdge('belongs-to', gid, catalogId(c.catalog));
  }

  // ---------- 4. Concrete nodes ----------
  const nodeGraphId = new Map<string, string>();
  for (const n of json.nodes) {
    const canon = canonById.get(n.canonical);
    if (!canon) {
      throw new GraphLoadError(
        json.id,
        `node '${n.id}' ссылается на несуществующий canonical '${n.canonical}'`,
      );
    }
    const graphKey = canon.graphKey ?? canon.id;
    const gid = concreteExerciseId(canon.catalog, graphKey, n.level, n.id);
    nodeGraphId.set(n.id, gid);

    pushNode({
      id: gid,
      kind: 'exercise',
      props: {
        kind: 'exercise',
        key: n.id,
        label: n.label,
        labelRu: n.labelRu,
        catalog: canon.catalog as ExerciseProps['catalog'],
        level: n.level,
        isCanonical: false,
        icuName: n.icuName ?? canon.icuName,
        categories: n.tags,
        perSide: n.perSide ?? false,
        benchmark: n.benchmark,
        iconKey: n.iconKey ?? canon.iconKey,
        pattern: canon.pattern ?? undefined,
        band: n.band,
        pos: n.pos,
      } as ExerciseProps,
    });
    pushEdge('belongs-to', gid, catalogId(canon.catalog));
    pushEdge('instance-of', gid, canonicalExerciseId(n.canonical));
  }

  // ---------- 5. Edges ----------
  const resolveRef = (ref: string): string | null => {
    if (ref.startsWith('@canonical:')) {
      return canonicalExerciseId(ref.slice(11));
    }
    if (ref.startsWith('@pattern:')) {
      return patternId(ref.slice(9));
    }
    if (ref.startsWith('@catalog:')) {
      return catalogId(ref.slice(9));
    }
    if (ref.startsWith('@concrete:')) {
      // @concrete:<catalog>:<graphKey>:<level>
      const rest = ref.slice(10); // "wade:pushup:5"
      const m = rest.match(/^([^:]+):([^:]+):(\d+)$/);
      if (!m) return null;
      const [, catalog, graphKey, levelStr] = m;
      return concreteExerciseId(catalog, graphKey, Number(levelStr));
    }
    // Локальная ссылка по node.id
    return nodeGraphId.get(ref) ?? null;
  };

  for (const e of json.edges) {
    const from = resolveRef(e.from);
    const to = resolveRef(e.to);
    if (!from || !to) {
      throw new GraphLoadError(
        json.id,
        `edge ${e.from} → ${e.to} не разрешается`,
      );
    }
    pushEdge(
      (e.kind ?? 'progresses-to') as EdgeKind,
      from,
      to,
      e.note ? { note: e.note } : undefined,
    );
  }

  // ---------- 6. Programs ----------
  for (const p of json.programs) {
    const gid = programId(p.id);
    pushNode({
      id: gid,
      kind: 'program',
      props: {
        kind: 'program',
        key: p.id,
        label: p.label,
        labelRu: p.labelRu,
        category: p.category,
        pos: p.pos,
      } as ProgramProps,
    });

    for (const canonKey of p.canonicals) {
      const canon = canonById.get(canonKey);
      if (!canon) continue;
      pushEdge('used-in', canonicalExerciseId(canonKey), gid);
    }
  }

  return { nodes, edges };
}