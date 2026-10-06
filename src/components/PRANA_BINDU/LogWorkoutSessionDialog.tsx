// src/components/PRANA_BINDU/LogWorkoutSessionDialog.tsx
//
// Форма ввода факта выполнения тренировки.
// Два режима:
//   1) planEvent != null — план из plan_events: парсим description,
//      показываем упражнения с полем «факт».
//   2) planEvent == null — свободный ввод: пользователь набирает
//      строки в ICU-формате, каждая становится упражнением,
//      actualText по умолчанию = target.
// Пишет в workout_sessions (Melange v18).

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { parseWorkoutText } from '@/main/services/pranaBindu/mentat/workoutParser';
import {
  findLevelByName,
  findNamedByName,
} from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import type { PlanEventLite } from './PlanEventsPanel';
import type { SessionExercise } from '@/main/services/pranaBindu/core/types';

interface Props {
  visible: boolean;
  planEvent: PlanEventLite | null;
  /** Используется только в режиме free (без плана). */
  freeDate?: string | null;
  onHide: () => void;
  onSaved: () => void;
}

interface Row {
  movementKey: string;
  level?: number;
  target?: string;
  label: string;
  actualText: string;
  isTimeBased: boolean;
}

// ==================== Вспомогательные ====================

/** Разбор строки `<sets>x<reps>` или `[r1,r2,…]`. */
function parseActualSets(text: string): number[] | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (m) {
    const sets = Number(m[1]);
    const reps = Number(m[2]);
    if (sets > 0 && reps > 0) return Array(sets).fill(reps);
  }
  const cleaned = t.replace(/[\[\]]/g, '');
  const parts = cleaned
    .split(/[,\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parts.length > 0 ? parts : undefined;
}

/**
 * Общая логика: превратить ParsedWorkout → Row[].
 * Используется и для режима плана, и для свободного ввода.
 * initialActual — если true, заполняем actualText = target
 * (для свободного режима: пользователь подтверждает «как план»).
 */
function buildRows(text: string, initialActual: boolean): Row[] {
  const parsed = parseWorkoutText(text ?? '');
  const rows: Row[] = [];

  for (const step of parsed.flatSteps) {
    if (!step.label) continue;

    // Целевая метрика
    let target: string | undefined;
    if (step.sets != null && step.reps != null) {
      if (Array.isArray(step.reps)) {
        target = `[${step.reps.join(',')}]`;
      } else {
        target = `${step.sets}×${step.reps}`;
      }
    } else if (step.durationSec) {
      target = `${step.durationSec}s`;
    } else if (step.distanceM) {
      target = `${step.distanceM}mtr`;
    }

    // Определяем movementKey
    let movementKey: string | undefined;
    let level: number | undefined;
    const stripped = step.label.replace(/\s+[WL]\d+\s*$/, '').trim();

    if (step.prefixKind && step.prefixLevel != null) {
      const found = findLevelByName(stripped);
      if (found) {
        movementKey = found.entry.key;
        level = found.level;
      }
    }
    if (!movementKey) {
      const named = findNamedByName(stripped);
      if (named) movementKey = named.key;
    }
    if (!movementKey) movementKey = 'unknown';

    const isTimeBased =
      step.sets == null &&
      (step.durationSec ?? 0) > 0 &&
      step.distanceM == null;

    rows.push({
      movementKey,
      level,
      target,
      label: step.label,
      actualText: initialActual ? (target ?? '') : '',
      isTimeBased,
    });
  }

  return rows;
}

// ==================== Компонент ====================

export const LogWorkoutSessionDialog: React.FC<Props> = ({
  visible,
  planEvent,
  freeDate,
  onHide,
  onSaved,
}) => {
  const api = (window as any).electronAPI;

  const [planRows, setPlanRows] = useState<Row[]>([]);
  const [freeText, setFreeText] = useState('');
  const [freeOverrides, setFreeOverrides] = useState<Record<number, string>>(
    {}
  );
  const [rpe, setRpe] = useState<number | null>(7);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Сброс при открытии
  useEffect(() => {
    if (!visible) return;
    if (planEvent) {
      const description = (planEvent as any).description ?? '';
      setPlanRows(buildRows(description, false));
      setFreeText('');
    } else {
      setPlanRows([]);
      setFreeText('');
    }
    setFreeOverrides({});
    setRpe(7);
    setNotes('');
    setError('');
    setInfo('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, planEvent?.id, freeDate]);

  // Активные строки: из плана или из свободного ввода
  const activeRows: Row[] = useMemo(() => {
    if (planEvent) return planRows;
    const base = buildRows(freeText, true);
    return base.map((r, idx) => ({
      ...r,
      actualText: freeOverrides[idx] ?? r.actualText,
    }));
  }, [planEvent, planRows, freeText, freeOverrides]);

  const filledCount = useMemo(
    () => activeRows.filter((r) => r.actualText.trim().length > 0).length,
    [activeRows]
  );

  const updateRow = (idx: number, patch: Partial<Row>) => {
    if (planEvent) {
      setPlanRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
      );
    } else if (patch.actualText !== undefined) {
      setFreeOverrides((prev) => ({ ...prev, [idx]: patch.actualText! }));
    }
  };

  const handleSave = async () => {
    if (activeRows.length === 0) {
      setError('Нет упражнений для сохранения');
      return;
    }
    const date = planEvent?.date ?? freeDate;
    if (!date) {
      setError('Не указана дата');
      return;
    }

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const exercises: SessionExercise[] = activeRows.map((r) => {
        const sets = parseActualSets(r.actualText);
        return {
          movementKey: r.movementKey,
          level: r.level,
          target: r.target,
          actualSets: sets,
          isTimeBased: r.isTimeBased,
          skipped: sets == null,
        };
      });

      const payload = {
        date,
        startTime: planEvent?.startTime ?? null,
        planEventId: planEvent?.id ?? null,
        programKey: planEvent
          ? (planEvent as any).generatorProgramKey ?? null
          : null,
        generatorCategory: planEvent
          ? (planEvent as any).generatorCategory ?? null
          : null,
        exercises,
        rpe,
        isTest: false,
        notes: notes.trim() || null,
      };

      const res = await api.pb.createWorkoutSession(payload);
      if (res?.success) {
        setInfo('Сохранено');
        onSaved();
        setTimeout(() => onHide(), 500);
      } else {
        setError(res?.error ?? 'Ошибка сохранения');
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
      onHide={saving ? () => {} : onHide}
      header={
        planEvent
          ? `Записать факт · ${planEvent.name}`
          : `Записать факт · ${freeDate ?? ''}`
      }
      style={{ width: '680px' }}
      modal
      className="pb-debug-dialog pb-log-workout-dialog"
    >
      <div className="pb-debug__body">
        {/* Режим свободного ввода: textarea сверху */}
        {!planEvent && (
          <>
            <div className="pb-log-workout-dialog__hint pb-hint">
              Введите упражнения, каждое с новой строки. Формат —
              как в ICU:
              <br />
              <code>Push-ups W3 3x10</code> · <code>Squats W2 3x15</code> ·{' '}
              <code>Plank 30s</code>
            </div>
            <InputTextarea
              value={freeText}
              onChange={(e) => {
                setFreeText(e.target.value);
                // При изменении textarea — сбрасываем overrides,
                // иначе индексы разъедутся.
                setFreeOverrides({});
              }}
              rows={5}
              className="pb-log-workout-dialog__free-input"
              placeholder={'Push-ups W3 3x10\nSquats W2 3x15\nPlank 30s'}
              disabled={saving}
            />
          </>
        )}

        {/* Список упражнений */}
        {activeRows.length > 0 && (
          <div className="pb-log-workout-dialog__list">
            {activeRows.map((r, idx) => (
              <div key={idx} className="pb-log-workout-dialog__row">
                <div className="pb-log-workout-dialog__row-main">
                  <div className="pb-log-workout-dialog__row-name">
                    {r.label}
                  </div>
                  {r.target && (
                    <div className="pb-log-workout-dialog__row-target">
                      Цель: {r.target}
                    </div>
                  )}
                </div>
                <InputText
                  value={r.actualText}
                  onChange={(e) =>
                    updateRow(idx, { actualText: e.target.value })
                  }
                  placeholder={r.isTimeBased ? '30 25 20' : '3x10 или 12 10 8'}
                  className="pb-log-workout-dialog__row-input"
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        )}

        {activeRows.length === 0 && planEvent && (
          <div className="pb-drawer__empty">
            В плане не найдено упражнений
          </div>
        )}

        {/* RPE */}
        <div className="pb-log-workout-dialog__footer-row">
          <span className="pb-log-workout-dialog__footer-label">RPE:</span>
          <InputNumber
            value={rpe}
            onValueChange={(e) => setRpe(e.value ?? null)}
            min={1}
            max={10}
            showButtons
            buttonLayout="horizontal"
            incrementButtonIcon="pi pi-plus"
            decrementButtonIcon="pi pi-minus"
            className="pb-debug__input"
            disabled={saving}
          />
          <span className="pb-hint">1 — очень легко, 10 — до отказа</span>
        </div>

        {/* Notes */}
        <InputTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="pb-log-workout-dialog__notes"
          placeholder="Заметка (необязательно)"
          disabled={saving}
        />

        {error && (
          <Message severity="error" text={error} className="w-full" />
        )}
        {info && (
          <Message severity="success" text={info} className="w-full" />
        )}

        <div className="flex gap-2 justify-content-end mt-3">
          <Button
            label="Отмена"
            icon="pi pi-times"
            className="pb-soft p-button-sm"
            onClick={onHide}
            disabled={saving}
          />
          <Button
            label={
              saving
                ? 'Сохранение…'
                : `Сохранить (${filledCount} из ${activeRows.length})`
            }
            icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="pb p-button-sm"
            onClick={handleSave}
            disabled={saving || activeRows.length === 0}
          />
        </div>
      </div>
    </Dialog>
  );
};