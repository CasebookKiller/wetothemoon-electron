// src/main/services/pranaBindu/melange/repositories/syncRepo.ts
//
// Шифрование секретов — снаружи (в handler через safeStorage).
// Репозиторий принимает уже зашифрованные строки как есть.

import type { DatabaseSync } from 'node:sqlite';
import type { SyncSettings } from '../../spice/types';
import type { SyncSettingsRow } from '../types';

function rowToDomain(row: SyncSettingsRow): SyncSettings {
  return {
    source: (row.source as SyncSettings['source']) ?? undefined,
    mode: (row.mode as SyncSettings['mode']) ?? 'manual',
    zeppProvider: row.zepp_provider ?? undefined,
    zeppFallbackProvider: row.zepp_fallback_provider ?? undefined,
    zeppAuthHost: row.zepp_auth_host ?? undefined,
    zeppDataHost: row.zepp_data_host ?? undefined,
    zeppUserId: row.zepp_user_id ?? undefined,
    zeppLastSyncAt: row.zepp_last_sync_at ?? undefined,
    zeppLastSyncStatus: row.zepp_last_sync_status ?? undefined,
    dodofoUserId: row.dodofo_user_id ?? undefined,
    dodofoUsername: row.dodofo_username ?? undefined,
    dodofoLastSyncAt: row.dodofo_last_sync_at ?? undefined,
    dodofoLastSyncStatus: row.dodofo_last_sync_status ?? undefined,
  };
}

export function getSyncSettings(db: DatabaseSync): SyncSettings {
  const row = db
    .prepare('SELECT * FROM sync_settings WHERE id = 1')
    .get() as SyncSettingsRow | undefined;
  if (!row) return { mode: 'manual' };
  return rowToDomain(row);
}

/** Расширенный геттер — только для handler'а, которому нужны флаги секретов. */
export function getSyncSettingsInternal(
  db: DatabaseSync
): SyncSettingsRow | undefined {
  return db
    .prepare('SELECT * FROM sync_settings WHERE id = 1')
    .get() as SyncSettingsRow | undefined;
}

export function updateSyncSettings(
  db: DatabaseSync,
  patch: Partial<SyncSettings>
): SyncSettings {
  const current = getSyncSettingsInternal(db);
  if (!current) throw new Error('sync_settings не инициализирован (seed не выполнен)');

  const merged = {
    source: patch.source ?? current.source,
    mode: patch.mode ?? current.mode,
    zepp_provider: patch.zeppProvider ?? current.zepp_provider,
    zepp_fallback_provider:
      patch.zeppFallbackProvider ?? current.zepp_fallback_provider,
    zepp_auth_host: patch.zeppAuthHost ?? current.zepp_auth_host,
    zepp_data_host: patch.zeppDataHost ?? current.zepp_data_host,
    zepp_user_id: patch.zeppUserId ?? current.zepp_user_id,
    zepp_last_sync_at: patch.zeppLastSyncAt ?? current.zepp_last_sync_at,
    zepp_last_sync_status:
      patch.zeppLastSyncStatus ?? current.zepp_last_sync_status,
    dodofo_user_id: patch.dodofoUserId ?? current.dodofo_user_id,
    dodofo_username: patch.dodofoUsername ?? current.dodofo_username,
    dodofo_last_sync_at:
      patch.dodofoLastSyncAt ?? current.dodofo_last_sync_at,
    dodofo_last_sync_status:
      patch.dodofoLastSyncStatus ?? current.dodofo_last_sync_status,
  };

  db.prepare(
    `UPDATE sync_settings SET
      source = ?, mode = ?,
      zepp_provider = ?, zepp_fallback_provider = ?,
      zepp_auth_host = ?, zepp_data_host = ?,
      zepp_user_id = ?,
      zepp_last_sync_at = ?, zepp_last_sync_status = ?,
      dodofo_user_id = ?, dodofo_username = ?,
      dodofo_last_sync_at = ?, dodofo_last_sync_status = ?
     WHERE id = 1`
  ).run(
    merged.source,
    merged.mode,
    merged.zepp_provider,
    merged.zepp_fallback_provider,
    merged.zepp_auth_host,
    merged.zepp_data_host,
    merged.zepp_user_id,
    merged.zepp_last_sync_at,
    merged.zepp_last_sync_status,
    merged.dodofo_user_id,
    merged.dodofo_username,
    merged.dodofo_last_sync_at,
    merged.dodofo_last_sync_status
  );

  return getSyncSettings(db);
}

/**
 * Сохранение секретов Zepp (уже зашифрованных снаружи).
 * Отдельная функция, чтобы handler явно знал, что тут секреты.
 */
export function setZeppSecrets(
  db: DatabaseSync,
  payload: {
    credentialsJson: string | null;
    appToken: string | null;
  }
): void {
  db.prepare(
    `UPDATE sync_settings SET
      zepp_credentials_json = ?,
      zepp_app_token = ?
     WHERE id = 1`
  ).run(payload.credentialsJson, payload.appToken);
}

/** Флаги наличия секретов — без выдачи самих секретов наружу. */
export function getSyncSecretsFlags(db: DatabaseSync): {
  hasCredentials: boolean;
  hasAppToken: boolean;
} {
  const row = getSyncSettingsInternal(db);
  return {
    hasCredentials: !!row?.zepp_credentials_json,
    hasAppToken: !!row?.zepp_app_token,
  };
}

/**
 * Сохранение токена dodofo (уже зашифрованного снаружи).
 */
export function setDodofoToken(
  db: DatabaseSync,
  encryptedToken: string | null
): void {
  db.prepare(
    `UPDATE sync_settings SET dodofo_token = ? WHERE id = 1`
  ).run(encryptedToken);
}

/**
 * Чтение зашифрованного токена dodofo. Расшифровка — снаружи.
 */
export function getDodofoTokenEncrypted(db: DatabaseSync): string | null {
  const row = db
    .prepare(`SELECT dodofo_token FROM sync_settings WHERE id = 1`)
    .get() as { dodofo_token: string | null } | undefined;
  return row?.dodofo_token ?? null;
}

/** Флаг наличия токена dodofo — без выдачи значения. */
export function hasDodofoToken(db: DatabaseSync): boolean {
  const row = db
    .prepare(`SELECT dodofo_token FROM sync_settings WHERE id = 1`)
    .get() as { dodofo_token: string | null } | undefined;
  return !!row?.dodofo_token;
}

/**
 * Путь к папке с FIT-архивом Strava (для кнопки «Обновить»).
 */
export function setFitArchivePath(db: DatabaseSync, path: string | null): void {
  db.prepare(`UPDATE sync_settings SET fit_archive_path = ? WHERE id = 1`).run(
    path
  );
}

export function getFitArchivePath(db: DatabaseSync): string | null {
  const row = db
    .prepare(`SELECT fit_archive_path FROM sync_settings WHERE id = 1`)
    .get() as { fit_archive_path: string | null } | undefined;
  return row?.fit_archive_path ?? null;
}

export function setIntervalsCredentials(
  db: DatabaseSync,
  encryptedApiKey: string | null,
  athleteId: string | null
): void {
  db.prepare(
    `UPDATE sync_settings
     SET intervals_api_key = ?, intervals_athlete_id = ?
     WHERE id = 1`
  ).run(encryptedApiKey, athleteId);
}

export function getIntervalsApiKeyEncrypted(db: DatabaseSync): string | null {
  const row = db
    .prepare(`SELECT intervals_api_key FROM sync_settings WHERE id = 1`)
    .get() as { intervals_api_key: string | null } | undefined;
  return row?.intervals_api_key ?? null;
}

export function getIntervalsAthleteId(db: DatabaseSync): string | null {
  const row = db
    .prepare(`SELECT intervals_athlete_id FROM sync_settings WHERE id = 1`)
    .get() as { intervals_athlete_id: string | null } | undefined;
  return row?.intervals_athlete_id ?? null;
}

export function setZeppArchivePath(db: DatabaseSync, p: string | null): void {
  db.prepare(`UPDATE sync_settings SET zepp_archive_path = ? WHERE id = 1`).run(p);
}

export function getZeppArchivePath(db: DatabaseSync): string | null {
  const row = db
    .prepare(`SELECT zepp_archive_path FROM sync_settings WHERE id = 1`)
    .get() as { zepp_archive_path: string | null } | undefined;
  return row?.zepp_archive_path ?? null;
}