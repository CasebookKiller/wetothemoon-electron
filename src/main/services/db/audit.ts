import { getDatabase } from './connection';

export interface AuditLogEntry {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string | null;
  reason: string | null;
}

export interface AuditLogFilters {
  table_name?: string | null;
  action?: string | null;
  /** ISO-дата, включительно. Формат YYYY-MM-DD. */
  date_from?: string | null;
  date_to?: string | null;
  /** Поиск по reason / new_value. */
  search?: string | null;
}

export function auditChange(
  table_name: string,
  record_id: number,
  action: string,
  old_value: string | null,
  new_value: string | null,
  reason: string
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_at, changed_by, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(table_name, record_id, action, old_value, new_value, new Date().toISOString(), 'system', reason);
}

/**
 * Помечает запись в указанной таблице как status='false'.
 * Записывает причину в notes (как в Python-скрипте).
 * Переводит origin в 'manual' (чтобы скрапер не перезаписал).
 * Логирует изменение в audit_log.
 */
export function markRecordAsFalse(
  table: 'entities' | 'relations' | 'observations',
  recordId: number,
  reason: string
): { success: boolean; error?: string } {
  const db = getDatabase();

  if (!['entities', 'relations', 'observations'].includes(table)) {
    return { success: false, error: `Недопустимая таблица: ${table}` };
  }

  const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(recordId) as any;
  if (!old) {
    return { success: false, error: `Запись с id=${recordId} не найдена в таблице ${table}` };
  }

  const oldOrigin = old.origin || 'scraper';

  db.prepare(`
    UPDATE ${table}
    SET status = 'false',
        notes = ?,
        origin = 'manual'
    WHERE id = ?
  `).run(reason, recordId);

  auditChange(
    table,
    recordId,
    'mark_false',
    JSON.stringify(old),
    `status=false; reason=${reason}; origin=${oldOrigin}→manual`,
    reason
  );

  return { success: true };
}

/**
 * Массовая пометка записей как ложных (best-effort).
 * Помечает то, что смог; неудачные id складывает в errors.
 * Всё выполняется внутри одной транзакции — быстро и консистентно
 * по отношению к внешним читателям.
 */
export function markRecordsAsFalse(
  table: 'entities' | 'relations' | 'observations',
  recordIds: number[],
  reason: string
): {
  success: boolean;
  updated: number;
  failed: number;
  errors: { id: number; error: string }[];
} {
  const db = getDatabase();

  if (!['entities', 'relations', 'observations'].includes(table)) {
    return {
      success: false,
      updated: 0,
      failed: 0,
      errors: [{ id: 0, error: `Недопустимая таблица: ${table}` }],
    };
  }

  if (!Array.isArray(recordIds) || recordIds.length === 0) {
    return {
      success: false,
      updated: 0,
      failed: 0,
      errors: [{ id: 0, error: 'Пустой список id' }],
    };
  }

  if (!reason || !reason.trim()) {
    return {
      success: false,
      updated: 0,
      failed: 0,
      errors: [{ id: 0, error: 'Не указана причина' }],
    };
  }

  let updated = 0;
  let failed = 0;
  const errors: { id: number; error: string }[] = [];

  // Транзакция для скорости (одна запись WAL на батч вместо N).
  // Best-effort: исключения от отдельных записей ловим и продолжаем.
  try {
    db.exec('BEGIN');
    try {
      for (const id of recordIds) {
        try {
          const r = markRecordAsFalse(table, id, reason);
          if (r.success) {
            updated++;
          } else {
            failed++;
            errors.push({ id, error: r.error || 'неизвестная ошибка' });
          }
        } catch (e) {
          failed++;
          errors.push({ id, error: (e as Error).message });
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (e) {
    return {
      success: false,
      updated: 0,
      failed: recordIds.length,
      errors: [{ id: 0, error: (e as Error).message }],
    };
  }

  return { success: true, updated, failed, errors };
}

export function getAuditLog(
  filters: AuditLogFilters = {},
  limit = 200,
  offset = 0
): { items: AuditLogEntry[]; total: number } {
  const db = getDatabase();

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.table_name) {
    conditions.push('table_name = ?');
    params.push(filters.table_name);
  }
  if (filters.action) {
    conditions.push('action = ?');
    params.push(filters.action);
  }
  if (filters.date_from) {
    conditions.push('changed_at >= ?');
    params.push(`${filters.date_from}T00:00:00.000Z`);
  }
  if (filters.date_to) {
    conditions.push('changed_at <= ?');
    params.push(`${filters.date_to}T23:59:59.999Z`);
  }
  if (filters.search) {
    conditions.push('(reason LIKE ? OR new_value LIKE ? OR old_value LIKE ?)');
    const q = `%${filters.search}%`;
    params.push(q, q, q);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(
    `SELECT COUNT(*) AS c FROM audit_log ${where}`
  ).get(...params) as any).c;

  const items = db.prepare(`
    SELECT id, table_name, record_id, action, old_value, new_value,
           changed_at, changed_by, reason
    FROM audit_log
    ${where}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as unknown as AuditLogEntry[];

  return { items, total };
}

/** Список уникальных table_name для dropdown-фильтра. */
export function listAuditLogTables(): string[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT DISTINCT table_name FROM audit_log ORDER BY table_name ASC'
  ).all() as Array<{ table_name: string }>;
  return rows.map((r) => r.table_name);
}

/** Список уникальных action для dropdown-фильтра. */
export function listAuditLogActions(): string[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT DISTINCT action FROM audit_log ORDER BY action ASC'
  ).all() as Array<{ action: string }>;
  return rows.map((r) => r.action);
}
