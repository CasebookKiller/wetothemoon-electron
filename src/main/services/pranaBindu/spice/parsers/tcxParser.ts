// src/main/services/pranaBindu/spice/parsers/tcxParser.ts
//
// Парсер TCX (Garmin Training Center XML).
// Strava-экспорт, Garmin Connect, Polar — все используют стандартную схему.
//
// Контракт: buffer → UnifiedWorkout (тот же, что у fitParser).

import { XMLParser } from 'fast-xml-parser';
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

export interface ParseTcxOptions {
  externalId: string;
}

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return null;
}

function mapSport(sport?: string): SportType {
  if (!sport) return 'other';
  const s = String(sport).toLowerCase();
  if (s === 'running' || s === 'run') return 'run';
  if (s === 'walking' || s === 'walk') return 'walk';
  if (s === 'biking' || s === 'cycling' || s === 'ride') return 'ride';
  return 'other';
}

export function parseTcx(
  buffer: Buffer,
  options: ParseTcxOptions
): UnifiedWorkout {
  const xml = buffer.toString('utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    isArray: (name) =>
      ['Activity', 'Lap', 'Track', 'Trackpoint'].includes(name),
    parseTagValue: true,
    parseAttributeValue: true,
  });

  const parsed = parser.parse(xml);
  const tcd = parsed?.TrainingCenterDatabase;
  const activities = tcd?.Activities?.Activity ?? [];
  if (!activities.length) throw new Error('TCX: Activity не найден');

  const activity = activities[0];
  const sport = mapSport(activity.Sport);
  const lapsRaw: any[] = activity.Lap ?? [];

  // Flatten всех Trackpoint из всех Lap.Track
  const tps: any[] = [];
  for (const lap of lapsRaw) {
    const tracks: any[] = lap.Track ?? [];
    for (const tr of tracks) {
      const tpArr: any[] = tr.Trackpoint ?? [];
      for (const tp of tpArr) tps.push(tp);
    }
  }
  if (tps.length < 2) throw new Error('TCX: недостаточно Trackpoint');

  // ===== Потоки =====
  const secT: number[] = [];
  const hr: (number | null)[] = [];
  const speedKmh: (number | null)[] = [];
  const cadence: (number | null)[] = [];
  const elevationM: (number | null)[] = [];
  const latlng: ([number, number] | null)[] = [];
  const distM: number[] = [];

  const firstTimeIso = toIso(tps[0].Time);
  const firstMs = firstTimeIso ? new Date(firstTimeIso).getTime() : Date.now();

  let acc = 0;
  let prevTimer: number | null = null;
  let prevSpeed: number | null = null;

  for (const tp of tps) {
    const timeIso = toIso(tp.Time);
    if (!timeIso) continue;
    const t = Math.round((new Date(timeIso).getTime() - firstMs) / 1000);
    secT.push(t);

    // HR
    const hrVal = tp.HeartRateBpm?.Value;
    hr.push(
      typeof hrVal === 'number' && hrVal > 30 ? Math.round(hrVal) : null
    );

    // Speed: TCX Extensions/TPX/Speed в м/с → км/ч
    const speedMsRaw =
      tp.Extensions?.TPX?.Speed ?? tp.Extensions?.ActivityExtension?.Speed;
    let sp: number | null = null;
    if (typeof speedMsRaw === 'number' && Number.isFinite(speedMsRaw)) {
      sp = Math.round(speedMsRaw * 3.6 * 100) / 100;
    }
    speedKmh.push(sp);

    // Cadence
    const cadVal = tp.Cadence;
    cadence.push(typeof cadVal === 'number' ? Math.round(cadVal) : null);

    // Elevation
    const alt = tp.AltitudeMeters;
    elevationM.push(typeof alt === 'number' ? Math.round(alt * 10) / 10 : null);

    // GPS
    const lat = tp.Position?.LatitudeDegrees;
    const lon = tp.Position?.LongitudeDegrees;
    if (typeof lat === 'number' && typeof lon === 'number') {
      latlng.push([lat, lon]);
    } else {
      latlng.push(null);
    }

    // DistanceMeters — из TCX, либо интеграция
    if (typeof tp.DistanceMeters === 'number') {
      acc = tp.DistanceMeters;
    } else if (prevTimer != null && prevSpeed != null && sp != null) {
      const dt = t - prevTimer;
      if (dt > 0) acc += ((prevSpeed + sp) / 2) * dt / 3.6;
    }
    distM.push(Math.round(acc));

    prevTimer = t;
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

  // ===== Session (в TCX сессии нет — считаем) =====
  // durationSec: сумма TotalTimeSeconds из лапов.
  // Если лапы есть, но время в них пусто (Strava-экспорты
  // некоторых устройств) — падаем на диапазон secT.
  let durationSec = lapsRaw.length
    ? lapsRaw.reduce((s, l) => s + (Number(l.TotalTimeSeconds) || 0), 0)
    : 0;
  if (durationSec <= 0 && secT.length >= 2) {
    durationSec = secT[secT.length - 1] - secT[0];
  }

  // distanceM: сумма DistanceMeters из лапов.
  // Если пусто — берём накопленное расстояние из trackpoint'ов.
  let distanceM = lapsRaw.length
    ? lapsRaw.reduce((s, l) => s + (Number(l.DistanceMeters) || 0), 0)
    : 0;
  if (distanceM <= 0) {
    distanceM = acc;
  }

  const hrValid = hr.filter((v): v is number => v != null);
  const avgHr = hrValid.length
    ? Math.round(hrValid.reduce((a, b) => a + b, 0) / hrValid.length)
    : undefined;
  const maxHr = hrValid.length ? Math.max(...hrValid) : undefined;

  const cadValid = cadence.filter((v): v is number => v != null && v > 0);
  const avgCadence = cadValid.length
    ? Math.round(cadValid.reduce((a, b) => a + b, 0) / cadValid.length)
    : undefined;
  const maxCadence = cadValid.length ? Math.max(...cadValid) : undefined;

  const spValid = speedKmh.filter((v): v is number => v != null && v >= 0);
  const avgSpeedKmh = spValid.length
    ? Math.round((spValid.reduce((a, b) => a + b, 0) / spValid.length) * 100) /
      100
    : undefined;
  const maxSpeedKmh = spValid.length ? Math.max(...spValid) : undefined;

  // Elevation gain/loss — из потока
  let elevationGain = 0;
  let elevationLoss = 0;
  for (let i = 1; i < elevationM.length; i++) {
    const a = elevationM[i - 1];
    const b = elevationM[i];
    if (a == null || b == null) continue;
    const d = b - a;
    if (d > 0) elevationGain += d;
    else elevationLoss += -d;
  }

  // GPS
  const coveragePct = computeCoveragePct(latlng);
  const gpsDistanceM =
    coveragePct > 0 ? Math.round(computeGpsDistanceM(latlng)) : undefined;
  const accelDistanceM = distanceM > 0 ? Math.round(distanceM) : undefined;
  let deltaPct: number | undefined;
  if (gpsDistanceM != null && accelDistanceM != null && accelDistanceM > 0) {
    deltaPct =
      Math.round(((gpsDistanceM - accelDistanceM) / accelDistanceM) * 1000) /
      10;
  }
  const gpsQuality = classifyGps(coveragePct, deltaPct ?? null);
  const distanceSource = gpsQuality === 'good' ? 'gps' : 'accelerometer';

  // ===== Laps =====
  const laps: UnifiedLap[] = lapsRaw.map((l, i) => ({
    index: i,
    distanceM:
      typeof l.DistanceMeters === 'number'
        ? Math.round(l.DistanceMeters)
        : undefined,
    durationSec:
      typeof l.TotalTimeSeconds === 'number'
        ? Math.round(l.TotalTimeSeconds)
        : undefined,
    avgHr:
      typeof l.AverageHeartRateBpm?.Value === 'number'
        ? Math.round(l.AverageHeartRateBpm.Value)
        : undefined,
    maxHr:
      typeof l.MaximumHeartRateBpm?.Value === 'number'
        ? Math.round(l.MaximumHeartRateBpm.Value)
        : undefined,
    avgSpeedKmh:
      typeof l.DistanceMeters === 'number' &&
      typeof l.TotalTimeSeconds === 'number' &&
      l.TotalTimeSeconds > 0
        ? Math.round((l.DistanceMeters / l.TotalTimeSeconds) * 3.6 * 100) / 100
        : undefined,
  }));

  const summary: UnifiedWorkout['summary'] = {
    avgHr,
    maxHr,
    avgSpeedKmh,
    maxSpeedKmh,
    avgCadence,
    maxCadence,
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
    gpsQuality,
    distanceSource,
    gpsCoveragePct: Math.round(coveragePct * 10) / 10,
    gpsDistanceM,
    accelDistanceM,
    distanceDeltaPct: deltaPct,
  };

  const startTime =
    toIso(activity.Id) ?? firstTimeIso ?? new Date().toISOString();

  const workout: UnifiedWorkout = {
    source: 'tcx',
    externalId: options.externalId,
    startTime,
    durationSec: Math.round(durationSec),
    distanceM: Math.round(distanceM),
    sport,
    streams,
    summary,
    validation: { flags: [], confidence: 100 },
    laps,
  };

  workout.validation = validateWorkout(workout);
  return workout;
}