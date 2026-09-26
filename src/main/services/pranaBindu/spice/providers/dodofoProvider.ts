// src/main/services/pranaBindu/spice/providers/dodofoProvider.ts
//
// Основной провайдер тренировочных данных через dodofo.ru.
// Bearer-токен (dodofo_…) хранится в sync_settings (зашифрован
// через safeStorage). Расшифровка — снаружи, в handler; сюда
// приходит уже готовая функция getToken().

import type { ZeppDataProvider, ProviderCheckResult, RawWorkout } from './types';
import {
  dodofoRequest,
  DodofoApiError,
  type DodofoActivitiesResponse,
  type DodofoActivity,
  type DodofoThresholdsResponse,
  type DodofoStreams,
} from './dodofoClient';

const MAX_PAGES = 20;

/**
 * Транспортные виды спорта в dodofo, которые нам интересны.
 * Всё остальное (ride, virtual_ride, …) фильтруем на стороне Core.
 */
const RUN_SPORTS = new Set(['run', 'trail_run', 'treadmill_run']);

function activityToRawWorkout(a: DodofoActivity): RawWorkout {
  const startTime = a.started_at ?? new Date().toISOString();
  const durationS = a.duration_s ?? a.moving_time_s ?? 0;
  const endTime = new Date(
    new Date(startTime).getTime() + durationS * 1000
  ).toISOString();

  return {
    externalId: `dodofo:${a.id}`,
    source: 'dodofo',
    startTime,
    endTime,
    distanceM: a.distance_m ?? undefined,
    durationS: durationS || undefined,
    avgHr: a.avg_hr ?? undefined,
    // max_hr в списке активностей не отдаётся — только через /streams.
    raw: a,
  };
}

export class DodofoProvider implements ZeppDataProvider {
  readonly name = 'dodofo';

  /**
   * Колбэк, возвращающий уже расшифрованный Bearer-токен.
   * Handler создаёт его поверх safeStorage + Melange.
   */
  private readonly getToken: () => string | null;

  constructor(getToken: () => string | null) {
    this.getToken = getToken;
  }

  async isAvailable(): Promise<ProviderCheckResult> {
    const token = this.getToken();
    if (!token) {
      return { available: false, reason: 'token not configured' };
    }
    try {
      // /me/thresholds — самый лёгкий авторизованный эндпоинт.
      await dodofoRequest('/api/v1/me/thresholds', token);
      return { available: true };
    } catch (e) {
      if (e instanceof DodofoApiError) {
        if (e.status === 401) {
          return { available: false, reason: 'invalid token' };
        }
        return { available: false, reason: `${e.status} ${e.title }` };
      }
      return { available: false, reason: (e as Error).message };
    }
  }

  /**
   * Тренировки за диапазон дат (YYYY-MM-DD).
   * Фильтр на стороне dodofo: sport_type=run отсекает вело/прогулки,
   * но на всякий случай проверяем ещё и здесь.
   */
  async fetchWorkouts(from: string, to: string): Promise<RawWorkout[]> {
    const token = this.getToken();
    if (!token) throw new Error('dodofo token not configured');

    const result: RawWorkout[] = [];
    let page = 1;

    while (page <= MAX_PAGES) {
      const res = await dodofoRequest<DodofoActivitiesResponse>(
        '/api/v1/activities',
        token,
        { from, to, sport_type: 'run', page }
      );

      for (const a of res.activities ?? []) {
        if (a.status !== 'ready') continue;
        if (a.sport_type && !RUN_SPORTS.has(a.sport_type)) continue;
        result.push(activityToRawWorkout(a));
      }

      if (!res.has_more) break;
      page += 1;
    }

    return result;
  }

  // ==================== Дополнительные данные (не из интерфейса) ====================

  /**
   * Пороги атлета: LTHR, HRmax, RestHR — нужны Prana-Bindu Core
   * для расчёта зон. Используется слоем 07_SPICE.
   */
  async fetchThresholds(): Promise<DodofoThresholdsResponse> {
    const token = this.getToken();
    if (!token) throw new Error('dodofo token not configured');
    return await dodofoRequest<DodofoThresholdsResponse>(
      '/api/v1/me/thresholds',
      token
    );
  }

  /**
   * Потоки одной активности (пульс, темп, зоны Коггана).
   * Боевое использование — 07_SPICE.
   */
  async fetchStreams(activityId: number): Promise<DodofoStreams> {
    const token = this.getToken();
    if (!token) throw new Error('dodofo token not configured');
    return await dodofoRequest<DodofoStreams>(
      `/api/v1/activities/${activityId}/streams`,
      token
    );
  }
}