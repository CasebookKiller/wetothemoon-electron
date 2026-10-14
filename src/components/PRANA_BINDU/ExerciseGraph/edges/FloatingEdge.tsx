import React from 'react';
import {
  BaseEdge,
  type EdgeProps,
  Position,
  getBezierPath,
  getSmoothStepPath,
  useInternalNode,
} from '@xyflow/react';

interface Rect { x: number; y: number; w: number; h: number }

/** Типы рёбер, которые рисуем «квадратной» линией. */
const STEP_KINDS = new Set([
  'progresses-to',
  'variant-of',
  'requires',
]);

function intersection(rect: Rect, to: { x: number; y: number }) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const sx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function sideOf(rect: Rect, p: { x: number; y: number }): Position {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = (p.x - cx) / rect.w;
  const dy = (p.y - cy) / rect.h;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
}

export const FloatingEdge: React.FC<EdgeProps> = ({
  id, source, target, markerEnd, style, data,
}) => {
  const sNode = useInternalNode(source);
  const tNode = useInternalNode(target);
  if (!sNode || !tNode) return null;

  const sw = sNode.measured?.width ?? 240;
  const sh = sNode.measured?.height ?? 80;
  const tw = tNode.measured?.width ?? 240;
  const th = tNode.measured?.height ?? 80;

  const sRect: Rect = { x: sNode.internals.positionAbsolute.x, y: sNode.internals.positionAbsolute.y, w: sw, h: sh };
  const tRect: Rect = { x: tNode.internals.positionAbsolute.x, y: tNode.internals.positionAbsolute.y, w: tw, h: th };

  const sCenter = { x: sRect.x + sw / 2, y: sRect.y + sh / 2 };
  const tCenter = { x: tRect.x + tw / 2, y: tRect.y + th / 2 };

  const sPoint = intersection(sRect, tCenter);
  const tPoint = intersection(tRect, sCenter);
  const sPos = sideOf(sRect, sPoint);
  const tPos = sideOf(tRect, tPoint);

  const kind = (data as { kind?: string } | undefined)?.kind ?? '';
  const useStep = STEP_KINDS.has(kind);

  const path = useStep
    ? getSmoothStepPath({
        sourceX: sPoint.x, sourceY: sPoint.y, sourcePosition: sPos,
        targetX: tPoint.x, targetY: tPoint.y, targetPosition: tPos,
        borderRadius: 12,
        offset: 20,
      })[0]
    : getBezierPath({
        sourceX: sPoint.x, sourceY: sPoint.y, sourcePosition: sPos,
        targetX: tPoint.x, targetY: tPoint.y, targetPosition: tPos,
        curvature: 0.35,
      })[0];

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
    />
  );
};