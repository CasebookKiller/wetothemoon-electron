const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

type EventHandler<T> = (data: T) => void;

import type {
  MarketDataStreamRequest,
  MarketDataResponse,
  StreamCandle,
  StreamOrderBook,
  StreamTrade,
  StreamTradingStatus,
  StreamLastPrice,
  StreamOpenInterest,
} from '@/api/tbank/marketdataStreamTypes';

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