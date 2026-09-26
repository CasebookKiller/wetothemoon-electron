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

// Row-типы Melange. Snake_case, 1-в-1 с DDL.

export interface ProfileRow {
  id: number;
  age: number | null;
  max_hr: number | null;
  lthr: number | null;
  resting_hr: number | null;
  weight_kg: number | null;
  goal_marathon_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SyncSettingsRow {
  id: number;
  source: string | null;
  mode: string;
  auto_interval_min: number | null;
  auto_on_start: 0 | 1;
  google_token_json: string | null;
  zeppbridge_path: string | null;
  zepp_provider: string | null;
  zepp_fallback_provider: string | null;
  zepp_credentials_json: string | null;
  zepp_auth_host: string | null;
  zepp_data_host: string | null;
  zepp_app_token: string | null;
  zepp_user_id: string | null;
  zepp_last_sync_at: string | null;
  zepp_last_sync_status: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  // dodofo
  dodofo_token: string | null;
  dodofo_user_id: string | null;
  dodofo_username: string | null;
  dodofo_last_sync_at: string | null;
  dodofo_last_sync_status: string | null;
}

export interface MetaRow {
  key: string;
  value: string;
}

// (существующие: MovementsRow, ProgressionsRow, UserMovementStateRow,
//  RecoveryLogsRow — оставить как есть)