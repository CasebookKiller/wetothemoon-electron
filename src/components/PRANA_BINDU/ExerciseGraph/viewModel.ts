// src/components/PRANA_BINDU/ExerciseGraph/viewModel.ts

import type { Node, Edge } from '@xyflow/react';
import type {
  ExerciseGraph,
  GraphNode,
  GraphEdge,
  ExerciseProps,
  PatternProps,
} from '@/main/services/pranaBindu/mentat/graph/ontology';
import type { Filters, ViewNodeData, NodeRole } from './types';
import type { ExerciseIconKey, NodeStats } from './types';

interface NodeColors {
  fill: string;
  stroke: string;
  text: string;
  badgeBg: string;
  borderWidth: string;
}

/** Градация concrete-узлов по level (1..10). */
const LEVEL_COLORS: Record<number, NodeColors> = {
  1:  { fill: '#d7f2f8', stroke: '#8cd9e3', text: '#0a2a35', badgeBg: 'rgba(0,0,0,0.15)', borderWidth: '1px' },
  2:  { fill: '#c2e9f3', stroke: '#7dd0de', text: '#0a2a35', badgeBg: 'rgba(0,0,0,0.15)', borderWidth: '1px' },
  3:  { fill: '#ade0ee', stroke: '#6ec7d9', text: '#0a2a35', badgeBg: 'rgba(0,0,0,0.15)', borderWidth: '1px' },
  4:  { fill: '#98d7e9', stroke: '#5fbdd4', text: '#0a2a35', badgeBg: 'rgba(0,0,0,0.15)', borderWidth: '1px' },
  5:  { fill: '#83cee4', stroke: '#50b3cf', text: '#0a2a35', badgeBg: 'rgba(0,0,0,0.2)',  borderWidth: '1px' },
  6:  { fill: '#6ec5df', stroke: '#41a9ca', text: '#0a2a35', badgeBg: 'rgba(0,0,0,0.2)',  borderWidth: '1px' },
  7:  { fill: '#59bcda', stroke: '#329fc5', text: '#0a2a35', badgeBg: 'rgba(0,0,0,0.2)',  borderWidth: '1px' },
  8:  { fill: '#44b3d5', stroke: '#2395c0', text: '#f0f9fc', badgeBg: 'rgba(0,0,0,0.3)',  borderWidth: '1px' },
  9:  { fill: '#2faad0', stroke: '#148bbb', text: '#f0f9fc', badgeBg: 'rgba(0,0,0,0.3)',  borderWidth: '1px' },
  10: { fill: '#1aa1cb', stroke: '#0581b6', text: '#f0f9fc', badgeBg: 'rgba(0,0,0,0.35)', borderWidth: '2px' },
};

/** Цвета canonical по каталогу. */
const CATALOG_COLORS: Record<string, NodeColors> = {
  wade:     { fill: '#e8a838', stroke: '#ffcb6b', text: '#1a1a1a', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1.5px' },
  thenics:  { fill: '#6b5b8a', stroke: '#8a7aa8', text: '#ece7f5', badgeBg: 'rgba(0,0,0,0.35)', borderWidth: '1.5px' },
  cali:     { fill: '#26c6da', stroke: '#7de3f0', text: '#0a2530', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1.5px' },
  runner:   { fill: '#6fbf73', stroke: '#a0d6a3', text: '#0f2410', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1.5px' },
  named:    { fill: '#64748b', stroke: '#94a3b8', text: '#f0f4f8', badgeBg: 'rgba(0,0,0,0.35)', borderWidth: '1.5px' },
  core:     { fill: '#a78bfa', stroke: '#c4b5fd', text: '#1e1b2e', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1.5px' },
  posture:  { fill: '#f472b6', stroke: '#f9a8d4', text: '#3d1427', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1.5px' },
  weightloss: { fill: '#fb923c', stroke: '#fdba74', text: '#3d1c07', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1.5px' },
  smithrun: { fill: '#c9a96b', stroke: '#e0c493', text: '#2a1e08', badgeBg: 'rgba(0,0,0,0.3)', borderWidth: '1.5px' },
};

/** Thenics-band — фиолетовая шкала светлый → тёмный. */
const BAND_FILLS: Record<number, string> = {
  1: '#d9cdf0',   // Beginner
  2: '#b8a2dc',   // Intermediate
  3: '#8a70b8',   // Advanced
  4: '#5c4396',   // Pro
};

/** Градация по depth — для pattern / program / catalog / сирот. */
const DEPTH_COLORS: Record<number, NodeColors> = {
  0: { fill: '#d4a373', stroke: '#f1c9a5', text: '#1a1a1a', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '2px' },
  1: { fill: '#e8a838', stroke: '#ffcb6b', text: '#1a1a1a', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1.5px' },
  2: { fill: '#26c6da', stroke: '#7de3f0', text: '#0a2530', badgeBg: 'rgba(0,0,0,0.25)', borderWidth: '1px' },
  3: { fill: '#4a5568', stroke: '#718096', text: '#e2e8f0', badgeBg: 'rgba(0,0,0,0.35)', borderWidth: '1px' },
};

function colorsForNode(
  role: NodeRole,
  depth: number,
  catalog: string | undefined,
  level: number | undefined,
): NodeColors {
  // 1. Concrete с level — градиент по целой части уровня.
  // Дробная часть (7.1, 7.2, …) — это номер альтернативного варианта
  // в ветке, основная лестница Wade остаётся 1..10.
  if (role === 'concrete' && typeof level === 'number') {
    const bucket = Math.floor(level);
    return LEVEL_COLORS[bucket] ?? LEVEL_COLORS[5];
  }

  // 2. Canonical (или concrete без level) — по каталогу
  if ((role === 'canonical' || role === 'concrete') && catalog) {
    const c = CATALOG_COLORS[catalog];
    if (c) return c;
  }

  // 3. Program — циан, как depth-2
  if (role === 'program') return DEPTH_COLORS[2];

  // 4. Pattern / catalog / сироты — по depth
  const bucket = depth >= 3 ? 3 : depth;
  return DEPTH_COLORS[bucket] ?? DEPTH_COLORS[3];
}

/** Паттерн → буквенная метка. */
function iconForPattern(pattern?: string): ExerciseIconKey | undefined {
  switch (pattern) {
    case 'push':           return 'PU';
    case 'pull':           return 'PL';
    case 'row':            return 'RW';
    case 'squat':          return 'SQ';
    case 'hinge':          return 'HG';
    case 'core-flexion':   return 'LR';
    case 'core-extension': return 'BR';
    case 'core-anti':      return 'CA';
    case 'inversion':      return 'HS';
    case 'straight-arm':   return 'SA';
    case 'balance':        return 'BL';
    case 'locomotion':     return 'LC';
    default:               return undefined;
  }
}

function classify(n: GraphNode): NodeRole | null {
  switch (n.kind) {
    case 'pattern':  return 'pattern';
    case 'program':  return 'program';
    case 'catalog':  return 'catalog';
    case 'modality': return 'modality';
    case 'tissue':   return 'tissue';
    case 'skill':    return 'skill';
    case 'exercise': {
      const p = n.props as ExerciseProps;
      return p.isCanonical ? 'canonical' : 'concrete';
    }
    default: return null;
  }
}

function passesFilter(n: GraphNode, filters: Filters): boolean {
  const role = classify(n);
  if (!role) return false;
  if (role === 'modality' || role === 'tissue' || role === 'skill') return false;

  if (role === 'concrete') {
    const p = n.props as ExerciseProps;
    if (p.catalog === 'named')        { if (!filters.showNamed) return false; }
    else if (p.catalog === 'thenics') { if (!filters.showThenics) return false; }
    else                              { if (!filters.showConcrete) return false; }
    if (filters.catalogs.size > 0 && !filters.catalogs.has(p.catalog)) return false;
  }

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    const props = n.props as { label?: string; labelRu?: string; key?: string };
    const l  = (props.label ?? '').toLowerCase();
    const lr = (props.labelRu ?? '').toLowerCase();
    const k  = (props.key ?? '').toLowerCase();
    if (!l.includes(q) && !lr.includes(q) && !k.includes(q)) return false;
  }
  return true;
}

/**
 * BFS от pattern-узлов по всем рёбрам, кроме `equivalent-to`.
 * Граф смешанный: instance-of смотрит concrete → canonical → pattern,
 * used-in смотрит canonical → program, belongs-to — concrete → catalog.
 * Поэтому идём как по undirected.
 * depth 0 — pattern, 1 — canonical, 2 — concrete/programs, 3+ — хвосты.
 */
function computeDepths(
  graph: ExerciseGraph,
  visible: Set<string>,
): Map<string, number> {
  const depth = new Map<string, number>();

  // Построим неориентированную смежность
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string): void => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const e of graph.edges) {
    if (e.kind === 'equivalent-to') continue;
    add(e.source, e.target);
    add(e.target, e.source);
  }

  const queue: string[] = [];
  for (const n of graph.nodes) {
    if (n.kind === 'pattern' && visible.has(n.id)) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }

  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const nb of adj.get(id) ?? []) {
      if (!visible.has(nb)) continue;
      if (depth.has(nb)) continue;
      depth.set(nb, d + 1);
      queue.push(nb);
    }
  }
  return depth;
}

function toRfNode(
  n: GraphNode,
  depth: number,
  patternByCanonical: Map<string, string>,
  programExerciseCounts: Map<string, number>,
  catalogCanonCount: Map<string, number>,      // ← новое
  catalogLevelCount: Map<string, number>,      // ← новое
  catalogIcons: Map<string, string[]>,         // ← новое
): Node<ViewNodeData> {
  const role = classify(n) ?? 'canonical';
  const props = n.props as unknown as Record<string, unknown>;
  const bucket = depth >= 3 ? 3 : depth;
  const isConcreteWithLevel = role === 'concrete' && typeof props.level === 'number';
  const catalog = typeof props.catalog === 'string' ? props.catalog : '';

  // pattern concrete-узла берём из его canonical
  const canonKey = (typeof props.canonical === 'string' ? props.canonical : '') ||
                   (typeof props.key === 'string' ? props.key : '');
  const pattern =
    (typeof props.pattern === 'string' ? props.pattern : undefined) ??
    patternByCanonical.get(canonKey);

  const exerciseIcon = computeIconKey({
    key: typeof props.key === 'string' ? props.key : undefined,
    iconKey: typeof props.iconKey === 'string' ? props.iconKey : undefined,
    pattern,
    catalog,
    categories: Array.isArray(props.categories) ? (props.categories as string[]) : undefined,
  });

  // Бейдж
  let badge: string | undefined;
  if (role === 'concrete' && typeof props.level === 'number') {
    badge = props.perSide ? `${props.level} · L/R` : `L${props.level}`;
    if (catalog === 'wade' && props.level != null) badge = `W${props.level}`;
  } else if (role === 'canonical') {
    // для canonical badge не нужен
  }

  // Footer-текст
  let footerText: string | undefined;
  if (role === 'canonical') {
    const count = (props._childCount as number | undefined) ?? undefined;
    if (typeof count === 'number') footerText = `${count} ${plural(count, 'уровень', 'уровня', 'уровней')}`;
  } else if (role === 'pattern') {
    const count = (props._childCount as number | undefined) ?? undefined;
    if (typeof count === 'number') footerText = `${count} ${plural(count, 'канон', 'канона', 'канонов')}`;
  } else if (role === 'program') {
    const total = programExerciseCounts.get(String(props.key ?? '')) ?? 0;
    if (total > 0) {
      footerText = `${total} ${plural(total, 'упражнение', 'упражнения', 'упражнений')}`;
    }
  } else if (role === 'catalog') {
    const catId = typeof props.id === 'string' ? props.id : '';
    const cc = catalogCanonCount.get(catId) ?? 0;
    const lc = catalogLevelCount.get(catId) ?? 0;

    const parts: string[] = [];
    if (cc > 0) parts.push(`${cc} ${plural(cc, 'канон', 'канона', 'канонов')}`);
    if (lc > 0) parts.push(`${lc} ${plural(lc, 'упражнение', 'упражнения', 'упражнений')}`);
    if (parts.length > 0) footerText = parts.join(' · ');
  }

  const classes = [
    'pb-node',
    isConcreteWithLevel ? `pb-node--level-${props.level}` : `pb-node--depth-${bucket}`,
    catalog ? `pb-node--catalog-${catalog}` : '',
  ].filter(Boolean).join(' ');

  // Тип компонента для React Flow
  const rfType =
    role === 'pattern' ? 'patternNode' :
    role === 'program' ? 'programNode' :
    role === 'catalog' ? 'catalogNode' :
    (role === 'canonical' || role === 'concrete') ? 'exerciseNode' :
    'default';

  const explicitPos =
    props.pos && typeof props.pos === 'object'
      ? (props.pos as { x: number; y: number })
      : undefined;

  const colors = colorsForNode(
    role,
    depth,
    catalog || undefined,
    typeof props.level === 'number' ? props.level : undefined,
  );

  const bandFill =
    typeof props.band === 'number' ? BAND_FILLS[props.band] : undefined;

  return {
    id: n.id,
    type: rfType,
    className: classes,
    position: explicitPos ?? { x: 0, y: 0 },
    style: {
      '--node-fill': colors.fill,
      '--node-stroke': colors.stroke,
      '--node-text': colors.text,
      '--node-badge-bg': colors.badgeBg,
      '--node-border-width': colors.borderWidth,
      ...(bandFill ? { '--node-band-fill': bandFill } : {}),
    } as React.CSSProperties,
    data: {
      id: n.id,
      role,
      depth,
      label: (typeof props.labelRu === 'string' && props.labelRu) || String(props.label ?? props.key ?? n.id),
      labelRu: typeof props.labelRu === 'string' ? props.labelRu : undefined,
      pattern,
      catalog: typeof props.catalog === 'string' ? props.catalog : undefined,
      level: typeof props.level === 'number' ? props.level : undefined,
      isStatic: props.isStatic === true,
      badge,
      exerciseIcon,
      footerText,
      icons: role === 'catalog'
      ? (Array.isArray((props as any)._iconsForFooter)
          ? (props as any)._iconsForFooter
          : undefined)
      : undefined,
      _explicitPos: explicitPos,
    } as ViewNodeData,
  };
}

/** Русский плюрализатор: plural(5, 'канон', 'канона', 'канонов') → 'канонов' */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const EDGE_STYLE: Record<string, { stroke: string; dash?: string; width?: number }> = {
  // Прогрессии — синий спектр
  'progresses-to':    { stroke: '#4aa8ff', width: 2 },
  'variant-of':       { stroke: '#6dc0ff', dash: '6 3', width: 1.5 },
  'progression-from': { stroke: '#4aa8ff', dash: '4 3', width: 1.5 },
  'modality-of':      { stroke: '#a78bfa', width: 1.5 },
  
  // Иерархия паттернов
  'parent-of':        { stroke: '#a78bfa', dash: '2 4', width: 1.2 },
  
  // Иерархия — очень приглушённый серый (структурные, чтоб не доминировали)
  'instance-of':      { stroke: 'rgba(180, 180, 180, 0.30)', width: 1 },
  'belongs-to':       { stroke: 'rgba(180, 180, 180, 0.14)', width: 1 },

  // Кросс-каталог — золотой пунктир
  'equivalent-to':    { stroke: '#d4a373', dash: '4 4', width: 1.5 },

  // Предусловия — красный
  'requires':         { stroke: '#ec5b5b', width: 1.5 },
  'conflicts-with':   { stroke: '#ec3942', width: 2 },

  // Специальные
  'trains':           { stroke: '#6fbf73', width: 1.5 },
  'targets':          { stroke: '#26c6da', width: 1.5 },
  'warms-up':         { stroke: '#e8a838', width: 1.5 },
  'used-in':          { stroke: 'rgba(120, 160, 220, 0.45)', width: 1, dash: '2 4' },
};

function toRfEdge(e: GraphEdge): Edge {
  const st =
    EDGE_STYLE[e.kind] ?? { stroke: 'rgba(180, 180, 180, 0.30)', width: 1 };
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'floating', //'default',
    animated: false,
    style: {
      stroke: st.stroke,
      strokeWidth: st.width ?? 1,
      strokeDasharray: st.dash,
    },
    data: { kind: e.kind },
  };
}

/** Множества узлов, участвующих в прогрессиях. */
function computeProgressionSets(graph: ExerciseGraph): {
  nodes: Set<string>;      // concrete в цепочках
  canonicals: Set<string>; // каноны с цепочкой
  patterns: Set<string>;   // паттерны с цепочкой
} {
  const nodes = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind === 'progresses-to') {
      nodes.add(e.source);
      nodes.add(e.target);
    }
  }
  const canonicals = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind === 'instance-of' && nodes.has(e.source)) {
      canonicals.add(e.target);
    }
  }
  const patterns = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind === 'instance-of' && canonicals.has(e.source)) {
      patterns.add(e.target);
    }
  }
  return { nodes, canonicals, patterns };
}

/**
 * Определяет буквенную метку движения.
 * Приоритет:
 *   1. Спец-маппинг по props.key (например, calfraise → AK).
 *   2. По categories (для named: drill / plyo / prehab / run-basic).
 *   3. По pattern.
 *
 * TODO: когда появятся кастомные иконки — добавить `props.iconKey` в JSON
 * и разрешать явное переопределение из данных.
 */
/** Хардкод fallback. Когда мигрируем все каталоги — станет минимальным. */
const KEY_TO_ICON: Record<string, ExerciseIconKey> = {
  // Wade / Hspu — не выводится из pattern
  hspu: 'HS',

  // Runner
  calfraise:   'AK',
  runnerleg:   'HG',
  runnersquat: 'SQ',
  runnerlunge: 'SQ',
  anticore:    'CA',

  // Core
  'core-antiext':    'CA',
  'core-dragonflag': 'LR',

  // Prehab: foot / ankle
  'tibialis-raises':     'AK',
  'toe-yoga':            'AK',
  'short-foot':          'AK',
  'eccentric-heel-drop': 'AK',
  'towel-scrunch':       'AK',
  'marble-pickup':       'AK',
  'big-toe-extension':   'AK',
  'isometric-calf-hold': 'AK',

  // Prehab: knee
  'terminal-knee-extension': 'KN',
  'step-downs':              'KN',
  'wall-sit':                'KN',

  // Prehab: hip
  clamshells:          'HP',
  'lateral-band-walk': 'HP',
  'monster-walk':      'HP',
  'fire-hydrants':     'HP',
  'hip-flexor-stretch': 'HP',

  // Prehab: spine
  'cat-cow':           'SPN',
  'superman-hold':     'SPN',
  'thoracic-rotation': 'SPN',

  // Prehab: shoulder
  'band-pull-apart': 'SH',
  'wall-slide':      'SH',
  'sleeper-stretch': 'SH',

  // Mobility
  pigeon: 'MOB',
  butterfly: 'MOB',
  pancake: 'MOB',
  'front-split': 'MOB',
  'middle-split': 'MOB',
  'frog-stretch': 'MOB',
  'spiderman-stretch': 'MOB',
  'spiderman-stretch-rotation': 'MOB',
  'seated-forward-bend': 'MOB',

  // Warmup cardio
  'jumping-jacks': 'CF',
};

const PATTERN_TO_ICON: Record<string, ExerciseIconKey> = {
  push: 'PU',
  pull: 'PL',
  row: 'RW',
  squat: 'SQ',
  hinge: 'HG',
  'core-flexion': 'LR',
  'core-extension': 'BR',
  'core-anti': 'CA',
  inversion: 'HS',
  'straight-arm': 'SA',
  balance: 'BL',
  locomotion: 'LC',
};

const CATEGORY_TO_ICON: Record<string, ExerciseIconKey> = {
  drill: 'DR',
  plyo: 'PLY',
  'run-basic': 'LC',
};

function computeIconKey(props: {
  key?: string;
  iconKey?: string;
  pattern?: string;
  catalog?: string;
  categories?: string[];
}): ExerciseIconKey | undefined {
  // 1. Явное поле из JSON (узел или canonical)
  if (props.iconKey) return props.iconKey as ExerciseIconKey;

  // 2. Спец-маппинг по ключу
  if (props.key && KEY_TO_ICON[props.key]) return KEY_TO_ICON[props.key];

  // 3. Named-категория
  if (props.catalog === 'named' && props.categories?.[0]) {
    const c = CATEGORY_TO_ICON[props.categories[0]];
    if (c) return c;
  }

  // 4. По паттерну
  if (props.pattern && PATTERN_TO_ICON[props.pattern]) {
    return PATTERN_TO_ICON[props.pattern];
  }

  return undefined;
}

export function buildViewGraph(
  graph: ExerciseGraph,
  filters: Filters,
  selectedId?: string,
): { nodes: Node<ViewNodeData>[]; edges: Edge[] } {
  // 1. Базовый фильтр
  const visible = new Set<string>();
  for (const n of graph.nodes) {
    if (passesFilter(n, filters)) visible.add(n.id);
  }

  // 2. Фильтр по паттернам (+ потомки через parent-of)
  if (filters.patterns.size > 0) {
    // 2a. Разворачиваем выбранные паттерны до их потомков
    const expandedPatterns = new Set<string>(filters.patterns);
    for (const e of graph.edges) {
      if (e.kind !== 'parent-of') continue;
      const parent = e.target.replace(/^pat:/, '');
      const child = e.source.replace(/^pat:/, '');
      if (filters.patterns.has(parent)) expandedPatterns.add(child);
    }

    // 2b. Каноны, привязанные к расширенному набору паттернов
    const canonicalsInPattern = new Set<string>();
    for (const e of graph.edges) {
      if (
        e.kind === 'instance-of' &&
        expandedPatterns.has(e.target.replace(/^pat:/, ''))
      ) {
        canonicalsInPattern.add(e.source);
      }
    }

    // 2c. Фильтруем visible
    for (const id of Array.from(visible)) {
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) continue;
      const role = classify(node);
      if (role === 'pattern') {
        if (!expandedPatterns.has(id.replace(/^pat:/, ''))) visible.delete(id);
      } else if (role === 'canonical') {
        if (!canonicalsInPattern.has(id)) visible.delete(id);
      } else if (role === 'concrete') {
        const has = graph.edges.some(
          (e) =>
            e.kind === 'instance-of' &&
            e.source === id &&
            canonicalsInPattern.has(e.target),
        );
        if (!has) visible.delete(id);
      } else if (role === 'program') {
        const has = graph.edges.some(
          (e) =>
            e.kind === 'used-in' &&
            e.target === id &&
            canonicalsInPattern.has(e.source),
        );
        if (!has) visible.delete(id);
      }
    }
  }

  // 3. Только с прогрессиями — отсеиваем всё, что не в цепочке
  if (filters.onlyWithProgression) {
    const sets = computeProgressionSets(graph);
    for (const id of Array.from(visible)) {
      const node = graph.nodes.find((n) => n.id === id);
      if (!node) continue;
      const role = classify(node);
      if (role === 'concrete' && !sets.nodes.has(id)) {
        visible.delete(id);
        continue;
      }
      if (role === 'canonical' && !sets.canonicals.has(id)) {
        visible.delete(id);
        continue;
      }
      if (role === 'pattern' && !sets.patterns.has(id)) {
        visible.delete(id);
        continue;
      }
      // программы, catalogs, modality, tissue, skill — вообще убираем
      if (role === 'program' || role === 'catalog') {
        visible.delete(id);
      }
    }
  }

  // 4. Глубины
  const depths = computeDepths(graph, visible);

  // 5. RF-узлы
  // pattern по canonical-key
  const patternByCanonical = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.kind !== 'exercise') continue;
    const p = n.props as unknown as Record<string, unknown>;
    if (p.isCanonical === true && typeof p.pattern === 'string' && typeof p.key === 'string') {
      patternByCanonical.set(p.key, p.pattern);
    }
  }

  // child-count для canonical / pattern
  const childCountByNode = new Map<string, number>();
  for (const e of graph.edges) {
    if (e.kind === 'instance-of') {
      childCountByNode.set(e.target, (childCountByNode.get(e.target) ?? 0) + 1);
    }
  }
  // Отдельная map: только instance-of, где target — canonical
const childCountByCanonical = new Map<string, number>();
for (const e of graph.edges) {
  if (
    e.kind === 'instance-of' &&
    e.target.startsWith('ex:canonical:')
  ) {
    childCountByCanonical.set(
      e.target,
      (childCountByCanonical.get(e.target) ?? 0) + 1,
    );
  }
}

// Программа → суммарное количество уровней её канонов
const programExerciseCounts = new Map<string, number>();
for (const e of graph.edges) {
  if (e.kind !== 'used-in') continue;

  const progKey = e.target.replace(/^prg:/, '');
  const source = e.source;

  let contribution = 1;
  if (source.startsWith('ex:canonical:')) {
    contribution = childCountByCanonical.get(source) ?? 1;
  }

  programExerciseCounts.set(
    progKey,
    (programExerciseCounts.get(progKey) ?? 0) + contribution,
  );
}
  // добавляем в props перед toRfNode
  for (const n of graph.nodes) {
    const count = childCountByNode.get(n.id);
    if (count !== undefined) {
      (n.props as any)._childCount = count;
    }
  }

  // Каталог → количество канонов и уровней
  const catalogCanonCount = new Map<string, number>();
  const catalogLevelCount = new Map<string, number>();
  // Каталог → набор iconKey канонов (для опционального вывода)
  const catalogIcons = new Map<string, string[]>();

  for (const n of graph.nodes) {
    if (n.kind !== 'exercise') continue;
    const p = n.props as unknown as Record<string, unknown>;
    const cat = typeof p.catalog === 'string' ? p.catalog : '';
    if (!cat) continue;

    if (p.isCanonical === true) {
      catalogCanonCount.set(cat, (catalogCanonCount.get(cat) ?? 0) + 1);
      // iconKey канона (из props.iconKey или через computeIconKey)
      const icon = (typeof p.iconKey === 'string' ? p.iconKey : undefined)
        ?? computeIconKey({
          key: typeof p.key === 'string' ? p.key : undefined,
          pattern: typeof p.pattern === 'string' ? p.pattern : undefined,
          catalog: cat,
          categories: Array.isArray(p.categories) ? (p.categories as string[]) : undefined,
        });
      if (icon) {
        const list = catalogIcons.get(cat) ?? [];
        if (!list.includes(icon)) list.push(icon);
        catalogIcons.set(cat, list);
      }
    } else {
      // concrete-узлы — считаем по каталогу их canonical
      catalogLevelCount.set(cat, (catalogLevelCount.get(cat) ?? 0) + 1);
    }
  }
 
  const rfNodes: Node<ViewNodeData>[] = [];
  for (const n of graph.nodes) {
    if (!visible.has(n.id)) continue;
    rfNodes.push(
      toRfNode(
        n,
        depths.get(n.id) ?? 99,
        patternByCanonical,
        programExerciseCounts,
        catalogCanonCount,
        catalogLevelCount,
        catalogIcons,
      )
);
  }

  // 6. RF-рёбра
  const rfEdges: Edge[] = [];
  for (const e of graph.edges) {
    if (e.kind === 'equivalent-to') {
      if (!selectedId || (e.source !== selectedId && e.target !== selectedId)) continue;
    }
    if (!visible.has(e.source) || !visible.has(e.target)) continue;
    rfEdges.push(toRfEdge(e));
  }

  return { nodes: rfNodes, edges: rfEdges };
}