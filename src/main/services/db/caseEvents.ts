import { auditChange } from './audit';
import { getDatabase } from './connection';

export interface CaseEventInput {
  case_entity_id: number;
  event_uuid?: string | null;                // новое
  event_date: string;
  event_type: 'filing' | 'hearing' | 'decision' | 'ruling'
            | 'appeal' | 'cassation' | 'other';
  judge_entity_id?: number | null;
  court_entity_id?: number | null;
  result?: string | null;
  content?: string | null;
  document_url?: string | null;
  source_id?: number | null;
  origin?: 'scraper' | 'manual' | 'import';
  notes?: string | null;
}

export interface CaseEventRow {
  id: number;
  case_entity_id: number;
  event_uuid: string | null;        // новое
  event_date: string;
  event_type: string;
  judge_entity_id: number | null;
  court_entity_id: number | null;
  result: string | null;
  content: string | null;
  document_url: string | null;
  source_id: number | null;
  origin: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Добавляет событие дела с дедупликацией по
 * (case_entity_id, event_date, event_type).
 *
 * Логика:
 * - manual не перезаписывается скрапером;
 * - scraper обновляет существующее событие, но не перетирает
 *   заполненные поля NULL'ами (COALESCE);
 * - если не найдено — INSERT.
 */
export function addCaseEvent(input: CaseEventInput): {
  inserted: boolean;
  updated: boolean;
  id: number;
} {
  const db = getDatabase();
  const now = new Date().toISOString();
  const origin = input.origin || 'manual';
  const eventUuid = input.event_uuid?.trim() || null;

  // Дедуп: если event_uuid есть — по нему; иначе по (case, date, type, content)
  let existing: { id: number; origin: string } | undefined;

  if (eventUuid) {
    existing = db.prepare(`
      SELECT id, origin FROM case_events
      WHERE case_entity_id = ? AND event_uuid = ?
      LIMIT 1
    `).get(input.case_entity_id, eventUuid) as { id: number; origin: string } | undefined;
  }

  if (!existing) {
    existing = db.prepare(`
      SELECT id, origin FROM case_events
      WHERE case_entity_id = ?
        AND event_date = ?
        AND event_type = ?
        AND COALESCE(content, '') = COALESCE(?, '')
      LIMIT 1
    `).get(
      input.case_entity_id,
      input.event_date,
      input.event_type,
      input.content ?? null
    ) as { id: number; origin: string } | undefined;
  }

  if (existing) {
    if (existing.origin === 'manual' && origin !== 'manual') {
      return { inserted: false, updated: false, id: existing.id };
    }

    db.prepare(`
      UPDATE case_events
      SET event_uuid       = COALESCE(?, event_uuid),
          judge_entity_id  = COALESCE(?, judge_entity_id),
          court_entity_id  = COALESCE(?, court_entity_id),
          result           = COALESCE(?, result),
          content          = COALESCE(?, content),
          document_url     = COALESCE(?, document_url),
          source_id        = COALESCE(?, source_id),
          notes            = COALESCE(?, notes),
          origin           = ?,
          updated_at       = ?
      WHERE id = ?
    `).run(
      eventUuid,
      input.judge_entity_id ?? null,
      input.court_entity_id ?? null,
      input.result ?? null,
      input.content ?? null,
      input.document_url ?? null,
      input.source_id ?? null,
      input.notes ?? null,
      origin,
      now,
      existing.id
    );

    auditChange(
      'case_events',
      existing.id,
      'update',
      null,
      `uuid=${eventUuid ?? '-'}; date=${input.event_date}; type=${input.event_type}; origin=${origin}`,
      'Обновление события (scraper/import)'
    );

    return { inserted: false, updated: true, id: existing.id };
  }

  const info = db.prepare(`
    INSERT INTO case_events
      (case_entity_id, event_uuid, event_date, event_type,
       judge_entity_id, court_entity_id, result, content, document_url,
       source_id, origin, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.case_entity_id,
    eventUuid,
    input.event_date,
    input.event_type,
    input.judge_entity_id ?? null,
    input.court_entity_id ?? null,
    input.result ?? null,
    input.content ?? null,
    input.document_url ?? null,
    input.source_id ?? null,
    origin,
    input.notes ?? null,
    now,
    now
  );

  const id = Number(info.lastInsertRowid);
  auditChange(
    'case_events',
    id,
    'create',
    null,
    `case=${input.case_entity_id}; date=${input.event_date}; type=${input.event_type}; origin=${origin}`,
    'Добавление события'
  );

  return { inserted: true, updated: false, id };
}

export function listCaseEvents(caseEntityId: number): CaseEventRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT *
    FROM case_events
    WHERE case_entity_id = ?
    ORDER BY event_date ASC, id ASC
  `).all(caseEntityId) as unknown as CaseEventRow[];
}

/**
 * Обновляет событие. Всегда переводит origin в 'manual'.
 * Поля можно передать частично — остальные сохраняются.
 */
export function updateCaseEvent(
  id: number,
  patch: Partial<Omit<CaseEventInput, 'case_entity_id' | 'origin'>>
): { success: boolean; error?: string } {
  const db = getDatabase();
  const old = db.prepare('SELECT * FROM case_events WHERE id = ?').get(id) as any;
  if (!old) return { success: false, error: `Событие #${id} не найдено` };

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE case_events
    SET event_date       = COALESCE(?, event_date),
        event_type       = COALESCE(?, event_type),
        judge_entity_id  = COALESCE(?, judge_entity_id),
        court_entity_id  = COALESCE(?, court_entity_id),
        result           = COALESCE(?, result),
        content          = COALESCE(?, content),
        document_url     = COALESCE(?, document_url),
        source_id        = COALESCE(?, source_id),
        notes            = COALESCE(?, notes),
        origin           = 'manual',
        updated_at       = ?
    WHERE id = ?
  `).run(
    patch.event_date ?? null,
    patch.event_type ?? null,
    patch.judge_entity_id ?? null,
    patch.court_entity_id ?? null,
    patch.result ?? null,
    patch.content ?? null,
    patch.document_url ?? null,
    patch.source_id ?? null,
    patch.notes ?? null,
    now,
    id
  );

  auditChange(
    'case_events',
    id,
    'update',
    JSON.stringify(old),
    `origin→manual`,
    'Редактирование события через UI'
  );

  return { success: true };
}

export function deleteCaseEvent(id: number): { success: boolean; error?: string } {
  const db = getDatabase();
  const old = db.prepare('SELECT * FROM case_events WHERE id = ?').get(id) as any;
  if (!old) return { success: false, error: `Событие #${id} не найдено` };

  db.prepare('DELETE FROM case_events WHERE id = ?').run(id);

  auditChange(
    'case_events',
    id,
    'delete',
    JSON.stringify(old),
    null,
    'Удаление события через UI'
  );

  return { success: true };
}

export function countCaseEvents(caseEntityId: number): number {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT COUNT(*) AS c FROM case_events WHERE case_entity_id = ?'
  ).get(caseEntityId) as { c: number } | undefined;
  return row?.c ?? 0;
}