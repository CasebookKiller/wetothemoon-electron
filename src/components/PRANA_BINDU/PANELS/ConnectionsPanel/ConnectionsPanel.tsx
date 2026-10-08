// src/components/PRANA_BINDU/PANELS/ConnectionsPanel/ConnectionsPanel.tsx
//
// Панель «Подключения»: dodofo token, intervals.icu (key + athlete id),
// Zepp (резерв). Самодостаточна: сама читает initial status, сохраняет
// ключи и показывает результат.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Panel } from 'primereact/panel';

interface Props {
  className?: string;
}

export const ConnectionsPanel: React.FC<Props> = ({ className }) => {
  const api = (window as any).electronAPI;

  // dodofo
  const [dodofoToken, setDodofoToken] = useState('');
  const [hasDodofoToken, setHasDodofoToken] = useState(false);

  // Zepp (резерв)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // intervals.icu
  const [intervalsApiKey, setIntervalsApiKey] = useState('');
  const [intervalsAthleteId, setIntervalsAthleteId] = useState('');
  const [intervalsHasKey, setIntervalsHasKey] = useState(false);
  const [intervalsSaving, setIntervalsSaving] = useState(false);
  const [intervalsError, setIntervalsError] = useState('');
  const [intervalsInfo, setIntervalsInfo] = useState('');

  // Общий статус + loading для панели
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState<'ok' | 'error'>('ok');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!api?.pb?.dodofoTokenStatus) return;
      try {
        const res = await api.pb.dodofoTokenStatus();
        if (res?.success) setHasDodofoToken(!!res.hasToken);
      } catch {
        /* ignore */
      }
    })();
    (async () => {
      try {
        const r = await api.pb.intervalsStatus?.();
        if (r?.success) {
          setIntervalsHasKey(!!r.hasApiKey);
          setIntervalsAthleteId(r.athleteId ?? '');
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheck = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен — модуль ещё не собран');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const res = await api.pb.zeppCheckProvider('dodofo');
      if (res?.available) {
        setStatusKind('ok');
        setStatus('Токен dodofo валиден — авторизация проходит.');
      } else {
        setStatusKind('error');
        setStatus(
          `Токен не работает: ${res?.reason ?? 'неизвестная причина'}`
        );
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

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

  const handleIntervalsSave = async () => {
    if (!api?.pb?.intervalsSetup) return;
    if (!intervalsApiKey.trim() && !intervalsHasKey) {
      setIntervalsError('API key обязателен');
      return;
    }
    setIntervalsSaving(true);
    setIntervalsError('');
    setIntervalsInfo('');
    try {
      const res = await api.pb.intervalsSetup(
        intervalsApiKey.trim(),
        intervalsAthleteId.trim()
      );
      if (res.success) {
        setIntervalsHasKey(true);
        setIntervalsApiKey('');
        setIntervalsInfo('Ключ сохранён и проверен');
      } else {
        setIntervalsError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setIntervalsError((e as Error).message);
    } finally {
      setIntervalsSaving(false);
    }
  };

  return (
    <Panel
      header="Подключения"
      className={`shadow-5 mb-3 pb-panel ${className ?? ''}`}
    >
      <div className="pb-connections">
        {/* --- dodofo --- */}
        <div className="pb-connections__block">
          <div className="pb-connections__title">
            <i className="pi pi-link" /> dodofo
            {hasDodofoToken && (
              <span className="pb-label-ok">✓ сохранён</span>
            )}
          </div>
          <div className="flex flex-column gap-2">
            <InputText
              id="pb-dodofo-token"
              value={dodofoToken}
              onChange={(e) => setDodofoToken(e.target.value)}
              placeholder="dodofo_..."
              className="w-full"
            />
            <small className="pb-hint">
              Токен создаётся в профиле dodofo.ru. Хранится
              зашифрованным через safeStorage.
            </small>
            <div className="flex gap-2 flex-wrap">
              <Button
                label={loading ? 'Сохранение...' : 'Сохранить токен'}
                icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
                className="pb p-button-sm"
                onClick={handleSaveDodofo}
                disabled={loading || !dodofoToken.trim()}
              />
              <Button
                label={loading ? 'Проверка...' : 'Проверить'}
                icon={
                  loading
                    ? 'pi pi-spin pi-spinner'
                    : 'pi pi-question-circle'
                }
                className="pb-soft p-button-sm"
                onClick={handleCheck}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* --- intervals.icu --- */}
        <div className="pb-connections__block">
          <div className="pb-connections__title">
            <i className="pi pi-heart" /> intervals.icu
            {intervalsHasKey && (
              <span className="pb-label-ok">✓ сохранён</span>
            )}
          </div>
          <div className="flex flex-column gap-2">
            <InputText
              type="password"
              value={intervalsApiKey}
              onChange={(e) => setIntervalsApiKey(e.target.value)}
              placeholder={
                intervalsHasKey
                  ? '•••••••• (оставьте пустым)'
                  : 'ваш ключ из Settings → Developer'
              }
              className="w-full"
            />
            <InputText
              value={intervalsAthleteId}
              onChange={(e) => setIntervalsAthleteId(e.target.value)}
              placeholder="i123456 — athlete id (или пусто для «self»)"
              className="w-full"
            />
            <small className="pb-hint">
              API-ключ: intervals.icu → Settings → Developer.
              Athlete ID — из URL интерфейса, необязательно.
            </small>
            <div className="flex gap-2 flex-wrap">
              <Button
                label={intervalsSaving ? 'Сохранение…' : 'Сохранить ключ'}
                icon={
                  intervalsSaving
                    ? 'pi pi-spin pi-spinner'
                    : 'pi pi-save'
                }
                className="pb p-button-sm"
                onClick={handleIntervalsSave}
                disabled={
                  intervalsSaving ||
                  (!intervalsApiKey.trim() && !intervalsHasKey)
                }
              />
            </div>
            {intervalsError && (
              <Message
                severity="error"
                text={intervalsError}
                className="w-full"
              />
            )}
            {intervalsInfo && (
              <Message
                severity="success"
                text={intervalsInfo}
                className="w-full"
              />
            )}
          </div>
        </div>

        {/* --- Zepp (резерв) --- */}
        <div className="pb-connections__block pb-connections__block--collapsed">
          <div className="pb-connections__title">
            <i className="pi pi-mobile" /> Zepp (резерв)
          </div>
          <div className="flex flex-column gap-2">
            <InputText
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full"
            />
            <InputText
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full"
            />
            <small className="pb-hint">
              Резервный способ. Основной — dodofo и intervals.icu.
            </small>
            <div className="flex gap-2 flex-wrap">
              <Button
                label={loading ? 'Подключение...' : 'Подключить'}
                icon={
                  loading ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'
                }
                className="pb p-button-sm"
                onClick={handleConnectZepp}
                disabled={loading || !email || !password}
              />
            </div>
          </div>
        </div>

        {status && (
          <Message
            severity={statusKind === 'ok' ? 'success' : 'error'}
            text={status}
            className="w-full"
          />
        )}
      </div>
    </Panel>
  );
};