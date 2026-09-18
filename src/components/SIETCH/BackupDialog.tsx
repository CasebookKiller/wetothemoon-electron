// src/components/SIETCH/BackupDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';

export interface BackupDialogProps {
  visible: boolean;
  onHide: () => void;
}

export const BackupDialog: React.FC<BackupDialogProps> = ({ visible, onHide }) => {
  const api = (window as any).electronAPI;

  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [includeRawDumps, setIncludeRawDumps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'info' | 'error' | 'success'>('info');

  useEffect(() => {
    if (!visible) return;
    setIncludeSensitive(false);
    setIncludeRawDumps(false);
    setLoading(false);
    setMessage('');
    setMessageKind('info');
  }, [visible]);

  const submit = async () => {
    setLoading(true);
    setMessage('Создание backup…');
    setMessageKind('info');

    try {
      const res = await api.backupCreate({
        includeSensitive,
        includeRawDumps,
      });

      if (res?.canceled) {
        // Пользователь закрыл диалог выбора папки — молча выходим
        setLoading(false);
        onHide();
        return;
      }

      if (!res?.success) {
        setMessage(`Ошибка: ${res?.error || 'неизвестная'}`);
        setMessageKind('error');
        return;
      }

      const parts: string[] = [];
      if (res.files?.osintDb) parts.push('osint_data.db');
      if (res.files?.sensitiveDb) parts.push('sensitive_data.db');
      if (res.files?.rawDumpsCount > 0) {
        parts.push(`raw_dumps (${res.files.rawDumpsCount} файлов)`);
      }

      setMessage(`Готово: ${res.backupDir}\nСодержимое: ${parts.join(', ') || '(пусто)'}`);
      setMessageKind('success');
    } catch (e) {
      setMessage(`Ошибка: ${(e as Error).message}`);
      setMessageKind('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      style={{ width: '620px', maxWidth: '95vw' }}
      modal
      onHide={onHide}
      header={
        <span className="p-panel-title">
          <i className="pi pi-save mr-2" />
          Создание backup
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
            label={loading ? 'Создание...' : 'Сделать backup'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
            className="osint"
            onClick={submit}
            disabled={loading}
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
            Backup сохраняется в выбранную папку в подкаталог с датой.
            Перед восстановлением приложение нужно перезапустить.
          </div>
        </div>

        <div className="field">
          <label className="font-bold mb-2">Что включить в backup:</label>
          <div className="flex flex-column gap-3">

            <label className="flex align-items-start gap-2">
              <input
                type="checkbox"
                checked={true}
                readOnly
                disabled
                style={{ marginTop: 4 }}
              />
              <span>
                <b>Основная БД <code>osint_data.db</code></b>
                <div className="text-sm text-500">
                  Сущности, связи, наблюдения, источники, журнал изменений.
                  Всегда включено.
                </div>
              </span>
            </label>

            <label className="flex align-items-start gap-2">
              <input
                type="checkbox"
                checked={includeSensitive}
                onChange={(e) => setIncludeSensitive(e.target.checked)}
                disabled={loading}
                style={{ marginTop: 4 }}
              />
              <span>
                <b>Sensitive vault <code>sensitive_data.db</code></b>
                <div className="text-sm text-500">
                  Зашифрованная БД чувствительных записей. Файл
                  <code> sensitive_passphrase.dat </code>
                  в backup не входит — для восстановления потребуется
                  ввести фразу заново.
                </div>
              </span>
            </label>

            <label className="flex align-items-start gap-2">
              <input
                type="checkbox"
                checked={includeRawDumps}
                onChange={(e) => setIncludeRawDumps(e.target.checked)}
                disabled={loading}
                style={{ marginTop: 4 }}
              />
              <span>
                <b>Сырые дампы <code>raw_dumps/</code></b>
                <div className="text-sm text-500">
                  MessagePack-файлы собранных страниц. Копирование может
                  занять продолжительное время и несколько гигабайт на диске.
                </div>
              </span>
            </label>

          </div>
        </div>

        {includeSensitive && (
          <div
            className="p-3 border-round mt-2 flex align-items-start gap-2"
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
            }}
          >
            <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#f59e0b' }} />
            <div className="text-sm">
              <b>Внимание:</b> backup содержит зашифрованные данные.
              При восстановлении на другом устройстве потребуется
              ввести sensitive-фразу заново.
            </div>
          </div>
        )}

        {message && (
          <pre
            className={
              messageKind === 'error'
                ? 'p-error'
                : messageKind === 'success'
                ? 'p-success'
                : ''
            }
            style={{
              whiteSpace: 'pre-wrap',
              margin: '0.75rem 0 0 0',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
            }}
          >
            {message}
          </pre>
        )}
      </div>
    </Dialog>
  );
};