import path from 'path';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { BrowserWindow, ipcMain } from 'electron';
import { getProtoPath } from '../utils/protoPath';

export const registerOperationsStreamHandlers = () => {
  // регистрируем обработчики API

  // ---------- OperationsStreamService ----------

  let opsStreams: Record<string, grpc.ClientReadableStream<any> | null> = {
    portfolio: null,
    positions: null,
    operations: null,
  };

  let opsClient: any;

  function ensureOpsClient(mainWindow: BrowserWindow) {
    if (opsClient) return opsClient;
    
    const OPS_PROTO_PATH = getProtoPath('operations.proto');
    const packageDefinition = protoLoader.loadSync(OPS_PROTO_PATH, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    const OperationsStreamService = proto.tinkoff.public.invest.api.contract.v1.OperationsStreamService;

    opsClient = new OperationsStreamService(
      'invest-public-api.tbank.ru:443',
      grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false }),
      { 'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru' }
    );
    return opsClient;
  }

  ipcMain.handle('ops-stream-start', async (event, streamType: string, token: string, requestBody: any) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender) || null;
    const client = ensureOpsClient(mainWindow!);
    const metadata = new grpc.Metadata();
    metadata.add('Authorization', `Bearer ${token}`);

    // Остановить предыдущий стрим этого же типа
    if (opsStreams[streamType]) {
      opsStreams[streamType].cancel();
      opsStreams[streamType] = null;
    }

    let stream: grpc.ClientReadableStream<any>;
    try {
      if (streamType === 'portfolio') {
        stream = client.PortfolioStream(requestBody, metadata);
      } else if (streamType === 'positions') {
        stream = client.PositionsStream(requestBody, metadata);
      } else if (streamType === 'operations') {
        stream = client.OperationsStream(requestBody, metadata);
      } else {
        throw new Error(`Unknown stream type: ${streamType}`);
      }
    } catch (err: any) {
      mainWindow?.webContents.send('ops-stream-error', streamType, err.message);
      return;
    }

    opsStreams[streamType] = stream;

    let buffer = '';
    stream.on('data', (data: any) => {
      const chunk = JSON.stringify(data);
      buffer += chunk;
      // Потоковый парсер JSON (аналогично MarketData)
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
              mainWindow?.webContents.send(`ops-${streamType}-data`, jsonStr);
            } catch { /* ignore invalid */ }
          }
        }
      }
      buffer = depth > 0 ? buffer.substring(begin) : '';
    });

    stream.on('status', (status: grpc.StatusObject) => {
      mainWindow?.webContents.send(`ops-${streamType}-closed`);
      opsStreams[streamType] = null;
    });

    stream.on('error', (err: any) => {
      mainWindow?.webContents.send('ops-stream-error', streamType, err.message);
      opsStreams[streamType] = null;
    });
  });

  ipcMain.handle('ops-stream-stop', async () => {
    for (const key of Object.keys(opsStreams)) {
      opsStreams[key]?.cancel();
      opsStreams[key] = null;
    }
  });


}
