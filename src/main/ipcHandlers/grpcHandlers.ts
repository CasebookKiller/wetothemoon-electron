import { ipcMain } from 'electron';
import { usersGrpc } from '@/main/services/tbank/UsersGrpcService';
import { instrumentsGrpc } from '@/main/services/tbank/InstrumentsGrpcService';
import { marketDataGrpc } from '@/main/services/tbank/MarketDataGrpcService';
import { operationsGrpc } from '@/main/services/tbank/OperationsGrpcService';
import { ordersGrpc } from '@/main/services/tbank/OrdersGrpcService';
import { stopOrdersGrpc } from '@/main/services/tbank/StopOrdersGrpcService';
import { sandboxGrpc } from '@/main/services/tbank/SandboxGrpcService';
import { signalGrpc } from '@/main/services/tbank/SignalGrpcService';

// Реестр сервисов
const grpcServices: Record<string, any> = {
  users: usersGrpc,
  instruments: instrumentsGrpc,
  marketdata: marketDataGrpc,
  operations: operationsGrpc,
  orders: ordersGrpc,
  stoporders: stopOrdersGrpc,
  sandbox: sandboxGrpc,
  signal: signalGrpc,
};

export function registerGrpcHandlers() {
  ipcMain.handle('grpc-call', async (_, serviceName: string, methodName: string, token: string, request: unknown) => {
    const service = grpcServices[serviceName];
    if (!service) throw new Error(`Unknown gRPC service: ${serviceName}`);
    if (typeof service[methodName] !== 'function') throw new Error(`Unknown method: ${methodName} in ${serviceName}`);
    return await service[methodName](request, token);
  });
}