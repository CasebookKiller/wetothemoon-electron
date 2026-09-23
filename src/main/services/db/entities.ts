import { auditChange } from './audit';
import { getDatabase } from './connection';
import { normalize } from './utils';

/**
 * Создаёт сущность вручную (origin='manual').
 * Возвращает id или ошибку (в частности, если такая сущность уже есть).
 */
export function createEntity(patch: {
  type: string;
  value: string;
  label?: string | null;
  confidence?: number | null;
  status?: string | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalized = normalize(patch.value);

  try {
    const info = db.prepare(`
      INSERT INTO entities
        (type, value, normalized_value, label, first_seen, last_seen,
         confidence, status, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.type,
      patch.value,
      normalized,
      patch.label || patch.value,
      now,
      now,
      patch.confidence ?? 50,
      patch.status || 'unverified',
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'entities',
      id,
      'create',
      null,
      `type=${patch.type}; value=${patch.value}; origin=manual`,
      'Ручное создание сущности через UI'
    );

    return { success: true, id };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return {
        success: false,
        error: 'Сущность с таким типом и значением уже существует',
      };
    }
    return { success: false, error: msg };
  }
}

export function upsertEntity(entity: {
  rusprofile_id?: string;
  type: string;
  value: string;
  label?: string;
  confidence?: number;
  status?: string;
  notes?: string;
  raw_file_path?: string;
  origin?: 'scraper' | 'manual' | 'import';
  overwriteManual?: boolean;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalized = normalize(entity.value);
  const origin = entity.origin || 'scraper';

  const existing = db.prepare(
    'SELECT id, origin FROM entities WHERE type = ? AND normalized_value = ?'
  ).get(entity.type, normalized) as { id: number; origin: string } | undefined;

  if (existing) {
    if (existing.origin === 'manual' && !entity.overwriteManual) {
      console.log(`[upsertEntity] Пропущена ручная сущность #${existing.id} (${entity.value})`);
      return existing.id;
    }

    db.prepare(`
      UPDATE entities SET
        rusprofile_id = COALESCE(?, rusprofile_id),
        value = ?,
        label = COALESCE(?, label),
        last_seen = ?,
        confidence = COALESCE(?, confidence),
        status = CASE WHEN ? IS NOT NULL THEN ? ELSE status END,
        notes = COALESCE(?, notes),
        raw_file_path = COALESCE(?, raw_file_path)
      WHERE id = ?
    `).run(
      entity.rusprofile_id || null,
      entity.value,
      entity.label || entity.value,
      now,
      entity.confidence ?? 50,
      entity.status || 'unverified',
      entity.status || 'unverified',
      entity.notes || null,
      entity.raw_file_path || null,
      existing.id
    );
    return existing.id;
  }

  const info = db.prepare(`
    INSERT INTO entities
      (rusprofile_id, type, value, normalized_value, label, first_seen, last_seen,
       confidence, status, notes, raw_file_path, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entity.rusprofile_id || null,
    entity.type,
    entity.value,
    normalized,
    entity.label || entity.value,
    now,
    now,
    entity.confidence ?? 50,
    entity.status || 'unverified',
    entity.notes || null,
    entity.raw_file_path || null,
    origin
  );
  return Number(info.lastInsertRowid);
}

export function updateEntity(
  entityId: number,
  patch: {
    type?: string;
    value?: string;
    label?: string | null;
    confidence?: number | null;
    status?: string | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as any;
  if (!old) {
    return { success: false, error: `Сущность #${entityId} не найдена` };
  }

  const type = patch.type ?? old.type;
  const value = patch.value ?? old.value;
  const label = patch.label !== undefined ? patch.label : old.label;
  const confidence = patch.confidence !== undefined ? patch.confidence : old.confidence;
  const status = patch.status !== undefined ? patch.status : old.status;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const normalized = normalize(value);
  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE entities
      SET type = ?,
          value = ?,
          normalized_value = ?,
          label = ?,
          last_seen = ?,
          confidence = ?,
          status = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(
      type,
      value,
      normalized,
      label,
      new Date().toISOString(),
      confidence,
      status,
      notes,
      newOrigin,
      entityId
    );
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'entities',
    entityId,
    'update',
    JSON.stringify(old),
    `type=${type}; value=${value}; status=${status}; confidence=${confidence}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование сущности через UI'
  );

  return { success: true };
}

/**
 * Удаляет сущность. По умолчанию — только если на неё нет ссылок.
 * Если force=true — каскадно удаляет её наблюдения и все связи, где она участвует,
 * затем саму сущность.
 */
export function deleteEntity(
  entityId: number,
  force = false
): { success: boolean; error?: string; stats?: { observations: number; relations: number } } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as any;
  if (!old) {
    return { success: false, error: `Сущность #${entityId} не найдена` };
  }

  const obsCount = (db.prepare('SELECT COUNT(*) AS c FROM observations WHERE entity_id = ?').get(entityId) as any).c;
  const relCount = (db.prepare('SELECT COUNT(*) AS c FROM relations WHERE subject_id = ? OR object_id = ?').get(entityId, entityId) as any).c;

  if ((obsCount > 0 || relCount > 0) && !force) {
    return {
      success: false,
      error: `На сущность ссылаются: ${obsCount} наблюдений, ${relCount} связей. Используйте force=true для каскадного удаления.`,
      stats: { observations: obsCount, relations: relCount },
    };
  }

  try {
    if (force) {
      db.prepare('DELETE FROM observations WHERE entity_id = ?').run(entityId);
      db.prepare('DELETE FROM relations WHERE subject_id = ? OR object_id = ?').run(entityId, entityId);
    }
    db.prepare('DELETE FROM entities WHERE id = ?').run(entityId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'entities',
    entityId,
    'delete',
    JSON.stringify(old),
    force ? `force=true; удалено наблюдений=${obsCount}, связей=${relCount}` : null,
    'Удаление сущности через UI'
  );

  return { success: true, stats: { observations: obsCount, relations: relCount } };
}

/**
 * Возвращает плоский список сущностей для dropdown'ов:
 * [{ id, type, label, value }]
 */
export function listEntitiesForDropdown(): Array<{
  id: number;
  type: string;
  label: string;
}> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, type, COALESCE(label, value) AS label
    FROM entities
    ORDER BY label COLLATE NOCASE ASC
  `).all() as Array<{ id: number; type: string; label: string }>;
  return rows;
}

/**
 * Поиск сущностей по подстроке в value / label / normalized_value / notes.
 * Опционально можно фильтровать по типу.
 */
export function searchEntities(
  query: string,
  type?: string,
  limit = 100,
  offset = 0
): any[] {
  const db = getDatabase();
  const normalizedQuery = `%${query.trim().toLowerCase()}%`;
  const rawQuery = `%${query.trim()}%`;

  if (type && type !== 'all') {
    return db.prepare(`
      SELECT id, type, value, label, confidence, status, first_seen, last_seen, notes
      FROM entities
      WHERE type = ?
        AND (value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?)
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?
    `).all(type, rawQuery, rawQuery, normalizedQuery, rawQuery, limit, offset) as unknown as any[];
  }

  return db.prepare(`
    SELECT id, type, value, label, confidence, status, first_seen, last_seen, notes
    FROM entities
    WHERE value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?
    ORDER BY last_seen DESC
    LIMIT ? OFFSET ?
  `).all(rawQuery, rawQuery, normalizedQuery, rawQuery, limit, offset) as unknown as any[];
}

export function markEntityAsManual(entityId: number): void {
  const db = getDatabase();
  db.prepare(`UPDATE entities SET origin = 'manual' WHERE id = ?`).run(entityId);
}