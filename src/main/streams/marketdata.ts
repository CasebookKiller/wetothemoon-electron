// /src/main/streams/marketdata.ts

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ipcMain } from 'electron';
import { getBondsWindow } from '../windows/bondsWindow';
import { getProtoPath } from '../utils/protoPath';
import { marketDataBus } from '../services/marketDataBus';

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
    console.log('[Main] Token:', token?.slice(0, 12) + '...');
    console.log('[Main] Request body:', JSON.stringify(requestBody).slice(0, 400));

    if (currentStream) {
      console.log('[Main] Stopping previous stream');
      currentStream.cancel();
      currentStream = null;
    }

    const metadata = new grpc.Metadata();
    metadata.add('Authorization', `Bearer ${token}`);

    console.log('[Main] Calling MarketDataServerSideStream...');
    const stream = client.MarketDataServerSideStream(requestBody, metadata);
    currentStream = stream;
    console.log('[Main] Stream created');

    // Буфер для неполных данных (если data приходит строкой)
    let buffer = '';

    stream.on('data', (data: any) => {
      // gRPC может отдавать уже готовый объект – сразу отправляем
      if (typeof data !== 'string' && typeof data !== 'object') return;

      // Если пришёл объект, превращаем в строку и добавляем в буфер
      const chunk = typeof data === 'string' ? data : JSON.stringify(data);
      buffer += chunk;

      // Потоковый разбор: ищем полные JSON-объекты по фигурным скобкам
      let begin = 0;
      let depth = 0;
      let inString = false;
      let escape = false;

      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];

        if (inString) {
          if (escape) escape = false;
          else if (ch === '\\') escape = true;
          else if (ch === '"') inString = false;
          continue;
        }

        if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          if (depth === 0) begin = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const jsonStr = buffer.substring(begin, i + 1);
            try {
              const parsed = JSON.parse(jsonStr);          // <-- парсим один раз
              // 1. Отправляем в шину для всех подписчиков main-процесса
              if (parsed.candle) {
                marketDataBus.emit('candle', parsed.candle);
              }
              if (parsed.trade) {
                marketDataBus.emit('trade', parsed.trade);
              }
              if (parsed.orderbook) {
                marketDataBus.emit('orderbook', parsed.orderbook);
              }
              if (parsed.lastPrice) {
                marketDataBus.emit('lastPrice', parsed.lastPrice);
              }
              if (parsed.openInterest) {
                marketDataBus.emit('openInterest', parsed.openInterest);
              }
              // … при необходимости добавьте другие типы (tradingStatus, ping)

              // 2. Отправляем в окно BondsWindow (как раньше)
              const win = getBondsWindow();
              if (win && !win.isDestroyed()) {
                win.webContents.send('md-stream-data', jsonStr);
              } else {
                // console.warn('[Main] Bonds window not available'); // окно не нужно, данные идут в шину
              }
            } catch {
              console.warn('[Main] Skipped invalid JSON fragment:', jsonStr.slice(0, 100));
            }
          }
        }
      }

      // Оставляем в буфере только незавершённый остаток
      if (depth > 0) {
        buffer = buffer.substring(begin);
      } else {
        buffer = '';
      }
    });

    stream.on('status', (status: any) => {
      const win = getBondsWindow();
      if (win) win.webContents.send('md-stream-closed');
    });

    stream.on('error', (err: any) => {
      const win = getBondsWindow();
      if (win) win.webContents.send('md-stream-error', err.message);
    });

    console.log('[Main] Request sent');
  });

  ipcMain.handle('md-stream-stop', async () => {
    console.log('[Main] md-stream-stop called');
    if (currentStream) {
      currentStream.cancel();
      currentStream = null;
    }
  });

};
