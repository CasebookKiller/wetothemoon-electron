import type { Timestamp, Quotation, MoneyValue, PingDelaySettings } from './commonTypes';
import type { OrderDirection, OrderType, OrderExecutionReportStatus, TimeInForceType } from './ordersTypes';

export interface TradesStreamRequest {
  accounts?: string[];
  pingDelayMs?: number;
}

export interface OrderTrade {
  dateTime?: Timestamp;
  price?: Quotation;
  quantity?: number;
  tradeId?: string;
}

export interface OrderTrades {
  orderId?: string;
  createdAt?: Timestamp;
  direction?: OrderDirection;
  figi?: string;
  trades?: OrderTrade[];
  accountId?: string;
  instrumentUid?: string;
}

export interface SubscriptionResponse {
  trackingId?: string;
  status?: ResultSubscriptionStatus;
  streamId?: string;
  accounts?: string[];
  error?: {
    code?: number;
    message?: string;
  };
}

export enum ResultSubscriptionStatus {
  RESULT_SUBSCRIPTION_STATUS_UNSPECIFIED = 0,
  RESULT_SUBSCRIPTION_STATUS_SUCCESS = 1,
  RESULT_SUBSCRIPTION_STATUS_INTERNAL_ERROR = 2,
}

export interface TradesStreamResponse {
  orderTrades?: OrderTrades;
  ping?: { time?: Timestamp; streamId?: string };
  subscription?: SubscriptionResponse;
}

export interface OrderStateStreamRequest {
  accounts?: string[];
  pingDelayMillis?: number;
}

export enum MarkerType {
  MARKER_UNKNOWN = 0,
  MARKER_BROKER = 1,
  MARKER_CHAT = 2,
  MARKER_PAPER = 3,
  MARKER_MARGIN = 4,
  MARKER_TKBNM = 5,
  MARKER_SHORT = 6,
  MARKER_SPECMM = 7,
  MARKER_PO = 8,
}

export enum StatusCauseInfo {
  CAUSE_UNSPECIFIED = 0,
  CAUSE_CANCELLED_BY_CLIENT = 15,
  CAUSE_CANCELLED_BY_EXCHANGE = 1,
  CAUSE_CANCELLED_NOT_ENOUGH_POSITION = 2,
  CAUSE_CANCELLED_BY_CLIENT_BLOCK = 3,
  CAUSE_REJECTED_BY_BROKER = 4,
  CAUSE_REJECTED_BY_EXCHANGE = 5,
  CAUSE_CANCELLED_BY_BROKER = 6,
}

export interface StreamOrderState {
  orderId?: string;
  orderRequestId?: string;
  clientCode?: string;
  createdAt?: Timestamp;
  executionReportStatus?: OrderExecutionReportStatus;
  statusInfo?: StatusCauseInfo;
  ticker?: string;
  classCode?: string;
  lotSize?: number;
  direction?: OrderDirection;
  timeInForce?: TimeInForceType;
  orderType?: OrderType;
  accountId?: string;
  tradeOrderId?: string;
  initialOrderPrice?: MoneyValue;
  orderPrice?: MoneyValue;
  amount?: MoneyValue;
  executedOrderPrice?: MoneyValue;
  currency?: string;
  lotsRequested?: number;
  lotsExecuted?: number;
  lotsLeft?: number;
  lotsCancelled?: number;
  marker?: MarkerType;
  trades?: OrderTrade[];
  completionTime?: Timestamp;
  exchange?: string;
  instrumentUid?: string;
}

export interface OrderStateStreamResponse {
  orderState?: StreamOrderState;
  ping?: { time?: Timestamp; streamId?: string };
  subscription?: SubscriptionResponse;
}