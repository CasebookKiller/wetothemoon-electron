// src/components/PRANA_BINDU/ExerciseGraph/ExerciseGraphView.tsx

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeMouseHandler, 
  type OnNodeDrag,
} from '@xyflow/react';
import { ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { DifficultyBand, ExerciseGraph } from '@/main/services/pranaBindu/mentat/graph/ontology';
import type { Filters, ViewNodeData } from './types';
import { EMPTY_FILTERS } from './types';
import { buildViewGraph } from './viewModel';
import { layoutGraph, radialLayout } from './layout';
import { FiltersBar, type LayoutMode } from './FiltersBar';
import { DetailPanel } from './DetailPanel';
import { EdgeLegend } from './EdgeLegend';
import { PalettePanel } from './PalettePanel';

import { ConfirmDialog } from 'primereact/confirmdialog';
import { thenicsJsonId } from '@/main/services/pranaBindu/mentat/graph/sources';

import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';
import AppDialog from '@/components/COMMON/AppDialog/AppDialog';
import AppDialogFooter from '@/components/COMMON/AppDialog/AppDialogFooter';
import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import { ExerciseNode } from './nodes/ExerciseNode';
import { PatternNode } from './nodes/PatternNode';
import { ProgramNode } from './nodes/ProgramNode';
import { CatalogNode } from './nodes/CatalogNode';
import { FloatingEdge } from './edges/FloatingEdge';

const NODE_TYPES: NodeTypes = {
  exerciseNode: ExerciseNode,
  patternNode: PatternNode,
  programNode: ProgramNode,
  catalogNode: CatalogNode,   // ← новое
};

const EDGE_TYPES: EdgeTypes = {
  floating: FloatingEdge,
};

interface Props {
  graph: ExerciseGraph;
  onGraphChanged?: () => void;
}

export const ExerciseGraphView: React.FC<Props> = ({ graph, onGraphChanged }) => {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('linear');
  const [posOverrides, setPosOverrides] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const deferredFilters = useDeferredValue(filters);
  const deferredLayout = useDeferredValue(layoutMode);

  const isStale =
    filters !== deferredFilters || layoutMode !== deferredLayout;

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => buildViewGraph(graph, deferredFilters, selectedId),
    [graph, deferredFilters, selectedId],
  );

  // Раскладка использует ВСЕ рёбра
  const { nodes: laidNodes, edges: laidEdges } = useMemo(() => {
    const result =
      deferredLayout === 'radial'
        ? radialLayout(rawNodes, rawEdges, {
            patternRadius: 400,
            canonicalRadius: 900,
            outerRadius: 1500,
          })
        : layoutGraph(rawNodes, rawEdges, { direction: 'LR' });

    // Применяем «свежие» позиции поверх результата layout
    if (posOverrides.size === 0) return result;

    return {
      ...result,
      nodes: result.nodes.map((n) => {
        const o = posOverrides.get(n.id);
        return o ? { ...n, position: o } : n;
      }),
    };
  }, [rawNodes, rawEdges, deferredLayout, posOverrides]);

  // Для рендера — убираем belongs-to, притухаем instance-of,
  // подсвечиваем рёбра выбранного узла
  const renderEdges = useMemo(() => {
    const filtered = laidEdges
      .filter((e) => (e.data as { kind?: string })?.kind !== 'belongs-to')
      .map((e) => {
        const kind = (e.data as { kind?: string })?.kind;
        if (kind === 'instance-of') {
          return {
            ...e,
            style: {
              ...(e.style ?? {}),
              stroke: 'rgba(180, 180, 180, 0.12)',
              strokeWidth: 0.8,
            },
          };
        }
        return e;
      });

    if (!selectedId) return filtered;

    return filtered.map((e) => {
      const isConnected = e.source === selectedId || e.target === selectedId;
      if (!isConnected) {
        return { ...e, style: { ...(e.style ?? {}), opacity: 0.18 } };
      }
      const w = Number(e.style?.strokeWidth) || 1;
      return {
        ...e,
        style: { ...(e.style ?? {}), strokeWidth: w * 1.6, opacity: 1 },
      };
    });
  }, [laidEdges, selectedId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(laidNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(renderEdges);
  const [panelTab, setPanelTab] = useState<'details' | 'palette'>('details');
  const [paletteGroups, setPaletteGroups] = useState<any[]>([]);
  const [sideOpen, setSideOpen] = useState(true);

  const [pendingEdge, setPendingEdge] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const [edgeKind, setEdgeKind] = useState<string>('progresses-to');
  const [edgeNote, setEdgeNote] = useState<string>('');

  const [editingEdge, setEditingEdge] = useState<{
    fromGraphId: string;
    toGraphId: string;
    kind: string;
    note?: string;
  } | null>(null);
  const [editKind, setEditKind] = useState<string>('progresses-to');
  const [editNote, setEditNote] = useState<string>('');

  type CreateKind = 'pattern' | 'canonical' | 'exercise' | null;
  const [createKind, setCreateKind] = useState<CreateKind>(null);

  const [thenicsDialog, setThenicsDialog] = useState<{
    key: string;
    name: string;
    nameRu?: string;
    level?: string;
  } | null>(null);

  const [thenicsMode, setThenicsMode] = useState<'exercise' | 'group'>('exercise');
  const [thenicsParent, setThenicsParent] = useState<string>('');
  const [thenicsAsLevel, setThenicsAsLevel] = useState<string>('');
  const [thenicsBand, setThenicsBand] = useState<DifficultyBand | undefined>(undefined);
  const [thenicsSaving, setThenicsSaving] = useState(false);
  const [thenicsError, setThenicsError] = useState<string | null>(null);

  const [formId, setFormId] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formLabelRu, setFormLabelRu] = useState('');
  const [formPattern, setFormPattern] = useState<string>('');
  const [formSecondary, setFormSecondary] = useState<string>('');
  const [formCanonical, setFormCanonical] = useState<string>('');
  const [formLevel, setFormLevel] = useState<string>('');
  const [formBenchmark, setFormBenchmark] = useState<string>('');
  const [formPerSide, setFormPerSide] = useState(false);
  const [formIsStatic, setFormIsStatic] = useState(false);
  const [formCatalog, setFormCatalog] = useState<string>('named');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const api = (window as any).electronAPI;

  /**
   * Паттерн для Thenics-канона, если он не совпадает с Wade и не выводится
   * автоматически. Ключ — t.key из THENICS_CATALOG.
   */
  const THENICS_PATTERN_OVERRIDES: Record<
    string,
    { pattern: string | null; secondary?: string; isStatic?: boolean }
  > = {
    'muscle-up':             { pattern: 'pull', secondary: 'push' },
    'negative-muscle-up':    { pattern: 'pull', secondary: 'push' },
    'jumping-muscle-up':     { pattern: 'pull', secondary: 'push' },
    'kipping-muscle-up':     { pattern: 'pull', secondary: 'push' },
    'one-arm-pull-up':       { pattern: 'pull' },
    'archer-pull-up':        { pattern: 'pull' },
    'typewriter-pull-up':    { pattern: 'pull' },
    'high-pull-up':          { pattern: 'pull' },
    'one-arm-push-up':       { pattern: 'push' },
    'archer-push-up':        { pattern: 'push' },
    'pseudo-push-up':        { pattern: 'push' },
    'planche':               { pattern: 'straight-arm', secondary: 'push', isStatic: true },
    'front-lever':           { pattern: 'straight-arm', secondary: 'pull', isStatic: true },
    'back-lever':            { pattern: 'straight-arm', secondary: 'pull', isStatic: true },
    'human-flag':            { pattern: 'core-anti', isStatic: true },
    'dragon-flag':           { pattern: 'core-flexion' },
    'handstand':             { pattern: 'push', isStatic: true },
    'headstand':             { pattern: 'push', isStatic: true },
    'one-arm-handstand':     { pattern: 'push', isStatic: true },
  };

  const handlePaletteAdd = useCallback(
    (item: any) => {
      if (!item || item.inGraph) return;

      if (item.source === 'thenics') {
        const payload = item.payload as {
          key: string;
          name: string;
          nameRu?: string;
          level?: string;
        };
        setThenicsDialog(payload);
        setThenicsMode('exercise');
        setThenicsParent('');
        setThenicsAsLevel('');
        // Автоматически подставить band из каталога Thenics.
        const bandMap: Record<string, DifficultyBand> = {
          Beginner: 1,
          Intermediate: 2,
          Advanced: 3,
          Pro: 4,
        };
        setThenicsBand(bandMap[payload.level ?? ''] ?? undefined);
        setThenicsError(null);
        return;
      }

      console.warn('[graph] Add для source=' + item.source + ' не реализован');
    },
    [],
  );
  
  const patternsFromGraph = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.kind === 'pattern')
        .map((n) => {
          const props = n.props as { key: string; label: string; labelRu?: string };
          return { key: props.key, label: props.label, labelRu: props.labelRu };
        }),
    [graph],
  );

  useEffect(() => {
    setPosOverrides(new Map());
  }, [graph]);

  useEffect(() => {
    setNodes(laidNodes);
  }, [laidNodes, setNodes]);

  useEffect(() => {
    setEdges(renderEdges);
  }, [renderEdges, setEdges]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (panelTab === 'palette' && paletteGroups.length === 0) {
      api.pb.graphPalette().then((r: any) => {
        if (r.ok) setPaletteGroups(r.groups);
      });
    }
  }, [panelTab, paletteGroups.length]);

  const onNodeClick: NodeMouseHandler = useCallback((_, n) => {
    setSelectedId((prev) => (prev === n.id ? undefined : n.id));
  }, []);

  const onNodeDragStop: OnNodeDrag<any> = useCallback(
    async (_, node) => {
      const p = { x: Math.round(node.position.x), y: Math.round(node.position.y) };

      // Локально — чтобы переключение Слои↔Круг не сбросило позицию
      setPosOverrides((prev) => {
        const next = new Map(prev);
        next.set(node.id, p);
        return next;
      });

      // Персистентно — в user.json
      const r = await api.pb.graphSaveNodePos({ id: node.id, ...p });
      if (!r.ok) {
        console.warn('[graph] save-node-pos failed:', r.error);
      }
    },
    [api],
  );

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    setPendingEdge({
      source: connection.source,
      target: connection.target,
    });
    setEdgeKind('progresses-to');
    setEdgeNote('');
  }, []);

  const labelOfNode = useCallback(
    (id: string): string => {
      const n = graph.nodes.find((x) => x.id === id);
      if (!n) return id;
      const p = n.props as unknown as Record<string, unknown>;
      return String(p.labelRu ?? p.label ?? id);
    },
    [graph],
  );

  const submitEdge = useCallback(async () => {
    if (!pendingEdge) return;
    const r = await api.pb.graphAddEdge({
      fromGraphId: pendingEdge.source,
      toGraphId: pendingEdge.target,
      kind: edgeKind,
      note: edgeNote.trim() || undefined,
    });
    if (r.ok) {
      setPendingEdge(null);
      onGraphChanged?.();
    } else {
      alert('Не удалось создать связь: ' + r.error);
    }
  }, [api, pendingEdge, edgeKind, edgeNote, onGraphChanged]);

  const onPaneClick = useCallback(() => setSelectedId(undefined), []);

  const handleReset = useCallback(async () => {
    if (!confirm('Сбросить граф к эталону Wade? Все ручные правки будут удалены.')) return;
    const r = await api.pb.graphReset();
    if (r.ok) {
      setSelectedId(undefined);
      // Принудительно перезагрузить граф
      window.location.reload();
    } else {
      alert('Ошибка сброса: ' + r.error);
    }
  }, [api]);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    setPaletteGroups([]);
  }, [graph]);

  const handleFocusExisting = useCallback((graphId: string) => {
    setSelectedId(graphId);
  }, []);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<{
    source: string;
    sourceKey: string;
    sourceLevel: string | null;
    target: string;
    targetKey: string;
    targetLevel: string | null;
  } | null>(null);
  const [pendingItem, setPendingItem] = useState<any>(null);

  const [editingNode, setEditingNode] = useState<any>(null);
  const [deletingNode, setDeletingNode] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    label: '',
    labelRu: '',
    level: '',
    benchmark: '',
    perSide: false,
    canonical: '',
    pattern: '',
    secondaryPattern: '',
    isStatic: false,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);


  const handleConfirmRequest = useCallback(
    (candidate: any, item: any) => {
      setPendingCandidate(candidate);
      setPendingItem(item);
      setConfirmOpen(true);
    },
    [],
  );

  const handleConfirmYes = useCallback(async () => {
    if (!pendingCandidate) return;
    const res = await api.pb.setEquivalence({
      source: pendingCandidate.source,
      sourceKey: pendingCandidate.sourceKey,
      sourceLevel: pendingCandidate.sourceLevel,
      target: pendingCandidate.target,
      targetKey: pendingCandidate.targetKey,
      targetLevel: pendingCandidate.targetLevel,
      confidence: 'manual',
      note: null,
    });
    setConfirmOpen(false);
    setPendingCandidate(null);
    setPendingItem(null);
    if (res?.success) {
      setPaletteGroups([]);  // перезагрузить палитру
    } else {
      alert('Не удалось сохранить: ' + (res?.error ?? 'unknown'));
    }
  }, [api, pendingCandidate]);

  const handleConfirmNo = useCallback(async () => {
    if (!pendingCandidate || !pendingItem) return;
    const res = await api.pb.setEquivalence({
      source: pendingCandidate.source,
      sourceKey: pendingCandidate.sourceKey,
      sourceLevel: pendingCandidate.sourceLevel,
      target: pendingCandidate.target,
      targetKey: pendingCandidate.targetKey,
      targetLevel: pendingCandidate.targetLevel,
      confidence: 'negative',
      note: 'Отклонено пользователем',
    });
    setConfirmOpen(false);
    setPendingCandidate(null);
    setPendingItem(null);
    if (res?.success) {
      // Перезагружаем палитру → item станет active
      setPaletteGroups([]);
      // Плюс сразу добавляем в граф
      await onGraphChanged?.();
    } else {
      alert('Не удалось сохранить: ' + (res?.error ?? 'unknown'));
    }
  }, [api, pendingCandidate, pendingItem, onGraphChanged]);

  const handleDeleteEdge = useCallback(
    async (payload: { fromGraphId: string; toGraphId: string; kind: string }) => {
      const r = await api.pb.graphDeleteEdge(payload);
      if (r.ok) {
        onGraphChanged?.();
      } else {
        alert('Не удалось удалить связь: ' + r.error);
      }
    },
    [api, onGraphChanged],
  );

  const handleEditEdge = useCallback(
    (edge: { fromGraphId: string; toGraphId: string; kind: string; note?: string }) => {
      setEditingEdge(edge);
      setEditKind(edge.kind);
      setEditNote(edge.note ?? '');
    },
    [],
  );

  const submitEditEdge = useCallback(async () => {
    if (!editingEdge) return;
    const r = await api.pb.graphUpdateEdge({
      fromGraphId: editingEdge.fromGraphId,
      toGraphId: editingEdge.toGraphId,
      oldKind: editingEdge.kind,
      newKind: editKind,
      note: editNote.trim() || undefined,
    });
    if (r.ok) {
      setEditingEdge(null);
      onGraphChanged?.();
    } else {
      alert('Не удалось изменить связь: ' + r.error);
    }
  }, [api, editingEdge, editKind, editNote, onGraphChanged]);

  const deleteFromEditDialog = useCallback(async () => {
    if (!editingEdge) return;
    const r = await api.pb.graphDeleteEdge({
      fromGraphId: editingEdge.fromGraphId,
      toGraphId: editingEdge.toGraphId,
      kind: editingEdge.kind,
    });
    if (r.ok) {
      setEditingEdge(null);
      onGraphChanged?.();
    } else {
      alert('Не удалось удалить: ' + r.error);
    }
  }, [api, editingEdge, onGraphChanged]);

  const openCreate = useCallback((kind: 'pattern' | 'canonical' | 'exercise') => {
    setCreateKind(kind);
    setFormId('');
    setFormLabel('');
    setFormLabelRu('');
    setFormPattern('');
    setFormSecondary('');
    setFormCanonical('');
    setFormLevel('');
    setFormBenchmark('');
    setFormPerSide(false);
    setFormIsStatic(false);
    setFormCatalog('named');
    setCreateError(null);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateKind(null);
    setCreateError(null);
  }, []);

  const submitCreate = useCallback(async () => {
    if (!createKind) return;
    setSaving(true);
    setCreateError(null);

    try {
      if (createKind === 'pattern') {
        const r = await api.pb.graphAddPattern({
          id: formId.trim(),
          label: formLabel.trim(),
          labelRu: formLabelRu.trim() || undefined,
        });
        if (r.ok) {
          closeCreate();
          onGraphChanged?.();
        } else {
          setCreateError(r.error);
        }
      } else if (createKind === 'canonical') {
        const r = await api.pb.graphAddCanonicalCustom({
          id: formId.trim(),
          label: formLabel.trim(),
          labelRu: formLabelRu.trim() || undefined,
          catalog: formCatalog,
          pattern: formPattern || null,
          secondaryPattern: formSecondary || null,
          isStatic: formIsStatic,
        });
        if (r.ok) {
          closeCreate();
          onGraphChanged?.();
        } else {
          setCreateError(r.error);
        }
      } else if (createKind === 'exercise') {
        const bench = formBenchmark
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        const levelNum = formLevel.trim() === '' ? null : Number(formLevel);
        if (levelNum !== null && !Number.isFinite(levelNum)) {
          setCreateError('Уровень должен быть числом или пустым');
          setSaving(false);
          return;
        }
        const r = await api.pb.graphAddExercise({
          id: formId.trim(),
          canonical: formCanonical,
          label: formLabel.trim(),
          labelRu: formLabelRu.trim() || undefined,
          level: levelNum,
          benchmark: bench.length > 0 ? bench : undefined,
          perSide: formPerSide,
        });
        if (r.ok) {
          closeCreate();
          onGraphChanged?.();
        } else {
          setCreateError(r.error);
        }
      }
    } finally {
      setSaving(false);
    }
  }, [
    createKind, formId, formLabel, formLabelRu, formPattern, formSecondary,
    formCanonical, formLevel, formBenchmark, formPerSide, formIsStatic,
    formCatalog, api, onGraphChanged, closeCreate,
  ]);

  const closeThenicsDialog = useCallback(() => {
    setThenicsDialog(null);
    setThenicsError(null);
  }, []);

  const submitThenicsAdd = useCallback(async () => {
    if (!thenicsDialog) return;
    setThenicsSaving(true);
    setThenicsError(null);

    try {
      if (thenicsMode === 'group') {
        const r = await api.pb.graphAddCanonicalCustom({
          id: `thenics-${thenicsDialog.key}`,
          label: thenicsDialog.name,
          labelRu: thenicsDialog.nameRu,
          catalog: 'thenics',
          pattern: null,
        });
        if (r.ok) {
          closeThenicsDialog();
          onGraphChanged?.();
        } else {
          setThenicsError(r.error);
        }
        return;
      }

      // режим exercise
      if (!thenicsParent) {
        setThenicsError('Выберите родительскую группу');
        return;
      }

      const levelNum =
        thenicsAsLevel.trim() === '' ? null : Number(thenicsAsLevel);
      if (levelNum !== null && !Number.isFinite(levelNum)) {
        setThenicsError('Уровень должен быть числом или пустым');
        return;
      }

      const r = await api.pb.graphAddExercise({
        id: `thenics-${thenicsDialog.key}`,
        canonical: thenicsParent,
        label: thenicsDialog.name,
        labelRu: thenicsDialog.nameRu,
        level: levelNum,
        band: thenicsBand,
      });
      if (r.ok) {
        closeThenicsDialog();
        onGraphChanged?.();
      } else {
        setThenicsError(r.error);
      }
    } finally {
      setThenicsSaving(false);
    }
  }, [
    thenicsDialog,
    thenicsMode,
    thenicsParent,
    thenicsAsLevel,
    api,
    onGraphChanged,
    closeThenicsDialog,
  ]);

  const handleEditNode = useCallback((node: any) => {
    const p = node.props as any;
    setEditingNode(node);
    setEditForm({
      label: p.label ?? '',
      labelRu: p.labelRu ?? '',
      level: p.level != null ? String(p.level) : '',
      benchmark: Array.isArray(p.benchmark) ? p.benchmark.join('; ') : '',
      perSide: p.perSide === true,
      canonical: p.canonical ?? '',
      pattern: p.pattern ?? '',
      secondaryPattern: p.secondaryPattern ?? '',
      isStatic: p.isStatic === true,
    });
    setEditError(null);
  }, []);

  const submitEditNode = useCallback(async () => {
    if (!editingNode) return;
    setEditSaving(true);
    setEditError(null);

    try {
      const p = editingNode.props as any;

      if (editingNode.kind === 'pattern') {
        const r = await api.pb.graphUpdatePattern({
          id: p.key,
          patch: {
            label: editForm.label.trim(),
            labelRu: editForm.labelRu.trim() || undefined,
          },
        });
        if (r.ok) { setEditingNode(null); onGraphChanged?.(); }
        else setEditError(r.error);
        return;
      }

      if (editingNode.kind === 'exercise' && p.isCanonical) {
        const r = await api.pb.graphUpdateCanonical({
          id: p.key,
          patch: {
            label: editForm.label.trim(),
            labelRu: editForm.labelRu.trim() || undefined,
            pattern: editForm.pattern || null,
            secondaryPattern: editForm.secondaryPattern || null,
            isStatic: editForm.isStatic,
          },
        });
        if (r.ok) { setEditingNode(null); onGraphChanged?.(); }
        else setEditError(r.error);
        return;
      }

      if (editingNode.kind === 'exercise' && !p.isCanonical) {
        const bench = editForm.benchmark
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        const levelNum = editForm.level.trim() === '' ? null : Number(editForm.level);
        if (levelNum !== null && !Number.isFinite(levelNum)) {
          setEditError('Уровень должен быть числом или пустым');
          return;
        }
        const r = await api.pb.graphUpdateExercise({
          id: p.key,
          patch: {
            label: editForm.label.trim(),
            labelRu: editForm.labelRu.trim() || undefined,
            level: levelNum,
            benchmark: bench.length > 0 ? bench : undefined,
            perSide: editForm.perSide,
            canonical: editForm.canonical || undefined,
          },
        });
        if (r.ok) { setEditingNode(null); onGraphChanged?.(); }
        else setEditError(r.error);
        return;
      }
    } finally {
      setEditSaving(false);
    }
  }, [editingNode, editForm, api, onGraphChanged]);

  const handleDeleteNode = useCallback((node: any) => {
    setDeletingNode(node);
  }, []);

  const confirmDeleteNode = useCallback(async () => {
    if (!deletingNode) return;
    const p = deletingNode.props as any;

    try {
      if (deletingNode.kind === 'pattern') {
        const r = await api.pb.graphDeletePattern(p.key);
        if (r.ok) { setDeletingNode(null); onGraphChanged?.(); }
        else alert('Не удалось удалить: ' + r.error);
      } else if (deletingNode.kind === 'exercise' && p.isCanonical) {
        const r = await api.pb.graphDeleteCanonical(p.key);
        if (r.ok) { setDeletingNode(null); onGraphChanged?.(); }
        else alert('Не удалось удалить: ' + r.error);
      } else if (deletingNode.kind === 'exercise' && !p.isCanonical) {
        const r = await api.pb.graphDeleteExercise(p.key);
        if (r.ok) { setDeletingNode(null); onGraphChanged?.(); }
        else alert('Не удалось удалить: ' + r.error);
      }
    } catch (e) {
      alert('Ошибка: ' + (e as Error).message);
    }
  }, [deletingNode, api, onGraphChanged]);

  return (
    <div className="pb-graph-view">
    <FiltersBar
      filters={filters}
      onChange={setFilters}
      totalCount={graph.nodes.length}
      visibleCount={nodes.length}
      layoutMode={layoutMode}
      onLayoutModeChange={setLayoutMode}
      patterns={patternsFromGraph}
      onReset={handleReset} onRefresh={handleRefresh} 
      sideOpen={sideOpen}
      onToggleSide={() => setSideOpen((v) => !v)}
      onOpenCreate={openCreate}
    />
      <div className="pb-graph-view__canvas">
        <ReactFlow
          nodes={nodes}
          nodeTypes={NODE_TYPES}
          edges={edges}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          fitView
          isValidConnection={(c) => c.source !== c.target}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          connectionMode={ConnectionMode.Strict}
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        <EdgeLegend />

        <ConfirmDialog
          visible={confirmOpen}
          onHide={() => setConfirmOpen(false)}
          className="pb-confirm-dialog"
          header="Подтверждение эквивалентности"
          message={
            pendingItem && pendingCandidate
              ? `Возможно, "${pendingItem.labelRu ?? pendingItem.label}" и "${pendingCandidate.targetKey}${pendingCandidate.targetLevel ? ' L' + pendingCandidate.targetLevel : ''}" — одно и то же.`
              : ''
          }
          icon="pi pi-question-circle"
          accept={() => void handleConfirmYes()}
          reject={() => void handleConfirmNo()}
          acceptLabel="Да, это одно и то же"
          rejectLabel="Нет, это другое"
        />

        <AppDialog
          visible={!!pendingEdge}
          onHide={() => setPendingEdge(null)}
          title="Создать связь"
          titleIcon="pi-share-alt"
          className="pb-edge-dialog"
          style={{ width: '440px' }}
          modal
        >
          {pendingEdge && (
            <>
              <div className="pb-edge-dialog__row pb-edge-dialog__row--swap">
                <div className="pb-edge-dialog__label">Откуда</div>
                <div className="pb-edge-dialog__value">
                  {labelOfNode(pendingEdge.source)}
                </div>
              </div>
              <button
                type="button"
                className="pb-edge-dialog__swap"
                onClick={() =>
                  setPendingEdge((prev) =>
                    prev ? { source: prev.target, target: prev.source } : prev,
                  )
                }
                title="Поменять местами начало и конец"
              >
                <i className="pi pi-sort-arrow-down" /> Поменять
              </button>
              <div className="pb-edge-dialog__row">
                <div className="pb-edge-dialog__label">Куда</div>
                <div className="pb-edge-dialog__value">
                  {labelOfNode(pendingEdge.target)}
                </div>
              </div>
              <div className="pb-edge-dialog__row">
                <div className="pb-edge-dialog__label">Тип связи</div>
                <select
                  value={edgeKind}
                  onChange={(e) => setEdgeKind(e.target.value)}
                  className="pb-edge-form__select"
                >
                  <option value="progresses-to">Прогрессия (progresses-to)</option>
                  <option value="variant-of">Вариант (variant-of)</option>
                  <option value="requires">Требует (requires)</option>
                  <option value="equivalent-to">Эквивалент (equivalent-to)</option>
                </select>
              </div>
              <div className="pb-edge-dialog__row">
                <div className="pb-edge-dialog__label">Заметка</div>
                <input
                  type="text"
                  value={edgeNote}
                  onChange={(e) => setEdgeNote(e.target.value)}
                  placeholder="Опционально"
                  className="pb-edge-form__select"
                />
              </div>
              <AppDialogFooter>
                <Button
                  label="Отмена"
                  className="pb-soft p-button-sm"
                  onClick={() => setPendingEdge(null)}
                />
                <Button
                  label="Создать"
                  className="pb p-button-sm"
                  onClick={() => void submitEdge()}
                />
              </AppDialogFooter>
            </>
          )}
        </AppDialog>

        <AppDialog
          visible={!!editingEdge}
          onHide={() => setEditingEdge(null)}
          title="Редактировать связь"
          titleIcon="pi-pencil"
          className="pb-templates-dialog pb-edge-dialog"
          style={{ width: '440px' }}
          modal
        >
          {editingEdge && (
            <div className="pb-edge-dialog__body">
              <div className="pb-edge-dialog__row">
                <div className="pb-edge-dialog__label">Откуда</div>
                <div className="pb-edge-dialog__value">
                  {labelOfNode(editingEdge.fromGraphId)}
                </div>
              </div>
              <div className="pb-edge-dialog__row">
                <div className="pb-edge-dialog__label">Куда</div>
                <div className="pb-edge-dialog__value">
                  {labelOfNode(editingEdge.toGraphId)}
                </div>
              </div>
              <div className="pb-edge-dialog__row">
                <div className="pb-edge-dialog__label">Тип связи</div>
                <select
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value)}
                  className="pb-edge-form__select"
                >
                  <option value="progresses-to">Прогрессия (progresses-to)</option>
                  <option value="variant-of">Вариант (variant-of)</option>
                  <option value="requires">Требует (requires)</option>
                  <option value="equivalent-to">Эквивалент (equivalent-to)</option>
                </select>
              </div>
              <div className="pb-edge-dialog__row">
                <div className="pb-edge-dialog__label">Заметка</div>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Опционально"
                  className="pb-edge-form__select"
                />
              </div>
              <div className="pb-edge-dialog__actions">
                <Button
                  label="Удалить"
                  icon="pi pi-trash"
                  className="pb-destructive-soft p-button-sm"
                  onClick={() => void deleteFromEditDialog()}
                />
                <span style={{ flex: 1 }} />
                <Button
                  label="Отмена"
                  className="pb-soft p-button-sm"
                  onClick={() => setEditingEdge(null)}
                />
                <Button
                  label="Сохранить"
                  className="pb p-button-sm"
                  onClick={() => void submitEditEdge()}
                />
              </div>
            </div>
          )}
        </AppDialog>

        <AppDialog
          visible={createKind === 'pattern'}
          onHide={closeCreate}
          title="Новый паттерн (семья)"
          titleIcon="pi-sitemap"
          className="pb-create-dialog"
          style={{ width: '460px' }}
          modal
          dismissableMask
          closeOnEscape
        >
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">ID (латиница)</label>
            <input
              type="text"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              placeholder="biceps-flex"
              className="pb-edge-form__select"
            />
            <div className="pb-hint">Станет <code>pat:custom-biceps-flex</code></div>
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Название (EN)</label>
            <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Biceps Flexion" className="pb-edge-form__select" />
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Название (RU)</label>
            <input type="text" value={formLabelRu} onChange={(e) => setFormLabelRu(e.target.value)} placeholder="Сгибание бицепса" className="pb-edge-form__select" />
          </div>
          {createError && <div className="pb-create-error">{createError}</div>}
          <AppDialogFooter>
            <Button label="Отмена" className="pb-soft p-button-sm" onClick={closeCreate} />
            <Button
              label={saving ? 'Создание…' : 'Создать'}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              className="pb p-button-sm"
              disabled={saving || !formId.trim() || !formLabel.trim()}
              onClick={() => void submitCreate()}
            />
          </AppDialogFooter>
        </AppDialog>

        <AppDialog
          visible={createKind === 'canonical'}
          onHide={closeCreate}
          title="Новая группа (canonical)"
          titleIcon="pi-box"
          className="pb-create-dialog"
          style={{ width: '480px' }}
          modal
          dismissableMask
          closeOnEscape
        >
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">ID</label>
            <input type="text" value={formId} onChange={(e) => setFormId(e.target.value)} placeholder="calves" className="pb-edge-form__select" />
            <div className="pb-hint">Станет <code>ex:canonical:custom-calves</code></div>
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Название (EN)</label>
            <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Calves" className="pb-edge-form__select" />
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Название (RU)</label>
            <input type="text" value={formLabelRu} onChange={(e) => setFormLabelRu(e.target.value)} placeholder="Голени" className="pb-edge-form__select" />
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Паттерн (семья)</label>
            <select value={formPattern} onChange={(e) => setFormPattern(e.target.value)} className="pb-edge-form__select">
              <option value="">— без паттерна —</option>
              {graph.nodes
                .filter((n) => n.kind === 'pattern')
                .map((n) => {
                  const p = n.props as unknown as { key: string; label?: string; labelRu?: string };
                  return <option key={n.id} value={p.key}>{p.labelRu ?? p.label ?? p.key}</option>;
                })}
            </select>
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Доп. паттерн (secondary)</label>
            <select value={formSecondary} onChange={(e) => setFormSecondary(e.target.value)} className="pb-edge-form__select">
              <option value="">— нет —</option>
              {graph.nodes
                .filter((n) => n.kind === 'pattern')
                .map((n) => {
                  const p = n.props as unknown as { key: string; label?: string; labelRu?: string };
                  return <option key={n.id} value={p.key}>{p.labelRu ?? p.label ?? p.key}</option>;
                })}
            </select>
          </div>
          <div className="pb-edge-dialog__row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
            <input id="is-static-cb" type="checkbox" checked={formIsStatic} onChange={(e) => setFormIsStatic(e.target.checked)} />
            <label htmlFor="is-static-cb" className="pb-hint">Статическое упражнение (удержание)</label>
          </div>
          {createError && <div className="pb-create-error">{createError}</div>}
          <AppDialogFooter>
            <Button label="Отмена" className="pb-soft p-button-sm" onClick={closeCreate} />
            <Button
              label={saving ? 'Создание…' : 'Создать'}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              className="pb p-button-sm"
              disabled={saving || !formId.trim() || !formLabel.trim()}
              onClick={() => void submitCreate()}
            />
          </AppDialogFooter>
        </AppDialog>

        <AppDialog
          visible={createKind === 'exercise'}
          onHide={closeCreate}
          title="Новое упражнение"
          titleIcon="pi-plus-circle"
          className="pb-create-dialog"
          style={{ width: '500px' }}
          modal
          dismissableMask
          closeOnEscape
        >
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Родительская группа</label>
            <select value={formCanonical} onChange={(e) => setFormCanonical(e.target.value)} className="pb-edge-form__select">
              <option value="">— выберите —</option>
              {graph.nodes
                .filter((n) => n.kind === 'exercise' && (n.props as unknown as { isCanonical?: boolean }).isCanonical)
                .map((n) => {
                  const p = n.props as unknown as { key: string; label?: string; labelRu?: string };
                  return <option key={n.id} value={p.key}>{p.labelRu ?? p.label ?? p.key}</option>;
                })}
            </select>
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">ID (латиница)</label>
            <input type="text" value={formId} onChange={(e) => setFormId(e.target.value)} placeholder="w11-advanced" className="pb-edge-form__select" />
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Название (EN)</label>
            <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Advanced Calf Raise" className="pb-edge-form__select" />
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Название (RU)</label>
            <input type="text" value={formLabelRu} onChange={(e) => setFormLabelRu(e.target.value)} placeholder="Продвинутый подъём на носки" className="pb-edge-form__select" />
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Уровень (число или пусто)</label>
            <input type="number" value={formLevel} onChange={(e) => setFormLevel(e.target.value)} placeholder="11" className="pb-edge-form__select" />
          </div>
          <div className="pb-edge-dialog__row">
            <label className="pb-edge-dialog__label">Benchmark (через ;)</label>
            <input type="text" value={formBenchmark} onChange={(e) => setFormBenchmark(e.target.value)} placeholder="1x5; 2x10; 2x20" className="pb-edge-form__select" />
            <div className="pb-hint">Три ступени ladder, разделённые <code>;</code></div>
          </div>
          <div className="pb-edge-dialog__row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
            <input id="per-side-cb" type="checkbox" checked={formPerSide} onChange={(e) => setFormPerSide(e.target.checked)} />
            <label htmlFor="per-side-cb" className="pb-hint">Выполняется на каждую сторону</label>
          </div>
          {createError && <div className="pb-create-error">{createError}</div>}
          <AppDialogFooter>
            <Button label="Отмена" className="pb-soft p-button-sm" onClick={closeCreate} />
            <Button
              label={saving ? 'Создание…' : 'Создать'}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              className="pb p-button-sm"
              disabled={saving || !formId.trim() || !formLabel.trim() || !formCanonical}
              onClick={() => void submitCreate()}
            />
          </AppDialogFooter>
        </AppDialog>

        <AppDialog
          visible={!!thenicsDialog}
          onHide={closeThenicsDialog}
          title="Добавить из Thenics"
          titleIcon="pi-plus-circle"
          className="pb-create-dialog"
          style={{ width: '480px' }}
          modal
          dismissableMask
          closeOnEscape
        >
          {thenicsDialog && (
            <>
              <div className="pb-hint">
                <b>{thenicsDialog.nameRu ?? thenicsDialog.name}</b>
                {thenicsDialog.nameRu && thenicsDialog.nameRu !== thenicsDialog.name && (
                  <span> · {thenicsDialog.name}</span>
                )}
              </div>

              <div className="pb-edge-dialog__row">
                <label className="pb-edge-dialog__label">Режим</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label className="pb-hint" style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="thenics-mode"
                      checked={thenicsMode === 'exercise'}
                      onChange={() => setThenicsMode('exercise')}
                    />
                    Как упражнение в группе
                  </label>

                  <label className="pb-hint" style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="thenics-mode"
                      checked={thenicsMode === 'group'}
                      onChange={() => setThenicsMode('group')}
                    />
                    Как группу (canonical)
                  </label>
                </div>
              </div>

              {thenicsMode === 'exercise' && (
                <>
                  <div className="pb-edge-dialog__row">
                    <label className="pb-edge-dialog__label">Родительская группа</label>
                    <select
                      value={thenicsParent}
                      onChange={(e) => setThenicsParent(e.target.value)}
                      className="pb-edge-form__select"
                    >
                      <option value="">— выберите —</option>
                      {graph.nodes
                        .filter(
                          (n) =>
                            n.kind === 'exercise' &&
                            (n.props as unknown as { isCanonical?: boolean }).isCanonical,
                        )
                        .map((n) => {
                          const p = n.props as unknown as {
                            key: string;
                            label?: string;
                            labelRu?: string;
                          };
                          return (
                            <option key={n.id} value={p.key}>
                              {p.labelRu ?? p.label ?? p.key}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                  <div className="pb-edge-dialog__row">
                    <label className="pb-edge-dialog__label">
                      Уровень (число или пусто)
                    </label>
                    <input
                      type="number"
                      value={thenicsAsLevel}
                      onChange={(e) => setThenicsAsLevel(e.target.value)}
                      placeholder="1"
                      className="pb-edge-form__select"
                    />
                    <div className="pb-hint">
                      Если задать — узел станет уровнем группы. Если пусто — базовым узлом.
                    </div>
                  </div>
                </>
              )}

              {thenicsMode === 'group' && (
                <div className="pb-hint">
                  Создастся <code>ex:canonical:thenics-{thenicsDialog.key}</code>.
                  Подходит, если у Thenics-элемента своя лестница (например, muscle-up).
                </div>
              )}

              {thenicsError && <div className="pb-create-error">{thenicsError}</div>}

              <AppDialogFooter>
                <Button
                  label="Отмена"
                  className="pb-soft p-button-sm"
                  onClick={closeThenicsDialog}
                />
                <Button
                  label={thenicsSaving ? 'Создание…' : 'Создать'}
                  icon={thenicsSaving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
                  className="pb p-button-sm"
                  disabled={
                    thenicsSaving ||
                    (thenicsMode === 'exercise' && !thenicsParent)
                  }
                  onClick={() => void submitThenicsAdd()}
                />
              </AppDialogFooter>
            </>
          )}
        </AppDialog>

        <AppDialog
          visible={!!editingNode}
          onHide={() => setEditingNode(null)}
          title="Изменить узел"
          titleIcon="pi-pencil"
          className="pb-create-dialog"
          style={{ width: '480px' }}
          modal
          dismissableMask
          closeOnEscape
        >
          {editingNode && (() => {
            const p = editingNode.props as any;
            const isPattern = editingNode.kind === 'pattern';
            const isCanonical = editingNode.kind === 'exercise' && p.isCanonical;
            const isExercise = editingNode.kind === 'exercise' && !p.isCanonical;

            return (
              <>
                <div className="pb-hint">
                  {isPattern ? 'Паттерн' : isCanonical ? 'Группа (canonical)' : 'Упражнение'}
                  {' · '}<code>{p.key}</code>
                </div>

                <div className="pb-edge-dialog__row">
                  <label className="pb-edge-dialog__label">Название (EN)</label>
                  <input
                    type="text"
                    value={editForm.label}
                    onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    className="pb-edge-form__select"
                  />
                </div>

                <div className="pb-edge-dialog__row">
                  <label className="pb-edge-dialog__label">Название (RU)</label>
                  <input
                    type="text"
                    value={editForm.labelRu}
                    onChange={(e) => setEditForm({ ...editForm, labelRu: e.target.value })}
                    className="pb-edge-form__select"
                  />
                </div>

                {isCanonical && (
                  <>
                    <div className="pb-edge-dialog__row">
                      <label className="pb-edge-dialog__label">Паттерн</label>
                      <select
                        value={editForm.pattern}
                        onChange={(e) => setEditForm({ ...editForm, pattern: e.target.value })}
                        className="pb-edge-form__select"
                      >
                        <option value="">— без паттерна —</option>
                        {graph.nodes
                          .filter((n) => n.kind === 'pattern')
                          .map((n) => {
                            const pp = n.props as any;
                            return <option key={n.id} value={pp.key}>{pp.labelRu ?? pp.label ?? pp.key}</option>;
                          })}
                      </select>
                    </div>
                    <div className="pb-edge-dialog__row">
                      <label className="pb-edge-dialog__label">Доп. паттерн</label>
                      <select
                        value={editForm.secondaryPattern}
                        onChange={(e) => setEditForm({ ...editForm, secondaryPattern: e.target.value })}
                        className="pb-edge-form__select"
                      >
                        <option value="">— нет —</option>
                        {graph.nodes
                          .filter((n) => n.kind === 'pattern')
                          .map((n) => {
                            const pp = n.props as any;
                            return <option key={n.id} value={pp.key}>{pp.labelRu ?? pp.label ?? pp.key}</option>;
                          })}
                      </select>
                    </div>
                    <div className="pb-edge-dialog__row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        id="edit-static"
                        type="checkbox"
                        checked={editForm.isStatic}
                        onChange={(e) => setEditForm({ ...editForm, isStatic: e.target.checked })}
                      />
                      <label htmlFor="edit-static" className="pb-hint">Статическое упражнение</label>
                    </div>
                  </>
                )}

                {isExercise && (
                  <>
                    <div className="pb-edge-dialog__row">
                      <label className="pb-edge-dialog__label">Родительская группа</label>
                      <select
                        value={editForm.canonical}
                        onChange={(e) => setEditForm({ ...editForm, canonical: e.target.value })}
                        className="pb-edge-form__select"
                      >
                        {graph.nodes
                          .filter((n) => n.kind === 'exercise' && (n.props as any).isCanonical)
                          .map((n) => {
                            const pp = n.props as any;
                            return <option key={n.id} value={pp.key}>{pp.labelRu ?? pp.label ?? pp.key}</option>;
                          })}
                      </select>
                    </div>
                    <div className="pb-edge-dialog__row">
                      <label className="pb-edge-dialog__label">Уровень (число или пусто)</label>
                      <input
                        type="number"
                        value={editForm.level}
                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                        placeholder="1"
                        className="pb-edge-form__select"
                      />
                    </div>
                    <div className="pb-edge-dialog__row">
                      <label className="pb-edge-dialog__label">Benchmark (через ;)</label>
                      <input
                        type="text"
                        value={editForm.benchmark}
                        onChange={(e) => setEditForm({ ...editForm, benchmark: e.target.value })}
                        placeholder="1x5; 2x10; 2x20"
                        className="pb-edge-form__select"
                      />
                    </div>
                    <div className="pb-edge-dialog__row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        id="edit-perside"
                        type="checkbox"
                        checked={editForm.perSide}
                        onChange={(e) => setEditForm({ ...editForm, perSide: e.target.checked })}
                      />
                      <label htmlFor="edit-perside" className="pb-hint">Выполняется на каждую сторону</label>
                    </div>
                  </>
                )}

                {editError && <div className="pb-create-error">{editError}</div>}

                <AppDialogFooter>
                  <Button
                    label="Отмена"
                    className="pb-soft p-button-sm"
                    onClick={() => setEditingNode(null)}
                  />
                  <Button
                    label={editSaving ? 'Сохранение…' : 'Сохранить'}
                    icon={editSaving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
                    className="pb p-button-sm"
                    disabled={editSaving || !editForm.label.trim()}
                    onClick={() => void submitEditNode()}
                  />
                </AppDialogFooter>
              </>
            );
          })()}
        </AppDialog>

        {isStale && (
          <div className="pb-graph-view__stale" aria-label="Обновление графа">
            <AppIcon name="spinner" spin size="lg" color="accent" />
          </div>
        )}

        {sideOpen && (
          <div className="pb-graph-view__side">
            <div className="pb-graph-view__side-tabs">
              <button
                type="button"
                className={panelTab === 'details' ? 'is-active' : ''}
                onClick={() => setPanelTab('details')}
              >
                Детали
              </button>
              <button
                type="button"
                className={panelTab === 'palette' ? 'is-active' : ''}
                onClick={() => setPanelTab('palette')}
              >
                Палитра
              </button>
            </div>
            {panelTab === 'details' ? (
              <DetailPanel
                graph={graph}
                selectedId={selectedId}
                onClose={() => setSelectedId(undefined)}
                onDeleteEdge={handleDeleteEdge}
                onEditEdge={handleEditEdge}
                onEditNode={handleEditNode}
                onDeleteNode={handleDeleteNode}
              />
            ) : (
              <PalettePanel
                groups={paletteGroups}
                onAdd={handlePaletteAdd}
                onFocus={handleFocusExisting}
                onConfirm={handleConfirmRequest}
              />
            )}
          </div>
        )}

        <ConfirmDialog
          visible={!!deletingNode}
          onHide={() => setDeletingNode(null)}
          className="pb-confirm-dialog"
          header="Удалить узел?"
          message={
            deletingNode
              ? `Удалить "${deletingNode.props.labelRu ?? deletingNode.props.label}" (${deletingNode.id})? Связи с этим узлом будут удалены.`
              : ''
          }
          icon="pi pi-exclamation-triangle"
          accept={() => void confirmDeleteNode()}
          reject={() => setDeletingNode(null)}
          acceptLabel="Удалить"
          rejectLabel="Отмена"
        />
      </div>
    </div>
  );
};