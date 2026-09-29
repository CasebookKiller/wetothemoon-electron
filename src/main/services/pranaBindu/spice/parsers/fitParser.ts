// src/main/services/pranaBindu/spice/parsers/fitParser.ts
//
// Парсер FIT (Zepp/Amazfit, Garmin, Coros и т.д.).
// Контракт: buffer → UnifiedWorkout.

import FitParser from 'fit-file-parser';
import type {
  UnifiedWorkout,
  UnifiedStreams,
  UnifiedLap,
  SportType,
} from './types';
import {
  computeGpsDistanceM,
  computeCoveragePct,
  classifyGps,
} from './gpsClassifier';
import { validateWorkout } from '../validation/workoutValidator';

export interface ParseFitOptions {
  externalId: string;
}

function mapSport(sport?: string): SportType {
  if (!sport) return 'other';
  const s = sport.toLowerCase();
  if (s === 'running' || s === 'run') return 'run';
  if (s === 'walking' || s === 'walk') return 'walk';
  if (s === 'cycling' || s === 'biking' || s === 'ride') return 'ride';
  return 'other';
}

function positiveOrNull(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v > 0 ? v : null;
}

/**
 * Парсит FIT-файл. Возвращает UnifiedWorkout.
 * fit-file-parser — callback-based, оборачиваем в Promise.
 */
export function parseFit(
  buffer: Buffer,
  options: ParseFitOptions
): Promise<UnifiedWorkout> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'list',
    });

    // fit-file-parser: err — string | undefined, data — FitData.
    // Сигнатура нестандартная (не Node-style), поэтому параметры
    // именуем в их терминах.
    parser.parse(buffer as any, (error: string | undefined, data: any) => {
      if (error) return reject(new Error(error));
      try {
        resolve(buildUnifiedWorkout(data, options));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function buildUnifiedWorkout(
  data: any,
  options: ParseFitOptions
): UnifiedWorkout {
  const session = data?.sessions?.[0];
  if (!session) throw new Error('FIT: session не найден');

  const records: any[] = Array.isArray(data.records) ? data.records : [];
  if (records.length < 2) throw new Error('FIT: недостаточно records');

  // === Агрегаты из session ===
  const startTime: string = session.start_time ?? records[0].timestamp;
  const durationSec: number = Math.round(session.total_timer_time ?? 0);
  const distanceM: number = Math.round(session.total_distance ?? 0);
  const sport = mapSport(session.sport);

  // === Потоки из records ===
  const secT: number[] = [];
  const hr: (number | null)[] = [];
  const speedKmh: (number | null)[] = [];
  const cadence: (number | null)[] = [];
  const elevationM: (number | null)[] = [];
  const latlng: ([number, number] | null)[] = [];
  const distM: number[] = [];

  let acc = 0;
  let prevTimer: number | null = null;
  let prevSpeed: number | null = null;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const timer = typeof r.timer_time === 'number' ? r.timer_time : null;
    if (timer == null) continue;

    secT.push(timer);

    hr.push(
      typeof r.heart_rate === 'number' && r.heart_rate > 30
        ? Math.round(r.heart_rate)
        : null
    );

    const sp =
      typeof r.speed === 'number' && Number.isFinite(r.speed)
        ? Math.round(r.speed * 100) / 100
        : null;
    speedKmh.push(sp);

    const cad =
      typeof r.cadence256 === 'number'
        ? Math.round(r.cadence256)
        : typeof r.cadence === 'number'
        ? Math.round(r.cadence)
        : null;
    cadence.push(cad);

    elevationM.push(
      typeof r.enhanced_altitude === 'number'
        ? Math.round(r.enhanced_altitude * 10) / 10
        : typeof r.altitude === 'number'
        ? Math.round(r.altitude * 10) / 10
        : null
    );

    if (
      typeof r.position_lat === 'number' &&
      typeof r.position_long === 'number'
    ) {
      latlng.push([r.position_lat, r.position_long]);
    } else {
      latlng.push(null);
    }

    // Интеграция дистанции: speed(km/h) * dt(sec) / 3.6
    if (prevTimer != null && prevSpeed != null && sp != null) {
      const dt = timer - prevTimer;
      if (dt > 0) {
        // среднее между предыдущей и текущей скоростью
        const avgSpeed = (prevSpeed + sp) / 2;
        acc += (avgSpeed * dt) / 3.6;
      }
    }
    distM.push(Math.round(acc));

    prevTimer = timer;
    prevSpeed = sp;
  }

  const streams: UnifiedStreams = {
    secT,
    hr,
    speedKmh,
    cadence,
    elevationM,
    latlng,
    distM,
  };

  // === Лапы ===
  const laps: UnifiedLap[] = (data.laps ?? []).map((l: any, i: number) => ({
    index: i,
    distanceM:
      typeof l.total_distance === 'number'
        ? Math.round(l.total_distance)
        : undefined,
    durationSec:
      typeof l.total_timer_time === 'number'
        ? Math.round(l.total_timer_time)
        : undefined,
    avgHr:
      typeof l.avg_heart_rate === 'number'
        ? Math.round(l.avg_heart_rate)
        : undefined,
    maxHr:
      typeof l.max_heart_rate === 'number'
        ? Math.round(l.max_heart_rate)
        : undefined,
    avgSpeedKmh:
      typeof l.avg_speed === 'number'
        ? Math.round(l.avg_speed * 100) / 100
        : undefined,
  }));

  // === GPS-метрики ===
  const coveragePct = computeCoveragePct(latlng);
  const gpsDistanceM =
    coveragePct > 0 ? Math.round(computeGpsDistanceM(latlng)) : undefined;
  const accelDistanceM = distanceM > 0 ? distanceM : undefined;

  let deltaPct: number | undefined;
  if (
    gpsDistanceM != null &&
    accelDistanceM != null &&
    accelDistanceM > 0
  ) {
    deltaPct =
      Math.round(((gpsDistanceM - accelDistanceM) / accelDistanceM) * 1000) /
      10;
  }

  const gpsQuality = classifyGps(coveragePct, deltaPct ?? null);
  const distanceSource =
    gpsQuality === 'good' ? 'gps' : 'accelerometer';

  // === Дополнительные агрегаты, если session не дал ===
  const hrValid = hr.filter((v): v is number => v != null);
  const avgHrSession = session.avg_heart_rate;
  const maxHrSession = session.max_heart_rate;

  const avgHr =
    typeof avgHrSession === 'number'
      ? Math.round(avgHrSession)
      : hrValid.length > 0
      ? Math.round(hrValid.reduce((a, b) => a + b, 0) / hrValid.length)
      : undefined;
  const maxHr =
    typeof maxHrSession === 'number'
      ? Math.round(maxHrSession)
      : hrValid.length > 0
      ? Math.max(...hrValid)
      : undefined;

  const cadValid = cadence.filter((v): v is number => v != null && v > 0);
  const avgCadence =
    typeof session.avg_cadence === 'number'
      ? Math.round(session.avg_cadence)
      : cadValid.length > 0
      ? Math.round(cadValid.reduce((a, b) => a + b, 0) / cadValid.length)
      : undefined;
  const maxCadence =
    typeof session.max_cadence === 'number'
      ? Math.round(session.max_cadence)
      : cadValid.length > 0
      ? Math.max(...cadValid)
      : undefined;

  const summary = {
    avgHr,
    maxHr,
    avgSpeedKmh:
      typeof session.avg_speed === 'number'
        ? Math.round(session.avg_speed * 100) / 100
        : undefined,
    maxSpeedKmh:
      typeof session.max_speed === 'number'
        ? Math.round(session.max_speed * 100) / 100
        : undefined,
    avgCadence,
    maxCadence,
    elevationGain:
      typeof session.total_ascent === 'number'
        ? Math.round(session.total_ascent)
        : undefined,
    elevationLoss:
      typeof session.total_descent === 'number'
        ? Math.round(session.total_descent)
        : undefined,
    gpsQuality,
    distanceSource,
    gpsCoveragePct: Math.round(coveragePct * 10) / 10,
    gpsDistanceM,
    accelDistanceM,
    distanceDeltaPct: deltaPct,
  } as UnifiedWorkout['summary'];

  const workout: UnifiedWorkout = {
    source: 'fit',
    externalId: options.externalId,
    startTime,
    durationSec,
    distanceM,
    sport,
    streams,
    summary,
    validation: { flags: [], confidence: 100 },
    laps,
  };

  workout.validation = validateWorkout(workout);
  return workout;
}