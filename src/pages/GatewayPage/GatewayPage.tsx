// src/pages/GatewayPage/GatewayPage.tsx

import React, { useState, useEffect } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Divider } from 'primereact/divider';

export const GatewayPage: React.FC = () => {
  const [status, setStatus] = useState('stopped');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const api = (window as any).electronAPI;

  const updateStatus = async () => {
    try {
      const s = await api.gatewayGetStatus();
      setStatus(s.status);
      setIsLoggedIn(s.isLoggedIn);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunch = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.gatewayLaunch();
      if (result.success) {
        const data = result.data;
        setStatus(data.status);
        setIsLoggedIn(!data.loginRequired);
      } else {
        setError(result.error || 'Ошибка запуска');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.gatewayClose();
      if (result.success) {
        setStatus('stopped');
        setIsLoggedIn(false);
      } else {
        setError(result.error || 'Ошибка остановки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    setResponse('');
    try {
      const result = await api.gatewaySendMessage(message);
      if (result.success) {
        setResponse(result.data);
      } else {
        setError(result.error || 'Ошибка отправки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <React.Fragment>
      <div className="app p-0" />

      {/* Панель управления */}
      <Panel className="shadow-5 mx-1" header="Браузер DeepSeek">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <div className="flex align-items-center gap-2">
              <Button
                label="Запустить"
                icon="pi pi-play"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleLaunch}
                disabled={loading || sending}
              />
              <Button
                label="Остановить"
                icon="pi pi-stop"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleClose}
                disabled={loading || sending}
              />
            </div>
            <div className="mt-3">
              <span className="app font-size-subheading">Статус: {status}</span>
              {isLoggedIn && <span className="ml-2 text-green-600">(авторизован)</span>}
            </div>
          </div>
        </div>
      </Panel>

      <div className="app p-0" />

      {/* Панель отправки сообщения */}
      <Panel className="shadow-5 mx-1" header="Отправка сообщения">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <InputTextarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              autoResize
              placeholder="Введите сообщение для DeepSeek"
              disabled={!isLoggedIn || sending}
              className="w-full"
            />
            <div className="mt-2">
              <Button
                label={sending ? 'Отправка...' : 'Отправить'}
                icon={sending ? 'pi pi-spin pi-spinner' : 'pi pi-send'}
                className="p-button-lg w-full p-button-raised p-button-accent"
                onClick={handleSend}
                disabled={!isLoggedIn || !message.trim() || sending}
              />
            </div>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="app p-0">
          <div className="p-error mx-2">{error}</div>
        </div>
      )}

      {/* Ответ */}
      {response && (
        <React.Fragment>
          <div className="app p-0" />
          <Panel className="shadow-5 mx-1" header="Ответ DeepSeek">
            <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
              <div className="flex-1 flex flex-column gap-1 xl:mr-8">
                <pre className="app theme-hint-color p-3 border-round" style={{ whiteSpace: 'pre-wrap' }}>
                  {response}
                </pre>
              </div>
            </div>
          </Panel>
        </React.Fragment>
      )}
    </React.Fragment>
  );
};