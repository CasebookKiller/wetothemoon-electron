import type { Timestamp, MoneyValue, Quotation, PingDelaySettings } from '../../../api/tbank/commonTypes';
import type {
  PortfolioResponse,
  PositionsSecurities,
  PositionsFutures,
  PositionsOptions,
  OperationType,
  OperationState,
  InstrumentType,
  PositionsResponse,
} from '../../../api/tbank/operationsTypes';   // уже существующие типы из REST‑сервиса

// ------------------ Enums ------------------

export enum PortfolioSubscriptionStatus {
  PORTFOLIO_SUBSCRIPTION_STATUS_UNSPECIFIED = 0,
  PORTFOLIO_SUBSCRIPTION_STATUS_SUCCESS = 1,
  PORTFOLIO_SUBSCRIPTION_STATUS_ACCOUNT_NOT_FOUND = 2,
  PORTFOLIO_SUBSCRIPTION_STATUS_INTERNAL_ERROR = 3,
}

export enum PositionsAccountSubscriptionStatus {
  POSITIONS_SUBSCRIPTION_STATUS_UNSPECIFIED = 0,
  POSITIONS_SUBSCRIPTION_STATUS_SUCCESS = 1,
  POSITIONS_SUBSCRIPTION_STATUS_ACCOUNT_NOT_FOUND = 2,
  POSITIONS_SUBSCRIPTION_STATUS_INTERNAL_ERROR = 3,
}

export enum OperationsAccountSubscriptionStatus {
  OPERATIONS_SUBSCRIPTION_STATUS_UNSPECIFIED = 0,
  OPERATIONS_SUBSCRIPTION_STATUS_SUCCESS = 1,
  OPERATIONS_SUBSCRIPTION_STATUS_ACCOUNT_NOT_FOUND = 2,
  OPERATIONS_SUBSCRIPTION_STATUS_INTERNAL_ERROR = 3,
}

// ------------------ Request / Response ------------------

export interface PortfolioStreamRequest {
  accounts?: string[];
  pingSettings?: PingDelaySettings;
}

export interface AccountSubscriptionStatus {
  accountId?: string;
  subscriptionStatus?: PortfolioSubscriptionStatus;
}

export interface PortfolioSubscriptionResult {
  accounts?: AccountSubscriptionStatus[];
  trackingId?: string;
  streamId?: string;
}

export interface PortfolioStreamResponse {
  subscriptions?: PortfolioSubscriptionResult;
  portfolio?: PortfolioResponse;
  ping?: {
    time?: Timestamp;
    streamId?: string;
  };
}

export interface PositionsStreamRequest {
  accounts?: string[];
  withInitialPositions?: boolean;
  pingSettings?: PingDelaySettings;
}

export interface PositionsSubscriptionStatus {
  accountId?: string;
  subscriptionStatus?: PositionsAccountSubscriptionStatus;
}

export interface PositionsSubscriptionResult {
  accounts?: PositionsSubscriptionStatus[];
  trackingId?: string;
  streamId?: string;
}

export interface PositionsMoney {
  availableValue?: MoneyValue;
  blockedValue?: MoneyValue;
}

export interface PositionData {
  accountId?: string;
  money?: PositionsMoney[];
  securities?: PositionsSecurities[];
  futures?: PositionsFutures[];
  options?: PositionsOptions[];
  date?: Timestamp;
}

export interface PositionsStreamResponse {
  subscriptions?: PositionsSubscriptionResult;
  position?: PositionData;
  ping?: {
    time?: Timestamp;
    streamId?: string;
  };
  initialPositions?: PositionsResponse;   // если потребуется
}

export interface OperationsStreamRequest {
  accounts?: string[];
  pingSettings?: PingDelaySettings;
}

export interface OperationsSubscriptionResult {
  accounts?: string[];
  subscriptionStatus?: OperationsAccountSubscriptionStatus;
  trackingId?: string;
  streamId?: string;
}

export interface OperationData {
  brokerAccountId?: string;
  id?: string;
  parentOperationId?: string;
  name?: string;
  date?: Timestamp;
  type?: OperationType;
  state?: OperationState;
  instrumentUid?: string;
  figi?: string;
  instrumentType?: string;
  instrumentKind?: InstrumentType;   // InstrumentType из instruments-types
  positionUid?: string;
  ticker?: string;
  classCode?: string;
  payment?: MoneyValue;
}

export interface OperationsStreamResponse {
  subscriptions?: OperationsSubscriptionResult;
  operation?: OperationData;
  ping?: {
    time?: Timestamp;
    streamId?: string;
  };
}