// src/components/SIETCH/SensitiveEditDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';

export interface SensitiveRecordMeta {
  id: number;
  entity_id: number;
  field_name: string;
  created_at: string;
  legal_basis: string;
  retention_until: string | null;
  notes: string | null;
}

export interface SensitiveEditDialogProps {
  visible: boolean;
  record: SensitiveRecordMeta | null;
  onHide: () => void;
  onSuccess?: () => void | Promise<void>;
}

export const SensitiveEditDialog: React.FC<SensitiveEditDialogProps> = ({
  visible,
  record,
  onHide,
  onSuccess,
}) => {
  const api = (window as any).electronAPI;

  const [newValue, setNewValue] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [retentionUntil, setRetentionUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'info' | 'error' | 'success'>('info');

  useEffect(() => {
    if (!visible || !record) return;
    setNewValue('');
    setLegalBasis(record.legal_basis || '');
    setRetentionUntil(record.retention_until || '');
    setNotes(record.notes || '');
    setLoading(false);
    setMessage('');
    setMessageKind('info');
  }, [visible, record]);

  const submit = async () => {
    if (!record) return;
    if (!legalBasis.trim()) {
      setMessage('Основание хранения не может быть пустым');
      setMessageKind('error');
      return;
    }

    setLoading(true);
    setMessage('Сохранение…');
    setMessageKind('info');

    try {
      const payload: any = {
        id: record.id,
        legal_basis: legalBasis.trim(),
        retention_until: retentionUntil || null,
        notes: notes || null,
      };

      // Если пользователь ввёл значение — включаем его в payload (перешифрование).
      // Если пусто — не передаём, метаданные обновятся без затрагивания ciphertext.
      if (newValue.trim()) {
        payload.field_value = newValue;
      }

      const res = await api.sensitiveUpdate(payload);
      if (res.success) {
        const note = newValue.trim()
          ? 'Значение перешифровано новой IV.'
          : 'Значение не менялось.';
        setMessage(`Сохранено. ${note}`);
        setMessageKind('success');
        if (onSuccess) await onSuccess();
        setTimeout(onHide, 1000);
      } else {
        setMessage(`Ошибка: ${res.error || 'неизвестная'}`);
        setMessageKind('error');
      }
    } catch (e) {
      setMessage(`Ошибка: ${(e as Error).message}`);
      setMessageKind('error');
    } finally {
      setLoading(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog
      visible={visible}
      style={{ width: '620px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={
        <span className="p-panel-title">
          <i className="pi pi-pencil mr-2" />
          Редактировать sensitive-запись #{record.id}
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
            label={loading ? 'Сохранение…' : 'Сохранить'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="osint"
            onClick={submit}
            disabled={loading || !legalBasis.trim()}
          />
        </div>
      }
    >
      <div className="p-fluid">
        <div
          className="p-3 border-round mb-3 flex align-items-start gap-2"
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
          }}
        >
          <i className="pi pi-info-circle mt-1" style={{ color: '#3b82f6' }} />
          <div className="text-sm">
            <b>Поле:</b> <code>{record.field_name}</code> · <b>Сущность:</b>{' '}
            <code>#{record.entity_id}</code>. <br />
            Чтобы <b>изменить зашифрованное значение</b> — заполните поле «Новое значение».
            Если оставить его пустым — значение останется прежним, изменятся только
            метаданные.
          </div>
        </div>

        <div className="field">
          <label htmlFor="sensEditValue" className="font-bold">
            Новое значение
          </label>
          <InputTextarea
            id="sensEditValue"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            rows={2}
            autoResize
            placeholder="Оставьте пустым, чтобы не менять"
            className="w-full"
            disabled={loading}
          />
        </div>

        <div className="field">
          <label htmlFor="sensEditLegal" className="font-bold">
            Основание хранения *
          </label>
          <InputText
            id="sensEditLegal"
            value={legalBasis}
            onChange={(e) => setLegalBasis(e.target.value)}
            placeholder="Например: служебная необходимость, согласие субъекта"
            className="w-full"
            disabled={loading}
          />
        </div>

        <div className="field">
          <label htmlFor="sensEditRetention" className="font-bold">
            Хранить до
          </label>
          <InputText
            id="sensEditRetention"
            type="date"
            value={retentionUntil}
            onChange={(e) => setRetentionUntil(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="field">
          <label htmlFor="sensEditNotes" className="font-bold">
            Заметки
          </label>
          <InputTextarea
            id="sensEditNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            autoResize
            className="w-full"
            disabled={loading}
          />
        </div>

        {message && (
          <p
            className={
              messageKind === 'error'
                ? 'p-error'
                : messageKind === 'success'
                ? 'p-success'
                : ''
            }
          >
            {message}
          </p>
        )}
      </div>
    </Dialog>
  );
};