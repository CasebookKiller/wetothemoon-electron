// src/main/services/pranaBindu/melange/repositories/waterRepo.ts
import type { DatabaseSync } from 'node:sqlite';

export interface WaterLogRow {
  id: number;
  date: string;
  amount_ml: number;
  created_at: string;
}

export function addWater(
  db: DatabaseSync,
  date: string,
  amountMl: number,
): WaterLogRow {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO water_logs (date, amount_ml, created_at) 
       VALUES (?, ?, ?)`
    )
    .run(date, amountMl, createdAt);

  return {
    id: Number(info.lastInsertRowid),
    date,
    amount_ml: amountMl,
    created_at: createdAt,
  };
}

export function listWaterByDate(
  db: DatabaseSync,
  date: string,
): WaterLogRow[] {
  return db
    .prepare(
      `SELECT * FROM water_logs 
       WHERE date = ? 
       ORDER BY created_at ASC`
    )
    .all(date) as unknown as WaterLogRow[];
}

export function getWaterTotalByDate(
  db: DatabaseSync,
  date: string,
): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_ml), 0) as total 
       FROM water_logs 
       WHERE date = ?`
    )
    .get(date) as unknown as { total: number } | undefined;
  return row?.total ?? 0;
}

export function deleteWater(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM water_logs WHERE id = ?`).run(id);
}

/** Возвращает суммы потребления воды по дням за диапазон (YYYY-MM-DD). */
export function getWaterTotalsForRange(
  db: DatabaseSync,
  from: string,
  to: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT date, SUM(amount_ml) as total
       FROM water_logs
       WHERE date >= ? AND date <= ?
       GROUP BY date`
    )
    .all(from, to) as unknown as Array<{ date: string; total: number }>;

  const result: Record<string, number> = {};
  for (const r of rows) {
    result[r.date] = r.total;
  }
  return result;
}