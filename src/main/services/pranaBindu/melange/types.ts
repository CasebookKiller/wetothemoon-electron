/**
 * Melange — черновик row-типов локальной БД prana_bindu.db.
 * Финальная схема и миграции — в 08_MELANGE.md.
 *
 * TODO(08): заменить на типы, сгенерированные из DDL.
 */

export interface MovementsRow {
  id: number;
  code: string;
  name: string;
  order_index: number;
}

export interface ProgressionsRow {
  id: number;
  movement_id: number;
  level: number;
  name: string;
  scheme_json: string;
  is_time_based: 0 | 1;
  repeat_count: number;
  notes: string | null;
}

export interface UserMovementStateRow {
  movement_id: number;
  current_level: number;
  updated_at: string;
}

export interface RecoveryLogsRow {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  hrv: number | null;
  resting_hr: number | null;
  traffic_light: string | null;
  notes: string | null;
}