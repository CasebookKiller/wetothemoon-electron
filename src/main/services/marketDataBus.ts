// src/main/services/marketDataBus.ts
import { EventEmitter } from 'events';
import type { StreamCandle, StreamTrade, StreamOrderBook, StreamLastPrice } from '@/api/tbank/marketdataStreamTypes';

class MarketDataBus extends EventEmitter {
  private static instance: MarketDataBus;
  private static counter = 0;
  private id: number;

  private constructor() {
    super();
    MarketDataBus.counter++;
    this.id = MarketDataBus.counter;
    console.log(`[MarketDataBus] Создан экземпляр #${this.id}`);
    this.setMaxListeners(50);
  }

  public getInstanceId(): number {
    return this.id;
  }

  public static getInstance(): MarketDataBus {
    if (!MarketDataBus.instance) {
      MarketDataBus.instance = new MarketDataBus();
    }
    return MarketDataBus.instance;
  }

  // Типизированные методы для удобства, хотя можно использовать on напрямую
  public onCandle(handler: (candle: StreamCandle) => void): this {
    this.on('candle', handler);
    return this;
  }

  public onTrade(handler: (trade: StreamTrade) => void): this {
    this.on('trade', handler);
    return this;
  }

  public onOrderBook(handler: (ob: StreamOrderBook) => void): this {
    this.on('orderbook', handler);
    return this;
  }

  public onLastPrice(handler: (lp: StreamLastPrice) => void): this {
    this.on('lastPrice', handler);
    return this;
  }

  // Вспомогательные методы для отписки
  public offCandle(handler: (candle: StreamCandle) => void): this {
    this.off('candle', handler);
    return this;
  }

  public offTrade(handler: (trade: StreamTrade) => void): this {
    this.off('trade', handler);
    return this;
  }
}

export const marketDataBus = MarketDataBus.getInstance();