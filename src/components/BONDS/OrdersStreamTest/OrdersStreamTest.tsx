// src/components/BONDS/OrdersStreamTest/OrdersStreamTest.tsx

import React, { useEffect, useRef, useState } from 'react';
import { OrdersStreamServiceClient } from '@/main/services/tbank/OrdersStreamService';

interface LogEntry {
  time: string;
  type: string;
  data: any;
}

const OrdersStreamTest: React.FC = () => {
  const clientRef = useRef<OrdersStreamServiceClient | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeStreams, setActiveStreams] = useState({
    trades: false,
    orderState: false,
  });

  const addLog = (type: string, data: any) => {
    setLogs(prev => [...prev.slice(-500), { time: new Date().toISOString(), type, data }]);
  };

  useEffect(() => {
    const token = import.meta.env.VITE_TReadOnly;
    if (!token) {
      addLog('error', 'Токен не указан');
      return;
    }

    const client = new OrdersStreamServiceClient(token);
    clientRef.current = client;

    client
      .onTrades(data => addLog('trades', data))
      .onOrderState(data => addLog('orderState', data))
      .onClosed(streamType => addLog('closed', { streamType }))
      .onError((streamType, err) => addLog('error', { streamType, err }));

    return () => {
      client.disconnect();
    };
  }, []);

  const toggleStream = async (type: 'trades' | 'orderState') => {
    const client = clientRef.current;
    if (!client) return;

    const isActive = activeStreams[type];
    //const accountId = 'YOUR_ACCOUNT_ID'; // <-- Замените на реальный ID счёта
    const accountId = '2009896830';

    try {
      if (!isActive) {
        if (type === 'trades') {
          await client.startTradesStream({ accounts: [accountId] });
        } else {
          await client.startOrderStateStream({ accounts: [accountId] });
        }
        addLog('system', `Stream ${type} started`);
      } else {
        // Индивидуальная остановка не реализована, но можно отключить все стримы и перезапустить другие
        // Временно просто сигнализируем, что стрим остановлен, фактически для перезапуска надо пересоздать клиент
        // Но для теста оставляем так: при повторном клике ничего не делаем (стрим продолжается)
        // Чтобы действительно остановить, используйте кнопку "Stop All"
        addLog('warning', 'Для остановки используйте "Stop All Streams"');
      }
      setActiveStreams(prev => ({ ...prev, [type]: !isActive }));
    } catch (err: any) {
      addLog('error', `Failed to toggle ${type}: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '1em' }}>
      <h2>OrdersStream Test</h2>
      <div style={{ marginBottom: '1em' }}>
        {(['trades', 'orderState'] as const).map(type => (
          <label key={type} style={{ marginRight: '1em' }}>
            <input
              type="checkbox"
              checked={activeStreams[type]}
              onChange={() => toggleStream(type)}
            />
            {type}
          </label>
        ))}
        <button onClick={() => clientRef.current?.disconnect()}>Stop All Streams</button>
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

export default OrdersStreamTest;