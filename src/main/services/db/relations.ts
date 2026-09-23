import { auditChange } from './audit';
import { getDatabase } from './connection';

/**
 * Создаёт связь вручную (origin='manual').
 */
export function createRelation(patch: {
  subject_id: number;
  predicate: string;
  object_id: number;
  source_id?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  evidence_text?: string | null;
  confidence?: number | null;
  status?: string | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();

  if (!patch.subject_id || !patch.object_id) {
    return { success: false, error: 'Не выбраны участники связи' };
  }
  if (patch.subject_id === patch.object_id) {
    return { success: false, error: 'Исходная и целевая сущности не могут совпадать' };
  }
  if (!patch.predicate?.trim()) {
    return { success: false, error: 'Укажите тип связи (predicate)' };
  }

  try {
    const info = db.prepare(`
      INSERT INTO relations
        (subject_id, predicate, object_id, source_id,
         valid_from, valid_to, evidence_text,
         confidence, status, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.subject_id,
      patch.predicate.trim(),
      patch.object_id,
      patch.source_id || null,
      patch.valid_from || null,
      patch.valid_to || null,
      patch.evidence_text || null,
      patch.confidence ?? 50,
      patch.status || 'unverified',
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'relations',
      id,
      'create',
      null,
      `subject=${patch.subject_id}; predicate=${patch.predicate}; object=${patch.object_id}; origin=manual`,
      'Ручное создание связи через UI'
    );

    return { success: true, id };
  } catch (e) {
    // ← ИЗМЕНЕНО: распознаём UNIQUE-конфликт (сработает ux_relations_triple)
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      return {
        success: false,
        error: 'Такая связь уже существует (subject + predicate + object)',
      };
    }
    return { success: false, error: msg };
  }
}

export function addRelation(relation: {
  subject_id: number;
  predicate: string;
  object_id: number;
  source_id?: number;
  valid_from?: string;
  valid_to?: string;
  evidence_text?: string;
  confidence?: number;
  status?: string;
  notes?: string;
  raw_file_path?: string;
}): { inserted: boolean; id?: number } {
  const db = getDatabase();

  // 1. Не создавать self-loop
  if (relation.subject_id === relation.object_id) {
    console.warn(
      `[addRelation] Пропущена самосвязь: entity #${relation.subject_id} --${relation.predicate}--> сама себя`
    );
    return { inserted: false };
  }

  // ← ИЗМЕНЕНО: guard на пустой predicate
  if (!relation.predicate?.trim()) {
    console.warn('[addRelation] Пустой predicate — запись пропущена');
    return { inserted: false };
  }

  // 2. Проверить дубликат
  const existing = db.prepare(`
    SELECT id FROM relations
    WHERE subject_id = ?
      AND predicate = ?
      AND object_id = ?
    LIMIT 1
  `).get(relation.subject_id, relation.predicate, relation.object_id) as { id: number } | undefined;

  if (existing) {
    // Обновить confidence/source, если они не заданы у существующей
    db.prepare(`
      UPDATE relations
      SET source_id = COALESCE(source_id, ?),
          evidence_text = COALESCE(evidence_text, ?),
          confidence = CASE WHEN confidence IS NULL THEN ? ELSE confidence END,
          raw_file_path = COALESCE(raw_file_path, ?)
      WHERE id = ?
    `).run(
      relation.source_id || null,
      relation.evidence_text || null,
      relation.confidence ?? 50,
      relation.raw_file_path || null,
      existing.id
    );
    return { inserted: false, id: existing.id };
  }

  // 3. Вставить новую
  // ← ИЗМЕНЕНО: оборачиваем в try/catch и обрабатываем UNIQUE-конфликт
  // (теоретическое TOCTOU-окно между SELECT и INSERT; node:sqlite
  //  синхронный, но подстраховаться не вредно — плюс общий UNIQUE-индекс).
  try {
    const info = db.prepare(`
      INSERT INTO relations
        (subject_id, predicate, object_id, source_id, valid_from, valid_to,
         evidence_text, confidence, status, notes, raw_file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      relation.subject_id,
      relation.predicate,
      relation.object_id,
      relation.source_id || null,
      relation.valid_from || null,
      relation.valid_to || null,
      relation.evidence_text || null,
      relation.confidence ?? 50,
      relation.status || 'unverified',
      relation.notes || null,
      relation.raw_file_path || null
    );

    return { inserted: true, id: Number(info.lastInsertRowid) };
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.includes('UNIQUE') || msg.includes('constraint')) {
      // Кто-то успел вставить между SELECT и INSERT — вернём существующий id
      const again = db.prepare(`
        SELECT id FROM relations
        WHERE subject_id = ? AND predicate = ? AND object_id = ?
        LIMIT 1
      `).get(relation.subject_id, relation.predicate, relation.object_id) as
        | { id: number }
        | undefined;
      if (again) return { inserted: false, id: again.id };
    }
    throw e;
  }
}

export function updateRelation(
  relationId: number,
  patch: {
    predicate?: string;
    confidence?: number | null;
    status?: string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    evidence_text?: string | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM relations WHERE id = ?').get(relationId) as any;
  if (!old) {
    return { success: false, error: `Связь #${relationId} не найдена` };
  }

  const predicate = patch.predicate ?? old.predicate;
  const confidence = patch.confidence !== undefined ? patch.confidence : old.confidence;
  const status = patch.status !== undefined ? patch.status : old.status;
  const valid_from = patch.valid_from !== undefined ? patch.valid_from : old.valid_from;
  const valid_to = patch.valid_to !== undefined ? patch.valid_to : old.valid_to;
  const evidence_text = patch.evidence_text !== undefined ? patch.evidence_text : old.evidence_text;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE relations
      SET predicate = ?,
          confidence = ?,
          status = ?,
          valid_from = ?,
          valid_to = ?,
          evidence_text = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(
      predicate,
      confidence,
      status,
      valid_from,
      valid_to,
      evidence_text,
      notes,
      newOrigin,
      relationId
    );
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'relations',
    relationId,
    'update',
    JSON.stringify(old),
    `predicate=${predicate}; status=${status}; confidence=${confidence}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование связи через UI'
  );

  return { success: true };
}

/**
 * Удаляет связь.
 */
export function deleteRelation(relationId: number): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM relations WHERE id = ?').get(relationId) as any;
  if (!old) {
    return { success: false, error: `Связь #${relationId} не найдена` };
  }

  try {
    db.prepare('DELETE FROM relations WHERE id = ?').run(relationId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'relations',
    relationId,
    'delete',
    JSON.stringify(old),
    null,
    'Удаление связи через UI'
  );

  return { success: true };
}

/**
 * Возвращает полную информацию о связи, включая subject/object и источник.
 */
export function getRelationDetails(relationId: number): any | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      r.id,
      r.predicate,
      r.confidence,
      r.status,
      r.valid_from,
      r.valid_to,
      r.evidence_text,
      r.notes,
      r.raw_file_path,
      r.origin,
      r.subject_id,
      r.object_id,
      r.source_id,
      s.label AS subject_label,
      s.type  AS subject_type,
      s.value AS subject_value,
      o.label AS object_label,
      o.type  AS object_type,
      o.value AS object_value,
      src.url          AS source_url,
      src.title        AS source_title,
      src.source_type  AS source_type,
      src.provider     AS source_provider,
      src.access_level AS source_access_level,
      src.retrieved_at AS source_retrieved_at
    FROM relations r
    JOIN entities s ON s.id = r.subject_id
    JOIN entities o ON o.id = r.object_id
    LEFT JOIN sources src ON src.id = r.source_id
    WHERE r.id = ?
  `).get(relationId) as any;

  return row ?? null;
}