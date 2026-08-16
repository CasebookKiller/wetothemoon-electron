import React, { useState } from 'react';

export const OSINTPage: React.FC = () => {
  const [inn, setInn] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const api = (window as any).electronAPI;

  const handleScrape = async () => {
    if (!inn.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (!api?.scrapeRusprofile) return;

      const response = await api.scrapeRusprofile(inn);
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

  const handleKadArbitr = async () => {
    if (!inn.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (!api?.scrapeKadArbitr) return;

      const response = await api.scrapeKadArbitr(inn);
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


  return (
    <div className="osint-page">
      <h1>OSINT Tools</h1>
      <button onClick={() => api.launch()}>Запустить браузер</button>
      <button onClick={() => api.close()}>Остановить</button>

      <hr />
      <h2>Rusprofile</h2>
      <input
        value={inn}
        onChange={(e) => setInn(e.target.value)}
        placeholder="Введите ИНН"
      />
      <button onClick={handleScrape} disabled={loading}>
        {loading ? 'Сбор...' : 'Собрать данные'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}

      <hr />
      <h2>kad.arbitr.ru</h2>
      <input
        value={inn}
        onChange={(e) => setInn(e.target.value)}
        placeholder="Введите ИНН"
      />
      <button onClick={handleScrape} disabled={loading}>
        {loading ? 'Сбор...' : 'Собрать данные'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}

      
    </div>
  );
};