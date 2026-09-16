// src/components/SIETCH/DatabasePage/DeleteDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';

export type DeleteTargetType = 'entity' | 'relation' | 'observation' | 'source';

export interface DeleteTarget {
  type: DeleteTargetType;
  id: number;
}

export interface DeleteDialogProps {
  visible: boolean;
  target: DeleteTarget | null;
  onHide: () => void;
  onSuccess?: () => void | Promise<void>;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  visible,
  target,
  onHide,
  onSuccess,
}) => {
  const api = (window as any).electronAPI;
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<{ observations?: number; relations?: number } | null>(null);

  useEffect(() => {
    if (visible) {
      setForce(false);
      setMessage('');
      setStats(null);
    }
  }, [visible]);

  const submit = async () => {
    if (!target) return;
    setLoading(true);
    setMessage('');
    try {
      let res: any;
      if (target.type === 'entity') res = await api.deleteEntity(target.id, force);
      else if (target.type === 'relation') res = await api.deleteRelation(target.id);
      else if (target.type === 'observation') res = await api.deleteObservation(target.id);
      else if (target.type === 'source') res = await api.deleteSource(target.id, force);

      if (res?.success) {
        setMessage('Удалено');
        if (onSuccess) await onSuccess();
        setTimeout(onHide, 400);
      } else {
        setMessage(`Ошибка: ${res?.error || 'неизвестная'}`);
        if (res?.stats) setStats(res.stats);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const typeLabel =
    target?.type === 'entity' ? 'сущность'
    : target?.type === 'relation' ? 'связь'
    : target?.type === 'observation' ? 'наблюдение'
    : 'источник';

  const showForce = target?.type === 'entity' || target?.type === 'source';

  return (
    <Dialog
      visible={visible}
      style={{ width: '520px' }}
      modal
      onHide={onHide}
      header={<span className="p-panel-title">Удалить запись</span>}
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
            label={loading ? 'Удаление...' : 'Удалить'}
            icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
            className="osint-destructive"
            onClick={submit}
            disabled={loading}
          />
        </div>
      }
    >
      {target && (
        <div className="p-fluid">
          <p>
            Вы собираетесь <b>безвозвратно удалить</b> {typeLabel}{' '}
            <b>#{target.id}</b>.
          </p>

          {showForce && (
            <div
              className="p-2 border-round mb-3 flex align-items-start gap-2"
              style={{
                background: 'rgba(236, 57, 66, 0.08)',
                border: '1px solid rgba(236, 57, 66, 0.4)',
              }}
            >
              <i className="pi pi-exclamation-triangle mt-1" style={{ color: '#ec3942' }} />
              <div className="text-sm">
                {target.type === 'entity' ? (
                  <>
                    Связанные наблюдения и связи <b>не будут</b> удалены, пока вы
                    не поставите галочку ниже. Иначе удаление будет заблокировано
                    при наличии зависимостей.
                  </>
                ) : (
                  <>
                    Наблюдения и связи, ссылающиеся на этот источник, <b>не будут</b>{' '}
                    удалены — у них будет обнулён <code>source_id</code>, только если
                    вы поставите галочку ниже. Иначе удаление будет заблокировано.
                  </>
                )}
              </div>
            </div>
          )}

          {showForce && (
            <div className="field-checkbox mb-3">
              <input
                type="checkbox"
                id="deleteForce"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor="deleteForce" className="ml-2">
                {target.type === 'entity'
                  ? 'Каскадно удалить все наблюдения и связи этой сущности'
                  : 'Отвязать наблюдения и связи, затем удалить источник'}
              </label>
            </div>
          )}

          {stats && (stats.observations || stats.relations) && (
            <p className="text-sm text-500">
              На запись ссылаются:{' '}
              {stats.observations ? `${stats.observations} наблюдений` : ''}
              {stats.observations && stats.relations ? ', ' : ''}
              {stats.relations ? `${stats.relations} связей` : ''}.
              Поставьте галочку, чтобы удалить каскадно, и повторите.
            </p>
          )}

          {message && (
            <p className={message.startsWith('Ошибка') ? 'p-error' : 'p-success'}>
              {message}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
};