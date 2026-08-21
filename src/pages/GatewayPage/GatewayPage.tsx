// wetothemoon-electron/src/pages/GatewayPage/GatewayPage.tsx

import React, { useState } from 'react';

export const GatewayPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('stopped');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');

  const api = (window as any).electronAPI;

  const handleLaunch = async () => {
    try {
      const result = await api.gatewayLaunch();
      setStatus(result.status);
      if (result.loginRequired) {
        setIsLoggedIn(false);
      } else {
        setIsLoggedIn(true);
      }
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleClose = async () => {
    try {
      await api.gatewayClose();
      setStatus('stopped');
      setIsLoggedIn(false);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      setResponse('Ожидание ответа...');
      const answer = await api.gatewaySendMessage(message);
      setResponse(answer);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setResponse('');
    }
  };

  const updateStatus = async () => {
    try {
      const s = await api.gatewayGetStatus();
      setStatus(s.status);
      setIsLoggedIn(s.isLoggedIn);
    } catch (e) {
      // ignore
    }
  };

  // Периодически обновляем статус
  React.useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Шлюз DeepSeek</h1>
      <div>
        Статус: {status} {isLoggedIn ? '(авторизован)' : '(не авторизован)'}
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={handleLaunch}>Запустить браузер</button>
        <button onClick={handleClose} style={{ marginLeft: 10 }}>Остановить</button>
      </div>
      <hr />
      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          cols={50}
          placeholder="Введите сообщение для DeepSeek"
          disabled={!isLoggedIn}
        />
        <br />
        <button onClick={handleSend} disabled={!isLoggedIn}>
          Отправить
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {response && (
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: 10 }}>
          {response}
        </pre>
      )}
    </div>
  );
};