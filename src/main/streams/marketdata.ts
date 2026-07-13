import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ipcMain } from 'electron';
import { getProtoPath } from '../utils/protoPath';
import { marketDataBus } from '../services/marketDataBus';

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_DELAY_MS = 3000;

interface StreamState {
  stream: grpc.ClientReadableStream<any> | null;
  client: any;
  retryTimeout: ReturnType<typeof setTimeout> | null;
  retryCount: number;
}

const streams = new Map<string, StreamState>();

function getOrCreateClient(streamKey: string): any {
  if (!streams.has(streamKey)) {
    streams.set(streamKey, { stream: null, client: null, retryTimeout: null, retryCount: 0 });
  }
  const state = streams.get(streamKey)!;
  if (!state.client) {
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
    state.client = new MarketDataStreamService(
      'invest-public-api.tbank.ru:443',
      grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false }),
      { 'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru' }
    );
  }
  return state.client;
}

export const registerMarketdataStreamHandlers = () => {
  console.log('[Main] registerMDStreamHandlers called');

  ipcMain.handle('md-stream-start', async (_, streamKey: string, token: string, requestBody: any) => {
    console.log(`[Main] md-stream-start called for ${streamKey}`);
    const state = streams.get(streamKey) || { stream: null, client: null, retryTimeout: null, retryCount: 0 };
    streams.set(streamKey, state);

    // Остановить текущий стрим, если есть
    if (state.stream) {
      state.stream.cancel();
      state.stream = null;
    }
    if (state.retryTimeout) {
      clearTimeout(state.retryTimeout);
      state.retryTimeout = null;
    }
    state.retryCount = 0;

    const client = getOrCreateClient(streamKey);

    const connect = () => {
      if (state.retryCount >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`[Main] Достигнуто максимальное количество попыток для ${streamKey}`);
        return;
      }

      console.log(`[Main] Подключение стрима ${streamKey} (попытка ${state.retryCount + 1})`);
      const metadata = new grpc.Metadata();
      metadata.add('Authorization', `Bearer ${token}`);

      const stream = client.MarketDataServerSideStream(requestBody, metadata);
      if (!stream) {
        if (state.retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
        return;
      }
      state.stream = stream;

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
          catch (e) { continue; }

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
        console.log(`[Main] Стрим ${streamKey} завершён`);
        state.stream = null;
        if (state.retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
      });

      stream.on('error', (err: any) => {
        console.error(`[Main] Ошибка стрима ${streamKey}: ${err.message}`);
        state.stream = null;
        if (err.code === 8) { // RESOURCE_EXHAUSTED
          console.error(`[Main] Лимит стримов исчерпан для ${streamKey}`);
          return;
        }
        if (state.retryCount < MAX_RECONNECT_ATTEMPTS) scheduleReconnect();
      });
    };

    const scheduleReconnect = () => {
      const delay = BASE_DELAY_MS * Math.pow(2, state.retryCount);
      state.retryCount++;
      console.log(`[Main] Переподключение ${streamKey} через ${delay / 1000}с (попытка ${state.retryCount})`);
      state.retryTimeout = setTimeout(connect, delay);
    };

    connect();
  });

  ipcMain.handle('md-stream-stop', async (_, streamKey: string) => {
    console.log(`[Main] md-stream-stop called for ${streamKey}`);
    const state = streams.get(streamKey);
    if (!state) return;
    if (state.retryTimeout) { clearTimeout(state.retryTimeout); state.retryTimeout = null; }
    if (state.stream) {
      state.stream.cancel();
      state.stream = null;
    }
  });
};