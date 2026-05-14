// src/components/BONDS/MarketStreamTest/MarketStreamTest.tsx

import React, { useEffect, useRef, useState } from 'react';
import { MarketDataStreamServiceClient } from '@/api/tbank/MarketDataStreamService';
import type {
  StreamCandle,
  StreamOrderBook,
  StreamTrade,
  StreamTradingStatus,
  StreamLastPrice,
  StreamOpenInterest,
} from '@/api/tbank/marketdataStreamTypes';

interface LogEntry {
  time: string;
  type: string;
  data: any;
}

const MarketStreamTest: React.FC = () => {
  const clientRef = useRef<MarketDataStreamServiceClient | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState({
    candles: false,
    orderbook: false,
    trades: false,
    info: false,
    lastPrice: false,
  });

  const addLog = (type: string, data: any) => {
    setLogs(prev => [...prev.slice(-500), { time: new Date().toISOString(), type, data }]);
  };

  // Инициализация клиента
  useEffect(() => {
    const token = import.meta.env.VITE_TReadOnly;

    if (!(window as any).electronAPI) {
      addLog('error', 'electronAPI не найден – стрим недоступен');
      return;
    }

    const client = new MarketDataStreamServiceClient(token);
    clientRef.current = client;

    // Подписываемся на все возможные события
    client
      .onCandle((c: StreamCandle) => addLog('candle', c))
      .onOrderBook((ob: StreamOrderBook) => addLog('orderbook', ob))
      .onTrade((t: StreamTrade) => addLog('trade', t))
      .onTradingStatus((ts: StreamTradingStatus) => addLog('tradingStatus', ts))
      .onLastPrice((lp: StreamLastPrice) => addLog('lastPrice', lp))
      .onOpenInterest((oi: StreamOpenInterest) => addLog('openInterest', oi))
      .onClosed(() => addLog('system', 'Stream closed'))
      .onError((err: string) => addLog('error', err));

    // Дополнительно логируем ответы подписок
    client['addListener']?.('subscribeCandlesResponse', (d: any) => addLog('subscribeCandlesResponse', d));
    client['addListener']?.('subscribeOrderBookResponse', (d: any) => addLog('subscribeOrderBookResponse', d));
    client['addListener']?.('subscribeTradesResponse', (d: any) => addLog('subscribeTradesResponse', d));
    client['addListener']?.('subscribeInfoResponse', (d: any) => addLog('subscribeInfoResponse', d));
    client['addListener']?.('subscribeLastPriceResponse', (d: any) => addLog('subscribeLastPriceResponse', d));
    client['addListener']?.('ping', (d: any) => addLog('ping', d));

    return () => {
      client.disconnect();
    };
  }, []);

  // Функция для отправки запроса на основе текущих подписок
  const updateSubscriptions = () => {
    const client = clientRef.current;
    if (!client) return;

    const request: any = {};

    if (subscriptions.candles) {
      request.subscribeCandlesRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
        instruments: [{
          instrumentId: 'BBG004730N88',
          interval: 'SUBSCRIPTION_INTERVAL_ONE_MINUTE'
        }],
        waitingClose: false,
      };
    } else {
      request.subscribeCandlesRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_UNSUBSCRIBE',
        instruments: [{
          instrumentId: 'BBG004730N88',
          interval: 'SUBSCRIPTION_INTERVAL_ONE_MINUTE'
        }],
      };
    }

    if (subscriptions.orderbook) {
      request.subscribeOrderBookRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
        instruments: [{
          instrumentId: 'BBG004730N88',
          depth: 10,
          orderBookType: 'ORDERBOOK_TYPE_EXCHANGE'
        }]
      };
    } else {
      request.subscribeOrderBookRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_UNSUBSCRIBE',
        instruments: [{
          instrumentId: 'BBG004730N88',
          depth: 10,
          orderBookType: 'ORDERBOOK_TYPE_EXCHANGE'
        }]
      };
    }

    if (subscriptions.trades) {
      request.subscribeTradesRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
        instruments: [{ instrumentId: 'BBG004730N88' }]
      };
    } else {
      request.subscribeTradesRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_UNSUBSCRIBE',
        instruments: [{ instrumentId: 'BBG004730N88' }]
      };
    }

    if (subscriptions.info) {
      request.subscribeInfoRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
        instruments: [{ instrumentId: 'BBG004730N88' }]
      };
    } else {
      request.subscribeInfoRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_UNSUBSCRIBE',
        instruments: [{ instrumentId: 'BBG004730N88' }]
      };
    }

    if (subscriptions.lastPrice) {
      request.subscribeLastPriceRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
        instruments: [{ instrumentId: 'BBG004730N88' }]
      };
    } else {
      request.subscribeLastPriceRequest = {
        subscriptionAction: 'SUBSCRIPTION_ACTION_UNSUBSCRIBE',
        instruments: [{ instrumentId: 'BBG004730N88' }]
      };
    }

    client.marketDataStream(request);
    addLog('system', 'Подписки обновлены: ' + JSON.stringify(subscriptions));
  };

  const toggleSubscription = (key: keyof typeof subscriptions) => {
    setSubscriptions(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      // Обновим стрим при следующем тике
      setTimeout(() => updateSubscriptions(), 0);
      return updated;
    });
  };

  return (
    <div style={{ padding: '1em' }}>
      <h2>MarketDataStream Test</h2>

      <div style={{ marginBottom: '1em' }}>
        {(['candles', 'orderbook', 'trades', 'info', 'lastPrice'] as const).map((key) => (
          <label key={key} style={{ marginRight: '1em' }}>
            <input
              type="checkbox"
              checked={subscriptions[key]}
              onChange={() => toggleSubscription(key)}
            />
            {key}
          </label>
        ))}
      </div>

      <div style={{ maxHeight: 600, overflow: 'auto', background: '#1e1e1e', color: '#ccc', padding: '0.5em' }}>
        {logs.length === 0 && <p>Нет сообщений. Ожидание данных...</p>}
        {logs.map((entry, i) => (
          <div key={i} style={{ fontFamily: 'monospace', marginBottom: 4 }}>
            <span style={{ color: '#7f7' }}>{entry.type}</span>{' '}
            {new Date(entry.time).toLocaleTimeString()}
            <pre style={{ margin: 0, color: '#fff' }}>{JSON.stringify(entry.data, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketStreamTest;