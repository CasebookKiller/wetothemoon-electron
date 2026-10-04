// src/main/services/pranaBindu/mentat/workoutParser.ts
//
// Парсер текста тренировки: стандартный ICU-синтаксис + наши
// расширения (W1..W10, L1..L10). Возвращает ParsedWorkout.
//
// Что понимает:
//   - первую строку как name тренировки
//   - секции через пустые строки: "Warmup", "Main Set 10x", "5x"
//   - шаги: "- [cue] [Ns|Nm|Nh|Nmtr|Nkm] [Z1..Z7 [HR|Pace|Power]] [freeride]"
//   - префиксы W/L в cue: "Push-ups W3 30s Z2 Pace"
//   - автоматический zone из уровня, если зона не задана
//   - репиты секции (Main Set 10x) и репиты шага (пока не поддерживаются)

import {
  findLevelByName,
  levelToZone,
} from './exerciseCatalog';
import type {
  ParsedWorkout,
  WorkoutSection,
  WorkoutStep,
  StepPrefixKind,
} from './types';

// ==================== Регексы ====================

const RE_STEP = /^-\s*(.+)$/;
const RE_SECTION_REPS = /^(.*?)\s*(\d+)x\s*$/i;
const RE_JUST_REPS = /^(\d+)x$/i;
const RE_DURATION_TOKEN = /(\d+(?:\.\d+)?)\s*(h|mtr|km|m|s)\b/gi;
const RE_ZONE = /\bZ(\d)\b(?:\s*(HR|Pace|Power))?/i;
const RE_FREERIDE = /\bfreeride\b/i;
const RE_PREFIX = /\b([WL])(\d{1,2})\b/;

// ==================== Главная функция ====================

export function parseWorkoutText(text: string): ParsedWorkout {
  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''));

  // Первая непустая строка — название тренировки.
  let name = '';
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      name = lines[i].trim();
      startIdx = i + 1;
      break;
    }
  }

  // Разбиваем остаток на блоки по пустым строкам.
  const blocks: string[][] = [];
  let current: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  // Обрабатываем каждый блок.
  const sections: WorkoutSection[] = [];
  const flatSteps: WorkoutStep[] = [];

  for (const block of blocks) {
    const section = parseSectionBlock(block);
    if (!section) continue;
    sections.push(section);

    const repeats = section.reps && section.reps > 0 ? section.reps : 1;
    for (let r = 0; r < repeats; r++) {
      for (const step of section.steps) {
        flatSteps.push(step);
      }
    }
  }

  return { name, sections, flatSteps };
}

// ==================== Секция ====================

function parseSectionBlock(block: string[]): WorkoutSection | null {
  if (block.length === 0) return null;

  let name = '';
  let reps: number | undefined;
  let stepsStart = 0;

  const first = block[0];

  // Секция с явными reps без имени: "5x"
  if (RE_JUST_REPS.test(first)) {
    reps = Number(first.match(RE_JUST_REPS)![1]);
    stepsStart = 1;
  } else if (!first.startsWith('-')) {
    // Обычный заголовок секции, возможно "Main Set 10x"
    const m = first.match(RE_SECTION_REPS);
    if (m) {
      name = m[1].trim();
      reps = Number(m[2]);
    } else {
      name = first.trim();
    }
    stepsStart = 1;
  }

  const steps: WorkoutStep[] = [];
  for (let i = stepsStart; i < block.length; i++) {
    const step = parseStepLine(block[i]);
    if (step) steps.push(step);
  }

  // Если имя пустое и reps нет — это просто блок шагов без заголовка.
  // В этом случае возвращаем секцию с пустым name — она не сломает рендер.
  return { name, reps, steps };
}

// ==================== Шаг ====================

export function parseStepLine(line: string): WorkoutStep | null {
  const stepMatch = line.match(RE_STEP);
  if (!stepMatch) return null;

  const body = stepMatch[1].trim();
  if (!body) return null;

  const raw = line;

  // 1. Вытаскиваем все duration/distance токены.
  const tokens: Array<{ value: number; unit: string; index: number; len: number }> = [];
  RE_DURATION_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_DURATION_TOKEN.exec(body)) !== null) {
    tokens.push({
      value: Number(m[1]),
      unit: m[2].toLowerCase(),
      index: m.index,
      len: m[0].length,
    });
  }

  let durationSec = 0;
  let distanceM = 0;
  for (const t of tokens) {
    if (t.unit === 'h') durationSec += t.value * 3600;
    else if (t.unit === 'm') durationSec += t.value * 60;
    else if (t.unit === 's') durationSec += t.value;
    else if (t.unit === 'mtr') distanceM += t.value;
    else if (t.unit === 'km') distanceM += t.value * 1000;
  }

  // 2. Удаляем токены из текста — остаётся cue + zone + target.
  let rest = body;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    rest = rest.slice(0, t.index) + rest.slice(t.index + t.len);
  }
  rest = rest.replace(/\s+/g, ' ').trim();

  // 3. Извлекаем zone + target.
  let zone: number | undefined;
  let zoneTarget: 'hr' | 'pace' | 'power' | undefined;
  const zoneMatch = rest.match(RE_ZONE);
  if (zoneMatch) {
    zone = Number(zoneMatch[1]);
    if (zoneMatch[2]) {
      zoneTarget = zoneMatch[2].toLowerCase() as 'hr' | 'pace' | 'power';
    }
    rest =
      rest.slice(0, zoneMatch.index) +
      ' ' +
      rest.slice(zoneMatch.index! + zoneMatch[0].length);
    rest = rest.replace(/\s+/g, ' ').trim();
  }

  // 4. Убираем freeride.
  if (RE_FREERIDE.test(rest)) {
    rest = rest.replace(RE_FREERIDE, '').replace(/\s+/g, ' ').trim();
  }

  // 5. Ищем префикс W/L.
  let prefixKind: StepPrefixKind | undefined;
  let prefixLevel: number | undefined;
  const prefixMatch = rest.match(RE_PREFIX);
  if (prefixMatch) {
    prefixKind = prefixMatch[1].toUpperCase() as StepPrefixKind;
    prefixLevel = Number(prefixMatch[2]);
  }

  // 6. Если префикс есть, а zone нет — берём из levelToZone.
  if (prefixKind && prefixLevel != null && zone == null) {
    zone = levelToZone(prefixLevel);
    zoneTarget = zoneTarget ?? 'pace';
  }

  // 7. Опционально: сверяем префикс с каталогом — если имя уровня
  //    не совпадает, всё равно оставляем W/L как есть.
  if (prefixKind && prefixLevel != null) {
    const key =
      prefixKind === 'W'
        ? findLevelByName(rest.split(/\s+/)[0] ?? '')
        : undefined;
    // проверка ключа нужна только для UI-подсказки, не для парсинга.
    void key;
  }

  return {
    label: rest,
    prefixKind,
    prefixLevel,
    durationSec: durationSec > 0 ? Math.round(durationSec) : undefined,
    distanceM: distanceM > 0 ? Math.round(distanceM) : undefined,
    zone,
    zoneTarget,
    raw,
  };
}