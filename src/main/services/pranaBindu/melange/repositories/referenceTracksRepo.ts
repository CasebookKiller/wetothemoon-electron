// src/main/services/pranaBindu/melange/repositories/referenceTracksRepo.ts
//
// Эталонные маршруты — линии, нарисованные пользователем в редакторе карт.
// Используются для сравнения пробежек (отклонение от эталона, пейс/HR
// на одном отрезке неделя-к-неделе).

import type { DatabaseSync } from 'node:sqlite';

// ==================== Types ====================

export type ReferenceTrackKind = 'loop' | 'linear' | 'stadium';

export type ReferenceTrackCategory =
  | 'loop'
  | 'stairs'
  | 'connector'
  | 'segment'
  | 'landmark';

export const REFERENCE_CATEGORY_LABELS: Record<ReferenceTrackCategory, string> = {
  loop: 'Круг',
  stairs: 'Лестница',
  connector: 'Соединитель',
  segment: 'Отрезок',
  landmark: 'Ориентир',
};

export interface ReferenceTrack {
  id: number;
  name: string;
  coords: [number, number][];
  lengthM: number;
  kind: ReferenceTrackKind | null;
  /** Свободная строка: базовая категория или кастомная (введена пользователем). */
  category: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReferenceTrackInput {
  name: string;
  coords: [number, number][];
  kind?: ReferenceTrackKind | null;
  category?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface UpdateReferenceTrackPatch {
  name?: string;
  /** Правка геометрии: при передаче пересчитывается length_m. */
  coords?: [number, number][];
  kind?: ReferenceTrackKind | null;
  category?: string | null;
  tags?: string[];
  notes?: string | null;
}

// ==================== Row ====================

interface ReferenceTrackRow {
  id: number;
  name: string;
  coords_json: string;
  length_m: number | null;
  kind: string | null;
  category: string | null;
  tags_json: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDomain(row: ReferenceTrackRow): ReferenceTrack {
  let coords: [number, number][] = [];
  try {
    const parsed = JSON.parse(row.coords_json);
    if (Array.isArray(parsed)) {
      coords = parsed.filter(
        (p): p is [number, number] =>
          Array.isArray(p) &&
          p.length === 2 &&
          typeof p[0] === 'number' &&
          typeof p[1] === 'number',
      );
    }
  } catch {
    /* ignore */
  }
  let tags: string[] = [];
  try {
    const parsed = row.tags_json ? JSON.parse(row.tags_json) : [];
    if (Array.isArray(parsed)) {
      tags = parsed.filter((t): t is string => typeof t === 'string');
    }
  } catch {
    /* ignore */
  }

  return {
    id: row.id,
    name: row.name,
    coords,
    lengthM: row.length_m ?? 0,
    kind: (row.kind as ReferenceTrackKind) ?? null,
    category: row.category ?? null,
    tags,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== Утилиты ====================

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeLengthM(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineM(
      coords[i - 1][0],
      coords[i - 1][1],
      coords[i][0],
      coords[i][1],
    );
  }
  return Math.round(total);
}

/**
 * Определяет kind по совпадению старт/финиш.
 * Возвращает 'loop', если замыкание < 50 м, иначе 'linear'.
 */
export function detectLoopKind(
  coords: [number, number][],
): 'loop' | 'linear' {
  if (coords.length < 2) return 'linear';
  const first = coords[0];
  const last = coords[coords.length - 1];
  return haversineM(first[0], first[1], last[0], last[1]) < 50
    ? 'loop'
    : 'linear';
}

// ==================== Repo ====================

export function createReferenceTrack(
  db: DatabaseSync,
  input: CreateReferenceTrackInput,
): number {
  if (!input?.name?.trim()) {
    throw new Error('name обязателен');
  }
  if (!Array.isArray(input.coords) || input.coords.length < 2) {
    throw new Error('coords должен содержать минимум 2 точки');
  }

  const now = new Date().toISOString();
  const lengthM = computeLengthM(input.coords);
  const coordsJson = JSON.stringify(input.coords);

  // Авто-категоризация, если категория не передана явно
  let category: string | null = input.category ?? null;
  if (category == null) {
    if (input.kind === 'loop' || input.kind === 'stadium') {
      category = 'loop';
    } else if (input.kind === 'linear') {
      category = 'segment';
    }
  }

  const info = db.prepare(
    `INSERT INTO reference_tracks
       (name, coords_json, length_m, kind, category, tags_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.name.trim(),
    coordsJson,
    lengthM,
    input.kind ?? null,
    category,
    input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null,
    input.notes ?? null,
    now,
    now,
  );

  return Number(info.lastInsertRowid);
}

export function listReferenceTracks(db: DatabaseSync): ReferenceTrack[] {
  const rows = db
    .prepare(`SELECT * FROM reference_tracks ORDER BY created_at DESC`)
    .all() as unknown as ReferenceTrackRow[];
  return rows.map(rowToDomain);
}

export function getReferenceTrackById(
  db: DatabaseSync,
  id: number,
): ReferenceTrack | null {
  const row = db
    .prepare(`SELECT * FROM reference_tracks WHERE id = ?`)
    .get(id) as unknown as ReferenceTrackRow | undefined;
  return row ? rowToDomain(row) : null;
}

export function updateReferenceTrack(
  db: DatabaseSync,
  id: number,
  patch: UpdateReferenceTrackPatch,
): boolean {
  const sets: string[] = [];
  const values: any[] = [];

  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('name не может быть пустым');
    sets.push(`name = ?`);
    values.push(patch.name.trim());
  }
  if (patch.coords !== undefined) {
    if (!Array.isArray(patch.coords) || patch.coords.length < 2) {
      throw new Error('coords: минимум 2 точки');
    }
    const cleaned = patch.coords
      .filter(
        (p): p is [number, number] =>
          Array.isArray(p) &&
          p.length === 2 &&
          typeof p[0] === 'number' &&
          typeof p[1] === 'number' &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1]),
      );
    if (cleaned.length < 2) {
      throw new Error('coords: после фильтрации меньше 2 валидных точек');
    }
    sets.push(`coords_json = ?`);
    values.push(JSON.stringify(cleaned));
    sets.push(`length_m = ?`);
    values.push(computeLengthM(cleaned));
  }
  if (patch.kind !== undefined) {
    sets.push(`kind = ?`);
    values.push(patch.kind);
  }
  if (patch.category !== undefined) {
    sets.push(`category = ?`);
    values.push(patch.category);
  }
  if (patch.tags !== undefined) {
    sets.push(`tags_json = ?`);
    values.push(
      patch.tags && patch.tags.length > 0 ? JSON.stringify(patch.tags) : null,
    );
  }
  if (patch.notes !== undefined) {
    sets.push(`notes = ?`);
    values.push(patch.notes);
  }
  if (sets.length === 0) return false;

  sets.push(`updated_at = ?`);
  values.push(new Date().toISOString());
  values.push(id);

  const info = db
    .prepare(`UPDATE reference_tracks SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values);
  return Number(info.changes) > 0;
}

export function deleteReferenceTrack(
  db: DatabaseSync,
  id: number,
): boolean {
  const info = db.prepare(`DELETE FROM reference_tracks WHERE id = ?`).run(id);
  return Number(info.changes) > 0;
}