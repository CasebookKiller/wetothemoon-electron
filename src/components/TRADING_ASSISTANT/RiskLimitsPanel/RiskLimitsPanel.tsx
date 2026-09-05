import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';

interface Props {
  accountId: string;
}

// Эти проценты должны совпадать с OrderManagerConfig (можно вынести в общий конфиг)
const MAX_POSITION_PERCENT_PER_INSTRUMENT = 10; // макс. доля на один инструмент
const MAX_TOTAL_POSITION_PERCENT = 30;          // макс. суммарная доля всех бумаг

export const RiskLimitsPanel: React.FC<Props> = ({ accountId }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState('RUB');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    const api = (window as any).electronAPI;

    if (!api?.getBalance) {
      setBalance(null);
      setLoading(false);
      return;
    }

    api.getBalance(accountId)
      .then((res: any) => {
        if (res?.success) {
          setBalance(Number(res.balance));
          setCurrency(res.currency || 'RUB');
        } else {
          setBalance(null);
        }
      })
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, [accountId]);

  const maxPerInstrument = balance != null
    ? balance * (MAX_POSITION_PERCENT_PER_INSTRUMENT / 100)
    : null;
  const maxTotal = balance != null
    ? balance * (MAX_TOTAL_POSITION_PERCENT / 100)
    : null;

  return (
    <div className='mb-2'>
      <h5 className="m-0 mb-2">Лимиты и баланс</h5>
      {loading ? (
        <span className='text-sm'>Загрузка...</span>
      ) : balance != null ? (
        <div className="flex flex-column gap-1">
          <div className="flex justify-content-between text-sm">
            <span>Баланс счёта:</span>
            <span>{balance.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-content-between text-sm">
            <span>Лимит на сделку ({MAX_POSITION_PERCENT_PER_INSTRUMENT}%):</span>
            <span>{maxPerInstrument?.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-content-between text-sm">
            <span>Лимит на все позиции ({MAX_TOTAL_POSITION_PERCENT}%):</span>
            <span>{maxTotal?.toLocaleString()} {currency}</span>
          </div>
        </div>
      ) : (
        <span>Нет данных о балансе</span>
      )}
    </div>
  );
};