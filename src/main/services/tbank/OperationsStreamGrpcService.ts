import type {
  PortfolioStreamRequest,
  PortfolioStreamResponse,
  PositionsStreamRequest,
  PositionsStreamResponse,
  OperationsStreamRequest,
  OperationsStreamResponse,
} from './operationsStreamTypes';

export class OperationsStreamServiceClient {
  private readonly token: string;
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  constructor(token: string) {
    this.token = token;
    const api = (window as any).electronAPI;
    if (api) {
      api.onOpsPortfolioData?.((raw: string) => this.process('portfolio', raw));
      api.onOpsPositionsData?.((raw: string) => this.process('position', raw));
      api.onOpsOperationsData?.((raw: string) => this.process('operation', raw));
      api.onOpsStreamClosed?.((stream: string) => this.emit(`close_${stream}`));
      api.onOpsStreamError?.((stream: string, err: string) => this.emit(`error_${stream}`, err));
    }
  }

  /** Подписаться на события портфеля */
  onPortfolio(handler: (data: PortfolioStreamResponse) => void): this {
    this.addListener('portfolio', handler);
    return this;
  }
  /** Подписаться на события позиций */
  onPosition(handler: (data: PositionsStreamResponse) => void): this {
    this.addListener('position', handler);
    return this;
  }
  /** Подписаться на события операций */
  onOperation(handler: (data: OperationsStreamResponse) => void): this {
    this.addListener('operation', handler);
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

  /** Стартовать PortfolioStream */
  async startPortfolioStream(request: PortfolioStreamRequest = {}): Promise<void> {
    await (window as any).electronAPI?.startOpsStream('portfolio', this.token, request);
  }
  /** Стартовать PositionsStream */
  async startPositionsStream(request: PositionsStreamRequest = {}): Promise<void> {
    await (window as any).electronAPI?.startOpsStream('positions', this.token, request);
  }
  /** Стартовать OperationsStream */
  async startOperationsStream(request: OperationsStreamRequest = {}): Promise<void> {
    await (window as any).electronAPI?.startOpsStream('operations', this.token, request);
  }

  /** Остановить все стримы */
  async disconnect(): Promise<void> {
    await (window as any).electronAPI?.stopOpsStream();
  }

  private process(streamType: string, raw: string): void {
    try {
      const msg = JSON.parse(raw);
      this.emit(streamType, msg);
    } catch { /* игнорируем битый JSON */ }
  }

  private addListener(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(h => h(...args));
  }
}