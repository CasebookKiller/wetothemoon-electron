// src/api/tbank/MarketDataStreamService.ts
const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

type EventHandler<T> = (data: T) => void;

// src/api/tbank/MarketDataStreamService.ts
import type {
  MarketDataStreamRequest,
  MarketDataResponse,
  StreamCandle,
  StreamOrderBook,
  StreamTrade,
  StreamTradingStatus,
  StreamLastPrice,
  StreamOpenInterest,
} from './marketdataStreamTypes';

export class MarketDataStreamServiceClient {
  private readonly token: string;
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  private buffer = '';

  constructor(token: string) {
    this.token = token;

    const api = (window as any).electronAPI;
    if (api) {
      api.onMarketData((raw: string) => {
        console.log('[client] raw data:', raw);
        this.processLine(raw);
      });
      api.onMarketClosed(() => this.emit('closed'));
      api.onMarketError((err: string) => this.emit('error', err));
    }
  }

  // Подписки с сохранением типов исходных интерфейсов
  onCandle(handler: (data: StreamCandle) => void): this {
    this.addListener('candle', handler);
    return this;
  }
  onOrderBook(handler: (data: StreamOrderBook) => void): this {
    this.addListener('orderbook', handler);
    return this;
  }
  onTrade(handler: (data: StreamTrade) => void): this {
    this.addListener('trade', handler);
    return this;
  }
  onTradingStatus(handler: (data: StreamTradingStatus) => void): this {
    this.addListener('tradingStatus', handler);
    return this;
  }
  onLastPrice(handler: (data: StreamLastPrice) => void): this {
    this.addListener('lastPrice', handler);
    return this;
  }
  onOpenInterest(handler: (data: StreamOpenInterest) => void): this {
    this.addListener('openInterest', handler);
    return this;
  }
  onClosed(handler: () => void): this {
    this.addListener('closed', handler);
    return this;
  }
  onError(handler: (err: string) => void): this {
    this.addListener('error', handler);
    return this;
  }

  async marketDataStream(request: MarketDataStreamRequest): Promise<void> {
    const api = (window as any).electronAPI;
    if (!api) throw new Error('electronAPI not available');
    await api.startMarketStream(this.token, request);
  }

  disconnect(): void {
    const api = (window as any).electronAPI;
    if (api) api.stopMarketStream();
  }

  private processLine(line: string): void {
    try {
      const msg: MarketDataResponse = JSON.parse(line);
      this.dispatchMessage(msg);
    } catch {
      // невалидный JSON – игнорируем
    }
  }

  private dispatchMessage(msg: any): void {
    // Ответы на подписки – генерируем именованные события
    if (msg.subscribeCandlesResponse)    this.emit('subscribeCandlesResponse', msg.subscribeCandlesResponse);
    if (msg.subscribeOrderBookResponse)  this.emit('subscribeOrderBookResponse', msg.subscribeOrderBookResponse);
    if (msg.subscribeTradesResponse)     this.emit('subscribeTradesResponse', msg.subscribeTradesResponse);
    if (msg.subscribeInfoResponse)       this.emit('subscribeInfoResponse', msg.subscribeInfoResponse);
    if (msg.subscribeLastPriceResponse)  this.emit('subscribeLastPriceResponse', msg.subscribeLastPriceResponse);

    // Биржевые данные
    if (msg.candle)          this.emit('candle', msg.candle);
    if (msg.orderbook)       this.emit('orderbook', msg.orderbook);
    if (msg.trade)           this.emit('trade', msg.trade);
    if (msg.tradingStatus)   this.emit('tradingStatus', msg.tradingStatus);
    if (msg.lastPrice)       this.emit('lastPrice', msg.lastPrice);
    if (msg.openInterest)    this.emit('openInterest', msg.openInterest);

    // Ping – просто логируем либо генерируем событие
    if (msg.ping)            this.emit('ping', msg.ping);
  }

  private addListener(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(h => h(...args));
  }
}

/*
import type {
  MarketDataServerSideStreamRequest,
  MarketDataStreamRequest,
  MarketDataResponse,
  StreamCandle,
  StreamOrderBook,
  StreamTrade,
  StreamTradingStatus,
  StreamLastPrice,
  StreamOpenInterest,
  SubscribeCandlesResponse,
  SubscribeOrderBookResponse,
  SubscribeTradesResponse,
  SubscribeInfoResponse,
  SubscribeLastPriceResponse,
  StreamPing,
} from './marketdataStreamTypes';

type EventHandler<T> = (data: T) => void;

export class MarketDataStreamServiceClient {
  private readonly url: string;
  private readonly token: string;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;
  private readonly debugLog: boolean;

  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private pingIntervalId?: ReturnType<typeof setInterval>;
  private listeners: Map<string, EventHandler<any>[]> = new Map();
  private _buffer = ''; // буфер для неполных JSON-чанков

  //
  // @param token – токен доступа
  // @param options – дополнительные настройки
  // @param options.url – адрес WebSocket (по умолчанию wss://invest-public-api.tbank.ru/ws)
  // @param options.maxReconnectAttempts – максимум попыток переподключения
  // @param options.pingIntervalMs – интервал пинга в мс (по умолчанию 120000)
  // @param options.debugLog – если true, все сообщения пишутся в консоль
  //
  constructor(
    token: string,
    options?: {
      url?: string;
      maxReconnectAttempts?: number;
      reconnectDelay?: number;
      pingIntervalMs?: number;
      debugLog?: boolean;
    }
  ) {
    this.token = token;
    this.url = options?.url ?? 'wss://invest-public-api.tbank.ru/ws';
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options?.reconnectDelay ?? 2000;
    this.debugLog = options?.debugLog ?? false;
    // интервал пинга можно сохранить, если нужно менять, пока просто используем 120000
  }

  // ---------- Публичные методы для подписки на события ----------

  onCandle(handler: EventHandler<StreamCandle>): this {
    this.addListener('candle', handler);
    return this;
  }
  onOrderBook(handler: EventHandler<StreamOrderBook>): this {
    this.addListener('orderbook', handler);
    return this;
  }
  onTrade(handler: EventHandler<StreamTrade>): this {
    this.addListener('trade', handler);
    return this;
  }
  onTradingStatus(handler: EventHandler<StreamTradingStatus>): this {
    this.addListener('tradingStatus', handler);
    return this;
  }
  onLastPrice(handler: EventHandler<StreamLastPrice>): this {
    this.addListener('lastPrice', handler);
    return this;
  }
  onOpenInterest(handler: EventHandler<StreamOpenInterest>): this {
    this.addListener('openInterest', handler);
    return this;
  }
// в конец блока «Публичные методы для подписки на события» добавьте:

  onSubscribeCandlesResponse(handler: EventHandler<SubscribeCandlesResponse>): this {
    this.addListener('subscribeCandlesResponse', handler);
    return this;
  }
  onSubscribeOrderBookResponse(handler: EventHandler<SubscribeOrderBookResponse>): this {
    this.addListener('subscribeOrderBookResponse', handler);
    return this;
  }
  onSubscribeTradesResponse(handler: EventHandler<SubscribeTradesResponse>): this {
    this.addListener('subscribeTradesResponse', handler);
    return this;
  }
  onSubscribeInfoResponse(handler: EventHandler<SubscribeInfoResponse>): this {
    this.addListener('subscribeInfoResponse', handler);
    return this;
  }
  onSubscribeLastPriceResponse(handler: EventHandler<SubscribeLastPriceResponse>): this {
    this.addListener('subscribeLastPriceResponse', handler);
    return this;
  }
  onPing(handler: EventHandler<StreamPing>): this {
    this.addListener('ping', handler);
    return this;
  }
  // ---------- Публичные методы отправки запросов ----------

  // Server-side stream (один запрос, много ответов)
  marketDataServerSideStream(request: MarketDataServerSideStreamRequest): this {
    this.ensureConnected();
    this.send(request);
    return this;
  }

  // Bidirectional stream (можно посылать несколько запросов)
  marketDataStream(request: MarketDataStreamRequest): this {
    this.ensureConnected();
    this.send(request);
    return this;
  }

  // Закрыть WebSocket-соединение
  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.stopPing();
  }

  // ---------- Приватные методы ----------

  private async ensureConnected(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    await this.connect();
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url, ['json']);

      ws.onopen = () => {
        if (this.debugLog) console.log('[WS] opened');
        this.socket = ws;
        this.reconnectAttempts = 0;
        // Авторизация
        ws.send(JSON.stringify({ token: this.token }));
        this.startPing();
        resolve();
      };

      ws.onmessage = (event) => {
        const raw = event.data as string;
        if (this.debugLog) console.log('[WS] received:', raw);
        this.processChunk(raw);
      };

      ws.onerror = (err) => {
        if (this.debugLog) console.error('[WS] error', err);
        reject(err);
      };
      ws.onclose = (event) => {
        if (this.debugLog) console.log('[WS] closed', event.code, event.reason);
        this.stopPing();
        this.socket = null;
        this.attemptReconnect();
      };
    });
  }

  private send(data: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const json = JSON.stringify(data);
    if (this.debugLog) console.log('[WS] send:', json);
    this.socket.send(json);
  }

  // Разбирает поток JSON-объектов (NDJSON, многострочные и склеенные)
  private processChunk(chunk: string): void {
    const text = this._buffer + chunk;
    this._buffer = '';

    let begin = 0;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        if (depth === 0) begin = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = text.substring(begin, i + 1);
          try {
            const msg: MarketDataResponse = JSON.parse(jsonStr);
            this.dispatchMessage(msg);
          } catch (e) {
            console.error('[WS] parse error', e);
          }
        }
      }
    }

    if (depth > 0) {
      this._buffer = text.substring(begin);
    } else {
      this._buffer = '';
    }
  }

  private dispatchMessage(msg: MarketDataResponse): void {
    // Ответы подписок
    if (msg.subscribeCandlesResponse) this.emit('subscribeCandlesResponse', msg.subscribeCandlesResponse);
    if (msg.subscribeOrderBookResponse) this.emit('subscribeOrderBookResponse', msg.subscribeOrderBookResponse);
    if (msg.subscribeTradesResponse) this.emit('subscribeTradesResponse', msg.subscribeTradesResponse);
    if (msg.subscribeInfoResponse) this.emit('subscribeInfoResponse', msg.subscribeInfoResponse);
    if (msg.subscribeLastPriceResponse) this.emit('subscribeLastPriceResponse', msg.subscribeLastPriceResponse);

    // Потоковые данные
    if (msg.candle) this.emit('candle', msg.candle);
    if (msg.orderbook) this.emit('orderbook', msg.orderbook);
    if (msg.trade) this.emit('trade', msg.trade);
    if (msg.tradingStatus) this.emit('tradingStatus', msg.tradingStatus);
    if (msg.lastPrice) this.emit('lastPrice', msg.lastPrice);
    if (msg.openInterest) this.emit('openInterest', msg.openInterest);
    if (msg.ping) this.emit('ping', msg.ping);
  }

  private addListener(event: string, handler: EventHandler<any>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }

  private startPing(): void {
    this.pingIntervalId = setInterval(() => {
      this.send({
        ping: {
          time: new Date().toISOString(),
          streamId: '',
        },
      });
    }, 120_000);
  }

  private stopPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
    }
  }
}*/