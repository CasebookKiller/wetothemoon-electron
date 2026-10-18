import React, { useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { InputNumber } from 'primereact/inputnumber';

interface Props {
  visible: boolean;
  initialName: string;
  onHide: () => void;
  onSaved: (movementKey: string, level?: number) => void;
}

const CATALOGS = [
  { label: 'Smithrun (Кузница)', value: 'smithrun' },
  { label: 'Wade', value: 'wade' },
  { label: 'Cali', value: 'cali' },
];

const TYPES = [
  { label: 'Одиночное упражнение (Named)', value: 'named' },
  { label: 'Новая группа прогрессий (Progression)', value: 'progression' },
];

export const AddUnknownExerciseDialog: React.FC<Props> = ({
  visible,
  initialName,
  onHide,
  onSaved,
}) => {
  const api = (window as any).electronAPI;
  const [name, setName] = useState(initialName);
  const [catalog, setCatalog] = useState('smithrun');
  const [type, setType] = useState<'named' | 'progression'>('named');
  const [groupName, setGroupName] = useState('');
  const [level, setLevel] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Сброс при открытии
  React.useEffect(() => {
    if (visible) {
      setName(initialName);
      setGroupName('');
      setLevel(1);
      setError('');
      setType('named');
      setCatalog('smithrun');
    }
  }, [visible, initialName]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (type === 'progression' && !groupName.trim()) {
      setError('Укажите название группы прогрессий');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await api.pb.addCustomExercise({
        name: name.trim(),
        catalog,
        type,
        groupName: groupName.trim() || name.trim(),
        level,
      });

      if (res.success) {
        onSaved(res.movementKey, res.level);
        onHide();
      } else {
        setError(res.error ?? 'Ошибка сохранения');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Добавить в каталог"
      style={{ width: '450px' }}
      modal
      className="pb-debug-dialog"
    >
      <div className="pb-debug__body">
        <div className="flex flex-column gap-2">
          <label className="pb-label">Название упражнения</label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex flex-column gap-2 mt-3">
          <label className="pb-label">Каталог</label>
          <Dropdown
            value={catalog}
            options={CATALOGS}
            onChange={(e) => setCatalog(e.value)}
            className="w-full pb-wade-programs__dd"
          />
        </div>

        <div className="flex flex-column gap-2 mt-3">
          <label className="pb-label">Тип</label>
          <Dropdown
            value={type}
            options={TYPES}
            onChange={(e) => setType(e.value)}
            className="w-full pb-wade-programs__dd"
          />
        </div>

        {type === 'progression' && (
          <>
            <div className="flex flex-column gap-2 mt-3">
              <label className="pb-label">Название группы (например, "Приседания")</label>
              <InputText
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Введите название группы..."
                className="w-full"
              />
            </div>
            <div className="flex flex-column gap-2 mt-3">
              <label className="pb-label">Уровень (1-10)</label>
              <InputNumber
                value={level}
                onValueChange={(e) => setLevel(e.value ?? 1)}
                min={1}
                max={10}
                showButtons
                buttonLayout="horizontal"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                className="pb-debug__input"
              />
              <small className="pb-hint">
                Если группа уже есть в каталоге, уровень добавится к ней.
              </small>
            </div>
          </>
        )}

        {error && <Message severity="error" text={error} className="w-full mt-3" />}

        <div className="flex justify-content-end gap-2 mt-4">
          <Button
            label="Отмена"
            className="pb-soft p-button-sm"
            onClick={onHide}
            disabled={saving}
          />
          <Button
            label={saving ? 'Сохранение...' : 'Сохранить'}
            className="pb p-button-sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          />
        </div>
      </div>
    </Dialog>
  );
};