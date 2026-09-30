// src/main/services/pranaBindu/melange/repositories/recoveryRepo.ts
//
// Дневник восстановления. Upsert по date (UNIQUE).
// Источники: intervals.icu (основной), dodofo (fallback).

import type { DatabaseSync } from 'node:sqlite';

export interface RecoveryLogRow {
  id: number;
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  hrv: number | null;
  resting_hr: number | null;
  status: string | null;
  notes: string | null;
  weight_kg: number | null;
  sleep_score: number | null;
  sleep_total_min: number | null;
  deep_min: number | null;
  rem_min: number | null;
  light_min: number | null;
  awake_min: number | null;
  steps: number | null;
  vo2max: number | null;
  body_battery_charged: number | null;
  body_battery_drained: number | null;
  stress_avg: number | null;
  auto_source: string | null;
  raw_json: string | null;
  // v9 — intervals.icu
  ctl: number | null;
  atl: number | null;
  ramp_rate: number | null;
  readiness: number | null;
  soreness: number | null;
  fatigue: number | null;
  stress: number | null;
  mood: number | null;
  motivation: number | null;
  injury: number | null;
  avg_sleeping_hr: number | null;
  hrv_sdnn: number | null;
  baevsky_si: number | null;
  sp_o2: number | null;
  systolic: number | null;
  diastolic: number | null;
}

export interface RecoveryLogInput {
  date: string;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  hrv?: number | null;
  resting_hr?: number | null;
  weight_kg?: number | null;
  sleep_score?: number | null;
  sleep_total_min?: number | null;
  deep_min?: number | null;
  rem_min?: number | null;
  light_min?: number | null;
  awake_min?: number | null;
  steps?: number | null;
  vo2max?: number | null;
  body_battery_charged?: number | null;
  body_battery_drained?: number | null;
  stress_avg?: number | null;
  auto_source?: string | null;
  raw_json?: string | null;
  // v9 — intervals.icu
  ctl?: number | null;
  atl?: number | null;
  ramp_rate?: number | null;
  readiness?: number | null;
  soreness?: number | null;
  fatigue?: number | null;
  stress?: number | null;
  mood?: number | null;
  motivation?: number | null;
  injury?: number | null;
  avg_sleeping_hr?: number | null;
  hrv_sdnn?: number | null;
  baevsky_si?: number | null;
  sp_o2?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
}

// ==================== Утилиты ====================

type SqlValue = string | number | bigint | null | Uint8Array;

function asSql(v: unknown): SqlValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
    return v;
  }
  if (v instanceof Uint8Array) return v;
  return String(v);
}

function intOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function realOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ==================== Upsert ====================

/**
 * Идемпотентный upsert по date.
 * Новые (не-null) значения перезаписывают существующие,
 * null'ы — не затирают старые (merged).
 */
export function upsertRecoveryLog(
  db: DatabaseSync,
  input: RecoveryLogInput
): { inserted: boolean; id: number } {
  const existing = db
    .prepare(`SELECT * FROM recovery_logs WHERE date = ?`)
    .get(input.date) as unknown as RecoveryLogRow | undefined;

  const v = {
    sleep_hours: realOrNull(input.sleep_hours),
    sleep_quality: intOrNull(input.sleep_quality),
    hrv: intOrNull(input.hrv),
    resting_hr: intOrNull(input.resting_hr),
    weight_kg: realOrNull(input.weight_kg),
    sleep_score: intOrNull(input.sleep_score),
    sleep_total_min: intOrNull(input.sleep_total_min),
    deep_min: intOrNull(input.deep_min),
    rem_min: intOrNull(input.rem_min),
    light_min: intOrNull(input.light_min),
    awake_min: intOrNull(input.awake_min),
    steps: intOrNull(input.steps),
    vo2max: realOrNull(input.vo2max),
    body_battery_charged: intOrNull(input.body_battery_charged),
    body_battery_drained: intOrNull(input.body_battery_drained),
    stress_avg: intOrNull(input.stress_avg),
    auto_source: input.auto_source ?? null,
    raw_json: input.raw_json ?? null,
    // v9
    ctl: realOrNull(input.ctl),
    atl: realOrNull(input.atl),
    ramp_rate: realOrNull(input.ramp_rate),
    readiness: intOrNull(input.readiness),
    soreness: intOrNull(input.soreness),
    fatigue: intOrNull(input.fatigue),
    stress: intOrNull(input.stress),
    mood: intOrNull(input.mood),
    motivation: intOrNull(input.motivation),
    injury: intOrNull(input.injury),
    avg_sleeping_hr: intOrNull(input.avg_sleeping_hr),
    hrv_sdnn: realOrNull(input.hrv_sdnn),
    baevsky_si: realOrNull(input.baevsky_si),
    sp_o2: intOrNull(input.sp_o2),
    systolic: intOrNull(input.systolic),
    diastolic: intOrNull(input.diastolic),
  };

  if (existing) {
    // Не затираем null'ом — оставляем предыдущее значение
    const merged: Record<string, unknown> = {};
    for (const [k, newVal] of Object.entries(v)) {
      const oldVal = (existing as any)[k];
      merged[k] = newVal != null ? newVal : oldVal;
    }

    db.prepare(
      `UPDATE recovery_logs SET
        sleep_hours = ?, sleep_quality = ?, hrv = ?, resting_hr = ?,
        weight_kg = ?, sleep_score = ?, sleep_total_min = ?,
        deep_min = ?, rem_min = ?, light_min = ?, awake_min = ?,
        steps = ?, vo2max = ?, body_battery_charged = ?,
        body_battery_drained = ?, stress_avg = ?,
        auto_source = ?, raw_json = ?,
        ctl = ?, atl = ?, ramp_rate = ?,
        readiness = ?, soreness = ?, fatigue = ?, stress = ?,
        mood = ?, motivation = ?, injury = ?,
        avg_sleeping_hr = ?, hrv_sdnn = ?, baevsky_si = ?,
        sp_o2 = ?, systolic = ?, diastolic = ?
       WHERE id = ?`
    ).run(
      asSql(merged.sleep_hours),
      asSql(merged.sleep_quality),
      asSql(merged.hrv),
      asSql(merged.resting_hr),
      asSql(merged.weight_kg),
      asSql(merged.sleep_score),
      asSql(merged.sleep_total_min),
      asSql(merged.deep_min),
      asSql(merged.rem_min),
      asSql(merged.light_min),
      asSql(merged.awake_min),
      asSql(merged.steps),
      asSql(merged.vo2max),
      asSql(merged.body_battery_charged),
      asSql(merged.body_battery_drained),
      asSql(merged.stress_avg),
      asSql(merged.auto_source),
      asSql(merged.raw_json),
      asSql(merged.ctl),
      asSql(merged.atl),
      asSql(merged.ramp_rate),
      asSql(merged.readiness),
      asSql(merged.soreness),
      asSql(merged.fatigue),
      asSql(merged.stress),
      asSql(merged.mood),
      asSql(merged.motivation),
      asSql(merged.injury),
      asSql(merged.avg_sleeping_hr),
      asSql(merged.hrv_sdnn),
      asSql(merged.baevsky_si),
      asSql(merged.sp_o2),
      asSql(merged.systolic),
      asSql(merged.diastolic),
      existing.id
    );

    return { inserted: false, id: existing.id };
  }

  const info = db.prepare(
    `INSERT INTO recovery_logs
      (date, sleep_hours, sleep_quality, hrv, resting_hr,
       weight_kg, sleep_score, sleep_total_min,
       deep_min, rem_min, light_min, awake_min,
       steps, vo2max, body_battery_charged, body_battery_drained,
       stress_avg, auto_source, raw_json,
       ctl, atl, ramp_rate, readiness, soreness, fatigue, stress,
       mood, motivation, injury, avg_sleeping_hr, hrv_sdnn,
       baevsky_si, sp_o2, systolic, diastolic)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.date,
    asSql(v.sleep_hours),
    asSql(v.sleep_quality),
    asSql(v.hrv),
    asSql(v.resting_hr),
    asSql(v.weight_kg),
    asSql(v.sleep_score),
    asSql(v.sleep_total_min),
    asSql(v.deep_min),
    asSql(v.rem_min),
    asSql(v.light_min),
    asSql(v.awake_min),
    asSql(v.steps),
    asSql(v.vo2max),
    asSql(v.body_battery_charged),
    asSql(v.body_battery_drained),
    asSql(v.stress_avg),
    asSql(v.auto_source),
    asSql(v.raw_json),
    asSql(v.ctl),
    asSql(v.atl),
    asSql(v.ramp_rate),
    asSql(v.readiness),
    asSql(v.soreness),
    asSql(v.fatigue),
    asSql(v.stress),
    asSql(v.mood),
    asSql(v.motivation),
    asSql(v.injury),
    asSql(v.avg_sleeping_hr),
    asSql(v.hrv_sdnn),
    asSql(v.baevsky_si),
    asSql(v.sp_o2),
    asSql(v.systolic),
    asSql(v.diastolic)
  );

  return { inserted: true, id: Number(info.lastInsertRowid) };
}

export function listRecoveryLogs(
  db: DatabaseSync,
  from: string,
  to: string
): RecoveryLogRow[] {
  return db
    .prepare(
      `SELECT * FROM recovery_logs
       WHERE date >= ? AND date <= ?
       ORDER BY date DESC`
    )
    .all(from, to) as unknown as RecoveryLogRow[];
}

export function getRecoveryLog(
  db: DatabaseSync,
  date: string
): RecoveryLogRow | null {
  const row = db
    .prepare(`SELECT * FROM recovery_logs WHERE date = ?`)
    .get(date) as unknown as RecoveryLogRow | undefined;
  return row ?? null;
}