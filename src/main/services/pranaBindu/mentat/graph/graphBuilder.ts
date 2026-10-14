// src/main/services/pranaBindu/mentat/graph/graphBuilder.ts

import type { GraphJson } from './schema';
import { loadGraph } from './loader';
import type { ExerciseGraph, GraphNode, GraphEdge } from './ontology';

export function buildExerciseGraph(graphs: GraphJson[]): ExerciseGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const g of graphs) {
    const parts = loadGraph(g);
    nodes.push(...parts.nodes);
    edges.push(...parts.edges);
  }

  return { nodes, edges };
}

export interface GraphAudit {
  totalNodes: number;
  totalEdges: number;
  nodesByKind: Partial<Record<string, number>>;
  edgesByKind: Partial<Record<string, number>>;
  isolatedNodeIds: string[];
  patternsWithoutChildren: string[];
  canonicalsWithoutPattern: string[];
  canonicalsWithoutConcrete: string[];
}

export function auditGraph(graph: ExerciseGraph): GraphAudit {
  const nodesByKind: Record<string, number> = {};
  const edgesByKind: Record<string, number> = {};
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const e of graph.edges) {
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }
  for (const n of graph.nodes) {
    nodesByKind[n.kind] = (nodesByKind[n.kind] ?? 0) + 1;
  }
  for (const e of graph.edges) {
    edgesByKind[e.kind] = (edgesByKind[e.kind] ?? 0) + 1;
  }

  const isolatedNodeIds = graph.nodes
    .filter(n => (incoming.get(n.id) ?? 0) === 0 && (outgoing.get(n.id) ?? 0) === 0)
    .map(n => n.id);

  const patternsWithoutChildren = graph.nodes
    .filter(n => n.kind === 'pattern')
    .map(n => n.id)
    .filter(id => (incoming.get(id) ?? 0) === 0);

  const canonicalsWithoutPattern: string[] = [];
  const canonicalsWithoutConcrete: string[] = [];
  const kindById = new Map(graph.nodes.map(n => [n.id, n.kind]));

  for (const n of graph.nodes) {
    if (n.kind !== 'exercise') continue;
    const props = n.props as { isCanonical?: boolean };
    if (!props.isCanonical) continue;

    const hasPattern = graph.edges.some(
      e => e.kind === 'instance-of' && e.source === n.id && kindById.get(e.target) === 'pattern',
    );
    if (!hasPattern) canonicalsWithoutPattern.push(n.id);

    const hasConcrete = graph.edges.some(e => e.kind === 'instance-of' && e.target === n.id);
    if (!hasConcrete) canonicalsWithoutConcrete.push(n.id);
  }

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    nodesByKind,
    edgesByKind,
    isolatedNodeIds,
    patternsWithoutChildren,
    canonicalsWithoutPattern,
    canonicalsWithoutConcrete,
  };
}