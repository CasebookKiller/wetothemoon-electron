import { createGrpcClient, createMetadata } from '@/main/utils/grpcHelper';
import type { 
  GetInfoResponse,
  GetAccountsResponse,
  GetMarginAttributesResponse,
  GetUserTariffResponse,
  CurrencyTransferResponse,
  PayInResponse
} from '@/api/tbank/usersTypes'; // предполагаем, что типы лежат в src/api/tbank/types.ts (общие для Users)

const client = createGrpcClient('users.proto', 'UsersService');

export const usersGrpc = {
  getInfo: (token: string): Promise<GetInfoResponse> =>
    new Promise((resolve, reject) => {
      client.GetInfo({}, createMetadata(token), (err: any, response: GetInfoResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
  getAccounts: (request: any, token: string): Promise<GetAccountsResponse> =>
    new Promise((resolve, reject) => {
      client.GetAccounts(request, createMetadata(token), (err: any, response: GetAccountsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
  getMarginAttributes: (request: any, token: string): Promise<GetMarginAttributesResponse> =>
    new Promise((resolve, reject) => {
      client.GetMarginAttributes(request, createMetadata(token), (err: any, response: GetMarginAttributesResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
  getUserTariff: (request: any, token: string): Promise<GetUserTariffResponse> =>
    new Promise((resolve, reject) => {
      client.GetUserTariff(request, createMetadata(token), (err: any, response: GetUserTariffResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
  currencyTransfer: (request: any, token: string): Promise<CurrencyTransferResponse> =>
    new Promise((resolve, reject) => {
      client.CurrencyTransfer(request, createMetadata(token), (err: any, response: CurrencyTransferResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
  payIn: (request: any, token: string): Promise<PayInResponse> =>
    new Promise((resolve, reject) => {
      client.PayIn(request, createMetadata(token), (err: any, response: PayInResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
  getBankAccounts: (request: any, token: string): Promise<any> => // временно any, можно типизировать
    new Promise((resolve, reject) => {
      client.GetBankAccounts(request, createMetadata(token), (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
};