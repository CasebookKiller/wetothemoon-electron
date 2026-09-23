import { auditChange } from './audit';
import { getDatabase } from './connection';

export interface JudgeRecord {
  id: number;
  judge_uuid: string;
  name: string;
  court_id: number | null;
  post: string | null;
  source_id: number | null;
}

export interface JudgeListRow {
  id: number;
  judge_uuid: string;
  name: string;
  post: string | null;
  court_id: number | null;
  court_tag: string | null;
  court_name: string | null;
  court_type: string | null;
  first_seen: string;
  last_seen: string;
}

export interface JudgeListFilters {
  search?: string;
  courtTag?: string | null;
  limit?: number;
  offset?: number;
}

export function upsertJudge(input: {
  judge_uuid: string;
  name: string;
  court_id?: number | null;
  post?: string | null;
  source_id?: number | null;
}): { id: number; inserted: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = db.prepare(
    'SELECT id FROM judges WHERE judge_uuid = ?'
  ).get(input.judge_uuid) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE judges
      SET name = ?,
          court_id = COALESCE(?, court_id),
          post = COALESCE(?, post),
          source_id = COALESCE(?, source_id),
          last_seen = ?
      WHERE id = ?
    `).run(
      input.name,
      input.court_id ?? null,
      input.post ?? null,
      input.source_id ?? null,
      now,
      existing.id
    );
    return { id: existing.id, inserted: false };
  }

  const info = db.prepare(`
    INSERT INTO judges
      (judge_uuid, name, court_id, post, source_id, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.judge_uuid,
    input.name,
    input.court_id ?? null,
    input.post ?? null,
    input.source_id ?? null,
    now,
    now
  );
  return { id: Number(info.lastInsertRowid), inserted: true };
}

export function getJudgeByUuid(uuid: string): JudgeRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM judges WHERE judge_uuid = ?').get(uuid) as unknown as JudgeRecord | undefined;
  return row ?? null;
}

export function getJudgeDetails(judgeId: number): any | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT j.*, c.court_tag, c.court_name, c.court_type
    FROM judges j
    LEFT JOIN courts c ON c.id = j.court_id
    WHERE j.id = ?
  `).get(judgeId) as any;
  return row ?? null;
}

export function countJudges(): number {
  const db = getDatabase();
  return (db.prepare('SELECT COUNT(*) AS c FROM judges').get() as any).c;
}

export function listJudges(filters: JudgeListFilters = {}): {
  items: JudgeListRow[];
  total: number;
} {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.search && filters.search.trim()) {
    conditions.push('LOWER(j.name) LIKE ?');
    params.push(`%${filters.search.trim().toLowerCase()}%`);
  }
  if (filters.courtTag) {
    conditions.push('c.court_tag = ?');
    params.push(filters.courtTag);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const total = (db.prepare(`
    SELECT COUNT(*) AS c
    FROM judges j
    LEFT JOIN courts c ON c.id = j.court_id
    ${where}
  `).get(...params) as any).c;

  const items = db.prepare(`
    SELECT
      j.id, j.judge_uuid, j.name, j.post, j.court_id,
      j.first_seen, j.last_seen,
      c.court_tag, c.court_name, c.court_type
    FROM judges j
    LEFT JOIN courts c ON c.id = j.court_id
    ${where}
    ORDER BY j.name COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as unknown as JudgeListRow[];

  return { items, total };
}

export function deleteJudge(judgeId: number): { success: boolean; error?: string } {
  const db = getDatabase();
  const old = db.prepare('SELECT * FROM judges WHERE id = ?').get(judgeId) as any;
  if (!old) {
    return { success: false, error: `Судья #${judgeId} не найден` };
  }
  try {
    db.prepare('DELETE FROM judges WHERE id = ?').run(judgeId);
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
  auditChange(
    'judges',
    judgeId,
    'delete',
    JSON.stringify(old),
    null,
    'Удаление судьи из справочника через UI'
  );
  return { success: true };
}