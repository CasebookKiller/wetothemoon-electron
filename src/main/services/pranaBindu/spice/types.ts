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
 * Идентификаторы операций автосинхронизации. Каждая может быть
 * независимо включена/выключена пользователем.
 *
 *   dodofo         — fetchWorkouts + fetchWellness через dodofo
 *   intervals-icu  — fetchWorkouts + fetchWellness через ICU
 *   zepp-fit       — importZeppDir из zepp_archive_path
 *   strava-fit     — importFitDir из fit_archive_path (skipImported)
 *   icu-plan       — syncPlan за окно (тихо, без MirrorDelete)
 *   streams        — syncRunStreamsAll onlyMissing для новых фактов
 *   thresholds     — syncThresholds + syncZones (раз в сутки)
 */
export type AutoSyncProvider =
  | 'dodofo'
  | 'intervals-icu'
  | 'zepp-fit'
  | 'strava-fit'
  | 'icu-plan'
  | 'streams'
  | 'thresholds';

export const ALL_AUTO_SYNC_PROVIDERS: readonly AutoSyncProvider[] = [
  'dodofo',
  'intervals-icu',
  'zepp-fit',
  'strava-fit',
  'icu-plan',
  'streams',
  'thresholds',
] as const;

/** Дефолт при первом запуске или если колонка пуста. */
export const DEFAULT_AUTO_SYNC_PROVIDERS: readonly AutoSyncProvider[] = [
  'dodofo',
  'intervals-icu',
  'zepp-fit',
  'icu-plan',
  'streams',
  // strava-fit и thresholds — по умолчанию выключены,
  // чтобы не нагружать старт приложения.
] as const;

/** Русские подписи для UI. */
export const AUTO_SYNC_PROVIDER_LABELS: Record<AutoSyncProvider, string> = {
  'dodofo': 'dodofo (workouts + wellness)',
  'intervals-icu': 'intervals.icu (workouts + wellness)',
  'zepp-fit': 'Zepp FIT (локальная папка)',
  'strava-fit': 'Strava FIT/TCX (локальная папка)',
  'icu-plan': 'План ICU',
  'streams': 'Потоки (новые факты)',
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