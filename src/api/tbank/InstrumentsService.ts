/*
1. BondsBy,
2. Bonds,
3. CreateFavoriteGroup,
4. Currencies,
5. CurrencyBy,
6. DeleteFavoriteGroup,
7. EditFavorites
8. EtfBy,
9. Etfs,
10.FindInstrument,
11.FutureBy,
12.Futures,
13.GetAccruedInterests,
14.GetAssetBy,
15.GetAssetFundamentals,
16.GetAssetReports.
17.GetAssets,
18.GetBondCoupons,
19.GetBondEvents,
20.GetBrandBy,
21.GetBrands,
22.GetConsensusForecasts,
23.GetCountries,
24.GetDividends,
25.GetFavoriteGroups.
26.GetFavorites,
27.GetForecastsBy,
28.GetFuturesMargin,
29.GetInsiderDeals,
30.GetInstrumentBy,
31.GetRiskRates,
32.Indicatives,
33.OptionBy,
34.Options,
35.OptionsBy,
36.ShareBy,
37.Shares,
38.StructuredNoteBy,
39.StructuredNotes,
40.TradingSchedules
*/

import type {
  InstrumentRequest,
  BondResponse,
  InstrumentsRequest,
  BondsResponse,
  CreateFavoriteGroupRequest,
  CreateFavoriteGroupResponse,
  CurrenciesResponse,
  CurrencyResponse,
  DeleteFavoriteGroupRequest,
  DeleteFavoriteGroupResponse,
  EditFavoritesRequest,
  EditFavoritesResponse,
  EtfResponse,
  EtfsResponse,
  FindInstrumentRequest,
  FindInstrumentResponse,
  FutureResponse,
  FuturesResponse,
  GetAccruedInterestsRequest,
  GetAccruedInterestsResponse,
  AssetRequest,
  AssetResponse,
  GetAssetFundamentalsRequest,
  GetAssetFundamentalsResponse,
  GetAssetReportsRequest,
  GetAssetReportsResponse,
  AssetsRequest,
  AssetsResponse,
  GetBondCouponsRequest,
  GetBondCouponsResponse,
  GetBondEventsRequest,
  GetBondEventsResponse,
  GetBrandRequest,
  Brand,
  GetBrandsRequest,
  GetBrandsResponse,
  GetConsensusForecastsRequest,
  GetConsensusForecastsResponse,
  GetCountriesRequest,
  GetCountriesResponse,
  GetDividendsRequest,
  GetDividendsResponse,
  GetFavoriteGroupsRequest,
  GetFavoriteGroupsResponse,
  GetFavoritesRequest,
  GetFavoritesResponse,
  GetForecastRequest,
  GetForecastResponse,
  GetFuturesMarginRequest,
  GetFuturesMarginResponse,
  GetInsiderDealsRequest,
  GetInsiderDealsResponse,
  InstrumentResponse,
  RiskRatesRequest,
  RiskRatesResponse,
  IndicativesRequest,
  IndicativesResponse,
  OptionResponse,
  OptionsResponse,
  FilterOptionsRequest,
  ShareResponse,
  SharesResponse,
  StructuredNoteResponse,
  StructuredNotesResponse,
  TradingSchedulesRequest,
  TradingSchedulesResponse,
} from './instrumentsTypes';

// 1 ver. - BondsBy
export class InstrumentsServiceClient {
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
    this.storagePrefix = options?.storagePrefix ?? 'tinkoff_instruments_cache';

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
   * BondBy — получить облигацию по ее идентификатору.
   * @param request - параметры запроса (idType, id, classCode)
   * @param options - AbortSignal, опциональный токен
   */
  async bondBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<BondResponse> {
    // Кэшируем запросы инструментов (меняются редко)
    return this.requestWithCache<BondResponse>('BondBy', request, options?.token, options?.signal);
  }

  /**
   * Bonds — список облигаций.
   * @param request - параметры фильтрации (статус, площадка)
   * @param options - AbortSignal, опциональный токен
   */
  async bonds(
    request: InstrumentsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<BondsResponse> {
    return this.requestWithCache<BondsResponse>('Bonds', request, options?.token, options?.signal);
  }

  /**
   * CreateFavoriteGroup — создать новую группу избранных инструментов.
   * @param request - параметры группы (название, цвет, описание)
   * @param options - AbortSignal, опциональный токен
   */
  async createFavoriteGroup(
    request: CreateFavoriteGroupRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CreateFavoriteGroupResponse> {
    // Мутирующий запрос — без кэширования
    return this.requestWithRetry<CreateFavoriteGroupResponse>('CreateFavoriteGroup', request, options?.token, options?.signal);
  }

  /**
   * Currencies — список валют.
   * @param request - параметры фильтрации (статус, площадка)
   * @param options - AbortSignal, опциональный токен
   */
  async currencies(
    request: InstrumentsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CurrenciesResponse> {
    return this.requestWithCache<CurrenciesResponse>('Currencies', request, options?.token, options?.signal);
  }

  /**
   * CurrencyBy — получить валюту по ее идентификатору.
   * @param request - параметры запроса (idType, id, classCode)
   * @param options - AbortSignal, опциональный токен
   */
  async currencyBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<CurrencyResponse> {
    return this.requestWithCache<CurrencyResponse>('CurrencyBy', request, options?.token, options?.signal);
  }

  /**
   * DeleteFavoriteGroup — удалить группу избранных инструментов.
   * @param request - идентификатор удаляемой группы
   * @param options - AbortSignal, опциональный токен
   */
  async deleteFavoriteGroup(
    request: DeleteFavoriteGroupRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<DeleteFavoriteGroupResponse> {
    // Мутирующий запрос без кэширования
    return this.requestWithRetry<DeleteFavoriteGroupResponse>('DeleteFavoriteGroup', request, options?.token, options?.signal);
  }

  /**
   * EditFavorites — отредактировать список избранных инструментов.
   * @param request - параметры редактирования (инструменты, действие, группа)
   * @param options - AbortSignal, опциональный токен
   */
  async editFavorites(
    request: EditFavoritesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<EditFavoritesResponse> {
    // Мутирующий запрос без кэширования
    return this.requestWithRetry<EditFavoritesResponse>('EditFavorites', request, options?.token, options?.signal);
  }

  /**
   * EtfBy — получить инвестиционный фонд по его идентификатору.
   * @param request - параметры запроса (idType, id, classCode)
   * @param options - AbortSignal, опциональный токен
   */
  async etfBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<EtfResponse> {
    return this.requestWithCache<EtfResponse>('EtfBy', request, options?.token, options?.signal);
  }

  /**
   * Etfs — список инвестиционных фондов.
   * @param request - параметры фильтрации (статус, площадка)
   * @param options - AbortSignal, опциональный токен
   */
  async etfs(
    request: InstrumentsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<EtfsResponse> {
    return this.requestWithCache<EtfsResponse>('Etfs', request, options?.token, options?.signal);
  }

  /**
   * FindInstrument — найти инструмент.
   * @param request - параметры поиска (строка запроса, фильтры)
   * @param options - AbortSignal, опциональный токен
   */
  async findInstrument(
    request: FindInstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<FindInstrumentResponse> {
    return this.requestWithCache<FindInstrumentResponse>('FindInstrument', request, options?.token, options?.signal);
  }

  /**
   * FutureBy — получить фьючерс по его идентификатору.
   * @param request - параметры запроса (idType, id, classCode)
   * @param options - AbortSignal, опциональный токен
   */
  async futureBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<FutureResponse> {
    return this.requestWithCache<FutureResponse>('FutureBy', request, options?.token, options?.signal);
  }

  /**
   * Futures — список фьючерсов.
   * @param request - параметры фильтрации (статус, площадка)
   * @param options - AbortSignal, опциональный токен
   */
  async futures(
    request: InstrumentsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<FuturesResponse> {
    return this.requestWithCache<FuturesResponse>('Futures', request, options?.token, options?.signal);
  }

  /**
   * GetAccruedInterests — накопленный купонный доход по облигации.
   * @param request - параметры запроса (figi или instrumentId, период)
   * @param options - AbortSignal, опциональный токен
   */
  async getAccruedInterests(
    request: GetAccruedInterestsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetAccruedInterestsResponse> {
    return this.requestWithCache<GetAccruedInterestsResponse>('GetAccruedInterests', request, options?.token, options?.signal);
  }

  /**
   * GetAssetBy — получить актив по его идентификатору.
   * @param request - идентификатор актива (uid)
   * @param options - AbortSignal, опциональный токен
   */
  async getAssetBy(
    request: AssetRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<AssetResponse> {
    return this.requestWithCache<AssetResponse>('GetAssetBy', request, options?.token, options?.signal);
  }

  /**
   * GetAssetFundamentals — фундаментальные показатели по активу.
   * @param request - массив идентификаторов активов (до 100)
   * @param options - AbortSignal, опциональный токен
   */
  async getAssetFundamentals(
    request: GetAssetFundamentalsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetAssetFundamentalsResponse> {
    return this.requestWithCache<GetAssetFundamentalsResponse>(
      'GetAssetFundamentals',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetAssetReports — расписания выхода отчетностей эмитентов.
   * @param request - идентификатор инструмента и опциональный период
   * @param options - AbortSignal, опциональный токен
   */
  async getAssetReports(
    request: GetAssetReportsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetAssetReportsResponse> {
    return this.requestWithCache<GetAssetReportsResponse>(
      'GetAssetReports',
      request,
      options?.token,
      options?.signal
    );
  }  

  /**
   * GetAssets — список активов.
   * (Работает для всех инструментов, кроме срочных — фьючерсов и опционов).
   * @param request - фильтр по типу и статусу инструментов
   * @param options - AbortSignal, опциональный токен
   */
  async getAssets(
    request: AssetsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<AssetsResponse> {
    return this.requestWithCache<AssetsResponse>(
      'GetAssets',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetBondCoupons — график выплат купонов по облигации.
   * @param request - идентификатор инструмента и период
   * @param options - AbortSignal, опциональный токен
   */
  async getBondCoupons(
    request: GetBondCouponsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetBondCouponsResponse> {
    return this.requestWithCache<GetBondCouponsResponse>(
      'GetBondCoupons',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetBondEvents — события по облигации.
   * @param request - параметры фильтрации (тип события, период, инструмент)
   * @param options - AbortSignal, опциональный токен
   */
  async getBondEvents(
    request: GetBondEventsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetBondEventsResponse> {
    return this.requestWithCache<GetBondEventsResponse>(
      'GetBondEvents',
      request,
      options?.token,
      options?.signal
    );
  }  

  /**
   * GetBrandBy — получить бренд по его идентификатору.
   * @param request - идентификатор бренда
   */
  async getBrandBy(
    request: GetBrandRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<Brand> {
    return this.requestWithCache<Brand>(
      'GetBrandBy',
      request,
      options?.token,
      options?.signal
    );
  }  

  /**
   * GetBrands — список брендов.
   * @param request - параметры пагинации
   * @param options - AbortSignal, опциональный токен
   */
  async getBrands(
    request: GetBrandsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetBrandsResponse> {
    return this.requestWithCache<GetBrandsResponse>(
      'GetBrands',
      request,
      options?.token,
      options?.signal
    );
  }
  
  /**
   * GetConsensusForecasts — мнения аналитиков по инструменту.
   * @param request - параметры пагинации
   * @param options - AbortSignal, опциональный токен
   */
  async getConsensusForecasts(
    request: GetConsensusForecastsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetConsensusForecastsResponse> {
    return this.requestWithCache<GetConsensusForecastsResponse>(
      'GetConsensusForecasts',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetCountries — список стран.
   * @param request - параметры пагинации
   * @param options - AbortSignal, опциональный токен
   */
  async getCountries(
    request: GetCountriesRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetCountriesResponse> {
    return this.requestWithCache<GetCountriesResponse>(
      'GetCountries',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetDividends — события выплаты дивидендов по инструменту.
   * @param request - параметры запроса (идентификатор инструмента, период)
   * @param options - AbortSignal, опциональный токен
   */
  async getDividends(
    request: GetDividendsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetDividendsResponse> {
    return this.requestWithCache<GetDividendsResponse>(
      'GetDividends',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetFavoriteGroups — список групп избранных инструментов.
   * @param request - параметры запроса (опциональные фильтры по инструментам и исключаемым группам)
   */
  async getFavoriteGroups(
    request: GetFavoriteGroupsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetFavoriteGroupsResponse> {
    return this.requestWithCache<GetFavoriteGroupsResponse>(
      'GetFavoriteGroups',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetFavorites — получить список избранных инструментов.
   * @param request - параметры запроса (опциональный groupId)
   */
  async getFavorites(
    request: GetFavoritesRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetFavoritesResponse> {
    return this.requestWithCache<GetFavoritesResponse>(
      'GetFavorites',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetForecastBy — прогнозы инвестдомов по инструменту.
   * @param request - идентификатор инструмента
   */
  async getForecastBy(
    request: GetForecastRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetForecastResponse> {
    return this.requestWithCache<GetForecastResponse>(
      'GetForecastBy',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetFuturesMargin — размер гарантийного обеспечения по фьючерсам.
   * @param request - идентификатор инструмента
   */
  async getFuturesMargin(
    request: GetFuturesMarginRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetFuturesMarginResponse> {
    return this.requestWithCache<GetFuturesMarginResponse>(
      'GetFuturesMargin',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetInsiderDeals — сделки инсайдеров по инструменту.
   * @param request - параметры запроса (идентификатор инструмента, лимит, курсор)
   */
  async getInsiderDeals(
    request: GetInsiderDealsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<GetInsiderDealsResponse> {
    // Кэширование с осторожностью, данные могут обновляться; можно оставить кэш на короткое время, но стандартный TTL кажется приемлемым
    return this.requestWithCache<GetInsiderDealsResponse>(
      'GetInsiderDeals',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetInstrumentBy — основная информация об инструменте.
   * @param request - параметры запроса (идентификатор, тип идентификатора и пр.)
   */
  async getInstrumentBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<InstrumentResponse> {
    return this.requestWithCache<InstrumentResponse>(
      'GetInstrumentBy',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * GetRiskRates — ставки риска по инструменту.
   * @param request - массив идентификаторов инструментов
   */
  async getRiskRates(
    request: RiskRatesRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<RiskRatesResponse> {
    return this.requestWithCache<RiskRatesResponse>(
      'GetRiskRates',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * Indicatives — индикативные инструменты (индексы, товары и другие).
   */
  async indicatives(
    request: IndicativesRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<IndicativesResponse> {
    return this.requestWithCache<IndicativesResponse>(
      'Indicatives',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * OptionBy — получить опцион по его идентификатору.
   * @param request - параметры запроса (идентификатор, тип)
   */
  async optionBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OptionResponse> {
    return this.requestWithCache<OptionResponse>(
      'OptionBy',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * Options — список опционов (deprecated, используйте OptionsBy).
   * @param request - параметры фильтрации (статус, площадка)
   */
  async options(
    request: InstrumentsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OptionsResponse> {
    return this.requestWithCache<OptionsResponse>(
      'Options',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * OptionsBy — список опционов с фильтрацией по базовому активу.
   * @param request - параметры фильтрации (обязателен basicAssetUid или аналоги)
   */
  async optionsBy(
    request: FilterOptionsRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<OptionsResponse> {
    return this.requestWithCache<OptionsResponse>(
      'OptionsBy',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * ShareBy — получить акцию по ее идентификатору.
   * @param request - параметры запроса (идентификатор, тип)
   */
  async shareBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<ShareResponse> {
    return this.requestWithCache<ShareResponse>(
      'ShareBy',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * Shares — список акций.
   * @param request - параметры фильтрации (статус, площадка)
   */
  async shares(
    request: InstrumentsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<SharesResponse> {
    return this.requestWithCache<SharesResponse>(
      'Shares',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * StructuredNoteBy — получить структурную ноту по ее идентификатору.
   * @param request - параметры запроса (идентификатор, тип)
   */
  async structuredNoteBy(
    request: InstrumentRequest,
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<StructuredNoteResponse> {
    return this.requestWithCache<StructuredNoteResponse>(
      'StructuredNoteBy',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * StructuredNotes — список структурных нот.
   * @param request - параметры фильтрации (статус, площадка)
   */
  async structuredNotes(
    request: InstrumentsRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<StructuredNotesResponse> {
    return this.requestWithCache<StructuredNotesResponse>(
      'StructuredNotes',
      request,
      options?.token,
      options?.signal
    );
  }

  /**
   * TradingSchedules — расписания торговых площадок.
   * @param request - параметры запроса (биржа, период)
   */
  async tradingSchedules(
    request: TradingSchedulesRequest = {},
    options?: { signal?: AbortSignal; token?: string }
  ): Promise<TradingSchedulesResponse> {
    return this.requestWithCache<TradingSchedulesResponse>(
      'TradingSchedules',
      request,
      options?.token,
      options?.signal
    );
  }


  // ----------------------------------------------------------------
  // Приватные методы запросов (аналогично предыдущим сервисам)
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
    const url = `${this.baseUrl}/rest/tinkoff.public.invest.api.contract.v1.InstrumentsService/${method}`;
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
    this.logger?.(`[InstrumentsService] ${msg}`);
  }
}