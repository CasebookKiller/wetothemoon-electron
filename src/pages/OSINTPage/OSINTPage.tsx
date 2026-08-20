// wetothemoon-electron/src/pages/OSINTPage/OSINTPage.tsx

import React, { useState } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Divider } from 'primereact/divider';

import { classNames } from '@/css/classnames';

import './OSINTPage.css'; // при необходимости добавьте свои стили

export const OSINTPage: React.FC = () => {
  const [inn, setInn] = useState<string>(() => {
    try {
      return localStorage.getItem('osint_last_inn') || '';
    } catch {
      return '';
    }
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needArbitrDetails, setNeedArbitrDetails] = useState(false);

  const handleInnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInn(value);
    try {
      localStorage.setItem('osint_last_inn', value);
    } catch {
      // ignore storage errors
    }
  };

  // Состояния фильтров арбитража
  const [arbitrFilters, setArbitrFilters] = useState({
    sides: [] as string[],       // 'plaintiff', 'defendant', 'third'
    status: [] as string[],      // 'in_progress', 'completed'
    search: '',
    maxPages: 1,
    maxTotalCases: 100,
  });

  const api = (window as any).electronAPI;

  const handleLaunch = async () => {
    try {
      await api.osintLaunch();
      setError('');
      setResult(null);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleClose = async () => {
    try {
      await api.osintClose();
      setError('');
      setResult(null);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleScrapeRusprofile = async () => {
    if (!inn.trim()) {
      setError('Введите ИНН');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      if (!api?.scrapeRusprofile) {
        setError('Метод scrapeRusprofile не найден');
        return;
      }

      const options: any = {
        arbitrDetails: needArbitrDetails,
        maxPages: arbitrFilters.maxPages,
        maxTotalCases: arbitrFilters.maxTotalCases,
      };

      if (needArbitrDetails) {
        options.filters = {
          sides: arbitrFilters.sides.length > 0 ? arbitrFilters.sides : undefined,
          status: arbitrFilters.status.length > 0 ? arbitrFilters.status : undefined,
          search: arbitrFilters.search.trim() || undefined,
        };
      }

      const response = await api.scrapeRusprofile(inn, options);

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error || 'Ошибка сбора');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSide = (value: string) => {
    setArbitrFilters(prev => ({
      ...prev,
      sides: prev.sides.includes(value)
        ? prev.sides.filter(s => s !== value)
        : [...prev.sides, value],
    }));
  };

  const toggleStatus = (value: string) => {
    setArbitrFilters(prev => ({
      ...prev,
      status: prev.status.includes(value)
        ? prev.status.filter(s => s !== value)
        : [...prev.status, value],
    }));
  };

  const renderResult = () => {
    if (!result) return null;
    return (
      <pre className="app theme-hint-color p-3 border-round">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  return (
    <React.Fragment>
      <div className="app p-0" />

      {/* Панель управления браузером */}
      <Panel className="shadow-5 mx-1" header="Браузер OSINT">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <div className="flex align-items-center gap-2">
              <Button
                label="Запустить"
                icon="pi pi-play"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleLaunch}
              />
              <Button
                label="Остановить"
                icon="pi pi-stop"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleClose}
              />
            </div>
          </div>
        </div>
      </Panel>

      <div className="app p-0" />

      {/* Панель ввода данных */}
      <Panel className="shadow-5 mx-1" header="Поиск компании">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <span className="app font-size-subheading">ИНН</span>
            <div className="flex align-items-center gap-2">
              <InputText
                value={inn}
                onChange={handleInnChange}
                placeholder="Введите ИНН"
                className="w-full"
              />
            </div>
            <div className="mt-2">
              <Checkbox
                inputId="needArbitr"
                checked={needArbitrDetails}
                onChange={(e) => setNeedArbitrDetails(e.checked as boolean)}
              />
              <label htmlFor="needArbitr" className="ml-2">
                Собрать детальный список арбитражных дел
              </label>
            </div>
          </div>
        </div>

        {/* Фильтры арбитража (показываются при включённом чекбоксе) */}
        {needArbitrDetails && (
          <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
            <div className="flex-1 flex flex-column gap-1 xl:mr-8">
              <span className="app font-size-subheading">Фильтры арбитража</span>

              {/* Роль */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Роль:</span>
                <Checkbox
                  inputId="sidePlaintiff"
                  checked={arbitrFilters.sides.includes('plaintiff')}
                  onChange={() => toggleSide('plaintiff')}
                />
                <label htmlFor="sidePlaintiff" className="ml-1">Истец</label>
                <Checkbox
                  inputId="sideDefendant"
                  checked={arbitrFilters.sides.includes('defendant')}
                  onChange={() => toggleSide('defendant')}
                />
                <label htmlFor="sideDefendant" className="ml-1">Ответчик</label>
                <Checkbox
                  inputId="sideThird"
                  checked={arbitrFilters.sides.includes('third')}
                  onChange={() => toggleSide('third')}
                />
                <label htmlFor="sideThird" className="ml-1">Третье лицо</label>
              </div>

              {/* Статус */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Статус:</span>
                <Checkbox
                  inputId="statusInProgress"
                  checked={arbitrFilters.status.includes('in_progress')}
                  onChange={() => toggleStatus('in_progress')}
                />
                <label htmlFor="statusInProgress" className="ml-1">Рассматривается</label>
                <Checkbox
                  inputId="statusCompleted"
                  checked={arbitrFilters.status.includes('completed')}
                  onChange={() => toggleStatus('completed')}
                />
                <label htmlFor="statusCompleted" className="ml-1">Завершено</label>
              </div>

              {/* Поиск */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Поиск:</span>
                <InputText
                  value={arbitrFilters.search}
                  onChange={(e) => setArbitrFilters({ ...arbitrFilters, search: e.target.value })}
                  placeholder="Номер дела или ИНН"
                  className="w-full"
                />
              </div>

              {/* Лимиты */}
              <div className="flex align-items-center gap-2 mt-2">
                <span>Макс. страниц:</span>
                <InputText
                  type="number"
                  min={1}
                  max={100}
                  value={String(arbitrFilters.maxPages)}
                  onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxPages: parseInt(e.target.value) || 1 })}
                  className="w-4rem"
                />
                <span className="ml-3">Макс. дел:</span>
                <InputText
                  type="number"
                  min={1}
                  max={1000}
                  value={String(arbitrFilters.maxTotalCases)}
                  onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxTotalCases: parseInt(e.target.value) || 100 })}
                  className="w-4rem"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap app p-2 align-items-center gap-4">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <Button
              label={loading ? 'Сбор...' : 'Собрать данные'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
              className="p-button-lg w-full p-button-raised p-button-accent"
              onClick={handleScrapeRusprofile}
              disabled={loading}
            />
          </div>
        </div>
      </Panel>

      <div className="app p-0" />

      {/* Панель для kad.arbitr.ru и mos-gorsud.ru */}
      <Panel className="shadow-5 mx-1" header="Дополнительные источники">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <div className="flex align-items-center gap-2">
              <Button
                label="kad.arbitr.ru"
                icon="pi pi-external-link"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={() => { /* будет реализовано позже */ }}
                disabled={loading}
              />
              <Button
                label="mos-gorsud.ru"
                icon="pi pi-external-link"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={() => { /* будет реализовано позже */ }}
                disabled={loading}
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

      {result && (
        <React.Fragment>
          <div className="app p-0" />
          <Panel className="shadow-5 mx-1" header="Результат">
            <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
              <div className="flex-1 flex flex-column gap-1 xl:mr-8">
                {renderResult()}
              </div>
            </div>
          </Panel>
        </React.Fragment>
      )}
    </React.Fragment>
  );
};