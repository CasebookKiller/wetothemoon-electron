// src/main/services/gateway/bridge/BridgeEvents.ts

export type GatewayBridgeEventType =
  | 'network:online'
  | 'network:offline'
  | 'fetch:error'
  | 'reasoning:update'
  | 'message:count-changed'
  | 'message:error'
  | 'history:progress'
  | 'history:complete'
  | 'conversation:list-changed'
  | 'assistant:content-update'
  | 'file:batch-started'
  | 'file:batch-progress'
  | 'file:batch-complete'
  | 'history:changed'
  | 'profile:rate-limited'
  | 'profile:banned'
  | 'profile:switched'
  | 'all-profiles-limited';

// 5.8.2: индикатор скроллинга
export interface ScrollProgressMeta {
  phase: 'bottom-up' | 'top-down' | 'final' | 'gaps' | 'traverse' | 'verify';
  direction: 'up' | 'down' | 'bidir';
  pass: number;
  totalPasses: number;
  elapsedMs: number;
  collectedCount: number;
  branchTotal: number;
  branchDone: number;
  currentPwKey?: string;
}

export interface GatewayBridgeEvent {
  type: GatewayBridgeEventType;
  payload: any;
  ts: number;
}

// Расширенный payload для history:progress/complete
export interface HistoryProgressPayload {
  rawMessages: any[];
  scrollProgress?: ScrollProgressMeta;
}

// P0.5: события rate-limit / бана из injected-скрипта
export interface RateLimitedPayload {
  kind: 'RATE_LIMIT' | 'ACCOUNT_BANNED';
  untilMs: number | null;
  rawText: string;
}