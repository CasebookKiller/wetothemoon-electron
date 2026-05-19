import { createGrpcClient, createMetadata } from '@/main/utils/grpcHelper';
import type {
  CancelStopOrderRequest,
  CancelStopOrderResponse,
  GetStopOrdersRequest,
  GetStopOrdersResponse,
  PostStopOrderRequest,
  PostStopOrderResponse,
} from '@/api/tbank/stopordersTypes';

const client = createGrpcClient('stoporders.proto', 'StopOrdersService');

export const stopOrdersGrpc = {
  cancelStopOrder: (request: CancelStopOrderRequest, token: string): Promise<CancelStopOrderResponse> =>
    new Promise((resolve, reject) => {
      client.CancelStopOrder(request, createMetadata(token), (err: any, response: CancelStopOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getStopOrders: (request: GetStopOrdersRequest, token: string): Promise<GetStopOrdersResponse> =>
    new Promise((resolve, reject) => {
      client.GetStopOrders(request, createMetadata(token), (err: any, response: GetStopOrdersResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  postStopOrder: (request: PostStopOrderRequest, token: string): Promise<PostStopOrderResponse> =>
    new Promise((resolve, reject) => {
      client.PostStopOrder(request, createMetadata(token), (err: any, response: PostStopOrderResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
};