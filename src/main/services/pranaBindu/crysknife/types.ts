/**
 * Crysknife — силовая линия Big-6.
 * 6 движений × 10 ступеней.
 */

export type MovementCode =
  | 'pushups'
  | 'squats'
  | 'pullups'
  | 'leg_raises'
  | 'bridge'
  | 'stand';

export interface Movement {
  id: number;
  code: MovementCode;
  name: string;
  orderIndex: number;
}

export interface SchemeSet {
  set: number;
  reps: number;
}

export interface Progression {
  id: number;
  movementId: number;
  /** 1..10 */
  level: number;
  name: string;
  scheme: SchemeSet[];
  /** 1 для обычных ступеней, 2 для ступеней с суффиксом «* 2» */
  repeatCount: number;
  /** true для стойки — значения в секундах */
  isTimeBased: boolean;
  notes?: string;
}

export interface UserMovementState {
  movementId: number;
  currentLevel: number;
  updatedAt: string;
}