// src/main/services/pranaBindu/melange/repositories/weightRepo.ts
import type { DatabaseSync } from 'node:sqlite';

export interface WeightLogRow {
  id: number;
  date: string;
  weight_kg: number;
  created_at: string;
}

export function addWeight(
  db: DatabaseSync,
  date: string,
  weightKg: number,
): WeightLogRow {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO weight_logs (date, weight_kg, created_at) 
       VALUES (?, ?, ?)`
    )
    .run(date, weightKg, createdAt);

  return {
    id: Number(info.lastInsertRowid),
    date,
    weight_kg: weightKg,
    created_at: createdAt,
  };
}

export function listWeights(
  db: DatabaseSync,
  limitDays = 365,
): WeightLogRow[] {
  const since = new Date();
  since.setDate(since.getDate() - limitDays);
  const sinceIso = since.toISOString().slice(0, 10);

  return db
    .prepare(
      `SELECT * FROM weight_logs 
       WHERE date >= ? 
       ORDER BY date DESC, created_at DESC`
    )
    .all(sinceIso) as unknown as WeightLogRow[];
}

export function getLatestWeight(db: DatabaseSync): WeightLogRow | null {
  const row = db
    .prepare(
      `SELECT * FROM weight_logs 
       ORDER BY date DESC, created_at DESC 
       LIMIT 1`
    )
    .get() as unknown as WeightLogRow | undefined;
  return row ?? null;
}

export function deleteWeight(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM weight_logs WHERE id = ?`).run(id);
}