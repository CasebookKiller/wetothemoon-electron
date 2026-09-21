// src/components/SIETCH/JudgesCollectionDialog.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { InputNumber } from 'primereact/inputnumber';

export interface JudgesCollectionDialogProps {
  visible: boolean;
  onHide: () => void;
}

interface ProgressInfo {
  prefix: string;
  status: string;
  itemsFound: number;
  totalDone: number;
  totalPending: number;
  judgesTotal: number;
  courtsTotal: number;
}

const MAX_LOG_LINES = 300;

export const JudgesCollectionDialog: React.FC<JudgesCollectionDialogProps> = ({
  visible,
  onHide,
}) => {
  const api = (window as any).electronAPI;

  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [stats, setStats] = useState<{ judges: number; courts: number } | null>(null);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  // Загружаем текущие цифры при открытии
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const res = await api.getJudgesStats();
        if (res.success) setStats({ judges: res.judges, courts: res.courts });
      } catch {
        // ignore
      }
    })();
  }, [visible]);

  // Подписка на прогресс
  useEffect(() => {
    if (!visible) return;

    const onProgress = (info: ProgressInfo) => {
      setProgress(info);
      setLog((prev) => {
        const line = `[${info.prefix}] ${info.itemsFound} записей · судей всего: ${info.judgesTotal} · судов: ${info.courtsTotal} · в очереди: ${info.totalPending}`;
        const next = [...prev, line];
        return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
      });
      // автоскролл
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      });
    };

    api.onJudgesProgress(onProgress);
    return () => api.removeJudgesProgressListener();
  }, [visible]);

  const handleStart = async () => {
    setRunning(true);
    setError('');
    setResult('');
    setLog(['Обход запущен...']);
    setProgress(null);

    try {
      const res = await api.scrapeJudgesDirectory({ ratePerSecond: rate });
      if (res.success) {
        setResult(
          `Готово: судей ${res.judgesTotal}, судов ${res.courtsTotal}, запросов ${res.requests}.`
        );
        setStats({ judges: res.judgesTotal, courts: res.courtsTotal });
      } else {
        setError(res.error || 'Неизвестная ошибка');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const handleStop = async () => {
    try {
      await api.stopJudgesDirectory();
      setLog((prev) => [...prev, 'Запрошена остановка...']);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRefreshStats = async () => {
    try {
      const res = await api.getJudgesStats();
      if (res.success) setStats({ judges: res.judges, courts: res.courts });
    } catch {
      // ignore
    }
  };

  return (
    <Dialog
      visible={visible}
      style={{ width: '860px', maxWidth: '95vw' }}
      modal
      onHide={() => { if (!running) onHide(); }}
      header={<span className="p-panel-title">Справочник судей kad.arbitr</span>}
      footer={
        <div className="p-panel-footer flex flex-column gap-2">
          {stats && (
            <div className="text-sm flex align-items-center gap-2">
              <span>
                Судей: <b>{stats.judges}</b> · Судов: <b>{stats.courts}</b>
              </span>
              <Button
                icon="pi pi-refresh"
                className="osint-soft p-button-sm p-button-text"
                tooltip="Обновить счётчики"
                tooltipOptions={{ position: 'top' }}
                onClick={handleRefreshStats}
              />
            </div>
          )}
          <div className="flex justify-content-end gap-2">
            {running ? (
              <Button
                label="Стоп"
                icon="pi pi-stop"
                className="osint-destructive"
                onClick={handleStop}
              />
            ) : (
              <Button
                label="Старт"
                icon="pi pi-play"
                className="osint"
                onClick={handleStart}
              />
            )}
            <Button
              label="Закрыть"
              icon="pi pi-times"
              className="osint-soft"
              onClick={onHide}
              disabled={running}
            />
          </div>
        </div>
      }
    >
      <div className="flex flex-column gap-3">
        <div className="flex align-items-center gap-3 flex-wrap">
          <span className="white-space-nowrap">Скорость (запросов/сек):</span>
          <InputNumber
            value={rate}
            onValueChange={(e) => setRate(e.value || 1)}
            min={0.2}
            max={5}
            step={0.2}
            showButtons
            buttonLayout="horizontal"
            decrementButtonClassName="osint-soft"
            incrementButtonClassName="osint-soft"
            decrementButtonIcon="pi pi-minus"
            incrementButtonIcon="pi pi-plus"
            inputClassName="text-center"
            disabled={running}
            style={{ width: '11rem' }}
          />
          
        </div>
        <div
          className="text-sm"
          style={{ color: 'var(--tg-theme-hint-color)' }}
        >
          При 1/сек обход ~30–60 минут. Не торопите — риск капчи.
        </div>

        {progress && (
          <div className="flex flex-column gap-1">
            <div className="flex justify-content-between text-sm">
              <span>
                Префикс: <b>{progress.prefix}</b>
              </span>
              <span>
                В очереди: <b>{progress.totalPending}</b> · Готово: <b>{progress.totalDone}</b>
              </span>
            </div>
            <ProgressBar
              value={Math.min(
                100,
                Math.round((progress.totalDone / (progress.totalDone + progress.totalPending || 1)) * 100)
              )}
              pt={{
                value: {
                  style: { background: 'var(--tg-theme-accent-text-color)' },
                },
                label: {
                  style: { color: 'var(--tg-theme-bg-color)', fontWeight: 600 },
                },
              }}
            />
          </div>
        )}

        <div>
          <label className="font-bold">Журнал</label>
          <pre
            ref={logRef}
            className="p-2 border-round text-sm"
            style={{
              background: 'var(--tg-theme-secondary-bg-color)',
              maxHeight: '320px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {log.length === 0 ? 'Ожидание запуска...' : log.join('\n')}
          </pre>
        </div>

        {result && <p className="p-success">{result}</p>}
        {error && <p className="p-error">Ошибка: {error}</p>}
      </div>
    </Dialog>
  );
};