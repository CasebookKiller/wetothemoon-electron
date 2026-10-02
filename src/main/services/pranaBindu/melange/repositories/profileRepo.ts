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
    lthrSource: row.lthr_source ?? undefined,
    maxHrSource: row.max_hr_source ?? undefined,
    restingHrSource: row.resting_hr_source ?? undefined,
    hrZones: row.hr_zones_json
      ? (() => {
          try {
            const parsed = JSON.parse(row.hr_zones_json);
            return Array.isArray(parsed) ? parsed : undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined,
    hrZonesSource: row.hr_zones_source ?? undefined,
  };
}

export function getProfile(db: DatabaseSync): Profile {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined;
  if (!row) return {};
  return rowToDomain(row);
}

export function updateProfile(db: DatabaseSync, patch: Partial<Profile>): Profile {
  const now = new Date().toISOString();
  const current = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined;

  // Хелпер: если новое значение отличается от старого, обновляем
  // и число, и источник. Если не отличается — оставляем как было
  // (не затираем источник).
  function pickNum(
    newVal: number | undefined,
    oldVal: number | null | undefined,
    oldSource: string | null | undefined,
    newSource: string | undefined
  ): { value: number | null; source: string | null } {
    // Значение не передано — вообще не трогаем.
    if (newVal === undefined) {
      return { value: oldVal ?? null, source: oldSource ?? null };
    }

    // Источник передан явно (sync из провайдера, расчёт) — уважаем
    // его всегда, даже если значение не изменилось. Это позволяет
    // обновлять ярлык «откуда цифра» без изменения самой цифры.
    if (newSource !== undefined) {
      return { value: newVal, source: newSource };
    }

    // Источник не передан — значит это ручной ввод из UI.
    if (newVal === oldVal) {
      // Значение не изменилось — пользователь просто нажал
      // «Сохранить», не тронув поле. Источник не трогаем.
      return { value: oldVal ?? null, source: oldSource ?? null };
    }

    return { value: newVal, source: 'manual' };
  }

  const lthr = pickNum(patch.lactateThresholdHr, current?.lthr, current?.lthr_source, patch.lthrSource);
  const maxHr = pickNum(patch.maxHr, current?.max_hr, current?.max_hr_source, patch.maxHrSource);
  const restHr = pickNum(patch.restingHr, current?.resting_hr, current?.resting_hr_source, patch.restingHrSource);
  // HR-зоны: JSON сериализуем, пишем только если передано явно.
  let zonesJson = current?.hr_zones_json ?? null;
  let zonesSource = current?.hr_zones_source ?? null;
  if (patch.hrZones !== undefined) {
    if (!patch.hrZones || patch.hrZones.length === 0) {
      zonesJson = null;
      zonesSource = null;
    } else {
      zonesJson = JSON.stringify(patch.hrZones);
      zonesSource = patch.hrZonesSource ?? 'manual';
    }
  }

  const merged = {
    age: patch.age ?? current?.age ?? null,
    max_hr: maxHr.value,
    lthr: lthr.value,
    resting_hr: restHr.value,
    weight_kg: patch.weightKg ?? current?.weight_kg ?? null,
    goal_marathon_date: patch.marathonDate ?? current?.goal_marathon_date ?? null,
    lthr_source: lthr.source,
    max_hr_source: maxHr.source,
    resting_hr_source: restHr.source,
    updated_at: now,
    hr_zones_json: zonesJson,
    hr_zones_source: zonesSource,
  };

  if (!current) {
    db.prepare(
      `INSERT INTO profile (id, age, max_hr, lthr, resting_hr, weight_kg,
        goal_marathon_date, lthr_source, max_hr_source, resting_hr_source,
        hr_zones_json, hr_zones_source,
        created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      merged.age, merged.max_hr, merged.lthr, merged.resting_hr,
      merged.weight_kg, merged.goal_marathon_date,
      merged.lthr_source, merged.max_hr_source, merged.resting_hr_source,
      merged.hr_zones_json, merged.hr_zones_source,
      now, now
    );
  } else {
    db.prepare(
      `UPDATE profile SET
        age = ?, max_hr = ?, lthr = ?, resting_hr = ?, weight_kg = ?,
        goal_marathon_date = ?,
        lthr_source = ?, max_hr_source = ?, resting_hr_source = ?,
        hr_zones_json = ?, hr_zones_source = ?,
        updated_at = ?
       WHERE id = 1`
    ).run(
      merged.age, merged.max_hr, merged.lthr, merged.resting_hr,
      merged.weight_kg, merged.goal_marathon_date,
      merged.lthr_source, merged.max_hr_source, merged.resting_hr_source,
      merged.hr_zones_json, merged.hr_zones_source,
      now
    );
  }

  return getProfile(db);
}