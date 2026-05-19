import { createGrpcClient, createMetadata } from '@/main/utils/grpcHelper';
import type {
  OperationsRequest,
  OperationsResponse,
  PortfolioRequest,
  PortfolioResponse,
  PositionsRequest,
  PositionsResponse,
  WithdrawLimitsRequest,
  WithdrawLimitsResponse,
  BrokerReportRequest,
  BrokerReportResponse,
  GetDividendsForeignIssuerRequest,
  GetDividendsForeignIssuerResponse,
  GetOperationsByCursorRequest,
  GetOperationsByCursorResponse,
} from '@/api/tbank/operationsTypes';

const client = createGrpcClient('operations.proto', 'OperationsService');

export const operationsGrpc = {
  getOperations: (request: OperationsRequest, token: string): Promise<OperationsResponse> =>
    new Promise((resolve, reject) => {
      client.GetOperations(request, createMetadata(token), (err: any, response: OperationsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getPortfolio: (request: PortfolioRequest, token: string): Promise<PortfolioResponse> =>
    new Promise((resolve, reject) => {
      client.GetPortfolio(request, createMetadata(token), (err: any, response: PortfolioResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getPositions: (request: PositionsRequest, token: string): Promise<PositionsResponse> =>
    new Promise((resolve, reject) => {
      client.GetPositions(request, createMetadata(token), (err: any, response: PositionsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getWithdrawLimits: (request: WithdrawLimitsRequest, token: string): Promise<WithdrawLimitsResponse> =>
    new Promise((resolve, reject) => {
      client.GetWithdrawLimits(request, createMetadata(token), (err: any, response: WithdrawLimitsResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getBrokerReport: (request: BrokerReportRequest, token: string): Promise<BrokerReportResponse> =>
    new Promise((resolve, reject) => {
      client.GetBrokerReport(request, createMetadata(token), (err: any, response: BrokerReportResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getDividendsForeignIssuer: (request: GetDividendsForeignIssuerRequest, token: string): Promise<GetDividendsForeignIssuerResponse> =>
    new Promise((resolve, reject) => {
      client.GetDividendsForeignIssuer(request, createMetadata(token), (err: any, response: GetDividendsForeignIssuerResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),

  getOperationsByCursor: (request: GetOperationsByCursorRequest, token: string): Promise<GetOperationsByCursorResponse> =>
    new Promise((resolve, reject) => {
      client.GetOperationsByCursor(request, createMetadata(token), (err: any, response: GetOperationsByCursorResponse) => {
        if (err) reject(err);
        else resolve(response);
      });
    }),
};