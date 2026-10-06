// src/main/services/pranaBindu/mentat/programs.ts
//
// Сводный список всех программ — Wade + Runner + Cali.

import { WADE_PROGRAMS } from './wadePrograms';
import { RUNNER_PROGRAMS } from './runnerPrograms';
import { CALI_PROGRAMS } from './caliPrograms';
import { PREHAB_PROGRAMS } from './prehabPrograms';
import type { ProgramSpec, ProgramCategory } from './types';

export const ALL_PROGRAMS: ProgramSpec[] = [
  ...WADE_PROGRAMS,
  ...RUNNER_PROGRAMS,
  ...CALI_PROGRAMS,
  ...PREHAB_PROGRAMS,
];

export function findProgram(key: string): ProgramSpec | undefined {
  return ALL_PROGRAMS.find((p) => p.key === key);
}

export function listProgramsByCategory(cat: ProgramCategory): ProgramSpec[] {
  return ALL_PROGRAMS.filter((p) => p.category === cat);
}

export const CATEGORY_LABELS: Record<ProgramCategory, string> = {
  wade: 'Wade',
  runner: 'Runner',
  cali: 'Cali',
  prehab: 'Prehab',
};