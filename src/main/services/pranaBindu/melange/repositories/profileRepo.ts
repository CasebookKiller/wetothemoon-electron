// src/main/services/pranaBindu/melange/repositories/profileRepo.ts

import type { DatabaseSync } from 'node:sqlite';
import type { Profile } from '../../core/types';
import type { ProfileRow } from '../types';

function rowToDomain(row: ProfileRow): Profile {
  return {
    age: row.age ?? undefined,
    maxHr: row.max_hr ?? undefined,
    restingHr: row.resting_hr ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    lactateThresholdHr: row.lthr ?? undefined,
    marathonDate: row.goal_marathon_date ?? undefined,
  };
}

export function getProfile(db: DatabaseSync): Profile {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined;
  if (!row) return {};
  return rowToDomain(row);
}

export function updateProfile(db: DatabaseSync, patch: Partial<Profile>): Profile {
  const now = new Date().toISOString();

  // Читаем текущее значение, чтобы не потерять неуказанные поля.
  const current = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined;

  const merged = {
    age: patch.age ?? current?.age ?? null,
    max_hr: patch.maxHr ?? current?.max_hr ?? null,
    lthr: patch.lactateThresholdHr ?? current?.lthr ?? null,
    resting_hr: patch.restingHr ?? current?.resting_hr ?? null,
    weight_kg: patch.weightKg ?? current?.weight_kg ?? null,
    goal_marathon_date: patch.marathonDate ?? current?.goal_marathon_date ?? null,
    updated_at: now,
  };

  if (!current) {
    db.prepare(
      `INSERT INTO profile (id, age, max_hr, lthr, resting_hr, weight_kg,
        goal_marathon_date, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      merged.age, merged.max_hr, merged.lthr, merged.resting_hr,
      merged.weight_kg, merged.goal_marathon_date, now, now
    );
  } else {
    db.prepare(
      `UPDATE profile SET
        age = ?, max_hr = ?, lthr = ?, resting_hr = ?, weight_kg = ?,
        goal_marathon_date = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      merged.age, merged.max_hr, merged.lthr, merged.resting_hr,
      merged.weight_kg, merged.goal_marathon_date, now
    );
  }

  return getProfile(db);
}