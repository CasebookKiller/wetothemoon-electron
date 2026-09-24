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
} from '../services/pranaBindu/melange';

// ==================== Регистрация провайдеров ====================

let providersRegistered = false;

function ensureProvidersRegistered(): void {
  if (providersRegistered) return;
  registerProvider(new DofekZeppProvider());
  registerProvider(new ZeppMcpProvider());
  registerProvider(new ZeppBridgeProvider());
  providersRegistered = true;
  console.log(`[Prana-Bindu] Зарегистрировано провайдеров Zepp: ${listProviders().length}`);
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

  console.log('[Prana-Bindu] IPC-хендлеры зарегистрированы (pb:*)');
}