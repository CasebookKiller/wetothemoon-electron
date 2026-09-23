import { auditChange } from './audit';
import { getDatabase } from './connection';

/**
 * Создаёт источник вручную (origin='manual').
 */
export function createSource(patch: {
  url: string;
  title?: string | null;
  source_type?: string | null;
  source_kind?: string | null;
  provider?: string | null;
  collection_method?: string | null;
  authority_basis?: string | null;
  reliability?: number | null;
  access_level?: string | null;
  notes?: string | null;
}): { success: boolean; id?: number; error?: string } {
  const db = getDatabase();

  if (!patch.url?.trim()) {
    return { success: false, error: 'Укажите URL или локальный путь' };
  }

  try {
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO sources
        (url, title, source_type, source_kind, provider,
         collection_method, authority_basis, reliability,
         access_level, retrieved_at, notes, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      patch.url.trim(),
      patch.title || null,
      patch.source_type || null,
      patch.source_kind || null,
      patch.provider || null,
      patch.collection_method || null,
      patch.authority_basis || null,
      patch.reliability ?? 50,
      patch.access_level || 'public',
      now,
      patch.notes || null
    );

    const id = Number(info.lastInsertRowid);

    auditChange(
      'sources',
      id,
      'create',
      null,
      `url=${patch.url}; origin=manual`,
      'Ручное создание источника через UI'
    );

    return { success: true, id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function addSource(source: {
  url: string;
  title?: string;
  source_type?: string;
  source_kind?: string;
  provider?: string;
  collection_method?: string;
  authority_basis?: string;
  reliability?: number;
  access_level?: string;
  retrieved_at?: string;
  local_path?: string;
  sha256?: string;
  notes?: string;
}): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO sources (url, title, source_type, source_kind, provider, collection_method,
      authority_basis, reliability, access_level, retrieved_at, local_path, sha256, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    source.url,
    source.title || null,
    source.source_type || null,
    source.source_kind || null,
    source.provider || null,
    source.collection_method || null,
    source.authority_basis || null,
    source.reliability ?? 50,
    source.access_level || 'public',
    source.retrieved_at || new Date().toISOString(),
    source.local_path || null,
    source.sha256 || null,
    source.notes || null
  );

  return Number(info.lastInsertRowid);
}

export function updateSource(
  sourceId: number,
  patch: {
    url?: string;
    title?: string | null;
    source_type?: string | null;
    source_kind?: string | null;
    provider?: string | null;
    collection_method?: string | null;
    authority_basis?: string | null;
    reliability?: number | null;
    access_level?: string | null;
    notes?: string | null;
  }
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as any;
  if (!old) {
    return { success: false, error: `Источник #${sourceId} не найден` };
  }

  const url = patch.url ?? old.url;
  const title = patch.title !== undefined ? patch.title : old.title;
  const source_type = patch.source_type !== undefined ? patch.source_type : old.source_type;
  const source_kind = patch.source_kind !== undefined ? patch.source_kind : old.source_kind;
  const provider = patch.provider !== undefined ? patch.provider : old.provider;
  const collection_method = patch.collection_method !== undefined ? patch.collection_method : old.collection_method;
  const authority_basis = patch.authority_basis !== undefined ? patch.authority_basis : old.authority_basis;
  const reliability = patch.reliability !== undefined ? patch.reliability : old.reliability;
  const access_level = patch.access_level !== undefined ? patch.access_level : old.access_level;
  const notes = patch.notes !== undefined ? patch.notes : old.notes;

  const oldOrigin = old.origin || 'scraper';
  const newOrigin = 'manual';

  try {
    db.prepare(`
      UPDATE sources
      SET url = ?,
          title = ?,
          source_type = ?,
          source_kind = ?,
          provider = ?,
          collection_method = ?,
          authority_basis = ?,
          reliability = ?,
          access_level = ?,
          notes = ?,
          origin = ?
      WHERE id = ?
    `).run(
      url, title, source_type, source_kind, provider,
      collection_method, authority_basis, reliability, access_level,
      notes, newOrigin, sourceId
    );
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'sources',
    sourceId,
    'update',
    JSON.stringify(old),
    `url=${url}; reliability=${reliability}; access_level=${access_level}; origin=${oldOrigin}→${newOrigin}`,
    'Редактирование источника через UI'
  );

  return { success: true };
}

/**
 * Удаляет источник. Если на него ссылаются наблюдения/связи — по умолчанию
 * операция блокируется (чтобы не терять данные).
 * Если force=true — ссылки обнуляются (source_id = NULL), затем источник удаляется.
 */
export function deleteSource(
  sourceId: number,
  force = false
): { success: boolean; error?: string } {
  const db = getDatabase();

  const old = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as any;
  if (!old) {
    return { success: false, error: `Источник #${sourceId} не найден` };
  }

  const obsCount = (db.prepare('SELECT COUNT(*) AS c FROM observations WHERE source_id = ?').get(sourceId) as any).c;
  const relCount = (db.prepare('SELECT COUNT(*) AS c FROM relations WHERE source_id = ?').get(sourceId) as any).c;

  if ((obsCount > 0 || relCount > 0) && !force) {
    return {
      success: false,
      error: `Источник используется: ${obsCount} наблюдений, ${relCount} связей. Используйте force=true или сначала отвяжите записи.`,
    };
  }

  try {
    if (force) {
      db.prepare('UPDATE observations SET source_id = NULL WHERE source_id = ?').run(sourceId);
      db.prepare('UPDATE relations SET source_id = NULL WHERE source_id = ?').run(sourceId);
    }
    db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }

  auditChange(
    'sources',
    sourceId,
    'delete',
    JSON.stringify(old),
    force ? `force=true; отвязано наблюдений=${obsCount}, связей=${relCount}` : null,
    'Удаление источника через UI'
  );

  return { success: true };
}

/**
 * Возвращает полную информацию об источнике: поля + связанные наблюдения, связи и сущности.
 */
export function getSourceDetails(sourceId: number): any | null {
  const db = getDatabase();

  const source = db.prepare(`
    SELECT id, url, title, source_type, source_kind, provider, collection_method,
           authority_basis, reliability, access_level, retrieved_at,
           local_path, sha256, notes, origin
    FROM sources
    WHERE id = ?
  `).get(sourceId) as any;

  if (!source) return null;

  const observations = db.prepare(`
    SELECT o.id, o.attribute, o.value, o.confidence, o.observed_at, o.origin,
           e.id AS entity_id, e.label AS entity_label, e.type AS entity_type
    FROM observations o
    JOIN entities e ON e.id = o.entity_id
    WHERE o.source_id = ?
    ORDER BY o.id DESC
  `).all(sourceId) as any[];

  const relations = db.prepare(`
    SELECT r.id, r.predicate, r.confidence, r.status, r.evidence_text,
           r.valid_from, r.valid_to, r.origin,
           s.id AS subject_id, s.label AS subject_label, s.type AS subject_type,
           o.id AS object_id,  o.label AS object_label,  o.type AS object_type
    FROM relations r
    JOIN entities s ON s.id = r.subject_id
    JOIN entities o ON o.id = r.object_id
    WHERE r.source_id = ?
    ORDER BY r.id DESC
  `).all(sourceId) as any[];

  const entities = db.prepare(`
    SELECT DISTINCT e.id, e.type, e.label, e.value, e.origin
    FROM entities e
    WHERE e.id IN (
      SELECT entity_id FROM observations WHERE source_id = ?
      UNION
      SELECT subject_id FROM relations WHERE source_id = ?
      UNION
      SELECT object_id FROM relations WHERE source_id = ?
    )
    ORDER BY e.id DESC
  `).all(sourceId, sourceId, sourceId) as any[];

  return {
    source,
    observations,
    relations,
    entities,
  };
}