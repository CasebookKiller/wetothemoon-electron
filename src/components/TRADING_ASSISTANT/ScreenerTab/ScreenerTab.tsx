// src/components/TRADING_ASSISTANT/ScreenerTab/ScreenerTab.tsx
import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';

interface ScreenerResult {
  figi: string;
  ticker: string;
  name: string;
  lastPrice: number;
  avgDailyVolume: number;
  vaWidthPercent: number;
  pocStrength: number;
  poc: number;
  vah: number;
  val: number;
  totalVaVolume: number;
  error?: string;
}

interface Props {
  token: string;
}

export const ScreenerTab: React.FC<Props> = ({ token }) => {
  const [filters, setFilters] = useState({
    minVolume: 10000,   // было 500000
    maxVA: 3.0,         // было 2.0
    minPOC: 0.08,       // было 0.15
  });
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!token) {
      console.warn('Read-only token not provided');
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const api = (window as any).electronAPI;
      if (!api?.screenerRun) return;
      const res: ScreenerResult[] = await api.screenerRun(
        {
          minDailyVolume: filters.minVolume,
          maxVaWidthPercent: filters.maxVA,
          minPocStrength: filters.minPOC,
        },
        token
      );
      setResults(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const successResults = results.filter(r => !r.error);
  const errorResults = results.filter(r => r.error);

  const actionBody = (row: ScreenerResult) => (
    <div className="flex gap-1">
      <Button
        icon="pi pi-chart-line"
        className="p-button-sm p-button-info p-1"
        tooltip="Запустить бэктест по этой бумаге"
        onClick={() => {
          const api = (window as any).electronAPI;
          api?.runBacktest?.(row.figi, '', '', '', token, {
            strategyType: 'daily_va_return',
            stopLossPercent: 0.5,
            takeProfitPercent: 1.0,
            valueAreaPercent: 70,
            profileResolution: 50,
          });
        }}
      />
      <Button
        icon="pi pi-play"
        className="p-button-sm p-button-success p-1"
        tooltip="Торговать (в разработке)"
        onClick={() => alert('Торговля будет доступна позже')}
      />
    </div>
  );

  return (
    <Card className="surface-ground p-2">
      <h4 className="p-mb-2">Скринер по объёмному профилю (методология Trader Dale)</h4>
      <div className="p-mb-3 text-sm" style={{ color: '#aaa', lineHeight: '1.5' }}>
        <p>
          <strong>Как работает скринер (методология Trader Dale):</strong><br />
          Мы анализируем последние 2 торговых дня по <strong>часовым свечам</strong> и строим 
          объёмный профиль (Volume Profile) с Value Area 70%. Для каждого инструмента вычисляем:
        </p>
        <ul className="p-pl-3 p-mb-2">
          <li><strong>POC</strong> – уровень с максимальным объёмом за период (магнит для цены).</li>
          <li><strong>VAH / VAL</strong> – верхняя и нижняя границы области справедливой стоимости.</li>
          <li><strong>Ширина VA (%)</strong> – (VAH - VAL) / POC * 100%. Чем уже VA, тем выше вероятность 
              отскока цены внутрь области (рынок в балансе).</li>
          <li><strong>Сила POC</strong> – доля объёма на уровне POC относительно всего объёма внутри VA. 
              Высокая сила POC означает, что крупный игрок держит уровень, и цена будет к нему возвращаться.</li>
        </ul>
        <p className="p-mb-2">
          <strong>Фильтры скринера:</strong><br />
          <em>Мин. объём за свечу</em> – отсекает неликвиды. Для часовых свечей российского рынка 
          нормальные значения от 5 000 до 50 000 акций.<br />
          <em>Макс. ширина VA (%)</em> – оставляет только бумаги с чётким балансом. Рекомендуется 2–5%.<br />
          <em>Мин. сила POC</em> – доля объёма POC в VA. Значение 0.08–0.15 означает, что 8–15% всего 
          объёма VA сосредоточено на одной цене – сильный признак притяжения.
        </p>
        <p>
          <strong>Как использовать результаты:</strong><br />
          Инструменты, прошедшие фильтры, считаются находящимися в <strong>балансе</strong>. 
          Для них оптимальны стратегии:<br />
          • <strong>Daily VA Reversal</strong> – отскок от VAH/VAL обратно к POC.<br />
          • <strong>POC Pullback</strong> – вход при возврате цены к POC после ложного пробоя.<br />
          • <strong>Volume Accumulation</strong> – накопление позиции вблизи POC при подтверждении объёмом.<br />
          Вы можете сразу запустить бэктест по любой бумаге, нажав на иконку графика в строке таблицы.
        </p>
        <p className="text-500" style={{ fontSize: '0.8rem' }}>
          Совет: запускайте скринер утром перед открытием основной сессии, чтобы найти лучшие бумаги на день.
          Для российского рынка используйте фильтры: объём ≥ 10 000, VA ≤ 3%, сила POC ≥ 0.08.
        </p>
      </div>

      <div className="flex align-items-center flex-wrap gap-3 mb-3">
        <div className="flex align-items-center gap-2">
          <label className="mb-0">Мин. объём за свечу (акций)</label>
          <InputNumber
            value={filters.minVolume}
            onValueChange={(e) => setFilters({ ...filters, minVolume: e.value ?? 10000 })}
            min={0} step={1000} className="p-inputtext-sm" style={{ width: '140px' }}
          />
        </div>
        <div className="flex align-items-center gap-2">
          <label className="mb-0">Макс. ширина VA (% от POC)</label>
          <InputNumber
            value={filters.maxVA}
            onValueChange={(e) => setFilters({ ...filters, maxVA: e.value ?? 2.0 })}
            min={0.1}
            step={0.1}
            mode="decimal"
            className="p-inputtext-sm"
            style={{ width: '110px' }}
          />
        </div>
        <div className="flex align-items-center gap-2">
          <label className="mb-0">Мин. сила POC (доля объёма VA)</label>
          <InputNumber
            value={filters.minPOC}
            onValueChange={(e) => setFilters({ ...filters, minPOC: e.value ?? 0.15 })}
            min={0}
            max={1}
            step={0.01}
            mode="decimal"
            className="p-inputtext-sm"
            style={{ width: '110px' }}
          />
        </div>
        <Button
          label={loading ? 'Анализ...' : 'Запустить скрининг'}
          icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}
          onClick={handleRun}
          disabled={loading}
          className="p-button-sm p-1 px-3"
        />
      </div>

      {loading && <p>Обработка инструментов, это может занять до минуты...</p>}

      {successResults.length > 0 && (
        <div className="mb-3">
          <h5>Подходящие инструменты ({successResults.length})</h5>
          <DataTable value={successResults} className="p-datatable-sm" stripedRows responsiveLayout="scroll" style={{ fontSize: '0.85rem' }}>
            <Column field="ticker" header="Тикер" />
            <Column field="name" header="Название" />
            <Column field="poc" header="POC" body={(row) => row.poc.toFixed(2)} />
            <Column field="vaWidthPercent" header="VA ширина %" body={(row) => `${row.vaWidthPercent}%`} />
            <Column field="pocStrength" header="Сила POC" body={(row) => `${row.pocStrength}`} />
            <Column field="avgDailyVolume" header="Объём (дн.)" body={(row) => row.avgDailyVolume.toLocaleString()} />
            <Column field="vah" header="VAH" body={(row) => row.vah.toFixed(2)} />
            <Column field="val" header="VAL" body={(row) => row.val.toFixed(2)} />
            <Column body={actionBody} header="Действия" style={{ minWidth: '100px' }} />
          </DataTable>
        </div>
      )}

      {errorResults.length > 0 && (
        <div>
          <h5>Отфильтрованные / ошибки ({errorResults.length})</h5>
          <DataTable value={errorResults} className="p-datatable-sm" stripedRows responsiveLayout="scroll" style={{ fontSize: '0.85rem' }}>
            <Column field="ticker" header="Тикер" />
            <Column field="name" header="Название" />
            <Column field="error" header="Причина" body={(row) => <Tag severity="warning" value={row.error} />} />
          </DataTable>
        </div>
      )}

      {!loading && results.length === 0 && (
        <p className="text-center text-500">Нет результатов. Нажмите «Запустить скрининг».</p>
      )}
    </Card>
  );
};