// src/main/services/pranaBindu/melange/repositories/workoutSessionsRepo.ts
//
// Факт выполнения силовых / программных тренировок.
// Не путать со старой strength_sessions (v1) — та завязана на
// старую модель movements/progressions и не используется.

import type { DatabaseSync } from 'node:sqlite';
import type { WorkoutSession, SessionExercise } from '../../core/types';
import type { WorkoutSessionRow } from '../types';

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function rowToDomain(row: WorkoutSessionRow): WorkoutSession {
  const parsed = safeParse<{ exercises?: SessionExercise[] }>(
    row.exercises_json,
    { exercises: [] }
  );
  return {
    id: row.id,
    date: row.date,
    startTime: row.start_time,
    planEventId: row.plan_event_id,
    programKey: row.program_key,
    generatorCategory: row.generator_category,
    exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
    rpe: row.rpe,
    isTest: row.is_test === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateWorkoutSessionInput {
  date: string;
  startTime?: string;
  planEventId?: number | null;
  programKey?: string | null;
  generatorCategory?: string | null;
  exercises: SessionExercise[];
  rpe?: number | null;
  isTest?: boolean;
  notes?: string | null;
}

export function createWorkoutSession(
  db: DatabaseSync,
  payload: CreateWorkoutSessionInput
): number {
  const now = new Date().toISOString();
  const json = JSON.stringify({ exercises: payload.exercises });
  const info = db
    .prepare(
      `INSERT INTO workout_sessions
         (date, start_time, plan_event_id, program_key, generator_category,
          exercises_json, rpe, is_test, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.date,
      payload.startTime ?? null,
      payload.planEventId ?? null,
      payload.programKey ?? null,
      payload.generatorCategory ?? null,
      json,
      payload.rpe ?? null,
      payload.isTest ? 1 : 0,
      payload.notes ?? null,
      now,
      now
    );
  return Number(info.lastInsertRowid);
}

export interface UpdateWorkoutSessionPatch {
  date?: string;
  startTime?: string | null;
  planEventId?: number | null;
  programKey?: string | null;
  generatorCategory?: string | null;
  exercises?: SessionExercise[];
  rpe?: number | null;
  isTest?: boolean;
  notes?: string | null;
}

export function updateWorkoutSession(
  db: DatabaseSync,
  id: number,
  patch: UpdateWorkoutSessionPatch
): boolean {
  const sets: string[] = [];
  const values: any[] = [];
  if (patch.date !== undefined) { sets.push('date = ?'); values.push(patch.date); }
  if (patch.startTime !== undefined) { sets.push('start_time = ?'); values.push(patch.startTime); }
  if (patch.planEventId !== undefined) { sets.push('plan_event_id = ?'); values.push(patch.planEventId); }
  if (patch.programKey !== undefined) { sets.push('program_key = ?'); values.push(patch.programKey); }
  if (patch.generatorCategory !== undefined) { sets.push('generator_category = ?'); values.push(patch.generatorCategory); }
  if (patch.exercises !== undefined) {
    sets.push('exercises_json = ?');
    values.push(JSON.stringify({ exercises: patch.exercises }));
  }
  if (patch.rpe !== undefined) { sets.push('rpe = ?'); values.push(patch.rpe); }
  if (patch.isTest !== undefined) { sets.push('is_test = ?'); values.push(patch.isTest ? 1 : 0); }
  if (patch.notes !== undefined) { sets.push('notes = ?'); values.push(patch.notes); }

  if (sets.length === 0) return false;
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const info = db
    .prepare(`UPDATE workout_sessions SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values);
  return Number(info.changes) > 0;
}

export function getWorkoutSession(
  db: DatabaseSync,
  id: number
): WorkoutSession | null {
  const row = db
    .prepare(`SELECT * FROM workout_sessions WHERE id = ?`)
    .get(id) as unknown as WorkoutSessionRow | undefined;
  return row ? rowToDomain(row) : null;
}

export function listWorkoutSessions(
  db: DatabaseSync,
  from: string,
  to: string
): WorkoutSession[] {
  const rows = db
    .prepare(
      `SELECT * FROM workout_sessions
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, start_time ASC NULLS FIRST, id ASC`
    )
    .all(from, to) as unknown as WorkoutSessionRow[];
  return rows.map(rowToDomain);
}

export function listWorkoutSessionsForPlanEvent(
  db: DatabaseSync,
  planEventId: number
): WorkoutSession[] {
  const rows = db
    .prepare(
      `SELECT * FROM workout_sessions
       WHERE plan_event_id = ?
       ORDER BY date ASC, id ASC`
    )
    .all(planEventId) as unknown as WorkoutSessionRow[];
  return rows.map(rowToDomain);
}

export function deleteWorkoutSession(
  db: DatabaseSync,
  id: number
): boolean {
  const info = db
    .prepare(`DELETE FROM workout_sessions WHERE id = ?`)
    .run(id);
  return Number(info.changes) > 0;
}