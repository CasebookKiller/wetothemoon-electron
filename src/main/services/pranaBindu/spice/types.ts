/**
 * Spice — аналитика, синхронизация, провайдеры.
 */

export type SyncSource =
  | 'dodofo'
  | 'google-fit'
  | 'zepp-dofek'
  | 'zepp-mcp'
  | 'zeppbridge'
  | 'manual';

export type SyncMode = 'manual' | 'auto';

/**
 * Провайдеры автосинхронизации. Каждый — самостоятельный источник.
 *
 *   dodofo         — workouts + wellness + streams (для новых фактов)
 *   intervals-icu  — workouts + wellness + streams + plan ICU
 *   zepp-fit       — импорт FIT из локальной папки (zepp_archive_path)
 *   strava-fit     — импорт FIT/TCX из локальной папки (fit_archive_path)
 *   thresholds     — пороги и зоны (A.10, пока не реализовано)
 *
 * `streams` и `icu-plan` убраны: стримы идут с фактом, план — с ICU.
 */
export type AutoSyncProvider =
  | 'dodofo'
  | 'intervals-icu'
  | 'zepp-fit'
  | 'strava-fit'
  | 'thresholds';

export const ALL_AUTO_SYNC_PROVIDERS: readonly AutoSyncProvider[] = [
  'dodofo',
  'intervals-icu',
  'zepp-fit',
  'strava-fit',
  'thresholds',
] as const;

export const DEFAULT_AUTO_SYNC_PROVIDERS: readonly AutoSyncProvider[] = [
  'dodofo',
  'intervals-icu',
  'zepp-fit',
] as const;

export const AUTO_SYNC_PROVIDER_LABELS: Record<AutoSyncProvider, string> = {
  'dodofo': 'dodofo (workouts + wellness + streams)',
  'intervals-icu': 'intervals.icu (workouts + wellness + streams + план)',
  'zepp-fit': 'Zepp FIT (локальная папка)',
  'strava-fit': 'Strava FIT/TCX (локальная папка)',
  'thresholds': 'Пороги и зоны',
};

export interface SyncSettings {
  source?: SyncSource;
  mode: SyncMode;
  // Автосинхронизация (v5-колонки, используем сейчас)
  autoOnStart?: boolean;
  /** Антидребезг: не чаще раза в N минут. null/undefined → 360 (6ч). */
  autoIntervalMin?: number | null;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  /**
   * Список провайдеров, участвующих в автосинхронизации.
   * v22. Если undefined/пусто — берём DEFAULT_AUTO_SYNC_PROVIDERS.
   */
  autoProviders?: AutoSyncProvider[];
  zeppProvider?: string;
  zeppFallbackProvider?: string;
  zeppAuthHost?: string;
  zeppDataHost?: string;
  zeppUserId?: string;
  zeppLastSyncAt?: string;
  zeppLastSyncStatus?: string;
  // dodofo
  dodofoUserId?: string;
  dodofoUsername?: string;
  dodofoLastSyncAt?: string;
  dodofoLastSyncStatus?: string;
}