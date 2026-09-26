// src/pages/PranaBinduPage/PranaBinduPage.tsx

import React, { useEffect, useState } from 'react';
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
  { label: 'dodofo (основной)', value: 'dodofo' },
  { label: 'dofek-zepp (резерв)', value: 'dofek-zepp' },
  { label: 'zepp-mcp (не реализован)', value: 'zepp-mcp' },
  { label: 'zeppbridge (не реализован)', value: 'zeppbridge' },
];

const MODULES = [
  { name: 'Stillsuit', description: 'Марафон: пульс, темп, экономичность' },
  { name: 'Crysknife', description: 'Big-6: сила, контроль, сухожилия' },
  { name: 'Mentat', description: 'Календарь, периодизация, подводка к старту' },
  { name: 'Water Discipline', description: 'Сон, HRV, гидратация, восстановление' },
  { name: 'Spice', description: 'Аналитика, Google Fit, Zepp, dodofo' },
];

export const PranaBinduPage: React.FC = () => {
  const api = (window as any).electronAPI;

  const [provider, setProvider] = useState<string>('dodofo');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // dodofo
  const [dodofoToken, setDodofoToken] = useState('');
  const [hasDodofoToken, setHasDodofoToken] = useState(false);

  // Zepp (резерв)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Загрузка статуса dodofo-токена при монтировании
  useEffect(() => {
    (async () => {
      if (!api?.pb?.dodofoTokenStatus) return;
      try {
        const res = await api.pb.dodofoTokenStatus();
        if (res?.success) setHasDodofoToken(!!res.hasToken);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сброс статуса при смене провайдера
  useEffect(() => {
    setStatus('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // ==================== Проверка доступности ====================

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

  // ==================== dodofo ====================

  const handleSaveDodofo = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен');
      return;
    }
    if (!dodofoToken.trim()) {
      setStatus('Введите токен dodofo');
      return;
    }
    setLoading(true);
    setStatus('Сохранение токена...');
    try {
      const res = await api.pb.dodofoConnect(dodofoToken.trim());
      if (res.success) {
        setStatus('Токен сохранён и проверен');
        setHasDodofoToken(true);
        setDodofoToken('');
      } else {
        setStatus(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Zepp (резерв) ====================

  const handleConnectZepp = async () => {
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
        setPassword('');
      } else {
        setStatus(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Рендер формы по провайдеру ====================

  const renderProviderForm = () => {
    if (provider === 'dodofo') {
      return (
        <>
          <div className="flex flex-column gap-2">
            <label htmlFor="pb-dodofo-token" className="pb-label">
              Личный токен dodofo
              {hasDodofoToken && <span className="pb-label-ok">✓ сохранён</span>}
            </label>
            <InputText
              id="pb-dodofo-token"
              value={dodofoToken}
              onChange={(e) => setDodofoToken(e.target.value)}
              placeholder="dodofo_..."
              className="w-full"
            />
            <small className="pb-hint">
              Токен создаётся в профиле dodofo.ru и действует от твоего имени.
              Хранится зашифрованным.
            </small>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              label={loading ? 'Сохранение...' : 'Сохранить токен'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
              className="pb p-button-sm"
              onClick={handleSaveDodofo}
              disabled={loading || !dodofoToken.trim()}
            />
            <Button
              label={loading ? 'Проверка...' : 'Проверить доступность'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
              className="pb-soft p-button-sm"
              onClick={handleCheck}
              disabled={loading}
            />
          </div>
        </>
      );
    }

    if (provider === 'dofek-zepp') {
      return (
        <>
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

          <small className="pb-hint">
            Резервный способ. Основной — dodofo (проще, не требует пароля).
          </small>

          <div className="flex gap-2 flex-wrap">
            <Button
              label={loading ? 'Подключение...' : 'Подключить'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'}
              className="pb p-button-sm"
              onClick={handleConnectZepp}
              disabled={loading || !email || !password}
            />
            <Button
              label={loading ? 'Проверка...' : 'Проверить доступность'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
              className="pb-soft p-button-sm"
              onClick={handleCheck}
              disabled={loading}
            />
          </div>
        </>
      );
    }

    // zepp-mcp / zeppbridge — заглушки
    return (
      <>
        <small className="pb-hint">
          Провайдер «{provider}» пока не реализован. Используй dodofo
          или dofek-zepp.
        </small>
        <div className="flex gap-2 flex-wrap">
          <Button
            label={loading ? 'Проверка...' : 'Проверить доступность'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
            className="pb-soft p-button-sm"
            onClick={handleCheck}
            disabled={loading}
          />
        </div>
      </>
    );
  };

  return (
    <div className="pb-page p-4">
      <div className="mb-4">
        <h1 className="pb-title">
          <i className="pi pi-wave-pulse pb-title-icon" />
          Prana-Bindu
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
            <label htmlFor="pb-provider" className="pb-label">Провайдер</label>
            <Dropdown
              inputId="pb-provider"
              value={provider}
              options={PROVIDER_OPTIONS}
              onChange={(e) => setProvider(e.value)}
              className="w-full"
            />
          </div>

          {renderProviderForm()}

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