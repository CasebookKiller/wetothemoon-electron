// src/main/services/pranaBindu/spice/providers/dodofoClient.ts
//
// Тонкий HTTP-клиент dodofo.ru. Bearer-токен, GET, таймаут,
// разбор RFC 7807 Problem. Никаких импортов electron.

const DODOFO_BASE_URL = 'https://dodofo.ru';
const DEFAULT_TIMEOUT_MS = 20_000;

// ==================== Problem (RFC 7807) ====================

export interface DodofoProblem {
  title: string;
  status: number;
  detail: string;
  code?: string;
}

export class DodofoApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly code?: string;

  constructor(problem: DodofoProblem) {
    super(`${problem.status} ${problem.title}: ${problem.detail}`);
    this.name = 'DodofoApiError';
    this.status = problem.status;
    this.title = problem.title;
    this.detail = problem.detail;
    this.code = problem.code;
  }
}

// ==================== Запрос ====================

export type QueryValue = string | number | boolean | undefined;

export async function dodofoRequest<T>(
  path: string,
  token: string,
  query?: Record<string, QueryValue>
): Promise<T> {
  const url = new URL(path, DODOFO_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      let problem: DodofoProblem;
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('json')) {
        try {
          problem = (await res.json()) as DodofoProblem;
        } catch {
          problem = { title: 'HTTP error', status: res.status, detail: '' };
        }
      } else {
        const text = await res.text().catch(() => '');
        problem = { title: 'HTTP error', status: res.status, detail: text };
      }
      throw new DodofoApiError(problem);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ==================== Типы ответов ====================

export interface DodofoAuthor {
  id: number;
  name: string;
  has_avatar: boolean;
  username?: string;
}

export interface DodofoActivity {
  id: number;
  name: string;
  format: 'gpx' | 'fit';
  status: 'processing' | 'ready' | 'failed';
  started_at: string | null;
  description: string | null;
  author: DodofoAuthor;
  distance_m: number | null;
  duration_s: number | null;
  moving_time_s: number | null;
  elevation_gain_m: number | null;
  calories: number | null;
  avg_speed_kmh: number | null;
  max_speed_kmh: number | null;
  avg_hr: number | null;
  sport_type?: string;
}

export interface DodofoActivitiesResponse {
  activities: DodofoActivity[];
  page: number;
  has_more?: boolean;
}

export interface DodofoThreshold {
  kind: 'ftp' | 'lthr' | 'hrmax' | 'resthr';
  value: number;
  effective_from: string;
  source: 'manual' | 'auto';
  created_at: string;
}

export type DodofoThresholdsResponse = Partial<
  Record<'ftp' | 'lthr' | 'hrmax' | 'resthr', DodofoThreshold>
>;

export interface DodofoZoneTime {
  zone: number;
  name: string;
  seconds: number;
  percent: number;
}

export interface DodofoStreams {
  dist_m: number[];
  sec_t?: number[];
  speed_kmh: number[];
  hr?: number[];
  power_w?: number[];
  cadence_rpm?: number[];
  hr_zones?: DodofoZoneTime[];
  power_zones?: DodofoZoneTime[];
  eftp_watts?: number;
  summary?: Record<string, unknown> | null;
}