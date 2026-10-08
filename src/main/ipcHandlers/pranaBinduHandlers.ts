// src/main/ipcHandlers/pranaBinduHandlers.ts

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { app, dialog, ipcMain, safeStorage } from 'electron';
import {
  createPranaBinduWindow,
  getPranaBinduWindow,
} from '../windows/pranaBinduWindow';
import { detectZeppConnection } from '../services/pranaBindu/spice/providers/regionDetector';
import { DofekZeppProvider } from '../services/pranaBindu/spice/providers/dofekProvider';
import { ZeppMcpProvider } from '../services/pranaBindu/spice/providers/mcpProvider';
import { ZeppBridgeProvider } from '../services/pranaBindu/spice/providers/bridgeProvider';
import {
  registerProvider,
  getProvider,
  listProviders,
} from '../services/pranaBindu/spice/providers';
import {
  getMelange,
  getProfile,
  updateProfile,
  getSyncSettings,
  updateSyncSettings,
  setZeppSecrets,
  getSyncSecretsFlags,
  setDodofoToken,
  getDodofoTokenEncrypted,
  hasDodofoToken,
  upsertRunFact,
  listRunFacts,
  upsertRunStreams,
  listRunStreams,
  getRunStreamWithPayload,
  getRunStreamMeta,
  hasRunStreams,
  getFitArchivePath,
  setFitArchivePath,
  upsertRecoveryLog,
  listRecoveryLogs,
  setIntervalsCredentials,
  getIntervalsApiKeyEncrypted,
  getIntervalsAthleteId as getIntervalsAthleteIdFromDb,
  setZeppArchivePath,
  getZeppArchivePath,
  upsertPlanEvent,
  listPlanEvents,
  deletePlanEventsRange,
  linkPlanEventToActivity,
  deleteGeneratedEvents,
  createWorkoutSession,
  updateWorkoutSession,
  getWorkoutSession,
  listWorkoutSessions,
  listWorkoutSessionsForPlanEvent,
  deleteWorkoutSession,
  listEquivalences,
  listEquivalencesFor,
  setEquivalence,
  deleteEquivalence,
  setLastAutoSync,
  listExerciseProgress,
  getExerciseProgress,
  setExerciseProgress,
} from '../services/pranaBindu/melange';

import { DodofoProvider } from '../services/pranaBindu/spice/providers/dodofoProvider';
import { IntervalsIcuProvider } from '../services/pranaBindu/spice/providers/intervalsIcuProvider';
import { parseFit } from '../services/pranaBindu/spice/parsers/fitParser';
import { parseTcx } from '../services/pranaBindu/spice/parsers/tcxParser';
import { parseStravaCsv } from '../services/pranaBindu/spice/parsers/stravaCsvParser';
import { createPlanEventLocally, deletePlanEventLocally, deletePlanEventsByIds, findStaleIcuEvents, listPlanEventsForDelete, setLocalKeep, updatePlanEventLocally } from '../services/pranaBindu/melange/repositories/planEventsRepo';
import { ALL_PROGRAMS, findProgram } from '../services/pranaBindu/mentat/programs';
import {
  buildProgramPreview,
  buildEventText,
} from '../services/pranaBindu/mentat/wadeProgramGenerator';
import type { MovementState } from '../services/pranaBindu/mentat/wadeProgramGenerator';
import { parseWorkoutText } from '../services/pranaBindu/mentat/workoutParser';
import {
  matchIcuWorkout,
  matchIcuLine,
} from '../services/pranaBindu/mentat/workoutMatcher';
// ==================== Регистрация провайдеров ====================

let providersRegistered = false;
/** Флаг отмены текущего импорта (один импорт за раз — этого достаточно). */
let importFitCancelRequested = false;
/** Флаг отмены текущей заливки потоков. */
let syncStreamsCancelRequested = false;

function getIntervalsAthleteId(): string | null {
  try {
    const id = getIntervalsAthleteIdFromDb(getMelange());
    if (id) return id;
  } catch { /* ignore */ }
  return process.env.VITE_INTERVALS_ATHLETE_ID?.trim() || null;
}

function ensureProvidersRegistered(): void {
  if (providersRegistered) return;
  registerProvider(new DofekZeppProvider());
  registerProvider(new ZeppMcpProvider());
  registerProvider(new ZeppBridgeProvider());
  registerProvider(new DodofoProvider(getDodofoToken));
  registerProvider(new IntervalsIcuProvider({
    getApiKey: getIntervalsApiKey,
    getAthleteId: getIntervalsAthleteId,
  }));
  providersRegistered = true;
  console.log(`[Prana-Bindu] Зарегистрировано провайдеров: ${listProviders().length} (${listProviders().map(p => p.name).join(', ')})`);
}

// ==================== safeStorage helpers ====================

/**
 * Шифрует строку через safeStorage. Если шифрование недоступно
 * (Linux без keyring и т.п.) — возвращает null и логирует предупреждение.
 */
function encryptSecret(plain: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[Prana-Bindu] safeStorage недоступен — секрет не сохранён');
      return null;
    }
    return safeStorage.encryptString(plain).toString('base64');
  } catch (e) {
    console.error('[Prana-Bindu] Ошибка шифрования:', (e as Error).message);
    return null;
  }
}

/**
 * Компактная сводка по сырому ответу fetchStreams.
 * Не возвращает массивы целиком — только длину, тип, sample, min/max/avg.
 * Полный JSON — через опцию writeFile.
 */
function summarizeStreams(raw: unknown): Record<string, unknown> {
  if (raw == null) return { empty: true };

  const out: any = {
    raw_type: Array.isArray(raw) ? 'array' : typeof raw,
    channels: {},
    total_points: 0,
  };

  const walk = (obj: any, prefix = ''): void => {
    if (Array.isArray(obj)) {
      const len = obj.length;
      const first = obj[0];
      const info: any = {
        length: len,
        sample: obj.slice(0, 5),
        type: typeof first,
      };

      if (typeof first === 'number' && len > 0) {
        let min = first, max = first, sum = 0, nulls = 0;
        for (const v of obj) {
          if (v == null || Number.isNaN(v)) { nulls++; continue; }
          if (v < min) min = v;
          if (v > max) max = v;
          sum += v;
        }
        info.min = min;
        info.max = max;
        info.avg = Number((sum / Math.max(1, len - nulls)).toFixed(3));
        info.nulls = nulls;
      }

      out.channels[prefix || 'root'] = info;
      out.total_points = Math.max(out.total_points, len);
    } else if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        walk(obj[k], prefix ? `${prefix}.${k}` : k);
      }
    } else {
      out.channels[prefix || 'root'] = { value: obj, type: typeof obj };
    }
  };

  walk(raw);
  return out;
}

/**
 * Читает файл (.fit / .fit.gz / .tcx / .tcx.gz) и парсит в UnifiedWorkout.
 * Возвращает workout и реальный source ('fit' | 'tcx').
 */
function parseWorkoutFile(
  filePath: string,
  externalId: string
): Promise<import('../services/pranaBindu/spice/parsers/types').UnifiedWorkout> {
  const lower = filePath.toLowerCase();
  const isGz = lower.endsWith('.gz');
  const isFit = /\.fit(\.gz)?$/i.test(lower);
  const isTcx = /\.tcx(\.gz)?$/i.test(lower);

  const raw = fs.readFileSync(filePath);
  const buffer = isGz ? zlib.gunzipSync(raw) : raw;

  if (isFit) return parseFit(buffer, { externalId });
  if (isTcx) return Promise.resolve(parseTcx(buffer, { externalId }));
  return Promise.reject(new Error(`Неизвестный формат: ${filePath}`));
}

function detectSource(filePath: string): 'fit' | 'tcx' {
  if (/\.fit(\.gz)?$/i.test(filePath)) return 'fit';
  if (/\.tcx(\.gz)?$/i.test(filePath)) return 'tcx';
  throw new Error(`Не удалось определить источник: ${filePath}`);
}

interface ImportFilesResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
  importedIds: number[];
  updatedDates: string[];       // ← новое
  errors: Array<{ file: string; error: string }>;
}

async function performImportFiles(
  files: string[],
  db: ReturnType<typeof getMelange>,
  sendProgress: (payload: Record<string, unknown>) => void,
  origin: string,
  skipImported: boolean
): Promise<ImportFilesResult> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let cancelled = false;
  const errors: Array<{ file: string; error: string }> = [];
  const importedIds: number[] = [];
  const updatedDates: string[] = [];

  for (let i = 0; i < files.length; i++) {
    if (importFitCancelRequested) {
      cancelled = true;
      break;
    }

    const file = files[i];
    const basename = path
      .basename(file)
      .replace(/\.(fit|tcx)(\.gz)?$/i, '');
    const source = detectSource(file);
    const externalId = `${source}:${basename}`;

    if (skipImported) {
      const existing = db
        .prepare(
          `SELECT id FROM run_facts WHERE source = ? AND external_id = ? LIMIT 1`
        )
        .get(source, externalId) as { id: number } | undefined;
      if (existing) {
        skipped++;
        sendProgress({
          current: i + 1,
          total: files.length,
          filename: path.basename(file),
          imported,
          updated,
          skipped,
          failed,
        });
        await new Promise((r) => setImmediate(r));
        continue;
      }
    }

    try {
      const workout = await parseWorkoutFile(file, basename);

      const startMs = new Date(workout.startTime).getTime();
      const endTime = new Date(
        startMs + workout.durationSec * 1000
      ).toISOString();

      const raw = {
        externalId,
        source: workout.source,
        origin,
        startTime: workout.startTime,
        endTime,
        distanceM: workout.distanceM,
        durationS: workout.durationSec,
        avgHr: workout.summary.avgHr,
        maxHr: workout.summary.maxHr,
        gpsQuality: workout.summary.gpsQuality,
        distanceSource: workout.summary.distanceSource,
        gpsCoveragePct: workout.summary.gpsCoveragePct,
        raw: {
          sport: workout.sport,
          summary: workout.summary,
          validation: workout.validation,
          lapCount: workout.laps?.length ?? 0,
          importedFrom: file,
        },
      };

      const { inserted, id: runFactId } = upsertRunFact(db, raw);

      const row = db
        .prepare(`SELECT date FROM run_facts WHERE id = ?`)
        .get(runFactId) as { date: string } | undefined;
      const dateForFile = row?.date ?? workout.startTime.slice(0, 10);

      upsertRunStreams(
        db,
        runFactId,
        workout.source,
        externalId,
        dateForFile,
        workout.streams as unknown as Record<string, unknown>
      );

      if (inserted) imported++;
      else {
        updated++;
        if (row?.date) updatedDates.push(row.date);
      }
      importedIds.push(runFactId);
    } catch (e) {
      failed++;
      errors.push({
        file: path.basename(file),
        error: (e as Error).message,
      });
    }

    sendProgress({
      current: i + 1,
      total: files.length,
      filename: path.basename(file),
      imported,
      updated,
      skipped,
      failed,
    });

    await new Promise((r) => setImmediate(r));
  }

  return { imported, updated, skipped, failed, cancelled, importedIds, updatedDates, errors };
}

/**
 * Загружает потоки (и, где возможно, обогащает метаданные)
 * для одного run_fact. Используется и в одиночном синке, и в батче.
 */
async function syncStreamsForFact(
  db: ReturnType<typeof getMelange>,
  provider: any,
  providerName: string,
  fact: { id: number; source: string; external_id: string | null; date: string },
  onlyMissing: boolean
): Promise<{ status: 'fetched' | 'skipped' | 'failed'; error?: string }> {
  // Для ICU потоки физически пишутся с source='fit' (это FIT-файл,
  // полученный через ICU). Для dodofo — с source='dodofo'.
  const streamSource = providerName === 'intervals-icu' ? 'fit' : providerName;

  if (onlyMissing && hasRunStreams(db, fact.id, streamSource)) {
    return { status: 'skipped' };
  }

  const extId = fact.external_id;
  if (!extId) return { status: 'failed', error: 'external_id пуст' };

  // === intervals.icu ===
  if (providerName === 'intervals-icu') {
    if (typeof provider.fetchUnifiedWorkout !== 'function') {
      return { status: 'failed', error: 'fetchUnifiedWorkout не реализован' };
    }
    const m = extId.match(/^intervals-icu:(.+)$/);
    if (!m) {
      return { status: 'failed', error: `external_id '${extId}' не в формате intervals-icu:<id>` };
    }
    const activityId = m[1];

    const workout = await provider.fetchUnifiedWorkout(activityId);

    upsertRunStreams(
      db,
      fact.id,
      streamSource,
      `fit:${activityId}`,
      fact.date,
      workout.streams as unknown as Record<string, unknown>
    );

    // Обогащаем метаданные из FIT. COALESCE — чтобы null из FIT
    // не затирал уже сохранённые значения.
    const summary = workout.summary;
    db.prepare(
      `UPDATE run_facts SET
         actual_km        = COALESCE(?, actual_km),
         avg_hr           = COALESCE(?, avg_hr),
         max_hr           = COALESCE(?, max_hr),
         duration_sec     = COALESCE(?, duration_sec),
         gps_quality      = COALESCE(?, gps_quality),
         distance_source  = COALESCE(?, distance_source),
         gps_coverage_pct = COALESCE(?, gps_coverage_pct)
       WHERE id = ?`
    ).run(
      workout.distanceM > 0
        ? Math.round((workout.distanceM / 1000) * 1000) / 1000
        : null,
      summary.avgHr ?? null,
      summary.maxHr ?? null,
      workout.durationSec > 0 ? Math.round(workout.durationSec) : null,
      summary.gpsQuality ?? null,
      summary.distanceSource ?? null,
      summary.gpsCoveragePct ?? null,
      fact.id
    );

    return { status: 'fetched' };
  }

  // === dodofo ===
  if (providerName === 'dodofo') {
    if (typeof provider.fetchStreams !== 'function') {
      return { status: 'failed', error: 'fetchStreams не реализован' };
    }
    const m = extId.match(/^dodofo:(\d+)$/);
    if (!m) {
      return { status: 'failed', error: `external_id '${extId}' не в формате dodofo:<id>` };
    }
    const activityId = Number(m[1]);

    const raw = await provider.fetchStreams(activityId);
    if (raw == null || typeof raw !== 'object') {
      return { status: 'failed', error: 'Пустой ответ fetchStreams' };
    }

    upsertRunStreams(
      db,
      fact.id,
      'dodofo',
      extId,
      fact.date,
      raw as Record<string, unknown>
    );

    return { status: 'fetched' };
  }

  return { status: 'failed', error: `Провайдер «${providerName}» пока не поддержан для потоков` };
}

// ==================== dodofo token ====================

/**
 * Источник токена dodofo.
 * 1. Из БД (расшифрован через safeStorage) — основной путь.
 * 2. Fallback: process.env.VITE_DODOFO_TOKEN — только для dev.
 */
function getDodofoToken(): string | null {
  try {
    const db = getMelange();
    const encrypted = getDodofoTokenEncrypted(db);
    if (encrypted && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(
        Buffer.from(encrypted, 'base64')
      );
      if (decrypted) return decrypted;
    }
  } catch {
    // БД ещё не готова или расшифровка недоступна — уходим в env.
  }
  return process.env.VITE_DODOFO_TOKEN?.trim() || null;
}

function getIntervalsApiKey(): string | null {
  try {
    const db = getMelange();
    const enc = getIntervalsApiKeyEncrypted(db);
    if (enc && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'));
    }
  } catch { /* ignore */ }
  // Dev-fallback
  return process.env.VITE_INTERVALS_API_KEY?.trim() || null;
}

/**
 * Шифрует и сохраняет токен dodofo. Если safeStorage недоступен,
 * пишет как есть (dev-режим без keyring).
 */
function persistDodofoToken(plainToken: string): void {
  const db = getMelange();
  let stored: string;
  if (safeStorage.isEncryptionAvailable()) {
    stored = safeStorage.encryptString(plainToken).toString('base64');
  } else {
    console.warn('[Prana-Bindu] safeStorage недоступен — токен сохранён без шифрования');
    stored = plainToken;
  }
  setDodofoToken(db, stored);
}

// ==================== Регистрация хендлеров ====================

export function registerPranaBinduHandlers(): void {
  ensureProvidersRegistered();

  // -------- Окно --------
  ipcMain.handle('pb:open-window', () => {
    const existing = getPranaBinduWindow();
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return;
    }
    createPranaBinduWindow();
  });

  // -------- Health-check --------
  ipcMain.handle('pb:ping', () => ({ pong: true }));

  // -------- Профиль --------
  ipcMain.handle('pb:get-profile', () => {
    try {
      return { success: true, data: getProfile(getMelange()) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:update-profile', (_event, patch) => {
    try {
      // Источник НЕ ставим здесь. Логика в updateProfile:
      // — если значение изменилось, а source не передан → 'manual';
      // — если значение не изменилось и source не передан → оставить как есть.
      const updated = updateProfile(getMelange(), patch);
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Настройки синхронизации --------
  ipcMain.handle('pb:sync-settings-get', () => {
    try {
      const settings = getSyncSettings(getMelange());
      const flags = getSyncSecretsFlags(getMelange());
      return { success: true, data: { ...settings, ...flags } };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:sync-settings-update', (_event, patch) => {
  try {
    // Защита: через этот канал секреты не принимаем.
    // Для секретов — pb:zepp-connect.
    const { zeppAppToken, zeppCredentials, ...safePatch } = patch ?? {};
    const updated = updateSyncSettings(getMelange(), safePatch);
    return { success: true, data: updated };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
});

  // -------- Проверка доступности провайдера --------
  ipcMain.handle('pb:zepp-check-provider', async (_event, name: string) => {
    try {
      const provider = getProvider(name);
      if (!provider) {
        return { available: false, reason: `Провайдер «${name}» не зарегистрирован` };
      }
      return await provider.isAvailable();
    } catch (e) {
      return { available: false, reason: (e as Error).message };
    }
  });

  // -------- Возможности провайдера --------
  ipcMain.handle('pb:provider-capabilities', (_event, name: string) => {
    try {
      const provider = getProvider(name);
      if (!provider) {
        return {
          success: false,
          error: `Провайдер «${name}» не зарегистрирован`,
        };
      }
      return {
        success: true,
        provider: name,
        data: provider.capabilities,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Подключение к Zepp --------
  ipcMain.handle('pb:zepp-connect', async (_event, email: string, password: string) => {
    if (!email || !password) {
      return { success: false, error: 'Email и пароль обязательны' };
    }

    try {
      const result = await detectZeppConnection(email, password);
      const db = getMelange();

      // Обновляем sync_settings
      updateSyncSettings(db, {
        zeppProvider: 'dofek-zepp',
        zeppAuthHost: result.authHost,
        zeppDataHost: result.dataHost,
        zeppUserId: result.userId,
        zeppLastSyncAt: new Date().toISOString(),
        zeppLastSyncStatus: 'connected',
      });

      // Шифруем и сохраняем секреты
      const credsEncrypted = encryptSecret(JSON.stringify({ email, password }));
      const tokenEncrypted = encryptSecret(result.appToken);
      setZeppSecrets(db, {
        credentialsJson: credsEncrypted,
        appToken: tokenEncrypted,
      });

      // Наружу — только безопасные поля, без appToken.
      return {
        success: true,
        userId: result.userId,
        authHost: result.authHost,
        dataHost: result.dataHost,
      };
    } catch (e) {
      try {
        updateSyncSettings(getMelange(), {
          zeppLastSyncAt: new Date().toISOString(),
          zeppLastSyncStatus: 'error',
        });
      } catch {
        // ignore — если БД ещё не готова
      }
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Подключение к dodofo --------
  ipcMain.handle('pb:dodofo-connect', async (_event, token: string) => {
    if (!token || !token.trim()) {
      return { success: false, error: 'Токен обязателен' };
    }
    const trimmed = token.trim();
    if (!trimmed.startsWith('dodofo_')) {
      return { success: false, error: 'Токен должен начинаться с "dodofo_"' };
    }

    try {
      persistDodofoToken(trimmed);

      // Проверяем токен живым запросом
      const provider = getProvider('dodofo');
      if (!provider) {
        return { success: false, error: 'Провайдер dodofo не зарегистрирован' };
      }
      const check = await provider.isAvailable();
      if (!check.available) {
        return { success: false, error: check.reason ?? 'Токен не работает' };
      }

      updateSyncSettings(getMelange(), {
        source: 'dodofo',
        dodofoLastSyncAt: new Date().toISOString(),
        dodofoLastSyncStatus: 'connected',
      });

      return { success: true };
    } catch (e) {
      try {
        updateSyncSettings(getMelange(), {
          dodofoLastSyncAt: new Date().toISOString(),
          dodofoLastSyncStatus: 'error',
        });
      } catch {
        // ignore
      }
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Статус токена dodofo --------
  ipcMain.handle('pb:dodofo-token-status', () => {
    try {
      return { success: true, hasToken: hasDodofoToken(getMelange()) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Список тренировок --------
  ipcMain.handle(
    'pb:list-run-facts',
    (_event, from: string, to: string) => {
      try {
        if (!from || !to) {
          return { success: false, error: 'from и to обязательны' };
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
          return {
            success: false,
            error: 'Неверный формат даты. Ожидается YYYY-MM-DD',
          };
        }
        const rows = listRunFacts(getMelange(), from, to);
        return { success: true, items: rows, total: rows.length };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Все тренировки за дату --------
  ipcMain.handle('pb:list-run-facts-by-date', (_event, date: string) => {
    try {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, error: 'Дата в формате YYYY-MM-DD' };
      }
      const rows = getMelange()
        .prepare(
          `SELECT * FROM run_facts
           WHERE date = ?
           ORDER BY
             CASE source
               WHEN 'fit' THEN 1
               WHEN 'tcx' THEN 2
               WHEN 'dodofo' THEN 3
               WHEN 'manual' THEN 4
               ELSE 5
             END,
             id ASC`
        )
        .all(date) as unknown as any[];
      return { success: true, items: rows, total: rows.length };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Ручная синхронизация --------
  ipcMain.handle(
    'pb:sync-now',
    async (
      _event,
      from: string,
      to: string,
      providerName?: string
    ) => {
      if (!from || !to) {
        return { success: false, error: 'from и to обязательны (YYYY-MM-DD)' };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return { success: false, error: 'Формат даты: YYYY-MM-DD' };
      }
      if (from > to) {
        return { success: false, error: 'from больше to' };
      }

      // Провайдер по умолчанию — из sync_settings.source или dodofo
      const name =
        providerName ??
        getSyncSettings(getMelange()).source ??
        'dodofo';

      try {
        const provider = getProvider(name) as any;
        if (!provider) {
          return { success: false, error: `Провайдер «${name}» не зарегистрирован` };
        }
        if (!provider.capabilities?.workouts) {
          return { success: false, error: `Провайдер «${name}» не поддерживает workouts` };
        }
        if (typeof provider.fetchWorkouts !== 'function') {
          return { success: false, error: `Провайдер «${name}» не реализует fetchWorkouts` };
        }

        const db = getMelange();
        const workouts = await provider.fetchWorkouts(from, to);

        let added = 0;
        let updated = 0;
        let streamsFetched = 0;
        let streamsFailed = 0;

        for (const w of workouts) {
          const res = upsertRunFact(db, w);
          if (res.inserted) added++;
          else updated++;

          /*// Для intervals.icu — сразу тянем FIT и потоки
          if (
            name === 'intervals-icu' &&
            typeof provider.fetchUnifiedWorkout === 'function'
          ) {
            try {
              const activityId = String(w.externalId ?? '').replace(
                /^intervals-icu:/,
                ''
              );
              const workout = await provider.fetchUnifiedWorkout(activityId);

              const row = db
                .prepare(`SELECT date FROM run_facts WHERE id = ?`)
                .get(res.id) as { date: string } | undefined;
              const dateForFile =
                row?.date ?? workout.startTime.slice(0, 10);

              upsertRunStreams(
                db,
                res.id,
                'fit',
                `fit:${activityId}`,
                dateForFile,
                workout.streams as unknown as Record<string, unknown>
              );

              // Обновим run_facts метаданными из FIT (distance, hr,
              // gps_quality). Провайдер может отдавать менее точные
              // числа из списка, чем из FIT-файла.
              const summary = workout.summary;
              db.prepare(
                `UPDATE run_facts SET
                   actual_km      = ?,
                   avg_hr         = ?,
                   max_hr         = ?,
                   duration_sec   = ?,
                   gps_quality    = ?,
                   distance_source = ?,
                   gps_coverage_pct = ?
                 WHERE id = ?`
              ).run(
                Math.round((workout.distanceM / 1000) * 1000) / 1000,
                summary.avgHr ?? null,
                summary.maxHr ?? null,
                Math.round(workout.durationSec),
                summary.gpsQuality,
                summary.distanceSource,
                summary.gpsCoveragePct,
                res.id
              );

              streamsFetched++;
            } catch (e) {
              streamsFailed++;
              console.error(
                `[Prana-Bindu] sync-now: не удалось загрузить потоки для ${w.externalId}:`,
                (e as Error).message
              );
            }
          }*/
        }

        console.log(
          `[Prana-Bindu] sync-now (${name}) ${from}..${to}: ` +
          `+${added} ~${updated} (всего ${workouts.length})` +
          (streamsFetched || streamsFailed
            ? `, streams: ${streamsFetched} ok / ${streamsFailed} err`
            : '')
        );

        return {
          success: true,
          provider: name,
          added,
          updated,
          skipped: 0,
          total: workouts.length,
          streamsFetched,
          streamsFailed,
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: сырой ответ fetchStreams --------
  ipcMain.handle(
    'pb:debug-streams',
    async (_event, runFactId: number, opts?: { writeFile?: boolean }) => {
      try {
        if (!Number.isFinite(runFactId)) {
          return { success: false, error: 'runFactId обязателен (число)' };
        }

        const db = getMelange();
        const row = db
          .prepare(
            `SELECT id, source, external_id, date, actual_km
             FROM run_facts WHERE id = ?`
          )
          .get(runFactId) as
          | { id: number; source: string; external_id: string; date: string; actual_km: number | null }
          | undefined;

        if (!row) {
          return { success: false, error: `run_fact #${runFactId} не найден` };
        }
        if (row.source !== 'dodofo') {
          return {
            success: false,
            error: `Источник '${row.source}' — debug-streams пока только для dodofo`,
          };
        }

        const m = String(row.external_id || '').match(/^dodofo:(\d+)$/);
        if (!m) {
          return {
            success: false,
            error: `external_id '${row.external_id}' не в формате 'dodofo:<id>'`,
          };
        }
        const activityId = Number(m[1]);

        const provider = getProvider('dodofo') as any;
        if (!provider || typeof provider.fetchStreams !== 'function') {
          return { success: false, error: 'Провайдер dodofo не поддерживает fetchStreams' };
        }

        const t0 = Date.now();
        const raw = await provider.fetchStreams(activityId);
        const dt = Date.now() - t0;

        const jsonStr = JSON.stringify(raw);
        const summary = summarizeStreams(raw);
        summary.json_size_bytes = jsonStr.length;
        summary.fetch_ms = dt;

        if (opts?.writeFile) {
          const dir = path.join(app.getPath('userData'), 'prana_bindu', 'debug');
          fs.mkdirSync(dir, { recursive: true });
          const fn = `streams_${runFactId}_${new Date()
            .toISOString()
            .replace(/[:.]/g, '-')}.json`;
          const fp = path.join(dir, fn);
          fs.writeFileSync(fp, jsonStr, 'utf8');
          summary.debug_file = fp;
        }

        console.log(
          `[Prana-Bindu] debug-streams: fact=${runFactId}, activity=${activityId}, ` +
          `points=${summary.total_points}, size=${summary.json_size_bytes}B, ${dt}ms`
        );

        return { success: true, activityId, data: summary };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: сырой ответ fetchThresholds --------
  ipcMain.handle('pb:debug-thresholds', async () => {
    try {
      const provider = getProvider('dodofo') as any;
      if (!provider || typeof provider.fetchThresholds !== 'function') {
        return { success: false, error: 'Провайдер dodofo не поддерживает fetchThresholds' };
      }
      const t0 = Date.now();
      const raw = await provider.fetchThresholds();
      const dt = Date.now() - t0;

      console.log('[Prana-Bindu] debug-thresholds:', JSON.stringify(raw));

      return { success: true, fetchMs: dt, data: raw };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Синхронизация порогов --------
  // -------- Подтянуть пороги из активного провайдера --------
  ipcMain.handle('pb:sync-thresholds', async (_event, providerName?: string) => {
    try {
      const name =
        providerName ??
        getSyncSettings(getMelange()).source ??
        'dodofo';

      const provider = getProvider(name) as any;
      if (!provider) {
        return { success: false, error: `Провайдер «${name}» не зарегистрирован` };
      }
      if (!provider.capabilities?.thresholds) {
        return {
          success: false,
          error: `Провайдер «${name}» не поддерживает пороги`,
        };
      }
      if (typeof provider.fetchThresholds !== 'function') {
        return {
          success: false,
          error: `Провайдер «${name}» не реализует fetchThresholds`,
        };
      }

      const raw = await provider.fetchThresholds();
      const db = getMelange();

            const patch: Record<string, number | string> = {};
      const applied: string[] = [];

      if (raw?.resthr?.value != null) {
        patch.restingHr = Number(raw.resthr.value);
        patch.restingHrSource = name;
        applied.push(`resthr=${raw.resthr.value}`);
      }
      if (raw?.lthr?.value != null) {
        patch.lactateThresholdHr = Number(raw.lthr.value);
        patch.lthrSource = name;
        applied.push(`lthr=${raw.lthr.value}`);
      }
      if (raw?.hrmax?.value != null) {
        patch.maxHr = Number(raw.hrmax.value);
        patch.maxHrSource = name;
        applied.push(`hrmax=${raw.hrmax.value}`);
      }

      if (Object.keys(patch).length === 0) {
        return {
          success: false,
          error: `Провайдер «${name}» не отдал ни одного порога`,
        };
      }

      const updated = updateProfile(db, patch);
      console.log(`[Prana-Bindu] sync-thresholds (${name}): ${applied.join(', ')}`);

      return { success: true, provider: name, applied, data: updated };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Подтянуть HR-зоны --------
  ipcMain.handle('pb:sync-zones', async (_event, providerName?: string) => {
    const name =
      providerName ??
      getSyncSettings(getMelange()).source ??
      'intervals-icu';

    try {
      const provider = getProvider(name) as any;
      if (!provider) {
        return { success: false, error: `Провайдер «${name}» не зарегистрирован` };
      }
      if (typeof provider.fetchZones !== 'function') {
        return { success: false, error: `Провайдер «${name}» не реализует fetchZones` };
      }

      const raw = await provider.fetchZones();
      const hrZones = Array.isArray(raw?.hr_zones) ? raw.hr_zones : null;
      const paceZonesKmh = Array.isArray(raw?.pace_zones_kmh)
        ? raw.pace_zones_kmh
        : null;
      const thresholdPaceMs =
        typeof raw?.threshold_pace_ms === 'number'
          ? raw.threshold_pace_ms
          : undefined;

      if (!hrZones && !paceZonesKmh) {
        return { success: false, error: `Провайдер «${name}» не отдал зоны` };
      }

      const db = getMelange();
      const patch: Record<string, unknown> = {};
      if (hrZones) {
        patch.hrZones = hrZones;
        patch.hrZonesSource = name;
      }
      if (paceZonesKmh) {
        patch.paceZonesKmh = paceZonesKmh;
        patch.paceZonesSource = name;
        patch.thresholdPaceMs = thresholdPaceMs;
      }

      const updated = updateProfile(db, patch as any);

      console.log(
        `[Prana-Bindu] sync-zones (${name}): hr=[${hrZones?.join(', ') ?? '—'}], ` +
        `pace=[${paceZonesKmh?.join(', ') ?? '—'}] км/ч`
      );

      return {
        success: true,
        provider: name,
        hr_zones: hrZones,
        pace_zones_kmh: paceZonesKmh,
        data: updated,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Разведка: сырой ответ fetchZones --------
  ipcMain.handle('pb:debug-zones', async () => {
    try {
      const provider = getProvider('dodofo') as any;
      if (!provider || typeof provider.fetchZones !== 'function') {
        return { success: false, error: 'Провайдер dodofo не поддерживает fetchZones' };
      }
      const t0 = Date.now();
      const raw = await provider.fetchZones();
      const dt = Date.now() - t0;

      console.log('[Prana-Bindu] debug-zones:', JSON.stringify(raw));

      return { success: true, fetchMs: dt, data: raw };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Разведка: сырой ответ /me/zones (без обёртки провайдера) --------
  ipcMain.handle('pb:debug-zones-raw', async () => {
    try {
      const token = getDodofoToken();
      if (!token) return { success: false, error: 'token not configured' };

      const url = 'https://dodofo.ru/api/v1/me/zones';
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const body = await res.text();
      return {
        success: res.ok,
        status: res.status,
        body: body.slice(0, 4000),
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Разведка: парсинг FIT --------
  ipcMain.handle('pb:debug-parse-fit', async (_event, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'filePath обязателен' };
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Файл не найден: ${filePath}` };
      }

      const lower = filePath.toLowerCase();
      const isGz = lower.endsWith('.gz');
      const isTcx = /\.tcx(\.gz)?$/i.test(lower);
      const isFit = /\.fit(\.gz)?$/i.test(lower);

      if (!isTcx && !isFit) {
        return { success: false, error: `Не FIT и не TCX: ${filePath}` };
      }

      const raw = fs.readFileSync(filePath);
      const buffer = isGz ? zlib.gunzipSync(raw) : raw;
      const externalId = path
        .basename(filePath)
        .replace(/\.(fit|tcx)(\.gz)?$/i, '');

      const t0 = Date.now();
      const workout = isTcx
        ? parseTcx(buffer, { externalId })
        : await parseFit(buffer, { externalId });
      const dt = Date.now() - t0;

      const summary = {
        source: workout.source,
        externalId: workout.externalId,
        startTime: workout.startTime,
        durationSec: workout.durationSec,
        distanceM: workout.distanceM,
        sport: workout.sport,
        streamLengths: {
          secT: workout.streams.secT.length,
          hr: workout.streams.hr?.length,
          speedKmh: workout.streams.speedKmh?.length,
          cadence: workout.streams.cadence?.length,
          elevationM: workout.streams.elevationM?.length,
          latlng: workout.streams.latlng?.length,
          distM: workout.streams.distM?.length,
        },
        summary: workout.summary,
        validation: workout.validation,
        lapCount: workout.laps?.length ?? 0,
        parseMs: dt,
        fileBytes: buffer.length,
      };

      console.log(
        `[Prana-Bindu] debug-parse-fit: ${externalId} (${workout.source}), ` +
        `records=${workout.streams.secT.length}, ` +
        `duration=${workout.durationSec}s, distance=${workout.distanceM}m, ` +
        `GPS=${workout.summary.gpsCoveragePct}%, ` +
        `flags=[${workout.validation.flags.join(',')}], ` +
        `conf=${workout.validation.confidence}, ${dt}ms`
      );

      return { success: true, data: summary };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Сохранение потоков одной тренировки --------
  ipcMain.handle(
    'pb:sync-run-streams',
    async (_event, runFactId: number, providerName?: string) => {
      if (!Number.isFinite(runFactId)) {
        return { success: false, error: 'runFactId обязателен (число)' };
      }
      try {
        const db = getMelange();
        const fact = db
          .prepare(
            `SELECT id, source, external_id, date FROM run_facts WHERE id = ?`
          )
          .get(runFactId) as
          | { id: number; source: string; external_id: string | null; date: string }
          | undefined;
        if (!fact) {
          return { success: false, error: `run_fact #${runFactId} не найден` };
        }

        const name = providerName ?? fact.source ?? 'dodofo';
        const provider = getProvider(name) as any;
        if (!provider) {
          return { success: false, error: `Провайдер «${name}» не зарегистрирован` };
        }
        if (!provider.capabilities?.streams) {
          return { success: false, error: `Провайдер «${name}» не поддерживает потоки` };
        }

        // Для source='fit'/'tcx' (Strava-архив) потоки уже в БД с импорта.
        if (fact.source === 'fit' || fact.source === 'tcx') {
          const existing = getRunStreamMeta(db, fact.id, fact.source);
          if (existing) {
            return {
              success: true,
              source: fact.source,
              alreadyInDb: true,
              pointCount: existing.point_count,
              sizeBytes: existing.size_bytes,
              channels: existing.channels,
              fetchMs: 0,
            };
          }
          return {
            success: false,
            error: 'Потоки отсутствуют в БД — переимпортируйте файл',
          };
        }

        const t0 = Date.now();
        const r = await syncStreamsForFact(db, provider, name, fact, false);
        const dt = Date.now() - t0;

        if (r.status === 'failed') {
          return { success: false, error: r.error ?? 'Ошибка' };
        }

        const streamSource = name === 'intervals-icu' ? 'fit' : name;
        const meta = getRunStreamMeta(db, fact.id, streamSource);

        console.log(
          `[Prana-Bindu] sync-run-streams: fact=${runFactId} (${name}), ` +
          `points=${meta?.point_count ?? '—'}, size=${meta?.size_bytes ?? '—'}B, ${dt}ms`
        );

        return {
          success: true,
          source: streamSource,
          pointCount: meta?.point_count ?? null,
          sizeBytes: meta?.size_bytes ?? 0,
          channels: meta?.channels ?? '',
          fetchMs: dt,
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Массовая заливка потоков за период --------
  ipcMain.handle(
    'pb:sync-run-streams-all',
    async (
      _event,
      from: string,
      to: string,
      opts?: { onlyMissing?: boolean; provider?: string }
    ) => {
      if (!from || !to) {
        return { success: false, error: 'from и to обязательны' };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return { success: false, error: 'Формат даты: YYYY-MM-DD' };
      }
      if (from > to) {
        return { success: false, error: 'from больше to' };
      }

      try {
        const db = getMelange();
        const onlyMissing = opts?.onlyMissing !== false;
        const providerName =
          opts?.provider ?? getSyncSettings(db).source ?? 'dodofo';

        const provider = getProvider(providerName) as any;
        if (!provider) {
          return { success: false, error: `Провайдер «${providerName}» не зарегистрирован` };
        }
        if (!provider.capabilities?.streams) {
          return { success: false, error: `Провайдер «${providerName}» не поддерживает потоки` };
        }

        const facts = db
          .prepare(
            `SELECT id, source, external_id, date FROM run_facts
             WHERE date >= ? AND date <= ? AND source = ?
             ORDER BY date ASC`
          )
          .all(from, to, providerName) as unknown as Array<{
            id: number;
            source: string;
            external_id: string | null;
            date: string;
          }>;

        syncStreamsCancelRequested = false;
        const sender = _event.sender;
        const sendProgress = (payload: Record<string, unknown>) => {
          if (!sender.isDestroyed()) sender.send('pb:sync-progress', payload);
        };

        let fetched = 0;
        let skipped = 0;
        let failed = 0;
        const errors: Array<{ runFactId: number; error: string }> = [];

        for (let i = 0; i < facts.length; i++) {
          if (syncStreamsCancelRequested) break;

          const fact = facts[i];
          try {
            const r = await syncStreamsForFact(db, provider, providerName, fact, onlyMissing);
            if (r.status === 'fetched') fetched++;
            else if (r.status === 'skipped') skipped++;
            else {
              failed++;
              if (r.error) errors.push({ runFactId: fact.id, error: r.error });
            }
          } catch (e) {
            failed++;
            errors.push({ runFactId: fact.id, error: (e as Error).message });
          }

          sendProgress({
            current: i + 1,
            total: facts.length,
            runFactId: fact.id,
            externalId: fact.external_id,
            fetched,
            skipped,
            failed,
          });

          await new Promise((r) => setImmediate(r));
        }

        console.log(
          `[Prana-Bindu] sync-run-streams-all (${providerName}) ${from}..${to}: ` +
          `fetched=${fetched}, skipped=${skipped}, failed=${failed}, total=${facts.length}` +
          (syncStreamsCancelRequested ? ', CANCELLED' : '')
        );

        return {
          success: true,
          provider: providerName,
          fetched,
          skipped,
          failed,
          total: facts.length,
          cancelled: syncStreamsCancelRequested,
          errors: errors.slice(0, 20),
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Метаданные потоков по runFactId --------
  ipcMain.handle('pb:get-run-streams-meta', (_event, runFactId: number) => {
    try {
      const rows = listRunStreams(getMelange(), runFactId);
      return { success: true, items: rows };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Payload потоков для графика --------
  ipcMain.handle(
    'pb:get-run-streams',
    (_event, runFactId: number, source: string) => {
      try {
        if (!Number.isFinite(runFactId) || !source) {
          return { success: false, error: 'runFactId и source обязательны' };
        }
        const res = getRunStreamWithPayload(getMelange(), runFactId, source);
        if (!res) {
          return { success: false, error: 'Потоки не найдены' };
        }
        if (!res.payload) {
          return { success: false, error: 'Файл потоков не найден или повреждён' };
        }
        return { success: true, meta: res.meta, payload: res.payload };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Сводка нагрузки по дням (для превью программ Mentat) --------
  // Возвращает: { baseline28, days: { [date]: { planned, actual, total } } }
  // - planned: сумма plan_events.planned_load за день, где sport ~ run
  // - actual:  сумма training_load из run_facts (raw_json.raw.training_load
  //            для dodofo, raw_json.raw.training_load для ICU — оба попадают
  //            сюда); для FIT/TCX без training_load — 0
  // - baseline28: медиана суточных сумм actual за 28 дней ДО from,
  //               только по дням с ненулевой нагрузкой
  ipcMain.handle(
    'pb:day-load-summary',
    (_event, from: string, to: string) => {
      try {
        if (!from || !to) {
          return { success: false, error: 'from и to обязательны' };
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
          return { success: false, error: 'Формат даты: YYYY-MM-DD' };
        }

        const db = getMelange();

        // 1. Planned — только беговые события (sport содержит 'run').
        const planRows = db
          .prepare(
            `SELECT date, SUM(planned_load) AS total
             FROM plan_events
             WHERE date >= ? AND date <= ?
               AND planned_load IS NOT NULL
               AND planned_load > 0
               AND (sport IS NULL OR sport = '' OR LOWER(sport) LIKE '%run%')
             GROUP BY date`
          )
          .all(from, to) as unknown as Array<{ date: string; total: number }>;

        // 2. Actual — парсим raw_json у run_facts.
        const factRows = db
          .prepare(
            `SELECT date, raw_json FROM run_facts
             WHERE date >= ? AND date <= ?`
          )
          .all(from, to) as unknown as Array<{
            date: string;
            raw_json: string | null;
          }>;

        function extractLoad(rawJson: string | null): number {
          if (!rawJson) return 0;
          try {
            const parsed = JSON.parse(rawJson);
            const v =
              parsed?.raw?.training_load ??
              parsed?.raw?.icu_training_load ??
              0;
            return typeof v === 'number' && v > 0 ? v : 0;
          } catch {
            return 0;
          }
        }

        const dayActual: Record<string, number> = {};
        for (const r of factRows) {
          const v = extractLoad(r.raw_json);
          if (v > 0) dayActual[r.date] = (dayActual[r.date] ?? 0) + v;
        }

        // 3. Собираем ответ по запрошенному диапазону.
        const days: Record<string, { planned: number; actual: number; total: number }> = {};

        // Засеваем дни из planned.
        for (const r of planRows) {
          days[r.date] = {
            planned: Math.round((r.total ?? 0) * 10) / 10,
            actual: 0,
            total: 0,
          };
        }
        // Добавляем actual.
        for (const [date, v] of Object.entries(dayActual)) {
          if (!days[date]) {
            days[date] = { planned: 0, actual: 0, total: 0 };
          }
          days[date].actual = Math.round(v * 10) / 10;
        }
        // Считаем total.
        for (const d of Object.values(days)) {
          d.total = Math.round((d.planned + d.actual) * 10) / 10;
        }

        // 4. Baseline28 — медиана суточных сумм за 28 дней ДО from,
        //    считаем только дни с actual > 0.
        const fromDate = new Date(from + 'T00:00:00');
        const baseFrom = new Date(fromDate);
        baseFrom.setDate(baseFrom.getDate() - 28);
        const pad = (n: number) => String(n).padStart(2, '0');
        const baseFromIso = `${baseFrom.getFullYear()}-${pad(
          baseFrom.getMonth() + 1
        )}-${pad(baseFrom.getDate())}`;

        const baseRows = db
          .prepare(
            `SELECT date, raw_json FROM run_facts
             WHERE date >= ? AND date < ?`
          )
          .all(baseFromIso, from) as unknown as Array<{
            date: string;
            raw_json: string | null;
          }>;

        const baseDay: Record<string, number> = {};
        for (const r of baseRows) {
          const v = extractLoad(r.raw_json);
          if (v > 0) baseDay[r.date] = (baseDay[r.date] ?? 0) + v;
        }
        const baseValues = Object.values(baseDay).filter((v) => v > 0);

        let baseline28: number | null = null;
        if (baseValues.length > 0) {
          const sorted = [...baseValues].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          baseline28 =
            sorted.length % 2 === 0
              ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
              : Math.round(sorted[mid] * 10) / 10;
        }

        return { success: true, baseline28, days };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Метаданные потоков для набора run_fact_id (для таблицы) --------
  ipcMain.handle(
    'pb:list-run-streams-batch',
    (_event, runFactIds: number[]) => {
      try {
        if (!Array.isArray(runFactIds) || runFactIds.length === 0) {
          return { success: true, data: {} };
        }
        // Защита от слишком большого IN-списка
        const ids = runFactIds
          .filter((x) => Number.isFinite(x))
          .slice(0, 2000);

        if (ids.length === 0) {
          return { success: true, data: {} };
        }

        const db = getMelange();
        const placeholders = ids.map(() => '?').join(',');
        const rows = db
          .prepare(
            `SELECT run_fact_id, source, point_count, size_bytes, fetched_at
             FROM run_streams
             WHERE run_fact_id IN (${placeholders})
             ORDER BY run_fact_id, source`
          )
          .all(...ids) as unknown as Array<{
            run_fact_id: number;
            source: string;
            point_count: number | null;
            size_bytes: number;
            fetched_at: string;
          }>;

        const data: Record<number, typeof rows> = {};
        for (const row of rows) {
          if (!data[row.run_fact_id]) data[row.run_fact_id] = [];
          data[row.run_fact_id].push(row);
        }

        return { success: true, data };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Импорт FIT-файла в БД --------
  ipcMain.handle('pb:import-fit', async (_event, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'filePath обязателен' };
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Файл не найден: ${filePath}` };
      }

      const basename = path.basename(filePath).replace(/\.(fit|tcx)(\.gz)?$/i, '');
      const source = detectSource(filePath);
      const externalId = `${source}:${basename}`;

      const t0 = Date.now();
      const workout = await parseWorkoutFile(filePath, basename);
      const parseMs = Date.now() - t0;

      const startMs = new Date(workout.startTime).getTime();
      const endTime = new Date(startMs + workout.durationSec * 1000).toISOString();

      const raw = {
        externalId,
        source: workout.source,     // 'fit' или 'tcx'
        origin: 'strava-archive',
        startTime: workout.startTime,
        endTime,
        distanceM: workout.distanceM,
        durationS: workout.durationSec,
        avgHr: workout.summary.avgHr,
        maxHr: workout.summary.maxHr,
        gpsQuality: workout.summary.gpsQuality,
        distanceSource: workout.summary.distanceSource,
        gpsCoveragePct: workout.summary.gpsCoveragePct,
        raw: {
          sport: workout.sport,
          summary: workout.summary,
          validation: workout.validation,
          lapCount: workout.laps?.length ?? 0,
          importedFrom: filePath,
        },
      };

      const db = getMelange();
      const { inserted, id: runFactId } = upsertRunFact(db, raw);

      const row = db
        .prepare(`SELECT date FROM run_facts WHERE id = ?`)
        .get(runFactId) as { date: string } | undefined;
      const dateForFile = row?.date ?? workout.startTime.slice(0, 10);

      const meta = upsertRunStreams(
        db,
        runFactId,
        workout.source,              // 'fit' или 'tcx'
        externalId,
        dateForFile,
        workout.streams as unknown as Record<string, unknown>
      );

      console.log(
        `[Prana-Bindu] import-${source}: ${basename} → run_fact #${runFactId} ` +
        `(${inserted ? 'new' : 'update'}), streams: ${meta.point_count} pts, ` +
        `${meta.size_bytes}B, ${parseMs}ms`
      );

      return {
        success: true,
        runFactId,
        inserted,
        source: workout.source,
        externalId,
        summary: workout.summary,
        validation: workout.validation,
        streams: {
          pointCount: meta.point_count,
          sizeBytes: meta.size_bytes,
          channels: meta.channels,
        },
        parseMs,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Однократный бэкфилл start_time --------
  ipcMain.handle('pb:backfill-start-time', async () => {
    try {
      const db = getMelange();
      const rows = db
        .prepare(
          `SELECT id, source, external_id, date, raw_json
           FROM run_facts
           WHERE start_time IS NULL`
        )
        .all() as unknown as Array<{
          id: number;
          source: string;
          external_id: string | null;
          date: string;
          raw_json: string | null;
        }>;

      let updated = 0;
      let fallback = 0;
      let failed = 0;
      const errors: Array<{ id: number; error: string }> = [];

      const updateStmt = db.prepare(
        `UPDATE run_facts SET start_time = ? WHERE id = ?`
      );

      for (const row of rows) {
        try {
          let startTime: string | null = null;

          if (row.source === 'dodofo' && row.raw_json) {
            const raw = JSON.parse(row.raw_json);
            startTime = raw?.started_at ?? null;
          } else if (row.source === 'fit' && row.raw_json) {
            const raw = JSON.parse(row.raw_json);
            const filePath: string | undefined = raw?.importedFrom;
            if (filePath && fs.existsSync(filePath)) {
              const buffer = filePath.toLowerCase().endsWith('.gz')
                ? zlib.gunzipSync(fs.readFileSync(filePath))
                : fs.readFileSync(filePath);
              const basename = path
                .basename(filePath)
                .replace(/\.fit(\.gz)?$/i, '');
              const workout = await parseFit(buffer, { externalId: basename });
              startTime = workout.startTime;
            }
          }

          if (!startTime) {
            // fallback — полдень дня. Дальше можно скорректировать
            // вручную или переимпортом.
            startTime = `${row.date}T12:00:00.000Z`;
            fallback++;
          }

          updateStmt.run(startTime, row.id);
          updated++;
        } catch (e) {
          failed++;
          errors.push({ id: row.id, error: (e as Error).message });
        }
      }

      console.log(
        `[Prana-Bindu] backfill-start-time: updated=${updated}, ` +
        `fallback=${fallback}, failed=${failed}, total=${rows.length}`
      );

      return {
        success: true,
        updated,
        fallback,
        failed,
        total: rows.length,
        errors: errors.slice(0, 20),
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Диалог выбора папки --------
  ipcMain.handle(
    'pb:pick-directory',
    async (
      _event,
      opts?: { title?: string; defaultPath?: string }
    ) => {
      try {
        const res = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: opts?.title ?? 'Выберите папку',
          defaultPath: opts?.defaultPath,
        });
        if (res.canceled || res.filePaths.length === 0) {
          return { success: false, canceled: true };
        }
        return { success: true, path: res.filePaths[0] };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Диалог выбора файлов --------
  ipcMain.handle(
    'pb:pick-files',
    async (_event, opts?: { multiple?: boolean }) => {
      try {
        const res = await dialog.showOpenDialog({
          properties:
            opts?.multiple !== false
              ? ['openFile', 'multiSelections']
              : ['openFile'],
          title: 'Выберите FIT или TCX файлы',
          filters: [
            { name: 'FIT / TCX', extensions: ['fit', 'tcx', 'gz'] },
            { name: 'FIT', extensions: ['fit'] },
            { name: 'TCX', extensions: ['tcx'] },
            { name: 'Все файлы', extensions: ['*'] },
          ],
        });
        if (res.canceled || res.filePaths.length === 0) {
          return { success: false, canceled: true };
        }
        return { success: true, paths: res.filePaths };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Импорт конкретных файлов --------
  ipcMain.handle(
    'pb:import-files',
    async (
      _event,
      filePaths: string[],
      opts?: { origin?: string; skipImported?: boolean }
    ) => {
      try {
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
          return { success: false, error: 'filePaths обязателен (массив)' };
        }

        // Фильтруем — оставляем только существующие .fit/.tcx/.gz
        const files: string[] = [];
        for (const p of filePaths) {
          if (typeof p !== 'string') continue;
          if (!fs.existsSync(p)) continue;
          if (!/\.(fit|tcx)(\.gz)?$/i.test(p)) continue;
          files.push(p);
        }

        if (files.length === 0) {
          return {
            success: false,
            error: 'Не найдено ни одного FIT/TCX файла среди выбранных',
          };
        }

        const origin = opts?.origin ?? 'manual-import';
        const skipImported = opts?.skipImported === true;
        const db = getMelange();

        importFitCancelRequested = false;
        const sender = _event.sender;
        const sendProgress = (payload: Record<string, unknown>) => {
          if (!sender.isDestroyed()) sender.send('pb:import-progress', payload);
        };

        const result = await performImportFiles(
          files,
          db,
          sendProgress,
          origin,
          skipImported
        );

        console.log(
          `[Prana-Bindu] import-files (${origin}): ` +
          `imported=${result.imported}, updated=${result.updated}, ` +
          `skipped=${result.skipped}, failed=${result.failed}, total=${files.length}`
        );

        return {
          success: true,
          origin,
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          cancelled: result.cancelled,
          total: files.length,
          importedIds: result.importedIds,
          updatedDates: result.updatedDates.slice(0, 20),
          errors: result.errors.slice(0, 20),
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('pb:fit-archive-path-get', () => {
    try {
      return { success: true, path: getFitArchivePath(getMelange()) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Импорт FIT из папки (.fit и .fit.gz) --------
  ipcMain.handle(
    'pb:import-fit-dir',
    async (
      _event,
      dirPath: string,
      opts?: {
        recursive?: boolean;
        skipImported?: boolean;
        origin?: string;
        savePath?: boolean;
      }
    ) => {
      try {
        if (!dirPath || typeof dirPath !== 'string') {
          return { success: false, error: 'dirPath обязателен' };
        }
        if (!fs.existsSync(dirPath)) {
          return { success: false, error: `Папка не найдена: ${dirPath}` };
        }

        const recursive = opts?.recursive === true;
        const skipImported = opts?.skipImported === true; // по умолчанию — обновлять
        const origin = opts?.origin ?? 'strava-archive';
        const savePath = opts?.savePath !== false;

        const files: string[] = [];
        const walk = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && recursive) walk(full);
            else if (e.isFile() && /\.(fit|tcx)(\.gz)?$/i.test(e.name))
              files.push(full);
          }
        };
        walk(dirPath);

        if (files.length === 0) {
          return { success: false, error: 'FIT-файлы не найдены' };
        }

        const db = getMelange();

        importFitCancelRequested = false;
        const sender = _event.sender;
        const sendProgress = (payload: Record<string, unknown>) => {
          if (!sender.isDestroyed()) sender.send('pb:import-progress', payload);
        };

        const result = await performImportFiles(
          files,
          db,
          sendProgress,
          origin,
          skipImported
        );

        if (savePath && result.failed === 0 && !result.cancelled) {
          setFitArchivePath(db, dirPath);
        }

        console.log(
          `[Prana-Bindu] import-fit-dir (${origin}) ${dirPath}: ` +
          `imported=${result.imported}, updated=${result.updated}, ` +
          `skipped=${result.skipped}, failed=${result.failed}, total=${files.length}`
        );

        return {
          success: true,
          origin,
          dirPath,
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          cancelled: result.cancelled,
          total: files.length,
          importedIds: result.importedIds,
          updatedDates: result.updatedDates.slice(0, 20),
          errors: result.errors.slice(0, 20),
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Отмена активного импорта --------
  ipcMain.handle('pb:import-cancel', () => {
    importFitCancelRequested = true;
    return { success: true };
  });

  // -------- Отмена активной заливки потоков --------
  ipcMain.handle('pb:sync-cancel', () => {
    syncStreamsCancelRequested = true;
    return { success: true };
  });

  // -------- Разведка: сырой ответ fetchWellness --------
  ipcMain.handle(
    'pb:debug-wellness',
    async (_event, from: string, to: string) => {
      try {
        const provider = getProvider('dodofo') as any;
        if (!provider || typeof provider.fetchWellness !== 'function') {
          return { success: false, error: 'Провайдер dodofo не поддерживает fetchWellness' };
        }
        const t0 = Date.now();
        const raw = await provider.fetchWellness(from, to);
        const dt = Date.now() - t0;

        console.log('[Prana-Bindu] debug-wellness:', JSON.stringify(raw).slice(0, 2000));

        return { success: true, fetchMs: dt, data: raw };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Подтянуть wellness (мульти-провайдер) --------
  // Если providerName передан — синкает только его.
  // Если undefined — синкает ВСЕХ провайдеров с capabilities.wellness.
  // upsertRecoveryLog мержит поля по date — data из ICU и dodofo
  // дополняют друг друга (ICU: ctl/atl/ramp, dodofo: сон/шаги/фазы).
  ipcMain.handle(
    'pb:sync-wellness',
    async (_event, providerName: string | undefined, from: string, to: string) => {
      if (!from || !to) return { success: false, error: 'from и to обязательны' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return { success: false, error: 'Формат даты: YYYY-MM-DD' };
      }

      // Собираем список провайдеров
      let providerNames: string[];
      if (providerName) {
        providerNames = [providerName];
      } else {
        providerNames = listProviders()
          .filter((p) => (p.capabilities as any)?.wellness)
          .map((p) => p.name);
        // Приоритет: сначала ICU (ctl/atl), потом dodofo (сон/шаги)
        providerNames.sort((a, b) => {
          if (a === 'intervals-icu') return -1;
          if (b === 'intervals-icu') return 1;
          if (a === 'dodofo') return -1;
          if (b === 'dodofo') return 1;
          return 0;
        });
      }

      const db = getMelange();
      let totalAdded = 0;
      let totalUpdated = 0;
      let totalDays = 0;
      const perProvider: Array<{ provider: string; added: number; updated: number; total: number; error?: string }> = [];

      for (const name of providerNames) {
        try {
          const provider = getProvider(name) as any;
          if (!provider) {
            perProvider.push({ provider: name, added: 0, updated: 0, total: 0, error: 'не зарегистрирован' });
            continue;
          }
          if (!provider.capabilities?.wellness) {
            perProvider.push({ provider: name, added: 0, updated: 0, total: 0, error: 'не поддерживает wellness' });
            continue;
          }
          if (typeof provider.fetchWellness !== 'function') {
            perProvider.push({ provider: name, added: 0, updated: 0, total: 0, error: 'fetchWellness не реализован' });
            continue;
          }

          const raw = await provider.fetchWellness(from, to);
          const days: any[] = Array.isArray(raw) ? raw : (raw?.days ?? []);

          let added = 0;
          let updated = 0;

          for (const day of days) {
            if (!day?.id && !day?.date) continue;
            const date = day.id ?? day.date;

            // Универсальный маппинг: camelCase (ICU) ?? snake_case (dodofo)
            const res = upsertRecoveryLog(db, {
              date,
              resting_hr: day.restingHR ?? day.resting_hr,
              hrv: day.hrv ?? day.hrv_ms,
              hrv_sdnn: day.hrvSDNN ?? day.hrv_sdnn,
              sleep_hours: day.sleepSecs != null
                ? Math.round((day.sleepSecs / 3600) * 100) / 100
                : (day.sleep_hours ?? day.sleepHours),
              sleep_score: day.sleepScore ?? day.sleep_score,
              sleep_quality: day.sleepQuality ?? day.sleep_quality,
              sleep_total_min: day.sleep_total_min ?? day.sleepTotalMin,
              deep_min: day.deep_min ?? day.deepMin,
              rem_min: day.rem_min ?? day.remMin,
              light_min: day.light_min ?? day.lightMin,
              awake_min: day.awake_min ?? day.awakeMin,
              steps: day.steps,
              weight_kg: day.weight ?? day.weight_kg,
              vo2max: day.vo2max,
              body_battery_charged: day.body_battery_charged ?? day.bodyBatteryCharged,
              body_battery_drained: day.body_battery_drained ?? day.bodyBatteryDrained,
              stress_avg: day.stress_avg ?? day.stressAvg,
              sp_o2: day.spo2_avg_pct ?? day.spO2,
              ctl: day.ctl,
              atl: day.atl,
              ramp_rate: day.rampRate ?? day.ramp_rate,
              readiness: day.readiness,
              soreness: day.soreness,
              fatigue: day.fatigue,
              stress: day.stress,
              mood: day.mood,
              motivation: day.motivation,
              injury: day.injury,
              avg_sleeping_hr: day.avgSleepingHR ?? day.avg_sleeping_hr,
              baevsky_si: day.baevskySI ?? day.baevsky_si,
              systolic: day.systolic,
              diastolic: day.diastolic,
              // v20 — энергия (dodofo отдаёт, раньше теряли).
              calories_active:
                day.calories_active ?? day.caloriesActive ?? null,
              calories_total:
                day.calories_total ?? day.caloriesTotal ?? null,
              body_fat_pct: day.body_fat_pct ?? day.bodyFatPct ?? null,
              // ВСЕГДА наше имя провайдера. Чужой источник (zepp/huawei)
              // остаётся в raw_json — для тех, кому нужно.
              auto_source: name,
              raw_json: JSON.stringify(day),
            });

            if (res.inserted) added++;
            else updated++;
          }

          totalAdded += added;
          totalUpdated += updated;
          totalDays += days.length;

          console.log(
            `[Prana-Bindu] sync-wellness (${name}) ${from}..${to}: +${added} ~${updated} (всего ${days.length})`
          );

          perProvider.push({ provider: name, added, updated, total: days.length });
        } catch (e) {
          const msg = (e as Error).message;
          console.error(`[Prana-Bindu] sync-wellness (${name}) error:`, msg);
          perProvider.push({ provider: name, added: 0, updated: 0, total: 0, error: msg });
        }
      }

      return {
        success: true,
        provider: providerName ?? 'all',
        added: totalAdded,
        updated: totalUpdated,
        total: totalDays,
        perProvider,
      };
    }
  );

  // -------- Список wellness за период --------
  ipcMain.handle(
    'pb:list-recovery-logs',
    (_event, from: string, to: string) => {
      try {
        const rows = listRecoveryLogs(getMelange(), from, to);
        return { success: true, items: rows, total: rows.length };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: /activities/daily --------
  ipcMain.handle(
    'pb:debug-daily',
    async (_event, from: string, to: string) => {
      try {
        const provider = getProvider('dodofo') as any;
        if (!provider || typeof provider.fetchDaily !== 'function') {
          return { success: false, error: 'fetchDaily не реализован' };
        }
        const t0 = Date.now();
        const raw = await provider.fetchDaily(from, to);
        const dt = Date.now() - t0;

        console.log(
          '[Prana-Bindu] debug-daily:',
          JSON.stringify(raw).slice(0, 2000)
        );

        return { success: true, fetchMs: dt, data: raw };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle(
    'pb:intervals-setup',
    async (_event, apiKey: string, athleteId: string) => {
      if (!apiKey || !apiKey.trim()) {
        return { success: false, error: 'API key обязателен' };
      }
      try {
        const trimmedKey = apiKey.trim();
        const trimmedAthlete = (athleteId ?? '').trim();

        const db = getMelange();
        let encKey: string;
        if (safeStorage.isEncryptionAvailable()) {
          encKey = safeStorage.encryptString(trimmedKey).toString('base64');
        } else {
          console.warn('[Prana-Bindu] safeStorage недоступен — ключ без шифрования');
          encKey = trimmedKey;
        }
        setIntervalsCredentials(db, encKey, trimmedAthlete || null);

        const provider = getProvider('intervals-icu');
        if (!provider) {
          return { success: false, error: 'Провайдер intervals-icu не зарегистрирован' };
        }
        const check = await provider.isAvailable();
        if (!check.available) {
          return { success: false, error: check.reason ?? 'Ключ не работает' };
        }

        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('pb:intervals-status', () => {
    try {
      const db = getMelange();
      return {
        success: true,
        hasApiKey: !!getIntervalsApiKeyEncrypted(db),
        athleteId: getIntervalsAthleteIdFromDb(db),
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

    // -------- Разведка: intervals.icu activities --------
  ipcMain.handle(
    'pb:debug-icu-activities',
    async (_event, from: string, to: string) => {
      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider || typeof provider.debugActivities !== 'function') {
          return { success: false, error: 'debugActivities не реализован' };
        }
        const t0 = Date.now();
        const raw = await provider.debugActivities(from, to);
        const dt = Date.now() - t0;
        console.log(
          '[Prana-Bindu] debug-icu-activities:',
          JSON.stringify(raw).slice(0, 2000)
        );
        return { success: true, fetchMs: dt, data: raw };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: intervals.icu одна активность --------
  ipcMain.handle(
    'pb:debug-icu-activity',
    async (_event, id: string | number) => {
      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider || typeof provider.debugActivity !== 'function') {
          return { success: false, error: 'debugActivity не реализован' };
        }
        const raw = await provider.debugActivity(id);
        return { success: true, data: raw };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: intervals.icu streams --------
  ipcMain.handle(
    'pb:debug-icu-streams',
    async (_event, id: string | number) => {
      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider || typeof provider.debugStreams !== 'function') {
          return { success: false, error: 'debugStreams не реализован' };
        }
        const raw = await provider.debugStreams(id);
        return { success: true, data: raw };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: intervals.icu events (план) --------
  ipcMain.handle(
    'pb:debug-icu-events',
    async (_event, from: string, to: string) => {
      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider || typeof provider.debugEvents !== 'function') {
          return { success: false, error: 'debugEvents не реализован' };
        }
        const raw = await provider.debugEvents(from, to);
        return { success: true, data: raw };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: создать тестовое событие в ICU --------
  ipcMain.handle(
    'pb:debug-icu-create-event',
    async (_event, testDate: string) => {
      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider) {
          return { success: false, error: 'Провайдер не зарегистрирован' };
        }
        if (typeof provider.debugCreateEvent !== 'function') {
          return { success: false, error: 'debugCreateEvent не реализован' };
        }
        const raw = await provider.debugCreateEvent(testDate);
        return { success: true, data: raw };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

    // -------- Push локального plan_event в ICU --------
  ipcMain.handle(
    'pb:push-plan-event',
    async (_event, planEventId: number) => {
      try {
        if (!Number.isFinite(planEventId)) {
          return { success: false, error: 'planEventId обязателен' };
        }
        const provider = getProvider('intervals-icu') as any;
        if (!provider?.createEvent) {
          return { success: false, error: 'createEvent не реализован' };
        }

        const db = getMelange();
        const row = db
          .prepare(`SELECT * FROM plan_events WHERE id = ?`)
          .get(planEventId) as any;
        if (!row) {
          return { success: false, error: `plan_event #${planEventId} не найден` };
        }

        // Если уже синкан — это update, иначе create.
        const existingExtId = row.external_id as string | null;
        const isUpdate = !!existingExtId && existingExtId.startsWith('intervals-icu-event:');
        const remoteId = isUpdate
          ? existingExtId!.replace('intervals-icu-event:', '')
          : null;

        const payload = {
          category: row.category ?? 'WORKOUT',
          start_date_local: row.start_time
            ? row.start_time.slice(0, 19)   // YYYY-MM-DDTHH:MM:SS
            : `${row.date}T09:00:00`,
          type: row.sport ?? 'Run',
          name: row.name ?? 'Workout',
          description: row.description ?? '',
        };

        const result = isUpdate
          ? await provider.updateEvent(remoteId!, payload)
          : await provider.createEvent(payload);

        const newExtId = `intervals-icu-event:${result.id}`;

        db.prepare(
          `UPDATE plan_events SET
             external_id = ?, description = ?, updated_at = ?
           WHERE id = ?`
        ).run(newExtId, result.description ?? payload.description, new Date().toISOString(), planEventId);

        console.log(
          `[Prana-Bindu] push-plan-event #${planEventId} → ICU id=${result.id} (${isUpdate ? 'update' : 'create'})`
        );

        return {
          success: true,
          action: isUpdate ? 'updated' : 'created',
          externalId: newExtId,
          icuId: result.id,
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Локальное обновление plan_event --------
  ipcMain.handle(
    'pb:update-plan-event-locally',
    (_event, id: number, patch: any) => {
      try {
        if (!Number.isFinite(id)) {
          return { success: false, error: 'id обязателен' };
        }
        updatePlanEventLocally(getMelange(), id, patch ?? {});
        return { success: true };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Локальное удаление plan_event --------
  ipcMain.handle(
    'pb:delete-plan-event-locally',
    (_event, id: number) => {
      try {
        if (!Number.isFinite(id)) {
          return { success: false, error: 'id обязателен' };
        }
        const ok = deletePlanEventLocally(getMelange(), id);
        return { success: ok };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Локальное создание plan_event --------
  ipcMain.handle(
    'pb:create-plan-event-locally',
    (_event, payload: any) => {
      try {
        if (!payload?.date || !payload?.name) {
          return { success: false, error: 'date и name обязательны' };
        }
        const id = createPlanEventLocally(getMelange(), {
          date: payload.date,
          startTime: payload.startTime,
          category: payload.category ?? 'WORKOUT',
          sport: payload.sport ?? 'Run',
          name: payload.name,
          description: payload.description,
        });
        return { success: true, id };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Генерация программы Уэйда / Runner / Cali / Prehab --------
  ipcMain.handle(
    'pb:generate-program',
    async (
      _event,
      params: {
        programKey: string;
        states: Record<string, MovementState>;
        from: string;
        weeks: number;
        conflictPolicy: 'skip' | 'append' | 'replace';
        target: 'local' | 'local+icu';
      }
    ) => {
      try {
        if (!params?.programKey) {
          return { success: false, error: 'programKey обязателен' };
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(params.from)) {
          return { success: false, error: 'from должен быть YYYY-MM-DD' };
        }
        if (!Number.isFinite(params.weeks) || params.weeks <= 0) {
          return { success: false, error: 'weeks должен быть > 0' };
        }

        const program = findProgram(params.programKey);
        if (!program) {
          return { success: false, error: `Программа '${params.programKey}' не найдена` };
        }

        const db = getMelange();

        // Диапазон генерации
        const startIso = params.from;
        const endD = new Date(startIso + 'T00:00:00');
        endD.setDate(endD.getDate() + params.weeks * 7 - 1);
        const endIso = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;

        // Replace — удаляем ранее сгенерированное этой программой
        let removed = 0;
        if (params.conflictPolicy === 'replace') {
          removed = deleteGeneratedEvents(db, startIso, endIso, {
            programKey: program.key,
          });
        }

        // Превью
        const preview = buildProgramPreview({
          program,
          states: params.states ?? {},
          from: startIso,
          weeks: params.weeks,
        });

        let created = 0;
        let skipped = 0;
        let pushed = 0;
        let failed = 0;
        const errors: Array<{ date: string; error: string }> = [];
        const createdIds: number[] = [];

        for (const ev of preview) {
          // Проверка конфликта
          const existing = db
            .prepare(
              `SELECT COUNT(*) AS cnt FROM plan_events WHERE date = ?`
            )
            .get(ev.date) as { cnt: number };
          const hasConflict = existing.cnt > 0;

          if (hasConflict && params.conflictPolicy === 'skip') {
            skipped++;
            continue;
          }

          const t = buildEventText(program.name, ev.dayLabel, ev.lines);

          // Разбираем description в структуру steps + zoneTimes.
          // Так в таблице «План» появится количество шагов,
          // а в drawer'е — таймлайн без ожидания sync.
          let icuWorkoutJson: string | undefined;
          try {
            const parsed = parseWorkoutText(t.description);
            const workoutSteps = parsed.flatSteps.map((s) => ({
              duration: s.durationSec,
              distance: s.distanceM,
              hrZone:
                s.zoneTarget === 'hr' ? s.zone : undefined,
              paceZone:
                !s.zoneTarget || s.zoneTarget === 'pace'
                  ? s.zone
                  : undefined,
              powerZone:
                s.zoneTarget === 'power' ? s.zone : undefined,
              sets: s.sets,
              reps: s.reps,
              label: s.label,
              raw: s.raw,
            }));

            const zoneMap = new Map<number, number>();
            for (const s of parsed.flatSteps) {
              if (s.zone && s.durationSec) {
                zoneMap.set(
                  s.zone,
                  (zoneMap.get(s.zone) ?? 0) + s.durationSec
                );
              }
            }
            const zoneTimes = Array.from({ length: 7 }, (_, i) => ({
              zone: `Z${i + 1}`,
              secs: zoneMap.get(i + 1) ?? 0,
            }));

            icuWorkoutJson = JSON.stringify({
              steps: workoutSteps,
              zoneTimes,
            });
          } catch (e) {
            console.warn(
              `[Prana-Bindu] generate-program: parse error for ${ev.date}:`,
              (e as Error).message
            );
          }

          try {
            const id = createPlanEventLocally(db, {
              date: ev.date,
              startTime: `${ev.date}T09:00:00`,
              category: 'WORKOUT',
              sport: program.category === 'runner' ? 'run' : 'workout',
              name: t.name,
              description: t.description,
              generatorCategory: program.category,
              generatorProgramKey: program.key,
              icuWorkoutJson,
            });
            created++;
            createdIds.push(id);
          } catch (e) {
            failed++;
            errors.push({ date: ev.date, error: (e as Error).message });
          }
        }

        // Push в ICU, если нужно
        if (params.target === 'local+icu' && createdIds.length > 0) {
          const provider = getProvider('intervals-icu') as any;
          if (!provider?.createEvent) {
            failed += createdIds.length;
            errors.push({ date: '', error: 'createEvent не реализован' });
          } else {
            for (const id of createdIds) {
              try {
                const row = db
                  .prepare(`SELECT * FROM plan_events WHERE id = ?`)
                  .get(id) as any;
                if (!row) continue;

                const payload = {
                  category: row.category ?? 'WORKOUT',
                  start_date_local: row.start_time
                    ? row.start_time.slice(0, 19)
                    : `${row.date}T09:00:00`,
                  type: row.sport ?? 'Workout',
                  name: row.name ?? 'Workout',
                  description: row.description ?? '',
                };
                const result = await provider.createEvent(payload);
                const newExtId = `intervals-icu-event:${result.id}`;
                db.prepare(
                  `UPDATE plan_events SET external_id = ?, updated_at = ? WHERE id = ?`
                ).run(newExtId, new Date().toISOString(), id);
                pushed++;
              } catch (e) {
                failed++;
                errors.push({ date: '', error: (e as Error).message });
              }
            }
          }
        }

        console.log(
          `[Prana-Bindu] generate-program ${program.key} ${startIso}..${endIso}: ` +
          `removed=${removed}, created=${created}, pushed=${pushed}, ` +
          `skipped=${skipped}, failed=${failed}`
        );

        return {
          success: true,
          programKey: program.key,
          range: { from: startIso, to: endIso },
          removed,
          created,
          pushed,
          skipped,
          failed,
          errors: errors.slice(0, 20),
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Удалить сгенерированные события --------
  ipcMain.handle(
    'pb:plan-events-delete-generated',
    (
      _event,
      params: {
        from: string;
        to: string;
        category?: string;
        programKey?: string;
      }
    ) => {
      try {
        const n = deleteGeneratedEvents(
          getMelange(),
          params.from,
          params.to,
          { category: params.category, programKey: params.programKey }
        );
        return { success: true, deleted: n };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Факт: создать сессию --------
  ipcMain.handle(
    'pb:create-workout-session',
    (_event, payload: any) => {
      try {
        if (!payload?.date || !Array.isArray(payload?.exercises)) {
          return { success: false, error: 'date и exercises обязательны' };
        }
        const id = createWorkoutSession(getMelange(), payload);
        return { success: true, id };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Факт: обновить сессию --------
  ipcMain.handle(
    'pb:update-workout-session',
    (_event, id: number, patch: any) => {
      try {
        if (!Number.isFinite(id)) {
          return { success: false, error: 'id обязателен' };
        }
        const ok = updateWorkoutSession(getMelange(), id, patch ?? {});
        return { success: ok };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Факт: получить сессию по id --------
  ipcMain.handle(
    'pb:get-workout-session',
    (_event, id: number) => {
      try {
        const s = getWorkoutSession(getMelange(), id);
        return { success: true, data: s };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Факт: список за период --------
  ipcMain.handle(
    'pb:list-workout-sessions',
    (_event, from: string, to: string) => {
      try {
        const items = listWorkoutSessions(getMelange(), from, to);
        return { success: true, items };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Факт: сессии конкретного plan_event --------
  ipcMain.handle(
    'pb:list-workout-sessions-for-plan-event',
    (_event, planEventId: number) => {
      try {
        if (!Number.isFinite(planEventId)) {
          return { success: false, error: 'planEventId обязателен' };
        }
        const items = listWorkoutSessionsForPlanEvent(
          getMelange(),
          planEventId
        );
        return { success: true, items };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Факт: удалить сессию --------
  ipcMain.handle(
    'pb:delete-workout-session',
    (_event, id: number) => {
      try {
        const ok = deleteWorkoutSession(getMelange(), id);
        return { success: ok };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Эквивалентности между каталогами --------
  ipcMain.handle('pb:equivalences-list', () => {
    try {
      const items = listEquivalences(getMelange());
      return { success: true, items };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(
    'pb:equivalences-list-for',
    (_event, source: string, sourceKey: string) => {
      try {
        if (!source || !sourceKey) {
          return {
            success: false,
            error: 'source и sourceKey обязательны',
          };
        }
        const items = listEquivalencesFor(getMelange(), source, sourceKey);
        return { success: true, items };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('pb:equivalences-set', (_event, input: any) => {
    try {
      if (!input?.source || !input?.sourceKey) {
        return {
          success: false,
          error: 'source и sourceKey обязательны',
        };
      }
      if (!input?.target || !input?.targetKey) {
        return {
          success: false,
          error: 'target и targetKey обязательны',
        };
      }
      const res = setEquivalence(getMelange(), input);
      return { success: true, ...res };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:equivalences-delete', (_event, id: number) => {
    try {
      if (!Number.isFinite(id)) {
        return { success: false, error: 'id обязателен' };
      }
      const ok = deleteEquivalence(getMelange(), id);
      return { success: ok };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Прогресс по движению --------
  ipcMain.handle(
    'pb:get-exercise-progress',
    (_event, movementKey: string) => {
      try {
        if (!movementKey) {
          return { success: false, error: 'movementKey обязателен' };
        }
        const data = getExerciseProgress(getMelange(), movementKey);
        return { success: true, data };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle('pb:list-exercise-progress', () => {
    try {
      const items = listExerciseProgress(getMelange());
      return { success: true, items };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle(
    'pb:set-exercise-progress',
    (_event, movementKey: string, level: number, rung: number) => {
      try {
        if (!movementKey) {
          return { success: false, error: 'movementKey обязателен' };
        }
        if (!Number.isFinite(level) || !Number.isFinite(rung)) {
          return { success: false, error: 'level и rung должны быть числами' };
        }
        const data = setExerciseProgress(
          getMelange(),
          movementKey,
          Math.round(level),
          Math.round(rung)
        );
        return { success: true, data };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Удалить event из ICU (без удаления локально) --------
  ipcMain.handle(
    'pb:delete-plan-event-remote',
    async (_event, planEventId: number) => {
      try {
        if (!Number.isFinite(planEventId)) {
          return { success: false, error: 'planEventId обязателен' };
        }
        const provider = getProvider('intervals-icu') as any;
        if (!provider?.deleteEvent) {
          return { success: false, error: 'deleteEvent не реализован' };
        }

        const db = getMelange();
        const row = db
          .prepare(`SELECT external_id FROM plan_events WHERE id = ?`)
          .get(planEventId) as { external_id: string | null } | undefined;
        if (!row) {
          return { success: false, error: `plan_event #${planEventId} не найден` };
        }
        if (!row.external_id?.startsWith('intervals-icu-event:')) {
          return { success: true, note: 'Не связано с ICU, нечего удалять' };
        }

        const remoteId = row.external_id.replace('intervals-icu-event:', '');
        await provider.deleteEvent(remoteId);

        db.prepare(
          `UPDATE plan_events SET external_id = NULL, updated_at = ? WHERE id = ?`
        ).run(new Date().toISOString(), planEventId);

        return { success: true, icuId: remoteId };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle(
    'pb:debug-icu-workouts',
    async (_event, from: string, to: string) => {
      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider || typeof provider.fetchWorkouts !== 'function') {
          return { success: false, error: 'fetchWorkouts не реализован' };
        }
        const workouts = await provider.fetchWorkouts(from, to);
        return {
          success: true,
          total: workouts.length,
          // Первые 3 для проверки
          items: workouts.slice(0, 3).map((w: any) => ({
            externalId: w.externalId,
            source: w.source,
            startTime: w.startTime,
            endTime: w.endTime,
            distanceM: w.distanceM,
            durationS: w.durationS,
            avgHr: w.avgHr,
            maxHr: w.maxHr,
          })),
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

    ipcMain.handle(
    'pb:debug-icu-workout',
    async (_event, id: string | number) => {
      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider || typeof provider.fetchUnifiedWorkout !== 'function') {
          return { success: false, error: 'fetchUnifiedWorkout не реализован' };
        }
        const w = await provider.fetchUnifiedWorkout(id);
        return {
          success: true,
          data: {
            source: w.source,
            externalId: w.externalId,
            startTime: w.startTime,
            durationSec: w.durationSec,
            distanceM: w.distanceM,
            sport: w.sport,
            streamLengths: {
              secT: w.streams.secT?.length ?? 0,
              hr: w.streams.hr?.length ?? 0,
              speedKmh: w.streams.speedKmh?.length ?? 0,
              cadence: w.streams.cadence?.length ?? 0,
              elevationM: w.streams.elevationM?.length ?? 0,
              latlng: w.streams.latlng?.length ?? 0,
              distM: w.streams.distM?.length ?? 0,
            },
            summary: w.summary,
            validation: w.validation,
            lapCount: w.laps?.length ?? 0,
          },
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle(
    'pb:update-run-fact-name',
    (_event, runFactId: number, userName: string | null) => {
      try {
        if (!Number.isFinite(runFactId)) {
          return { success: false, error: 'runFactId обязателен' };
        }
        const db = getMelange();
        const value = userName?.trim() || null;   // пустая строка → сброс
        const info = db
          .prepare(`UPDATE run_facts SET user_name = ? WHERE id = ?`)
          .run(value, runFactId);
        if (info.changes === 0) {
          return { success: false, error: 'Запись не найдена' };
        }
        return { success: true, userName: value };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  ipcMain.handle(
    'pb:update-run-group-name',
    (_event, factIds: number[], userName: string | null) => {
      try {
        if (!Array.isArray(factIds) || factIds.length === 0) {
          return { success: false, error: 'factIds обязателен (непустой массив)' };
        }
        const ids = factIds.filter((x) => Number.isFinite(x));
        if (ids.length === 0) {
          return { success: false, error: 'Нет валидных factIds' };
        }
        const value = userName?.trim() || null;
        const db = getMelange();
        const placeholders = ids.map(() => '?').join(',');
        const info = db
          .prepare(
            `UPDATE run_facts SET user_name = ? WHERE id IN (${placeholders})`
          )
          .run(value, ...ids);
        return { success: true, updated: info.changes, userName: value };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Диалог выбора CSV --------
  ipcMain.handle('pb:pick-csv', async () => {
    try {
      const res = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: 'Выберите activities.csv из архива Strava',
        filters: [
          { name: 'CSV', extensions: ['csv'] },
          { name: 'Все файлы', extensions: ['*'] },
        ],
      });
      if (res.canceled || res.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      return { success: true, path: res.filePaths[0] };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Импорт Strava activities.csv --------
  ipcMain.handle('pb:import-strava-csv', async (_event, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'filePath обязателен' };
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Файл не найден: ${filePath}` };
      }

      const buffer = fs.readFileSync(filePath);
      const t0 = Date.now();
      const workouts = parseStravaCsv(buffer);
      const parseMs = Date.now() - t0;

      const db = getMelange();
      let added = 0;
      let updated = 0;
      let failed = 0;
      const errors: Array<{ externalId: string; error: string }> = [];

      for (const w of workouts) {
        try {
          const res = upsertRunFact(db, w);
          if (res.inserted) added++;
          else updated++;
        } catch (e) {
          failed++;
          errors.push({ externalId: w.externalId, error: (e as Error).message });
        }
      }

      console.log(
        `[Prana-Bindu] import-strava-csv: +${added} ~${updated} ` +
        `(всего ${workouts.length}, ${parseMs}ms, failed=${failed})`
      );

      return {
        success: true,
        added,
        updated,
        failed,
        total: workouts.length,
        parseMs,
        errors: errors.slice(0, 20),
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:zepp-archive-path-get', () => {
    try {
      return { success: true, path: getZeppArchivePath(getMelange()) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:zepp-archive-path-set', (_event, p: string | null) => {
    try {
      setZeppArchivePath(getMelange(), p ?? null);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Импорт Zepp FIT из папки --------
  ipcMain.handle(
    'pb:import-zepp-dir',
    async (
      _event,
      dirPath: string,
      opts?: { skipIfFileExists?: boolean; savePath?: boolean }
    ) => {
      try {
        if (!dirPath || typeof dirPath !== 'string') {
          return { success: false, error: 'dirPath обязателен' };
        }
        if (!fs.existsSync(dirPath)) {
          return { success: false, error: `Папка не найдена: ${dirPath}` };
        }

        const skipIfFileExists = opts?.skipIfFileExists !== false;
        const savePath = opts?.savePath !== false;

        const files: string[] = [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile() && /\.(fit|tcx)(\.gz)?$/i.test(e.name)) {
            files.push(path.join(dirPath, e.name));
          }
        }
        if (files.length === 0) {
          return { success: false, error: 'FIT-файлы не найдены' };
        }

        const db = getMelange();
        //const WINDOW_MS = 2 * 60 * 1000;

        let imported = 0;
        let skipped = 0;
        let failed = 0;
        let updated = 0;
        const errors: Array<{ file: string; error: string }> = [];
        const importedIds: number[] = [];

        importFitCancelRequested = false;
        const sender = _event.sender;
        const sendProgress = (payload: Record<string, unknown>) => {
          if (!sender.isDestroyed()) sender.send('pb:import-progress', payload);
        };

        for (let i = 0; i < files.length; i++) {
          if (importFitCancelRequested) break;
          const file = files[i];
          const filename = path.basename(file);

          try {
            const basename = filename.replace(/\.(fit|tcx)(\.gz)?$/i, '');
            const source = detectSource(file);
            const externalId = `${source}:${basename}`;

            // 1. Сначала — дедуп по (source, external_id): файл уже импортировался.
            const byExt = db
              .prepare(`SELECT id FROM run_facts WHERE source = ? AND external_id = ? LIMIT 1`)
              .get(source, externalId) as { id: number } | undefined;
            if (byExt && skipIfFileExists) {
              skipped++;
              sendProgress({
                current: i + 1, total: files.length, filename,
                imported, updated, skipped, failed,
              });
              await new Promise((r) => setImmediate(r));
              continue;
            }

            // 2. Парсим, получаем startTime.
            const workout = await parseWorkoutFile(file, basename);

            
            /*// 3. Дедуп по времени: есть ли fit/tcx-запись с тем же start_time ± 2 мин.
            if (skipIfFileExists) {
              const day = workout.startTime.slice(0, 10);
              const startMs = new Date(workout.startTime).getTime();
              const candidates = db
                .prepare(
                  `SELECT id, start_time, source FROM run_facts
                   WHERE date = ? AND start_time IS NOT NULL
                     AND source IN ('fit','tcx')`
                )
                .all(day) as unknown as Array<{ id: number; start_time: string; source: string }>;

              const dup = candidates.some(
                (c) => Math.abs(new Date(c.start_time).getTime() - startMs) < WINDOW_MS
              );
              if (dup) {
                skipped++;
                sendProgress({
                  current: i + 1, total: files.length, filename,
                  imported, updated: 0, skipped, failed,
                });
                await new Promise((r) => setImmediate(r));
                continue;
              }
            }*/

            // 4. Импортируем.
            const startMs2 = new Date(workout.startTime).getTime();
            const endTime = new Date(startMs2 + workout.durationSec * 1000).toISOString();

            const raw = {
              externalId,
              source: workout.source,
              origin: 'zepp-app',
              name: (workout as any).name,
              startTime: workout.startTime,
              endTime,
              distanceM: workout.distanceM,
              durationS: workout.durationSec,
              avgHr: workout.summary.avgHr,
              maxHr: workout.summary.maxHr,
              gpsQuality: workout.summary.gpsQuality,
              distanceSource: workout.summary.distanceSource,
              gpsCoveragePct: workout.summary.gpsCoveragePct,
              raw: {
                sport: workout.sport,
                summary: workout.summary,
                validation: workout.validation,
                lapCount: workout.laps?.length ?? 0,
                importedFrom: file,
              },
            };

            const { inserted, id: runFactId } = upsertRunFact(db, raw);

            const row = db
              .prepare(`SELECT date FROM run_facts WHERE id = ?`)
              .get(runFactId) as { date: string } | undefined;
            const dateForFile = row?.date ?? workout.startTime.slice(0, 10);

            upsertRunStreams(
              db,
              runFactId,
              workout.source,
              externalId,
              dateForFile,
              workout.streams as unknown as Record<string, unknown>
            );

            if (inserted) imported++;
            else updated++;
            importedIds.push(runFactId);
          } catch (e) {
            failed++;
            errors.push({ file: filename, error: (e as Error).message });
          }

          sendProgress({
            current: i + 1, total: files.length, filename,
            imported, updated: 0, skipped, failed,
          });
          await new Promise((r) => setImmediate(r));
        }

        if (savePath && failed === 0 && !importFitCancelRequested) {
          setZeppArchivePath(db, dirPath);
        }

        console.log(
          `[Prana-Bindu] import-zepp-dir: +${imported} ~${updated} skipped=${skipped} failed=${failed} (total=${files.length})`
        );

        return {
          success: true,
          imported,
          updated,
          skipped,
          failed,
          cancelled: importFitCancelRequested,
          total: files.length,
          importedIds,
          errors: errors.slice(0, 20),
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Разведка: реверс-маппинг ICU-строк --------
  ipcMain.handle('pb:debug-match-icu', (_event, text: string) => {
    try {
      if (!text || typeof text !== 'string') {
        return { success: false, error: 'text обязателен (string)' };
      }
      const res = matchIcuWorkout(text);
      return { success: true, data: res };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('pb:debug-match-icu-line', (_event, line: string) => {
    try {
      if (!line || typeof line !== 'string') {
        return { success: false, error: 'line обязателен (string)' };
      }
      const res = matchIcuLine(line);
      return { success: true, data: res };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // -------- Разведка: реверс-маппинг всех plan_events в диапазоне --------
  ipcMain.handle(
    'pb:debug-match-plan-events',
    (_event, from: string, to: string) => {
      try {
        if (!from || !to) {
          return { success: false, error: 'from и to обязательны' };
        }
        const db = getMelange();
        const rows = db
          .prepare(
            `SELECT id, date, name, description
             FROM plan_events
             WHERE date >= ? AND date <= ?
             ORDER BY date ASC`
          )
          .all(from, to) as unknown as Array<{
            id: number;
            date: string;
            name: string;
            description: string | null;
          }>;

        let totalSteps = 0;
        let full = 0;
        let partial = 0;
        let none = 0;
        const unmatched = new Map<string, number>();
        const partialMap = new Map<string, { count: number; note: string }>();

        for (const row of rows) {
          if (!row.description) continue;
          const m = matchIcuWorkout(row.description);
          totalSteps += m.summary.total;
          full += m.summary.full;
          partial += m.summary.partial;
          none += m.summary.none;

          for (const s of m.steps) {
            const key = s.cleanLabel || s.raw;
            if (s.confidence === 'none') {
              unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
            } else if (s.confidence === 'partial') {
              const prev = partialMap.get(key);
              partialMap.set(key, {
                count: (prev?.count ?? 0) + 1,
                note: s.note ?? '',
              });
            }
          }
        }

        const topUnmatched = [...unmatched.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 30)
          .map(([label, count]) => ({ label, count }));

        const topPartial = [...partialMap.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 30)
          .map(([label, v]) => ({ label, count: v.count, note: v.note }));

        return {
          success: true,
          data: {
            events: rows.length,
            totalSteps,
            full,
            partial,
            none,
            topUnmatched,
            topPartial,
          },
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Автосинхронизация при старте --------
  // Вызывается один раз из рендера при монтировании PranaBinduPage.
  // Проверяет mode='auto' + auto_on_start=1 + антидребезг (6ч).
  // Синкает workouts за 7 дней по всем провайдерам с capabilities.workouts,
  // и wellness за те же 7 дней в мультипровайдерном режиме.
  // Async: не блокирует UI, всё в фоне.
  ipcMain.handle('pb:auto-sync-on-start', async () => {
    try {
      const db = getMelange();
      const settings = getSyncSettings(db);

      // Единственный флаг — autoOnStart. Поле mode оставлено
      // для совместимости с v5-схемой, но UI рулит чекбоксом.
      if (!settings.autoOnStart) {
        return { success: true, skipped: 'disabled' };
      }

      const intervalMin = settings.autoIntervalMin ?? 360;
      const last = settings.lastSyncAt
        ? new Date(settings.lastSyncAt).getTime()
        : 0;
      const now = Date.now();
      const elapsedMin = last > 0 ? Math.floor((now - last) / 60000) : null;

      if (last > 0 && now - last < intervalMin * 60_000) {
        return {
          success: true,
          skipped: 'cooldown',
          elapsedMin,
          intervalMin,
          lastSyncAt: settings.lastSyncAt,
        };
      }

      // --- 1. Workouts за 7 дней ---
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const pad = (n: number) => String(n).padStart(2, '0');
      const iso = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const fromIso = iso(from);
      const toIso = iso(to);

      const workoutProviders = listProviders().filter(
        (p) => p.capabilities?.workouts && typeof p.fetchWorkouts === 'function'
      );

      const workoutsSummary: Array<{
        provider: string;
        added: number;
        updated: number;
        error?: string;
      }> = [];

      for (const provider of workoutProviders) {
        try {
          const items = await (provider as any).fetchWorkouts(fromIso, toIso);
          let added = 0;
          let updated = 0;
          for (const w of items) {
            const res = upsertRunFact(db, w);
            if (res.inserted) added++;
            else updated++;
          }
          workoutsSummary.push({
            provider: provider.name,
            added,
            updated,
          });
          console.log(
            `[Prana-Bindu] auto-sync workouts (${provider.name}) ${fromIso}..${toIso}: +${added} ~${updated}`
          );
        } catch (e) {
          const msg = (e as Error).message;
          workoutsSummary.push({
            provider: provider.name,
            added: 0,
            updated: 0,
            error: msg,
          });
          console.warn(
            `[Prana-Bindu] auto-sync workouts (${provider.name}) error:`,
            msg
          );
        }
      }

      // --- 2. Wellness за 7 дней (все провайдеры с capabilities.wellness) ---
      const wellnessProviders = listProviders()
        .filter((p) => p.capabilities?.wellness)
        .map((p) => p.name)
        .sort((a, b) => {
          if (a === 'intervals-icu') return -1;
          if (b === 'intervals-icu') return 1;
          if (a === 'dodofo') return -1;
          if (b === 'dodofo') return 1;
          return 0;
        });

      let wellnessAdded = 0;
      let wellnessUpdated = 0;
      const wellnessSummary: Array<{
        provider: string;
        added: number;
        updated: number;
        error?: string;
      }> = [];

      for (const name of wellnessProviders) {
        try {
          const provider = getProvider(name) as any;
          if (!provider || typeof provider.fetchWellness !== 'function') {
            continue;
          }
          const raw = await provider.fetchWellness(fromIso, toIso);
          const days: any[] = Array.isArray(raw) ? raw : raw?.days ?? [];
          let added = 0;
          let updated = 0;
          for (const day of days) {
            if (!day?.id && !day?.date) continue;
            const date = day.id ?? day.date;
            const res = upsertRecoveryLog(db, {
              date,
              resting_hr: day.restingHR ?? day.resting_hr,
              hrv: day.hrv ?? day.hrv_ms,
              hrv_sdnn: day.hrvSDNN ?? day.hrv_sdnn,
              sleep_hours:
                day.sleepSecs != null
                  ? Math.round((day.sleepSecs / 3600) * 100) / 100
                  : day.sleep_hours ?? day.sleepHours,
              sleep_score: day.sleepScore ?? day.sleep_score,
              sleep_quality: day.sleepQuality ?? day.sleep_quality,
              sleep_total_min: day.sleep_total_min ?? day.sleepTotalMin,
              deep_min: day.deep_min ?? day.deepMin,
              rem_min: day.rem_min ?? day.remMin,
              light_min: day.light_min ?? day.lightMin,
              awake_min: day.awake_min ?? day.awakeMin,
              steps: day.steps,
              weight_kg: day.weight ?? day.weight_kg,
              vo2max: day.vo2max,
              body_battery_charged:
                day.body_battery_charged ?? day.bodyBatteryCharged,
              body_battery_drained:
                day.body_battery_drained ?? day.bodyBatteryDrained,
              stress_avg: day.stress_avg ?? day.stressAvg,
              sp_o2: day.spo2_avg_pct ?? day.spO2,
              ctl: day.ctl,
              atl: day.atl,
              ramp_rate: day.rampRate ?? day.ramp_rate,
              readiness: day.readiness,
              soreness: day.soreness,
              fatigue: day.fatigue,
              stress: day.stress,
              mood: day.mood,
              motivation: day.motivation,
              injury: day.injury,
              avg_sleeping_hr:
                day.avgSleepingHR ?? day.avg_sleeping_hr,
              baevsky_si: day.baevskySI ?? day.baevsky_si,
              systolic: day.systolic,
              diastolic: day.diastolic,
              calories_active:
                day.calories_active ?? day.caloriesActive ?? null,
              calories_total:
                day.calories_total ?? day.caloriesTotal ?? null,
              body_fat_pct: day.body_fat_pct ?? day.bodyFatPct ?? null,
              auto_source: name,
              raw_json: JSON.stringify(day),
            });
            if (res.inserted) added++;
            else updated++;
          }
          wellnessAdded += added;
          wellnessUpdated += updated;
          wellnessSummary.push({ provider: name, added, updated });
          console.log(
            `[Prana-Bindu] auto-sync wellness (${name}) ${fromIso}..${toIso}: +${added} ~${updated}`
          );
        } catch (e) {
          const msg = (e as Error).message;
          wellnessSummary.push({
            provider: name,
            added: 0,
            updated: 0,
            error: msg,
          });
          console.warn(
            `[Prana-Bindu] auto-sync wellness (${name}) error:`,
            msg
          );
        }
      }

      // --- 3. Обновляем last_sync_at / last_sync_status ---
      const totalErrors =
        workoutsSummary.filter((w) => w.error).length +
        wellnessSummary.filter((w) => w.error).length;
      const status =
        totalErrors === 0
          ? 'ok'
          : totalErrors ===
            workoutsSummary.length + wellnessSummary.length
          ? 'error'
          : 'partial';
      setLastAutoSync(db, status);

      return {
        success: true,
        ran: true,
        from: fromIso,
        to: toIso,
        workouts: workoutsSummary,
        wellness: {
          added: wellnessAdded,
          updated: wellnessUpdated,
          perProvider: wellnessSummary,
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });


  // -------- Синхронизация плана из intervals.icu --------
  ipcMain.handle(
    'pb:sync-plan',
    async (_event, from: string, to: string) => {
      if (!from || !to) {
        return { success: false, error: 'from и to обязательны' };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return { success: false, error: 'Формат даты: YYYY-MM-DD' };
      }
      if (from > to) {
        return { success: false, error: 'from больше to' };
      }

      try {
        const provider = getProvider('intervals-icu') as any;
        if (!provider) {
          return { success: false, error: 'Провайдер intervals-icu не зарегистрирован' };
        }
        if (typeof provider.fetchPlanEvents !== 'function') {
          return { success: false, error: 'fetchPlanEvents не реализован' };
        }

        const db = getMelange();
        const events = await provider.fetchPlanEvents(from, to);

        let added = 0;
        let updated = 0;
        let failed = 0;
        const errors: Array<{ externalId: string; error: string }> = [];

        for (const ev of events) {
          try {
            const res = upsertPlanEvent(db, ev);
            if (res.inserted) added++;
            else updated++;
          } catch (e) {
            failed++;
            errors.push({ externalId: ev.externalId, error: (e as Error).message });
          }
        }

        // Связь план↔факт
        const runSport = (s?: string | null) =>
          s && /run|бег/i.test(s) ? 'run' : null;

        let linked = 0;
        const linkedEvents = db
          .prepare(
            `SELECT id, date, sport FROM plan_events
             WHERE date >= ? AND date <= ? AND category = 'WORKOUT'
               AND paired_activity_id IS NULL`
          )
          .all(from, to) as unknown as Array<{
            id: number; date: string; sport: string | null;
          }>;

        for (const pe of linkedEvents) {
          if (!runSport(pe.sport)) continue;
          const fact = db
            .prepare(
              `SELECT id FROM run_facts
               WHERE date = ?
               ORDER BY id ASC LIMIT 1`
            )
            .get(pe.date) as { id: number } | undefined;
          if (fact) {
            linkPlanEventToActivity(db, pe.id, fact.id);
            linked++;
          }
        }

        // Mirror: список локальных ICU-событий, которых нет в ICU
        // и которые пользователь не «закрепил» (local_keep = 0).
        // НЕ удаляем автоматически — UI покажет диалог.
        const icuIds = new Set<string>(
          events.map((e: { externalId: string }) => e.externalId)
        );
        const staleCandidates = findStaleIcuEvents(db, from, to, icuIds);

        console.log(
          `[Prana-Bindu] sync-plan (intervals-icu) ${from}..${to}: ` +
          `+${added} ~${updated} linked=${linked} stale=${staleCandidates.length} ` +
          `(всего ${events.length}, failed=${failed})`
        );

        return {
          success: true,
          provider: 'intervals-icu',
          added,
          updated,
          failed,
          linked,
          total: events.length,
          staleCandidates,
          errors: errors.slice(0, 20),
        };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Список событий плана за период --------
  ipcMain.handle(
    'pb:list-plan-events',
    (_event, from: string, to: string) => {
      try {
        if (!from || !to) {
          return { success: false, error: 'from и to обязательны' };
        }
        const rows = listPlanEvents(getMelange(), from, to);
        return { success: true, items: rows, total: rows.length };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Установить/сбросить local_keep для группы событий --------
  ipcMain.handle(
    'pb:plan-events-set-keep',
    (_event, ids: number[], keep: boolean) => {
      try {
        if (!Array.isArray(ids)) {
          return { success: false, error: 'ids должен быть массивом' };
        }
        const n = setLocalKeep(getMelange(), ids, !!keep);
        return { success: true, updated: n };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Удалить группу событий по id --------
  ipcMain.handle(
    'pb:plan-events-delete-bulk',
    (_event, ids: number[]) => {
      try {
        if (!Array.isArray(ids)) {
          return { success: false, error: 'ids должен быть массивом' };
        }
        const n = deletePlanEventsByIds(getMelange(), ids);
        return { success: true, deleted: n };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Список событий для массового удаления --------
  ipcMain.handle(
    'pb:list-plan-events-for-delete',
    (
      _event,
      params: {
        from: string;
        to: string;
        categories?: string[];
        origins?: Array<'generated' | 'manual-local' | 'icu'>;
      }
    ) => {
      try {
        if (!params?.from || !params?.to) {
          return { success: false, error: 'from и to обязательны' };
        }
        const items = listPlanEventsForDelete(
          getMelange(),
          params.from,
          params.to,
          {
            categories: params.categories,
            origins: params.origins,
          }
        );
        return { success: true, items };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  // -------- Удалить план за период --------
  ipcMain.handle(
    'pb:clear-plan',
    (_event, from: string, to: string) => {
      try {
        if (!from || !to) {
          return { success: false, error: 'from и to обязательны' };
        }
        const n = deletePlanEventsRange(getMelange(), from, to);
        return { success: true, deleted: n };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

  console.log('[Prana-Bindu] IPC-хендлеры зарегистрированы (pb:*)');
}

