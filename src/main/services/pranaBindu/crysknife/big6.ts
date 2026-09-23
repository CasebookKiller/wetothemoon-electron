/**
 * Big-6 по Convict Conditioning.
 * Порядок движений фиксирован — не менять без миграции БД.
 */

import type { Movement } from './types';

export const BIG6_MOVEMENTS: readonly Movement[] = [
  { id: 1, code: 'pushups',    name: 'Отжимания',    orderIndex: 1 },
  { id: 2, code: 'squats',     name: 'Приседания',   orderIndex: 2 },
  { id: 3, code: 'pullups',    name: 'Подтягивания', orderIndex: 3 },
  { id: 4, code: 'leg_raises', name: 'Подъём ног',   orderIndex: 4 },
  { id: 5, code: 'bridge',     name: 'Мостик',       orderIndex: 5 },
  { id: 6, code: 'stand',      name: 'Стойка',       orderIndex: 6 },
];

/** Ступени (10 × 6) — заполняются в 05_CRYSKNIFE.md. */
export const BIG6_LEVELS_PER_MOVEMENT = 10;