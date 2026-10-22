// src/main/services/pranaBindu/melange/repositories/testSegmentsRepo.ts
//
// Эталонные тестовые отрезки — для расчёта порогов (LTHR/HRmax).
// Привязаны к run_fact_id, координате старта, длительности и метрикам,
// снятым с streams на момент сохранения.

import type { DatabaseSync } from 'node:sqlite';

// ==================== Domain ====================

export type TestSegmentDurationType = 'time' | 'distance';

export interface TestSegment {
  id: number;
  runFactId: number;
  startLat: number;
  startLng: number;
  startIdx: number;
  endIdx: number;
  durationType: TestSegmentDurationType;
  durationValue: number;
  distanceM: number;
  durationSec: number;
  paceSecPerKm: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrDriftPct: number | null;
  cadenceAvg: number | null;
  note: string | null;
  createdAt: string;
}

export interface CreateTestSegmentInput {
  runFactId: number;
  startLat: number;
  startLng: number;
  startIdx: number;
  endIdx: number;
  durationType: TestSegmentDurationType;
  durationValue: number;
  distanceM: number;
  durationSec: number;
  paceSecPerKm?: number | null;
  hrAvg?: number | null;
  hrMax?: number | null;
  hrDriftPct?: number | null;
  cadenceAvg?: number | null;
  note?: string | null;
}

// ==================== Row ====================

interface TestSegmentRow {
  id: number;
  run_fact_id: number;
  start_lat: number;
  start_lng: number;
  start_idx: number;
  end_idx: number;
  duration_type: string;
  duration_value: number;
  distance_m: number;
  duration_sec: number;
  pace_sec_per_km: number | null;
  hr_avg: number | null;
  hr_max: number | null;
  hr_drift_pct: number | null;
  cadence_avg: number | null;
  note: string | null;
  created_at: string;
}

function rowToDomain(row: TestSegmentRow): TestSegment {
  return {
    id: row.id,
    runFactId: row.run_fact_id,
    startLat: row.start_lat,
    startLng: row.start_lng,
    startIdx: row.start_idx,
    endIdx: row.end_idx,
    durationType: row.duration_type as TestSegmentDurationType,
    durationValue: row.duration_value,
    distanceM: row.distance_m,
    durationSec: row.duration_sec,
    paceSecPerKm: row.pace_sec_per_km,
    hrAvg: row.hr_avg,
    hrMax: row.hr_max,
    hrDriftPct: row.hr_drift_pct,
    cadenceAvg: row.cadence_avg,
    note: row.note,
    createdAt: row.created_at,
  };
}

// ==================== Repo ====================

export function createTestSegment(
  db: DatabaseSync,
  input: CreateTestSegmentInput
): number {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO test_segments
       (run_fact_id, start_lat, start_lng, start_idx, end_idx,
        duration_type, duration_value, distance_m, duration_sec,
        pace_sec_per_km, hr_avg, hr_max, hr_drift_pct, cadence_avg,
        note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.runFactId,
    input.startLat,
    input.startLng,
    input.startIdx,
    input.endIdx,
    input.durationType,
    input.durationValue,
    input.distanceM,
    input.durationSec,
    input.paceSecPerKm ?? null,
    input.hrAvg ?? null,
    input.hrMax ?? null,
    input.hrDriftPct ?? null,
    input.cadenceAvg ?? null,
    input.note ?? null,
    now
  );
  return Number(info.lastInsertRowid);
}

export function listTestSegments(
  db: DatabaseSync,
  opts?: { from?: string; to?: string; runFactId?: number }
): TestSegment[] {
  const conds: string[] = [];
  const params: any[] = [];

  if (opts?.runFactId != null) {
    conds.push(`run_fact_id = ?`);
    params.push(opts.runFactId);
  }
  if (opts?.from) {
    conds.push(`substr(created_at, 1, 10) >= ?`);
    params.push(opts.from);
  }
  if (opts?.to) {
    conds.push(`substr(created_at, 1, 10) <= ?`);
    params.push(opts.to);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT * FROM test_segments ${where} ORDER BY created_at DESC`
    )
    .all(...params) as unknown as TestSegmentRow[];

  return rows.map(rowToDomain);
}

export function listTestSegmentsForRun(
  db: DatabaseSync,
  runFactId: number
): TestSegment[] {
  return listTestSegments(db, { runFactId });
}

export function deleteTestSegment(
  db: DatabaseSync,
  id: number
): boolean {
  const info = db.prepare(`DELETE FROM test_segments WHERE id = ?`).run(id);
  return Number(info.changes) > 0;
}