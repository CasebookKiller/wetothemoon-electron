// Типы из tinkoff.public.invest.api.contract.v1 (proto3)

import { BrokerReportRequest, BrokerReportResponse, GetDividendsForeignIssuerRequest, GetDividendsForeignIssuerResponse, GetOperationsByCursorRequest, GetOperationsByCursorResponse, OperationsRequest, OperationsResponse, PortfolioRequest, PortfolioResponse, PositionsRequest, PositionsResponse, WithdrawLimitsRequest, WithdrawLimitsResponse } from './operationsTypes';

// MoneyValue, Quotation и Timestamp уже объявлены ранее (см. UsersService)

/**
 * Клиент для сервиса OperationsService (REST API Т-Инвестиции).
 * Поддерживает кэширование (в памяти и localStorage), повторные запросы, отмену, логирование.
 */
export class OperationsServiceClient {
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
    this.storagePrefix = options?.storagePrefix ?? 'tinkoff_operations_cache';

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
  // Публичные методы API
  // ----------------------------------------------------------------

  /** GetBrokerReport — брокерский отчет. */
  async getBrokerReport(
    request: BrokerReportRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<BrokerReportResponse> {
    // Не кэшируем запросы генерации/получения отчётов (могут меняться)
    return this.requestWithRetry<BrokerReportResponse>('GetBrokerReport', request, options?.token, options?.signal);
  }

  /** GetDividendsForeignIssuer — отчет «Справка о доходах за пределами РФ» */
  async getDividendsForeignIssuer(
    request: GetDividendsForeignIssuerRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetDividendsForeignIssuerResponse> {
    return this.requestWithRetry<GetDividendsForeignIssuerResponse>('GetDividendsForeignIssuer', request, options?.token, options?.signal);
  }

  /** GetOperations — список операций по счету */
  async getOperations(
    request: OperationsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OperationsResponse> {
    return this.requestWithCache<OperationsResponse>('GetOperations', request, options?.token, options?.signal);
  }

  /** GetOperationsByCursor — список операций по счету с пагинацией */
  async getOperationsByCursor(
    request: GetOperationsByCursorRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetOperationsByCursorResponse> {
    return this.requestWithCache<GetOperationsByCursorResponse>('GetOperationsByCursor', request, options?.token, options?.signal);
  }

  /** GetPortfolio — портфель по счету */
  async getPortfolio(
    request: PortfolioRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PortfolioResponse> {
    return this.requestWithCache<PortfolioResponse>('GetPortfolio', request, options?.token, options?.signal);
  }

  /** GetPositions — список позиций по счету */
  async getPositions(
    request: PositionsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PositionsResponse> {
    return this.requestWithCache<PositionsResponse>('GetPositions', request, options?.token, options?.signal);
  }

  /** GetWithdrawLimits — доступный остаток для вывода средств */
  async getWithdrawLimits(
    request: WithdrawLimitsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<WithdrawLimitsResponse> {
    return this.requestWithCache<WithdrawLimitsResponse>('GetWithdrawLimits', request, options?.token, options?.signal);
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
    const url = `${this.baseUrl}/rest/tinkoff.public.invest.api.contract.v1.OperationsService/${method}`;
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

  // ----------------------------------------------------------------
  // Персистентность кэша (localStorage)
  // ----------------------------------------------------------------

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
    this.logger?.(`[OperationsService] ${msg}`);
  }
}