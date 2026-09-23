import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { initializeSchema } from './schema';

let db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!db) {
    console.log('Создаём базу данных...');
    const dbPath = path.join(app.getPath('userData'), 'osint_data.db');
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    try {
      initializeSchema(db);
      console.log('Схема инициализирована');
    } catch (e) {
      console.error('Ошибка инициализации схемы:', e);
      throw e;
    }
  }
  return db;
}