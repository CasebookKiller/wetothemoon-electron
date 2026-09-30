// src/main/services/pranaBindu/spice/providers/intervalsIcuProvider.ts
//
// Intervals.icu — wellness, activities, events (план тренировок).
// Auth: Basic. Логин — литерал 'API_KEY', пароль — реальный ключ.

import type {
  ZeppDataProvider,
  ProviderCheckResult,
  ProviderCapabilities,
  RawWorkout,
} from './types';

const BASE = 'https://intervals.icu/api/v1';
const TIMEOUT_MS = 20_000;

export class IntervalsApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
    this.name = 'IntervalsApiError';
  }
}

interface Ctx {
  getApiKey: () => string | null;
  getAthleteId: () => string | null;
}

export class IntervalsIcuProvider implements ZeppDataProvider {
  readonly name = 'intervals-icu';

  readonly capabilities: ProviderCapabilities = {
    workouts: true,
    streams: true,
    thresholds: false,   // пока не проверили /me
    zones: false,
    wellness: true,
  };

  private readonly ctx: Ctx;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  private async request<T>(
    path: string,
    query?: Record<string, string | number>
  ): Promise<T> {
    const apiKey = this.ctx.getApiKey();
    if (!apiKey) throw new Error('intervals.icu API key not configured');

    const url = new URL(BASE + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, String(v));
      }
    }

    const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Basic ${auth}` },
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new IntervalsApiError(
          `intervals.icu ${res.status} ${res.statusText}`,
          res.status,
          body.slice(0, 500)
        );
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async isAvailable(): Promise<ProviderCheckResult> {
    const apiKey = this.ctx.getApiKey();
    if (!apiKey) return { available: false, reason: 'API key не задан' };
    try {
      await this.request<unknown>('/athlete/0/profile');
      return { available: true };
    } catch (e) {
      if (e instanceof IntervalsApiError) {
        if (e.status === 401 || e.status === 403) {
          return { available: false, reason: 'invalid API key' };
        }
        return { available: false, reason: `${e.status} ${e.message}` };
      }
      return { available: false, reason: (e as Error).message };
    }
  }

  /**
   * Wellness за период.
   * GET /api/v1/athlete/{id}/wellness?oldest=&newest=
   */
  async fetchWellness(from: string, to: string): Promise<unknown> {
    const athleteId = this.ctx.getAthleteId() ?? '0';
    return this.request<unknown>(`/athlete/${athleteId}/wellness`, {
      oldest: from,
      newest: to,
    });
  }

  /**
   * Активности за период.
   * GET /api/v1/athlete/{id}/activities?oldest=&newest=
   */
  async fetchActivitiesRaw(from: string, to: string): Promise<unknown[]> {
    const athleteId = this.ctx.getAthleteId() ?? '0';
    return this.request<unknown[]>(`/athlete/${athleteId}/activities`, {
      oldest: from,
      newest: to,
    });
  }

  /**
   * Контракт ZeppDataProvider. Пока не мапим в RawWorkout — это
   * отдельная задача (в intervals другая структура, есть name,
   * type, distance, moving_time).
   */
  async fetchWorkouts(_from: string, _to: string): Promise<RawWorkout[]> {
    throw new Error('intervals-icu fetchWorkouts пока не реализован');
  }

  /**
   * Календарь и план тренировок.
   * GET /api/v1/athlete/{id}/events?oldest=&newest=
   */
  async fetchEvents(from: string, to: string): Promise<unknown[]> {
    const athleteId = this.ctx.getAthleteId() ?? '0';
    return this.request<unknown[]>(`/athlete/${athleteId}/events`, {
      oldest: from,
      newest: to,
    });
  }
}