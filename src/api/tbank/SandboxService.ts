// src/api/tbank/SandboxService.ts
import { GetOperationsByCursorRequest, GetOperationsByCursorResponse, OperationsRequest, OperationsResponse, PortfolioRequest, PortfolioResponse, PositionsRequest, PositionsResponse, WithdrawLimitsRequest, WithdrawLimitsResponse } from './operationsTypes';
import type { CancelOrderRequest, CancelOrderResponse, GetMaxLotsRequest, GetMaxLotsResponse, GetOrderPriceRequest, GetOrderPriceResponse, GetOrdersRequest, GetOrdersResponse, GetOrderStateRequest, OrderState, PostOrderAsyncRequest, PostOrderAsyncResponse, PostOrderRequest, PostOrderResponse, ReplaceOrderRequest } from './ordersTypes';
import { CloseSandboxAccountRequest, CloseSandboxAccountResponse, OpenSandboxAccountRequest, OpenSandboxAccountResponse, SandboxPayInRequest, SandboxPayInResponse } from './sandboxTypes';
import { CancelStopOrderRequest, CancelStopOrderResponse, GetStopOrdersRequest, GetStopOrdersResponse, PostStopOrderRequest, PostStopOrderResponse } from './stopordersTypes';
import { GetAccountsRequest, GetAccountsResponse } from './UserService';

export class SandboxServiceClient {
  private readonly baseUrl: string;
  private readonly getToken: () => string;
  private readonly maxRetries: number;
  private readonly logger?: (msg: string) => void;
  private readonly cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly defaultTTL: number;
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
    this.baseUrl = options?.baseUrl ?? 'https://sandbox-invest-public-api.tbank.ru';
    this.defaultTTL = options?.defaultCacheTTL ?? 60_000;
    this.maxRetries = options?.maxRetries ?? 1;
    this.logger = options?.logger;
    this.persistCache = options?.persistCache ?? false;
    this.storagePrefix = options?.storagePrefix ?? 'tinkoff_sandbox_cache';
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

  // ----------------------------------------------------------------
  // Публичные методы API
  // ----------------------------------------------------------------

  /**
   * CancelSandboxOrder — отменить заявку в песочнице.
   * @param request - параметры отмены (accountId, orderId)
   */
  async cancelSandboxOrder(
    request: CancelOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CancelOrderResponse> {
    return this.requestWithRetry<CancelOrderResponse>(
      'CancelSandboxOrder',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * CancelSandboxStopOrder — отменить стоп-заявку в песочнице.
   * @param request - параметры отмены (accountId, stopOrderId)
   */
  async cancelSandboxStopOrder(
    request: CancelStopOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CancelStopOrderResponse> {
    return this.requestWithRetry<CancelStopOrderResponse>(
      'CancelSandboxStopOrder',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * CloseSandboxAccount — закрыть счет в песочнице.
   * @param request - номер счета
   */
  async closeSandboxAccount(
    request: CloseSandboxAccountRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CloseSandboxAccountResponse> {
    return this.requestWithRetry<CloseSandboxAccountResponse>(
      'CloseSandboxAccount',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxAccounts — счета пользователя в песочнице.
   * @param request - параметры фильтрации (статус)
   */
  async getSandboxAccounts(
    request: GetAccountsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetAccountsResponse> {
    return this.requestWithCache<GetAccountsResponse>(
      'GetSandboxAccounts',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxMaxLots — расчет количества доступных для покупки/продажи лотов в песочнице.
   * @param request - параметры (accountId, instrumentId, опциональная цена)
   */
  async getSandboxMaxLots(
    request: GetMaxLotsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetMaxLotsResponse> {
    return this.requestWithCache<GetMaxLotsResponse>(
      'GetSandboxMaxLots',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxOperations — список операций по счёту в песочнице.
   * @param request - параметры запроса (accountId, период, статус и т.д.)
   */
  async getSandboxOperations(
    request: OperationsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OperationsResponse> {
    return this.requestWithCache<OperationsResponse>(
      'GetSandboxOperations',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxOperationsByCursor — список операций по счёту с пагинацией в песочнице.
   * @param request - параметры запроса (accountId, курсор, лимит и т.д.)
   */
  async getSandboxOperationsByCursor(
    request: GetOperationsByCursorRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetOperationsByCursorResponse> {
    return this.requestWithCache<GetOperationsByCursorResponse>(
      'GetSandboxOperationsByCursor',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxOrderPrice — получить предварительную стоимость для лимитной заявки в песочнице.
   * @param request - параметры запроса (accountId, instrumentId, price, direction, quantity)
   */
  async getSandboxOrderPrice(
    request: GetOrderPriceRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetOrderPriceResponse> {
    return this.requestWithRetry<GetOrderPriceResponse>(
      'GetSandboxOrderPrice',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxOrders — получить список активных заявок по счёту в песочнице.
   * @param request - параметры запроса (accountId, опциональные фильтры)
   */
  async getSandboxOrders(
    request: GetOrdersRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetOrdersResponse> {
    return this.requestWithCache<GetOrdersResponse>(
      'GetSandboxOrders',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxOrderState — получить статус торгового поручения в песочнице.
   * @param request - параметры (accountId, orderId, priceType)
   */
  async getSandboxOrderState(
    request: GetOrderStateRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OrderState> {
    return this.requestWithRetry<OrderState>(
      'GetSandboxOrderState',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxPortfolio — портфель по счету в песочнице.
   * @param request - параметры запроса (accountId, опциональная валюта)
   */
  async getSandboxPortfolio(
    request: PortfolioRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PortfolioResponse> {
    return this.requestWithCache<PortfolioResponse>(
      'GetSandboxPortfolio',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxPositions — список позиций по счёту в песочнице.
   * @param request - параметры (accountId)
   */
  async getSandboxPositions(
    request: PositionsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PositionsResponse> {
    return this.requestWithCache<PositionsResponse>(
      'GetSandboxPositions',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxStopOrders — получить список активных стоп-заявок по счёту в песочнице.
   * @param request - параметры запроса (accountId, статус, период)
   */
  async getSandboxStopOrders(
    request: GetStopOrdersRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetStopOrdersResponse> {
    return this.requestWithCache<GetStopOrdersResponse>(
      'GetSandboxStopOrders',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetSandboxWithdrawLimits — доступный остаток для вывода средств в песочнице.
   * @param request - параметры (accountId)
   */
  async getSandboxWithdrawLimits(
    request: WithdrawLimitsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<WithdrawLimitsResponse> {
    return this.requestWithCache<WithdrawLimitsResponse>(
      'GetSandboxWithdrawLimits',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * OpenSandboxAccount — зарегистрировать счет в песочнице.
   * @param request - название счета (опционально)
   */
  async openSandboxAccount(
    request: OpenSandboxAccountRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OpenSandboxAccountResponse> {
    return this.requestWithRetry<OpenSandboxAccountResponse>(
      'OpenSandboxAccount',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * PostSandboxOrder — выставить заявку в песочнице.
   * @param request - параметры заявки
   */
  async postSandboxOrder(
    request: PostOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostOrderResponse> {
    return this.requestWithRetry<PostOrderResponse>(
      'PostSandboxOrder',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * PostSandboxOrderAsync — выставить заявку асинхронным методом в песочнице.
   * @param request - параметры асинхронной заявки
   */
  async postSandboxOrderAsync(
    request: PostOrderAsyncRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostOrderAsyncResponse> {
    return this.requestWithRetry<PostOrderAsyncResponse>(
      'PostSandboxOrderAsync',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * PostSandboxStopOrder — выставить стоп-заявку в песочнице.
   * @param request - параметры стоп-заявки
   */
  async postSandboxStopOrder(
    request: PostStopOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostStopOrderResponse> {
    return this.requestWithRetry<PostStopOrderResponse>(
      'PostSandboxStopOrder',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * ReplaceSandboxOrder — изменить выставленную заявку в песочнице.
   * @param request - параметры замены (accountId, orderId, новые значения)
   */
  async replaceSandboxOrder(
    request: ReplaceOrderRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PostOrderResponse> {
    return this.requestWithRetry<PostOrderResponse>(
      'ReplaceSandboxOrder',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * SandboxPayIn — пополнить счет в песочнице.
   * @param request - параметры пополнения (accountId, amount)
   */
  async sandboxPayIn(
    request: SandboxPayInRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<SandboxPayInResponse> {
    return this.requestWithRetry<SandboxPayInResponse>(
      'SandboxPayIn',
      request,
      options?.token,
      options?.signal
    );
  }



  // ----------------------------------------------------------------
  // Приватные методы запросов (аналогичны предыдущим сервисам)
  // ----------------------------------------------------------------

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
    const url = `${this.baseUrl}/rest/tinkoff.public.invest.api.contract.v1.SandboxService/${method}`;
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

  private log(msg: string): void { this.logger?.(`[SandboxService] ${msg}`); }
}