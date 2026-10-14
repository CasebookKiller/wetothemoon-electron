// src/main/services/pranaBindu/mentat/equivalences.ts

export type DifficultyBand = 1 | 2 | 3 | 4; // Beginner..Pro

export type CatalogId =
  | 'thenics'    // внешний, 4 band'а
  | 'wade'       // Big-6, 10 уровней
  | 'cali'       // общая калистеника, 10 уровней
  | 'runner'     // силовая для бегунов, 10 уровней
  | 'core'       // кор, 10 уровней
  | 'posture'    // осанка, 10 уровней
  | 'weightloss' // HIIT / жиросжигание, 10 уровней
  | 'named';     // NAMED_EXERCISES без уровней

export interface CatalogRef {
  /** Ключ записи в соответствующем каталоге (pushup / push-up / dips / a-skip). */
  key: string;
  /** Уровень 1..10 — только для 10-уровневых каталогов. */
  level?: number;
  /** Band 1..4 — только для Thenics. */
  band?: DifficultyBand;
  /** Модальность внутри каталога: base / assisted / negative / ring / band / weighted / … */
  modality?: string;
}

export interface Equivalence {
  /** Канонический смысл движения: push-up, pull-up, front-lever, lunge, … */
  canonical: string;
  /** Модальность верхнего уровня: base / archer / one-arm / tuck / straddle / full / … */
  modality: string;
  /** Ссылки на записи в наших каталогах и во внешнем. */
  refs: Partial<Record<CatalogId, CatalogRef>>;
  /** Заметка: расхождение шкал, спорное сопоставление, причина. */
  note?: string;
}

export const EQUIVALENCES: Equivalence[] = [
  // ================= PUSH =================
  { canonical: 'push-up', modality: 'knee',
    refs: {
      thenics: { key: 'knee-push-up', band: 1 },
      wade:    { key: 'pushup', level: 3 },
    },
    note: 'Thenics Beginner ≈ Wade 3 (Kneeling).' },

  { canonical: 'push-up', modality: 'incline',
    refs: {
      thenics: { key: 'incline-push-up', band: 1 },
      wade:    { key: 'pushup', level: 2 },
    } },

  { canonical: 'push-up', modality: 'base',
    refs: {
      thenics: { key: 'push-up', band: 1 },
      wade:    { key: 'pushup', level: 5 },
      weightloss: { key: 'weightloss-bw', level: 3 },
    },
    note: 'Thenics Beginner = Wade Full Push-ups. У нас — середина шкалы.' },

  { canonical: 'push-up', modality: 'diamond',
    refs: {
      thenics: { key: 'diamond-push-up', band: 1 },
      wade:    { key: 'pushup', level: 6 },
    } },

  { canonical: 'push-up', modality: 'wide',
    refs: { thenics: { key: 'wide-push-up', band: 1 } },
    note: 'В Wade-лестнице отдельного уровня нет.' },

  { canonical: 'push-up', modality: 'archer',
    refs: { thenics: { key: 'archer-push-up', band: 2 } },
    note: 'Между Wade 7 (Uneven) и Wade 8 (1/2 One-Arm).' },

  { canonical: 'push-up', modality: 'one-arm',
    refs: {
      thenics: { key: 'one-arm-push-up', band: 3 },
      wade:    { key: 'pushup', level: 10 },
    } },

  // ================= ROW =================
  { canonical: 'row', modality: 'base',
    refs: {
      thenics: { key: 'body-row', band: 1 },
      wade:    { key: 'pullup', level: 2 },
    } },

  { canonical: 'row', modality: 'archer',
    refs: { thenics: { key: 'archer-row', band: 2 } } },

  { canonical: 'row', modality: 'front-lever',
    refs: {
      thenics: { key: 'tuck-front-lever-row', band: 2 },
      cali:    { key: 'frontlever', level: 7 },
    } },

  // ================= PULL-UP =================
  { canonical: 'pull-up', modality: 'base',
    refs: {
      thenics: { key: 'pull-up', band: 1 },
      wade:    { key: 'pullup', level: 5 },
    } },

  { canonical: 'pull-up', modality: 'chin',
    refs: {
      thenics: { key: 'chin-up', band: 1 },
      wade:    { key: 'pullup', level: 6 },
    },
    note: 'Wade Close Pull-ups ≈ Chin Up.' },

  { canonical: 'pull-up', modality: 'archer',
    refs: { thenics: { key: 'archer-pull-up', band: 2 } } },

  { canonical: 'pull-up', modality: 'typewriter',
    refs: { thenics: { key: 'typewriter-pull-up', band: 2 } } },

  { canonical: 'pull-up', modality: 'one-arm',
    refs: {
      thenics: { key: 'one-arm-pull-up', band: 3 },
      wade:    { key: 'pullup', level: 10 },
    } },

  { canonical: 'muscle-up', modality: 'base',
    refs: {
      thenics: { key: 'muscle-up', band: 3 },
      cali:    { key: 'dips', level: 10 },
    },
    note: 'В Wade Big-6 отсутствует; есть в CALI_DIPS level 10.' },

  // ================= DIP =================
  { canonical: 'dip', modality: 'bench',
    refs: {
      thenics: { key: 'bench-dip', band: 1 },
      cali:    { key: 'dips', level: 1 },
    } },

  { canonical: 'dip', modality: 'bench-advanced',
    refs: {
      thenics: { key: 'advanced-bench-dip', band: 1 },
      cali:    { key: 'dips', level: 2 },
    } },

  { canonical: 'dip', modality: 'base',
    refs: {
      thenics: { key: 'dip', band: 1 },
      cali:    { key: 'dips', level: 5 },
    },
    note: 'Thenics Beginner = наш level 5.' },

  { canonical: 'dip', modality: 'korean',
    refs: {
      thenics: { key: 'korean-dip', band: 2 },
      cali:    { key: 'dips', level: 8 },
    } },

  // ================= PLANK =================
  { canonical: 'plank', modality: 'base',
    refs: {
      thenics: { key: 'plank', band: 1 },
      cali:    { key: 'plank', level: 3 },
      weightloss: { key: 'weightloss-bw', level: 5 },
    },
    note: 'У Thenics вся планка — Beginner.' },

  { canonical: 'plank', modality: 'side',
    refs: {
      thenics: { key: 'side-plank', band: 1 },
      cali:    { key: 'plank', level: 4 },
      runner:  { key: 'anticore', level: 3 },
    } },

  { canonical: 'plank', modality: 'one-arm',
    refs: {
      thenics: { key: 'one-arm-plank', band: 1 },
      cali:    { key: 'plank', level: 10 },
    } },

  // ================= L-SIT / V-SIT =================
  { canonical: 'l-sit', modality: 'tuck',
    refs: {
      thenics: { key: 'tuck-l-sit', band: 2 },
      cali:    { key: 'lsit', level: 2 },
    } },

  { canonical: 'l-sit', modality: 'full',
    refs: {
      thenics: { key: 'l-sit', band: 3 },
      cali:    { key: 'lsit', level: 5 },
    } },

  { canonical: 'v-sit', modality: 'base',
    refs: {
      thenics: { key: 'v-sit', band: 4 },
      cali:    { key: 'lsit', level: 7 },
    } },

  { canonical: 'v-sit', modality: 'straddle',
    refs: {
      thenics: { key: 'straddle-v-sit', band: 3 },
      cali:    { key: 'lsit', level: 8 },
    } },

  // ================= PLANCHE =================
  { canonical: 'planche', modality: 'pseudo-push-up',
    refs: {
      thenics: { key: 'pseudo-push-up', band: 1 },
      cali:    { key: 'planche', level: 1 },
    } },

  { canonical: 'planche', modality: 'frog',
    refs: {
      thenics: { key: 'frog-stand', band: 1 },
      cali:    { key: 'planche', level: 2 },
    } },

  { canonical: 'planche', modality: 'tuck',
    refs: {
      thenics: { key: 'tuck-planche', band: 2 },
      cali:    { key: 'planche', level: 3 },
    } },

  { canonical: 'planche', modality: 'adv-tuck',
    refs: {
      thenics: { key: 'advanced-tuck-planche', band: 3 },
      cali:    { key: 'planche', level: 4 },
    } },

  { canonical: 'planche', modality: 'straddle',
    refs: {
      thenics: { key: 'straddle-planche', band: 3 },
      cali:    { key: 'planche', level: 5 },
    } },

  { canonical: 'planche', modality: 'full',
    refs: {
      thenics: { key: 'planche', band: 4 },
      cali:    { key: 'planche', level: 7 },
    } },

  { canonical: 'planche', modality: 'push-up',
    refs: {
      thenics: { key: 'planche-push-up', band: 4 },
      cali:    { key: 'planche', level: 8 },
    } },

  // ================= FRONT LEVER =================
  { canonical: 'front-lever', modality: 'tuck',
    refs: {
      thenics: { key: 'tuck-front-lever', band: 1 },
      cali:    { key: 'frontlever', level: 1 },
    } },

  { canonical: 'front-lever', modality: 'adv-tuck',
    refs: {
      thenics: { key: 'advanced-tuck-front-lever', band: 2 },
      cali:    { key: 'frontlever', level: 2 },
    } },

  { canonical: 'front-lever', modality: 'one-leg',
    refs: {
      thenics: { key: 'one-leg-front-lever', band: 2 },
      cali:    { key: 'frontlever', level: 3 },
    } },

  { canonical: 'front-lever', modality: 'straddle',
    refs: {
      thenics: { key: 'straddle-front-lever', band: 3 },
      cali:    { key: 'frontlever', level: 4 },
    } },

  { canonical: 'front-lever', modality: 'full',
    refs: {
      thenics: { key: 'front-lever', band: 3 },
      cali:    { key: 'frontlever', level: 5 },
    } },

  { canonical: 'front-lever', modality: 'row',
    refs: {
      thenics: { key: 'front-lever-row', band: 4 },
      cali:    { key: 'frontlever', level: 7 },
    } },

  // ================= BACK LEVER =================
  { canonical: 'back-lever', modality: 'tuck',
    refs: { thenics: { key: 'tuck-back-lever', band: 1 } } },

  { canonical: 'back-lever', modality: 'adv-tuck',
    refs: { thenics: { key: 'advanced-tuck-back-lever', band: 2 } } },

  { canonical: 'back-lever', modality: 'straddle',
    refs: { thenics: { key: 'straddle-back-lever', band: 3 } } },

  { canonical: 'back-lever', modality: 'full',
    refs: { thenics: { key: 'back-lever', band: 3 } } },

  // ================= FLAG =================
  { canonical: 'flag', modality: 'low',
    refs: { thenics: { key: 'low-flag', band: 1 } } },

  { canonical: 'flag', modality: 'vertical',
    refs: { thenics: { key: 'vertical-flag', band: 2 } } },

  { canonical: 'flag', modality: 'straddle',
    refs: { thenics: { key: 'straddle-flag', band: 3 } } },

  { canonical: 'flag', modality: 'full',
    refs: { thenics: { key: 'human-flag', band: 4 } } },

  // ================= HANDSTAND =================
  { canonical: 'handstand', modality: 'headstand',
    refs: { thenics: { key: 'headstand', band: 1 } } },

  { canonical: 'handstand', modality: 'wall',
    refs: {
      thenics: { key: 'wall-handstand', band: 1 },
      wade:    { key: 'handstand', level: 3 },
    } },

  { canonical: 'handstand', modality: 'free',
    refs: {
      thenics: { key: 'handstand', band: 2 },
      wade:    { key: 'handstand', level: 3 },
    },
    note:
      'Thenics Intermediate Handstand ≈ Wade h3 (Wall Handstands). ' +
      'Ветка Wade: стена → свободная стойка → HSPU. ' +
      'Связь семантически variant-of (свободная стойка сложнее стены), ' +
      'но подтверждается через equivalent-to.' },

  { canonical: 'hspu', modality: 'wall',
    refs: {
      thenics: { key: 'wall-handstand-push-up', band: 3 },
      wade:    { key: 'handstand', level: 5 },
    } },

  { canonical: 'hspu', modality: 'free',
    refs: {
      thenics: { key: 'handstand-push-up', band: 3 },
      //wade:    { key: 'handstand', level: 5 },
    },
    note: 'У Уэйда такого нет. Свободные HSPU — только Thenics.'
  },

  { canonical: 'hspu', modality: 'one-arm',
    refs: {
      thenics: { key: 'one-arm-handstand', band: 4 },
      wade:    { key: 'handstand', level: 10 },
    } },

  // ================= SQUAT / PISTOL / SHRIMP =================
  { canonical: 'squat', modality: 'assisted',
    refs: {
      thenics: { key: 'chair-squat', band: 1 },
      wade:    { key: 'squat', level: 3 },
      runner:  { key: 'runnersquat', level: 1 },
    } },

  { canonical: 'squat', modality: 'base',
    refs: {
      thenics: { key: 'squat', band: 1 },
      wade:    { key: 'squat', level: 5 },
      weightloss: { key: 'weightloss-bw', level: 1 },
    } },

  { canonical: 'squat', modality: 'jumping',
    refs: {
      thenics: { key: 'jumping-squat', band: 2 },
      weightloss: { key: 'weightloss-hiit', level: 5 },
      named:   { key: 'jump-squats' },
    } },

  { canonical: 'pistol', modality: 'assisted',
    refs: {
      thenics: { key: 'assisted-pistol-squat', band: 3 },
      wade:    { key: 'squat', level: 9 },
      runner:  { key: 'runnersquat', level: 2 },
    } },

  { canonical: 'pistol', modality: 'box',
    refs: {
      thenics: { key: 'bench-pistol-squat', band: 2 },
      runner:  { key: 'runnersquat', level: 3 },
    } },

  { canonical: 'pistol', modality: 'base',
    refs: {
      thenics: { key: 'pistol-squat', band: 3 },
      wade:    { key: 'squat', level: 10 },
      runner:  { key: 'runnersquat', level: 5 },
    } },

  { canonical: 'pistol', modality: 'deficit',
    refs: {
      thenics: { key: 'elevated-pistol-squat', band: 3 },
      runner:  { key: 'runnersquat', level: 6 },
    } },

  { canonical: 'shrimp', modality: 'assisted',
    refs: {
      thenics: { key: 'supported-shrimp-squat', band: 1 },
      runner:  { key: 'runnersquat', level: 8 },
    } },

  { canonical: 'shrimp', modality: 'one-arm',
    refs: {
      thenics: { key: 'one-arm-shrimp-squat', band: 2 },
      runner:  { key: 'runnersquat', level: 8 },
    } },

  { canonical: 'shrimp', modality: 'base',
    refs: {
      thenics: { key: 'shrimp-squat', band: 3 },
      runner:  { key: 'runnersquat', level: 9 },
    } },

  { canonical: 'shrimp', modality: 'no-hands',
    refs: {
      thenics: { key: 'no-arm-shrimp-squat', band: 2 },
      runner:  { key: 'runnersquat', level: 10 },
    } },

  // ================= LUNGE =================
  { canonical: 'lunge', modality: 'static',
    refs: {
      thenics: { key: 'lunge', band: 1 },
      runner:  { key: 'runnerlunge', level: 2 },
    } },

  { canonical: 'lunge', modality: 'walking',
    refs: {
      thenics: { key: 'lunge', band: 1 },
      runner:  { key: 'runnerlunge', level: 3 },
      named:   { key: 'walking-lunges' },
    } },

  { canonical: 'lunge', modality: 'reverse',
    refs: {
      thenics: { key: 'reverse-lunge', band: 1 },
      runner:  { key: 'runnerlunge', level: 4 },
      weightloss: { key: 'weightloss-bw', level: 2 },
    } },

  { canonical: 'lunge', modality: 'bulgarian',
    refs: {
      thenics: { key: 'bulgarian-squat', band: 2 },
      runner:  { key: 'runnerlunge', level: 5 },
    } },

  { canonical: 'lunge', modality: 'jumping',
    refs: {
      thenics: { key: 'jumping-lunge', band: 2 },
      runner:  { key: 'runnerlunge', level: 8 },
    } },

  { canonical: 'lunge', modality: 'curtsy',
    refs: {
      thenics: { key: 'curtsy-squat', band: 2 },
      runner:  { key: 'runnerlunge', level: 9 },
    } },

  // ================= CALF =================
  { canonical: 'calf-raise', modality: 'two-leg',
    refs: {
      thenics: { key: 'calf-raise', band: 1 },
      runner:  { key: 'calfraise', level: 2 },
    } },

  { canonical: 'calf-raise', modality: 'one-leg',
    refs: {
      thenics: { key: 'one-leg-calf-raise', band: 1 },
      runner:  { key: 'calfraise', level: 4 },
    } },

  // ================= CORE / LEG RAISE =================
  { canonical: 'leg-raise', modality: 'lying',
    refs: {
      thenics: { key: 'leg-raise', band: 1 },
      wade:    { key: 'legraise', level: 5 },
      core:    { key: 'core-dragonflag', level: 4 },
    } },

  { canonical: 'leg-raise', modality: 'hanging-knee',
    refs: {
      thenics: { key: 'knee-raises', band: 1 },
      wade:    { key: 'legraise', level: 6 },
    } },

  { canonical: 'hollow', modality: 'hold',
    refs: {
      thenics: { key: 'hollow-body-hold', band: 1 },
      core:    { key: 'core-dragonflag', level: 2 },
      named:   { key: 'hollow-body-hold' },
    } },

  { canonical: 'hollow', modality: 'rock',
    refs: {
      thenics: { key: 'hollow-body-rocks', band: 2 },
      core:    { key: 'core-dragonflag', level: 3 },
    } },

  { canonical: 'dragon-flag', modality: 'negative',
    refs: {
      thenics: { key: 'negative-dragon-flag', band: 3 },
      core:    { key: 'core-dragonflag', level: 6 },
    } },

  { canonical: 'dragon-flag', modality: 'tuck',
    refs: {
      thenics: { key: 'tuck-dragon-flag', band: 2 },
      core:    { key: 'core-dragonflag', level: 7 },
    } },

  { canonical: 'dragon-flag', modality: 'one-leg',
    refs: {
      thenics: { key: 'one-leg-dragon-flag', band: 2 },
      core:    { key: 'core-dragonflag', level: 8 },
    } },

  { canonical: 'dragon-flag', modality: 'half',
    refs: {
      thenics: { key: 'half-dragon-flag', band: 2 },
      core:    { key: 'core-dragonflag', level: 9 },
    } },

  { canonical: 'dragon-flag', modality: 'full',
    refs: {
      thenics: { key: 'dragon-flag', band: 3 },
      core:    { key: 'core-dragonflag', level: 10 },
    } },

  { canonical: 'windshield-wiper', modality: 'hanging',
    refs: {
      thenics: { key: 'hanging-windshield-wiper', band: 1 },
      // wade-ref убран — мы убрали Windshield Wipers из Wade
    },
    note: 'У Уэйда такого нет. Только Thenics.' },

  // ================= HIIT / CONDITIONING =================
  { canonical: 'climber', modality: 'base',
    refs: {
      thenics: { key: 'climber', band: 1 },
      weightloss: { key: 'weightloss-hiit', level: 3 },
      named:   { key: 'mountain-climbers' },
    } },

  { canonical: 'climber', modality: 'cross',
    refs: { thenics: { key: 'cross-climber', band: 1 } } },

  { canonical: 'twist', modality: 'russian',
    refs: {
      thenics: { key: 'russian-twist', band: 1 },
      named:   { key: 'russian-twist' },
    } },

  { canonical: 'crunch', modality: 'bicycle',
    refs: {
      thenics: { key: 'bicycle', band: 1 },
      named:   { key: 'bicycle-crunch' },
    } },

  // ================= GLUTE / HINGE =================
  { canonical: 'glute-bridge', modality: 'two-leg',
    refs: {
      thenics: { key: 'glute-bridge', band: 1 },
      weightloss: { key: 'weightloss-bw', level: 4 },
    } },

  { canonical: 'glute-bridge', modality: 'one-leg',
    refs: {
      thenics: { key: 'one-leg-glute-bridge', band: 2 },
      weightloss: { key: 'weightloss-bw', level: 8 },
    } },

  // ================= ЧИСТО NAMED (в Thenics нет) =================
  // Эти записи фиксируем как «named-only»: существует в нашем каталоге,
  // в Thenics отсутствует. Нужны, чтобы матчер не пытался искать ложные связи.

  { canonical: 'wall-sit', modality: 'isometric',
    refs: {
      thenics: { key: 'wall-sit', band: 1 },
      named:   { key: 'wall-sit' },
    } },

  { canonical: 'dead-bug', modality: 'base',
    refs: { named: { key: 'dead-bug' } },
    note: 'Thenics не содержит.' },

  { canonical: 'bird-dog', modality: 'base',
    refs: { named: { key: 'bird-dog' } },
    note: 'Thenics не содержит.' },

  { canonical: 'superman', modality: 'hold',
    refs: { named: { key: 'superman-hold' } },
    note: 'Thenics не содержит.' },

  { canonical: 'cat-cow', modality: 'flow',
    refs: { named: { key: 'cat-cow' } },
    note: 'Thenics не содержит.' },

  { canonical: 'pallof', modality: 'press',
    refs: { runner: { key: 'anticore', level: 4 } },
    note: 'Thenics не содержит; только в RUNNER_ANTICORE.' },

  { canonical: 'ab-wheel', modality: 'kneeling',
    refs: { runner: { key: 'anticore', level: 9 } },
    note: 'Thenics не содержит.' },

  { canonical: 'single-leg-rdl', modality: 'base',
    refs: { runner: { key: 'runnerleg', level: 3 } },
    note: 'Thenics не содержит.' },
];