/**
 * Spice — аналитика, синхронизация, провайдеры.
 */

export type SyncSource =
  | 'google-fit'
  | 'zepp-dofek'
  | 'zepp-mcp'
  | 'zeppbridge'
  | 'manual';

export type SyncMode = 'manual' | 'auto';

export interface SyncSettings {
  source?: SyncSource;
  mode: SyncMode;
  zeppProvider?: string;
  zeppFallbackProvider?: string;
  zeppAuthHost?: string;
  zeppDataHost?: string;
  zeppUserId?: string;
  zeppLastSyncAt?: string;
  zeppLastSyncStatus?: string;
}