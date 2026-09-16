// src/main/services/osint/sensitive/sensitivePassphraseStorage.ts

import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

const FILE_NAME = 'sensitive_passphrase.dat';

function getFilePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

export function isAutoUnlockAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

export function getStorageProviderName(): string {
  switch (process.platform) {
    case 'win32': return 'Windows DPAPI';
    case 'darwin': return 'macOS Keychain';
    case 'linux': return 'Linux keyring (libsecret)';
    default: return 'системное хранилище';
  }
}

export function hasStoredPassphrase(): boolean {
  return fs.existsSync(getFilePath());
}

export function savePassphrase(passphrase: string): { success: boolean; error?: string } {
  if (!isAutoUnlockAvailable()) {
    return {
      success: false,
      error: `Авторазблокировка недоступна: ${getStorageProviderName()} не отвечает`,
    };
  }
  try {
    const encrypted = safeStorage.encryptString(passphrase);
    const filePath = getFilePath();
    fs.writeFileSync(filePath, encrypted);
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // ignore on Windows
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function loadPassphrase(): string | null {
  if (!isAutoUnlockAvailable()) return null;
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const buf = fs.readFileSync(filePath);
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export function clearStoredPassphrase(): void {
  const filePath = getFilePath();
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
}