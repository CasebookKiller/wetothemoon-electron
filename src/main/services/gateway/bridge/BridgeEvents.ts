// src/main/services/gateway/bridge/BridgeEvents.ts

type GatewayBridgeEventType =
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
  | 'history:changed';

export interface GatewayBridgeEvent {
  type: GatewayBridgeEventType;
  payload: any;
  ts: number;
}

export interface FetchErrorPayload {
  url: string;
  status: number;
  statusText?: string;
  message?: string;
  body?: string;
}

export interface ReasoningUpdatePayload {
  text: string;
}

export interface MessageCountChangedPayload {
  current: number;
  prev: number;
}

export interface ConversationListChangedPayload {
  current: number;
  prev: number;
}

export interface AssistantContentUpdatePayload {
  html: string;
}

export interface MessageErrorPayload {
  /** Текст ошибки из DOM (например, "Check network and retry.") */
  text: string;
  /** Всего error-блоков в DOM на момент события */
  count: number;
}

/**
 * 5.6: poller injectedScript'а зафиксировал изменение содержимого
 * последних видимых сообщений БЕЗ изменения их количества.
 *
 * Срабатывает на:
 *   - regenerate последнего ответа (message:count-changed НЕ сработает)
 *   - edit user-сообщения (то же)
 *   - branch-switch (переключение между ветками, то же)
 *
 * НЕ срабатывает на:
 *   - новые сообщения (там count меняется → message:count-changed)
 *   - наш собственный backgroundScrollAndEmit (флаг __gatewayIsScrolling)
 *   - активный стрим (fingerprint нестабилен, pendingTicks сбрасывается)
 */
export interface HistoryChangedPayload {
  /** djb2-хеш по textContent последних видимых items (для отладки) */
  fingerprint: string;
  /** Предыдущий fingerprint, от которого оттолкнулись */
  prevFingerprint: string;
}