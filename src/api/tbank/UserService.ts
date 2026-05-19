import { CurrencyTransferRequest, CurrencyTransferResponse, GetAccountsRequest, GetAccountsResponse, GetBankAccountsRequest, GetBankAccountsResponse, GetInfoRequest, GetInfoResponse, GetMarginAttributesRequest, GetMarginAttributesResponse, GetUserTariffRequest, GetUserTariffResponse, PayInRequest, PayInResponse } from '@/api/tbank/usersTypes';

/**
 * С помощью сервиса можно получить: <br/> 1.
 * список счетов пользователя; <br/> 2. маржинальные показатели по счeту.
 */
export interface UsersService {
  /**
   * GetInfo — информация о пользователе
   * Получить информацию о пользователе: тариф, признак квалификации, пройденные тесты и др.
   */
  getInfo(request: GetInfoRequest): Promise<GetInfoResponse>;

  /**
   * GetAccounts — счета пользователя
   * Получить список счетов.
   */
  getAccounts(request: GetAccountsRequest): Promise<GetAccountsResponse>;

  /**
   * GetBankAccounts — банковские счета пользователя
   * Получить список счетов пользователя, в том числе и банковских.
   */
  getBankAccounts(request: GetBankAccountsRequest): Promise<GetBankAccountsResponse>;

  /**
   * CurrencyTransfer — перевод денежных средств между счетами
   * Перевести денежные средства между брокерскими счетами
   */
  currencyTransfer(request: CurrencyTransferRequest): Promise<CurrencyTransferResponse>;

  /**
   * GetMarginAttributes — маржинальные показатели по счeту
   * Метод позволяет получить маржинальные показатели и ликвидность по заданному счeту.
   */
  getMarginAttributes(request: GetMarginAttributesRequest): Promise<GetMarginAttributesResponse>;

  /**
   * GetUserTariff — тариф пользователя
   * Получить информацию о текущих лимитах на подклчение, согласно текущему тарифу пользователя.
   */
  getUserTariff(request: GetUserTariffRequest): Promise<GetUserTariffResponse>;
  
  /**
   * PayIn — пополнение брокерского счета
   * Пополнить брокерский счёт с банковского
   */
  payIn(request: PayInRequest): Promise<PayInResponse>;
}

/**
 * Клиент для сервиса UsersService (REST API Т-Инвестиции).
 * Поддерживает кэширование (в памяти и localStorage), повторные запросы, отмену, логирование.
 * Работает в main и renderer процессах Electron.
 */
export class UsersServiceClient {
  private readonly baseUrl: string;
  private readonly getToken: () => string;
  private readonly defaultTTL: number;
  private readonly maxRetries: number;
  private readonly logger?: (msg: string) => void;
  private readonly cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly persistCache: boolean;
  private readonly storagePrefix: string;

  /**
   * @param getToken - функция, возвращающая актуальный токен доступа
   * @param options - дополнительные настройки
   * @param options.baseUrl - базовый URL API (по умолчанию production)
   * @param options.defaultCacheTTL - время жизни кэша в мс (0 - без кэша). По умолчанию 60_000 (1 мин)
   * @param options.maxRetries - максимальное число повторных попыток при сетевых ошибках. По умолчанию 1
   * @param options.logger - функция логирования (например, console.log)
   * @param options.persistCache - сохранять ли кэш в localStorage для выживания после перезагрузки
   * @param options.storagePrefix - префикс ключа для localStorage (по умолчанию 'tinkoff_users_cache')
   */
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
    this.storagePrefix = options?.storagePrefix ?? 'tinkoff_users_cache';

    if (this.persistCache) {
      this.loadCacheFromStorage();
    }
  }

  /**
   * Принудительно очистить весь внутренний кэш (и localStorage).
   */
  clearCache(): void {
    this.cache.clear();
    this.saveCacheToStorage();
    this.log('Cache cleared');
  }

  /**
   * Удалить из кэша конкретный метод с конкретным телом.
   */
  invalidateCache(method: string, body?: unknown): void {
    const key = this.cacheKey(method, body);
    this.cache.delete(key);
    this.saveCacheToStorage();
    this.log(`Cache invalidated for ${method}`);
  }

  // ----------------------------------------------------------------
  // Публичные методы API (без изменений сигнатур)
  // ----------------------------------------------------------------

  async getInfo(
    { signal, token }: { signal?: AbortSignal; token?: string } = {}
  ): Promise<GetInfoResponse> {
    return this.requestWithCache<GetInfoResponse>('GetInfo', {}, token, signal);
  }

  async getAccounts(
    request: GetAccountsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetAccountsResponse> {
    return this.requestWithCache<GetAccountsResponse>('GetAccounts', request, options?.token, options?.signal);
  }

  async getBankAccounts(
    request: GetBankAccountsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetBankAccountsResponse> {
    return this.requestWithCache<GetBankAccountsResponse>('GetBankAccounts', request, options?.token, options?.signal);
  }

  async currencyTransfer(
    request: CurrencyTransferRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CurrencyTransferResponse> {
    const result = await this.requestWithRetry<CurrencyTransferResponse>('CurrencyTransfer', request, options?.token, options?.signal);
    this.invalidateCache('GetAccounts');
    this.invalidateCache('GetBankAccounts');
    this.invalidateCache('GetMarginAttributes');
    return result;
  }

  async getMarginAttributes(
    request: GetMarginAttributesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetMarginAttributesResponse> {
    return this.requestWithCache<GetMarginAttributesResponse>('GetMarginAttributes', request, options?.token, options?.signal);
  }

  async getUserTariff(
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetUserTariffResponse> {
    return this.requestWithCache<GetUserTariffResponse>('GetUserTariff', {}, options?.token, options?.signal);
  }

  async payIn(
    request: PayInRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<PayInResponse> {
    const result = await this.requestWithRetry<PayInResponse>('PayIn', request, options?.token, options?.signal);
    this.invalidateCache('GetAccounts');
    this.invalidateCache('GetBankAccounts');
    this.invalidateCache('GetMarginAttributes');
    return result;
  }

  // ----------------------------------------------------------------
  // Приватная логика запросов + кэш + персистентность
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
      this.saveCacheToStorage(); // сохраняем после добавления
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
    const url = `${this.baseUrl}/rest/tinkoff.public.invest.api.contract.v1.UsersService/${method}`;
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
  //  Персистентность кэша (localStorage)
  // ----------------------------------------------------------------

  private saveCacheToStorage(): void {
    if (!this.persistCache) return;
    try {
      if (typeof localStorage !== 'undefined') {
        const entries = Array.from(this.cache.entries());
        // Сохраняем только данные (сериализуем timestamp отдельно, но он уже число)
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
            // Проверяем, что timestamp и data присутствуют
            if (value && typeof value.timestamp === 'number') {
              // Восстанавливаем только если не истекло (на случай долгого простоя)
              if (Date.now() - value.timestamp < this.defaultTTL) {
                this.cache.set(key, value);
              }
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
    this.logger?.(`[UsersService] ${msg}`);
  }
}

export { GetAccountsRequest, GetAccountsResponse };
