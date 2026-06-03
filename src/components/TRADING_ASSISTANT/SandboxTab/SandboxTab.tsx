import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { InputNumber } from 'primereact/inputnumber';

interface Props {
  sandbox: any;
  updateSandbox: (patch: any) => void;
  handleCreateAccount: () => void;
  handleCloseAccount: () => void;
  loadAccounts: () => void;
  refreshBalance: () => void;
  handlePayIn: () => void;
  applyConfig: () => void;
  toggleTrading: () => void;
  autoTrading: boolean;
}

export const SandboxTab: React.FC<Props> = ({
  sandbox,
  updateSandbox,
  handleCreateAccount,
  handleCloseAccount,
  loadAccounts,
  refreshBalance,
  handlePayIn,
  applyConfig,
  toggleTrading,
  autoTrading,
}) => {
  return (
    <Card title="Sandbox Settings" className="surface-ground">
      <div className="p-fluid p-formgrid p-grid">
        <div className="p-field p-col-12 p-md-6">
          <label>Token</label>
          <InputText value={sandbox.token} onChange={e => updateSandbox({ token: e.target.value })} />
        </div>
        <div className="p-field p-col-12 p-md-6 p-d-flex p-ai-end">
          <Button label="Load Accounts" onClick={loadAccounts} disabled={!sandbox.token || sandbox.loadingAccounts} className="p-button-secondary p-mr-2" />
          <Button label="Create" onClick={handleCreateAccount} disabled={sandbox.creatingAccount} className="p-button-success p-mr-2" />
          <Button label="Delete" onClick={handleCloseAccount} disabled={!sandbox.accountId} className="p-button-danger" />
        </div>
        <div className="p-field p-col-12 p-md-6">
          <label>Account ID</label>
          <Dropdown
            value={sandbox.accountId}
            options={sandbox.accounts.map((acc: any) => ({ label: acc.name || acc.id, value: acc.id }))}
            onChange={e => updateSandbox({ accountId: e.value })}
            placeholder="-- select account --"
          />
        </div>
        <div className="p-field p-col-12 p-md-2">
          <label>Demo mode</label>
          <Checkbox checked={sandbox.demoMode} onChange={e => updateSandbox({ demoMode: e.checked })} />
        </div>
      </div>

      <div className="p-fluid p-formgrid p-grid p-mt-2">
        <div className="p-field p-col-12 p-md-3">
          <Button label={autoTrading ? 'Stop Auto Trading' : 'Start Auto Trading'} onClick={toggleTrading} className={autoTrading ? 'p-button-danger' : 'p-button-success'} />
        </div>
        <div className="p-field p-col-12 p-md-3">
          <Button label="Apply Config" onClick={applyConfig} className="p-button-secondary" />
        </div>
        <div className="p-field p-col-6 p-md-2">
          <label>Lots</label>
          <InputNumber value={sandbox.lotQty} onValueChange={e => updateSandbox({ lotQty: e.value })} min={1} showButtons />
        </div>
        <div className="p-field p-col-6 p-md-2">
          <label>SL %</label>
          <InputNumber value={sandbox.stopLossPercent} onValueChange={e => updateSandbox({ stopLossPercent: e.value })} step={0.1} min={0} />
        </div>
        <div className="p-field p-col-6 p-md-2">
          <label>TP %</label>
          <InputNumber value={sandbox.takeProfitPercent} onValueChange={e => updateSandbox({ takeProfitPercent: e.value })} step={0.1} min={0} />
        </div>
      </div>

      <div className="p-fluid p-formgrid p-grid p-mt-2">
        <div className="p-field p-col-8 p-md-4">
          <label>Pay In Amount (RUB)</label>
          <InputNumber value={sandbox.payAmount} onValueChange={e => updateSandbox({ payAmount: e.value })} min={1000} step={1000} />
        </div>
        <div className="p-field p-col-4 p-md-2 p-d-flex p-ai-end">
          <Button label="Deposit" onClick={handlePayIn} />
        </div>
        <div className="p-field p-col-12 p-md-2 p-d-flex p-ai-end">
          <Button label="Balance" onClick={refreshBalance} className="p-button-info" />
        </div>
        <div className="p-field p-col-12 p-md-4 p-d-flex p-ai-end">
          {sandbox.balance && <span className="p-ml-2">{sandbox.balance}</span>}
          {sandbox.payMessage && <span className="p-ml-2" style={{ color: '#4caf50' }}>{sandbox.payMessage}</span>}
        </div>
      </div>
    </Card>
  );
};