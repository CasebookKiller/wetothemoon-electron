import { getDatabase } from './connection';

export interface CourtRecord {
  id: number;
  court_tag: string;
  court_name: string;
  court_type: string;
  region: string | null;
  source_id: number | null;
}

export function upsertCourt(input: {
  court_tag: string;
  court_name: string;
  court_type?: string;
  region?: string | null;
  source_id?: number | null;
}): { id: number; inserted: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = db.prepare(
    'SELECT id FROM courts WHERE court_tag = ?'
  ).get(input.court_tag) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE courts
      SET court_name = ?,
          court_type = COALESCE(?, court_type),
          region = COALESCE(?, region),
          source_id = COALESCE(?, source_id),
          last_seen = ?
      WHERE id = ?
    `).run(
      input.court_name,
      input.court_type || null,
      input.region ?? null,
      input.source_id ?? null,
      now,
      existing.id
    );
    return { id: existing.id, inserted: false };
  }

  const info = db.prepare(`
    INSERT INTO courts
      (court_tag, court_name, court_type, region, source_id, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.court_tag,
    input.court_name,
    input.court_type || 'arbitration',
    input.region ?? null,
    input.source_id ?? null,
    now,
    now
  );
  return { id: Number(info.lastInsertRowid), inserted: true };
}

export function getCourtByTag(court_tag: string): CourtRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM courts WHERE court_tag = ?').get(court_tag) as unknown as CourtRecord | undefined;
  return row ?? null;
}

export function listCourts(): Array<{
  id: number;
  court_tag: string;
  court_name: string;
  court_type: string;
}> {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, court_tag, court_name, court_type
    FROM courts
    ORDER BY court_name COLLATE NOCASE ASC
  `).all() as unknown as Array<{
    id: number;
    court_tag: string;
    court_name: string;
    court_type: string;
  }>;
}

export function countCourts(): number {
  const db = getDatabase();
  return (db.prepare('SELECT COUNT(*) AS c FROM courts').get() as any).c;
}
