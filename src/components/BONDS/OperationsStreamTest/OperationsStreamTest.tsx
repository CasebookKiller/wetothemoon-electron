import React, { useEffect, useRef, useState } from 'react';
import { OperationsStreamServiceClient } from '@/main/services/tbank/OperationsStreamGrpcService';

interface LogEntry {
  time: string;
  type: string;
  data: any;
}

const OperationsStreamTest: React.FC = () => {
  const clientRef = useRef<OperationsStreamServiceClient | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeStreams, setActiveStreams] = useState({
    portfolio: false,
    positions: false,
    operations: false,
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

    const client = new OperationsStreamServiceClient(token);
    clientRef.current = client;

    client
      .onPortfolio(data => addLog('portfolio', data))
      .onPosition(data => addLog('position', data))
      .onOperation(data => addLog('operation', data))
      .onClosed(streamType => addLog('closed', { streamType }))
      .onError((streamType, err) => addLog('error', { streamType, err }));

    // Возвращаем функцию очистки
    return () => {
      client.disconnect();
    };
  }, []);

  const toggleStream = async (type: 'portfolio' | 'positions' | 'operations') => {
    const client = clientRef.current;
    if (!client) return;

    const isActive = activeStreams[type];
    //const accountId = 'YOUR_ACCOUNT_ID'; // Замените на реальный ID счёта
    const accountId = '2009896830';

    try {
      if (!isActive) {
        // Запуск стрима
        switch (type) {
          case 'portfolio':
            await client.startPortfolioStream({ accounts: [accountId] });
            break;
          case 'positions':
            await client.startPositionsStream({ accounts: [accountId], withInitialPositions: true });
            break;
          case 'operations':
            await client.startOperationsStream({ accounts: [accountId] });
            break;
        }
        addLog('system', `Stream ${type} started`);
      } else {
        // Остановка стрима – в текущей реализации можно только остановить все, но для теста отключаем полностью
        // Для изящного управления каждым стримом понадобится доработка IPC, пока просто перезапускаем с новыми параметрами,
        // но проще деактивировать кнопку, не вызывая stop
        // Пока оставим без отдельной остановки, просто переключим состояние обратно после реальной остановки
        // Временно ничего не делаем, так как stop останавливает все стримы
        addLog('warning', 'Остановка отдельного стрима временно не реализована. Используйте disconnect');
      }
      setActiveStreams(prev => ({ ...prev, [type]: !isActive }));
    } catch (err: any) {
      addLog('error', `Failed to toggle ${type}: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '1em' }}>
      <h2>OperationsStream Test</h2>
      <div style={{ marginBottom: '1em' }}>
        {(['portfolio', 'positions', 'operations'] as const).map(type => (
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

export default OperationsStreamTest;