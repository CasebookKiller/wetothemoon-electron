// src/main/ipcHandlers/pranaBinduHandlers.ts

// src/main/ipcHandlers/pranaBinduHandlers.ts

import fs from 'fs';
import path from 'path';
import { app, ipcMain, safeStorage } from 'electron';
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
} from '../services/pranaBindu/melange';

import { DodofoProvider } from '../services/pranaBindu/spice/providers/dodofoProvider';

// ==================== Регистрация провайдеров ====================

let providersRegistered = false;

function ensureProvidersRegistered(): void {
  if (providersRegistered) return;
  registerProvider(new DofekZeppProvider());
  registerProvider(new ZeppMcpProvider());
  registerProvider(new ZeppBridgeProvider());
  registerProvider(new DodofoProvider(getDodofoToken));
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

    // -------- Ручная синхронизация --------
  ipcMain.handle(
    'pb:sync-now',
    async (_event, from: string, to: string) => {
      if (!from || !to) {
        return {
          success: false,
          error: 'from и to обязательны (YYYY-MM-DD)',
        };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return {
          success: false,
          error: 'Неверный формат даты. Ожидается YYYY-MM-DD',
        };
      }
      if (from > to) {
        return { success: false, error: 'from больше to' };
      }

      try {
        const provider = getProvider('dodofo');
        if (!provider) {
          return { success: false, error: 'Провайдер dodofo не зарегистрирован' };
        }

        const db = getMelange();
        const workouts = await provider.fetchWorkouts(from, to);

        let added = 0;
        let updated = 0;
        for (const w of workouts) {
          const res = upsertRunFact(db, w);
          if (res.inserted) added += 1;
          else updated += 1;
        }

        // last_sync_at / last_sync_status в updateSyncSettings не мапятся —
        // если позже понадобится, добавим в syncRepo. Пока фиксируем dodofo-поля.
        updateSyncSettings(db, {
          dodofoLastSyncAt: new Date().toISOString(),
          dodofoLastSyncStatus: 'ok',
        });

        console.log(
          `[Prana-Bindu] sync-now ${from}..${to}: +${added} ~${updated} (всего ${workouts.length})`
        );

        return {
          success: true,
          added,
          updated,
          skipped: 0,
          total: workouts.length,
        };
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

    // -------- Сохранение потоков одной тренировки --------
  ipcMain.handle(
    'pb:sync-run-streams',
    async (_event, runFactId: number) => {
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

        if (fact.source === 'dodofo') {
          const m = String(fact.external_id || '').match(/^dodofo:(\d+)$/);
          if (!m) {
            return { success: false, error: 'external_id не в формате dodofo:<id>' };
          }
          const activityId = Number(m[1]);
          const provider = getProvider('dodofo') as any;
          if (!provider || typeof provider.fetchStreams !== 'function') {
            return { success: false, error: 'Провайдер dodofo не поддерживает fetchStreams' };
          }

          const t0 = Date.now();
          const raw = await provider.fetchStreams(activityId);
          const dt = Date.now() - t0;

          if (raw == null || typeof raw !== 'object') {
            return { success: false, error: 'Пустой ответ fetchStreams' };
          }

          const meta = upsertRunStreams(
            db,
            runFactId,
            'dodofo',
            fact.external_id,
            fact.date,
            raw as Record<string, unknown>
          );

          console.log(
            `[Prana-Bindu] sync-run-streams: fact=${runFactId} (dodofo:${activityId}), ` +
            `points=${meta.point_count}, size=${meta.size_bytes}B, ${dt}ms`
          );

          return {
            success: true,
            source: 'dodofo',
            pointCount: meta.point_count,
            sizeBytes: meta.size_bytes,
            channels: meta.channels,
            fetchMs: dt,
          };
        }

        return { success: false, error: `Источник '${fact.source}' пока не поддержан` };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    }
  );

    // -------- Массовая заливка потоков за период --------
  ipcMain.handle(
    'pb:sync-run-streams-all',
    async (_event, from: string, to: string, opts?: { onlyMissing?: boolean }) => {
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
        const onlyMissing = opts?.onlyMissing !== false; // по умолчанию — только отсутствующие

        const facts = db
          .prepare(
            `SELECT id, source, external_id, date FROM run_facts
             WHERE date >= ? AND date <= ? AND source = 'dodofo'
             ORDER BY date ASC`
          )
          .all(from, to) as unknown as Array<{
            id: number;
            source: string;
            external_id: string | null;
            date: string;
          }>;

        const provider = getProvider('dodofo') as any;
        if (!provider || typeof provider.fetchStreams !== 'function') {
          return { success: false, error: 'Провайдер dodofo не поддерживает fetchStreams' };
        }

        let fetched = 0;
        let skipped = 0;
        let failed = 0;
        const errors: Array<{ runFactId: number; error: string }> = [];

        for (const fact of facts) {
          if (onlyMissing && hasRunStreams(db, fact.id, 'dodofo')) {
            skipped++;
            continue;
          }

          const m = String(fact.external_id || '').match(/^dodofo:(\d+)$/);
          if (!m) {
            failed++;
            errors.push({ runFactId: fact.id, error: 'external_id не в формате dodofo:<id>' });
            continue;
          }

          try {
            const raw = await provider.fetchStreams(Number(m[1]));
            if (raw == null || typeof raw !== 'object') {
              failed++;
              errors.push({ runFactId: fact.id, error: 'Пустой ответ' });
              continue;
            }
            upsertRunStreams(
              db,
              fact.id,
              'dodofo',
              fact.external_id,
              fact.date,
              raw as Record<string, unknown>
            );
            fetched++;
          } catch (e) {
            failed++;
            errors.push({ runFactId: fact.id, error: (e as Error).message });
          }
        }

        console.log(
          `[Prana-Bindu] sync-run-streams-all ${from}..${to}: ` +
          `fetched=${fetched}, skipped=${skipped}, failed=${failed}, total=${facts.length}`
        );

        return {
          success: true,
          fetched,
          skipped,
          failed,
          total: facts.length,
          errors: errors.slice(0, 20), // не раздуваем ответ
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
          .slice(0, 500);

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

  console.log('[Prana-Bindu] IPC-хендлеры зарегистрированы (pb:*)');
}

