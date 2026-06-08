// src/main/services/orderFlowEngine.ts
import { marketDataBus } from './marketDataBus';
import type { StreamTrade, StreamOrderBook } from '@/api/tbank/marketdataStreamTypes';
import { quotationToNumber } from './volumeProfileEngine'; // или определите локально

interface InstrumentDelta {
  cumulativeDelta: number;
  barDelta: number;
  lastPrice: number;
  extremePrice: number;
  tradeSizes: number[];
  deltaHistory: Array<{ time: string; delta: number; price: number }>;
}

export class OrderFlowEngine {
  private deltas = new Map<string, InstrumentDelta>();
  private absorptionEvents = new Map<string, { side: string; priceLevel: number }>();

  constructor() {
    marketDataBus.onTrade(this.onTrade.bind(this));
    marketDataBus.onOrderBook(this.onOrderBook.bind(this));
  }

  getDelta(instrumentUid: string): number {
    return this.deltas.get(instrumentUid)?.cumulativeDelta ?? 0;
  }

  detectAbsorption(uid: string): { side: string; priceLevel: number } | null {
    return this.absorptionEvents.get(uid) || null;
  }

  detectExhaustion(uid: string): { type: 'bearish' | 'bullish'; extremePrice: number } | null {
    const data = this.deltas.get(uid);
    if (!data) return null;
    if (data.lastPrice >= data.extremePrice && data.barDelta < 0) {
      return { type: 'bearish', extremePrice: data.extremePrice };
    }
    if (data.lastPrice <= data.extremePrice && data.barDelta > 0) {
      return { type: 'bullish', extremePrice: data.extremePrice };
    }
    return null;
  }

  private onTrade(trade: StreamTrade) {
    const uid = trade.instrumentUid || trade.figi;
    if (!uid) return;

    const price = quotationToNumber(trade.price);
    const volume = Number(trade.quantity || '0');
    const direction = trade.direction === 'TRADE_DIRECTION_BUY' ? 'buy' :
                      trade.direction === 'TRADE_DIRECTION_SELL' ? 'sell' : null;
    if (!direction || volume === 0) return;

    if (!this.deltas.has(uid)) {
      this.deltas.set(uid, {
        cumulativeDelta: 0,
        barDelta: 0,
        lastPrice: price,
        extremePrice: price,
        tradeSizes: [],
        deltaHistory: [],
      });
    }
    const data = this.deltas.get(uid)!;
    const delta = direction === 'buy' ? volume : -volume;
    data.cumulativeDelta += delta;
    data.barDelta += delta;
    data.lastPrice = price;

    if (price > data.extremePrice) data.extremePrice = price;
    if (price < data.extremePrice) data.extremePrice = price;

    data.deltaHistory.push({ time: trade.time || '', delta: data.barDelta, price });
    if (data.deltaHistory.length > 100) data.deltaHistory.shift();

    data.tradeSizes.push(volume);
    if (data.tradeSizes.length > 3) data.tradeSizes.shift();
    // Iceberg detection можно оставить без изменений
    if (this.isIceberg(data.tradeSizes)) {
      // опционально: emit события
    }
  }

  private onOrderBook(ob: StreamOrderBook) {
    const uid = ob.instrumentUid || ob.figi;
    if (!uid) return;

    const bids = (ob.bids || []).map(b => ({ price: quotationToNumber(b.price), volume: b.quantity || 0 }));
    const asks = (ob.asks || []).map(a => ({ price: quotationToNumber(a.price), volume: a.quantity || 0 }));
    if (!bids.length || !asks.length) return;

    // Приводим volume к числу во всём массиве
    const bidsNum = bids.map(b => ({ price: b.price, volume: Number(b.volume) }));
    const asksNum = asks.map(a => ({ price: a.price, volume: Number(a.volume) }));

    const maxBid = bidsNum.reduce((max, b) => (b.volume > max.volume ? b : max), bidsNum[0]);
    const maxAsk = asksNum.reduce((max, a) => (a.volume > max.volume ? a : max), asksNum[0]);

    if (maxBid.volume > 1000) {
      this.absorptionEvents.set(uid, { side: 'bid', priceLevel: maxBid.price });
    }
    if (maxAsk.volume > 1000) {
      this.absorptionEvents.set(uid, { side: 'ask', priceLevel: maxAsk.price });
    }
  }

  private isIceberg(sizes: number[]): boolean {
    if (sizes.length < 3) return false;
    const last = sizes[sizes.length - 1];
    return last === sizes[sizes.length - 2] && last === sizes[sizes.length - 3] && last > 0;
  }

  resetBar(instrumentUid: string): void {
    const data = this.deltas.get(instrumentUid);
    if (data) data.barDelta = 0;
  }
}

export const orderFlowEngine = new OrderFlowEngine();