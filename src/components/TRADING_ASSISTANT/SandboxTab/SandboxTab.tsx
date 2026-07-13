// src/components/TRADING_ASSISTANT/SandboxTab/SandboxTab.tsx

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';

interface SandboxTabProps {
  availableInstruments: Array<{ uid: string; name: string; ticker?: string }>;
}

export const SandboxTab: React.FC<SandboxTabProps> = ({ availableInstruments }) => {
  // ---------- Состояния счетов ----------
  const [token, setToken] = useState(import.meta.env.VITE_TSandBox || '');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(10000);
  const [payMessage, setPayMessage] = useState('');

  // ---------- Общие настройки риск‑менеджмента ----------
  const [demoMode, setDemoMode] = useState(false);
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
  const [maxSignalsPerDay, setMaxSignalsPerDay] = useState(0);
  const [minIntervalMinutes, setMinIntervalMinutes] = useState(15);

  // ---------- Ручной ордер ----------
  const [manualInstrumentUid, setManualInstrumentUid] = useState('');
  const [manualType, setManualType] = useState<'BUY' | 'SELL'>('BUY');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualOrderType, setManualOrderType] = useState<'market' | 'limit'>('market');
  const [manualPrice, setManualPrice] = useState(0);
  const [manualSlPercent, setManualSlPercent] = useState(0);
  const [manualTpPercent, setManualTpPercent] = useState(0);

  const api = (window as any).electronAPI;

  // ========== Загрузка счетов ==========
  const loadAccounts = async () => {
    if (!api?.getSandboxAccounts) return;
    setLoadingAccounts(true);
    try {
      const list = await api.getSandboxAccounts(token);
      setAccounts(list || []);
      if (list?.length === 1) setSelectedAccountId(list[0].id);
    } catch (err: any) {
      alert('Ошибка загрузки счетов: ' + (err.message || 'Неизвестная ошибка'));
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => { if (token) loadAccounts(); }, [token]);

  const handleCreateAccount = async () => {
    if (!api?.createSandboxAccount) return;
    setCreatingAccount(true);
    try {
      const result = await api.createSandboxAccount();
      if (result.success) {
        alert(`Счёт создан: ${result.accountId}`);
        await loadAccounts();
      } else {
        alert('Ошибка создания счёта: ' + result.error);
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!selectedAccountId) return;
    if (!confirm(`Закрыть счёт ${selectedAccountId}?`)) return;
    try {
      await api.closeSandboxAccount(selectedAccountId);
      alert('Счёт закрыт');
      setSelectedAccountId('');
      await loadAccounts();
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const handlePayIn = async () => {
    if (!api?.payInSandbox) return;
    setPayMessage('');
    const result = await api.payInSandbox(payAmount, selectedAccountId);
    if (result.success) {
      setPayMessage(`Пополнено. Баланс: ${JSON.stringify(result.balance)}`);
      refreshBalance();
    } else {
      setPayMessage(`Ошибка: ${result.error}`);
    }
  };

  const refreshBalance = async () => {
    if (!api?.getBalance || !selectedAccountId) return;
    const result = await api.getBalance(selectedAccountId);
    if (result.success) {
      setBalance(`${result.balance} ${result.currency}`);
    } else {
      setBalance(`Ошибка: ${result.error}`);
    }
  };

  useEffect(() => { if (selectedAccountId) refreshBalance(); }, [selectedAccountId]);

  // ========== Применить конфиг ==========
  const applyConfig = async () => {
    if (!api?.updateTradingConfig) return;
    await api.updateTradingConfig({
      token,
      accountId: selectedAccountId,
      demoMode,
      lotQuantity: lotQty,
      stopLossPercent,
      takeProfitPercent,
      trailingEnabled,
      trailingPercent,
      maxSignalsPerDay,
      minIntervalMinutes,
      useDynamicSizing: dynamicSizing,
      riskAmount,
      atrPeriod,
      atrMultiplier,
      trailingMode: 'percent',
      stopMode,
      entryMode,
    });
    alert('Конфиг применён');
  };

  // ========== Отправить ручной ордер ==========
  const handleManualOrder = async () => {
    if (!api?.sendManualOrder) return;
    if (!selectedAccountId || !manualInstrumentUid) {
      alert('Выберите счёт и введите идентификатор инструмента');
      return;
    }
    // Применяем конфиг, чтобы OrderManager получил актуальные SL/TP
    await applyConfig();

    const res = await api.sendManualOrder({
      instrumentUid: manualInstrumentUid,
      type: manualType,
      quantity: manualQuantity,
      orderType: manualOrderType,
      price: manualOrderType === 'limit' ? manualPrice : undefined,
    });
    if (res.success) {
      alert('Ордер отправлен');
    } else {
      alert('Ошибка: ' + res.error);
    }
  };

  return (
    <div className="p-2">
      <Card className="surface-ground p-0">
        <div className="p-2">
          {/* ---------- Управление счетами ---------- */}
          <div className="flex align-items-center flex-wrap gap-2 mb-3">
            <Dropdown
              value={selectedAccountId}
              options={accounts.map(a => ({ label: a.name || a.id, value: a.id }))}
              onChange={e => setSelectedAccountId(e.value)}
              placeholder="Счёт"
              className="p-inputtext-sm"
              style={{ minWidth: '200px' }}
            />
            <Button label="Загрузить счета" onClick={loadAccounts} loading={loadingAccounts} className="p-button-sm p-button-secondary" />
            <Button label="Создать счёт" onClick={handleCreateAccount} loading={creatingAccount} className="p-button-sm p-button-success" />
            <Button label="Удалить счёт" onClick={handleCloseAccount} disabled={!selectedAccountId} className="p-button-sm p-button-danger" />
            <Checkbox checked={demoMode} onChange={(e:any) => setDemoMode(e.checked)} />
            <label className="mr-2 mb-0">Demo</label>

            <Button label="Применить конфиг" onClick={applyConfig} className="p-button-sm p-button-info" />

            <span className="ml-auto">
              {balance && <span className="mr-2">{balance}</span>}
              {payMessage && <span style={{ color: '#4caf50' }}>{payMessage}</span>}
            </span>
          </div>

          {/* ---------- Пополнение ---------- */}
          <div className="flex align-items-center flex-wrap gap-2 mb-3">
            <label className="mr-1 mb-0">Пополнить (RUB)</label>
            <InputNumber value={payAmount} onValueChange={e => setPayAmount(e.value ?? 0)} min={1000} step={1000} className="p-inputtext-sm" />
            <Button label="Пополнить" onClick={handlePayIn} className="p-button-sm" />
            <Button label="Обновить баланс" onClick={refreshBalance} className="p-button-sm p-button-secondary" />
          </div>

          {/* ---------- Настройки риск‑менеджмента ---------- */}
          <div className="flex align-items-center flex-wrap gap-2 mb-3">
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
          </div>

          {/* ---------- Ручной ордер ---------- */}
          <Card className="surface-ground p-2 mb-3">
            <h5 className="p-mb-2">Ручная отправка ордера</h5>
            <div className="flex align-items-center flex-wrap gap-2">
              <label className="mr-1 mb-0">UID</label>
              <InputText value={manualInstrumentUid} onChange={e => setManualInstrumentUid(e.target.value)} className="p-inputtext-sm" style={{ width: '200px' }} placeholder="e6123145-..." />
              <label className="mr-1 mb-0">Тип</label>
              <Dropdown value={manualType} options={[{ label: 'BUY', value: 'BUY' }, { label: 'SELL', value: 'SELL' }]} onChange={e => setManualType(e.value)} className="p-inputtext-sm" style={{ width: '80px' }} />
              <label className="mr-1 mb-0">Кол-во</label>
              <InputNumber value={manualQuantity} onValueChange={e => setManualQuantity(e.value ?? 1)} min={1} size={1} className="p-inputtext-sm" />
              <label className="mr-1 mb-0">Ордер</label>
              <Dropdown value={manualOrderType} options={[{ label: 'Market', value: 'market' }, { label: 'Limit', value: 'limit' }]} onChange={e => setManualOrderType(e.value)} className="p-inputtext-sm" style={{ width: '100px' }} />
              {manualOrderType === 'limit' && (
                <>
                  <label className="mr-1 mb-0">Цена</label>
                  <InputNumber value={manualPrice} onValueChange={e => setManualPrice(e.value ?? 0)} min={0} step={0.01} size={3} className="p-inputtext-sm" />
                </>
              )}
              <label className="mr-1 mb-0">SL%</label>
              <InputNumber value={manualSlPercent} onValueChange={e => setManualSlPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
              <label className="mr-1 mb-0">TP%</label>
              <InputNumber value={manualTpPercent} onValueChange={e => setManualTpPercent(e.value ?? 0)} step={0.1} min={0} size={2} className="p-inputtext-sm" />
              <Button label="Отправить" icon="pi pi-send" onClick={handleManualOrder} className="p-button-sm p-button-success" />
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
};