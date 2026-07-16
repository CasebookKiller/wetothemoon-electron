// src/components/TRADING_ASSISTANT/AutoTraderTab/AutoTraderTab.tsx

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';

const STORAGE_KEY = 'autotrader_config';

const loadConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveConfig = (config: any) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

interface AutoTraderTabProps {
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
}

export const AutoTraderTab: React.FC<AutoTraderTabProps> = ({ availableInstruments }) => {
  const saved = loadConfig();

  // ---------- Параметры риск‑менеджмента ----------
  const [lotQty, setLotQty] = useState(saved.lotQty ?? 1);
  const [stopLossPercent, setStopLossPercent] = useState(saved.stopLossPercent ?? 1);
  const [takeProfitPercent, setTakeProfitPercent] = useState(saved.takeProfitPercent ?? 2);
  const [trailingEnabled, setTrailingEnabled] = useState(saved.trailingEnabled ?? false);
  const [trailingPercent, setTrailingPercent] = useState(saved.trailingPercent ?? 1);
  const [dynamicSizing, setDynamicSizing] = useState(saved.dynamicSizing ?? false);
  const [riskAmount, setRiskAmount] = useState(saved.riskAmount ?? 1000);
  const [atrPeriod, setAtrPeriod] = useState(saved.atrPeriod ?? 14);
  const [atrMultiplier, setAtrMultiplier] = useState(saved.atrMultiplier ?? 2);
  const [entryMode, setEntryMode] = useState<'market' | 'limit'>(saved.entryMode ?? 'market');
  const [stopMode, setStopMode] = useState<'stop_order' | 'limit_order'>(saved.stopMode ?? 'stop_order');

  // ---------- Инструмент и счёт ----------
  const [selectedInstrument, setSelectedInstrument] = useState<string>(saved.selectedInstrument ?? '');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(saved.selectedAccountId ?? '');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);

  // ---------- Состояние трейдера ----------
  const [activeAutoTraders, setActiveAutoTraders] = useState<string[]>([]);
  const [autoTraderLog, setAutoTraderLog] = useState<Array<{ time: string; text: string; type: 'signal' | 'order' | 'error' | 'protective' }>>([]);
  const [orderFlowData, setOrderFlowData] = useState<{ delta: number; absorption: any; exhaustion: any } | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  const api = (window as any).electronAPI;

  // Сохранение при любом изменении параметров
  useEffect(() => {
    saveConfig({
      lotQty, stopLossPercent, takeProfitPercent, trailingEnabled, trailingPercent,
      dynamicSizing, riskAmount, atrPeriod, atrMultiplier,
      entryMode, stopMode,
      selectedInstrument, selectedAccountId,
    });
  }, [lotQty, stopLossPercent, takeProfitPercent, trailingEnabled, trailingPercent,
      dynamicSizing, riskAmount, atrPeriod, atrMultiplier,
      entryMode, stopMode, selectedInstrument, selectedAccountId]);

  // Загрузка счетов
  useEffect(() => {
    (async () => {
      if (!api?.getSandboxAccounts) return;
      const token = import.meta.env.VITE_TSandBox || '';
      try {
        const list = await api.getSandboxAccounts(token);
        setAccounts(list || []);
        if (!selectedAccountId && list?.length === 1) {
          setSelectedAccountId(list[0].id);
        }
      } catch (e) { console.error('Ошибка загрузки счетов:', e); }
    })();
  }, []);

  // Подписки на события автотрейдера
  useEffect(() => {
    if (!api) return;
    api.onAutoTraderSignal((data: any) => {
      setAutoTraderLog(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString(),
        text: `${data.instrumentUid.slice(0,8)}: ${data.signal.type} @ ${data.signal.price?.toFixed(2)} – ${data.signal.reason || ''}`,
        type: 'signal'
      }]);
    });
    api.onAutoTraderOrderSent((data: any) => {
      const orderType = data.signal?.reason?.includes('Stop') ? 'protective' : 'order';
      setAutoTraderLog(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString(),
        text: `Order sent: ${data.signal.type} ${data.signal.price}`,
        type: orderType
      }]);
    });
    api.onAutoTraderOrderError((data: any) => {
      setAutoTraderLog(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString(),
        text: `Order error: ${data.error}`,
        type: 'error'
      }]);
    });
    return () => { api.removeAutoTraderListeners(); };
  }, []);

  // OrderFlow
  useEffect(() => {
    if (!selectedInstrument || !api?.getOrderFlowSnapshot) return;
    const interval = setInterval(async () => {
      const data = await api.getOrderFlowSnapshot(selectedInstrument);
      setOrderFlowData(data);
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedInstrument]);

  // Восстановление статуса активных трейдеров при монтировании
  useEffect(() => {
    const fetchActive = async () => {
      const api = (window as any).electronAPI;
      if (api?.getActiveAutoTraders) {
        const active = await api.getActiveAutoTraders();
        setActiveAutoTraders(active);
      }
    };
    fetchActive();
  }, []);

  const handleStart = async () => {
    if (!selectedInstrument || !selectedAccountId) return;

    await api.updateTradingConfig({
      token: import.meta.env.VITE_TSandBox,
      accountId: selectedAccountId,
      lotQuantity: lotQty,
      stopLossPercent,
      takeProfitPercent,
      trailingEnabled,
      trailingPercent,
      trailingMode: 'percent',
      useDynamicSizing: dynamicSizing,
      riskAmount,
      atrPeriod,
      atrMultiplier,
      stopMode,
      entryMode,
      demoMode: false,
    });

    if (!streamActive) {
      try {
        const token = import.meta.env.VITE_TReadOnly || '';
        await api.startMarketStream(token, {
          subscribeCandlesRequest: {
            subscriptionAction: 'SUBSCRIPTION_ACTION_SUBSCRIBE',
            instruments: [{ instrumentId: selectedInstrument, interval: 'SUBSCRIPTION_INTERVAL_ONE_MINUTE' }]
          }
        }, 'autotrader');
        setStreamActive(true);
      } catch (err) { console.error('Stream start error:', err); return; }
    }

    await api.startAutoTrader(selectedInstrument);
    const active = await api.getActiveAutoTraders();
    setActiveAutoTraders(active);
  };

  const handleStop = async () => {
    if (activeAutoTraders.includes(selectedInstrument)) {
      await api.stopAutoTrader(selectedInstrument);
    }
    const remaining = await api.getActiveAutoTraders();
    setActiveAutoTraders(remaining);
    if (remaining.length === 0 && streamActive) {
      await api.stopMarketStream('autotrader');
      setStreamActive(false);
    }
  };

  return (
    <div className="p-2">
      <Card className="surface-ground p-2 mb-3">
        <h4 className="p-mb-2">Автотрейдер (Live Trading)</h4>

        {/* Выбор инструмента и счёта */}
        <div className="flex align-items-center flex-wrap gap-2 mb-3">
          <label className="mr-1 mb-0">Инструмент</label>
          <Dropdown
            value={selectedInstrument}
            options={availableInstruments.map(i => ({ label: `${i.name} (${i.ticker})`, value: i.uid }))}
            onChange={e => setSelectedInstrument(e.value)}
            placeholder="Выберите инструмент"
            filter
            className="p-inputtext-sm"
            style={{ minWidth: '220px' }}
          />
          <label className="ml-2 mr-1 mb-0">Счёт</label>
          <Dropdown
            value={selectedAccountId}
            options={accounts.map(a => ({ label: a.name || a.id, value: a.id }))}
            onChange={e => setSelectedAccountId(e.value)}
            placeholder="Выберите счёт"
            className="p-inputtext-sm"
            style={{ minWidth: '200px' }}
          />
        </div>

        {/* Настройки риск‑менеджмента */}
        <div className="flex align-items-center flex-wrap gap-2 mb-2">
          <label className="mr-1 mb-0">Lots</label>
          <InputNumber value={lotQty} onValueChange={e => setLotQty(e.value ?? 1)} min={1} size={1} className="p-inputtext-sm" />
          <label className="ml-2 mr-1 mb-0">SL%</label>
          <InputNumber value={stopLossPercent} onValueChange={e => setStopLossPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
          <label className="ml-2 mr-1 mb-0">TP%</label>
          <InputNumber value={takeProfitPercent} onValueChange={e => setTakeProfitPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />

          <div className="flex align-items-center ml-2">
            <Checkbox checked={trailingEnabled} onChange={e => setTrailingEnabled(e.checked)} />
            <label className="ml-1 mr-1 mb-0">Trail</label>
            {trailingEnabled && (
              <InputNumber value={trailingPercent} onValueChange={e => setTrailingPercent(e.value ?? 0.5)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
            )}
          </div>

          <div className="flex align-items-center ml-2">
            <Checkbox checked={dynamicSizing} onChange={e => setDynamicSizing(e.checked)} />
            <label className="ml-1 mr-1 mb-0">Dyn.Lots</label>
            {dynamicSizing && (
              <InputNumber value={riskAmount} onValueChange={e => setRiskAmount(e.value ?? 1000)} step={100} min={0} size={3} className="p-inputtext-sm" placeholder="Risk RUB" />
            )}
          </div>

          {(dynamicSizing || trailingEnabled) && (
            <>
              <label className="ml-2 mr-1 mb-0">ATR Per</label>
              <InputNumber value={atrPeriod} onValueChange={e => setAtrPeriod(e.value ?? 14)} min={5} max={50} step={1} size={2} className="p-inputtext-sm" />
              <label className="ml-2 mr-1 mb-0">Mult</label>
              <InputNumber value={atrMultiplier} onValueChange={e => setAtrMultiplier(e.value ?? 2.0)} min={0.5} max={5} step={0.1} size={2} className="p-inputtext-sm" />
            </>
          )}

          <label className="ml-2 mr-1 mb-0">Entry</label>
          <Dropdown
            value={entryMode}
            options={[{ label: 'Market', value: 'market' }, { label: 'Limit', value: 'limit' }]}
            onChange={e => setEntryMode(e.value)}
            className="p-inputtext-sm"
            style={{ width: '100px' }}
          />

          <label className="ml-2 mr-1 mb-0">Stop</label>
          <Dropdown
            value={stopMode}
            options={[{ label: 'Stop Order', value: 'stop_order' }, { label: 'Limit Order', value: 'limit_order' }]}
            onChange={e => setStopMode(e.value)}
            className="p-inputtext-sm"
            style={{ width: '120px' }}
          />
        </div>

        {/* Кнопки управления */}
        <div className="flex align-items-center gap-2 mb-3">
          <Button
            label={activeAutoTraders.includes(selectedInstrument) ? 'Running...' : 'Start Auto Trader'}
            onClick={handleStart}
            disabled={!selectedInstrument || !selectedAccountId}
            className={`p-button-sm p-1 px-3 ${activeAutoTraders.includes(selectedInstrument) ? 'p-button-warning' : ''}`}
            icon={activeAutoTraders.includes(selectedInstrument) ? 'pi pi-spin pi-spinner' : ''}
          />
          <Button
            label="Stop Auto Trader"
            onClick={handleStop}
            disabled={!activeAutoTraders.includes(selectedInstrument)}
            className="p-button-sm p-button-danger p-1 px-3"
          />
          {activeAutoTraders.length > 0 && (
            <span className="text-sm ml-2">
              Active: {activeAutoTraders.map(uid => availableInstruments.find(i => i.uid === uid)?.ticker || uid.slice(0,8)).join(', ')}
            </span>
          )}
        </div>

        {/* OrderFlow */}
        {orderFlowData && (
          <div className="flex align-items-center gap-2 mb-2">
            <div style={{ fontSize: '0.8rem' }}>
              <span className="mr-1">Δ</span>
              <span style={{ color: orderFlowData.delta >= 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                {orderFlowData.delta > 0 ? '+' : ''}{orderFlowData.delta}
              </span>
            </div>
            {orderFlowData.absorption && <Tag severity="info" value={`Abs: ${orderFlowData.absorption.side}`} style={{ fontSize: '0.7rem' }} />}
            {orderFlowData.exhaustion && <Tag severity="warning" value={`Exh: ${orderFlowData.exhaustion.type}`} style={{ fontSize: '0.7rem' }} />}
          </div>
        )}

        {/* Лог */}
        <div className="mt-2">
          <h5>Лог автотрейдера</h5>
          <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#111', color: '#ccc', padding: '8px', borderRadius: '4px' }}>
            {autoTraderLog.length === 0 && <span>Ожидание сигналов...</span>}
            {autoTraderLog.map((entry, i) => (
              <div key={i} style={{ fontSize: '0.8rem', borderBottom: '1px solid #333', padding: '2px 0' }}>
                <span style={{ color: '#888' }}>{entry.time}</span>{' '}
                <span style={{ color: entry.type === 'error' ? 'red' : entry.type === 'protective' ? '#ff9800' : entry.type === 'order' ? '#4caf50' : '#fff' }}>
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};