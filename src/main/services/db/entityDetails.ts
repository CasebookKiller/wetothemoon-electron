import { getDatabase } from './connection';

export interface RelatedIds {
  entityIds: number[];
  relationIds: number[];
  observationIds: number[];
  sourceIds: number[];
}

/**
 * Возвращает полную информацию о сущности: поля, наблюдения, связи (в обе стороны), источники.
 */
export function getEntityDetails(entityId: number): any | null {
  const db = getDatabase();

  const entity = db.prepare(`
    SELECT id, type, value, normalized_value, label, confidence, status,
           first_seen, last_seen, notes, rusprofile_id, raw_file_path, origin
    FROM entities
    WHERE id = ?
  `).get(entityId) as any;

  if (!entity) return null;

  const observations = db.prepare(`
    SELECT o.id, o.attribute, o.value, o.confidence, o.observed_at, o.notes,
           o.source_id, o.origin,
           s.url AS source_url, s.title AS source_title, s.provider AS source_provider
    FROM observations o
    LEFT JOIN sources s ON s.id = o.source_id
    WHERE o.entity_id = ?
    ORDER BY o.id DESC
  `).all(entityId) as any[];

  const relationsOut = db.prepare(`
    SELECT r.id, r.predicate, r.confidence, r.status, r.evidence_text,
           r.valid_from, r.valid_to, r.source_id, r.origin,
           e.id AS object_id, e.label AS object_label, e.type AS object_type,
           s.url AS source_url, s.title AS source_title
    FROM relations r
    JOIN entities e ON e.id = r.object_id
    LEFT JOIN sources s ON s.id = r.source_id
    WHERE r.subject_id = ?
    ORDER BY r.id DESC
  `).all(entityId) as any[];

  const relationsIn = db.prepare(`
    SELECT r.id, r.predicate, r.confidence, r.status, r.evidence_text,
           r.valid_from, r.valid_to, r.source_id, r.origin,
           e.id AS subject_id, e.label AS subject_label, e.type AS subject_type,
           s.url AS source_url, s.title AS source_title
    FROM relations r
    JOIN entities e ON e.id = r.subject_id
    LEFT JOIN sources s ON s.id = r.source_id
    WHERE r.object_id = ?
    ORDER BY r.id DESC
  `).all(entityId) as any[];

  const sources = db.prepare(`
    SELECT DISTINCT s.id, s.url, s.title, s.source_type, s.provider,
           s.access_level, s.retrieved_at, s.origin
    FROM sources s
    WHERE s.id IN (
      SELECT source_id FROM observations WHERE entity_id = ? AND source_id IS NOT NULL
      UNION
      SELECT source_id FROM relations WHERE (subject_id = ? OR object_id = ?) AND source_id IS NOT NULL
    )
    ORDER BY s.id DESC
  `).all(entityId, entityId, entityId) as any[];

  return {
    entity,
    observations,
    relations_out: relationsOut,
    relations_in: relationsIn,
    sources,
  };
}

/**
 * Возвращает ID связанных записей для каскадного фильтра.
 * Например, если filterType='entity' и filterId=69, то вернёт:
 * - entityIds: [69] + все сущности, с которыми #69 связана через relations
 * - relationIds: все связи, где #69 — subject или object
 * - observationIds: все наблюдения сущности #69
 * - sourceIds: все источники, упомянутые в этих связях и наблюдениях
 */
export function getRelatedIds(
  filterType: 'entity' | 'relation' | 'observation' | 'source',
  filterId: number
): RelatedIds {
  const db = getDatabase();
  const entityIds = new Set<number>();
  const relationIds = new Set<number>();
  const observationIds = new Set<number>();
  const sourceIds = new Set<number>();

  const loadObservationsByEntities = (ids: number[]) => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`SELECT id, source_id FROM observations WHERE entity_id IN (${placeholders})`)
      .all(...ids)
      .forEach((o: any) => {
        observationIds.add(o.id);
        if (o.source_id) sourceIds.add(o.source_id);
      });
  };

  const loadRelationsByEntities = (ids: number[]) => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`SELECT id, subject_id, object_id, source_id FROM relations
                WHERE subject_id IN (${placeholders}) OR object_id IN (${placeholders})`)
      .all(...ids, ...ids)
      .forEach((r: any) => {
        relationIds.add(r.id);
        entityIds.add(r.subject_id);
        entityIds.add(r.object_id);
        if (r.source_id) sourceIds.add(r.source_id);
      });
  };

  const loadRelationsBySource = (sourceId: number) => {
    db.prepare(`SELECT id, subject_id, object_id FROM relations WHERE source_id = ?`)
      .all(sourceId)
      .forEach((r: any) => {
        relationIds.add(r.id);
        entityIds.add(r.subject_id);
        entityIds.add(r.object_id);
      });
  };

  if (filterType === 'entity') {
    entityIds.add(filterId);
    loadRelationsByEntities([filterId]);
    loadObservationsByEntities([filterId]);
  }

  if (filterType === 'relation') {
    relationIds.add(filterId);
    const rel = db.prepare(`SELECT subject_id, object_id, source_id FROM relations WHERE id = ?`).get(filterId) as any;
    if (rel) {
      entityIds.add(rel.subject_id);
      entityIds.add(rel.object_id);
      loadRelationsByEntities([rel.subject_id, rel.object_id]);
      loadObservationsByEntities([rel.subject_id, rel.object_id]);
      if (rel.source_id) sourceIds.add(rel.source_id);
    }
  }

  if (filterType === 'observation') {
    observationIds.add(filterId);
    const obs = db.prepare(`SELECT entity_id, source_id FROM observations WHERE id = ?`).get(filterId) as any;
    if (obs) {
      entityIds.add(obs.entity_id);
      loadRelationsByEntities([obs.entity_id]);
      loadObservationsByEntities([obs.entity_id]);
      if (obs.source_id) sourceIds.add(obs.source_id);
    }
  }

  if (filterType === 'source') {
    sourceIds.add(filterId);
    db.prepare(`SELECT id, entity_id FROM observations WHERE source_id = ?`)
      .all(filterId)
      .forEach((o: any) => {
        observationIds.add(o.id);
        entityIds.add(o.entity_id);
      });
    loadRelationsBySource(filterId);
    // Подтянем также наблюдения связанных сущностей, чтобы картина была полной
    loadObservationsByEntities([...entityIds]);
  }

  return {
    entityIds: [...entityIds],
    relationIds: [...relationIds],
    observationIds: [...observationIds],
    sourceIds: [...sourceIds],
  };
}