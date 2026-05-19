import { createGrpcClient, createMetadata } from '@/main/utils/grpcHelper';
import type {
  GetSignalsRequest,
  GetSignalsResponse,
  GetStrategiesRequest,
  GetStrategiesResponse,
} from '@/api/tbank/signalTypes';

const client = createGrpcClient('signals.proto', 'SignalService');

export const signalGrpc = {
  getSignals: (request: GetSignalsRequest, token: string): Promise<GetSignalsResponse> =>
    new Promise((resolve, reject) => {
      client.GetSignals(request, createMetadata(token), (err: any, response: GetSignalsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getStrategies: (request: GetStrategiesRequest, token: string): Promise<GetStrategiesResponse> =>
    new Promise((resolve, reject) => {
      client.GetStrategies(request, createMetadata(token), (err: any, response: GetStrategiesResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
};