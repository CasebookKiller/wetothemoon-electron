import React, { useState, useEffect, useCallback } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';

interface CloudTask {
  taskId: string;
  instrumentUid: string;
  dateFrom: string;
  dateTo: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  result?: any;
}

export const CloudTab: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('http://localhost:8000');
  const [tasks, setTasks] = useState<CloudTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CloudTask | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Параметры бэктеста (как в BacktestTab, чтобы можно было быстро отправить)
  const [instrumentUid, setInstrumentUid] = useState('e6123145-9665-43e0-8413-cd61b8aa9b13');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [intervalValue, setIntervalValue] = useState('CANDLE_INTERVAL_1_MIN');
  const [strategy, setStrategy] = useState('volume_accumulation');
  const [stopLoss, setStopLoss] = useState(0.5);
  const [takeProfit, setTakeProfit] = useState(1.0);

  // Автообновление статуса задач
  useEffect(() => {
    if (!serverUrl) return;
    const fetchTasks = async () => {
      try {
        const api = (window as any).electronAPI;
        if (!api?.cloudGetTasks) return;
        const data = await api.cloudGetTasks();
        if (Array.isArray(data)) {
          setTasks(data);
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      }
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 5000); // обновляем каждые 5 секунд
    return () => clearInterval(interval);
  }, [serverUrl]);

  // Тест соединения
  const handleTestConnection = async () => {
    setTestResult('Проверка...');
    try {
      const api = (window as any).electronAPI;
      if (!api?.cloudTestConnection) return;
      const result = await api.cloudTestConnection(serverUrl);
      setTestResult(result.ok ? 'Соединение успешно' : `Ошибка: ${result.error}`);
    } catch (err: any) {
      setTestResult(`Ошибка: ${err.message}`);
    }
  };

  // Отправить задачу
  const handleCreateTask = async () => {
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      if (!api?.cloudCreateTask) return;
      const params = {
        strategyType: strategy,
        stopLossPercent: stopLoss,
        takeProfitPercent: takeProfit,
      };
      const result = await api.cloudCreateTask(
        serverUrl,
        instrumentUid,
        dateFrom,
        dateTo,
        intervalValue,
        strategy,           // ← передаём strategy отдельно
        {
          stopLossPercent: stopLoss,
          takeProfitPercent: takeProfit,
        }
      );
      if (result.taskId) {
        // Добавляем новую задачу в локальный список
        setTasks(prev => [
          ...prev,
          {
            taskId: result.taskId,
            instrumentUid,
            dateFrom,
            dateTo,
            status: 'pending',
          },
        ]);
      } else {
        console.warn('Не удалось создать задачу:', result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Просмотр результата
  const handleViewResult = async (task: CloudTask) => {
    try {
      const api = (window as any).electronAPI;
      if (!api?.cloudGetTaskResult) return;
      const result = await api.cloudGetTaskResult(task.taskId);
      setSelectedTask({ ...task, result });
      setShowResultDialog(true);
    } catch (err) {
      console.error(err);
    }
  };

  const statusBody = (row: CloudTask) => {
    const severityMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
      completed: 'success',
      running: 'warning',
      pending: 'info',
      failed: 'danger',
    };
    return <Tag severity={severityMap[row.status] || 'info'} value={row.status} />;
  };

  const actionBody = (row: CloudTask) => (
    <div className="flex gap-2">
      <Button
        icon="pi pi-eye"
        className="p-button-sm p-button-info p-1"
        tooltip="Просмотреть результат"
        onClick={() => handleViewResult(row)}
        disabled={row.status !== 'completed'}
      />
      <Button
        icon="pi pi-refresh"
        className="p-button-sm p-button-secondary p-1"
        tooltip="Обновить статус"
        onClick={async () => {
          const api = (window as any).electronAPI;
          const updated = await api.cloudGetTaskStatus(row.taskId);
          setTasks(prev => prev.map(t => t.taskId === row.taskId ? { ...t, status: updated.status, error: updated.error } : t));
        }}
      />
    </div>
  );

  return (
    <div className="p-2">
      <Card className="surface-ground p-2 mb-3">
        <h4 className="p-mb-2">Облачный бэктест (24/7)</h4>

        {/* Настройки сервера */}
        <div className="flex align-items-center flex-wrap gap-3 mb-3">
          <div className="flex align-items-center gap-2">
            <label className="mb-0">URL сервера</label>
            <InputText
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              className="p-inputtext-sm"
              style={{ width: '250px' }}
            />
          </div>
          <Button
            label="Тест соединения"
            icon="pi pi-link"
            onClick={handleTestConnection}
            className="p-button-sm p-button-secondary p-1 px-3"
          />
          {testResult && <span className={`text-sm ${testResult.startsWith('Ошибка') ? 'text-red-500' : 'text-green-500'}`}>{testResult}</span>}
        </div>

        {/* Параметры задачи (быстрый запуск) */}
        <div className="flex align-items-center flex-wrap gap-2 mb-3">
          <label className="mr-1 mb-0">Instr</label>
          <InputText
            value={instrumentUid}
            onChange={e => setInstrumentUid(e.target.value)}
            className="p-inputtext-sm"
            style={{ width: '200px' }}
          />
          <label className="mr-1 mb-0">From</label>
          <InputText
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="p-inputtext-sm"
            style={{ width: '130px' }}
          />
          <label className="mr-1 mb-0">To</label>
          <InputText
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="p-inputtext-sm"
            style={{ width: '130px' }}
          />
          <label className="mr-1 mb-0">Int</label>
          <Dropdown
            value={intervalValue}
            options={['CANDLE_INTERVAL_1_MIN', 'CANDLE_INTERVAL_5_MIN', 'CANDLE_INTERVAL_HOUR']}
            onChange={e => setIntervalValue(e.value)}
            className="p-inputtext-sm"
            style={{ width: '160px' }}
          />
          <label className="mr-1 mb-0">Strat</label>
          <Dropdown
            value={strategy}
            options={['volume_accumulation', 'trend', 'poc_pullback', 'daily_va_return']}
            onChange={e => setStrategy(e.value)}
            className="p-inputtext-sm"
            style={{ width: '140px' }}
          />
          <label className="mr-1 mb-0">SL%</label>
          <InputNumber
            value={stopLoss}
            onValueChange={e => setStopLoss(e.value ?? 0)}
            step={0.1} min={0} size={2} className="p-inputtext-sm"
          />
          <label className="mr-1 mb-0">TP%</label>
          <InputNumber
            value={takeProfit}
            onValueChange={e => setTakeProfit(e.value ?? 0)}
            step={0.1} min={0} size={2} className="p-inputtext-sm"
          />
          <Button
            label="Отправить в облако"
            icon="pi pi-cloud-upload"
            onClick={handleCreateTask}
            disabled={loading}
            className="p-button-sm p-1 px-3"
          />
        </div>
      </Card>

      {/* Таблица задач */}
      {tasks.length > 0 && (
        <Card className="surface-ground p-2">
          <h5 className="p-mb-2">Задачи ({tasks.length})</h5>
          <DataTable value={tasks} className="p-datatable-sm" stripedRows responsiveLayout="scroll" style={{ fontSize: '0.85rem' }}>
            <Column field="taskId" header="ID" body={(row) => row.taskId.slice(-8)} />
            <Column field="instrumentUid" header="Инструмент" body={(row) => row.instrumentUid.slice(0,12)} />
            <Column field="dateFrom" header="Период" body={(row) => `${row.dateFrom} – ${row.dateTo}`} />
            <Column field="status" header="Статус" body={statusBody} />
            <Column field="error" header="Ошибка" body={(row) => row.error && <Tag severity="warning" value={row.error} />} />
            <Column body={actionBody} header="Действия" style={{ minWidth: '100px' }} />
          </DataTable>
        </Card>
      )}

      {/* Диалог просмотра результата */}
      <Dialog
        header={`Результат задачи ${selectedTask?.taskId?.slice(-8)}`}
        visible={showResultDialog}
        style={{ width: '700px' }}
        onHide={() => setShowResultDialog(false)}
      >
        {selectedTask?.result ? (
          <pre style={{ maxHeight: '400px', overflow: 'auto', fontSize: '0.85rem', color: '#d1d4dc' }}>
            {JSON.stringify(selectedTask.result, null, 2)}
          </pre>
        ) : (
          <p>Нет данных</p>
        )}
      </Dialog>
    </div>
  );
};