// src/api/tbank/OrdersService.ts
import type {
  CancelOrderRequest,
  CancelOrderResponse,
  GetMaxLotsRequest,
  GetMaxLotsResponse,
  GetOrderPriceRequest,
  GetOrderPriceResponse,
  GetOrdersRequest,
  GetOrdersResponse,
  GetOrderStateRequest,
  OrderState,
  PostOrderAsyncRequest,
  PostOrderAsyncResponse,
  PostOrderRequest,
  PostOrderResponse,
  ReplaceOrderRequest,
} from './ordersTypes';

export class OrdersServiceClient {
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
    this.storagePrefix = options?.storagePrefix ?? 'tinkoff_orders_cache';

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

  /**
   * CancelOrder — отменить заявку.
   * @param request - параметры отмены (accountId, orderId)
   */
  async cancelOrder(
    request: CancelOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CancelOrderResponse> {
    // Мутирующая операция — без кэширования
    return this.requestWithRetry<CancelOrderResponse>(
      'CancelOrder',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetMaxLots — расчет количества доступных для покупки/продажи лотов.
   * @param request - параметры (accountId, instrumentId, опциональная цена)
   */
  async getMaxLots(
    request: GetMaxLotsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetMaxLotsResponse> {
    return this.requestWithCache<GetMaxLotsResponse>(
      'GetMaxLots',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetOrderPrice — получить предварительную стоимость для лимитной заявки.
   * @param request - параметры (accountId, instrumentId, price, direction, quantity)
   */
  async getOrderPrice(
    request: GetOrderPriceRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetOrderPriceResponse> {
    return this.requestWithRetry<GetOrderPriceResponse>(
      'GetOrderPrice',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetOrders — получить список активных заявок по счету.
   * @param request - параметры запроса (accountId, опциональные фильтры)
   */
  async getOrders(
    request: GetOrdersRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetOrdersResponse> {
    return this.requestWithCache<GetOrdersResponse>(
      'GetOrders',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetOrderState — получить статус торгового поручения.
   * @param request - параметры (accountId, orderId, priceType)
   */
  async getOrderState(
    request: GetOrderStateRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OrderState> {
    // Запрос статуса – без кэширования, т.к. статус часто меняется
    return this.requestWithRetry<OrderState>(
      'GetOrderState',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * PostOrder — выставить заявку.
   * @param request - параметры заявки
   */
  async postOrder(
    request: PostOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostOrderResponse> {
    // Мутирующая операция – без кэширования
    return this.requestWithRetry<PostOrderResponse>(
      'PostOrder',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * PostOrderAsync — выставить заявку асинхронным методом.
   * @param request - параметры асинхронной заявки
   */
  async postOrderAsync(
    request: PostOrderAsyncRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostOrderAsyncResponse> {
    return this.requestWithRetry<PostOrderAsyncResponse>(
      'PostOrderAsync',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * ReplaceOrder — изменить выставленную заявку.
   * @param request - параметры замены (accountId, orderId, новые значения)
   */
  async replaceOrder(
    request: ReplaceOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostOrderResponse> {
    return this.requestWithRetry<PostOrderResponse>(
      'ReplaceOrder',
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
    const url = `${this.baseUrl}/rest/tinkoff.public.invest.api.contract.v1.OrdersService/${method}`;
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
    this.logger?.(`[OrdersService] ${msg}`);
  }
}