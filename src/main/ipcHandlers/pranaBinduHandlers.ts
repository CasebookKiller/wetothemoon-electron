// src/main/ipcHandlers/pranaBinduHandlers.ts

import { ipcMain, safeStorage } from 'electron';
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

// ==================== dodofo token ====================

/**
 * Источник токена dodofo.
 * 1. Из БД (расшифрован через safeStorage) — основной путь (будет позже).
 * 2. Fallback: process.env.VITE_DODOFO_TOKEN — только для dev.
 * TODO: убрать env-fallback после того, как UI подключения будет готов.
 */
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

  console.log('[Prana-Bindu] IPC-хендлеры зарегистрированы (pb:*)');
}