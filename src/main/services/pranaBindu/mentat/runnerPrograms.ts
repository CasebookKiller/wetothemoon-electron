// src/main/services/pranaBindu/mentat/runnerPrograms.ts
//
// Программы по СБУ (специальные беговые упражнения).
// Только named-упражнения — без уровней и ladder.

import type { ProgramSpec } from './types';

export const RUNNER_PROGRAMS: ProgramSpec[] = [
  // ==================== Base Drills ====================
  {
    key: 'runner-base',
    category: 'runner',
    name: 'Base Drills',
    nameRu: 'Базовые СБУ',
    description:
      'Классический набор: A-Skip, B-Skip, High Knees, Butt Kicks. ' +
      'Ставится в разминку перед основной работой.',
    usage:
      '3 раза в неделю (Пн/Ср/Пт). Каждое упражнение — 20 метров. ' +
      'Между ними — короткая трусца для восстановления.',
    weeklySchedule: [0, null, 0, null, 0, null, null],
    days: [
      {
        label: 'Base',
        movementKeys: [
          'a-skip',
          'b-skip',
          'high-knees',
          'butt-kicks',
          'recovery-jog',
        ],
      },
    ],
  },

  // ==================== Power Drills ====================
  {
    key: 'runner-power',
    category: 'runner',
    name: 'Power Drills',
    nameRu: 'Силовые СБУ',
    description:
      'Bounding, Straight-Leg Run, Power Skips. ' +
      'Развитие мощности отталкивания.',
    usage:
      '2 раза в неделю (Вт/Чт). Каждое — 30 метров. После серии — ' +
      '200 м трусцы.',
    weeklySchedule: [null, 0, null, 0, null, null, null],
    days: [
      {
        label: 'Power',
        movementKeys: [
          'bounding',
          'straight-leg',
          'power-skips',
          'recovery-jog',
        ],
      },
    ],
  },

  // ==================== Coordination ====================
  {
    key: 'runner-coordination',
    category: 'runner',
    name: 'Coordination',
    nameRu: 'Координация',
    description:
      'Ankling, Carioca, Backward Run. Баланс и координация.',
    usage:
      '2 раза в неделю. Короткие отрезки 20 метров с фокусом на ' +
      'технику, не на скорость.',
    weeklySchedule: [null, 0, null, 0, null, null, null],
    days: [
      {
        label: 'Coord',
        movementKeys: [
          'ankling',
          'carioca-l',
          'carioca-r',
          'backward-run',
          'recovery-jog',
        ],
      },
    ],
  },

  // ==================== Strides ====================
  {
    key: 'runner-strides',
    category: 'runner',
    name: 'Strides Cycle',
    nameRu: 'Ускорения',
    description:
      'Ускорения 100 м + возврат пешком. «Разбудить» быстрые мышцы ' +
      'в конце лёгкой тренировки.',
    usage:
      '2 раза в неделю. 6–8 повторов. 100 м ускорение + 100 м пешком.',
    weeklySchedule: [null, null, 0, null, 0, null, null],
    days: [
      {
        label: 'Strides',
        movementKeys: ['strides', 'walk-back'],
      },
    ],
  },
];