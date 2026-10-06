// src/main/services/pranaBindu/mentat/wadePrograms.ts
//
// Программы Пола Уэйда (Convict Conditioning).
// 4 базовые программы разной частоты. Каждый день ссылается
// на movement keys из exerciseCatalog.ts.
//
// Программа — это статичное расписание, не привязанное к датам.
// Генератор (wadeProgramGenerator.ts) превращает её в plan_events
// на конкретном промежутке.

import type {
  ProgramSpec,
  ProgramDaySpec,
} from './types';

/** @deprecated use ProgramSpec */
export type WadeProgram = ProgramSpec;
/** @deprecated use ProgramDaySpec */
export type WadeProgramDay = ProgramDaySpec;

//export interface WadeProgramDay {
//  label: string;
//  movementKeys: string[];
//}

//export interface WadeProgram {
//  key: string;
//  name: string;
  /** Русское название для UI. */
//  nameRu: string;
//  description: string;
//  usage?: string;
  /** 7 слотов Пн..Вс: индекс дня в `days` или null (отдых). */
//  weeklySchedule?: (number | null)[];
  /** Цикл для программ без привязки к неделе. */
//  cyclePattern?: (number | null)[];
  /** Различные дни программы (A, B, C, …). */
//  days: WadeProgramDay[];
//}

/** 6 движений Big-6 — базовый набор Уэйда. */
const ALL_SIX = [
  'pushup',
  'squat',
  'pullup',
  'legraise',
  'bridge',
  'handstand',
];

export const WADE_PROGRAMS: WadeProgram[] = [
  // ==================== New Blood ====================
  {
    key: 'new-blood',
    category: 'wade',
    name: 'New Blood',
    nameRu: 'Новая кровь',
    description:
      'Программа для начинающих. 3 раза в неделю (Пн/Ср/Пт), ' +
      'всё тело за один день. Все 6 движений.',
    usage:
      '2–3 рабочих подхода на каждое движение. Отдых между ' +
      'подходами — сколько нужно для качественного следующего.',
    weeklySchedule: [0, null, 0, null, 0, null, null],
    days: [
      {
        label: 'A',
        movementKeys: ALL_SIX,
      },
    ],
  },

  // ==================== Good Behavior ====================
  {
    key: 'good-behavior',
    category: 'wade',
    name: 'Good Behavior',
    nameRu: 'Хорошее поведение',
    description:
      '6 дней в неделю с одним днём отдыха. Каждый день — ' +
      'пара движений (push-пара + pull-пара).',
    usage:
      'День 1: Push-ups + Leg Raises. День 2: Pull-ups + Squats. ' +
      'День 3: Handstand + Bridges. Дни 4–6 — повтор в другом порядке.',
    weeklySchedule: [0, 1, 2, 3, 4, 5, null],
    days: [
      { label: 'A', movementKeys: ['pushup', 'legraise'] },
      { label: 'B', movementKeys: ['pullup', 'squat'] },
      { label: 'C', movementKeys: ['handstand', 'bridge'] },
      { label: 'D', movementKeys: ['legraise', 'pushup'] },
      { label: 'E', movementKeys: ['squat', 'pullup'] },
      { label: 'F', movementKeys: ['bridge', 'handstand'] },
    ],
  },

  // ==================== Veterano ====================
  {
    key: 'veterano',
    category: 'wade',
    name: 'Veterano',
    nameRu: 'Ветеран',
    description:
      'Средний уровень. 4 тренировки в неделю, сплит ' +
      'верх/низ. По 3 движения за сессию.',
    usage:
      'Пн: верх (push + pull + handstand). Вт: низ (squat + ' +
      'leg raise + bridge). Чт/Пт — то же в другом порядке.',
    weeklySchedule: [0, 1, null, 2, 3, null, null],
    days: [
      { label: 'Верх A', movementKeys: ['pushup', 'pullup', 'handstand'] },
      { label: 'Низ A', movementKeys: ['squat', 'legraise', 'bridge'] },
      { label: 'Верх B', movementKeys: ['pullup', 'handstand', 'pushup'] },
      { label: 'Низ B', movementKeys: ['bridge', 'squat', 'legraise'] },
    ],
  },

  // ==================== Revolving Door ====================
  {
    key: 'revolving-door',
    category: 'wade',
    name: 'Revolving Door',
    nameRu: 'Вращающаяся дверь',
    description:
      '4-дневный цикл: тренировка → отдых → тренировка → отдых. ' +
      '6 движений разделены на два дня по 3.',
    usage:
      'День 1: push + pull + squat. День 2: leg raise + bridge + ' +
      'handstand. Цикл повторяется без привязки к дням недели.',
    cyclePattern: [0, null, 1, null],
    days: [
      { label: 'A', movementKeys: ['pushup', 'pullup', 'squat'] },
      { label: 'B', movementKeys: ['legraise', 'bridge', 'handstand'] },
    ],
  },
];

export function findWadeProgram(key: string): WadeProgram | undefined {
  return WADE_PROGRAMS.find((p) => p.key === key);
}