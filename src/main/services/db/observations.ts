import { auditChange } from './audit';
import { getDatabase } from './connection';

/**
 * Создаёт наблюдение вручную (origin='manual').
 */
export function createObservation(patch: {
  entity_id: number;
  attribute: string;
  value: string;
  source_id?: number | null;
  confidence?: number | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();

  if (!patch.entity_id) {
    return { success: false, error: 'Не выбрана сущность' };
  }
  if (!patch.attribute?.trim()) {
    return { success: false, error: 'Укажите атрибут' };
  }
  if (!patch.value?.trim()) {
    return { success: false, error: 'Укажите значение' };
  }

  try {
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO observations
        (entity_id, attribute, value, source_id,
         observed_at, confidence, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.entity_id,
      patch.attribute.trim(),
      patch.value.trim(),
      patch.source_id || null,
      now,
      patch.confidence ?? 50,
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'observations',
      id,
      'create',
      null,
      `entity=${patch.entity_id}; attribute=${patch.attribute}; value=${patch.value}; origin=manual`,
      'Ручное создание наблюдения через UI'
    );

    return { success: true, id };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return {
        success: false,
        error: 'Такое наблюдение уже существует (entity + attribute + value)',
      };
    }
    return { success: false, error: msg };
  }
}

export function updateObservation(
  observationId: number,
  patch: {
    attribute?: string;
    value?: string;
    confidence?: number | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM observations WHERE id = ?').get(observationId) as any;
  if (!old) {
    return { success: false, error: `Наблюдение #${observationId} не найдено` };
  }

  const attribute = patch.attribute ?? old.attribute;
  const value = patch.value ?? old.value;
  const confidence = patch.confidence !== undefined ? patch.confidence : old.confidence;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE observations
      SET attribute = ?,
          value = ?,
          confidence = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(attribute, value, confidence, notes, newOrigin, observationId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'observations',
    observationId,
    'update',
    JSON.stringify(old),
    `attribute=${attribute}; value=${value}; confidence=${confidence}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование наблюдения через UI'
  );

  return { success: true };
}

/**
 * Удаляет наблюдение. Никаких зависимостей, кроме самого наблюдения.
 */
export function deleteObservation(observationId: number): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM observations WHERE id = ?').get(observationId) as any;
  if (!old) {
    return { success: false, error: `Наблюдение #${observationId} не найдено` };
  }

  try {
    db.prepare('DELETE FROM observations WHERE id = ?').run(observationId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'observations',
    observationId,
    'delete',
    JSON.stringify(old),
    null,
    'Удаление наблюдения через UI'
  );

  return { success: true };
}

/**
 * Возвращает полную информацию о наблюдении, включая связанную сущность и источник.
 */
export function getObservationDetails(observationId: number): any | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT
      o.id,
      o.entity_id,
      o.attribute,
      o.value,
      o.source_id,
      o.observed_at,
      o.confidence,
      o.notes,
      o.raw_file_path,
      o.origin,
      e.type  AS entity_type,
      e.label AS entity_label,
      e.value AS entity_value,
      s.url           AS source_url,
      s.title         AS source_title,
      s.source_type   AS source_type,
      s.source_kind   AS source_kind,
      s.provider      AS source_provider,
      s.access_level  AS source_access_level,
      s.retrieved_at  AS source_retrieved_at
    FROM observations o
    JOIN entities e ON e.id = o.entity_id
    LEFT JOIN sources s ON s.id = o.source_id
    WHERE o.id = ?
  `).get(observationId) as any;

  return row ?? null;
}

export function addObservation(observation: {
  entity_id: number;
  attribute: string;
  value: string;
  source_id?: number;
  confidence?: number;
  notes?: string;
  raw_file_path?: string;
}): { inserted: boolean; id: number } {
  const db = getDatabase();

  // Guard: пустые attribute/value не пишем
  if (!observation.attribute?.trim() || !observation.value?.trim()) {
    console.warn(
      `[addObservation] Пропущены пустые attribute/value: entity=${observation.entity_id}`
    );
    return { inserted: false, id: 0 };
  }

  // 1. Проверить существующую запись
  const existing = db.prepare(`
    SELECT id FROM observations
    WHERE entity_id = ? AND attribute = ? AND value = ?
    LIMIT 1
  `).get(
    observation.entity_id,
    observation.attribute,
    observation.value
  ) as { id: number } | undefined;

  if (existing) {
    // Обновляем «видели ещё раз»: observed_at свежий, остальное — COALESCE
    db.prepare(`
      UPDATE observations
      SET observed_at = ?,
          source_id = COALESCE(source_id, ?),
          confidence = COALESCE(confidence, ?),
          raw_file_path = COALESCE(raw_file_path, ?)
      WHERE id = ?
    `).run(
      new Date().toISOString(),
      observation.source_id || null,
      observation.confidence ?? 50,
      observation.raw_file_path || null,
      existing.id
    );
    return { inserted: false, id: existing.id };
  }

  // 2. Вставить новую (с обработкой UNIQUE на случай TOCTOU)
  try {
    const info = db.prepare(`
      INSERT INTO observations
        (entity_id, attribute, value, source_id, observed_at, confidence, notes, raw_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      observation.entity_id,
      observation.attribute,
      observation.value,
      observation.source_id || null,
      new Date().toISOString(),
      observation.confidence ?? 50,
      observation.notes || null,
      observation.raw_file_path || null
    );
    return { inserted: true, id: Number(info.lastInsertRowid) };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      const again = db.prepare(`
        SELECT id FROM observations
        WHERE entity_id = ? AND attribute = ? AND value = ?
        LIMIT 1
      `).get(
        observation.entity_id,
        observation.attribute,
        observation.value
      ) as { id: number } | undefined;
      if (again) return { inserted: false, id: again.id };
    }
    throw e;
  }
}