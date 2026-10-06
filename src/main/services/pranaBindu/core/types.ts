/**
 * Prana-Bindu Core — базовые доменные типы.
 * Пульсовые зоны, профиль, тренировочные блоки.
 */

import { ProgramCategory } from '../mentat/types';

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface ZoneDefinition {
  zone: HeartRateZone;
  name: string;
  /** Границы в уд/мин (абсолютные) */
  minBpm: number;
  maxBpm: number;
  /** Доля от maxHr, например [0.5, 0.6] */
  fraction: [number, number];
  description: string;
}

export interface Profile {
  age?: number;
  /** Максимальный пульс, уд/мин */
  maxHr?: number;
  /** Пульс покоя, уд/мин */
  restingHr?: number;
  weightKg?: number;
  /** Порог лактата, уд/мин (опционально) */
  lactateThresholdHr?: number;
  /** Целевая дата марафона, ISO (YYYY-MM-DD) */
  marathonDate?: string;
  // v10 — источник значения: 'icu' | 'dodofo' | 'manual' | 'computed'
  lthrSource?: string;
  maxHrSource?: string;
  restingHrSource?: string;
  /** Границы HR-зон (последняя — верхняя). Из ICU: 7 значений. */
  hrZones?: number[];
  hrZonesSource?: string;
    /** Границы pace-зон в км/ч (верхние). Из ICU: 7 значений. */
  paceZonesKmh?: number[];
  /** Пороговая скорость, м/с (как в ICU). */
  thresholdPaceMs?: number;
  paceZonesSource?: string;
}

export type TrainingBlockType =
  | 'easy'
  | 'long'
  | 'tempo'
  | 'interval'
  | 'recovery'
  | 'strength';

export interface TrainingBlock {
  type: TrainingBlockType;
  durationMin?: number;
  distanceKm?: number;
  targetZone?: HeartRateZone;
  notes?: string;
}

export type PlanCategory = 'WORKOUT' | 'PLAN' | 'TARGET' | 'NOTE' | 'RACE';

export interface WorkoutStep {
  /** 'Warmup' | 'Interval' | 'Cooldown' | 'Recovery' | ... */
  type?: string;
  /** Длительность в секундах. */
  duration?: number;
  /** Дистанция в метрах. */
  distance?: number;
  /** Целевая зона пульса (1-based). */
  hrZone?: number;
  /** Целевая зона темпа (1-based). */
  paceZone?: number;
  /** Целевая зона мощности (1-based). */
  powerZone?: number;
  /** Количество подходов. */
  sets?: number;
  /** Количество повторов. */
  reps?: number | number[];
  /** Исходный шаг, как пришёл от ICU. */
  raw: unknown;
}

export interface PlanEvent {
  id?: number;
  externalId: string;
  date: string;               // YYYY-MM-DD
  startTime?: string;         // ISO 8601 UTC, если задано
  endTime?: string;
  category: PlanCategory;
  sport?: string;             // 'Run' | 'Workout' | ...
  name: string;
  description?: string;
  plannedLoad?: number;
  durationSec?: number;
  distanceM?: number;
  steps?: WorkoutStep[];
  zoneTimes?: Array<{ zone: string; secs: number }>;
  pairedActivityId?: number;
  raw?: unknown;
  /** Категория генератора, если событие создано генератором программ. */
  generatorCategory?: ProgramCategory | null;
  /** Ключ программы-генератора ('new-blood', 'prehab-feet', …). */
  generatorProgramKey?: string | null;
}

// ==================== Факт выполнения тренировки ====================

/**
 * Одно упражнение внутри фактической сессии.
 * «actualSets» — массив выполненных повторов (или секунд для
 * time-based): [12, 10, 8] = 3 подхода; [15] = 1 подход.
 */
export interface SessionExercise {
  movementKey: string;
  level?: number;
  rung?: number;
  /** Что было в плане: '2×15', '3×30', '[10,8,6]', '30s'. */
  target?: string;
  /** Фактические подходы: повторы или секунды (если isTimeBased). */
  actualSets?: number[];
  /** true — упражнение измеряется в секундах (планка, стойка). */
  isTimeBased?: boolean;
  /** Пользователь пропустил упражнение. */
  skipped?: boolean;
  /** Дополнительная заметка по конкретному упражнению. */
  note?: string;
}

/**
 * Сессия факта. Может быть привязана к plan_events (тренировка по
 * плану) или быть свободной (пользователь записал то, что делал
 * сам). isTest=true — это проверка уровня, не сессия.
 */
export interface WorkoutSession {
  id: number;
  date: string;
  startTime?: string | null;
  planEventId?: number | null;
  programKey?: string | null;
  generatorCategory?: string | null;
  exercises: SessionExercise[];
  rpe?: number | null;
  isTest: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}