import { createGrpcClient, createMetadata } from '@/main/utils/grpcHelper';
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

const client = createGrpcClient('orders.proto', 'OrdersService');

export const ordersGrpc = {
  postOrder: (request: PostOrderRequest, token: string): Promise<PostOrderResponse> =>
    new Promise((resolve, reject) => {
      client.PostOrder(request, createMetadata(token), (err: any, response: PostOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  postOrderAsync: (request: PostOrderAsyncRequest, token: string): Promise<PostOrderAsyncResponse> =>
    new Promise((resolve, reject) => {
      client.PostOrderAsync(request, createMetadata(token), (err: any, response: PostOrderAsyncResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  cancelOrder: (request: CancelOrderRequest, token: string): Promise<CancelOrderResponse> =>
    new Promise((resolve, reject) => {
      client.CancelOrder(request, createMetadata(token), (err: any, response: CancelOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getOrderState: (request: GetOrderStateRequest, token: string): Promise<OrderState> =>
    new Promise((resolve, reject) => {
      client.GetOrderState(request, createMetadata(token), (err: any, response: OrderState) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getOrders: (request: GetOrdersRequest, token: string): Promise<GetOrdersResponse> =>
    new Promise((resolve, reject) => {
      client.GetOrders(request, createMetadata(token), (err: any, response: GetOrdersResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  replaceOrder: (request: ReplaceOrderRequest, token: string): Promise<PostOrderResponse> =>
    new Promise((resolve, reject) => {
      client.ReplaceOrder(request, createMetadata(token), (err: any, response: PostOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getMaxLots: (request: GetMaxLotsRequest, token: string): Promise<GetMaxLotsResponse> =>
    new Promise((resolve, reject) => {
      client.GetMaxLots(request, createMetadata(token), (err: any, response: GetMaxLotsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getOrderPrice: (request: GetOrderPriceRequest, token: string): Promise<GetOrderPriceResponse> =>
    new Promise((resolve, reject) => {
      client.GetOrderPrice(request, createMetadata(token), (err: any, response: GetOrderPriceResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
};