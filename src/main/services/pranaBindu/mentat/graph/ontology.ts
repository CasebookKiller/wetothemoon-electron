// src/main/services/pranaBindu/mentat/graph/ontology.ts
//
// Только типы и id-хелперы. Seed-данные (паттерны, ткани, навыки,
// модальности) живут в JSON-файлах графов. Фабрики узлов — в loader.ts.

// ==================== Узлы ====================

export type NodeKind =
  | 'pattern'
  | 'exercise'
  | 'modality'
  | 'catalog'
  | 'tissue'
  | 'skill'
  | 'program';

// ==================== Рёбра ====================

export type EdgeKind =
  | 'progresses-to'
  | 'variant-of'
  | 'progression-from'
  | 'modality-of'
  | 'instance-of'
  | 'belongs-to'
  | 'equivalent-to'
  | 'requires'
  | 'conflicts-with'
  | 'trains'
  | 'targets'
  | 'warms-up'
  | 'used-in'
  | 'parent-of';

// ==================== Ключи ====================

export type PatternKey =
  | 'push'
  | 'pull'
  | 'row'
  | 'squat'
  | 'hinge'
  | 'core-flexion'
  | 'core-extension'
  | 'core-anti'
  | 'inversion'
  | 'straight-arm'
  | 'balance'
  | 'locomotion';

export type ModalityKey =
  | 'ring'
  | 'band'
  | 'weighted'
  | 'negative'
  | 'assisted'
  | 'isometric'
  | 'explosive';

export type TissueKey = string;
export type SkillKey = string;

export type CatalogId =
  | 'wade'
  | 'cali'
  | 'runner'
  | 'core'
  | 'posture'
  | 'weightloss'
  | 'named'
  | 'thenics';

export type DifficultyBand = 1 | 2 | 3 | 4;

// ==================== Свойства узлов ====================

export interface BaseNodeProps {
  label: string;
  labelRu?: string;
  pos?: { x: number; y: number };
}

export interface PatternProps extends BaseNodeProps {
  kind: 'pattern';
  key: PatternKey;
}

export interface ExerciseProps extends BaseNodeProps {
  kind: 'exercise';
  key: string;
  catalog: CatalogId;
  level?: number;
  isCanonical: boolean;
  isStatic?: boolean;
  secondaryPattern?: PatternKey;
  aliases?: string[];
  icuName?: string;
  categories?: string[];
  notes?: string;
  perSide?: boolean;
  benchmark?: string[];
  /** Буквенная метка типа движения. */
  iconKey?: string;
  /** Thenics-band (1..4). Независим от `level`, кодирует метку Thenics. */
  band?: DifficultyBand;
}

export interface ModalityProps extends BaseNodeProps {
  kind: 'modality';
  key: ModalityKey;
}

export interface CatalogProps extends BaseNodeProps {
  kind: 'catalog';
  id: CatalogId;
  labelRu?: string;   // BaseNodeProps уже включает labelRu, проверь
}

export interface TissueProps extends BaseNodeProps {
  kind: 'tissue';
  key: TissueKey;
}

export interface SkillProps extends BaseNodeProps {
  kind: 'skill';
  key: SkillKey;
}

export interface ProgramProps extends BaseNodeProps {
  kind: 'program';
  key: string;
  category: string;
}

export type NodeProps =
  | PatternProps
  | ExerciseProps
  | ModalityProps
  | CatalogProps
  | TissueProps
  | SkillProps
  | ProgramProps;

// ==================== Граф ====================

export interface GraphNode<P extends NodeProps = NodeProps> {
  id: string;
  kind: NodeKind;
  props: P;
}

export interface GraphEdge {
  id: string;
  kind: EdgeKind;
  source: string;
  target: string;
  props?: Record<string, unknown>;
}

export interface ExerciseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ==================== ID-хелперы ====================

export const patternId         = (key: string): string => `pat:${key}`;
export const canonicalExerciseId = (key: string): string => `ex:canonical:${key}`;
export const concreteExerciseId = (
  catalog: string,
  canonKey: string,
  level?: number,
  nodeId?: string,
): string => {
  if (level !== undefined) return `ex:${catalog}:${canonKey}:${level}`;
  if (nodeId) return `ex:${catalog}:${canonKey}:${nodeId}`;
  return `ex:${catalog}:${canonKey}`;
};
export const modalityId  = (key: string): string => `mod:${key}`;
export const catalogId   = (id: string): string => `cat:${id}`;
export const tissueId    = (key: string): string => `tis:${key}`;
export const skillId     = (key: string): string => `skl:${key}`;
export const programId   = (key: string): string => `prg:${key}`;