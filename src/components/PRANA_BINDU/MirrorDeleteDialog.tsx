// src/components/PRANA_BINDU/MirrorDeleteDialog.tsx
//
// Диалог после sync-plan: показывает локальные ICU-события,
// которых больше нет в ICU. Пользователь галочками выбирает,
// какие удалить. Снятые галочки → local_keep = 1, не всплывут
// в следующий раз.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Checkbox } from 'primereact/checkbox';

export interface StaleCandidate {
  id: number;
  date: string;
  name: string;
  sport: string | null;
}

interface Props {
  visible: boolean;
  candidates: StaleCandidate[];
  rangeFrom: string;
  rangeTo: string;
  busy: boolean;
  onCancel: () => void;
  onApply: (deleteIds: number[], keepIds: number[]) => void;
}

export const MirrorDeleteDialog: React.FC<Props> = ({
  visible,
  candidates,
  busy,
  onCancel,
  onApply,
  rangeFrom,
  rangeTo,
}) => {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (visible) {
      // По умолчанию всё отмечено = «удалить».
      setChecked(new Set(candidates.map((c) => c.id)));
    }
  }, [visible, candidates]);

  const toggle = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    const deleteIds = candidates
      .map((c) => c.id)
      .filter((id) => checked.has(id));
    const keepIds = candidates
      .map((c) => c.id)
      .filter((id) => !checked.has(id));
    onApply(deleteIds, keepIds);
  };

  const deleteCount = checked.size;
  const keepCount = candidates.length - deleteCount;

  return (
    <Dialog
      visible={visible}
      onHide={busy ? () => {} : onCancel}
      header="Осиротевшие события плана"
      style={{ width: '600px' }}
      modal
      className="pb-debug-dialog pb-mirror-delete-dialog"
    >
      <div className="pb-debug__body">
        <div className="pb-mirror-delete-dialog__hint pb-hint">
          За диапазон <b>{rangeFrom}</b> – <b>{rangeTo}</b>. Следующие
          события есть в приложении, но их больше нет в intervals.icu.
          Отметьте, какие <b>удалить</b>. Снятые галочки будут сохранены
          и не всплывут при следующей синхронизации.
        </div>

        <div className="pb-mirror-delete-dialog__list">
          {candidates.map((c) => {
            const isChecked = checked.has(c.id);
            return (
              <label
                key={c.id}
                className={`pb-mirror-delete-dialog__row ${
                  isChecked ? 'is-delete' : 'is-keep'
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onChange={() => toggle(c.id)}
                  disabled={busy}
                />
                <span className="pb-mirror-delete-dialog__date">{c.date}</span>
                <span className="pb-mirror-delete-dialog__name">{c.name}</span>
                {c.sport && (
                  <span className="pb-source-badge pb-source-badge--tcx">
                    {c.sport}
                  </span>
                )}
                <span className="pb-mirror-delete-dialog__action pb-hint">
                  {isChecked ? 'удалить' : 'оставить'}
                </span>
              </label>
            );
          })}
        </div>

        <div className="pb-mirror-delete-dialog__summary">
          Удалить: <b>{deleteCount}</b> · Оставить: <b>{keepCount}</b>
        </div>

        {candidates.length >= 5 && (
          <div className="pb-mirror-delete-dialog__warning">
            <i className="pi pi-exclamation-triangle" />
            <span>
              <b>{candidates.length}</b> событий под удаление — это много.
              Проверьте, что в ICU действительно нет этих тренировок,
              прежде чем применять.
            </span>
          </div>
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
            label={busy ? 'Применение…' : 'Применить'}
            icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="pb p-button-sm"
            onClick={handleApply}
            disabled={busy}
          />
        </div>
      </div>
    </Dialog>
  );
};