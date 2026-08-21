// src/pages/GatewayPage/GatewayPage.tsx

import React, { useState, useEffect } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';

import './GatewayPage.css'; // стили по аналогии с OSINTPage

export const GatewayPage: React.FC = () => {
  const [status, setStatus] = useState('stopped');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const response = await api.gatewayLaunch();
      if (response.success) {
        const result = response.data;
        setStatus(result.status);
        setIsLoggedIn(!result.loginRequired);
      } else {
        setError(response.error || 'Ошибка запуска');
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
      const response = await api.gatewayClose();
      if (response.success) {
        setStatus('stopped');
        setIsLoggedIn(false);
      } else {
        setError(response.error || 'Ошибка остановки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <React.Fragment>
      <div className="app p-0" />

      {/* Панель управления браузером */}
      <Panel className="shadow-5 mx-1" header="Браузер DeepSeek">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <div className="flex align-items-center gap-2">
              <Button
                label="Запустить"
                icon="pi pi-play"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleLaunch}
                disabled={loading}
              />
              <Button
                label="Остановить"
                icon="pi pi-stop"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleClose}
                disabled={loading}
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

      {/* Панель для будущей отправки сообщений (заглушка) */}
      <Panel className="shadow-5 mx-1" header="Отправка сообщения">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <p className="text-color-secondary">
              Функция отправки сообщений будет доступна на следующем этапе.
            </p>
            <Button
              label="Поле ввода появится позже"
              icon="pi pi-lock"
              className="p-button-lg w-full p-button-raised p-button-accent"
              disabled
            />
          </div>
        </div>
      </Panel>

      {error && (
        <div className="app p-0">
          <div className="p-error mx-2">{error}</div>
        </div>
      )}
    </React.Fragment>
  );
};