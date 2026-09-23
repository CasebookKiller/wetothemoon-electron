import { auditChange } from './audit';
import { getDatabase } from './connection';

/**
 * Полная очистка всех таблиц с данными (кроме case_info).
 * Порядок удаления важен из-за FK.
 */
export function clearAllTables(): { success: boolean; error?: string } {
  const db = getDatabase();

  try {
    // Удаляем в правильном порядке (сначала зависимые)
    db.exec('DELETE FROM relations;');
    db.exec('DELETE FROM observations;');
    db.exec('DELETE FROM entities;');
    db.exec('DELETE FROM sources;');
    db.exec('DELETE FROM raw_dumps;');
    db.exec('DELETE FROM audit_log;');
    db.exec('DELETE FROM shards;');
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'case_info',
    1,
    'clear_all',
    null,
    'Все таблицы данных очищены',
    'Полная очистка базы через UI'
  );

  return { success: true };
}
