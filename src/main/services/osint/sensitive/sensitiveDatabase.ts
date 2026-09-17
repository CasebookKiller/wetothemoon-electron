// src/main/osint/services/sensitive/sensitiveDatabase.ts

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

import {
  KdfConfig,
  EncryptedBlob,
  createKdfConfig,
  createSentinel,
  encryptWithKey,
  decryptWithKey,
  deriveKey,
  verifySentinel,
  generateRandomKey,
  unlockWithPassphrase,
  unlockWithRawKey,
  encryptCurrent,
  decryptCurrent,
  isUnlocked,
  lockKey,
} from './sensitiveCrypto';

import {
  isAutoUnlockAvailable,
  savePassphrase,
  loadPassphrase,
  hasStoredPassphrase,
  clearStoredPassphrase,
} from './sensitivePassphraseStorage';

let sdb: DatabaseSync | null = null;

function getSensitiveDbPath(): string {
  return path.join(app.getPath('userData'), 'sensitive_data.db');
}

function getSensitiveDatabase(): DatabaseSync {
  if (!sdb) {
    const dbPath = getSensitiveDbPath();
    sdb = new DatabaseSync(dbPath);
    sdb.exec('PRAGMA journal_mode = WAL;');
    sdb.exec('PRAGMA foreign_keys = ON;');
    initializeSchema(sdb);
    try {
      fs.chmodSync(dbPath, 0o600);
      for (const suffix of ['-wal', '-shm']) {
        const p = dbPath + suffix;
        if (fs.existsSync(p)) fs.chmodSync(p, 0o600);
      }
    } catch {
      // ignore on Windows
    }
  }
  return sdb;
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sensitive_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL,
      kdf_salt TEXT,
      kdf_iterations INTEGER,
      kdf_digest TEXT,
      sentinel_iv TEXT NOT NULL,
      sentinel_ct TEXT NOT NULL,
      sentinel_tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sensitive_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      iv TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      legal_basis TEXT NOT NULL,
      retention_until TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sensitive_entity ON sensitive_data(entity_id);
    CREATE INDEX IF NOT EXISTS idx_sensitive_field ON sensitive_data(field_name);
  `);
}

// ============ Статус хранилища ============

export interface SensitiveStatus {
  initialized: boolean;
  mode: 'passphrase' | 'system-key' | null;
  unlocked: boolean;
  autoUnlockAvailable: boolean;
  hasStoredPassphrase: boolean;
}

export function getSensitiveStatus(): SensitiveStatus {
  const db = getSensitiveDatabase();
  const cfg = db.prepare('SELECT id, mode FROM sensitive_config WHERE id = 1').get() as any;
  return {
    initialized: !!cfg,
    mode: cfg?.mode ?? null,
    unlocked: isUnlocked(),
    autoUnlockAvailable: isAutoUnlockAvailable(),
    hasStoredPassphrase: hasStoredPassphrase(),
  };
}

// ============ Инициализация (первый запуск) ============

export interface InitPassphraseInput {
  mode: 'passphrase';
  passphrase: string;
  saveAutoUnlock: boolean;
}

export interface InitSystemKeyInput {
  mode: 'system-key';
  saveAutoUnlock: boolean;
}

export type InitInput = InitPassphraseInput | InitSystemKeyInput;

export function initializeSensitiveVault(
  input: InitInput
): { success: boolean; error?: string } {
  const db = getSensitiveDatabase();

  const existing = db.prepare('SELECT id FROM sensitive_config WHERE id = 1').get();
  if (existing) {
    return { success: false, error: 'Хранилище уже инициализировано' };
  }

  let key: Buffer;
  let kdf: KdfConfig | null = null;
  let materialToSave: string | null = null;

  try {
    if (input.mode === 'passphrase') {
      if (!input.passphrase?.trim()) {
        return { success: false, error: 'Пустая фраза восстановления' };
      }
      kdf = createKdfConfig();
      key = deriveKey(input.passphrase, kdf);
      materialToSave = input.passphrase;
    } else {
      key = generateRandomKey();
      materialToSave = key.toString('base64');
    }

    const sentinel = createSentinel(key);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sensitive_config
        (id, mode, kdf_salt, kdf_iterations, kdf_digest,
         sentinel_iv, sentinel_ct, sentinel_tag, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.mode,
      kdf?.salt ?? null,
      kdf?.iterations ?? null,
      kdf?.digest ?? null,
      sentinel.iv,
      sentinel.ct,
      sentinel.tag,
      now,
      now
    );

    // Разблокировать сессию
    unlockWithRawKey(key);

    // Сохранить материал для авторазблокировки
    if (input.saveAutoUnlock && materialToSave) {
      const saveResult = savePassphrase(materialToSave);
      if (!saveResult.success) {
        console.warn('Авторазблокировка не сохранена:', saveResult.error);
      }
    }

    return { success: true };
  } catch (e) {
    if (key!) key.fill(0);
    return { success: false, error: (e as Error).message };
  }
}

// ============ Разблокировка ============

function loadConfig(): {
  mode: 'passphrase' | 'system-key';
  kdf: KdfConfig | null;
  sentinel: EncryptedBlob;
} | null {
  const db = getSensitiveDatabase();
  const cfg = db.prepare('SELECT * FROM sensitive_config WHERE id = 1').get() as any;
  if (!cfg) return null;
  return {
    mode: cfg.mode,
    kdf: cfg.kdf_salt
      ? { salt: cfg.kdf_salt, iterations: cfg.kdf_iterations, digest: cfg.kdf_digest }
      : null,
    sentinel: { iv: cfg.sentinel_iv, ct: cfg.sentinel_ct, tag: cfg.sentinel_tag },
  };
}

export function tryAutoUnlock(): { success: boolean; error?: string } {
  const cfg = loadConfig();
  if (!cfg) return { success: false, error: 'Хранилище не инициализировано' };

  if (!hasStoredPassphrase()) {
    return { success: false, error: 'Фраза не сохранена для авторазблокировки' };
  }
  const material = loadPassphrase();
  if (!material) {
    return { success: false, error: 'Не удалось прочитать сохранённую фразу' };
  }

  if (cfg.mode === 'passphrase') {
    if (!cfg.kdf) return { success: false, error: 'Повреждён конфиг KDF' };
    return unlockWithPassphrase(material, cfg.kdf, cfg.sentinel);
  } else {
    try {
      const key = Buffer.from(material, 'base64');
      if (!verifySentinel(key, cfg.sentinel)) {
        key.fill(0);
        return { success: false, error: 'Сохранённый ключ повреждён' };
      }
      unlockWithRawKey(key);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}

export function unlockWithPassphraseInput(
  passphrase: string,
  saveAutoUnlock = false
): { success: boolean; error?: string } {
  const cfg = loadConfig();
  if (!cfg) return { success: false, error: 'Хранилище не инициализировано' };
  if (cfg.mode !== 'passphrase' || !cfg.kdf) {
    return { success: false, error: 'Хранилище не использует фразу восстановления' };
  }
  const res = unlockWithPassphrase(passphrase, cfg.kdf, cfg.sentinel);
  if (res.success && saveAutoUnlock && isAutoUnlockAvailable()) {
    savePassphrase(passphrase);
  }
  return res;
}

export function lockSensitiveVault(): void {
  lockKey();
}

export function forgetAutoUnlock(): void {
  clearStoredPassphrase();
}

// ============ CRUD записей ============

export interface SensitiveRecordInput {
  entity_id: number;
  field_name: string;
  field_value: string;
  legal_basis: string;
  retention_until?: string | null;
  notes?: string | null;
}

export function addSensitiveRecord(input: SensitiveRecordInput): {
  success: boolean;
  id?: number;
  error?: string;
} {
  if (!isUnlocked()) return { success: false, error: 'Хранилище заблокировано' };
  if (!input.entity_id) return { success: false, error: 'Не указана сущность' };
  if (!input.field_name?.trim()) return { success: false, error: 'Не указано поле' };
  if (!input.field_value?.trim()) return { success: false, error: 'Не указано значение' };
  if (!input.legal_basis?.trim()) return { success: false, error: 'Не указано основание хранения' };

  try {
    const db = getSensitiveDatabase();
    const blob = encryptCurrent(input.field_value);
    const info = db.prepare(`
      INSERT INTO sensitive_data
        (entity_id, field_name, iv, ciphertext, auth_tag, created_at,
         legal_basis, retention_until, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.entity_id,
      input.field_name.trim(),
      blob.iv,
      blob.ct,
      blob.tag,
      new Date().toISOString(),
      input.legal_basis.trim(),
      input.retention_until || null,
      input.notes || null
    );
    return { success: true, id: Number(info.lastInsertRowid) };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export interface SensitiveRecordMeta {
  id: number;
  entity_id: number;
  field_name: string;
  created_at: string;
  legal_basis: string;
  retention_until: string | null;
  notes: string | null;
}

export function listSensitiveForEntity(entityId: number): SensitiveRecordMeta[] {
  const db = getSensitiveDatabase();
  const rows = db.prepare(`
    SELECT id, entity_id, field_name, created_at, legal_basis, retention_until, notes
    FROM sensitive_data
    WHERE entity_id = ?
    ORDER BY created_at DESC
  `).all(entityId) as any[];
  return rows as SensitiveRecordMeta[];
}

export function revealSensitiveRecord(id: number): {
  success: boolean;
  value?: string;
  error?: string;
} {
  if (!isUnlocked()) return { success: false, error: 'Хранилище заблокировано' };
  const db = getSensitiveDatabase();
  const r = db.prepare(`
    SELECT iv, ciphertext, auth_tag FROM sensitive_data WHERE id = ?
  `).get(id) as any;
  if (!r) return { success: false, error: 'Запись не найдена' };
  try {
    const value = decryptCurrent({ iv: r.iv, ct: r.ciphertext, tag: r.auth_tag });
    return { success: true, value };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function deleteSensitiveRecord(id: number): { success: boolean; error?: string } {
  const db = getSensitiveDatabase();
  const r = db.prepare('SELECT id FROM sensitive_data WHERE id = ?').get(id);
  if (!r) return { success: false, error: `Запись #${id} не найдена` };
  try {
    db.prepare('DELETE FROM sensitive_data WHERE id = ?').run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function listSensitiveFieldNames(): string[] {
  return [
    'passport',
    'passport_series_number',
    'dob',
    'private_phone',
    'private_email',
    'personal_id',
    'snils',
    'inn',
    'driver_license',
    'address_registration',
    'address_residential',
    'bank_account',
    'other',
  ];
}

/**
 * Полностью стирает sensitive-хранилище: закрывает соединение,
 * удаляет БД, WAL/SHM и сохранённую в keyring фразу.
 * После вызова диалог вернётся в фазу setup.
 */
export function resetSensitiveVault(): { success: boolean; error?: string } {
  try {
    // 1. Закрыть соединение с БД
    if (sdb) {
      try { sdb.close(); } catch { /* ignore */ }
      sdb = null;
    }

    // 2. Обнулить сессионный ключ
    lockKey();

    // 3. Удалить файлы БД
    const dbPath = getSensitiveDbPath();
    for (const suffix of ['', '-wal', '-shm']) {
      const p = dbPath + suffix;
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) {
          console.warn(`Не удалось удалить ${p}:`, e);
        }
      }
    }

    // 4. Удалить сохранённую фразу из keyring
    clearStoredPassphrase();

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}