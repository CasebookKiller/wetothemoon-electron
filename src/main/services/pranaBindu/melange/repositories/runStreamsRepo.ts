// src/main/services/pranaBindu/melange/repositories/runStreamsRepo.ts
//
// Метаданные run_streams в SQLite. Сам payload — в .msgpack (spice/runStreams).

import type { DatabaseSync } from 'node:sqlite';
import {
  saveRunStreamsSync,
  loadRunStreamsSync,
  deleteRunStreamsFile,
  type RunStreamsPayload,
} from '../../spice/runStreams/runStreamsStorage';

export interface RunStreamRow {
  run_fact_id: number;
  source: string;
  external_id: string | null;
  file_path: string;
  size_bytes: number;
  point_count: number | null;
  channels: string | null;
  fetched_at: string;
}

export interface RunStreamWithPayload {
  meta: RunStreamRow;
  payload: RunStreamsPayload | null;
}

/**
 * Сохраняет стримы: файл .msgpack + метаданные в run_streams.
 * Идемпотентно: перезаписывает и файл, и строку.
 */
export function upsertRunStreams(
  db: DatabaseSync,
  runFactId: number,
  source: string,
  externalId: string | null,
  dateIso: string,
  payload: RunStreamsPayload
): RunStreamRow {
  const saved = saveRunStreamsSync(runFactId, source, dateIso, payload);
  const fetchedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO run_streams
      (run_fact_id, source, external_id, file_path, size_bytes,
       point_count, channels, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(run_fact_id, source) DO UPDATE SET
       external_id = excluded.external_id,
       file_path   = excluded.file_path,
       size_bytes  = excluded.size_bytes,
       point_count = excluded.point_count,
       channels    = excluded.channels,
       fetched_at  = excluded.fetched_at`
  ).run(
    runFactId,
    source,
    externalId,
    saved.filePath,
    saved.sizeBytes,
    saved.pointCount,
    saved.channels,
    fetchedAt
  );

  return getRunStreamMeta(db, runFactId, source)!;
}

export function getRunStreamMeta(
  db: DatabaseSync,
  runFactId: number,
  source: string
): RunStreamRow | null {
  const row = db
    .prepare(
      `SELECT * FROM run_streams WHERE run_fact_id = ? AND source = ?`
    )
    .get(runFactId, source) as unknown as RunStreamRow | undefined;
  return row ?? null;
}

export function getRunStreamWithPayload(
  db: DatabaseSync,
  runFactId: number,
  source: string
): RunStreamWithPayload | null {
  const meta = getRunStreamMeta(db, runFactId, source);
  if (!meta) return null;
  const payload = loadRunStreamsSync(meta.file_path);
  return { meta, payload };
}

/** Все источники стримов для одной тренировки. */
export function listRunStreams(
  db: DatabaseSync,
  runFactId: number
): RunStreamRow[] {
  return db
    .prepare(
      `SELECT * FROM run_streams WHERE run_fact_id = ? ORDER BY source ASC`
    )
    .all(runFactId) as unknown as RunStreamRow[];
}

/** Есть ли стримы для данной тренировки/источника. */
export function hasRunStreams(
  db: DatabaseSync,
  runFactId: number,
  source: string
): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM run_streams WHERE run_fact_id = ? AND source = ? LIMIT 1`
    )
    .get(runFactId, source);
  return !!row;
}

/** Удаляет стримы: строку из БД и файл. */
export function deleteRunStreams(
  db: DatabaseSync,
  runFactId: number,
  source: string
): void {
  const meta = getRunStreamMeta(db, runFactId, source);
  if (meta) deleteRunStreamsFile(meta.file_path);
  db.prepare(
    `DELETE FROM run_streams WHERE run_fact_id = ? AND source = ?`
  ).run(runFactId, source);
}