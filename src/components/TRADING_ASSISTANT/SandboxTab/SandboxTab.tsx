// src/components/TRADING_ASSISTANT/SandboxTab/SandboxTab.tsx

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';

interface SandboxTabProps {
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
}

export const SandboxTab: React.FC<SandboxTabProps> = ({ availableInstruments }) => {
  const api = (window as any).electronAPI;

  // ---------- Счета ----------
  const [token, setToken] = useState(import.meta.env.VITE_TSandBox || '');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
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

  // ---------- Ручной ордер ----------
  const [manualUid, setManualUid] = useState('');
  const [manualType, setManualType] = useState<'BUY' | 'SELL'>('BUY');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualPrice, setManualPrice] = useState(0);
  const [isLimitOrder, setIsLimitOrder] = useState(false);

  // Загрузка счетов
  const loadAccounts = async () => {
    if (!api?.getSandboxAccounts) return;
    setLoadingAccounts(true);
    try {
      const list = await api.getSandboxAccounts(token);
      setAccounts(list || []);
      if (list?.length === 1) setSelectedAccountId(list[0].id);
    } catch (err: any) {
      alert('Ошибка загрузки счетов: ' + err.message);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => { if (token) loadAccounts(); }, [token]);

  const refreshBalance = async () => {
    if (!api?.getBalance || !selectedAccountId) return;
    const res = await api.getBalance(selectedAccountId);
    if (res.success) setBalance(`${res.balance} ${res.currency}`);
    else setBalance(`Ошибка: ${res.error}`);
  };

  useEffect(() => { if (selectedAccountId) refreshBalance(); }, [selectedAccountId]);

  const handleCreateAccount = async () => {
    if (!api?.createSandboxAccount) return;
    const res = await api.createSandboxAccount();
    if (res.success) { alert(`Счёт ${res.accountId} создан`); loadAccounts(); }
    else alert('Ошибка: ' + res.error);
  };

  const handleCloseAccount = async () => {
    if (!selectedAccountId) return;
    if (!confirm(`Закрыть счёт ${selectedAccountId}?`)) return;
    await api.closeSandboxAccount(selectedAccountId);
    setSelectedAccountId('');
    loadAccounts();
  };

  const handlePayIn = async () => {
    if (!api?.payInSandbox) return;
    const res = await api.payInSandbox(payAmount, selectedAccountId);
    if (res.success) { alert('Счёт пополнен'); refreshBalance(); }
    else alert('Ошибка: ' + res.error);
  };

  // Применить конфиг
  const applyConfig = async () => {
    if (!api?.updateTradingConfig) return;
    await api.updateTradingConfig({
      token,
      accountId: selectedAccountId,
      lotQuantity: lotQty,
      stopLossPercent,
      takeProfitPercent,
      trailingEnabled,
      trailingPercent,
      useDynamicSizing: dynamicSizing,
      riskAmount,
      atrPeriod,
      atrMultiplier,
      stopMode,
      entryMode,
    });
    alert('Конфигурация применена');
  };

  // Отправить ручной ордер
  const sendManualOrder = async () => {
    if (!selectedAccountId || !manualUid) return;
    await applyConfig(); // чтобы OrderManager получил актуальные настройки
    if (!api?.sendManualOrder) return;
    const res = await api.sendManualOrder({
      instrumentUid: manualUid,
      type: manualType,
      quantity: manualQuantity,
      orderType: isLimitOrder ? 'limit' : 'market',
      price: isLimitOrder ? manualPrice : undefined,
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
              value={selectedAccountId}
              options={accounts.map(a => ({ label: a.name || a.id, value: a.id }))}
              onChange={e => setSelectedAccountId(e.value)}
              placeholder="Выберите счёт"
              className="p-inputtext-sm"
              style={{ minWidth: '200px' }}
            />
            <Button icon="pi pi-refresh" loading={loadingAccounts} onClick={loadAccounts} className="p-button-sm p-button-secondary" tooltip="Загрузить счета" />
            <Button icon="pi pi-plus" onClick={handleCreateAccount} className="p-button-sm p-button-success" tooltip="Создать счёт" />
            <Button icon="pi pi-trash" onClick={handleCloseAccount} className="p-button-sm p-button-danger" tooltip="Удалить счёт" />
            <span className="ml-auto">
              {balance && <span className="mr-2">{balance}</span>}
              <InputNumber value={payAmount} onValueChange={e => setPayAmount(e.value ?? 0)} min={1000} step={1000} className="p-inputtext-sm" style={{ width: '100px' }} />
              <Button label="Пополнить" onClick={handlePayIn} className="p-button-sm p-ml-2" />
            </span>
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
              <Checkbox checked={trailingEnabled} onChange={(e:any) => setTrailingEnabled(e.checked)} />
              <label className="ml-1 mr-1 mb-0">Trail</label>
              {trailingEnabled && <InputNumber value={trailingPercent} onValueChange={e => setTrailingPercent(e.value ?? 0.5)} step={0.1} min={0} size={2} className="p-inputtext-sm" />}
            </div>

            <div className="flex align-items-center ml-2">
              <Checkbox checked={dynamicSizing} onChange={(e:any) => setDynamicSizing(e.checked)} />
              <label className="ml-1 mr-1 mb-0">Dyn.Lots</label>
              {dynamicSizing && <InputNumber value={riskAmount} onValueChange={e => setRiskAmount(e.value ?? 1000)} step={100} min={0} size={3} className="p-inputtext-sm" placeholder="Risk RUB" />}
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
            <Dropdown value={entryMode} options={[{ label: 'Market', value: 'market' }, { label: 'Limit', value: 'limit' }]} onChange={e => setEntryMode(e.value)} className="p-inputtext-sm" style={{ width: '100px' }} />
            <label className="ml-2 mr-1 mb-0">Stop</label>
            <Dropdown value={stopMode} options={[{ label: 'Stop Order', value: 'stop_order' }, { label: 'Limit Order', value: 'limit_order' }]} onChange={e => setStopMode(e.value)} className="p-inputtext-sm" style={{ width: '120px' }} />

            <Button label="Apply" onClick={applyConfig} className="p-button-sm p-button-info" tooltip="Применить конфигурацию" />
          </div>

          {/* Ручной ордер */}
          <Card className="surface-ground p-2 mt-2">
            <h5 className="p-mb-2">Ручной ордер</h5>
            <div className="flex align-items-center flex-wrap gap-2">
              <label className="mr-1 mb-0">UID</label>
              <InputText value={manualUid} onChange={e => setManualUid(e.target.value)} className="p-inputtext-sm" style={{ width: '200px' }} placeholder="e6123145-..." />
              <label className="mr-1 mb-0">Тип</label>
              <Dropdown value={manualType} options={[{ label: 'BUY', value: 'BUY' }, { label: 'SELL', value: 'SELL' }]} onChange={e => setManualType(e.value)} className="p-inputtext-sm" style={{ width: '80px' }} />
              <label className="mr-1 mb-0">Кол-во</label>
              <InputNumber value={manualQuantity} onValueChange={e => setManualQuantity(e.value ?? 1)} min={1} size={1} className="p-inputtext-sm" />
              <div className="flex align-items-center">
                <Checkbox checked={isLimitOrder} onChange={(e: any) => setIsLimitOrder(e.checked)} />
                <label className="ml-1 mr-2 mb-0">Limit</label>
                {isLimitOrder && <InputNumber value={manualPrice} onValueChange={e => setManualPrice(e.value ?? 0)} min={0} step={0.01} size={3} className="p-inputtext-sm" />}
              </div>
              <Button label="Отправить" icon="pi pi-send" onClick={sendManualOrder} className="p-button-sm p-button-success" />
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
};