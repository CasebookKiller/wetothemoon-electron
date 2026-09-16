// src/components/SIETCH/DatabasePage/MarkFalseDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';

export type MarkFalseTable = 'entities' | 'relations' | 'observations';

export interface MarkFalseDialogProps {
  visible: boolean;
  target: { table: MarkFalseTable; id: number } | null;
  onHide: () => void;
  onSuccess?: () => void | Promise<void>;
}

export const MarkFalseDialog: React.FC<MarkFalseDialogProps> = ({
  visible,
  target,
  onHide,
  onSuccess,
}) => {
  const api = (window as any).electronAPI;
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible) {
      setReason('');
      setMessage('');
    }
  }, [visible]);

  const submit = async () => {
    if (!target) return;
    if (!reason.trim()) {
      setMessage('Укажите причину');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await api.markFalse(target.table, target.id, reason.trim());
      if (res.success) {
        setMessage('Запись помечена как ложная');
        if (onSuccess) await onSuccess();
        setTimeout(onHide, 800);
      } else {
        setMessage(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const label =
    target?.table === 'entities' ? 'сущность'
    : target?.table === 'relations' ? 'связь'
    : target?.table === 'observations' ? 'наблюдение'
    : 'запись';

  return (
    <Dialog
      visible={visible}
      style={{ width: '500px' }}
      modal
      onHide={onHide}
      header={<span className="p-panel-title">Пометить {label} как ложную</span>}
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
            label={loading ? 'Отправка...' : 'Пометить'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="osint-destructive"
            onClick={submit}
            disabled={loading || !reason.trim()}
          />
        </div>
      }
    >
      <div className="p-fluid">
        <p className="text-sm text-500">
          Запись <b>#{target?.id}</b> будет помечена как <code>false</code>.
          Причина сохранится в поле <code>notes</code> и в журнале изменений.
        </p>
        <div className="field mt-3">
          <label htmlFor="markFalseReason" className="font-bold">Причина *</label>
          <InputTextarea
            id="markFalseReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoResize
            placeholder="Например: ошибочно сопоставлено с другой организацией"
            className="w-full"
            disabled={loading}
          />
        </div>
        {message && (
          <p className={message.startsWith('Ошибка') ? 'p-error' : 'p-success'}>{message}</p>
        )}
      </div>
    </Dialog>
  );
};