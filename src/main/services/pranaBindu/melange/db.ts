// src/main/services/pranaBindu/melange/db.ts
//
// Синглтон подключения к prana_bindu.db.
// Путь передаётся снаружи (из main.ts). Никаких импортов electron.

import { DatabaseSync } from 'node:sqlite';
import { applyMigrations } from './migrations';

let db: DatabaseSync | null = null;

export function openMelange(dbPath: string): DatabaseSync {
  if (db) return db;

  console.log(`[Melange] Открываем БД: ${dbPath}`);
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  try {
    applyMigrations(db);
    console.log('[Melange] Схема готова');
  } catch (e) {
    console.error('[Melange] Ошибка инициализации схемы:', e);
    db.close();
    db = null;
    throw e;
  }

  return db;
}

export function getMelange(): DatabaseSync {
  if (!db) {
    throw new Error(
      '[Melange] БД не инициализирована. Вызовите openMelange(dbPath) при старте приложения.'
    );
  }
  return db;
}

export function closeMelange(): void {
  if (db) {
    db.close();
    db = null;
  }
}