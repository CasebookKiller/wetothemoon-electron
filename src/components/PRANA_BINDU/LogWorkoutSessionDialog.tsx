// src/components/PRANA_BINDU/LogWorkoutSessionDialog.tsx
//
// Форма ввода факта выполнения тренировки.
//
// Два режима работы:
//   1) planEvent != null — план из plan_events: парсим description,
//      показываем упражнения с полем «Факт», каждое можно пропустить.
//   2) planEvent == null — свободный ввод:
//      • таб «Из каталога» — выбор через CatalogPickerDialog;
//      • таб «Вручную» — textarea + кнопка «Добавить N строк».
//      Строки из обоих источников попадают в общий список ниже.
//
// Пишет в workout_sessions (Melange v18).
//
// UUID-и строк (crypto.randomUUID) живут только в React-state.
// В БД уходят распарсенные поля SessionExercise + rawText для
// текстовых строк (см. core/types.ts).

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
  findProgressionByIcuName,
} from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import type { PlanEventLite } from './PlanEventsPanel';
import type { SessionExercise } from '@/main/services/pranaBindu/core/types';
import {
  CatalogPickerDialog,
  type PickedExercise,
} from './CatalogPickerDialog';

// ==================== Типы ====================

type RowSource = 'plan' | 'catalog' | 'text';

interface Row {
  id: string;
  source: RowSource;
  movementKey: string;
  level?: number;
  label: string;
  target?: string;
  actualText: string;
  isTimeBased: boolean;
  skipped: boolean;
  /** Оригинальная строка пользователя (только для source='text'). */
  rawText?: string;
}

// ==================== Вспомогательные ====================

/** Разбор строки `<sets>x<reps>` или `[r1,r2,…]` или `r1 r2 r3`. */
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
 * Превратить текст тренировки в массив Row.
 * source: 'plan' → actualText пустой (пользователь вводит);
 *         'text' → actualText = target (пользователь подтверждает).
 * rawText заполняется для source='text' (для аудита).
 */
function buildRows(
  text: string,
  source: RowSource,
  fillActual: boolean
): Row[] {
  const parsed = parseWorkoutText(text ?? '');
  const rows: Row[] = [];

  for (const step of parsed.flatSteps) {
    if (!step.label) continue;

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

    let movementKey: string | undefined;
    let level: number | undefined;
    const stripped = step.label.replace(/\s+[WL]\d+\s*$/, '').trim();

    // 1. Прогрессия по точному имени уровня (с учётом aliases).
    //    Вызывается всегда — префикс W/L не обязателен.
    //    Пример: 'Bench Dip' → dips, level=1.
    {
      const found = findLevelByName(stripped);
      if (found) {
        movementKey = found.entry.key;
        level = found.level;
      }
    }

    // 2. Прогрессия по icuName (с учётом aliases прогрессии).
    //    Уровень берём из префикса, если он был.
    if (!movementKey) {
      const canon = findProgressionByIcuName(stripped);
      if (canon) {
        movementKey = canon.key;
        if (step.prefixLevel != null) {
          level = Math.min(step.prefixLevel, canon.levels.length);
        }
      }
    }

    // 3. Named (с учётом aliases).
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
      id: crypto.randomUUID(),
      source,
      movementKey,
      level,
      label: step.label,
      target,
      actualText: fillActual ? (target ?? '') : '',
      isTimeBased,
      skipped: false,
      rawText: source === 'text' ? step.raw : undefined,
    });
  }

  return rows;
}

// ==================== Компонент ====================

interface Props {
  visible: boolean;
  planEvent: PlanEventLite | null;
  /** Используется только в режиме free (без плана). */
  freeDate?: string | null;
  onHide: () => void;
  onSaved: () => void;
}

export const LogWorkoutSessionDialog: React.FC<Props> = ({
  visible,
  planEvent,
  freeDate,
  onHide,
  onSaved,
}) => {
  const api = (window as any).electronAPI;

  // Единый список строк — plan + catalog + text.
  const [rows, setRows] = useState<Row[]>([]);

  // Свободный режим:
  const [freeText, setFreeText] = useState('');

  // Общие поля:
  const [rpe, setRpe] = useState<number | null>(7);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);

  // Сброс при открытии
  useEffect(() => {
    if (!visible) return;
    if (planEvent) {
      const description = (planEvent as any).description ?? '';
      setRows(buildRows(description, 'plan', false));
    } else {
      setRows([]);
    }
    setFreeText('');
    setRpe(7);
    setNotes('');
    setError('');
    setInfo('');
    setCatalogPickerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, planEvent?.id, freeDate]);

  const isFreeMode = !planEvent;

  // Счётчики
  const filledCount = useMemo(
    () => rows.filter((r) => r.actualText.trim().length > 0 && !r.skipped).length,
    [rows]
  );
  const unknownCount = useMemo(
    () => rows.filter((r) => r.movementKey === 'unknown').length,
    [rows]
  );

  // Превью того, что даст textarea (для кнопки «Добавить N строк»).
  const pendingTextRows = useMemo(() => {
    if (!isFreeMode || !freeText.trim()) return [];
    return buildRows(freeText, 'text', true);
  }, [freeText, isFreeMode]);

  // --------- Действия со строками ---------

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleSkip = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, skipped: !r.skipped } : r))
    );
  };

  const handleCatalogPick = (items: PickedExercise[]) => {
    setRows((prev) => [
      ...prev,
      ...items.map<Row>((it) => ({
        id: crypto.randomUUID(),
        source: 'catalog',
        movementKey: it.movementKey,
        level: it.level,
        label: it.label,
        actualText: '',
        isTimeBased: it.isTimeBased,
        skipped: false,
      })),
    ]);
  };

  // Список ключей уже добавленных в сессию упражнений (только catalog).
  // Формат совпадает с тем, что использует CatalogPickerDialog:
  //   progression:<key>:<level>  или  named:<key>
  const alreadyPickedIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.source !== 'catalog') continue;
      if (r.level !== undefined) {
        set.add(`progression:${r.movementKey}:${r.level}`);
      } else {
        set.add(`named:${r.movementKey}`);
      }
    }
    return set;
  }, [rows]);

  const handleAddFromText = () => {
    if (pendingTextRows.length === 0) return;
    setRows((prev) => [...prev, ...pendingTextRows]);
    setFreeText('');
  };

  // --------- Сохранение ---------

  const handleSave = async () => {
    if (rows.length === 0) {
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
      const exercises: SessionExercise[] = rows.map((r) => {
        const sets = parseActualSets(r.actualText);
        return {
          movementKey: r.movementKey,
          level: r.level,
          target: r.target,
          actualSets: sets,
          isTimeBased: r.isTimeBased,
          skipped: r.skipped || sets == null,
          rawText: r.rawText,
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

  // --------- Рендер ---------

  const title = planEvent
    ? `Записать факт · ${planEvent.name}`
    : `Записать факт · ${freeDate ?? ''}`;

  return (
    <Dialog
      visible={visible}
      onHide={saving ? () => {} : onHide}
      header={title}
      style={{ width: '720px', maxWidth: '96vw' }}
      modal
      className="pb-debug-dialog pb-log-workout-dialog"
    >
      <div className="pb-debug__body">
        {/* Свободный режим: две опции одновременно */}
        {isFreeMode && (
          <>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <Button
                label="Выбрать из каталога"
                icon="pi pi-book"
                className="pb-soft p-button-sm"
                onClick={() => setCatalogPickerOpen(true)}
                disabled={saving}
              />
              <span className="pb-hint">
                Добавить упражнение выбором из каталога
              </span>
            </div>

            <div className="pb-log-workout-dialog__hint pb-hint">
              …или введите упражнения вручную, каждое с новой строки
              (формат — как в ICU):
              <br />
              <code>Push-ups W3 3x10</code> ·{' '}
              <code>Squats W2 3x15</code> · <code>Plank 30s</code>
            </div>
            <InputTextarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={3}
              className="pb-log-workout-dialog__free-input"
              placeholder={'Push-ups W3 3x10\nSquats W2 3x15\nPlank 30s'}
              disabled={saving}
            />
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginTop: '-0.4rem',
              }}
            >
              <Button
                label={
                  pendingTextRows.length > 0
                    ? `Добавить ${pendingTextRows.length} ${
                        pendingTextRows.length === 1 ? 'строку' : 'строк'
                      }`
                    : 'Добавить в список'
                }
                icon="pi pi-plus"
                className="pb-soft p-button-sm"
                onClick={handleAddFromText}
                disabled={saving || pendingTextRows.length === 0}
              />
              {pendingTextRows.length > 0 && (
                <span className="pb-hint">
                  Будет распознано: {pendingTextRows.length}
                </span>
              )}
            </div>
          </>
        )}

        {/* Общий список строк */}
        {rows.length > 0 ? (
          <div className="pb-log-workout-dialog__list">
            {rows.map((r) => (
              <div
                key={r.id}
                className={`pb-log-workout-dialog__row ${
                  r.skipped ? 'is-skipped' : ''
                }`}
              >
                <div className="pb-log-workout-dialog__row-main">
                  <div className="pb-log-workout-dialog__row-name">
                    {r.source === 'plan' && (
                      <i
                        className="pi pi-list"
                        title="Из плана"
                        style={{ marginRight: '0.35rem', opacity: 0.6 }}
                      />
                    )}
                    {r.source === 'catalog' && (
                      <i
                        className="pi pi-book"
                        title="Из каталога"
                        style={{ marginRight: '0.35rem', opacity: 0.6 }}
                      />
                    )}
                    {r.source === 'text' && (
                      <i
                        className="pi pi-pencil"
                        title="Введено вручную"
                        style={{ marginRight: '0.35rem', opacity: 0.6 }}
                      />
                    )}
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
                    updateRow(r.id, { actualText: e.target.value })
                  }
                  placeholder={r.isTimeBased ? '30 25 20' : '3x10 или 12 10 8'}
                  className="pb-log-workout-dialog__row-input"
                  disabled={saving || r.skipped}
                />

                {r.source === 'plan' ? (
                  <Button
                    icon={r.skipped ? 'pi pi-replay' : 'pi pi-ban'}
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => toggleSkip(r.id)}
                    disabled={saving}
                    tooltip={r.skipped ? 'Вернуть' : 'Пропустить'}
                    tooltipOptions={{ position: 'left' }}
                  />
                ) : (
                  <Button
                    icon="pi pi-trash"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => deleteRow(r.id)}
                    disabled={saving}
                    tooltip="Удалить"
                    tooltipOptions={{ position: 'left' }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="pb-drawer__empty">
            {planEvent
              ? 'В плане не найдено упражнений'
              : 'Список пуст. Добавьте упражнения из каталога или вручную.'}
          </div>
        )}

        {/* Баннер unknown — не блокирует сохранение */}
        {unknownCount > 0 && (
          <Message
            severity="warn"
            className="w-full"
            content={
              <span>
                {unknownCount}{' '}
                {unknownCount === 1 ? 'строка не распознана' : 'строк не распознано'}{' '}
                — сохранятся без привязки к каталогу.
              </span>
            }
          />
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

        {error && <Message severity="error" text={error} className="w-full" />}
        {info && <Message severity="success" text={info} className="w-full" />}

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
                : `Сохранить (${filledCount} из ${rows.length})`
            }
            icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="pb p-button-sm"
            onClick={handleSave}
            disabled={saving || rows.length === 0}
          />
        </div>
      </div>

      <CatalogPickerDialog
        visible={catalogPickerOpen}
        onHide={() => setCatalogPickerOpen(false)}
        onPick={handleCatalogPick}
        alreadyPickedIds={alreadyPickedIds}
      />
    </Dialog>
  );
};