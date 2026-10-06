// src/main/services/pranaBindu/mentat/wadeProgramGenerator.ts
//
// Универсальный генератор программ: Wade, Runner, Cali.
// Чистая функция: программа + уровни/ступени → массив превью-событий.
// Никаких IPC, никакой БД.

import {
  findProgressionsByKey,
  findNamedByKey,
  levelToZone,
} from './exerciseCatalog';
import type { ProgramSpec, ProgramDaySpec } from './types';

export interface MovementState {
  /** 1..10 — уровень прогрессии. */
  level: number;
  /** 1..3 — ступень внутри уровня (rung). */
  rung: number;
}

export interface ProgramPreviewEvent {
  date: string;
  dayLabel: string;
  lines: string[];
}

// ==================== Вспомогательные ====================

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso: string, delta: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + delta);
  return toIso(d);
}

function daysBetween(from: string, to: string): number {
  const a = parseIso(from).getTime();
  const b = parseIso(to).getTime();
  return Math.round((b - a) / 86400000);
}

function pickDayIndex(
  program: ProgramSpec,
  dateIso: string,
  fromIso: string
): number | null {
  if (program.weeklySchedule) {
    const d = parseIso(dateIso);
    const dow = (d.getDay() + 6) % 7;
    const idx = program.weeklySchedule[dow];
    return typeof idx === 'number' ? idx : null;
  }
  if (program.cyclePattern && program.cyclePattern.length > 0) {
    const offset = daysBetween(fromIso, dateIso);
    if (offset < 0) return null;
    const idx = program.cyclePattern[offset % program.cyclePattern.length];
    return typeof idx === 'number' ? idx : null;
  }
  return null;
}

/**
 * Собрать одну строку ICU для движения.
 * Универсальная: понимает прогрессии (W/L + ladder) и named (drills).
 */
function buildLine(
  movementKey: string,
  state: MovementState | undefined
): string | null {
  // 1. Прогрессия?
  const prog = findProgressionsByKey(movementKey);
  if (prog) {
    if (!state) return null;
    const lvl = prog.levels.find((l) => l.level === state.level);
    if (!lvl) return null;
    const rungStr = lvl.benchmarkLadder?.[state.rung - 1];
    if (!rungStr) return null;

    const prefix = prog.category === 'wade' ? 'W' : 'L';
    const zone = levelToZone(state.level);

    // Time-based ladder (30s / 60s / 120s) — это и есть duration.
    // Не дублируем: пишем "- Wall Headstands W1 30s Z1 Pace".
    const isTimeBased = /^\d+\s*s$/.test(rungStr);

    if (isTimeBased) {
      return `- ${lvl.name} ${prefix}${state.level} ${rungStr} Z${zone} Pace`;
    }

    // Rep-based ladder (1×10, [10,8,6]) — reps + duration 30s.
    return `- ${lvl.name} ${prefix}${state.level} ${rungStr} 30s Z${zone} Pace`;
  }

  // 2. Named-упражнение (drill / plyo / warmup / run-basic)?
  const named = findNamedByKey(movementKey);
  if (named) {
    const dur = named.defaultDuration ?? '30s';
    const zone = named.defaultZone ?? 1;
    return `- ${named.icuName} ${dur} Z${zone} Pace`;
  }

  return null;
}

// ==================== Публичный API ====================

export interface BuildPreviewOptions {
  program: ProgramSpec;
  states: Record<string, MovementState>;
  from: string;
  weeks: number;
}

export function buildProgramPreview(
  opts: BuildPreviewOptions
): ProgramPreviewEvent[] {
  const { program, states, from, weeks } = opts;
  const out: ProgramPreviewEvent[] = [];

  const totalDays = weeks * 7;
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(from, i);
    const dayIdx = pickDayIndex(program, date, from);
    if (dayIdx == null) continue;

    const dayDef: ProgramDaySpec | undefined = program.days[dayIdx];
    if (!dayDef) continue;

    const lines: string[] = [];
    for (const mk of dayDef.movementKeys) {
      const line = buildLine(mk, states[mk]);
      if (line) lines.push(line);
    }
    if (lines.length === 0) continue;

    out.push({ date, dayLabel: dayDef.label, lines });
  }

  return out;
}

export function buildEventText(
  programName: string,
  dayLabel: string,
  lines: string[]
): { name: string; description: string } {
  const name = `${programName} · ${dayLabel}`;
  const description = `${name}\n\n${lines.join('\n')}`;
  return { name, description };
}

/**
 * Какие прогрессии используются в программе.
 * Для UI: показать «Мои уровни» только для этих движений.
 */
export function listProgramProgressions(
  program: ProgramSpec
): string[] {
  const set = new Set<string>();
  for (const d of program.days) {
    for (const mk of d.movementKeys) {
      if (findProgressionsByKey(mk)) set.add(mk);
    }
  }
  return Array.from(set);
}