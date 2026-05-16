import path from 'path';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { BrowserWindow, ipcMain } from 'electron';

export const registerOrdersStreamHandlers = () => {
  // регистрируем обработчики API

  // ---------- OrdersStreamService ----------

  let ordersStreams: Record<string, grpc.ClientReadableStream<any> | null> = {
    trades: null,
    orderState: null,
  };

  let ordersClient: any;

  function ensureOrdersClient() {
    if (ordersClient) return ordersClient;
    const PROTO_PATH = path.join(__dirname, 'proto', 'orders.proto'); // ваш файл с OrdersStreamService
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, { /* ... */ });
    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    const OrdersStreamService = proto.tinkoff.public.invest.api.contract.v1.OrdersStreamService;
    ordersClient = new OrdersStreamService(
      'invest-public-api.tbank.ru:443',
      grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false }),
      { 'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru' }
    );
    return ordersClient;
  }

  ipcMain.handle('orders-stream-start', async (event, streamType: string, token: string, requestBody: any) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender) || null;
    const client = ensureOrdersClient();
    const metadata = new grpc.Metadata();
    metadata.add('Authorization', `Bearer ${token}`);

    if (ordersStreams[streamType]) {
      ordersStreams[streamType]!.cancel();
      ordersStreams[streamType] = null;
    }

    let stream: grpc.ClientReadableStream<any>;
    try {
      if (streamType === 'trades') {
        stream = client.TradesStream(requestBody, metadata);
      } else if (streamType === 'orderState') {
        stream = client.OrderStateStream(requestBody, metadata);
      } else {
        throw new Error(`Unknown stream type: ${streamType}`);
      }
    } catch (err: any) {
      mainWindow?.webContents.send('orders-stream-error', streamType, err.message);
      return;
    }

    ordersStreams[streamType] = stream;

    let buffer = '';
    stream.on('data', (data: any) => {
      const chunk = JSON.stringify(data);
      buffer += chunk;
      // Потоковый парсер JSON (как в OperationsStream)
      let begin = 0, depth = 0, inString = false, escape = false;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        if (inString) {
          if (escape) escape = false;
          else if (ch === '\\') escape = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') { if (depth === 0) begin = i; depth++; }
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const jsonStr = buffer.substring(begin, i + 1);
            try {
              JSON.parse(jsonStr);
              mainWindow?.webContents.send(`orders-${streamType}-data`, jsonStr);
            } catch { /* ignore */ }
          }
        }
      }
      buffer = depth > 0 ? buffer.substring(begin) : '';
    });

    stream.on('status', () => {
      mainWindow?.webContents.send(`orders-${streamType}-closed`);
      ordersStreams[streamType] = null;
    });

    stream.on('error', (err: any) => {
      mainWindow?.webContents.send('orders-stream-error', streamType, err.message);
      ordersStreams[streamType] = null;
    });
  });

  ipcMain.handle('orders-stream-stop', async () => {
    for (const key of Object.keys(ordersStreams)) {
      ordersStreams[key]?.cancel();
      ordersStreams[key] = null;
    }
  });

}