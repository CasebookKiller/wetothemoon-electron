// src/main/services/pranaBindu/mentat/types.ts

/**
 * Mentat — календарь и периодизация.
 */

export type PeriodizationPhase =
  | 'base'
  | 'build'
  | 'peak'
  | 'taper'
  | 'race'
  | 'recovery';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WeekTemplateDay {
  dayOfWeek: Weekday;
  /** Тип беговой сессии или undefined для дня отдыха/силы */
  runType?: string;
  /** Коды движений Big-6, запланированных на день */
  strengthMovementCodes?: string[];
  recoveryFocus?: boolean;
}

export interface WeekTemplate {
  id?: number;
  name: string;
  phase?: PeriodizationPhase;
  days: WeekTemplateDay[];
}

// ==================== Парсер тренировок (ICU + расширенный) ====================

export type StepPrefixKind = 'W' | 'L';

export interface WorkoutStep {
  /** Cue-текст, что покажется на часах. Например "Push-ups W3". */
  label: string;
  /** Категория префикса (Big-6 Уэйда vs общая калистеника). */
  prefixKind?: StepPrefixKind;
  /** Уровень 1..10, если задан префикс. */
  prefixLevel?: number;
  /** Длительность в секундах. */
  durationSec?: number;
  /** Дистанция в метрах. */
  distanceM?: number;
  /** Целевая зона 1..7 (ICU). Для силовых — автоматически из уровня. */
  zone?: number;
  /** Целевая метрика зоны. */
  zoneTarget?: 'pace' | 'hr' | 'power';
  /** Повторов (reps) — для блоков вида "Main Set 10x". */
  reps?: number;
  /** Вложенные шаги. */
  nested?: WorkoutStep[];
  /** Исходная строка — для отладки. */
  raw?: string;
}

export interface WorkoutSection {
  name: string;
  reps?: number;
  steps: WorkoutStep[];
}

export interface ParsedWorkout {
  name: string;
  sections: WorkoutSection[];
  flatSteps: WorkoutStep[];
}

export type ExerciseCategory =
  | 'wade'
  | 'cali'
  | 'runner'
  | 'core'
  | 'posture'
  | 'weightloss';

export interface CatalogLevel {
  level: number;
  name: string;
  hint?: string;
}

export interface CatalogEntry {
  key: string;
  label: string;
  icuName: string;
  category: ExerciseCategory;
  levels: CatalogLevel[];
}

/** Категория упражнения без прогрессии (не имеет W/L). */
export type NamedExerciseCategory = 'drill' | 'plyo' | 'warmup' | 'run-basic';

/** Именованное упражнение без уровней — только cue. */
export interface NamedExercise {
  key: string;
  category: NamedExerciseCategory;
  /** Как показывать в UI. */
  label: string;
  /** Как писать в ICU (совпадает с label, но оставим явно). */
  icuName: string;
  /** Подсказка — короткое описание техники. */
  hint?: string;
  /** Дефолт для автодополнения. Например '20mtr'. */
  defaultDuration?: string;
  /** Дефолт для автодополнения. Обычно 1. */
  defaultZone?: number;
}