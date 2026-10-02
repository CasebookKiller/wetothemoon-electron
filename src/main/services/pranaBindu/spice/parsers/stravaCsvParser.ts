// src/main/services/pranaBindu/spice/parsers/stravaCsvParser.ts
//
// Парсер Strava activities.csv (русская локаль).
// Контракт: buffer → RawWorkout[].
//
// Особенности файла:
//  - BOM в начале
//  - русские месяцы: «26 сент. 2026 г., 03:11:28»
//  - десятичная запятая: «7,20»
//  - запятые внутри кавычек (описания, названия)
//  - часовой пояс — локальное московское время (UTC+3)

import { parse } from 'csv-parse/sync';
import type { RawWorkout } from '../providers/types';

// Сокращения русских месяцев. Идут без точек (регулярка их срезает).
const MONTHS_RU: Record<string, number> = {
  янв: 1,
  фев: 2,
  февр: 2,
  мар: 3,
  апр: 4,
  май: 5,
  мая: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  сент: 9,
  окт: 10,
  ноя: 11,
  нояб: 11,
  дек: 12,
};

const MOSCOW_OFFSET_HOURS = 3;

export interface ParseStravaCsvOptions {
  /** Тип активности для фильтра. По умолчанию — «Бег». */
  sportFilter?: string;
}

function parseRuNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = String(s).replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parseStravaDate(s: string | undefined): string | null {
  if (!s) return null;
  // «26 сент. 2026 г., 03:11:28»
  const m = s.match(
    /^(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})\s+г\.,\s+(\d{1,2}):(\d{2}):(\d{2})$/i
  );
  if (!m) return null;

  const day = Number(m[1]);
  const month = MONTHS_RU[m[2].toLowerCase()];
  if (month == null) return null;
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const min = Number(m[5]);
  const sec = Number(m[6]);

  // CSV хранит локальное московское время. Переводим в UTC:
  // вычитаем 3 часа из часовой компоненты.
  const utcMs = Date.UTC(year, month - 1, day, hour - MOSCOW_OFFSET_HOURS, min, sec);
  return new Date(utcMs).toISOString();
}

/**
 * Из колонки «Название файла» вида «activities/21485879572.fit.gz»
 * извлекает числовой ID файла. Это тот же ID, что в external_id
 * у уже загруженных FIT/TCX-записей.
 */
function extractFileId(field: string | undefined): string | null {
  if (!field) return null;
  const m = String(field).match(/(\d+)\.(fit|tcx|gpx)(\.gz)?$/i);
  return m ? m[1] : null;
}

export function parseStravaCsv(
  buffer: Buffer,
  opts: ParseStravaCsvOptions = {}
): RawWorkout[] {
  const sportFilter = opts.sportFilter ?? 'Бег';

  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const out: RawWorkout[] = [];

  for (const r of rows) {
    const type = (r['Тип активности'] ?? '').trim();
    if (type !== sportFilter) continue;

    const fileField = (r['Название файла'] ?? '').trim();
    const fileId = extractFileId(fileField);
    if (!fileId) continue; // без файла не сможем дать стабильный external_id

    const startTime = parseStravaDate(r['Дата тренировки']);
    if (!startTime) continue;

    const distanceM = parseRuNumber(r['Дистанция']);
    const durationS = parseRuNumber(r['Время в движении']);
    const avgHr = parseRuNumber(r['Средний пульс']);
    const maxHr = parseRuNumber(r['Макс. пульс']);
    const name = (r['Название тренировки'] ?? '').trim() || undefined;

    const durationSInt = durationS != null ? Math.round(durationS) : undefined;
    const endTime = durationSInt != null
      ? new Date(new Date(startTime).getTime() + durationSInt * 1000).toISOString()
      : startTime;

    out.push({
      externalId: `strava-csv:${fileId}`,
      source: 'strava-csv',
      origin: 'strava-archive',
      name,
      startTime,
      endTime,
      distanceM: distanceM != null ? Math.round(distanceM) : undefined,
      durationS: durationSInt,
      avgHr: avgHr != null ? Math.round(avgHr) : undefined,
      maxHr: maxHr != null ? Math.round(maxHr) : undefined,
      raw: {
        stravaActivityId: r['ID физической активности'] ?? null,
        fileName: fileField,
        type,
        name,
        description: r['Описание физической активности'] ?? null,
        elevationGain: parseRuNumber(r['Набор высоты']) ?? null,
        calories: parseRuNumber(r['Калории']) ?? null,
        maxSpeed: parseRuNumber(r['Макс. скорость']) ?? null,
        avgSpeed: parseRuNumber(r['Средняя скорость']) ?? null,
        avgCadence: parseRuNumber(r['Средний каденс']) ?? null,
        weather: r['Погода'] ?? null,
        temperature: parseRuNumber(r['Температура воздуха']) ?? null,
      } as unknown as RawWorkout['raw'],
    });
  }

  return out;
}