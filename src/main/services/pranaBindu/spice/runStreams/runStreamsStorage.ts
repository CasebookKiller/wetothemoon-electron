// src/main/services/pranaBindu/spice/runStreams/runStreamsStorage.ts
//
// Файловое хранилище run_streams (MessagePack).
// Паттерн как у OSINT rawStorage.ts — payload в .msgpack,
// метаданные в SQLite (run_streams).
//
// app.getPath('userData') — единственная причина, почему файл вообще
// видит Electron. Всё остальное — чистый Node.

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { encode, decode } from '@msgpack/msgpack';

export interface RunStreamsPayload {
  [key: string]: unknown;
}

export interface SavedRunStreams {
  filePath: string;
  sizeBytes: number;
  pointCount: number;
  channels: string;
}

/**
 * Извлекает метаданные из payload:
 *  - pointCount = максимальная длина числового массива верхнего уровня;
 *  - channels   = список ключей верхнего уровня с массивами чисел.
 */
function extractMeta(payload: RunStreamsPayload): {
  pointCount: number;
  channels: string;
} {
  let pointCount = 0;
  const channels: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    if (!Array.isArray(value) || value.length === 0) continue;

    // Массив числовой, если каждый элемент либо number, либо null/undefined.
    // Так мы ловим и чистые number[], и (number|null)[] из FIT-парсера.
    let numeric = true;
    for (const v of value) {
      if (v === null || v === undefined) continue;
      if (typeof v !== 'number') {
        numeric = false;
        break;
      }
    }
    if (!numeric) continue;

    channels.push(key);
    if (value.length > pointCount) pointCount = value.length;
  }

  return { pointCount, channels: channels.join(',') };
}

/**
 * Сохраняет payload в файл .msgpack.
 * Путь: {userData}/prana_bindu/run_streams/{source}/{YYYY}/{runFactId}.msgpack
 *
 * Идемпотентно: повторный вызов перезаписывает файл.
 */
export function saveRunStreamsSync(
  runFactId: number,
  source: string,
  dateIso: string,
  payload: RunStreamsPayload
): SavedRunStreams {
  const year = (dateIso || '').slice(0, 4) || String(new Date().getFullYear());

  const dir = path.join(
    app.getPath('userData'),
    'prana_bindu',
    'run_streams',
    source,
    year
  );
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${runFactId}.msgpack`);
  const buffer = encode(payload);
  fs.writeFileSync(filePath, buffer);

  const stat = fs.statSync(filePath);
  const meta = extractMeta(payload);

  return {
    filePath,
    sizeBytes: stat.size,
    pointCount: meta.pointCount,
    channels: meta.channels,
  };
}

/**
 * Читает payload из файла. Возвращает null, если файла нет.
 */
export function loadRunStreamsSync(
  filePath: string
): RunStreamsPayload | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const buffer = fs.readFileSync(filePath);
    return decode(buffer) as RunStreamsPayload;
  } catch (e) {
    console.error(`[runStreamsStorage] Ошибка чтения ${filePath}:`, e);
    return null;
  }
}

/** Удаляет файл, игнорирует отсутствие. */
export function deleteRunStreamsFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn(`[runStreamsStorage] Не удалось удалить ${filePath}:`, e);
  }
}