// src/main/services/kaddumpStorage.ts

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { encode, decode } from '@msgpack/msgpack';

export type KadDumpKind = 'cases_by_inn' | 'card';

const DUMPS_ROOT = () => path.join(app.getPath('userData'), 'raw_dumps', 'kad');

/**
 * Шардирование по ключу.
 *
 * - cases_by_inn: shard = первые 2 цифры ИНН = код региона РФ.
 *   (77 = Москва, 50 = МО, 78 = СПб, ...)
 * - card: shard = год регистрации дела (4 цифры из номера).
 *
 * shardHint обязателен для 'card'. Для 'cases_by_inn' вычисляется из ключа.
 */
function shardFor(
  kind: KadDumpKind,
  key: string,
  shardHint?: string
): string {
  if (kind === 'card') {
    return shardHint && /^\d{4}$/.test(shardHint) ? shardHint : 'unknown_year';
  }
  const clean = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  const region = clean.slice(0, 2);
  return /^\d{2}$/.test(region) ? region : 'misc';
}

function dumpDir(kind: KadDumpKind, key: string, shardHint?: string): string {
  return path.join(DUMPS_ROOT(), kind, shardFor(kind, key, shardHint));
}

/**
 * Предсказуемый путь по (kind, key, shardHint).
 * Узел сети сможет запросить файл, зная только эти три параметра.
 */
export function kadDumpPath(
  kind: KadDumpKind,
  key: string,
  shardHint?: string
): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(dumpDir(kind, key, shardHint), `${safeKey}.msgpack`);
}

export interface SavedKadDump {
  filePath: string;
  sizeBytes: number;
  shard: string;
  kind: KadDumpKind;
  key: string;
}

/**
 * Атомарная запись: tmp-файл + rename.
 * Падение в процессе не оставит битый дамп.
 */
export function saveKadDumpSync(
  kind: KadDumpKind,
  key: string,
  data: any,
  shardHint?: string
): SavedKadDump {
  const shard = shardFor(kind, key, shardHint);
  const dir = dumpDir(kind, key, shardHint);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = kadDumpPath(kind, key, shardHint);
  const tmpPath = `${filePath}.tmp.${process.pid}`;

  const buffer = encode(data);
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, filePath);

  const stat = fs.statSync(filePath);
  return { filePath, sizeBytes: stat.size, shard, kind, key };
}

export function loadKadDumpSync(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Дамп не найден: ${filePath}`);
  }
  return decode(fs.readFileSync(filePath));
}

export function deleteKadDumpFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) {
    console.warn('[kad-dumps] Не удалось удалить файл:', (e as Error).message);
  }
  return false;
}

export function isSameLocalDay(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Извлекает год из номера дела.
 *
 * Форматы:
 *   "А40-283253/2026"  → "2026"
 *   "А40-283253-2026"  → "2026"
 *   "А40-283253/26"    → "2026"  (двухзначный → 20XX)
 *   прочее             → "unknown_year"
 */
export function extractCaseYear(caseNumber: string): string {
  if (!caseNumber) return 'unknown_year';
  const m = caseNumber.match(/[/\-](\d{2,4})\s*$/);
  if (!m) return 'unknown_year';
  const raw = m[1];
  if (raw.length === 4) return raw;
  if (raw.length === 2) return `20${raw}`;
  return 'unknown_year';
}

/**
 * Стабильный ID дампа для будущего P2P.
 * Примеры:
 *   kad/cases_by_inn/77/7702059128
 *   kad/card/2026/a0fe2606-c33c-4787-9d59-79b56617ac01
 */
export function kadDumpId(
  kind: KadDumpKind,
  key: string,
  shardHint?: string
): string {
  const shard = shardFor(kind, key, shardHint);
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `kad/${kind}/${shard}/${safeKey}`;
}

/**
 * Обратный разбор kadDumpId → { kind, shard, key }.
 * Нужен при приёме дампов от других узлов (P2P).
 */
export function parseKadDumpId(dumpId: string): {
  kind: KadDumpKind;
  shard: string;
  key: string;
} | null {
  const m = dumpId.match(/^kad\/(cases_by_inn|card)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { kind: m[1] as KadDumpKind, shard: m[2], key: m[3] };
}