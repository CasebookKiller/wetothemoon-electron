// src/components/PRANA_BINDU/ExerciseGraph/layout.ts
//
// Dagre-layout для React Flow. Никакой логики фильтрации — чистая раскладка.

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { ViewNodeData } from './types';

export interface LayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

export function layoutGraph(
  nodes: Node<ViewNodeData>[],
  edges: Edge[],
  opts: LayoutOptions = {},
): { nodes: Node<ViewNodeData>[]; edges: Edge[] } {
  const direction = opts.direction ?? 'LR';
  const nw = opts.nodeWidth ?? 240;
  const nh = opts.nodeHeight ?? 80;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: opts.nodeSep ?? 20,
    ranksep: opts.rankSep ?? 90,
    marginx: 30,
    marginy: 30,
  });

  for (const n of nodes) g.setNode(n.id, { width: nw, height: nh });
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  const positioned = nodes.map((n) => {
    if (n.data._explicitPos) {
      return {
        ...n,
        position: n.data._explicitPos,
        style: { width: nw, height: nh, ...(n.style ?? {}) },
      };
    }
    const p = g.node(n.id);
    return {
      ...n,
      position: {
        x: (p?.x ?? 0) - nw / 2,
        y: (p?.y ?? 0) - nh / 2,
      },
      style: { width: nw, height: nh, ...(n.style ?? {}) },
    };
  });

  return { nodes: positioned, edges };
}

export interface RadialOptions {
  centerX?: number;
  centerY?: number;
  patternRadius?: number;    // круг паттернов
  canonicalRadius?: number;  // круг канонов
  outerRadius?: number;      // круг concrete/program
}

export function radialLayout(
  nodes: Node<ViewNodeData>[],
  edges: Edge[],
  opts: RadialOptions = {},
): { nodes: Node<ViewNodeData>[]; edges: Edge[] } {
  const cx = opts.centerX ?? 0;
  const cy = opts.centerY ?? 0;
  const R1 = opts.patternRadius   ?? 400;
  const R2 = opts.canonicalRadius ?? 900;
  const R3 = opts.outerRadius     ?? 1500;

  const patternIds: string[] = [];
  const canonicalIds: string[] = [];
  for (const n of nodes) {
    if (n.data.role === 'pattern') patternIds.push(n.id);
    else if (n.data.role === 'canonical') canonicalIds.push(n.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const N = patternIds.length || 1;

  // -------- 1. Паттерны — на окружности R1 (первый сверху) --------
  patternIds.forEach((id, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    positions.set(id, {
      x: cx + Math.cos(angle) * R1,
      y: cy + Math.sin(angle) * R1,
    });
  });

  // -------- 2. Каноны — на R2, в секторе своего паттерна --------
  const canonicalsByPattern = new Map<string, string[]>();
  for (const e of edges) {
    if (e.data?.kind !== 'instance-of') continue;
    if (!canonicalIds.includes(e.source)) continue;
    if (!patternIds.includes(e.target)) continue;
    const list = canonicalsByPattern.get(e.target) ?? [];
    list.push(e.source);
    canonicalsByPattern.set(e.target, list);
  }

  patternIds.forEach((patId, i) => {
    const list = canonicalsByPattern.get(patId) ?? [];
    if (list.length === 0) return;
    const patAngle = (i / N) * Math.PI * 2 - Math.PI / 2;
    const sector = (Math.PI * 2 / N) * 0.85;
    const start = patAngle - sector / 2;
    const step = list.length === 1 ? 0 : sector / (list.length - 1);
    list.forEach((id, j) => {
      const a = list.length === 1 ? patAngle : start + j * step;
      positions.set(id, {
        x: cx + Math.cos(a) * R2,
        y: cy + Math.sin(a) * R2,
      });
    });
  });

  // -------- 3. Остальные — наружный круг, по углу «якоря» --------
  const anchors = new Map<string, string>();
  for (const e of edges) {
    if (e.data?.kind === 'instance-of' && !canonicalIds.includes(e.source)) {
      anchors.set(e.source, e.target); // concrete → canonical
    }
    if (e.data?.kind === 'used-in' && !anchors.has(e.target)) {
      anchors.set(e.target, e.source); // program ← canonical
    }
  }

  const bucket = new Map<string, string[]>();
  for (const [id, anchorId] of anchors) {
    if (positions.has(id)) continue;
    const list = bucket.get(anchorId) ?? [];
    list.push(id);
    bucket.set(anchorId, list);
  }

  // Индекс узлов — чтобы читать level
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  for (const [anchorId, ids] of bucket) {
    const ap = positions.get(anchorId);
    if (!ap) continue;

    // Луч наружу от центра через канон
    const angle = Math.atan2(ap.y - cy, ap.x - cx);

    // Сортируем по level: W1 ближе, W10 дальше
    const sorted = [...ids].sort((a, b) => {
      const la = nodeById.get(a)?.data?.level;
      const lb = nodeById.get(b)?.data?.level;
      if (typeof la === 'number' && typeof lb === 'number') return la - lb;
      return 0;
    });

    const startR = R2 + 150;   // сразу за каноном
    const step   = 85;          // расстояние между уровнями
    const fanSpread = sorted.length > 4 ? 0.22 : 0;

    sorted.forEach((id, i) => {
      const r = startR + i * step;
      const da =
        fanSpread === 0
          ? 0
          : (i - (sorted.length - 1) / 2) *
            (fanSpread / Math.max(1, sorted.length - 1));
      const a = angle + da;
      positions.set(id, {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
      });
    });
  }

  // -------- 4. Сироты — ровным кругом чуть дальше --------
  const orphans = nodes.filter((n) => !positions.has(n.id)).map((n) => n.id);
  orphans.forEach((id, i) => {
    const a = (i / Math.max(1, orphans.length)) * Math.PI * 2;
    positions.set(id, {
      x: cx + Math.cos(a) * (R3 + 250),
      y: cy + Math.sin(a) * (R3 + 250),
    });
  });

  const positioned = nodes.map((n) => {
    const basePos = n.data._explicitPos ?? positions.get(n.id) ?? { x: cx, y: cy };
    return {
      ...n,
      position: basePos,
    };
  });

  return { nodes: positioned, edges };
}