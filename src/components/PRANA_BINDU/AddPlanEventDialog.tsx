// src/components/PRANA_BINDU/AddPlanEventDialog.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';
import { Message } from 'primereact/message';
import {
  CatalogPickerDialog,
  type PickedExercise,
} from './CatalogPickerDialog';
import { formatDuration } from '@/main/services/pranaBindu/mentat/workoutRenderer';

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
  Ride: '- Endurance 60m Z2 HR',
  Swim: '- Easy 1500m Z2 Pace',
  Workout:
    '- Horizontal Pulls W2 3x15 3m Z3 Pace\n- Incline Push-ups W2 3x20 3m Z3 Pace',
};

// ==================== Модель шага ====================

interface PlanStep {
  id: string;
  movementKey: string;
  level?: number;
  label: string;         // "Incline Push-ups W2" — уже с W/L-уровнем
  isTimeBased: boolean;
  sets: number;
  reps: number;
  durationSec: number;
  zone: number;          // 1-5
}

/** Собрать ICU-строку шага из структурных полей. */
function formatStepLine(step: PlanStep): string {
  const parts: string[] = ['-', step.label];
  if (!step.isTimeBased && step.sets > 0 && step.reps > 0) {
    parts.push(`${step.sets}x${step.reps}`);
  }
  if (step.durationSec > 0) {
    parts.push(formatDuration(step.durationSec));
  }
  if (step.zone > 0) {
    parts.push(`Z${step.zone} Pace`);
  }
  return parts.join(' ');
}

function stepsToDescription(steps: PlanStep[]): string {
  if (steps.length === 0) return '';
  return steps.map(formatStepLine).join('\n');
}

// ==================== Компонент ====================

export const AddPlanEventDialog: React.FC<Props> = ({
  visible,
  onHide,
  onCreated,
  defaultDate,
}) => {
  const [date, setDate] = useState<Date | null>(defaultDate ?? new Date());
  const [sport, setSport] = useState<string>('Workout');
  const [name, setName] = useState('');

  // Два источника для description: структурированный (steps) и свободный текст.
  const [workoutMode, setWorkoutMode] = useState<'catalog' | 'text'>('catalog');
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [freeDescription, setFreeDescription] = useState('');

  const [pushToIcu, setPushToIcu] = useState<boolean>(true);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const isWorkout = sport === 'Workout';

  const reset = () => {
    setName('');
    setFreeDescription('');
    setSteps([]);
    setWorkoutMode('catalog');
    setSport('Workout');
    setPushToIcu(true);
    setError('');
    setStatus('');
  };

  // Сброс при открытии
  useEffect(() => {
    if (visible) {
      reset();
      setDate(defaultDate ?? new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Итоговое описание
  const finalDescription = isWorkout
    ? workoutMode === 'catalog'
      ? stepsToDescription(steps)
      : freeDescription
    : freeDescription;

  // alreadyPickedIds для каталога — чтобы не дублировать
  const alreadyPickedIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of steps) {
      if (s.level !== undefined) {
        set.add(`progression:${s.movementKey}:${s.level}`);
      } else {
        set.add(`named:${s.movementKey}`);
      }
    }
    return set;
  }, [steps]);

  // === Handlers ===

  const handleCatalogPick = (items: PickedExercise[]) => {
    const newSteps: PlanStep[] = items.map((it) => ({
      id: crypto.randomUUID(),
      movementKey: it.movementKey,
      level: it.level,
      label: it.label,
      isTimeBased: it.isTimeBased,
      sets: it.isTimeBased ? 1 : 3,
      reps: it.isTimeBased ? 1 : 15,
      durationSec: it.isTimeBased ? 30 : 180,
      zone: it.isTimeBased ? 1 : 3,
    }));
    setSteps((prev) => [...prev, ...newSteps]);
  };

  const updateStep = (id: string, patch: Partial<PlanStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (!date || !name.trim()) return;
    if (!finalDescription.trim()) {
      setError(
        isWorkout && workoutMode === 'catalog'
          ? 'Добавьте хотя бы одно упражнение из каталога'
          : 'Опишите тренировку'
      );
      return;
    }
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const api = (window as any).electronAPI;

      const created = await api.pb.createPlanEventLocally({
        date: dateIso,
        startTime: `${dateIso}T09:00:00`,
        category: 'WORKOUT',
        sport,
        name: name.trim(),
        description: finalDescription.trim(),
      });

      if (!created?.success) {
        setError(created?.error ?? 'Не удалось создать событие');
        return;
      }
      const planEventId: number = created.id;

      if (pushToIcu) {
        setStatus('Отправляем в ICU…');
        const push = await api.pb.pushPlanEvent(planEventId);
        if (!push?.success) {
          setError(
            `Создано локально (#${planEventId}), но ICU не принял: ${push?.error ?? '—'}`
          );
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
      style={{ width: '640px', maxWidth: '96vw' }}
      modal
      className="pb-templates-dialog pb-settings-dialog"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.5rem' }}>
        {/* Дата + Тип — в одну строку */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 12rem', minWidth: '10rem' }}>
            <label
              className="pb-label"
              style={{ display: 'block', marginBottom: '0.35rem' }}
            >
              Дата
            </label>
            <Calendar
              value={date}
              onChange={(e) => setDate(e.value as Date)}
              dateFormat="dd.mm.yy"
              showIcon
              className="pb-cal pb-cal--full"
              disabled={saving}
            />
          </div>

          <div style={{ flex: '1 1 12rem', minWidth: '10rem' }}>
            <label
              className="pb-label"
              style={{ display: 'block', marginBottom: '0.35rem' }}
            >
              Тип
            </label>
            <Dropdown
              value={sport}
              options={SPORT_OPTIONS}
              onChange={(e) => setSport(e.value)}
              className="w-full"
              panelClassName="pb-dropdown-panel"
              disabled={saving}
            />
          </div>
        </div>

        {/* Название */}
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Название</label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isWorkout ? 'Например: Силовая — верх тела' : 'Например: Recovery 45 мин'
            }
            className="w-full"
            disabled={saving}
          />
        </div>

        {/* Упражнения или свободный текст */}
        {isWorkout ? (
          <>
            <div className="pb-templates__mode-switch" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={workoutMode === 'catalog' ? 'is-active' : ''}
                onClick={() => setWorkoutMode('catalog')}
                disabled={saving}
              >
                <i className="pi pi-book" style={{ marginRight: '0.35rem' }} />
                Из каталога
              </button>
              <button
                type="button"
                className={workoutMode === 'text' ? 'is-active' : ''}
                onClick={() => setWorkoutMode('text')}
                disabled={saving}
              >
                <i className="pi pi-pencil" style={{ marginRight: '0.35rem' }} />
                Свободный текст
              </button>
            </div>

            {workoutMode === 'catalog' ? (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Button
                    label="+ Из каталога"
                    icon="pi pi-book"
                    className="pb-soft p-button-sm"
                    onClick={() => setCatalogVisible(true)}
                    disabled={saving}
                  />
                  {steps.length > 0 && (
                    <Button
                      label={`Очистить (${steps.length})`}
                      icon="pi pi-trash"
                      className="pb-soft p-button-sm"
                      onClick={() => setSteps([])}
                      disabled={saving}
                    />
                  )}
                </div>

                {steps.length === 0 ? (
                  <div
                    className="pb-hint"
                    style={{
                      padding: '0.75rem',
                      border: '1px dashed var(--surface-border)',
                      borderRadius: 6,
                      textAlign: 'center',
                    }}
                  >
                    Пока пусто. Нажмите «+ Из каталога», чтобы добавить упражнения.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {steps.map((s) => (
                      <PlanStepRow
                        key={s.id}
                        step={s}
                        onChange={(patch) => updateStep(s.id, patch)}
                        onRemove={() => removeStep(s.id)}
                        disabled={saving}
                      />
                    ))}
                  </div>
                )}

                {steps.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div
                      className="pb-label"
                      style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}
                    >
                      Описание для ICU:
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        color: 'var(--tg-hint)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {finalDescription}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label
                  className="pb-label"
                  style={{ display: 'block', marginBottom: '0.35rem' }}
                >
                  Описание (формат ICU)
                </label>
                <InputTextarea
                  value={freeDescription}
                  onChange={(e) => setFreeDescription(e.target.value)}
                  rows={4}
                  autoResize
                  placeholder={DESCRIPTION_HINTS.Workout}
                  className="w-full"
                  disabled={saving}
                />
                <small
                  className="pb-hint"
                  style={{
                    display: 'block',
                    marginTop: '0.3rem',
                    fontSize: '0.72rem',
                    color: 'var(--tg-hint)',
                  }}
                >
                  Каждый шаг — с новой строки, начиная с <code>-</code>.
                </small>
              </div>
            )}
          </>
        ) : (
          <div>
            <label
              className="pb-label"
              style={{ display: 'block', marginBottom: '0.35rem' }}
            >
              Описание (формат ICU)
            </label>
            <InputTextarea
              value={freeDescription}
              onChange={(e) => setFreeDescription(e.target.value)}
              rows={4}
              autoResize
              placeholder={DESCRIPTION_HINTS[sport] ?? ''}
              className="w-full"
              disabled={saving}
            />
            <small
              className="pb-hint"
              style={{
                display: 'block',
                marginTop: '0.3rem',
                fontSize: '0.72rem',
                color: 'var(--tg-hint)',
              }}
            >
              Каждый шаг — с новой строки, начиная с <code>-</code>.
            </small>
          </div>
        )}

        {/* Push to ICU */}
        <div
          className="flex align-items-center pb-check-row pb-checkbox-dark"
          style={{ cursor: saving ? 'default' : 'pointer' }}
        >
          <Checkbox
            inputId="pushToIcu"
            checked={pushToIcu}
            onChange={(e) => setPushToIcu(!!e.checked)}
            disabled={saving}
          />
          <label
            htmlFor="pushToIcu"
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.85rem',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            Отправить в intervals.icu
          </label>
        </div>

        {status && (
          <div style={{ fontSize: '0.8rem', color: 'var(--tg-hint)' }}>{status}</div>
        )}
        {error && <Message severity="error" text={error} className="w-full" />}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem',
          marginTop: '1.25rem',
        }}
      >
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
          disabled={!name.trim() || !date || saving || !finalDescription.trim()}
          loading={saving}
        />
      </div>

      <CatalogPickerDialog
        visible={catalogVisible}
        onHide={() => setCatalogVisible(false)}
        onPick={handleCatalogPick}
        alreadyPickedIds={alreadyPickedIds}
      />
    </Dialog>
  );
};

// ==================== PlanStepRow ====================

interface PlanStepRowProps {
  step: PlanStep;
  onChange: (patch: Partial<PlanStep>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const PlanStepRow: React.FC<PlanStepRowProps> = ({
  step,
  onChange,
  onRemove,
  disabled,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.45rem 0.6rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 6,
        border: '1px solid var(--surface-border)',
        flexWrap: 'wrap',
      }}
    >
      <i
        className="pi pi-book"
        style={{ color: 'var(--pb-accent)', flexShrink: 0, fontSize: '0.85rem' }}
      />
      <span
        style={{
          flex: '1 1 140px',
          minWidth: '120px',
          fontSize: '0.85rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={step.label}
      >
        {step.label}
      </span>

      {!step.isTimeBased && (
        <>
          <InputNumber
            value={step.sets}
            onValueChange={(e) => onChange({ sets: e.value ?? 1 })}
            min={1}
            max={20}
            showButtons
            buttonLayout="horizontal"
            incrementButtonIcon="pi pi-plus"
            decrementButtonIcon="pi pi-minus"
            inputStyle={{ width: '2.5rem', textAlign: 'center', padding: '0.2rem' }}
            style={{ height: '2rem' }}
            disabled={disabled}
            tooltip="Подходы"
            tooltipOptions={{ position: 'top' }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--tg-hint)' }}>×</span>
          <InputNumber
            value={step.reps}
            onValueChange={(e) => onChange({ reps: e.value ?? 1 })}
            min={1}
            max={200}
            showButtons
            buttonLayout="horizontal"
            incrementButtonIcon="pi pi-plus"
            decrementButtonIcon="pi pi-minus"
            inputStyle={{ width: '3rem', textAlign: 'center', padding: '0.2rem' }}
            style={{ height: '2rem' }}
            disabled={disabled}
            tooltip="Повторы"
            tooltipOptions={{ position: 'top' }}
          />
        </>
      )}

      <InputNumber
        value={step.durationSec}
        onValueChange={(e) => onChange({ durationSec: e.value ?? 30 })}
        min={5}
        max={3600}
        suffix="с"
        inputStyle={{ width: '4rem', textAlign: 'center', padding: '0.2rem' }}
        style={{ height: '2rem' }}
        disabled={disabled}
        tooltip="Общая длительность шага (в секундах)"
        tooltipOptions={{ position: 'top' }}
      />

      <Dropdown
        value={step.zone}
        options={[1, 2, 3, 4, 5].map((z) => ({ label: `Z${z}`, value: z }))}
        onChange={(e) => onChange({ zone: e.value })}
        style={{ width: '5rem', height: '2rem' }}
        panelClassName="pb-dropdown-panel"
        disabled={disabled}
        tooltip="Зона"
        tooltipOptions={{ position: 'top' }}
      />

      <Button
        icon="pi pi-times"
        text
        className="pb-drawer__name-edit"
        onClick={onRemove}
        disabled={disabled}
        tooltip="Удалить"
        tooltipOptions={{ position: 'left' }}
        style={{ width: '2rem', height: '2rem', padding: 0 }}
      />
    </div>
  );
};