// src/components/PRANA_BINDU/UTILS/chainEvaluator.ts
//
// Сравнение цепочки (со слотами) с конкретным треком.
// Для каждого слота: собрать атомы (из clusters + specificAtoms),
// прогнать computeDeviationFast, выбрать (aggregate='best') или
// суммировать (aggregate='sum') проходы, сравнить с expectedRepeats.
//
// См. 18b_ATOM_CHAINS.md, раздел C.12.

import type { CoverageThresholds } from './coverageThresholds';
import {
  buildRefIndex,
  computeDeviationFast,
  classifyCoverage,
} from './coverageIndex';

// ==================== Входные типы ====================

/** Минимальный набор про атом для алгоритма. */
export interface RefTrackForEval {
  id: number;
  name: string;
  coords: [number, number][];
  lengthM: number;
  kind: 'loop' | 'linear' | 'stadium' | null;
  /** Теги, включая `group:<name>` — для сопоставления со слотами. */
  tags: string[];
}

/** Лёгкий слот (только то, что нужно алгоритму). */
export interface SlotForEval {
  orderIndex: number;
  expectedRepeatsMin: number;
  expectedRepeatsMax: number;
  aggregate: 'best' | 'sum';
  minCoverage: number;
  optional: boolean;
  clusters: string[];
  specificAtoms: number[];
}

/** Лёгкая цепочка (без id и timestamps). */
export interface ChainForEval {
  id: number;
  name: string;
  ordered: boolean;
  slots: SlotForEval[];
}

// ==================== Выходные типы ====================

export type SlotStatus =
  | 'passed'         // sum/repeats в [min, max]
  | 'partial'        // sum/repeats < min (не дотянул)
  | 'over'           // sum/repeats > max (перевыполнил)
  | 'failed'         // 0 атомов покрыли minCoverage, слот обязательный
  | 'skipped'        // 0 атомов, слот optional
  | 'optional-miss'; // optional слот, но частично/не дотянул

export interface SelectedAtom {
  refId: number;
  name: string;
  lengthM: number;
  coveragePct: number;
  repeats: number;
  score: number;
}

export interface SlotEvaluation {
  slotIndex: number;
  status: SlotStatus;
  expectedMin: number;
  expectedMax: number;
  /** Фактическое число проходов (для best — repeats выбранного; для sum — сумма). */
  actualRepeats: number;
  aggregate: 'best' | 'sum';
  optional: boolean;
  /** Атомы, засчитанные в слот. Для best — 0 или 1; для sum — все прошедшие. */
  selectedAtoms: SelectedAtom[];
  /** Атомы, прошедшие по coverage, но не выбранные (для best — альтернативы). */
  alternatives: SelectedAtom[];
}

export interface ChainEvaluation {
  chainId: number;
  chainName: string;
  ordered: boolean;
  slots: SlotEvaluation[];
  overallStatus: 'complete' | 'partial' | 'failed';
  /** Сводка по слотам (для UI-плашки). */
  summary: {
    total: number;
    passed: number;
    partial: number;
    over: number;
    failed: number;
    skipped: number;
    optional: number;
  };
}

// ==================== Основная функция ====================

export function evaluateChain(
  chain: ChainForEval,
  trackLatlng: [number, number][],
  refTracks: RefTrackForEval[],
  thresholds: CoverageThresholds,
): ChainEvaluation {
  const slots: SlotEvaluation[] = chain.slots.map((slot, idx) =>
    evaluateSlot(idx, slot, trackLatlng, refTracks, thresholds),
  );

  const summary = {
    total: slots.length,
    passed: slots.filter((s) => s.status === 'passed').length,
    partial: slots.filter(
      (s) => s.status === 'partial' || s.status === 'optional-miss',
    ).length,
    over: slots.filter((s) => s.status === 'over').length,
    failed: slots.filter((s) => s.status === 'failed').length,
    skipped: slots.filter((s) => s.status === 'skipped').length,
    optional: slots.filter((s) => s.optional).length,
  };

  // Общий статус:
  //  - failed: хотя бы один обязательный слот = failed
  //  - partial: хотя бы один слот partial/optional-miss
  //  - complete: всё passed или skipped (optional)
  let overallStatus: ChainEvaluation['overallStatus'] = 'complete';
  if (summary.failed > 0) overallStatus = 'failed';
  else if (summary.partial > 0) overallStatus = 'partial';

  return {
    chainId: chain.id,
    chainName: chain.name,
    ordered: chain.ordered,
    slots,
    overallStatus,
    summary,
  };
}

// ==================== Слот ====================

function evaluateSlot(
  slotIndex: number,
  slot: SlotForEval,
  trackLatlng: [number, number][],
  refTracks: RefTrackForEval[],
  thresholds: CoverageThresholds,
): SlotEvaluation {
  const candidates = collectCandidates(
    slot,
    trackLatlng,
    refTracks,
    thresholds,
  );

  const empty: SlotEvaluation = {
    slotIndex,
    status: slot.optional ? 'skipped' : 'failed',
    expectedMin: slot.expectedRepeatsMin,
    expectedMax: slot.expectedRepeatsMax,
    actualRepeats: 0,
    aggregate: slot.aggregate,
    optional: slot.optional,
    selectedAtoms: [],
    alternatives: [],
  };

  if (candidates.length === 0) return empty;

  if (slot.aggregate === 'best') {
    // Выбираем один с максимальным score.
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const alternatives = candidates.slice(1);
    const actualRepeats = best.repeats;
    const status = computeStatus(
      actualRepeats,
      slot.expectedRepeatsMin,
      slot.expectedRepeatsMax,
      slot.optional,
    );
    return {
      ...empty,
      status,
      actualRepeats,
      selectedAtoms: [best],
      alternatives,
    };
  }

  // aggregate === 'sum'
  const actualRepeats = candidates.reduce((s, c) => s + c.repeats, 0);
  const status = computeStatus(
    actualRepeats,
    slot.expectedRepeatsMin,
    slot.expectedRepeatsMax,
    slot.optional,
  );
  return {
    ...empty,
    status,
    actualRepeats,
    selectedAtoms: candidates,
    alternatives: [],
  };
}

function collectCandidates(
  slot: SlotForEval,
  trackLatlng: [number, number][],
  refTracks: RefTrackForEval[],
  thresholds: CoverageThresholds,
): SelectedAtom[] {
  // Собираем id атомов: specificAtoms + все, у кого есть нужный group:*
  const atomIds = new Set<number>(slot.specificAtoms);

  if (slot.clusters.length > 0) {
    const wanted = new Set(
      slot.clusters.map((c) => (c.startsWith('group:') ? c : `group:${c}`)),
    );
    for (const ref of refTracks) {
      if (!ref.tags || ref.tags.length === 0) continue;
      const hit = ref.tags.some((t) => wanted.has(t));
      if (hit) atomIds.add(ref.id);
    }
  }

  const result: SelectedAtom[] = [];

  for (const atomId of atomIds) {
    const ref = refTracks.find((r) => r.id === atomId);
    if (!ref || ref.coords.length < 2) continue;

    const idx = buildRefIndex(ref.coords);
    const dev = computeDeviationFast(
      trackLatlng,
      idx,
      thresholds.coverageRadiusM,
      thresholds.onRefRadiusM,
      thresholds.checkpointCount ?? 6,
    );
    if (!dev) continue;

    if (dev.coveragePct < slot.minCoverage) continue;

    const cls = classifyCoverage(
      {
        coveragePct: dev.coveragePct,
        medianM: dev.medianM,
        metersOnRef: dev.metersOnRef,
        atomLenM: ref.lengthM,
        atomKind: ref.kind,
        repeats: dev.repeats,
      },
      thresholds,
    );

    if (cls.cls === 'unused') continue;

    result.push({
      refId: ref.id,
      name: ref.name,
      lengthM: ref.lengthM,
      coveragePct: dev.coveragePct,
      repeats: cls.repeats,
      score: cls.score,
    });
  }

  return result;
}

function computeStatus(
  actual: number,
  min: number,
  max: number,
  optional: boolean,
): SlotStatus {
  if (actual >= min && actual <= max) return 'passed';
  if (actual > max) return 'over';
  // actual < min
  if (actual === 0) return optional ? 'skipped' : 'failed';
  return optional ? 'optional-miss' : 'partial';
}