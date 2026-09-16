// src/main/services/osint/sensitive/sensitiveCrypto.ts

import crypto from 'crypto';

/** Параметры KDF. Хранятся вместе с зашифрованными данными. */
export interface KdfConfig {
  salt: string;        // base64
  iterations: number;
  digest: 'sha256';
}

/** Один зашифрованный фрагмент. */
export interface EncryptedBlob {
  iv: string;          // base64, 12 байт
  ct: string;          // base64, ciphertext
  tag: string;         // base64, 16 байт
}

const SENTINEL_PLAINTEXT = 'fremen-eye-sensitive-v1';
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const DEFAULT_ITERATIONS = 600_000;
const DEFAULT_DIGEST = 'sha256' as const;

// ============ Сессионное состояние ============
let cachedKey: Buffer | null = null;

export function isUnlocked(): boolean {
  return cachedKey !== null;
}

export function lockKey(): void {
  if (cachedKey) {
    cachedKey.fill(0);
    cachedKey = null;
  }
}

// ============ KDF ============
export function createKdfConfig(): KdfConfig {
  return {
    salt: crypto.randomBytes(SALT_LENGTH).toString('base64'),
    iterations: DEFAULT_ITERATIONS,
    digest: DEFAULT_DIGEST,
  };
}

export function deriveKey(passphrase: string, kdf: KdfConfig): Buffer {
  const salt = Buffer.from(kdf.salt, 'base64');
  const normalized = passphrase.normalize('NFKD');
  return crypto.pbkdf2Sync(
    normalized,
    salt,
    kdf.iterations,
    KEY_LENGTH,
    kdf.digest
  );
}

// ============ Шифрование / расшифровка ============
export function encryptWithKey(key: Buffer, plaintext: string): EncryptedBlob {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptWithKey(key: Buffer, blob: EncryptedBlob): string {
  const iv = Buffer.from(blob.iv, 'base64');
  const ct = Buffer.from(blob.ct, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

// ============ Sentinel ============
export function createSentinel(key: Buffer): EncryptedBlob {
  return encryptWithKey(key, SENTINEL_PLAINTEXT);
}

export function verifySentinel(key: Buffer, sentinel: EncryptedBlob): boolean {
  try {
    return decryptWithKey(key, sentinel) === SENTINEL_PLAINTEXT;
  } catch {
    return false;
  }
}

// ============ Работа с кэшированным ключом ============
export function unlockWithPassphrase(
  passphrase: string,
  kdf: KdfConfig,
  sentinel: EncryptedBlob
): { success: boolean; error?: string } {
  const key = deriveKey(passphrase, kdf);
  if (!verifySentinel(key, sentinel)) {
    key.fill(0);
    return { success: false, error: 'Неверная фраза восстановления' };
  }
  if (cachedKey) cachedKey.fill(0);
  cachedKey = key;
  return { success: true };
}

export function unlockWithRawKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Ожидался ключ ${KEY_LENGTH} байт, получено ${key.length}`);
  }
  if (cachedKey) cachedKey.fill(0);
  cachedKey = key;
}

export function encryptCurrent(plaintext: string): EncryptedBlob {
  if (!cachedKey) throw new Error('Sensitive-хранилище заблокировано');
  return encryptWithKey(cachedKey, plaintext);
}

export function decryptCurrent(blob: EncryptedBlob): string {
  if (!cachedKey) throw new Error('Sensitive-хранилище заблокировано');
  return decryptWithKey(cachedKey, blob);
}

export function generateRandomKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}