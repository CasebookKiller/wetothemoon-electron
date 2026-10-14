// src/main/services/pranaBindu/mentat/graph/patternMap.old.ts

import type { PatternKey } from './ontology';

// ==================== entry.key → canonical ====================

export const ENTRY_KEY_TO_CANONICAL: Record<string, string> = {
  pushup: 'push-up',
  pullup: 'pull-up',
  dips: 'dip',              // ⭐ отдельный канон «Отжимания на брусьях»
  handstand: 'hspu',        // ⭐ весь Wade HANDSTAND → hspu (жим)
  lsit: 'l-sit',
  planche: 'planche',
  frontlever: 'front-lever',
  plank: 'plank',
  bridge: 'bridge',
  squat: 'squat',
  legraise: 'leg-raise',
  calfraise: 'calf-raise',
};

export function canonicalForEntryKey(entryKey: string): string {
  return ENTRY_KEY_TO_CANONICAL[entryKey] ?? entryKey;
}

// ==================== Человекочитаемые лейблы канонов ====================
//
// Для канонов, чей label не совпадает с entry.label (например, Wade
// HANDSTAND даёт канон hspu — лейбл должен быть «Отжимания в стойке»,
// а не «Стойка на руках»).

export const CANONICAL_LABELS: Record<
  string,
  { label: string; labelRu?: string }
> = {
  'push-up':   { label: 'Push-ups',             labelRu: 'Отжимания' },
  'pull-up':   { label: 'Pull-ups',             labelRu: 'Подтягивания' },
  'dip':       { label: 'Dips',                 labelRu: 'Отжимания на брусьях' },
  'hspu':      { label: 'Handstand Push-ups',   labelRu: 'Отжимания в стойке' },
  'handstand': { label: 'Handstand',            labelRu: 'Стойка на руках' },
  'l-sit':     { label: 'L-sit',                labelRu: 'L-сед' },
  'planche':   { label: 'Planche',              labelRu: 'Планш' },
  'front-lever': { label: 'Front Lever',        labelRu: 'Передний вис' },
  'back-lever':  { label: 'Back Lever',         labelRu: 'Задний вис' },
  'muscle-up': { label: 'Muscle-up',            labelRu: 'Выход силой' },
  'row':       { label: 'Row',                  labelRu: 'Горизонтальная тяга' },
  'plank':     { label: 'Plank',                labelRu: 'Планка' },
  'bridge':    { label: 'Bridge',               labelRu: 'Мостик' },
  'squat':     { label: 'Squat',                labelRu: 'Приседания' },
  'pistol':    { label: 'Pistol Squat',         labelRu: 'Пистолетик' },
  'shrimp':    { label: 'Shrimp Squat',         labelRu: 'Креветка' },
  'lunge':     { label: 'Lunge',                labelRu: 'Выпады' },
  'leg-raise': { label: 'Leg Raises',           labelRu: 'Подъёмы ног' },
  'hollow':    { label: 'Hollow Body',          labelRu: 'Лодочка' },
  'dragon-flag': { label: 'Dragon Flag',        labelRu: 'Драконий флаг' },
  'flag':      { label: 'Human Flag',           labelRu: 'Горизонтальный флаг' },
  'calf-raise': { label: 'Calf Raises',         labelRu: 'Подъёмы на носки' },
  'glute-bridge': { label: 'Glute Bridge',      labelRu: 'Ягодичный мост' },
  'single-leg-rdl': { label: 'Single-Leg RDL',  labelRu: 'Румынская тяга на одной ноге' },
  'wall-sit':  { label: 'Wall Sit',             labelRu: 'Стульчик у стены' },
};

// ==================== entry.key → pattern ====================

export const PROGRESSION_KEY_TO_PATTERN: Record<string, PatternKey | null> = {
  pushup: 'push',
  squat: 'squat',
  pullup: 'pull',
  legraise: 'core-flexion',
  bridge: 'core-extension',
  handstand: 'push',            // ⭐ Wade HANDSTAND → push (а не inversion)
  dips: 'push',                 // ⭐ брусья — тот же паттерн push
  plank: 'core-anti',
  anticore: 'core-anti',
  'core-dragonflag': 'core-anti',
  'core-antiext': 'core-anti',
  lsit: 'straight-arm',
  planche: 'straight-arm',
  frontlever: 'straight-arm',
  runnersquat: 'squat',
  runnerlunge: 'squat',
  runnerleg: 'hinge',
  calfraise: null,
  'posture-upper': null,
  'posture-full': null,
  'weightloss-hiit': null,
  'weightloss-bw': null,
};

// ==================== canonical → pattern ====================

export const CANONICAL_TO_PATTERN: Record<string, PatternKey | null> = {
  // push
  'push-up': 'push',
  hspu: 'push',
  dip: 'push',
  // pull
  'pull-up': 'pull',
  'muscle-up': 'pull',
  // row
  row: 'row',
  // squat / pistol / shrimp / lunge
  squat: 'squat',
  pistol: 'squat',
  shrimp: 'squat',
  lunge: 'squat',
  'wall-sit': 'squat',
  // hinge
  hinge: 'hinge',
  'glute-bridge': 'hinge',
  'single-leg-rdl': 'hinge',
  // core-flexion
  'leg-raise': 'core-flexion',
  hollow: 'core-flexion',
  'dragon-flag': 'core-flexion',
  'windshield-wiper': 'core-flexion',
  twist: 'core-flexion',
  crunch: 'core-flexion',
  // core-anti
  plank: 'core-anti',
  flag: 'core-anti',
  'dead-bug': 'core-anti',
  'bird-dog': 'core-anti',
  pallof: 'core-anti',
  'ab-wheel': 'core-anti',
  'core-antiext': 'core-anti',
  // core-extension
  superman: 'core-extension',
  bridge: 'core-extension',
  // straight-arm
  'l-sit': 'straight-arm',
  'v-sit': 'straight-arm',
  planche: 'straight-arm',
  'front-lever': 'straight-arm',
  'back-lever': 'straight-arm',
  // inversion
  handstand: 'inversion',
  // locomotion
  climber: 'locomotion',
  // null
  'cat-cow': null,
  'calf-raise': null,
};

// ==================== is_static ====================

export const CANONICAL_IS_STATIC: ReadonlySet<string> = new Set([
  'l-sit',
  'v-sit',
  'planche',
  'front-lever',
  'back-lever',
  'flag',
  'handstand',
  'plank',
  'hollow',
]);

// ==================== secondary patterns ====================

export const CANONICAL_SECONDARY_PATTERN: Record<string, PatternKey> = {
  planche: 'push',
  'front-lever': 'pull',
  'back-lever': 'pull',
  'l-sit': 'core-flexion',
  'v-sit': 'core-flexion',
};