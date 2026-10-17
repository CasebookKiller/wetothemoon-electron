// src/components/PRANA_BINDU/ExerciseGraph/DetailPanel.tsx
//
// Правая панель «просмотр». Edit mode — в следующем заходе.

import React, { useCallback, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import type {
  ExerciseGraph,
  ExerciseProps,
  ProgramProps,
  PatternProps,
} from '@/main/services/pranaBindu/mentat/graph/ontology';
import CloseIcon from '@/components/COMMON/CloseIcon/CloseIcon';

interface Props {
  graph: ExerciseGraph;
  selectedId: string | undefined;
  onClose: () => void;
  onDeleteEdge?: (payload: { fromGraphId: string; toGraphId: string; kind: string }) => void;
  onEditEdge?: (payload: { fromGraphId: string; toGraphId: string; kind: string; note?: string }) => void;
  onEditNode?: (node: any) => void;
  onDeleteNode?: (node: any) => void;
}

export const DetailPanel: React.FC<Props> = ({ 
  graph,
  selectedId,
  onClose,
  onDeleteEdge,
  onEditEdge,
  onEditNode,
  onDeleteNode
}) => {

  const node = useMemo(
    () => (selectedId ? graph.nodes.find((n) => n.id === selectedId) : undefined),
    [graph, selectedId],
  );

  const incoming = useMemo(
    () => (node ? graph.edges.filter((e) => e.target === node.id) : []),
    [graph, node],
  );
  const outgoing = useMemo(
    () => (node ? graph.edges.filter((e) => e.source === node.id) : []),
    [graph, node],
  );

  if (!node) return null;

  const props = node.props as unknown as Record<string, unknown>;
  const title =
    (typeof props.labelRu === 'string' && props.labelRu) ||
    (typeof props.label === 'string' && props.label) ||
    node.id;

  const labelById = (id: string): string => {
    const n = graph.nodes.find((x) => x.id === id);
    if (!n) return id;
    const p = n.props as unknown as Record<string, unknown>;
    return String(p.labelRu ?? p.label ?? id);
  };

  // Ladder — три rung'а, только для exercise-узлов
  const benchmark = (() => {
    const raw = props.benchmark;
    if (!Array.isArray(raw)) return null;
    return raw.map((v) => String(v));
  })();
  const perSide = props.perSide === true;

  return (
    <div className="pb-graph-view__detail">
      <div className="pb-graph-view__detail-head">
        <div>
          <div className="pb-graph-view__detail-title">{title}</div>
          <div className="pb-graph-view__detail-sub">
            {node.kind}
            {node.kind === 'exercise' && (props.isCanonical as boolean) ? ' · canonical' : ''}
            {node.kind === 'exercise' && props.isStatic ? ' · static' : ''}
            {perSide ? ' · L / R' : ''}
          </div>
          <div className="pb-graph-view__detail-id">{node.id}</div>
        </div>
        <div className="pb-graph-view__detail-head-actions">
          {onEditNode && (node.kind === 'pattern' || node.kind === 'exercise') && (
            <button
              type="button"
              className="pb-detail-action-btn"
              title="Изменить"
              onClick={() => onEditNode(node)}
            >
              <i className="pi pi-pencil" />
            </button>
          )}
          {onDeleteNode && (node.kind === 'pattern' || node.kind === 'exercise') && (
            <button
              type="button"
              className="pb-detail-action-btn pb-detail-action-btn--danger"
              title="Удалить"
              onClick={() => onDeleteNode(node)}
            >
              <i className="pi pi-trash" />
            </button>
          )}
          <CloseIcon size="md" onClick={onClose} />
        </div>
      </div>

      {node.kind === 'program' && (
        <div className="pb-graph-view__detail-section">
          <div className="pb-graph-view__detail-label">Категория</div>
          <div>{(node.props as ProgramProps).category}</div>
        </div>
      )}

      {node.kind === 'pattern' && (
        <div className="pb-graph-view__detail-section">
          <div className="pb-graph-view__detail-label">Key</div>
          <div>{(node.props as PatternProps).key}</div>
        </div>
      )}

      {node.kind === 'exercise' &&
        (() => {
          const p = node.props as ExerciseProps & { perSide?: boolean };
          return (
            <>
              <div className="pb-graph-view__detail-section">
                <div className="pb-graph-view__detail-label">Каталог</div>
                <div>
                  {p.catalog}
                  {p.level != null ? ` · ур. ${p.level}` : ''}
                  {p.perSide ? (
                    <span className="pb-node-detail__per-side"> · L / R</span>
                  ) : null}
                </div>
              </div>

              {benchmark && benchmark.length > 0 && (
                <div className="pb-graph-view__detail-section">
                  <div className="pb-graph-view__detail-label">
                    Ladder{perSide ? ' (на одну сторону)' : ''}
                  </div>
                  <div className="pb-bench-chips">
                    {benchmark.map((b, i) => (
                      <span key={i} className="pb-bench-chip">
                        <span className="pb-bench-chip__rung">rung {i + 1}</span>
                        <span className="pb-bench-chip__val">{b}</span>
                      </span>
                    ))}
                  </div>
                  {perSide && (
                    <div className="pb-hint" style={{ marginTop: '0.35rem' }}>
                      Выполняется отдельно на каждую сторону
                    </div>
                  )}
                </div>
              )}

              {p.secondaryPattern && (
                <div className="pb-graph-view__detail-section">
                  <div className="pb-graph-view__detail-label">Secondary pattern</div>
                  <div>{p.secondaryPattern}</div>
                </div>
              )}
            </>
          );
        })()
      }

      <div className="pb-graph-view__detail-section">
        <div className="pb-graph-view__detail-label">
          Исходящие ({outgoing.length})
        </div>
        <ul>
          {outgoing.slice(0, 30).map((e) => (
            <li key={e.id} className="pb-edge-row">
              <span className="pb-graph-view__edge-kind">{e.kind}</span>
              <span
                className="pb-edge-row__label"
                onClick={() =>
                  onEditEdge?.({
                    fromGraphId: node.id,
                    toGraphId: e.target,
                    kind: e.kind,
                    note: (e.props as any)?.note,
                  })
                }
                title="Клик — редактировать связь"
              >
                → {labelById(e.target)}
              </span>
              {onDeleteEdge && e.kind !== 'instance-of' && e.kind !== 'belongs-to' && (
                <CloseIcon
                  size="sm"
                  title="Удалить связь"
                  onClick={() =>
                    onDeleteEdge({
                      fromGraphId: e.source,
                      toGraphId: node.id,
                      kind: e.kind,
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="pb-graph-view__detail-section">
        <div className="pb-graph-view__detail-label">
          Входящие ({incoming.length})
        </div>
        <ul>
          {incoming.slice(0, 30).map((e) => (
            <li key={e.id} className="pb-edge-row">
              <span
                className="pb-edge-row__label"
                onClick={() =>
                  onEditEdge?.({
                    fromGraphId: e.source,
                    toGraphId: node.id,
                    kind: e.kind,
                    note: (e.props as any)?.note,
                  })
                }
                title="Клик — редактировать связь"
              >
                {labelById(e.source)}
              </span>
              <span className="pb-graph-view__edge-kind">{e.kind}</span>
              {onDeleteEdge && e.kind !== 'instance-of' && e.kind !== 'belongs-to' && (
                <CloseIcon
                  size="sm"
                  title="Удалить связь"
                  onClick={() =>
                    onDeleteEdge({
                      fromGraphId: e.source,
                      toGraphId: node.id,
                      kind: e.kind,
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};