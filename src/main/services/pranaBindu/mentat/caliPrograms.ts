// src/main/services/pranaBindu/mentat/caliPrograms.ts
//
// Программы по общей калистенике. Прогрессии с префиксом L,
// плюс могут включать Wade-движения (W).

import type { ProgramSpec } from './types';

export const CALI_PROGRAMS: ProgramSpec[] = [
  // ==================== Push-Pull Core ====================
  {
    key: 'cali-push-pull',
    category: 'cali',
    name: 'Push-Pull Core',
    nameRu: 'Тяга-жим + кор',
    description:
      'Три раза в неделю. Отжимания на брусьях, подтягивания, планка ' +
      'и L-сиденье. Баланс push и pull.',
    usage:
      '3 раза в неделю (Пн/Ср/Пт). По 3 подхода каждого движения, ' +
      'отдых 60–90 секунд между подходами.',
    weeklySchedule: [0, null, 0, null, 0, null, null],
    days: [
      {
        label: 'A',
        movementKeys: ['dips', 'pullup', 'plank', 'lsit'],
      },
    ],
  },

  // ==================== Statics ====================
  {
    key: 'cali-statics',
    category: 'cali',
    name: 'Statics Focus',
    nameRu: 'Статика',
    description:
      'Работа над статическими элементами: планш, фронтальный вис, ' +
      'L-сиденье, стойка.',
    usage:
      '2 раза в неделю. Каждое удержание — до 3 подходов по 5–20 сек, ' +
      'отдых 2 минуты.',
    weeklySchedule: [null, 0, null, 0, null, null, null],
    days: [
      {
        label: 'Statics',
        movementKeys: ['planche', 'frontlever', 'lsit', 'handstand'],
      },
    ],
  },

  // ==================== Beginner Full Body ====================
  {
    key: 'cali-beginner',
    category: 'cali',
    name: 'Beginner Full Body',
    nameRu: 'Новичок: всё тело',
    description:
      'Простые движения для старта в калистенике. Три раза в неделю, ' +
      'всё тело за одну сессию.',
    usage:
      '3 раза в неделю (Пн/Ср/Пт). 2 подхода каждого движения, отдых ' +
      '60 сек.',
    weeklySchedule: [0, null, 0, null, 0, null, null],
    days: [
      {
        label: 'Full',
        movementKeys: ['dips', 'plank', 'lsit'],
      },
    ],
  },

    // ==================== Flat Core ====================
  {
    key: 'core-flat',
    category: 'cali',
    name: 'Flat Core',
    nameRu: 'Плоский кор',
    description:
      'Укрепление кора и мышц живота. Не сжигает жир сам по себе — ' +
      'работает вместе с дефицитом калорий (см. Water Discipline).',
    usage:
      '3 раза в неделю. Основной акцент — стабильность поясницы и ' +
      'контроль, а не скорость. Отдых 60 секунд между упражнениями.',
    weeklySchedule: [null, 0, null, 0, null, 0, null],
    days: [
      {
        label: 'Core',
        movementKeys: [
          'dead-bug',
          'hollow-body-hold',
          'plank',
          'russian-twist',
          'bicycle-crunch',
          'mountain-climbers',
        ],
      },
    ],
  },
];