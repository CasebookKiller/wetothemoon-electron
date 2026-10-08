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

export interface SyncSettings {
  source?: SyncSource;
  mode: SyncMode;
  // Автосинхронизация (v5-колонки, используем сейчас)
  autoOnStart?: boolean;
  /** Антидребезг: не чаще раза в N минут. null/undefined → 360 (6ч). */
  autoIntervalMin?: number | null;
  lastSyncAt?: string;
  lastSyncStatus?: string;
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