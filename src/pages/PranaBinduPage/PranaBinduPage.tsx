// src/pages/PranaBinduPage/PranaBinduPage.tsx

import React, { useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Panel } from 'primereact/panel';

import './PranaBinduPage.css';

interface ProviderOption {
  label: string;
  value: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { label: 'dofek-zepp', value: 'dofek-zepp' },
  { label: 'zepp-mcp', value: 'zepp-mcp' },
  { label: 'zeppbridge', value: 'zeppbridge' },
];

const MODULES = [
  { name: 'Stillsuit', description: 'Марафон: пульс, темп, экономичность' },
  { name: 'Crysknife', description: 'Big-6: сила, контроль, сухожилия' },
  { name: 'Mentat', description: 'Календарь, периодизация, подводка к старту' },
  { name: 'Water Discipline', description: 'Сон, HRV, гидратация, восстановление' },
  { name: 'Spice', description: 'Аналитика, Google Fit, Zepp' },
];

export const PranaBinduPage: React.FC = () => {
  const api = (window as any).electronAPI;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<string>('dofek-zepp');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен — модуль ещё не собран');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const res = await api.pb.zeppCheckProvider(provider);
      setStatus(JSON.stringify(res));
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен');
      return;
    }
    if (!email || !password) {
      setStatus('Введите email и пароль');
      return;
    }
    setLoading(true);
    setStatus('Подключение...');
    try {
      const res = await api.pb.zeppConnect(email, password);
      if (res.success) {
        setStatus(
          `Успех: userId=${res.userId}, authHost=${res.authHost}, dataHost=${res.dataHost}`
        );
        setPassword(''); // пароль не держим в памяти после входа
      } else {
        setStatus(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-page p-4">
      <div className="mb-4">
        <h1 className="pb-title">
          <i className="pi pi-wave-pulse pb-title-icon pb-accent" />
          Прана-Бинду
        </h1>
        <p className="pb-subtitle">Тренировки тела: бег и сила</p>
      </div>

      <div className="grid mb-3">
        {MODULES.map((m) => (
          <div key={m.name} className="col-12 md:col-6 lg:col-4 p-2">
            <div className="surface-card p-3 shadow-2 border-round h-full">
              <div className="pb-module-name">{m.name}</div>
              <div className="pb-module-desc">{m.description}</div>
            </div>
          </div>
        ))}
      </div>

      <Panel header="Синхронизация" className="shadow-5 mb-3 pb-panel">
        <div className="flex flex-column gap-3">
          <div className="flex flex-column gap-2">
            <label htmlFor="pb-email" className="pb-label">Email Zepp</label>
            <InputText
              id="pb-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full"
            />
          </div>

          <div className="flex flex-column gap-2">
            <label htmlFor="pb-password" className="pb-label">Пароль Zepp</label>
            <InputText
              id="pb-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full"
            />
          </div>

          <div className="flex flex-column gap-2">
            <label htmlFor="pb-provider" className="pb-label">Провайдер</label>
            <Dropdown
              inputId="pb-provider"
              value={provider}
              options={PROVIDER_OPTIONS}
              onChange={(e) => setProvider(e.value)}
              className="w-full"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              label={loading ? 'Проверка...' : 'Проверить доступность'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
              className="pb-soft p-button-sm"
              onClick={handleCheck}
              disabled={loading}
            />
            <Button
              label={loading ? 'Подключение...' : 'Подключить'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'}
              className="pb p-button-sm"
              onClick={handleConnect}
              disabled={loading}
            />
          </div>

          {status && (
            <div className="pb-status">
              <code>{status}</code>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
};