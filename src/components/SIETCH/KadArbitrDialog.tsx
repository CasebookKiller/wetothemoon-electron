// src/components/SIETCH/KadArbitrDialog.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';

export interface KadArbitrDialogProps {
  visible: boolean;
  inn: string;
  onHide: () => void;
  onSaved?: (inn: string) => void;
}

interface ProgressInfo {
  stage: 'session' | 'search' | 'persist';
  message: string;
}

interface Stats {
  savedEntities: number;
  savedRelations: number;
  savedObservations: number;
  targetEntityId: number;
}

const MAX_LOG_LINES = 200;

export const KadArbitrDialog: React.FC<KadArbitrDialogProps> = ({
  visible,
  inn: initialInn,
  onHide,
  onSaved,
}) => {
  const api = (window as any).electronAPI;

  const [inn, setInn] = useState(initialInn);
  const [maxPages, setMaxPages] = useState(5);
  const [maxTotalCases, setMaxTotalCases] = useState(500);
  const [rolePlaintiff, setRolePlaintiff] = useState(false);
  const [roleDefendant, setRoleDefendant] = useState(false);
  const [roleThird, setRoleThird] = useState(false);

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<string>('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  // Синхронизация входного ИНН
  useEffect(() => {
    if (visible) {
      setInn(initialInn);
      setResult('');
      setError('');
      setStats(null);
      setLog([]);
    }
  }, [visible, initialInn]);

  // Прогресс
  useEffect(() => {
    if (!visible) return;
    const onProgress = (info: ProgressInfo) => {
      setLog((prev) => {
        const next = [...prev, info.message];
        return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
      });
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      });
    };
    api.onKadArbitrProgress(onProgress);
    return () => api.removeKadArbitrProgressListener();
  }, [visible]);

  const buildRoles = (): string[] => {
    const roles: string[] = [];
    if (rolePlaintiff) roles.push('plaintiff');
    if (roleDefendant) roles.push('defendant');
    if (roleThird) roles.push('third_party');
    return roles.length > 0 ? roles : ['any'];
  };

  const handleStart = async () => {
    if (!inn.trim()) {
      setError('Введите ИНН');
      return;
    }
    setRunning(true);
    setError('');
    setResult('');
    setStats(null);
    setLog(['Запуск...']);

    try {
      const res = await api.fetchKadArbitrCases(inn.trim(), {
        maxPages,
        maxTotalCases,
        roles: buildRoles(),
      });

      if (res.success) {
        if (res.empty) {
          setResult('Дел не найдено.');
        } else {
          const s = res.stats;
          setStats(s);
          setResult(
            `Найдено дел: ${res.data.cases.length} из ${res.data.totals.cases_found}. ` +
            `Сохранено: сущностей ${s.savedEntities}, связей ${s.savedRelations}, наблюдений ${s.savedObservations}.`
          );
          if (onSaved) onSaved(inn.trim());
        }
      } else {
        setError(res.error || 'Неизвестная ошибка');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      style={{ width: '820px', maxWidth: '95vw' }}
      modal
      onHide={() => { if (!running) onHide(); }}
      header={<span className="p-panel-title">kad.arbitr.ru — сбор дел</span>}
      footer={
        <div className="p-panel-footer flex justify-content-end gap-2">
          <Button
            label={running ? 'Идёт сбор...' : 'Собрать'}
            icon={running ? 'pi pi-spin pi-spinner' : 'pi pi-play'}
            className="osint"
            onClick={handleStart}
            disabled={running}
          />
          <Button
            label="Закрыть"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
            disabled={running}
          />
        </div>
      }
    >
      <div className="flex flex-column gap-3">
        {/* ИНН */}
        <div className="flex align-items-center gap-3 flex-wrap">
          <span className="white-space-nowrap">ИНН:</span>
          <InputText
            value={inn}
            onChange={(e) => setInn(e.target.value)}
            placeholder="10 или 12 цифр"
            disabled={running}
            style={{ width: '16rem' }}
          />
        </div>

        {/* Пагинация */}
        <div className="flex align-items-center gap-3 flex-wrap">
          <span className="white-space-nowrap">Макс. страниц:</span>
          <InputNumber
            value={maxPages}
            onValueChange={(e) => setMaxPages(e.value ?? 5)}
            min={1}
            max={50}
            showButtons
            buttonLayout="horizontal"
            decrementButtonClassName="osint-soft"
            incrementButtonClassName="osint-soft"
            decrementButtonIcon="pi pi-minus"
            incrementButtonIcon="pi pi-plus"
            inputClassName="text-center"
            disabled={running}
            style={{ width: '10rem' }}
          />
          <span className="white-space-nowrap">Макс. дел:</span>
          <InputNumber
            value={maxTotalCases}
            onValueChange={(e) => setMaxTotalCases(e.value ?? 500)}
            min={25}
            max={5000}
            step={25}
            showButtons
            buttonLayout="horizontal"
            decrementButtonClassName="osint-soft"
            incrementButtonClassName="osint-soft"
            decrementButtonIcon="pi pi-minus"
            incrementButtonIcon="pi pi-plus"
            inputClassName="text-center"
            disabled={running}
            style={{ width: '10rem' }}
          />
        </div>

        {/* Роли */}
        <div className="flex align-items-center gap-3 flex-wrap">
          <span className="white-space-nowrap">Роль:</span>
          <label className="flex align-items-center gap-1">
            <Checkbox
              checked={rolePlaintiff}
              onChange={(e) => setRolePlaintiff(!!e.checked)}
              disabled={running}
            />
            <span>Истец</span>
          </label>
          <label className="flex align-items-center gap-1">
            <Checkbox
              checked={roleDefendant}
              onChange={(e) => setRoleDefendant(!!e.checked)}
              disabled={running}
            />
            <span>Ответчик</span>
          </label>
          <label className="flex align-items-center gap-1">
            <Checkbox
              checked={roleThird}
              onChange={(e) => setRoleThird(!!e.checked)}
              disabled={running}
            />
            <span>Третье лицо</span>
          </label>
          <span className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
            (не отмечено — любая)
          </span>
        </div>

        {/* Журнал */}
        <div>
          <label className="font-bold">Журнал</label>
          <pre
            ref={logRef}
            className="p-2 border-round text-sm"
            style={{
              background: 'var(--tg-theme-secondary-bg-color)',
              maxHeight: '220px',
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

        {stats && (
          <div
            className="text-sm"
            style={{ color: 'var(--tg-theme-hint-color)' }}
          >
            Сущность #{stats.targetEntityId} · сущностей {stats.savedEntities} · связей{' '}
            {stats.savedRelations} · наблюдений {stats.savedObservations}
          </div>
        )}
      </div>
    </Dialog>
  );
};