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
import type {
  UnifiedStreams,
  UnifiedWorkout,
} from '../parsers/types';
import { parseFit } from '../parsers/fitParser';
import { parseTcx } from '../parsers/tcxParser';

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

/**
 * intervals.icu отдаёт потоки массивом [{type, data}, ...].
 * Преобразуем в объект с ключами, как в UnifiedStreams.
 *
 * Особенности:
 *  - velocity_smooth — в м/с, переводим в км/ч;
 *  - latlng может приходить как [lat1, lng1, lat2, lng2, ...]
 *    (плоский массив) или как [[lat, lng], ...] (пары).
 *    Нормализуем в пары.
 */
function mapIcuStreams(
  raw: Array<{ type: string; data?: number[] | number[][] }> | null | undefined
): UnifiedStreams {
  const streams: UnifiedStreams = { secT: [] };
  if (!Array.isArray(raw)) return streams;

  const map = new Map<string, any[]>();
  for (const s of raw) {
    if (s && typeof s.type === 'string' && Array.isArray(s.data)) {
      map.set(s.type, s.data);
    }
  }

  const time = map.get('time');
  if (Array.isArray(time) && time.length > 0) {
    streams.secT = time as number[];
  }

  const hr = map.get('heartrate');
  if (Array.isArray(hr) && hr.length > 0) {
    streams.hr = hr.map((v) => (typeof v === 'number' ? Math.round(v) : null));
  }

  const dist = map.get('distance');
  if (Array.isArray(dist) && dist.length > 0) {
    streams.distM = dist.map((v) => (typeof v === 'number' ? v : 0));
  }

  const vel = map.get('velocity_smooth');
  if (Array.isArray(vel) && vel.length > 0) {
    streams.speedKmh = vel.map((v) =>
      typeof v === 'number' ? Math.round(v * 3.6 * 100) / 100 : null
    );
  }

  const cad = map.get('cadence');
  if (Array.isArray(cad) && cad.length > 0) {
    streams.cadence = cad.map((v) =>
      typeof v === 'number' ? Math.round(v) : null
    );
  }

  const alt = map.get('altitude');
  if (Array.isArray(alt) && alt.length > 0) {
    streams.elevationM = alt.map((v) =>
      typeof v === 'number' ? Math.round(v * 10) / 10 : null
    );
  }

  const latlng = map.get('latlng');
  if (Array.isArray(latlng) && latlng.length > 0) {
    // Может прийти двумя способами:
    //  [[lat, lng], [lat, lng], ...]  → пары
    //  [lat1, lng1, lat2, lng2, ...]  → плоский
    const first = latlng[0];
    if (Array.isArray(first)) {
      streams.latlng = (latlng as [number, number][]).map((p) =>
        Array.isArray(p) && p.length === 2 ? [p[0], p[1]] : null
      );
    } else {
      // плоский: собираем по 2
      const pairs: ([number, number] | null)[] = [];
      for (let i = 0; i + 1 < latlng.length; i += 2) {
        const lat = latlng[i];
        const lng = latlng[i + 1];
        if (typeof lat === 'number' && typeof lng === 'number') {
          pairs.push([lat, lng]);
        } else {
          pairs.push(null);
        }
      }
      streams.latlng = pairs;
    }
  }

  return streams;
}

/**
 * Определяет формат файла по первым байтам.
 * FIT: байты 8–12 содержат ASCII ".FIT".
 * TCX: начинается с "<?xml" и содержит "TrainingCenterDatabase".
 */
function sniffFormat(buf: Buffer): 'fit' | 'tcx' | 'unknown' {
  if (buf.length >= 12) {
    const header = buf.slice(8, 12).toString('ascii');
    if (header === '.FIT') return 'fit';
  }
  const head = buf.slice(0, 500).toString('utf8').trim();
  if (head.startsWith('<?xml') && head.includes('TrainingCenterDatabase')) {
    return 'tcx';
  }
  return 'unknown';
}

interface Ctx {
  getApiKey: () => string | null;
  getAthleteId: () => string | null;
}

export class IntervalsIcuProvider implements ZeppDataProvider {
  readonly name = 'intervals-icu';

  readonly capabilities: ProviderCapabilities = {
    workouts: true,
    streams: true,       // включим в шаге 2
    thresholds: true,
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

  /**
   * Скачивает оригинальный файл (FIT/TCX) активности.
   * GET /api/v1/activity/{id}/file
   */
  private async fetchFileBuffer(activityId: string | number): Promise<Buffer> {
    const apiKey = this.ctx.getApiKey();
    if (!apiKey) throw new Error('intervals.icu API key not configured');

    const url = new URL(`${BASE}/activity/${activityId}/file`);
    const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Basic ${auth}` },
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new IntervalsApiError(
          `file ${res.status} ${res.statusText}`,
          res.status
        );
      }

      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Возвращает полный UnifiedWorkout для активности.
   * Скачивает оригинальный FIT/TCX и парсит нашим парсером.
   */
  async fetchUnifiedWorkout(
    activityId: string | number
  ): Promise<UnifiedWorkout> {
    const buf = await this.fetchFileBuffer(activityId);
    const format = sniffFormat(buf);
    const externalId = `intervals-icu:${activityId}`;

    if (format === 'fit') {
      return await parseFit(buf, { externalId });
    }
    if (format === 'tcx') {
      return parseTcx(buf, { externalId });
    }
    throw new Error(
      `Неизвестный формат файла от intervals.icu (id=${activityId})`
    );
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
   * Пороги атлета: LTHR, HRmax, RestHR.
   *
   * У ICU пороги живут в двух местах:
   *  1. Профиль атлета (GET /athlete/{id}) — «текущие» значения.
   *  2. В каждой активности — значения на момент её выполнения.
   *
   * Порядок:
   *  1. Пробуем профиль атлета (текущее значение).
   *  2. Если профиль пуст или не отдаёт нужные поля — берём из
   *     последней активности, где они есть. Это даёт «порог на
   *     сегодня» по мнению ICU.
   *
   * Возвращаем в формате dodofo-совместимом, чтобы pb:sync-thresholds
   * не пришлось раздваивать.
   */
  async fetchThresholds(): Promise<{
    lthr?: { value: number };
    hrmax?: { value: number };
    resthr?: { value: number };
  }> {
    const athleteId = this.ctx.getAthleteId() ?? '0';

    // --- Вариант A: профиль атлета ---
    try {
      const profile = await this.request<any>(`/athlete/${athleteId}`);
      const lthr =
        profile?.lthr ??
        profile?.icu_lthr ??
        profile?.icu_run_lthr ??
        null;
      const hrmax =
        profile?.athlete_max_hr ??
        profile?.max_hr ??
        profile?.icu_max_hr ??
        null;
      const resthr =
        profile?.icu_resting_hr ??
        profile?.resting_hr ??
        null;

      if (lthr != null && hrmax != null) {
        return {
          lthr: { value: Number(lthr) },
          hrmax: { value: Number(hrmax) },
          resthr: resthr != null ? { value: Number(resthr) } : undefined,
        };
      }
    } catch {
      // падаем на вариант B
    }

    // --- Вариант B: из последней активности с полями ---
    const today = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = today.toISOString().slice(0, 10);

    const items = await this.request<any[]>(
      `/athlete/${athleteId}/activities`,
      { oldest: fromIso, newest: toIso }
    );

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Нет активностей ICU за последние 3 месяца');
    }

    // Берём первую (самую свежую) с заполненными порогами.
    const withData = items.find(
      (a) => a?.lthr != null && a?.icu_resting_hr != null
    );
    if (!withData) {
      throw new Error('В последних активностях ICU нет данных о порогах');
    }

    return {
      lthr: { value: Number(withData.lthr) },
      hrmax:
        withData.athlete_max_hr != null
          ? { value: Number(withData.athlete_max_hr) }
          : undefined,
      resthr: { value: Number(withData.icu_resting_hr) },
    };
  }

  /**
   * HR-зоны (7 границ) из последней активности, где они есть.
   * В ICU активность содержит `icu_hr_zones` — массив верхних
   * границ зон Z1..Z7.
   */
  async fetchZones(): Promise<{
    hr_zones: number[] | null;
    pace_zones_kmh: number[] | null;
    threshold_pace_ms: number | null;
  }> {
    const athleteId = this.ctx.getAthleteId() ?? '0';
    const today = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);

    const items = await this.request<any[]>(
      `/athlete/${athleteId}/activities`,
      {
        oldest: from.toISOString().slice(0, 10),
        newest: today.toISOString().slice(0, 10),
      }
    );

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Нет активностей ICU за последние 3 месяца');
    }

    // HR-зоны: последняя активность с непустым icu_hr_zones.
    const hrSource = items.find(
      (a) => Array.isArray(a?.icu_hr_zones) && a.icu_hr_zones.length > 0
    );
    const hr_zones = hrSource ? (hrSource.icu_hr_zones as number[]) : null;

    // Pace-зоны: последняя активность с заполненными threshold_pace
    // и pace_zones.
    const paceSource = items.find(
      (a) =>
        typeof a?.threshold_pace === 'number' &&
        a.threshold_pace > 0 &&
        Array.isArray(a?.pace_zones) &&
        a.pace_zones.length > 0
    );

    let pace_zones_kmh: number[] | null = null;
    let threshold_pace_ms: number | null = null;
    if (paceSource) {
      threshold_pace_ms = paceSource.threshold_pace as number;
      // pace_zones — проценты от threshold_pace (в скорости).
      // Переводим в км/ч: threshold_pace_ms × pct/100 × 3.6
      pace_zones_kmh = (paceSource.pace_zones as number[]).map((pct) => {
        const v = threshold_pace_ms! * (pct / 100) * 3.6;
        // 999% и выше — оставляем как большую верхнюю границу,
        // но не бесконечность, чтобы сериализация JSON не рвала.
        return Math.round(v * 100) / 100;
      });
    }

    if (!hr_zones && !pace_zones_kmh) {
      throw new Error('В активностях ICU нет данных о зонах');
    }

    return { hr_zones, pace_zones_kmh, threshold_pace_ms };
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
   * Список активностей за период.
   * GET /api/v1/athlete/{id}/activities?oldest=&newest=
   *
   * Фильтр: только беговые типы (`Run`, `TrailRun`, `VirtualRun`).
   * Остальное (Ride, Walk, Swim) отсекаем на нашей стороне.
   */
  async fetchWorkouts(from: string, to: string): Promise<RawWorkout[]> {
    const athleteId = this.ctx.getAthleteId() ?? '0';

    const items = await this.request<any[]>(
      `/athlete/${athleteId}/activities`,
      { oldest: from, newest: to }
    );

    if (!Array.isArray(items)) return [];

    const RUN_TYPES = new Set([
      'run',
      'trailrun',
      'virtualrun',
      'trail_run',
      'virtual_run',
      'indoorrun',
      'indoor_run',
    ]);

    return items
      .filter((a) => {
        if (!a || typeof a !== 'object') return false;
        if (!a.id) return false;
        const t = String(a.type ?? '').toLowerCase().replace(/[\s_-]/g, '');
        return RUN_TYPES.has(t) || t === 'run' || t.startsWith('run');
      })
      .map((a) => {
        // start_date — UTC с 'Z', start_date_local — без TZ.
        // Используем UTC, чтобы startTime был валидным ISO 8601.
        // Локальную зону применим на уровне UI/репозитория.
        const startTime: string = a.start_date ?? a.start_date_local;
        // moving_time — активное время в движении (соответствует
        // FIT total_timer_time и UnifiedWorkout.durationSec).
        const durationS: number | undefined =
          typeof a.moving_time === 'number' ? a.moving_time : undefined;
                const endTime = new Date(
          new Date(startTime).getTime() + (durationS ?? 0) * 1000
        ).toISOString();

        return {
          externalId: `intervals-icu:${a.id}`,
          source: 'intervals-icu',
          origin: 'intervals-icu',
          name: typeof a.name === 'string' ? a.name : undefined,   // ← добавить
          startTime,
          endTime,
          distanceM:
            typeof a.distance === 'number' ? a.distance : undefined,
          durationS,
          avgHr:
            typeof a.average_heartrate === 'number'
              ? Math.round(a.average_heartrate)
              : undefined,
          maxHr:
            typeof a.max_heartrate === 'number'
              ? Math.round(a.max_heartrate)
              : undefined,
          raw: {
            type: a.type,
            name: a.name ?? null,
            description: a.description ?? null,
            device_name: a.device_name ?? null,
            external_id_source: a.external_id ?? null,
            icu_athlete_id: a.icu_athlete_id ?? null,
            // Метаданные атлета на момент тренировки
            lthr: a.lthr ?? null,
            resting_hr: a.icu_resting_hr ?? null,
            hr_zones: a.icu_hr_zones ?? null,
            // Нагрузки (полезно для будущего анализа)
            training_load: a.icu_training_load ?? null,
            ctl: a.icu_ctl ?? null,
            atl: a.icu_atl ?? null,
            // Доп. агрегаты
            total_elevation_gain: a.total_elevation_gain ?? null,
            total_elevation_loss: a.total_elevation_loss ?? null,
            average_cadence: a.average_cadence ?? null,
            calories: a.calories ?? null,
            // Пометка источника FIT внутри intervals
            file_type: a.file_type ?? null,
          } as unknown as RawWorkout['raw'],
        };
      });
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

    /**
   * Разведка: список активностей.
   * GET /api/v1/athlete/{id}/activities?oldest=&newest=
   */
  async debugActivities(from: string, to: string): Promise<unknown> {
    const athleteId = this.ctx.getAthleteId() ?? '0';
    return this.request<unknown>(`/athlete/${athleteId}/activities`, {
      oldest: from,
      newest: to,
    });
  }

  /**
   * Разведка: детали активности.
   * GET /api/v1/activity/{id}
   */
  async debugActivity(id: string | number): Promise<unknown> {
    return this.request<unknown>(`/activity/${id}`);
  }

  /**
   * Разведка: потоки активности.
   * GET /api/v1/activity/{id}/streams?types=...
   */
  async debugStreams(id: string | number): Promise<unknown> {
    return this.request<unknown>(`/activity/${id}/streams`, {
      types: 'time,heartrate,distance,velocity_smooth,cadence,altitude,latlng',
    });
  }

  /**
   * Потоки активности в формате UnifiedStreams.
   * Скачивает FIT/TCX и парсит — полный набор каналов
   * (HR, каденс, GPS, высота, дистанция, скорость).
   */
  async fetchStreams(activityId: string | number): Promise<UnifiedStreams> {
    const workout = await this.fetchUnifiedWorkout(activityId);
    return workout.streams;
  }

  /**
   * Разведка: календарь и план.
   * GET /api/v1/athlete/{id}/events?oldest=&newest=
   */
  async debugEvents(from: string, to: string): Promise<unknown> {
    const athleteId = this.ctx.getAthleteId() ?? '0';
    return this.request<unknown[]>(`/athlete/${athleteId}/events`, {
      oldest: from,
      newest: to,
    });
  }


}