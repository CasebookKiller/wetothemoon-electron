// src/components/SIETCH/KadArbitrDialog.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import { KadArbitrCardDialog } from './KadArbitrCardDialog';
import { KadArbitrCasesDialog } from './KadArbitrCasesDialog';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';

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

  const [foundCases, setFoundCases] = useState<any[]>([]);
  const [cardDialogVisible, setCardDialogVisible] = useState(false);
  const [cardDialogUuid, setCardDialogUuid] = useState('');

  const [casesDialogVisible, setCasesDialogVisible] = useState(false);

  const [forceRefresh, setForceRefresh] = useState(false);
  const [fromCache, setFromCache] = useState<string | null>(null);

  const toastRef = useRef<Toast>(null);

  // Синхронизация входного ИНН
  useEffect(() => {
    if (visible) {
      setInn(initialInn);
      setResult('');
      setError('');
      setStats(null);
      setLog([]);
      setFoundCases([]);
      setCardDialogVisible(false);
      setCardDialogUuid('');
      setCasesDialogVisible(false);
      setForceRefresh(false);
      setFromCache(null);
    }
  }, [visible, initialInn]);

  // Прогресс и клик по PDF
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

    const onPdfClick = async (info: { url: string }) => {
      toastRef.current?.show({
        severity: 'info',
        summary: 'Скачивание PDF...',
        detail: 'Запрос через сессию kad.arbitr',
        life: 3000,
      });

      const res = await api.downloadKadDocument(info.url);
      if (res.success) {
        toastRef.current?.show({
          severity: 'success',
          summary: 'PDF скачан',
          detail: `${res.localPath} (${(res.sizeBytes / 1024).toFixed(0)} KB)`,
          life: 6000,
        });
      } else {
        toastRef.current?.show({
          severity: 'error',
          summary: 'Не удалось скачать PDF',
          detail: res.error,
          life: 8000,
        });
      }
    };
    
    api.onKadPdfClicked(onPdfClick);
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
        forceRefresh,                     // ← добавили
      });

      if (res.success) {
        if (res.empty) {
          setResult('Дел не найдено.');
          setFoundCases([]);
          setFromCache(null);
        } else {
          setFoundCases(res.data.cases || []);
          setFromCache(res.fromCache ? res.cachedAt : null);

          if (res.fromCache) {
            setStats(null);
            setResult(
              `Из кеша: ${res.data.cases.length} дел из ${res.data.totals.cases_found}. ` +
              `Данные от ${new Date(res.cachedAt).toLocaleString('ru-RU')}.`
            );
          } else {
            const s = res.stats;
            setStats(s);
            setResult(
              `Найдено дел: ${res.data.cases.length} из ${res.data.totals.cases_found}. ` +
              `Сохранено: сущностей ${s.savedEntities}, связей ${s.savedRelations}, наблюдений ${s.savedObservations}.`
            );
            if (onSaved) onSaved(inn.trim());
          }
        }
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
        {/* Пагинация */}
        {/* Параметры поиска — одной строкой */}
        <div className="flex flex-nowrap align-items-center gap-2">
          <span className="white-space-nowrap">ИНН:</span>
          <InputText
            value={inn}
            onChange={(e) => setInn(e.target.value)}
            placeholder="10 или 12 цифр"
            disabled={running}
            style={{ width: '11rem', height: '2.5rem' }}
          />

          <span className="white-space-nowrap">Стр.:</span>
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
            disabled={running}
            style={{ width: '10rem', height: '2.5rem' }}
            inputStyle={{
              width: '3.2rem',
              minWidth: '3.2rem',
              maxWidth: '3.2rem',
              flex: '0 0 3.2rem',
              padding: '0 0.25rem',
              textAlign: 'center',
              height: '2.5rem',
            }}
          />

          <span className="white-space-nowrap ms-4">Дел:</span>
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
            disabled={running}
            style={{ width: '10rem', height: '2.5rem' }}
            inputStyle={{
              width: '3.2rem',
              minWidth: '3.2rem',
              maxWidth: '3.2rem',
              flex: '0 0 3.2rem',
              padding: '0 0.25rem',
              textAlign: 'center',
              height: '2.5rem',
            }}
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
          <label className="flex align-items-center gap-1">
            <Checkbox
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(!!e.checked)}
              disabled={running}
            />
            <span>Обновить из kad.arbitr (игнорировать кеш)</span>
          </label>
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

        {result && (
          <div className="flex align-items-center gap-3 flex-wrap">
            <p className="p-success" style={{ margin: 0 }}>{result}</p>
            {fromCache && (
              <Tag
                value="из кеша"
                severity="info"
                icon="pi pi-history"
                style={{ fontSize: '0.85rem' }}
              />
            )}
            {foundCases.length > 0 && (
              <Button
                label={`Показать найденные дела (${foundCases.length})`}
                icon="pi pi-table"
                className="osint-soft"
                onClick={() => setCasesDialogVisible(true)}
              />
            )}
          </div>
        )}
        {error && <p className="p-error">Ошибка: {error}</p>}

      </div>

      <KadArbitrCardDialog
        visible={cardDialogVisible}
        caseUuid={cardDialogUuid}
        onHide={() => setCardDialogVisible(false)}
      />

      <KadArbitrCasesDialog
        visible={casesDialogVisible}
        cases={foundCases}
        inn={inn}
        onHide={() => setCasesDialogVisible(false)}
      />

    </Dialog>
  );
};