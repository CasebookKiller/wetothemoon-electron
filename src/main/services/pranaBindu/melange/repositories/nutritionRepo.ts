// src/main/services/pranaBindu/melange/repositories/nutritionRepo.ts
import type { DatabaseSync } from 'node:sqlite';

export interface NutritionLogRow {
  id: number;
  date: string;
  meal_type: string;
  food_name: string;
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  source: string;
  created_at: string;
}

export interface CreateNutritionInput {
  date: string;
  mealType: string;
  foodName: string;
  calories: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  source?: string;
}

export function addNutrition(
  db: DatabaseSync,
  input: CreateNutritionInput,
): NutritionLogRow {
  const createdAt = new Date().toISOString();
  const source = input.source ?? 'manual';

  const info = db
    .prepare(
      `INSERT INTO nutrition_logs 
        (date, meal_type, food_name, calories, protein_g, fat_g, carbs_g, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.date,
      input.mealType,
      input.foodName,
      input.calories,
      input.proteinG,
      input.fatG,
      input.carbsG,
      source,
      createdAt,
    );

  return {
    id: Number(info.lastInsertRowid),
    date: input.date,
    meal_type: input.mealType,
    food_name: input.foodName,
    calories: input.calories,
    protein_g: input.proteinG,
    fat_g: input.fatG,
    carbs_g: input.carbsG,
    source,
    created_at: createdAt,
  };
}

export function listNutritionByDate(
  db: DatabaseSync,
  date: string,
): NutritionLogRow[] {
  return db
    .prepare(
      `SELECT * FROM nutrition_logs 
       WHERE date = ? 
       ORDER BY created_at ASC`
    )
    .all(date) as unknown as NutritionLogRow[];
}

export function deleteNutrition(db: DatabaseSync, id: number): void {
  db.prepare(`DELETE FROM nutrition_logs WHERE id = ?`).run(id);
}

export interface NutritionDayTotals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export function getNutritionTotalsByDate(
  db: DatabaseSync,
  date: string,
): NutritionDayTotals {
  const row = db
    .prepare(
      `SELECT 
         COALESCE(SUM(calories), 0) as calories,
         COALESCE(SUM(protein_g), 0) as protein_g,
         COALESCE(SUM(fat_g), 0) as fat_g,
         COALESCE(SUM(carbs_g), 0) as carbs_g
       FROM nutrition_logs 
       WHERE date = ?`
    )
    .get(date) as unknown as {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };

  return {
    calories: row.calories,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
  };
}