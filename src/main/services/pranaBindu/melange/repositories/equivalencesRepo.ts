// src/main/services/pranaBindu/melange/repositories/equivalencesRepo.ts
//
// Соответствия между движениями из разных каталогов (Thenics ↔ Wade,
// Cali, Runner). Заполняется пользователем постепенно через диалог
// разметки. В matcher / генераторы не встроено — используется только
// в UI для показа «сложность ≈ W3».

import type { DatabaseSync } from 'node:sqlite';
import type { EquivalenceRow } from '../types';

export interface Equivalence {
  id: number;
  source: string;
  sourceKey: string;
  sourceLevel: string | null;
  target: string;
  targetKey: string;
  targetLevel: string | null;
  confidence: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquivalenceInput {
  source: string;
  sourceKey: string;
  sourceLevel?: string | null;
  target: string;
  targetKey: string;
  targetLevel?: string | null;
  confidence?: string;
  note?: string | null;
}

function rowToDomain(r: EquivalenceRow): Equivalence {
  return {
    id: r.id,
    source: r.source,
    sourceKey: r.source_key,
    sourceLevel: r.source_level,
    target: r.target,
    targetKey: r.target_key,
    targetLevel: r.target_level,
    confidence: r.confidence,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listEquivalences(db: DatabaseSync): Equivalence[] {
  return (
    db
      .prepare(`SELECT * FROM equivalences ORDER BY source, source_key`)
      .all() as unknown as EquivalenceRow[]
  ).map(rowToDomain);
}

export function listEquivalencesFor(
  db: DatabaseSync,
  source: string,
  sourceKey: string
): Equivalence[] {
  return (
    db
      .prepare(
        `SELECT * FROM equivalences
         WHERE source = ? AND source_key = ?
         ORDER BY id ASC`
      )
      .all(source, sourceKey) as unknown as EquivalenceRow[]
  ).map(rowToDomain);
}

/**
 * Upsert по UNIQUE (source, source_key, source_level, target, target_key,
 * target_level). Возвращает { inserted, id }.
 */
export function setEquivalence(
  db: DatabaseSync,
  input: EquivalenceInput
): { inserted: boolean; id: number } {
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT id FROM equivalences
       WHERE source = ? AND source_key = ?
         AND (source_level IS ? OR source_level = ?)
         AND target = ? AND target_key = ?
         AND (target_level IS ? OR target_level = ?)
       LIMIT 1`
    )
    .get(
      input.source,
      input.sourceKey,
      input.sourceLevel ?? null,
      input.sourceLevel ?? null,
      input.target,
      input.targetKey,
      input.targetLevel ?? null,
      input.targetLevel ?? null
    ) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE equivalences
       SET confidence = ?, note = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.confidence ?? 'manual',
      input.note ?? null,
      now,
      existing.id
    );
    return { inserted: false, id: existing.id };
  }

  const info = db
    .prepare(
      `INSERT INTO equivalences
         (source, source_key, source_level, target, target_key, target_level,
          confidence, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.source,
      input.sourceKey,
      input.sourceLevel ?? null,
      input.target,
      input.targetKey,
      input.targetLevel ?? null,
      input.confidence ?? 'manual',
      input.note ?? null,
      now,
      now
    );

  return { inserted: true, id: Number(info.lastInsertRowid) };
}

export function deleteEquivalence(db: DatabaseSync, id: number): boolean {
  const info = db.prepare(`DELETE FROM equivalences WHERE id = ?`).run(id);
  return info.changes > 0;
}

/**
 * Все соответствия для конкретного target-движения и уровня.
 * Используется в UI: при показе exercise из workout_sessions
 * находим «≈ Thenics X (Beginner)».
 */
export function listEquivalencesForTarget(
  db: DatabaseSync,
  target: string,
  targetKey: string,
  targetLevel: string | null
): Equivalence[] {
  const rows = db
    .prepare(
      `SELECT * FROM equivalences
       WHERE target = ? AND target_key = ?
         AND (? IS NULL OR target_level IS ? OR target_level = ?)
       ORDER BY source, source_key`
    )
    .all(
      target,
      targetKey,
      targetLevel,
      targetLevel,
      targetLevel
    ) as unknown as EquivalenceRow[];
  return rows.map(rowToDomain);
}