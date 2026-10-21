// src/components/PRANA_BINDU/AddPlanEventDialog.tsx
import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';

interface Props {
  visible: boolean;
  onHide: () => void;
  onCreated: () => void;
  defaultDate?: Date;
}

const SPORT_OPTIONS = [
  { label: 'Бег', value: 'Run' },
  { label: 'Силовая / Workout', value: 'Workout' },
];

export const AddPlanEventDialog: React.FC<Props> = ({
  visible,
  onHide,
  onCreated,
  defaultDate,
}) => {
  const [date, setDate] = useState<Date | null>(defaultDate ?? new Date());
  const [sport, setSport] = useState<string>('Workout');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!date || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

      const api = (window as any).electronAPI;
      const res = await api.pb.createPlanEventLocally({
        date: dateIso,
        startTime: `${dateIso}T09:00:00`,
        category: 'WORKOUT',
        sport,
        name: name.trim(),
        description: description.trim(),
      });

      if (!res?.success) {
        setError(res?.error ?? 'Не удалось создать');
        return;
      }
      onCreated();
      onHide();
      setName('');
      setDescription('');
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
      header="Добавить тренировку в план"
      style={{ width: '480px' }}
      modal
      className="pb-debug-dialog"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Дата</label>
          <Calendar
            value={date}
            onChange={(e) => setDate(e.value as Date)}
            dateFormat="dd.mm.yy"
            showIcon
            className="w-full"
          />
        </div>
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Тип</label>
          <Dropdown
            value={sport}
            options={SPORT_OPTIONS}
            onChange={(e) => setSport(e.value)}
            className="w-full"
            panelClassName="pb-dropdown-panel"
          />
        </div>
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Название</label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Силовая — верх тела"
            className="w-full"
          />
        </div>
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Описание</label>
          <InputTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            autoResize
            placeholder="- Отжимания 3×20&#10;- Подтягивания 3×10"
            className="w-full"
          />
        </div>
        {error && <div style={{ color: '#ec3942', fontSize: '0.85rem' }}>{error}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
        <Button label="Отмена" className="pb-soft p-button-sm" onClick={onHide} disabled={saving} />
        <Button label="Сохранить" icon="pi pi-check" className="pb p-button-sm" onClick={handleSave} disabled={!name.trim() || !date || saving} loading={saving} />
      </div>
    </Dialog>
  );
};