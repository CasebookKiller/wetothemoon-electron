// src/main/services/pranaBindu/melange/repositories/runFactsRepo.ts
//
// Запись и чтение тренировок (run_facts).
// Идемпотентность по (source, external_id):
//   - index idx_run_facts_external НЕ unique → используем SELECT + INSERT/UPDATE.

import type { DatabaseSync } from 'node:sqlite';
import type { RawWorkout } from '../../spice/providers/types';

export interface RunFactRow {
  id: number;
  date: string;
  start_time: string | null;   // ← новое
  plan_id: number | null;
  actual_km: number | null;
  actual_pace: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  duration_sec: number | null;
  rpe: number | null;
  source: string | null;
  origin: string | null;
  external_id: string | null;
  raw_json: string | null;
  notes: string | null;
  gps_quality: string | null;
  distance_source: string | null;
  gps_coverage_pct: number | null;
  name: string | null;        // ← новое
  user_name: string | null;   // ← новое
}

export interface UpsertResult {
  inserted: boolean;
  id: number;
}

// ==================== Внутренние хелперы ====================

/**
 * Локальная дата (YYYY-MM-DD) из ISO-строки.
 * Локальная зона атлета — тренировка в 23:30 должна попасть в свой день.
 */
function toDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Темп "M:SS" из дистанции (м) и длительности (сек). null, если данных нет. */
function formatPaceFromRaw(
  distanceM?: number,
  durationS?: number
): string | null {
  if (!distanceM || !durationS || distanceM <= 0 || durationS <= 0) {
    return null;
  }
  const secPerKm = durationS / (distanceM / 1000);
  const totalSec = Math.round(secPerKm);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Приводит значение к ISO-строке или null. node:sqlite не умеет биндить Date
 * напрямую, а разные источники (fit-file-parser, будущие парсеры) могут
 * возвращать Date-объекты в timestamp-полях.
 */
function toIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// ==================== Чтение ====================

export function getRunFactByExternalId(
  db: DatabaseSync,
  source: string,
  externalId: string
): RunFactRow | null {
  const row = db
    .prepare(
      `SELECT * FROM run_facts
       WHERE source = ? AND external_id = ?
       LIMIT 1`
    )
    .get(source, externalId) as unknown as RunFactRow | undefined;
  return row ?? null;
}

export function listRunFacts(
  db: DatabaseSync,
  from: string,
  to: string
): RunFactRow[] {
  return db
    .prepare(
      `SELECT * FROM run_facts
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, id ASC`
    )
    .all(from, to) as unknown as RunFactRow[];
}

// ==================== Запись ====================

/**
 * Идемпотентный upsert тренировки из провайдера.
 * Если запись с (source, external_id) уже есть — обновляет поля,
 * но НЕ трогает plan_id, rpe, notes (это ручные поля пользователя).
 */
export function upsertRunFact(
  db: DatabaseSync,
  fact: RawWorkout
): UpsertResult {
  const date = toDateOnly(fact.startTime);
  const actualKm =
    typeof fact.distanceM === 'number'
      ? round3(fact.distanceM / 1000)
      : null;
  const pace = formatPaceFromRaw(fact.distanceM, fact.durationS);
  const rawJson = fact.raw !== undefined ? JSON.stringify(fact.raw) : null;

  const existing = getRunFactByExternalId(db, fact.source, fact.externalId);

  if (existing) {
    // origin не перезаписываем, если уже задан.
    // Origin — «откуда запись пришла впервые», он не должен меняться
    // при повторных импортах того же файла из другой папки.

    db.prepare(
      `UPDATE run_facts SET
        date              = ?,
        start_time        = COALESCE(?, start_time),
        actual_km         = COALESCE(?, actual_km),
        actual_pace       = COALESCE(?, actual_pace),
        avg_hr            = COALESCE(?, avg_hr),
        max_hr            = COALESCE(?, max_hr),
        duration_sec      = COALESCE(?, duration_sec),
        source            = ?,
        origin            = ?,
        gps_quality       = COALESCE(?, gps_quality),
        distance_source   = COALESCE(?, distance_source),
        gps_coverage_pct  = COALESCE(?, gps_coverage_pct),
        name              = COALESCE(?, name),
        raw_json          = COALESCE(?, raw_json)
       WHERE id = ?`
    ).run(
      date,
      toIsoOrNull(fact.startTime),
      actualKm,
      pace,
      fact.avgHr != null ? Math.round(fact.avgHr) : null,
      fact.maxHr != null ? Math.round(fact.maxHr) : null,
      fact.durationS != null ? Math.round(fact.durationS) : null,
      fact.source,
      existing.origin ?? fact.origin ?? null,
      fact.gpsQuality ?? null,
      fact.distanceSource ?? null,
      fact.gpsCoveragePct ?? null,
      fact.name ?? null,
      rawJson,
      existing.id
    );
    return { inserted: false, id: existing.id };
  }

  const info = db
    .prepare(
      `INSERT INTO run_facts
         (date, start_time, actual_km, actual_pace, avg_hr, max_hr,
         duration_sec, source, origin, external_id, raw_json,
         gps_quality, distance_source, gps_coverage_pct,
         name, user_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      date,
      toIsoOrNull(fact.startTime),
      actualKm,
      pace,
      fact.avgHr != null ? Math.round(fact.avgHr) : null,
      fact.maxHr != null ? Math.round(fact.maxHr) : null,
      fact.durationS != null ? Math.round(fact.durationS) : null,
      fact.source,
      fact.origin ?? null,
      fact.externalId,                // ← external_id
      rawJson,                        // ← raw_json
      fact.gpsQuality ?? null,        // ← gps_quality
      fact.distanceSource ?? null,    // ← distance_source
      fact.gpsCoveragePct ?? null,    // ← gps_coverage_pct
      fact.name ?? null,              // ← name
      null                            // ← user_name
    );

  return { inserted: true, id: Number(info.lastInsertRowid) };
}

/** Количество записей за период — для UI и отладки. */
export function countRunFacts(
  db: DatabaseSync,
  from: string,
  to: string
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM run_facts
       WHERE date >= ? AND date <= ?`
    )
    .get(from, to) as unknown as { n: number } | undefined;
  return row?.n ?? 0;
}