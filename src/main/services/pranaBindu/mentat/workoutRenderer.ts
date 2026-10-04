// src/main/services/pranaBindu/mentat/workoutRenderer.ts
//
// Рендерер ParsedWorkout обратно в текст ICU.
// При экспорте в ICU сохраняем W/L-префиксы как cue-текст —
// ICU их принимает (проверено 2026-10-04).

import type { ParsedWorkout, WorkoutSection, WorkoutStep } from './types';

// ==================== Публичный API ====================

export function renderToIcu(parsed: ParsedWorkout): string {
  const parts: string[] = [];
  if (parsed.name) parts.push(parsed.name);

  for (const section of parsed.sections) {
    const text = renderSection(section);
    if (text) parts.push(text);
  }

  return parts.join('\n\n');
}

/** Рендер одной секции (включая заголовок, reps и все шаги). */
export function renderSection(section: WorkoutSection): string {
  const lines: string[] = [];

  if (section.name && section.reps && section.reps > 0) {
    lines.push(`${section.name} ${section.reps}x`);
  } else if (section.name) {
    lines.push(section.name);
  } else if (section.reps && section.reps > 0) {
    lines.push(`${section.reps}x`);
  }

  for (const step of section.steps) {
    lines.push(renderStep(step));
  }

  return lines.join('\n');
}

/** Рендер одного шага в строку ICU. */
export function renderStep(step: WorkoutStep): string {
  const parts: string[] = ['-'];

  if (step.label) parts.push(step.label);

  // Длительность/дистанция.
  if (step.distanceM != null && step.distanceM > 0) {
    parts.push(formatDistance(step.distanceM));
  } else if (step.durationSec != null && step.durationSec > 0) {
    parts.push(formatDuration(step.durationSec));
  }

  // Целевая зона.
  if (step.zone != null && step.zone > 0) {
    const target = step.zoneTarget
      ? ` ${step.zoneTarget.charAt(0).toUpperCase() + step.zoneTarget.slice(1)}`
      : '';
    parts.push(`Z${step.zone}${target}`);
  }

  return parts.join(' ');
}

// ==================== Утилиты форматирования ====================

export function formatDistance(m: number): string {
  if (m >= 1000 && m % 1000 === 0) return `${m / 1000}km`;
  if (m >= 1000) return `${(m / 1000).toFixed(2)}km`;
  return `${Math.round(m)}mtr`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join('');
}