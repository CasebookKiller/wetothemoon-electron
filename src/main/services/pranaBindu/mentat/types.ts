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
    /** Количество подходов (sets). Опционально. */
  sets?: number;
  /** Повторы. Число для uniform (3x30), массив для varied ([10,8,6]). */
  reps?: number | number[];
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
  | 'weightloss'
  | 'prehab';

export interface CatalogLevel {
  level: number;
  name: string;
  hint?: string;
  /** Русское название уровня (для UI). */
  nameRu?: string;
  /** Явные синонимы name (Full Bridge → Full Bridges). Только точно. */
  aliases?: string[];
  /** Ladder: 3 ступени внутри уровня (rung 1/2/3). */
  benchmarkLadder?: string[];
  /** Сколько раз повторить всю ladder целиком. По умолчанию 1. */
  benchmarkRounds?: number;
  /** Дополнительный источник: 'wade' | 'startbw' | 'og2' | ... */
  source?: string;
}


export interface CatalogEntry {
  key: string;
  label: string;
  icuName: string;
  category: ExerciseCategory;
  levels: CatalogLevel[];
  /**
   * Явные синонимы icuName / level.name для реверс-маппинга.
   * Например: Bridges → ['Bridge', 'Back Bridge', 'Full Bridge'].
   * Не fuzzy — только точное совпадение после lower().
   */
  aliases?: string[];
}

/** Категория упражнения без прогрессии (не имеет W/L). */
export type NamedExerciseCategory =
  | 'drill'
  | 'plyo'
  | 'warmup'
  | 'run-basic'
  | 'prehab';

/** Именованное упражнение без уровней — только cue. */
export interface NamedExercise {
  key: string;
  category: NamedExerciseCategory;
  /** Как показывать в UI. */
  label: string;
  /** Русское название — для UI. */
  nameRu?: string;
  /** Как писать в ICU (совпадает с label, но оставим явно). */
  icuName: string;
  /** Подсказка — короткое описание техники. */
  hint?: string;
  /** Дефолт для автодополнения. Например '20mtr'. */
  defaultDuration?: string;
  /** Дефолт для автодополнения. Обычно 1. */
  defaultZone?: number;
  /**
   * Явные синонимы icuName / level.name для реверс-маппинга.
   * Например: Bridges → ['Bridge', 'Back Bridge', 'Full Bridge'].
   * Не fuzzy — только точное совпадение после lower().
   */
  aliases?: string[];
}

// ==================== Программы (универсальные) ====================

export type ProgramCategory = 'wade' | 'runner' | 'cali' | 'prehab';

export interface ProgramDaySpec {
  label: string;
  /** Ключи в exerciseCatalog: 'pushup', 'a-skip', 'dips'. */
  movementKeys: string[];
}

export interface ProgramSpec {
  key: string;
  category: ProgramCategory;
  name: string;
  nameRu?: string;
  description: string;
  usage?: string;
  /** 7 слотов Пн..Вс: индекс дня в `days` или null (отдых). */
  weeklySchedule?: (number | null)[];
  /** Для программ без привязки к неделе (4-дневный цикл и т.п.). */
  cyclePattern?: (number | null)[];
  days: ProgramDaySpec[];
}