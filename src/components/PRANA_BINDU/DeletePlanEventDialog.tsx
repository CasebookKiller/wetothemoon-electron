// src/components/PRANA_BINDU/DeletePlanEventDialog.tsx
//
// Диалог удаления plan_event. Если событие связано с ICU —
// даёт выбор: только в приложении / везде.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';

export type DeleteScope = 'local' | 'both';

interface Props {
  visible: boolean;
  eventName: string;
  isRemote: boolean;
  remoteId?: string | null;
  busy: boolean;
  onCancel: () => void;
  onDelete: (scope: DeleteScope) => void;
}

export const DeletePlanEventDialog: React.FC<Props> = ({
  visible,
  eventName,
  isRemote,
  remoteId,
  busy,
  onCancel,
  onDelete,
}) => {
  const [scope, setScope] = useState<DeleteScope>('local');

  useEffect(() => {
    if (visible) setScope(isRemote ? 'both' : 'local');
  }, [visible, isRemote]);

  return (
    <Dialog
      visible={visible}
      onHide={busy ? () => {} : onCancel}
      header="Удалить событие?"
      style={{ width: '460px' }}
      modal
      className="pb-debug-dialog pb-delete-plan-dialog"
    >
      <div className="pb-debug__body">
        <div className="pb-delete-plan-dialog__question">
          Удалить «{eventName}»?
        </div>

        {!isRemote && (
          <div className="pb-delete-plan-dialog__hint pb-hint">
            Событие существует только в приложении. Будет удалено локально.
          </div>
        )}

        {isRemote && (
          <>
            <div className="pb-delete-plan-dialog__hint pb-hint">
              Событие связано с intervals.icu
              {remoteId ? ` (#${remoteId})` : ''}.
            </div>
            <div className="pb-delete-plan-dialog__options">
              <label
                className={`pb-delete-plan-dialog__option ${
                  scope === 'local' ? 'is-selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name="delete-scope"
                  value="local"
                  checked={scope === 'local'}
                  onChange={() => setScope('local')}
                  disabled={busy}
                />
                <span className="pb-delete-plan-dialog__option-body">
                  <span className="pb-delete-plan-dialog__option-title">
                    Только в приложении
                  </span>
                  <span className="pb-delete-plan-dialog__option-desc">
                    Следующая синхронизация плана из ICU вернёт его снова.
                  </span>
                </span>
              </label>

              <label
                className={`pb-delete-plan-dialog__option ${
                  scope === 'both' ? 'is-selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name="delete-scope"
                  value="both"
                  checked={scope === 'both'}
                  onChange={() => setScope('both')}
                  disabled={busy}
                />
                <span className="pb-delete-plan-dialog__option-body">
                  <span className="pb-delete-plan-dialog__option-title">
                    Из ICU и из приложения
                  </span>
                  <span className="pb-delete-plan-dialog__option-desc">
                    Убрать везде — событие больше не вернётся.
                  </span>
                </span>
              </label>
            </div>
          </>
        )}

        <div className="flex gap-2 justify-content-end mt-3">
          <Button
            label="Отмена"
            icon="pi pi-times"
            className="pb-soft p-button-sm"
            onClick={onCancel}
            disabled={busy}
          />
          <Button
            label={busy ? 'Удаление…' : 'Удалить'}
            icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
            className="pb-destructive p-button-sm"
            onClick={() => onDelete(isRemote ? scope : 'local')}
            disabled={busy}
          />
        </div>
      </div>
    </Dialog>
  );
};