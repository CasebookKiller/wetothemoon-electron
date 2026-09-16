// src/components/SIETCH/DangerZoneDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';

export type DangerMode = 'tables' | 'dumps' | 'both';

export interface DangerZoneDialogProps {
  visible: boolean;
  onHide: () => void;
  onSuccess?: () => void | Promise<void>;
}

export const DangerZoneDialog: React.FC<DangerZoneDialogProps> = ({
  visible,
  onHide,
  onSuccess,
}) => {
  const api = (window as any).electronAPI;
  const [mode, setMode] = useState<DangerMode>('tables');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('tables');
      setConfirmText('');
      setMessage('');
    }
  }, [visible]);

  const submit = async () => {
    if (confirmText.trim() !== 'УДАЛИТЬ') {
      setMessage('Введите слово УДАЛИТЬ заглавными буквами');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'tables' || mode === 'both') {
        const res = await api.clearAllTables();
        if (!res.success) {
          setMessage(`Ошибка очистки таблиц: ${res.error}`);
          return;
        }
      }
      if (mode === 'dumps' || mode === 'both') {
        const res = await api.deleteAllDumps();
        if (!res.success) {
          setMessage(`Ошибка удаления дампов: ${res.error}`);
          return;
        }
        if (res.errors?.length) {
          console.warn('Ошибки удаления некоторых дампов:', res.errors);
        }
      }
      setMessage('Готово');
      if (onSuccess) await onSuccess();
      setTimeout(onHide, 800);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      style={{ width: '560px' }}
      modal
      onHide={onHide}
      header={
        <span
          className="p-panel-title"
          style={{ color: 'var(--tg-theme-destructive-text-color, #ec3942)' }}
        >
          <i className="pi pi-exclamation-octagon mr-2" />
          Опасная зона
        </span>
      }
      footer={
        <div className="p-panel-footer flex justify-content-end gap-2">
          <Button
            label="Отмена"
            icon="pi pi-times"
            className="osint-soft"
            onClick={onHide}
            disabled={loading}
          />
          <Button
            label={loading ? 'Выполняется...' : 'Выполнить'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
            className="osint-destructive"
            onClick={submit}
            disabled={loading || confirmText.trim() !== 'УДАЛИТЬ'}
          />
        </div>
      }
    >
      <div className="p-fluid">
        <div
          className="p-3 border-round mb-3 flex align-items-start gap-2"
          style={{
            background: 'rgba(236, 57, 66, 0.08)',
            border: '1px solid rgba(236, 57, 66, 0.4)',
          }}
        >
          <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec3942' }} />
          <div className="text-sm">
            <b>Операция необратима.</b> Отмены и восстановления не будет.
            Перед выполнением убедитесь, что сделали резервную копию базы
            или сохранили нужные дампы.
          </div>
        </div>

        <div className="field">
          <label className="font-bold mb-2">Что очистить:</label>
          <div className="flex flex-column gap-2">
            <label className="flex align-items-center gap-2">
              <input
                type="radio"
                name="dangerMode"
                value="tables"
                checked={mode === 'tables'}
                onChange={() => setMode('tables')}
                disabled={loading}
              />
              <span>
                <b>Только таблицы БД</b>
                <div className="text-sm text-500">
                  Удалятся все записи из entities, relations, observations, sources,
                  raw_dumps, audit_log, shards. Файлы дампов останутся на диске.
                </div>
              </span>
            </label>

            <label className="flex align-items-center gap-2">
              <input
                type="radio"
                name="dangerMode"
                value="dumps"
                checked={mode === 'dumps'}
                onChange={() => setMode('dumps')}
                disabled={loading}
              />
              <span>
                <b>Только файлы дампов</b>
                <div className="text-sm text-500">
                  Удалятся все .msgpack-файлы из raw_dumps. Записи в таблицах БД
                  сохранятся, но ссылки на файлы будут битыми.
                </div>
              </span>
            </label>

            <label className="flex align-items-center gap-2">
              <input
                type="radio"
                name="dangerMode"
                value="both"
                checked={mode === 'both'}
                onChange={() => setMode('both')}
                disabled={loading}
              />
              <span>
                <b>И таблицы, и дампы</b>
                <div className="text-sm text-500">
                  Полная очистка. Приложение вернётся в исходное состояние.
                </div>
              </span>
            </label>
          </div>
        </div>

        <div className="field mt-3">
          <label htmlFor="dangerConfirm" className="font-bold">
            Для подтверждения введите <code>УДАЛИТЬ</code>:
          </label>
          <InputText
            id="dangerConfirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="УДАЛИТЬ"
            disabled={loading}
            className="w-full"
          />
        </div>

        {message && (
          <p className={message.startsWith('Ошибка') ? 'p-error' : 'p-success'}>
            {message}
          </p>
        )}
      </div>
    </Dialog>
  );
};