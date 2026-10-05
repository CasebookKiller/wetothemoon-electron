// src/main/services/pranaBindu/melange/repositories/planEventsRepo.ts
//
// План тренировок из intervals.icu (и, позже, локально созданный).
// Идемпотентность по external_id.

import type { DatabaseSync } from 'node:sqlite';
import type { PlanEvent, WorkoutStep, PlanCategory } from '../../core/types';
import type { PlanEventRow } from '../types';

function rowToDomain(row: PlanEventRow): PlanEvent {
  let steps: WorkoutStep[] | undefined;
  let zoneTimes: Array<{ zone: string; secs: number }> | undefined;

  if (row.icu_workout_json) {
    try {
      const parsed = JSON.parse(row.icu_workout_json);
      if (Array.isArray(parsed?.steps)) {
        steps = parsed.steps.map((s: any) => ({
          type: s?.type ?? undefined,
          duration: typeof s?.duration === 'number' ? s.duration : undefined,
          distance: typeof s?.distance === 'number' ? s.distance : undefined,
          // Универсальный fallback: ICU-формат (hr.value) или уже
          // разобранный (hrZone) — на случай двойного маппинга.
          hrZone: s?.hr?.value ?? s?.hrZone ?? undefined,
          paceZone: s?.pace?.value ?? s?.paceZone ?? undefined,
          powerZone: s?.power?.value ?? s?.powerZone ?? undefined,
          reps: typeof s?.reps === 'number' ? s.reps : undefined,
          raw: s,
        }));
      }
      if (Array.isArray(parsed?.zoneTimes)) {
        zoneTimes = parsed.zoneTimes.map((z: any) => ({
          zone: String(z?.id ?? ''),
          secs: Number(z?.secs ?? 0),
        }));
      }
    } catch {
      // ignore — оставим steps undefined
    }
  }

  return {
    id: row.id,
    externalId: row.external_id,
    date: row.date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    category: row.category as PlanCategory,
    sport: row.sport ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    plannedLoad: row.planned_load ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    distanceM: row.distance_m ?? undefined,
    steps,
    zoneTimes,
    pairedActivityId: row.paired_activity_id ?? undefined,
    raw: row.raw_json ? safeParse(row.raw_json) : undefined,
  };
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}

export interface UpsertPlanEventResult {
  inserted: boolean;
  id: number;
}

/**
 * Upsert по external_id. Обновляет все поля, но НЕ трогает
 * paired_activity_id — эта связь управляется отдельно (linkToActivity).
 */
export function upsertPlanEvent(
  db: DatabaseSync,
  event: PlanEvent
): UpsertPlanEventResult {
  const now = new Date().toISOString();
  const workoutJson = event.steps || event.zoneTimes
    ? JSON.stringify({ steps: event.steps ?? [], zoneTimes: event.zoneTimes ?? [] })
    : null;
  const rawJson = event.raw !== undefined ? JSON.stringify(event.raw) : null;

  const existing = db
    .prepare(`SELECT id FROM plan_events WHERE external_id = ? LIMIT 1`)
    .get(event.externalId) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE plan_events SET
        date = ?, start_time = ?, end_time = ?,
        category = ?, sport = ?, name = ?, description = ?,
        planned_load = ?, duration_sec = ?, distance_m = ?,
        icu_workout_json = ?, raw_json = ?,
        updated_at = ?
       WHERE id = ?`
    ).run(
      event.date,
      event.startTime ?? null,
      event.endTime ?? null,
      event.category,
      event.sport ?? null,
      event.name,
      event.description ?? null,
      event.plannedLoad ?? null,
      event.durationSec ?? null,
      event.distanceM ?? null,
      workoutJson,
      rawJson,
      now,
      existing.id
    );
    return { inserted: false, id: existing.id };
  }

  const info = db.prepare(
    `INSERT INTO plan_events
      (external_id, date, start_time, end_time, category, sport, name,
       description, planned_load, duration_sec, distance_m,
       icu_workout_json, raw_json, local_keep, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    event.externalId,
    event.date,
    event.startTime ?? null,
    event.endTime ?? null,
    event.category,
    event.sport ?? null,
    event.name,
    event.description ?? null,
    event.plannedLoad ?? null,
    event.durationSec ?? null,
    event.distanceM ?? null,
    workoutJson,
    rawJson,
    now,
    now
  );

  return { inserted: true, id: Number(info.lastInsertRowid) };
}

export function listPlanEvents(
  db: DatabaseSync,
  from: string,
  to: string
): PlanEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM plan_events
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, start_time ASC NULLS FIRST, id ASC`
    )
    .all(from, to) as unknown as PlanEventRow[];
  return rows.map(rowToDomain);
}

export function getPlanEventByExternalId(
  db: DatabaseSync,
  externalId: string
): PlanEvent | null {
  const row = db
    .prepare(`SELECT * FROM plan_events WHERE external_id = ? LIMIT 1`)
    .get(externalId) as unknown as PlanEventRow | undefined;
  return row ? rowToDomain(row) : null;
}

/** Связывает событие с фактом (run_facts.id). */
export function linkPlanEventToActivity(
  db: DatabaseSync,
  planEventId: number,
  runFactId: number | null
): void {
  db.prepare(
    `UPDATE plan_events SET paired_activity_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(runFactId, new Date().toISOString(), planEventId);
}

/** Удаляет все события за диапазон — для полного пересинка. */
export function deletePlanEventsRange(
  db: DatabaseSync,
  from: string,
  to: string
): number {
  const info = db
    .prepare(`DELETE FROM plan_events WHERE date >= ? AND date <= ?`)
    .run(from, to);
  return Number(info.changes);
}

/** Локальное обновление полей события (не трогает external_id). */
export function updatePlanEventLocally(
  db: DatabaseSync,
  id: number,
  patch: Partial<Pick<PlanEvent, 'date' | 'startTime' | 'endTime' | 'category' | 'sport' | 'name' | 'description'>>
): void {
  const now = new Date().toISOString();
  const sets: string[] = [];
  const values: any[] = [];

  if (patch.date !== undefined) { sets.push('date = ?'); values.push(patch.date); }
  if (patch.startTime !== undefined) { sets.push('start_time = ?'); values.push(patch.startTime); }
  if (patch.endTime !== undefined) { sets.push('end_time = ?'); values.push(patch.endTime); }
  if (patch.category !== undefined) { sets.push('category = ?'); values.push(patch.category); }
  if (patch.sport !== undefined) { sets.push('sport = ?'); values.push(patch.sport); }
  if (patch.name !== undefined) { sets.push('name = ?'); values.push(patch.name); }
  if (patch.description !== undefined) { sets.push('description = ?'); values.push(patch.description); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?'); values.push(now);
  values.push(id);

  db.prepare(
    `UPDATE plan_events SET ${sets.join(', ')} WHERE id = ?`
  ).run(...values);
}

/** Локальное удаление события по id. */
export function deletePlanEventLocally(
  db: DatabaseSync,
  id: number
): boolean {
  const info = db.prepare(`DELETE FROM plan_events WHERE id = ?`).run(id);
  return Number(info.changes) > 0;
}

/** Создание локального события (без внешнего id). */
export function createPlanEventLocally(
  db: DatabaseSync,
  payload: {
    date: string;
    startTime?: string;
    category: string;
    sport?: string;
    name: string;
    description?: string;
  }
): number {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO plan_events
       (external_id, date, start_time, end_time, category, sport, name,
        description, planned_load, duration_sec, distance_m,
        icu_workout_json, raw_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`
  ).run(
    // external_id = локальный маркер, чтобы UNIQUE не страдал.
    // Формат: local:<unixtime>-<rand>
    `local:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload.date,
    payload.startTime ?? `${payload.date}T09:00:00`,
    null,
    payload.category,
    payload.sport ?? null,
    payload.name,
    payload.description ?? null,
    now,
    now
  );
  return Number(info.lastInsertRowid);
}

/** Установить/сбросить флаг local_keep для группы событий. */
export function setLocalKeep(
  db: DatabaseSync,
  ids: number[],
  keep: boolean
): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const info = db
    .prepare(
      `UPDATE plan_events SET local_keep = ?, updated_at = ?
       WHERE id IN (${placeholders})`
    )
    .run(keep ? 1 : 0, new Date().toISOString(), ...ids);
  return Number(info.changes);
}

/** Удалить группу событий по id. */
export function deletePlanEventsByIds(
  db: DatabaseSync,
  ids: number[]
): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const info = db
    .prepare(`DELETE FROM plan_events WHERE id IN (${placeholders})`)
    .run(...ids);
  return Number(info.changes);
}

/**
 * Найти локальные ICU-события за диапазон, которых нет в ICU
 * (по external_id) и у которых local_keep = 0.
 */
export function findStaleIcuEvents(
  db: DatabaseSync,
  from: string,
  to: string,
  icuExternalIds: Set<string>
): Array<{ id: number; date: string; name: string; sport: string | null }> {
  const rows = db
    .prepare(
      `SELECT id, date, name, sport, external_id FROM plan_events
       WHERE date >= ? AND date <= ?
         AND external_id LIKE 'intervals-icu-event:%'
         AND local_keep = 0`
    )
    .all(from, to) as unknown as Array<{
      id: number;
      date: string;
      name: string;
      sport: string | null;
      external_id: string;
    }>;
  return rows
    .filter((r) => !icuExternalIds.has(r.external_id))
    .map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      sport: r.sport,
    }));
}