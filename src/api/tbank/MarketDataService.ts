/*
GetCandles
GetClosePrices
GetLastPrices
GetLastTrades
GetMarketValues
GetOrderBook
GetTechAnalysis
GetTradingStatus
GetTradingStatuses
*/

import type {
  GetCandlesRequest,
  GetCandlesResponse,
  GetClosePricesRequest,
  GetClosePricesResponse,
  GetLastPricesRequest,
  GetLastPricesResponse,
  GetLastTradesRequest,
  GetLastTradesResponse,
  GetMarketValuesRequest,
  GetMarketValuesResponse,
  GetOrderBookRequest,
  GetOrderBookResponse,
  GetTechAnalysisRequest,
  GetTechAnalysisResponse,
  GetTradingStatusesRequest,
  GetTradingStatusesResponse,
  GetTradingStatusRequest,
  GetTradingStatusResponse,
} from './marketdataTypes';

export class MarketDataServiceClient {
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
    this.storagePrefix = options?.storagePrefix ?? 'tinkoff_marketdata_cache';

    if (this.persistCache) {
      this.loadCacheFromStorage();
    }
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

  // ----------------------------------------------------------------
  // Публичные методы
  // ----------------------------------------------------------------

  /**
   * GetCandles — исторические свечи по инструменту.
   * @param request - параметры запроса (инструмент, период, интервал, лимит)
   */
  async getCandles(
    request: GetCandlesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetCandlesResponse> {
    return this.requestWithCache<GetCandlesResponse>(
      'GetCandles',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetClosePrices — цены закрытия торговой сессии по инструментам.
   * @param request - массив идентификаторов инструментов и статус фильтрации
   */
  async getClosePrices(
    request: GetClosePricesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetClosePricesResponse> {
    return this.requestWithCache<GetClosePricesResponse>(
      'GetClosePrices',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetLastPrices — цены последних сделок по инструментам.
   * @param request - параметры запроса (массив инструментов, тип цены)
   */
  async getLastPrices(
    request: GetLastPricesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetLastPricesResponse> {
    return this.requestWithCache<GetLastPricesResponse>(
      'GetLastPrices',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetLastTrades — обезличенные сделки по инструменту (гарантирует данные за последний час).
   * @param request - параметры запроса (инструмент, период, источник)
   */
  async getLastTrades(
    request: GetLastTradesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetLastTradesResponse> {
    return this.requestWithCache<GetLastTradesResponse>(
      'GetLastTrades',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetMarketValues — рыночные данные по инструментам.
   * @param request - список инструментов и запрашиваемых параметров
   */
  async getMarketValues(
    request: GetMarketValuesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetMarketValuesResponse> {
    return this.requestWithCache<GetMarketValuesResponse>(
      'GetMarketValues',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetOrderBook — стакан по инструменту.
   * @param request - идентификатор инструмента и глубина стакана
   */
  async getOrderBook(
    request: GetOrderBookRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetOrderBookResponse> {
    return this.requestWithCache<GetOrderBookResponse>(
      'GetOrderBook',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetTechAnalysis — технические индикаторы по инструменту.
   * @param request - параметры индикатора (тип, инструмент, период, настройки)
   */
  async getTechAnalysis(
    request: GetTechAnalysisRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetTechAnalysisResponse> {
    return this.requestWithCache<GetTechAnalysisResponse>(
      'GetTechAnalysis',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetTradingStatus — статус торгов по инструменту.
   * @param request - идентификатор инструмента
   */
  async getTradingStatus(
    request: GetTradingStatusRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetTradingStatusResponse> {
    return this.requestWithCache<GetTradingStatusResponse>(
      'GetTradingStatus',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetTradingStatuses — статус торгов по инструментам.
   * @param request - массив идентификаторов инструментов
   */
  async getTradingStatuses(
    request: GetTradingStatusesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetTradingStatusesResponse> {
    return this.requestWithCache<GetTradingStatusesResponse>(
      'GetTradingStatuses',
      request,
      options?.token,
      options?.signal
    );
  }

  // ----------------------------------------------------------------
  // Приватные методы запросов
  // ----------------------------------------------------------------

  private async requestWithCache<T>(
    method: string,
    body: unknown,
    token?: string,
    signal?: AbortSignal
  ): Promise<T> {
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

  private async requestWithRetry<T>(
    method: string,
    body: unknown,
    token?: string,
    signal?: AbortSignal,
    attempt = 0
  ): Promise<T> {
    const url = `${this.baseUrl}/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/${method}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token ?? this.getToken()}`,
    };

    try {
      this.log(`Request: ${method} (attempt ${attempt + 1})`);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

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
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      if (attempt < this.maxRetries) {
        const delay = 1000 * (attempt + 1);
        this.log(`Request failed, retrying in ${delay}ms: ${(error as Error).message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.requestWithRetry(method, body, token, signal, attempt + 1);
      }
      throw error;
    }
  }

  private cacheKey(method: string, body: unknown): string {
    return `${method}:${JSON.stringify(body)}`;
  }

  private saveCacheToStorage(): void {
    if (!this.persistCache) return;
    try {
      if (typeof localStorage !== 'undefined') {
        const entries = Array.from(this.cache.entries());
        const serialized = JSON.stringify(entries.map(([key, val]) => [key, val]));
        localStorage.setItem(this.storagePrefix, serialized);
      }
    } catch (err) {
      this.log?.(`Failed to save cache to localStorage: ${(err as Error).message}`);
    }
  }

  private loadCacheFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storagePrefix);
        if (stored) {
          const entries: [string, { data: unknown; timestamp: number }][] = JSON.parse(stored);
          for (const [key, value] of entries) {
            if (value && typeof value.timestamp === 'number' && Date.now() - value.timestamp < this.defaultTTL) {
              this.cache.set(key, value);
            }
          }
          this.log(`Loaded ${this.cache.size} cached entries from localStorage`);
        }
      }
    } catch (err) {
      this.log?.(`Failed to load cache from localStorage: ${(err as Error).message}`);
    }
  }

  private log(msg: string): void {
    this.logger?.(`[MarketDataService] ${msg}`);
  }
}