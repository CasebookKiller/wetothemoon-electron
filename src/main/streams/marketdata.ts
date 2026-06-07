// /src/main/streams/marketdata.ts

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ipcMain } from 'electron';
import { getBondsWindow } from '../windows/bondsWindow';
import { getProtoPath } from '../utils/protoPath';
import { marketDataBus } from '../services/marketDataBus';

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;

let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let stopRequested = false; // флаг, чтобы не переподключаться после ручной остановки

export const registerMarketdataStreamHandlers = () => {
  // регистрируем обработчики API

  let currentStream: grpc.ClientReadableStream<any> | null = null;

  console.log('[Main] registerMDStreamHandlers called');

  const PROTO_PATH = getProtoPath('marketdata.proto');
  console.log('[Main] Proto path:', PROTO_PATH);

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  const MarketDataStreamService = proto.tinkoff.public.invest.api.contract.v1.MarketDataStreamService;
  console.log('[Main] Proto loaded, service:', !!MarketDataStreamService);

  const client = new MarketDataStreamService(
    'invest-public-api.tbank.ru:443',
    grpc.credentials.createSsl(
      null,        // корневой сертификат (null = использовать системные)
      null,        // приватный ключ
      null,        // сертификат клиента (если есть)
      { rejectUnauthorized: false }   // ← отключаем проверку сертификата
    ),
    {
      'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru',
    }
  );
  console.log('[Main] gRPC client created');

  ipcMain.handle('md-stream-start', async (_, token: string, requestBody: any) => {
    console.log('[Main] md-stream-start called');
    stopRequested = false; // сбрасываем флаг остановки

    // Останавливаем текущий стрим и таймеры, если есть
    if (currentStream) {
      currentStream.cancel();
      currentStream = null;
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    retryCount = 0;

    // Функция подключения
    const connect = () => {
      if (stopRequested) {
        console.log('[Main] Reconnect stopped by user');
        return;
      }

      console.log(`[Main] Connecting stream (attempt ${retryCount + 1})`);
      const metadata = new grpc.Metadata();
      metadata.add('Authorization', `Bearer ${token}`);

      const stream = client.MarketDataServerSideStream(requestBody, metadata);
      currentStream = stream;

      // Буфер для неполных данных
      let buffer = '';

      stream.on('data', (data: any) => {
        if (typeof data !== 'string' && typeof data !== 'object') return;
        const chunk = typeof data === 'string' ? data : JSON.stringify(data);
        buffer += chunk;
        // ... (существующий разбор JSON, оставь без изменений) ...
        // После успешного разбора оставляем остаток в buffer
      });

      stream.on('end', () => {
        console.log('[Main] Stream ended');
        currentStream = null;
        // Если останов не запрошен – переподключаемся
        if (!stopRequested) scheduleReconnect();
      });

      stream.on('error', (err: any) => {
        console.error('[Main] Stream error:', err.message);
        currentStream = null;
        if (!stopRequested) scheduleReconnect();
      });

      stream.on('status', (status: any) => {
        // статус можно логировать, но reconnect сработает по end/error
        console.log('[Main] Stream status:', status);
      });
    };

    const scheduleReconnect = () => {
      if (stopRequested) return;
      if (retryCount >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[Main] Max reconnection attempts reached');
        return;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
      retryCount++;
      console.log(`[Main] Scheduling reconnect in ${delay}ms (attempt ${retryCount})`);
      retryTimeout = setTimeout(connect, delay);
    };

    connect(); // Первая попытка
  });

  ipcMain.handle('md-stream-stop', async () => {
    console.log('[Main] md-stream-stop called');
    stopRequested = true;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (currentStream) {
      currentStream.cancel();
      currentStream = null;
    }
  });

};
