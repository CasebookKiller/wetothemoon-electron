// src/components/PRANA_BINDU/AddPlanEventDialog.tsx
import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';
import { Message } from 'primereact/message';

interface Props {
  visible: boolean;
  onHide: () => void;
  onCreated: () => void;
  defaultDate?: Date;
}

const SPORT_OPTIONS = [
  { label: 'Бег', value: 'Run' },
  { label: 'Силовая / Workout', value: 'Workout' },
  { label: 'Велосипед', value: 'Ride' },
  { label: 'Плавание', value: 'Swim' },
];

const DESCRIPTION_HINTS: Record<string, string> = {
  Run: '- Recovery run 45m Z1 HR Z1 Pace\n- Interval 4x800m Z4 Pace 2m Z1 Pace',
  Workout:
    '- Horizontal Pulls W2 3x15 3m Z3 Pace\n- Push-ups W3 3x20 3m Z3 Pace\n- Hanging Knee Raises W5 3x10 3m Z3 Pace',
  Ride: '- Endurance 60m Z2 HR',
  Swim: '- Easy 1500m Z2 Pace',
};

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
  const [pushToIcu, setPushToIcu] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const reset = () => {
    setName('');
    setDescription('');
    setSport('Workout');
    setPushToIcu(true);
    setError('');
    setStatus('');
  };

  const handleSave = async () => {
    if (!date || !name.trim()) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const api = (window as any).electronAPI;

      // 1. Создаём локально
      const created = await api.pb.createPlanEventLocally({
        date: dateIso,
        startTime: `${dateIso}T09:00:00`,
        category: 'WORKOUT',
        sport,
        name: name.trim(),
        description: description.trim(),
      });

      if (!created?.success) {
        setError(created?.error ?? 'Не удалось создать событие');
        return;
      }
      const planEventId: number = created.id;

      // 2. Если нужно — пушим в ICU
      if (pushToIcu) {
        setStatus('Отправляем в ICU…');
        const push = await api.pb.pushPlanEvent(planEventId);
        if (!push?.success) {
          setError(`Создано локально (#${planEventId}), но ICU не принял: ${push?.error ?? '—'}`);
          onCreated();
          return;
        }
        setStatus(`Готово: ICU #${push.icuId} (${push.action})`);
      } else {
        setStatus(`Готово: локальное событие #${planEventId}`);
      }

      onCreated();
      setTimeout(() => {
        reset();
        onHide();
      }, 700);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      onHide={() => {
        if (!saving) {
          reset();
          onHide();
        }
      }}
      header="Добавить тренировку в план"
      style={{ width: '520px' }}
      modal
      className="pb-templates-dialog pb-settings-dialog"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.5rem' }}>
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Дата</label>
          <Calendar
            value={date}
            onChange={(e) => setDate(e.value as Date)}
            dateFormat="dd.mm.yy"
            showIcon
            className="pb-cal pb-cal--full"
            disabled={saving}
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
            disabled={saving}
          />
        </div>

        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Название</label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              sport === 'Run' ? 'Например: Recovery 45 мин' : 'Например: Силовая — верх тела'
            }
            className="w-full"
            disabled={saving}
          />
        </div>

        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Описание
            {pushToIcu && <span className="pb-hint" style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>(формат ICU)</span>}
          </label>
          <InputTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            autoResize
            placeholder={DESCRIPTION_HINTS[sport] ?? ''}
            className="w-full"
            disabled={saving}
          />
          {pushToIcu && (
            <small className="pb-hint" style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.72rem', color: 'var(--tg-hint)' }}>
              ICU распарсит описание в шаги. Каждый шаг — с новой строки, начиная с <code>-</code>.
            </small>
          )}
        </div>

        <div className="flex align-items-center pb-check-row pb-checkbox-dark" style={{ cursor: saving ? 'default' : 'pointer' }}>
          <Checkbox
            inputId="pushToIcu"
            checked={pushToIcu}
            onChange={(e) => setPushToIcu(!!e.checked)}
            disabled={saving}
          />
          <label htmlFor="pushToIcu" style={{ marginLeft: '0.5rem', fontSize: '0.85rem', cursor: saving ? 'default' : 'pointer' }}>
            Отправить в intervals.icu
          </label>
        </div>

        {status && <div style={{ fontSize: '0.8rem', color: 'var(--tg-hint)' }}>{status}</div>}
        {error && <Message severity="error" text={error} className="w-full" />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
        <Button
          label="Отмена"
          className="pb-soft p-button-sm"
          onClick={() => {
            if (!saving) {
              reset();
              onHide();
            }
          }}
          disabled={saving}
        />
        <Button
          label={pushToIcu ? 'Создать и отправить' : 'Создать локально'}
          icon={pushToIcu ? 'pi pi-cloud-upload' : 'pi pi-check'}
          className="pb p-button-sm"
          onClick={handleSave}
          disabled={!name.trim() || !date || saving}
          loading={saving}
        />
      </div>
    </Dialog>
  );
};