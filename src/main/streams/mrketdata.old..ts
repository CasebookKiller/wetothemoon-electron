// /src/main/streams/marketdata.ts

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ipcMain } from 'electron';
import { getProtoPath } from '../utils/protoPath';
import { marketDataBus } from '../services/marketDataBus';
import { handleApiError } from '../services/apiErrorHandler';

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_DELAY_MS = 3000;

let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let currentStream: grpc.ClientReadableStream<any> | null = null;
let client: any = null;

function createClient(): any {
  const PROTO_PATH = getProtoPath('marketdata.proto');
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  const MarketDataStreamService = proto.tinkoff.public.invest.api.contract.v1.MarketDataStreamService;

  return new MarketDataStreamService(
    'invest-public-api.tbank.ru:443',
    grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false }),
    { 'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru' }
  );
}

export const registerMarketdataStreamHandlers = () => {
  console.log('[Main] registerMDStreamHandlers called');
  client = createClient(); // начальное создание клиента

  ipcMain.handle('md-stream-start', async (_, token: string, requestBody: any) => {
    console.log('[Main] md-stream-start called');

    // 1. Остановить текущий стрим, если есть
    if (currentStream) {
      currentStream.cancel();
      currentStream = null;
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    retryCount = 0;

    // 2. Принудительно закрываем старый клиент и создаём новый,
    //    чтобы гарантированно освободить ресурс на сервере.
    if (client) {
      try { client.close(); } catch (e) {}
    }
    client = createClient();

    // 3. Функция подключения
    const connect = () => {
      if (retryCount >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[Main] Достигнуто максимальное количество попыток переподключения');
        return;
      }

      console.log(`[Main] Подключение стрима (попытка ${retryCount + 1})`);
      const metadata = new grpc.Metadata();
      metadata.add('Authorization', `Bearer ${token}`);

      const stream = client.MarketDataServerSideStream(requestBody, metadata);
      if (!stream) {
        console.error('[Main] Не удалось создать стрим');
        // Попробуем переподключиться позже
        if (retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
        return;
      }
      currentStream = stream;

      let buffer = '';

      stream.on('data', (data: any) => {
        if (typeof data !== 'string' && typeof data !== 'object') return;
        const chunk = typeof data === 'string' ? data : JSON.stringify(data);
        buffer += chunk;

        while (buffer.length > 0) {
          let jsonEnd = -1;
          let depth = 0;
          for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === '{') depth++;
            else if (buffer[i] === '}') {
              depth--;
              if (depth === 0) { jsonEnd = i + 1; break; }
            }
          }
          if (jsonEnd === -1) break;

          const jsonStr = buffer.substring(0, jsonEnd);
          buffer = buffer.substring(jsonEnd);

          let parsed: any;
          try { parsed = JSON.parse(jsonStr); }
          catch (e) { console.warn('[Stream] Ошибка парсинга'); continue; }

          if (parsed.candle) {
            const c = parsed.candle;
            marketDataBus.emit('candle', {
              instrumentUid: c.instrumentUid || c.figi,
              figi: c.figi,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
              time: c.time,
            });
          }
        }
      });

      stream.on('end', () => {
        console.log('[Main] Стрим завершён');
        currentStream = null;
        if (retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
      });

      stream.on('error', (err: any) => {
        handleApiError(err);  // цветной вывод уже внутри
        currentStream = null;
        if (err.code === 8) { // RESOURCE_EXHAUSTED
          console.error('[Main] Лимит стримов исчерпан, дальнейшие попытки остановлены');
          return;
        }
        if (retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
      });
    };
    const scheduleReconnect = () => {
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
      retryCount++;
      console.log(`[Main] Переподключение через ${delay / 1000}с (попытка ${retryCount})`);
      retryTimeout = setTimeout(connect, delay);
    };

    connect(); // первая попытка
  });

  ipcMain.handle('md-stream-stop', async () => {
    console.log('[Main] md-stream-stop called');
    if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null; }
    if (currentStream) {
      currentStream.cancel();
      currentStream = null;
    }
    // не закрываем клиент, чтобы можно было быстро перезапустить стрим
  });
};