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