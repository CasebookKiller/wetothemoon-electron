// src/main/services/tbank/SandboxGrpcService.ts

import { createGrpcClient, createMetadata } from '@/main/utils/grpcHelper';
import type {
  OpenSandboxAccountRequest,
  OpenSandboxAccountResponse,
  CloseSandboxAccountRequest,
  CloseSandboxAccountResponse,
  SandboxPayInRequest,
  SandboxPayInResponse,
} from '@/api/tbank/sandboxTypes';
import type {
  GetAccountsRequest,
  GetAccountsResponse,
} from '@/api/tbank/usersTypes';
import type {
  PostOrderRequest,
  PostOrderResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  GetOrderStateRequest,
  OrderState,
  GetOrdersRequest,
  GetOrdersResponse,
  ReplaceOrderRequest,
  GetMaxLotsRequest,
  GetMaxLotsResponse,
  GetOrderPriceRequest,
  GetOrderPriceResponse,
  PostOrderAsyncRequest,
  PostOrderAsyncResponse,
} from '@/api/tbank/ordersTypes';
import type {
  CancelStopOrderRequest,
  CancelStopOrderResponse,
  GetStopOrdersRequest,
  GetStopOrdersResponse,
  PostStopOrderRequest,
  PostStopOrderResponse,
} from '@/api/tbank/stopordersTypes';
import type {
  OperationsRequest,
  OperationsResponse,
  PortfolioRequest,
  PortfolioResponse,
  PositionsRequest,
  PositionsResponse,
  WithdrawLimitsRequest,
  WithdrawLimitsResponse,
  GetOperationsByCursorRequest,
  GetOperationsByCursorResponse,
} from '@/api/tbank/operationsTypes';

const client = createGrpcClient('sandbox.proto', 'SandboxService');

export const sandboxGrpc = {
  openSandboxAccount: (request: OpenSandboxAccountRequest, token: string): Promise<OpenSandboxAccountResponse> =>
    new Promise((resolve, reject) => {
      client.OpenSandboxAccount(request, createMetadata(token), (err: any, response: OpenSandboxAccountResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  closeSandboxAccount: (request: CloseSandboxAccountRequest, token: string): Promise<CloseSandboxAccountResponse> =>
    new Promise((resolve, reject) => {
      client.CloseSandboxAccount(request, createMetadata(token), (err: any, response: CloseSandboxAccountResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxAccounts: (request: GetAccountsRequest, token: string): Promise<GetAccountsResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxAccounts(request, createMetadata(token), (err: any, response: GetAccountsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  sandboxPayIn: (request: SandboxPayInRequest, token: string): Promise<SandboxPayInResponse> =>
    new Promise((resolve, reject) => {
      client.SandboxPayIn(request, createMetadata(token), (err: any, response: SandboxPayInResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  // заявки (песочница) - используем типы из ordersTypes, но RPC имеют префикс Sandbox
  postSandboxOrder: (request: PostOrderRequest, token: string): Promise<PostOrderResponse> =>
    new Promise((resolve, reject) => {
      client.PostSandboxOrder(request, createMetadata(token), (err: any, response: PostOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  postSandboxOrderAsync: (request: PostOrderAsyncRequest, token: string): Promise<PostOrderAsyncResponse> =>
    new Promise((resolve, reject) => {
      client.PostSandboxOrderAsync(request, createMetadata(token), (err: any, response: PostOrderAsyncResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  cancelSandboxOrder: (request: CancelOrderRequest, token: string): Promise<CancelOrderResponse> =>
    new Promise((resolve, reject) => {
      client.CancelSandboxOrder(request, createMetadata(token), (err: any, response: CancelOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxOrderState: (request: GetOrderStateRequest, token: string): Promise<OrderState> =>
    new Promise((resolve, reject) => {
      client.GetSandboxOrderState(request, createMetadata(token), (err: any, response: OrderState) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxOrders: (request: GetOrdersRequest, token: string): Promise<GetOrdersResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxOrders(request, createMetadata(token), (err: any, response: GetOrdersResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  replaceSandboxOrder: (request: ReplaceOrderRequest, token: string): Promise<PostOrderResponse> =>
    new Promise((resolve, reject) => {
      client.ReplaceSandboxOrder(request, createMetadata(token), (err: any, response: PostOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxMaxLots: (request: GetMaxLotsRequest, token: string): Promise<GetMaxLotsResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxMaxLots(request, createMetadata(token), (err: any, response: GetMaxLotsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxOrderPrice: (request: GetOrderPriceRequest, token: string): Promise<GetOrderPriceResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxOrderPrice(request, createMetadata(token), (err: any, response: GetOrderPriceResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  // стоп-заявки
  cancelSandboxStopOrder: (request: CancelStopOrderRequest, token: string): Promise<CancelStopOrderResponse> =>
    new Promise((resolve, reject) => {
      client.CancelSandboxStopOrder(request, createMetadata(token), (err: any, response: CancelStopOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxStopOrders: (request: GetStopOrdersRequest, token: string): Promise<GetStopOrdersResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxStopOrders(request, createMetadata(token), (err: any, response: GetStopOrdersResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  postSandboxStopOrder: (request: PostStopOrderRequest, token: string): Promise<PostStopOrderResponse> =>
    new Promise((resolve, reject) => {
      client.PostSandboxStopOrder(request, createMetadata(token), (err: any, response: PostStopOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  // операции
  getSandboxOperations: (request: OperationsRequest, token: string): Promise<OperationsResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxOperations(request, createMetadata(token), (err: any, response: OperationsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxOperationsByCursor: (request: GetOperationsByCursorRequest, token: string): Promise<GetOperationsByCursorResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxOperationsByCursor(request, createMetadata(token), (err: any, response: GetOperationsByCursorResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxPortfolio: (request: PortfolioRequest, token: string): Promise<PortfolioResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxPortfolio(request, createMetadata(token), (err: any, response: PortfolioResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxPositions: (request: PositionsRequest, token: string): Promise<PositionsResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxPositions(request, createMetadata(token), (err: any, response: PositionsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getSandboxWithdrawLimits: (request: WithdrawLimitsRequest, token: string): Promise<WithdrawLimitsResponse> =>
    new Promise((resolve, reject) => {
      client.GetSandboxWithdrawLimits(request, createMetadata(token), (err: any, response: WithdrawLimitsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
};