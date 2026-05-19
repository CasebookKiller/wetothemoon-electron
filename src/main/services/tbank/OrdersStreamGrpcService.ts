import type {
  TradesStreamRequest,
  TradesStreamResponse,
  OrderStateStreamRequest,
  OrderStateStreamResponse,
} from '@/api/tbank/ordersStreamTypes';

export class OrdersStreamServiceClient {
  private readonly token: string;
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  constructor(token: string) {
    this.token = token;
    const api = (window as any).electronAPI;
    if (api) {
      api.onOrdersTradesData?.((raw: string) => this.process('trades', raw));
      api.onOrdersOrderStateData?.((raw: string) => this.process('orderState', raw));
      api.onOrdersStreamClosed?.((streamType: string) => this.emit('close', streamType));
      api.onOrdersStreamError?.((streamType: string, err: string) => this.emit('error', streamType, err));
    }
  }

  onTrades(handler: (data: TradesStreamResponse) => void): this {
    this.addListener('trades', handler);
    return this;
  }
  onOrderState(handler: (data: OrderStateStreamResponse) => void): this {
    this.addListener('orderState', handler);
    return this;
  }
  onClosed(handler: (streamType: string) => void): this {
    this.addListener('close', handler);
    return this;
  }
  onError(handler: (streamType: string, err: string) => void): this {
    this.addListener('error', handler);
    return this;
  }

  async startTradesStream(request: TradesStreamRequest = {}): Promise<void> {
    await (window as any).electronAPI?.startOrdersStream('trades', this.token, request);
  }
  async startOrderStateStream(request: OrderStateStreamRequest = {}): Promise<void> {
    await (window as any).electronAPI?.startOrdersStream('orderState', this.token, request);
  }

  async disconnect(): Promise<void> {
    await (window as any).electronAPI?.stopOrdersStream();
  }

  private process(streamType: string, raw: string): void {
    try {
      const msg = JSON.parse(raw);
      this.emit(streamType, msg);
    } catch { /* ignore */ }
  }

  private addListener(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(h => h(...args));
  }
}