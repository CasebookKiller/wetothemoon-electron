// src/main/services/osint/backupService.ts

import fs from 'fs';
import path from 'path';
import { app, dialog, BrowserWindow } from 'electron';
import { getDatabase } from '../db';
//import { getDatabase } from '../database';

// ============ Вспомогательные ============

/**
 * Экранирует путь для SQLite-литерала (VACUUM INTO).
 */
function sqlQuotePath(p: string): string {
  return `'${p.replace(/'/g, "''")}'`;
}

/**
 * Рекурсивное копирование каталога.
 */
function copyDirRecursive(src: string, dest: string): number {
  let copied = 0;
  if (!fs.existsSync(src)) return copied;
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied += copyDirRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      copied++;
    }
  }
  return copied;
}

// ============ Backup ============

export interface BackupOptions {
  includeSensitive?: boolean;
  includeRawDumps?: boolean;
}

export interface BackupResult {
  success: boolean;
  canceled?: boolean;
  backupDir?: string;
  files?: {
    osintDb: boolean;
    sensitiveDb: boolean;
    rawDumpsCount: number;
  };
  error?: string;
}

export async function createBackup(
  parentWindow: BrowserWindow | null,
  options: BackupOptions = {}
): Promise<BackupResult> {
  try {
    // 1. Диалог выбора папки для backup
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Выберите папку для backup',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: app.getPath('documents'),
    };

    const picked = parentWindow
      ? await dialog.showOpenDialog(parentWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (picked.canceled || picked.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    // 2. Создаём подкаталог с timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19); // YYYY-MM-DD_HH-MM-SS
    const backupDir = path.join(picked.filePaths[0], `fremen-eye-backup-${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const result: BackupResult = {
      success: true,
      backupDir,
      files: {
        osintDb: false,
        sensitiveDb: false,
        rawDumpsCount: 0,
      },
    };

    // 3. Основная БД через VACUUM INTO (чистая копия без WAL-мусора)
    const osintDbPath = path.join(app.getPath('userData'), 'osint_data.db');
    const backupOsintDb = path.join(backupDir, 'osint_data.db');
    if (fs.existsSync(osintDbPath)) {
      const db = getDatabase();
      // VACUUM INTO требует, чтобы файл-приёмник не существовал
      if (fs.existsSync(backupOsintDb)) fs.unlinkSync(backupOsintDb);
      try {
        db.exec(`VACUUM INTO ${sqlQuotePath(backupOsintDb)}`);
        result.files!.osintDb = true;
      } catch (e) {
        console.warn('VACUUM INTO не сработал, использую копирование файла:', e);
        fs.copyFileSync(osintDbPath, backupOsintDb);
        result.files!.osintDb = true;
      }
    }

    // 4. Sensitive БД — просто file copy (это зашифрованный SQLite)
    if (options.includeSensitive) {
      const sensPath = path.join(app.getPath('userData'), 'sensitive_data.db');
      if (fs.existsSync(sensPath)) {
        fs.copyFileSync(sensPath, path.join(backupDir, 'sensitive_data.db'));
        result.files!.sensitiveDb = true;
      }
    }

    // 5. raw_dumps
    if (options.includeRawDumps) {
      const rawSrc = path.join(app.getPath('userData'), 'raw_dumps');
      const rawDest = path.join(backupDir, 'raw_dumps');
      const copied = copyDirRecursive(rawSrc, rawDest);
      result.files!.rawDumpsCount = copied;
    }

    // 6. Метаданные
    const meta = {
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      includes: {
        osintDb: result.files!.osintDb,
        sensitiveDb: result.files!.sensitiveDb,
        rawDumps: options.includeRawDumps || false,
        rawDumpsCount: result.files!.rawDumpsCount,
      },
    };
    fs.writeFileSync(
      path.join(backupDir, 'backup_meta.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );

    return result;
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ============ Восстановление ============

export interface RestoreResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
  rawDumpsRestored?: number;
}

/**
 * Восстанавливает osint_data.db, sensitive_data.db и raw_dumps/ из каталога backup.
 * Если raw_dumps/ есть в backup — текущий каталог userData/raw_dumps заменяется
 * содержимым из backup (не merge).
 * Приложение нужно перезапустить после восстановления.
 */
export async function restoreFromBackup(
  parentWindow: BrowserWindow | null
): Promise<RestoreResult> {
  try {
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Выберите папку backup',
      properties: ['openDirectory'],
      defaultPath: app.getPath('documents'),
    };

    const picked = parentWindow
      ? await dialog.showOpenDialog(parentWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (picked.canceled || picked.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const sourceDir = picked.filePaths[0];
    const metaPath = path.join(sourceDir, 'backup_meta.json');
    if (!fs.existsSync(metaPath)) {
      return { success: false, error: 'В выбранной папке нет backup_meta.json' };
    }

    const osintSrc = path.join(sourceDir, 'osint_data.db');
    if (!fs.existsSync(osintSrc)) {
      return { success: false, error: 'В backup нет osint_data.db' };
    }

    const userData = app.getPath('userData');
    const osintDst = path.join(userData, 'osint_data.db');
    const sensSrc = path.join(sourceDir, 'sensitive_data.db');
    const sensDst = path.join(userData, 'sensitive_data.db');

    // Удаляем текущие WAL/SHM, чтобы не было конфликтов
    for (const f of ['osint_data.db', 'sensitive_data.db']) {
      for (const suffix of ['-wal', '-shm']) {
        const p = path.join(userData, f + suffix);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }

    // Копируем файлы
    fs.copyFileSync(osintSrc, osintDst);
    if (fs.existsSync(sensSrc)) {
      fs.copyFileSync(sensSrc, sensDst);
    }

    // Восстанавливаем raw_dumps/, если они есть в backup
    let rawDumpsRestored = 0;
    const rawSrc = path.join(sourceDir, 'raw_dumps');
    const rawDst = path.join(userData, 'raw_dumps');
    if (fs.existsSync(rawSrc)) {
      // Семантика «restore» — вернуть состояние из backup.
      // Удаляем текущий каталог, чтобы не смешивать старое и новое
      // (в БД после restore будут ссылки только на файлы из backup).
      if (fs.existsSync(rawDst)) {
        fs.rmSync(rawDst, { recursive: true, force: true });
      }
      rawDumpsRestored = copyDirRecursive(rawSrc, rawDst);
    }

    return { success: true, rawDumpsRestored };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}