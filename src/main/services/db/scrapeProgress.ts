import { getDatabase } from './connection';

export function markPrefixStatus(input: {
  source: string;
  prefix: string;
  status: 'pending' | 'in_progress' | 'done' | 'error';
  itemsFound?: number;
  lastError?: string | null;
}): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = db.prepare(
    'SELECT id FROM scrape_progress WHERE source = ? AND prefix = ?'
  ).get(input.source, input.prefix) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE scrape_progress
      SET status = ?,
          items_found = COALESCE(?, items_found),
          started_at = CASE WHEN ? = 'in_progress' THEN ? ELSE started_at END,
          finished_at = CASE WHEN ? IN ('done','error') THEN ? ELSE finished_at END,
          last_error = ?
      WHERE id = ?
    `).run(
      input.status,
      input.itemsFound ?? null,
      input.status,
      now,
      input.status,
      now,
      input.lastError ?? null,
      existing.id
    );
    return;
  }

  db.prepare(`
    INSERT INTO scrape_progress
      (source, prefix, status, items_found, started_at, finished_at, last_error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.source,
    input.prefix,
    input.status,
    input.itemsFound ?? 0,
    input.status === 'in_progress' ? now : null,
    input.status === 'done' || input.status === 'error' ? now : null,
    input.lastError ?? null
  );
}

/**
 * Возвращает список префиксов для обхода:
 * 1) pending — никогда не собирали;
 * 2) error — упали в прошлый раз;
 * 3) done, но finished_at < now - staleDays — устарели.
 * Отсортировано: pending → error → устаревшие done (сначала самые старые).
 */
export function listPrefixesToScrape(
  source: string,
  staleDays = 90
): Array<{ prefix: string; status: string; finished_at: string | null }> {
  const db = getDatabase();
  const staleIso = new Date(Date.now() - staleDays * 24 * 3600 * 1000).toISOString();
  return db.prepare(`
    SELECT prefix, status, finished_at
    FROM scrape_progress
    WHERE source = ?
      AND (
        status IN ('pending', 'error', 'in_progress')
        OR (status = 'done' AND (finished_at IS NULL OR finished_at < ?))
      )
    ORDER BY
      CASE status
        WHEN 'pending' THEN 0
        WHEN 'error' THEN 1
        WHEN 'in_progress' THEN 2
        ELSE 3
      END,
      finished_at ASC NULLS FIRST,
      prefix ASC
  `).all(source, staleIso) as Array<{ prefix: string; status: string; finished_at: string | null }>;
}

/**
 * Возвращает ВСЕ известные префиксы для данного source (любой статус).
 * Используется, чтобы понять, какие буквы уже заведены в scrape_progress.
 */
export function listAllPrefixesForSource(
  source: string
): Array<{ prefix: string; status: string; finished_at: string | null }> {
  const db = getDatabase();
  return db.prepare(`
    SELECT prefix, status, finished_at
    FROM scrape_progress
    WHERE source = ?
  `).all(source) as Array<{ prefix: string; status: string; finished_at: string | null }>;
}

export function listSaturatedPrefixes(source: string): Array<{
  prefix: string;
  items_found: number;
}> {
  const db = getDatabase();
  return db.prepare(`
    SELECT prefix, items_found
    FROM scrape_progress
    WHERE source = ? AND items_found >= 25 AND status = 'done'
    ORDER BY prefix ASC
  `).all(source) as unknown as Array<{ prefix: string; items_found: number }>;
}

export function getScrapeProgressSummary(source: string): {
  pending: number;
  in_progress: number;
  done: number;
  error: number;
} {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS c
    FROM scrape_progress
    WHERE source = ?
    GROUP BY status
  `).all(source) as Array<{ status: string; c: number }>;

  const summary = { pending: 0, in_progress: 0, done: 0, error: 0 };
  for (const r of rows) {
    if (r.status in summary) (summary as any)[r.status] = r.c;
  }
  return summary;
}