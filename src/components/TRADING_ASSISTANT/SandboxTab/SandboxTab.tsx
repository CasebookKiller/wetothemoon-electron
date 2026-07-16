// src/components/TRADING_ASSISTANT/SandboxTab/SandboxTab.tsx

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import { Panel } from 'primereact/panel';
import { CompactPositionsPanel } from '../CompactPositionsPanel/CompactPositionsPanel';
import { CompactLogPanel } from '../CompactLogPanel/CompactLogPanel';

interface SandboxTabProps {
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
  sharedAccountId: string;
  onAccountChange: (id: string) => void;
}

export const SandboxTab: React.FC<SandboxTabProps> = ({ 
  availableInstruments,
  sharedAccountId,
  onAccountChange 
}) => {
  const api = (window as any).electronAPI;

  // ---------- Счета ----------
  const [token, setToken] = useState(import.meta.env.VITE_TSandBox || '');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(10000);

  // ---------- Конфигурация риск‑менеджмента ----------
  const [lotQty, setLotQty] = useState(1);
  const [stopLossPercent, setStopLossPercent] = useState(1);
  const [takeProfitPercent, setTakeProfitPercent] = useState(2);
  const [trailingEnabled, setTrailingEnabled] = useState(false);
  const [trailingPercent, setTrailingPercent] = useState(1);
  const [dynamicSizing, setDynamicSizing] = useState(false);
  const [riskAmount, setRiskAmount] = useState(1000);
  const [atrPeriod, setAtrPeriod] = useState(14);
  const [atrMultiplier, setAtrMultiplier] = useState(2);
  const [stopMode, setStopMode] = useState<'stop_order' | 'limit_order'>('stop_order');
  const [entryMode, setEntryMode] = useState<'market' | 'limit'>('market');

  const [demoMode, setDemoMode] = useState(false);

  // ---------- Ручной ордер ----------
  const [manualInstrument, setManualInstrument] = useState<string>('');
  const [manualType, setManualType] = useState<'BUY' | 'SELL'>('BUY');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualPrice, setManualPrice] = useState(0);
  const [manualOrderType, setManualOrderType] = useState<'market' | 'limit'>('market');
  const [manualSlPercent, setManualSlPercent] = useState(0);
  const [manualTpPercent, setManualTpPercent] = useState(0);

  // Загрузка счетов
  const loadAccounts = async () => {
    if (!api?.getSandboxAccounts) return;
    setLoadingAccounts(true);
    try {
      const list = await api.getSandboxAccounts(token);
      setAccounts(list || []);
      // Если счетов ровно один и ещё не выбран – выбираем автоматически
      if (list?.length === 1 && !sharedAccountId) {
        onAccountChange(list[0].id);
      }
    } catch (err: any) {
      alert('Ошибка загрузки счетов: ' + err.message);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => { if (token) loadAccounts(); }, [token]);

  const refreshBalance = async () => {
    if (!api?.getBalance || !sharedAccountId) return;
    const res = await api.getBalance(sharedAccountId);
    if (res.success) setBalance(`${res.balance} ${res.currency}`);
    else setBalance(`Ошибка: ${res.error}`);
  };

  useEffect(() => { if (sharedAccountId) refreshBalance(); }, [sharedAccountId]);

  const handleCreateAccount = async () => {
    if (!api?.createSandboxAccount) return;
    const res = await api.createSandboxAccount();
    if (res.success) { alert(`Счёт ${res.accountId} создан`); loadAccounts(); }
    else alert('Ошибка: ' + res.error);
  };

  const handleCloseAccount = async () => {
    if (!sharedAccountId) return;
    if (!confirm(`Закрыть счёт ${sharedAccountId}?`)) return;
    await api.closeSandboxAccount(sharedAccountId);
    onAccountChange('');
    loadAccounts();
  };

  const handlePayIn = async () => {
    if (!api?.payInSandbox) return;
    const res = await api.payInSandbox(payAmount, sharedAccountId);
    if (res.success) { alert('Счёт пополнен'); refreshBalance(); }
    else alert('Ошибка: ' + res.error);
  };

  // Применить конфиг
  const applyConfig = async () => {
    if (!api?.updateTradingConfig) return;
    await api.updateTradingConfig({
      token,
      accountId: sharedAccountId,
      lotQuantity: manualQuantity,                // <-- для ручного ордера берём его количество
      stopLossPercent: manualSlPercent || stopLossPercent,
      takeProfitPercent: manualTpPercent || takeProfitPercent,
      trailingEnabled,
      trailingPercent,
      useDynamicSizing: dynamicSizing,
      riskAmount,
      atrPeriod,
      atrMultiplier,
      stopMode,
      entryMode: manualOrderType,                 // <-- market или limit
      demoMode,                                   // <-- обязательно
    });
    alert('Конфигурация применена');
  };

  // Отправить ручной ордер
  const sendManualOrder = async () => {
    if (!sharedAccountId || !manualInstrument) return;
    await applyConfig();
    if (!api?.sendManualOrder) return;
    const res = await api.sendManualOrder({
      instrumentUid: manualInstrument,
      type: manualType,
      quantity: manualQuantity,
      orderType: manualOrderType,
      price: manualOrderType === 'limit' ? manualPrice : undefined,
    });
    if (res.success) alert('Ордер отправлен');
    else alert('Ошибка: ' + res.error);
  };

  return (
    <div className="p-2">
      <Card className="surface-ground p-0">
        <div className="p-2">
          {/* Счета */}
          <div className="flex align-items-center flex-wrap gap-2 mb-2">
            <label className="mr-1 mb-0">Счёт</label>
            <Dropdown
              value={sharedAccountId}
              options={accounts.map(a => ({ label: a.name || a.id, value: a.id }))}
              onChange={e => onAccountChange(e.value)}
              placeholder="Выберите счёт"
              className="p-inputtext-sm"
              style={{ minWidth: '200px' }}
            />
            <Button icon="pi pi-refresh" loading={loadingAccounts} onClick={loadAccounts} className="p-button-sm p-button-secondary p-1 px-2" tooltip="Загрузить счета" />
            <Button icon="pi pi-plus" onClick={handleCreateAccount} className="p-button-sm p-button-success p-1 px-2" tooltip="Создать счёт" />
            <Button icon="pi pi-trash" onClick={handleCloseAccount} className="p-button-sm p-button-danger p-1 px-2" tooltip="Удалить счёт" />
            <Checkbox checked={demoMode} onChange={(e: any) => setDemoMode(e.checked)} />
            <label className="ml-1 mr-2 mb-0">Demo</label>
            {balance && <label className="mr-1 mb-0">Баланс</label>}
            {balance && <div className="mr-1 mb-0">{balance}</div>}
            <InputNumber
              value={payAmount}
              onValueChange={e => setPayAmount(e.value ?? 0)}
              min={1000}
              step={1000}
              className="p-inputtext-sm mr-1"
            />
            <Button label="Пополнить" onClick={handlePayIn} className="p-button-sm p-button-success p-1 px-2" />
          </div>

          {/* Настройки риск‑менеджмента */}
          <div className="flex align-items-center flex-wrap gap-2 mb-2">
            <label className="mr-1 mb-0">Lots</label>
            <InputNumber value={lotQty} onValueChange={e => setLotQty(e.value ?? 1)} min={1} size={1} className="p-inputtext-sm" />
            <label className="ml-2 mr-1 mb-0">SL%</label>
            <InputNumber value={stopLossPercent} onValueChange={e => setStopLossPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
            <label className="ml-2 mr-1 mb-0">TP%</label>
            <InputNumber value={takeProfitPercent} onValueChange={e => setTakeProfitPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />

            <Checkbox checked={trailingEnabled} onChange={(e:any) => setTrailingEnabled(e.checked)} />
            <label className="ml-1 mr-1 mb-0">Trail</label>
            {trailingEnabled && <InputNumber value={trailingPercent} onValueChange={e => setTrailingPercent(e.value ?? 0.5)} step={0.1} min={0} size={2} className="p-inputtext-sm" />}
            
            <Checkbox checked={dynamicSizing} onChange={(e:any) => setDynamicSizing(e.checked)} />
            <label className="ml-1 mr-1 mb-0">Dyn.Lots</label>
            {dynamicSizing && <InputNumber value={riskAmount} onValueChange={e => setRiskAmount(e.value ?? 1000)} step={100} min={0} size={3} className="p-inputtext-sm" placeholder="Risk RUB" />}
            
            {(dynamicSizing || trailingEnabled) && (
              <>
                <label className="ml-2 mr-1 mb-0">ATR Per</label>
                <InputNumber value={atrPeriod} onValueChange={e => setAtrPeriod(e.value ?? 14)} min={5} max={50} step={1} size={2} className="p-inputtext-sm" />
                <label className="ml-2 mr-1 mb-0">Mult</label>
                <InputNumber value={atrMultiplier} onValueChange={e => setAtrMultiplier(e.value ?? 2.0)} min={0.5} max={5} step={0.1} size={2} className="p-inputtext-sm" />
              </>
            )}

            <label className="ml-2 mr-1 mb-0">Entry</label>
            <Dropdown value={entryMode} options={[{ label: 'Market', value: 'market' }, { label: 'Limit', value: 'limit' }]} onChange={e => setEntryMode(e.value)} className="p-inputtext-sm" style={{ width: '100px' }} />
            <label className="ml-2 mr-1 mb-0">Stop</label>
            <Dropdown value={stopMode} options={[{ label: 'Stop Order', value: 'stop_order' }, { label: 'Limit Order', value: 'limit_order' }]} onChange={e => setStopMode(e.value)} className="p-inputtext-sm" style={{ width: '120px' }} />

            <Button label="Apply" onClick={applyConfig} className="p-button-sm p-button-info p-1 px-2" tooltip="Применить конфигурацию" />
          </div>
        </div>
      </Card>

      {/* Ручной ордер */}
      <Card className="surface-ground p-1 mt-1">
        <h5 className="my-1 p-1">Ручной ордер</h5>
        <div className="flex align-items-center flex-wrap gap-2">
          <label className="mr-1 mb-0">Инструмент</label>
          <Dropdown
            value={manualInstrument}
            options={availableInstruments.map(i => ({ label: `${i.name} (${i.ticker})`, value: i.uid }))}
            onChange={e => setManualInstrument(e.value)}
            placeholder="Выберите инструмент"
            filter
            className="p-inputtext-sm"
            style={{ minWidth: '220px' }}
          />
          <label className="mr-1 mb-0">Тип</label>
          <Dropdown value={manualType} options={[{ label: 'BUY', value: 'BUY' }, { label: 'SELL', value: 'SELL' }]} onChange={e => setManualType(e.value)} className="p-inputtext-sm" style={{ width: '80px' }} />
          <label className="mr-1 mb-0">Кол-во</label>
          <InputNumber value={manualQuantity} onValueChange={e => setManualQuantity(e.value ?? 1)} min={1} size={1} className="p-inputtext-sm" />

          {manualOrderType === 'limit' && (
            <>
              <label className="mr-1 mb-0">Цена</label>
              <InputNumber value={manualPrice} onValueChange={e => setManualPrice(e.value ?? 0)} min={0} step={0.01} size={3} className="p-inputtext-sm" />
              <label className="mr-1 mb-0">SL%</label>
              <InputNumber value={manualSlPercent} onValueChange={e => setManualSlPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
              <label className="mr-1 mb-0">TP%</label>
              <InputNumber value={manualTpPercent} onValueChange={e => setManualTpPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
            </>
          )}

          <label className="mr-1 mb-0">Тип ордера</label>
          <Dropdown
            value={manualOrderType}
            options={[
              { label: 'Market', value: 'market' },
              { label: 'Limit', value: 'limit' }
            ]}
            onChange={e => setManualOrderType(e.value)}
            className="p-inputtext-sm"
            style={{ width: '100px' }}
          />
          <Button label="Отправить" icon="pi pi-send" onClick={sendManualOrder} className="p-button-sm p-button-success p-1 px-2" />
        </div>
      </Card>

      <Panel header="Позиции и лог" toggleable className="mt-2">
        <CompactPositionsPanel accountId={sharedAccountId} />
        <CompactLogPanel accountId={sharedAccountId} />
      </Panel>
    </div>
  );
};