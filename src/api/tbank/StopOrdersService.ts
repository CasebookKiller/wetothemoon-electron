import type {
  CancelStopOrderRequest,
  CancelStopOrderResponse,
  GetStopOrdersRequest,
  GetStopOrdersResponse,
  PostStopOrderRequest,
  PostStopOrderResponse,
} from './stopordersTypes';

export class StopOrdersServiceClient {
  private readonly baseUrl: string;
  private readonly getToken: () => string;
  private readonly defaultTTL: number;
  private readonly maxRetries: number;
  private readonly logger?: (msg: string) => void;
  private readonly cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly persistCache: boolean;
  private readonly storagePrefix: string;

  constructor(
    getToken: () => string,
    options?: {
      baseUrl?: string;
      defaultCacheTTL?: number;
      maxRetries?: number;
      logger?: (msg: string) => void;
      persistCache?: boolean;
      storagePrefix?: string;
    }
  ) {
    this.getToken = getToken;
    this.baseUrl = options?.baseUrl ?? 'https://invest-public-api.tbank.ru';
    this.defaultTTL = options?.defaultCacheTTL ?? 60_000;
    this.maxRetries = options?.maxRetries ?? 1;
    this.logger = options?.logger;
    this.persistCache = options?.persistCache ?? false;
    this.storagePrefix = options?.storagePrefix ?? 'tinkoff_stoporders_cache';
    if (this.persistCache) this.loadCacheFromStorage();
  }

  clearCache(): void {
    this.cache.clear();
    this.saveCacheToStorage();
    this.log('Cache cleared');
  }

  invalidateCache(method: string, body?: unknown): void {
    const key = this.cacheKey(method, body);
    this.cache.delete(key);
    this.saveCacheToStorage();
    this.log(`Cache invalidated for ${method}`);
  }

  // ---------- Методы API ----------

  async cancelStopOrder(
    request: CancelStopOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CancelStopOrderResponse> {
    return this.requestWithRetry<CancelStopOrderResponse>('CancelStopOrder', request, options?.token, options?.signal);
  }

  async getStopOrders(
    request: GetStopOrdersRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetStopOrdersResponse> {
    return this.requestWithCache<GetStopOrdersResponse>('GetStopOrders', request, options?.token, options?.signal);
  }

  async postStopOrder(
    request: PostStopOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostStopOrderResponse> {
    return this.requestWithRetry<PostStopOrderResponse>('PostStopOrder', request, options?.token, options?.signal);
  }

  // ---------- Приватная логика запросов ----------

  private async requestWithCache<T>(method: string, body: unknown, token?: string, signal?: AbortSignal): Promise<T> {
    if (this.defaultTTL > 0) {
      const key = this.cacheKey(method, body);
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.defaultTTL) {
        this.log(`Cache hit for ${method}`);
        return cached.data as T;
      }
    }
    const data = await this.requestWithRetry<T>(method, body, token, signal);
    if (this.defaultTTL > 0) {
      const key = this.cacheKey(method, body);
      this.cache.set(key, { data, timestamp: Date.now() });
      this.saveCacheToStorage();
      this.log(`Cached response for ${method}`);
    }
    return data;
  }

  private async requestWithRetry<T>(method: string, body: unknown, token?: string, signal?: AbortSignal, attempt = 0): Promise<T> {
    const url = `${this.baseUrl}/rest/tinkoff.public.invest.api.contract.v1.StopOrdersService/${method}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token ?? this.getToken()}`,
    };
    try {
      this.log(`Request: ${method} (attempt ${attempt + 1})`);
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
      if (!response.ok) {
        if (response.status === 429 && attempt < this.maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1);
          this.log(`Rate limited, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.requestWithRetry(method, body, token, signal, attempt + 1);
        }
        throw new Error(`${method} failed: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (attempt < this.maxRetries) {
        const delay = 1000 * (attempt + 1);
        this.log(`Request failed, retrying in ${delay}ms: ${(error as Error).message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.requestWithRetry(method, body, token, signal, attempt + 1);
      }
      throw error;
    }
  }

  private cacheKey(method: string, body: unknown): string { return `${method}:${JSON.stringify(body)}`; }

  private saveCacheToStorage(): void {
    if (!this.persistCache) return;
    try {
      if (typeof localStorage !== 'undefined') {
        const entries = Array.from(this.cache.entries());
        const serialized = JSON.stringify(entries.map(([key, val]) => [key, val]));
        localStorage.setItem(this.storagePrefix, serialized);
      }
    } catch (err) { this.log?.(`Failed to save cache to localStorage: ${(err as Error).message}`); }
  }

  private loadCacheFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storagePrefix);
        if (stored) {
          const entries: [string, { data: unknown; timestamp: number }][] = JSON.parse(stored);
          for (const [key, value] of entries) {
            if (value && typeof value.timestamp === 'number' && Date.now() - value.timestamp < this.defaultTTL)
              this.cache.set(key, value);
          }
          this.log(`Loaded ${this.cache.size} cached entries from localStorage`);
        }
      }
    } catch (err) { this.log?.(`Failed to load cache from localStorage: ${(err as Error).message}`); }
  }

  private log(msg: string): void { this.logger?.(`[StopOrdersService] ${msg}`); }
}