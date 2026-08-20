// wetothemoon-electron/src/pages/OSINTPage/OSINTPage.tsx

import React, { useState } from 'react';

export const OSINTPage: React.FC = () => {
  const [inn, setInn] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needArbitrDetails, setNeedArbitrDetails] = useState(false);

  // Состояния для фильтров арбитража
  const [arbitrFilters, setArbitrFilters] = useState({
    sides: [] as string[],          // 'plaintiff', 'defendant', 'third'
    status: [] as string[],         // 'in_progress', 'completed'
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

      // Формируем объект опций
      const options: any = {
        arbitrDetails: needArbitrDetails,
        maxPages: arbitrFilters.maxPages,
        maxTotalCases: arbitrFilters.maxTotalCases,
      };

      // Если включён детальный сбор арбитража, добавляем фильтры
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

  // Обработчики изменения фильтров
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

  return (
    <div className="osint-page">
      <h1>OSINT Tools</h1>
      <div className="osint-controls">
        <button onClick={handleLaunch}>Запустить браузер</button>
        <button onClick={handleClose}>Остановить</button>
      </div>

      <hr />

      <div className="osint-input-section">
        <label htmlFor="inn-input">ИНН:</label>
        <input
          id="inn-input"
          value={inn}
          onChange={(e) => setInn(e.target.value)}
          placeholder="Введите ИНН"
        />
      </div>

      <div className="osint-source">
        <h2>Rusprofile</h2>
        <label className="osint-checkbox">
          <input
            type="checkbox"
            checked={needArbitrDetails}
            onChange={(e) => setNeedArbitrDetails(e.target.checked)}
          />
          Собрать детальный список арбитражных дел
        </label>

        {/* Фильтры арбитража (показываются при включённом чекбоксе) */}
        {needArbitrDetails && (
          <div className="arbitr-filters">
            <div className="filter-group">
              <span>Роль:</span>
              <label>
                <input
                  type="checkbox"
                  checked={arbitrFilters.sides.includes('plaintiff')}
                  onChange={() => toggleSide('plaintiff')}
                /> Истец
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={arbitrFilters.sides.includes('defendant')}
                  onChange={() => toggleSide('defendant')}
                /> Ответчик
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={arbitrFilters.sides.includes('third')}
                  onChange={() => toggleSide('third')}
                /> Третье лицо
              </label>
            </div>

            <div className="filter-group">
              <span>Статус:</span>
              <label>
                <input
                  type="checkbox"
                  checked={arbitrFilters.status.includes('in_progress')}
                  onChange={() => toggleStatus('in_progress')}
                /> Рассматривается
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={arbitrFilters.status.includes('completed')}
                  onChange={() => toggleStatus('completed')}
                /> Завершено
              </label>
            </div>

            <div className="filter-group">
              <span>Поиск:</span>
              <input
                type="text"
                value={arbitrFilters.search}
                onChange={(e) => setArbitrFilters({ ...arbitrFilters, search: e.target.value })}
                placeholder="Номер дела или ИНН"
              />
            </div>

            <div className="filter-group">
              <span>Макс. страниц:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={arbitrFilters.maxPages}
                onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxPages: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="filter-group">
              <span>Макс. дел:</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={arbitrFilters.maxTotalCases}
                onChange={(e) => setArbitrFilters({ ...arbitrFilters, maxTotalCases: parseInt(e.target.value) || 100 })}
              />
            </div>
          </div>
        )}

        <button onClick={handleScrapeRusprofile} disabled={loading}>
          {loading ? 'Сбор...' : 'Собрать данные'}
        </button>
      </div>

      <div className="osint-source">
        <h2>kad.arbitr.ru</h2>
        <button onClick={() => { /* будет реализовано позже */ }} disabled={loading}>
          {loading ? 'Сбор...' : 'Собрать данные'}
        </button>
      </div>

      <div className="osint-source">
        <h2>mos-gorsud.ru</h2>
        <button onClick={() => { /* будет реализовано позже */ }} disabled={loading}>
          {loading ? 'Сбор...' : 'Собрать данные'}
        </button>
      </div>

      {error && <p className="osint-error">{error}</p>}
      {result && (
        <pre className="osint-result">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
};