import { getDatabase } from './connection';

export type SearchHitKind = 'entity' | 'relation' | 'observation' | 'source';

export interface SearchHit {
  kind: SearchHitKind;
  id: number;
  title: string;
  subtitle: string;
  matched_field: string;
  matched_value: string;
}

export interface SearchAllResult {
  items: SearchHit[];
  total: number;
  counts: Record<SearchHitKind, number>;
  /** Прямые совпадения (то, что реально нашлось по LIKE). */
  matchedIds: {
    entities: number[];
    relations: number[];
    observations: number[];
    sources: number[];
  };
  /** Финальный union: matchedIds ∪ всё связанное с найденными сущностями.
   *  Именно это множество показывается в таблицах UI. */
  unionIds: {
    entities: number[];
    relations: number[];
    observations: number[];
    sources: number[];
  };
}

/**
 * Полнотекстовый поиск (LIKE) по четырём таблицам одновременно.
 * Возвращает плоский список «хитов» с указанием, в каком поле нашлось.
 * Без FTS5 — на текущем масштабе LIKE работает мгновенно.
 */
export function searchAll(
  query: string,
  kinds: SearchHitKind[] = ['entity', 'relation', 'observation', 'source'],
  limit = 100,
  offset = 0
): SearchAllResult {
  const db = getDatabase();
  const q = (query || '').trim();
    const empty: SearchAllResult = {
    items: [],
    total: 0,
    counts: { entity: 0, relation: 0, observation: 0, source: 0 },
    matchedIds: { entities: [], relations: [], observations: [], sources: [] },
    unionIds:   { entities: [], relations: [], observations: [], sources: [] },
  };
  if (!q) return empty;

  const like = `%${q}%`;
  const lowerQ = q.toLowerCase();
  const items: SearchHit[] = [];
  const counts: Record<SearchHitKind, number> = {
    entity: 0, relation: 0, observation: 0, source: 0,
  };

  const matchedEntityIds = new Set<number>();
  const matchedRelationIds = new Set<number>();
  const matchedObservationIds = new Set<number>();
  const matchedSourceIds = new Set<number>();

  const pickMatch = (
    fields: Array<[string, string | null]>
  ): { field: string; value: string } => {
    for (const [name, v] of fields) {
      if (v && String(v).toLowerCase().includes(lowerQ)) {
        return { field: name, value: String(v) };
      }
    }
    // fallback — первое непустое поле
    for (const [name, v] of fields) {
      if (v) return { field: name, value: String(v) };
    }
    return { field: fields[0][0], value: '' };
  };

  // ===== ENTITIES =====
  if (kinds.includes('entity')) {
    counts.entity = (db.prepare(`
      SELECT COUNT(*) AS c FROM entities
      WHERE value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?
    `).get(like, like, like, like) as any).c;

    if (counts.entity > 0) {
      const rows = db.prepare(`
        SELECT id, type, value, label, notes
        FROM entities
        WHERE value LIKE ? OR label LIKE ? OR normalized_value LIKE ? OR notes LIKE ?
        ORDER BY last_seen DESC
        LIMIT ?
      `).all(like, like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedEntityIds.add(r.id);
        const m = pickMatch([
          ['value', r.value], ['label', r.label], ['notes', r.notes],
        ]);
        items.push({
          kind: 'entity',
          id: r.id,
          title: r.label || r.value || `#${r.id}`,
          subtitle: `сущность · ${r.type}`,
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

  // ===== RELATIONS =====
  if (kinds.includes('relation')) {
    counts.relation = (db.prepare(`
      SELECT COUNT(*) AS c
      FROM relations r
      LEFT JOIN entities v ON v.id = r.via_entity_id
      WHERE r.predicate LIKE ? OR r.evidence_text LIKE ? OR r.notes LIKE ?
         OR v.label LIKE ? OR v.value LIKE ?
    `).get(like, like, like, like, like) as any).c;

    if (counts.relation > 0) {
      const rows = db.prepare(`
        SELECT r.id, r.predicate, r.evidence_text, r.notes,
               r.via_entity_id,
               s.label AS subject_label, s.value AS subject_value,
               o.label AS object_label, o.value AS object_value,
               v.label AS via_label, v.value AS via_value
        FROM relations r
        JOIN entities s ON s.id = r.subject_id
        JOIN entities o ON o.id = r.object_id
        LEFT JOIN entities v ON v.id = r.via_entity_id
        WHERE r.predicate LIKE ? OR r.evidence_text LIKE ? OR r.notes LIKE ?
           OR v.label LIKE ? OR v.value LIKE ?
        ORDER BY r.id DESC
        LIMIT ?
      `).all(like, like, like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedRelationIds.add(r.id);
        const m = pickMatch([
          ['predicate', r.predicate],
          ['evidence_text', r.evidence_text],
          ['notes', r.notes],
          ['via', r.via_label || r.via_value],
        ]);
        const subj = r.subject_label || r.subject_value || '?';
        const obj = r.object_label || r.object_value || '?';
        const viaLabel = r.via_label || r.via_value;
        const viaSuffix = viaLabel ? ` [${viaLabel}]` : '';
        items.push({
          kind: 'relation',
          id: r.id,
          title: `${subj} —${r.predicate}→ ${obj}${viaSuffix}`,
          subtitle: 'связь',
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

  // ===== OBSERVATIONS =====
  if (kinds.includes('observation')) {
    counts.observation = (db.prepare(`
      SELECT COUNT(*) AS c FROM observations
      WHERE attribute LIKE ? OR value LIKE ? OR notes LIKE ?
    `).get(like, like, like) as any).c;

    if (counts.observation > 0) {
      const rows = db.prepare(`
        SELECT o.id, o.attribute, o.value, o.notes, e.label AS entity_label
        FROM observations o
        JOIN entities e ON e.id = o.entity_id
        WHERE o.attribute LIKE ? OR o.value LIKE ? OR o.notes LIKE ?
        ORDER BY o.id DESC
        LIMIT ?
      `).all(like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedObservationIds.add(r.id);
        const m = pickMatch([
          ['attribute', r.attribute], ['value', r.value], ['notes', r.notes],
        ]);
        items.push({
          kind: 'observation',
          id: r.id,
          title: `${r.entity_label || '?'} · ${r.attribute} = ${r.value}`,
          subtitle: 'наблюдение',
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

  // ===== SOURCES =====
  if (kinds.includes('source')) {
    counts.source = (db.prepare(`
      SELECT COUNT(*) AS c FROM sources
      WHERE url LIKE ? OR title LIKE ? OR provider LIKE ?
         OR authority_basis LIKE ? OR notes LIKE ?
    `).get(like, like, like, like, like) as any).c;

    if (counts.source > 0) {
      const rows = db.prepare(`
        SELECT id, url, title, provider, authority_basis, notes
        FROM sources
        WHERE url LIKE ? OR title LIKE ? OR provider LIKE ?
           OR authority_basis LIKE ? OR notes LIKE ?
        ORDER BY id DESC
        LIMIT ?
      `).all(like, like, like, like, like, limit + offset) as any[];
      for (const r of rows) {
        matchedSourceIds.add(r.id);
        const m = pickMatch([
          ['url', r.url], ['title', r.title], ['provider', r.provider],
          ['authority_basis', r.authority_basis], ['notes', r.notes],
        ]);
        items.push({
          kind: 'source',
          id: r.id,
          title: r.title || r.url || `#${r.id}`,
          subtitle: 'источник',
          matched_field: m.field,
          matched_value: m.value,
        });
      }
    }
  }

    // ===== Расширение через связи: matched ∪ related =====
  const relatedEntityIds = new Set<number>();
  const relatedRelationIds = new Set<number>();
  const relatedObservationIds = new Set<number>();
  const relatedSourceIds = new Set<number>();

  // Если нашли сущности — подтянем их связи, наблюдения и источники
  if (matchedEntityIds.size > 0) {
    const ids = [...matchedEntityIds];
    const ph = ids.map(() => '?').join(',');

    // Связи, где найденная сущность — subject, object или контекст (via)
    const relRows = db.prepare(`
      SELECT id, subject_id, object_id, via_entity_id, source_id
      FROM relations
      WHERE subject_id IN (${ph})
         OR object_id IN (${ph})
         OR via_entity_id IN (${ph})
    `).all(...ids, ...ids, ...ids) as any[];
    for (const r of relRows) {
      relatedRelationIds.add(r.id);
      relatedEntityIds.add(r.subject_id);
      relatedEntityIds.add(r.object_id);
      if (r.via_entity_id) relatedEntityIds.add(r.via_entity_id);
      if (r.source_id) relatedSourceIds.add(r.source_id);
    }

    // Наблюдения найденных сущностей
    const obsRows = db.prepare(`
      SELECT id, source_id FROM observations WHERE entity_id IN (${ph})
    `).all(...ids) as any[];
    for (const o of obsRows) {
      relatedObservationIds.add(o.id);
      if (o.source_id) relatedSourceIds.add(o.source_id);
    }
  }

  // Если нашли связи — добавим их участников и источники
  if (matchedRelationIds.size > 0) {
    const ids = [...matchedRelationIds];
    const ph = ids.map(() => '?').join(',');
    const relRows = db.prepare(`
      SELECT subject_id, object_id, via_entity_id, source_id
      FROM relations WHERE id IN (${ph})
    `).all(...ids) as any[];
    for (const r of relRows) {
      relatedEntityIds.add(r.subject_id);
      relatedEntityIds.add(r.object_id);
      if (r.via_entity_id) relatedEntityIds.add(r.via_entity_id);
      if (r.source_id) relatedSourceIds.add(r.source_id);
    }
  }

  // Если нашли наблюдения — добавим их сущности и источники
  if (matchedObservationIds.size > 0) {
    const ids = [...matchedObservationIds];
    const ph = ids.map(() => '?').join(',');
    const obsRows = db.prepare(`
      SELECT entity_id, source_id FROM observations WHERE id IN (${ph})
    `).all(...ids) as any[];
    for (const o of obsRows) {
      relatedEntityIds.add(o.entity_id);
      if (o.source_id) relatedSourceIds.add(o.source_id);
    }
  }

  const unionEntities = [...new Set([...matchedEntityIds, ...relatedEntityIds])];
  const unionRelations = [...new Set([...matchedRelationIds, ...relatedRelationIds])];
  const unionObservations = [...new Set([...matchedObservationIds, ...relatedObservationIds])];
  const unionSources = [...new Set([...matchedSourceIds, ...relatedSourceIds])];

  const total = counts.entity + counts.relation + counts.observation + counts.source;
  const paginated = items.slice(offset, offset + limit);

    return {
    items: paginated,
    total,
    counts,
    matchedIds: {
      entities: [...matchedEntityIds],
      relations: [...matchedRelationIds],
      observations: [...matchedObservationIds],
      sources: [...matchedSourceIds],
    },
    unionIds: {
      entities: unionEntities,
      relations: unionRelations,
      observations: unionObservations,
      sources: unionSources,
    },
  };
}