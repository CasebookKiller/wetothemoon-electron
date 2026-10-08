// src/main/services/pranaBindu/mentat/workoutMatcher.ts
//
// Реверс-маппинг ICU-строки обратно в каталожное движение.
// Вход: '- Incline Push-ups W2 2×20 30s Z1 Pace' или WorkoutStep.
// Выход: { movementKey, level, rung, confidence, ... }.
//
// Используется для:
//   - импорта чужих планов из ICU (plan_events.icu_workout_json.steps),
//   - связывания plan_event ↔ exercise_progress,
//   - будущей интеграции с Live-журналом (когда он появится).
//
// Если строка не распознана — confidence: 'none', raw как есть.
// Никакого fuzzy: лучше честно показать «не распознано», чем
// связать с неправильным уровнем.

import {
  PROGRESSIONS_CATALOG,
  NAMED_EXERCISES,
} from './exerciseCatalog';
import { parseWorkoutText, parseStepLine } from './workoutParser';
import type { WorkoutStep } from './types';

export type MatchConfidence = 'full' | 'partial' | 'none';
export type MatchKind = 'progression' | 'named' | null;

export interface IcuLineMatch {
  raw: string;
  /** Очищенный текст без W/L-префикса — то, что искали в каталоге. */
  cleanLabel: string;

  movementKey: string | null;
  kind: MatchKind;

  level: number | null;
  rung: number | null;

  /** Из сырой строки. */
  durationSec: number | null;
  distanceM: number | null;
  sets: number | null;
  reps: number | number[] | null;
  zone: number | null;
  zoneTarget: 'hr' | 'pace' | 'power' | null;

  confidence: MatchConfidence;
  /** Диагностика: если full/partial, но с оговоркой (напр. конфликт W/L). */
  note?: string;
}

// ==================== Вспомогательные ====================

const RE_WL = /\b[WL]\d{1,2}\b/g;
/** L/R-суффикс (Pistol Squats L → Pistol Squats). */
const RE_LR_SUFFIX = /\s+(L|R)$/i;

/**
 * Нормализация имени для сравнения:
 * - W/L-префикс срезаем (W2, L5);
 * - L/R-суффикс срезаем (Pistol Squats L → Pistol Squats);
 * - дефисы превращаем в пробелы (Single-Leg RDL → single leg rdl);
 * - схлопываем пробелы и lower().
 *
 * Это НЕ fuzzy — только нормализация пунктуации.
 */
function normalizeName(label: string): string {
  return label
    .replace(RE_WL, '')
    .replace(RE_LR_SUFFIX, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripPrefix(label: string): string {
  // Только для читаемого cleanLabel.
  let s = label.replace(RE_WL, '').replace(/\s+/g, ' ').trim();
  s = s.replace(RE_LR_SUFFIX, '').trim();
  return s;
}

/**
 * Совпадает ли cleanLabel с name (или одним из aliases).
 * Сравнение — через normalizeName: дефисы, регистр и L/R не важны.
 */
function nameMatches(
  cleanLabel: string,
  name: string,
  aliases?: string[]
): boolean {
  const target = normalizeName(cleanLabel);
  if (normalizeName(name) === target) return true;
  if (aliases) {
    for (const a of aliases) {
      if (normalizeName(a) === target) return true;
    }
  }
  return false;
}

function findRung(
  ladder: string[] | undefined,
  sets: number | undefined,
  reps: number | number[] | undefined,
  durationSec: number | undefined
): number | null {
  if (!ladder || ladder.length === 0) return null;

  // Reps-based: '1x10', '2x20', '3x40'
  if (typeof reps === 'number' && sets != null && sets > 0 && reps > 0) {
    const candidate = `${sets}x${reps}`;
    const idx = ladder.findIndex(
      (v) => v.toLowerCase() === candidate.toLowerCase()
    );
    if (idx >= 0) return idx + 1;
  }

  // Time-based: '30s', '60s', '120s'
  if (durationSec != null && durationSec > 0) {
    const candidate = `${Math.round(durationSec)}s`;
    const idx = ladder.findIndex(
      (v) => v.toLowerCase() === candidate.toLowerCase()
    );
    if (idx >= 0) return idx + 1;
  }

  return null;
}

function emptyMatch(raw: string): IcuLineMatch {
  return {
    raw,
    cleanLabel: raw.trim(),
    movementKey: null,
    kind: null,
    level: null,
    rung: null,
    durationSec: null,
    distanceM: null,
    sets: null,
    reps: null,
    zone: null,
    zoneTarget: null,
    confidence: 'none',
  };
}

// ==================== Матчинг одного шага ====================

function buildMatch(raw: string, step: WorkoutStep): IcuLineMatch {
  const cleanLabel = stripPrefix(step.label ?? '');

  // 1. Прогрессия по точному levels[].name.
  //    Приоритет — тут мы знаем level и (возможно) rung.
  for (const entry of PROGRESSIONS_CATALOG) {
    for (const lvl of entry.levels) {
      if (!nameMatches(cleanLabel, lvl.name, lvl.aliases)) continue;

      const rung = findRung(
        lvl.benchmarkLadder,
        step.sets,
        step.reps,
        step.durationSec
      );

      // Проверка W/L-префикса — если он есть, должен совпадать
      // с category и level из каталога.
      if (step.prefixKind && step.prefixLevel != null) {
        const expectedPrefix = entry.category === 'wade' ? 'W' : 'L';
        if (
          step.prefixKind !== expectedPrefix ||
          step.prefixLevel !== lvl.level
        ) {
          return {
            raw,
            cleanLabel,
            movementKey: entry.key,
            kind: 'progression',
            level: lvl.level,
            rung,
            durationSec: step.durationSec ?? null,
            distanceM: step.distanceM ?? null,
            sets: step.sets ?? null,
            reps: step.reps ?? null,
            zone: step.zone ?? null,
            zoneTarget: step.zoneTarget ?? null,
            confidence: 'partial',
            note: `W/L ${step.prefixKind}${step.prefixLevel} не совпадает с ${expectedPrefix}${lvl.level}`,
          };
        }
      }

      return {
        raw,
        cleanLabel,
        movementKey: entry.key,
        kind: 'progression',
        level: lvl.level,
        rung,
        durationSec: step.durationSec ?? null,
        distanceM: step.distanceM ?? null,
        sets: step.sets ?? null,
        reps: step.reps ?? null,
        zone: step.zone ?? null,
        zoneTarget: step.zoneTarget ?? null,
        confidence: 'full',
      };
    }
  }

  // 2. Named-упражнение (drill / plyo / warmup / run-basic / prehab).
  for (const named of NAMED_EXERCISES) {
    if (!nameMatches(cleanLabel, named.icuName, named.aliases)) continue;
    return {
      raw,
      cleanLabel,
      movementKey: named.key,
      kind: 'named',
      level: null,
      rung: null,
      durationSec: step.durationSec ?? null,
      distanceM: step.distanceM ?? null,
      sets: step.sets ?? null,
      reps: step.reps ?? null,
      zone: step.zone ?? null,
      zoneTarget: step.zoneTarget ?? null,
      confidence: 'full',
    };
  }

  // 3. Прогрессия по icuName — level из строки определить нельзя.
  for (const entry of PROGRESSIONS_CATALOG) {
    if (!nameMatches(cleanLabel, entry.icuName, entry.aliases)) continue;
    return {
      raw,
      cleanLabel,
      movementKey: entry.key,
      kind: 'progression',
      level: null,
      rung: null,
      durationSec: step.durationSec ?? null,
      distanceM: step.distanceM ?? null,
      sets: step.sets ?? null,
      reps: step.reps ?? null,
      zone: step.zone ?? null,
      zoneTarget: step.zoneTarget ?? null,
      confidence: 'partial',
      note: 'имя совпало с icuName — уровень не определён',
    };
  }

  // 4. Ничего не нашли.
  return {
    raw,
    cleanLabel,
    movementKey: null,
    kind: null,
    level: null,
    rung: null,
    durationSec: step.durationSec ?? null,
    distanceM: step.distanceM ?? null,
    sets: step.sets ?? null,
    reps: step.reps ?? null,
    zone: step.zone ?? null,
    zoneTarget: step.zoneTarget ?? null,
    confidence: 'none',
  };
}

/** Распознать одну ICU-строку (с префиксом `- ` или без). */
export function matchIcuLine(raw: string): IcuLineMatch {
  const trimmed = raw.trim();
  if (!trimmed) return emptyMatch(raw);
  const normalized = trimmed.startsWith('-') ? trimmed : `- ${trimmed}`;
  const step = parseStepLine(normalized);
  if (!step) return emptyMatch(raw);
  return buildMatch(raw, step);
}

/** Распознать шаг из уже разобранного ParsedWorkout. */
export function matchIcuStep(step: WorkoutStep): IcuLineMatch {
  return buildMatch(step.raw ?? step.label ?? '', step);
}

export interface IcuWorkoutMatch {
  name: string;
  steps: IcuLineMatch[];
  summary: {
    total: number;
    full: number;
    partial: number;
    none: number;
  };
}

/** Распознать целиком текст ICU-тренировки. */
export function matchIcuWorkout(text: string): IcuWorkoutMatch {
  const parsed = parseWorkoutText(text);
  const steps = parsed.flatSteps.map(matchIcuStep);
  return {
    name: parsed.name,
    steps,
    summary: {
      total: steps.length,
      full: steps.filter((s) => s.confidence === 'full').length,
      partial: steps.filter((s) => s.confidence === 'partial').length,
      none: steps.filter((s) => s.confidence === 'none').length,
    },
  };
}