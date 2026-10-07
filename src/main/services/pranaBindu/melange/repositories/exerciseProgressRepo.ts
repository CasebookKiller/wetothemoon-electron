// src/main/services/pranaBindu/melange/repositories/exerciseProgressRepo.ts
//
// Прогресс пользователя по движениям Mentat (Wade, Cali, Runner).
// Отдельно от user_movement_state (та привязана к Big-6 id из
// Crysknife). Ключ — movement_key из exerciseCatalog.

import type { DatabaseSync } from 'node:sqlite';
import type { ExerciseProgressRow } from '../types';

export interface ExerciseProgress {
  movementKey: string;
  currentLevel: number;
  currentRung: number;
  updatedAt: string;
}

function rowToDomain(row: ExerciseProgressRow): ExerciseProgress {
  return {
    movementKey: row.movement_key,
    currentLevel: row.current_level,
    currentRung: row.current_rung,
    updatedAt: row.updated_at,
  };
}

export function getExerciseProgress(
  db: DatabaseSync,
  movementKey: string
): ExerciseProgress | null {
  const row = db
    .prepare(`SELECT * FROM exercise_progress WHERE movement_key = ?`)
    .get(movementKey) as unknown as ExerciseProgressRow | undefined;
  return row ? rowToDomain(row) : null;
}

export function listExerciseProgress(
  db: DatabaseSync
): ExerciseProgress[] {
  const rows = db
    .prepare(`SELECT * FROM exercise_progress ORDER BY movement_key`)
    .all() as unknown as ExerciseProgressRow[];
  return rows.map(rowToDomain);
}

export function setExerciseProgress(
  db: DatabaseSync,
  movementKey: string,
  level: number,
  rung: number
): ExerciseProgress {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO exercise_progress
       (movement_key, current_level, current_rung, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(movement_key) DO UPDATE SET
       current_level = excluded.current_level,
       current_rung = excluded.current_rung,
       updated_at = excluded.updated_at`
  ).run(movementKey, level, rung, now);
  return {
    movementKey,
    currentLevel: level,
    currentRung: rung,
    updatedAt: now,
  };
}

export function deleteExerciseProgress(
  db: DatabaseSync,
  movementKey: string
): boolean {
  const info = db
    .prepare(`DELETE FROM exercise_progress WHERE movement_key = ?`)
    .run(movementKey);
  return Number(info.changes) > 0;
}