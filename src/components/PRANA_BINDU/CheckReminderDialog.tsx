// src/components/PRANA_BINDU/CheckReminderDialog.tsx
//
// Напоминание при запуске: «пора проверить уровень».
// Показывается один раз в сутки, если хотя бы одно из
// отслеживаемых движений не тестировалось или тестировалось
// больше N дней назад.
//
// Отслеживаемые категории — в localStorage
// (pb.checkReminder.categories, JSON-массив). По умолчанию
// ['wade']. Пользователь может переключить чипами прямо здесь.

import React from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import type { ExerciseCategory } from '@/main/services/pranaBindu/mentat/types';

interface Props {
  visible: boolean;
  /** Движения, которые пора проверить (label'ы). */
  dueMovements: string[];
  /** Текущий набор отслеживаемых категорий. */
  categories: Set<ExerciseCategory>;
  /** Для каждой категории: { total, testable }. */
  categoryCounts: Record<string, { total: number; testable: number }>;
  onToggleCategory: (c: ExerciseCategory) => void;
  onCheckNow: () => void;
  onLater: () => void;
  onNever: () => void;
}

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  wade: 'Wade',
  cali: 'Cali',
  runner: 'Runner',
  core: 'Кор',
  posture: 'Осанка',
  weightloss: 'HIIT',
  prehab: 'Prehab',
};

export const CheckReminderDialog: React.FC<Props> = ({
  visible,
  dueMovements,
  categories,
  categoryCounts,
  onToggleCategory,
  onCheckNow,
  onLater,
  onNever,
}) => {
  // Все категории, у которых есть прогрессии (из categoryCounts).
  const allCategories: ExerciseCategory[] = (
    Object.keys(categoryCounts) as ExerciseCategory[]
  ).sort((a, b) => {
    // Wade — первым, дальше по алфавиту (для стабильного порядка).
    if (a === 'wade') return -1;
    if (b === 'wade') return 1;
    return a.localeCompare(b);
  });

  return (
    <Dialog
      visible={visible}
      onHide={onLater}
      header="Пора проверить уровень"
      style={{ width: '520px' }}
      modal
      className="pb-debug-dialog pb-check-reminder-dialog"
    >
      <div className="pb-debug__body">
        <div className="pb-check-reminder-dialog__hint pb-hint">
          Регулярные тесты (раз в 4 недели) помогают корректно подбирать
          нагрузку и отслеживать прогресс. Сделайте один подход до
          комфортного максимума для каждого движения.
        </div>

        {/* Чипы категорий */}
        <div className="pb-catalog__section-title">Отслеживать</div>
        <div className="pb-check-reminder-dialog__chips">
          {allCategories.map((c) => {
            const isOn = categories.has(c);
            const counts = categoryCounts[c] ?? { total: 0, testable: 0 };
            if (counts.total === 0) return null;
            const testable = counts.testable;
            const disabled = testable === 0;

            return (
              <button
                key={c}
                type="button"
                className={`pb-catalog__chip ${isOn && !disabled ? 'is-on' : ''} ${
                  disabled ? 'is-disabled' : ''
                }`}
                onClick={() => {
                  if (disabled) return;
                  onToggleCategory(c);
                }}
                disabled={disabled}
                title={
                  disabled
                    ? 'Тесты для этой категории пока не настроены'
                    : `${testable} тестируемых движений`
                }
              >
                {CATEGORY_LABELS[c]} · {testable}
                {testable !== counts.total && `/${counts.total}`}
              </button>
            );
          })}
        </div>

        {dueMovements.length > 0 ? (
          <>
            <div className="pb-catalog__section-title">
              К проверке ({dueMovements.length})
            </div>
            <div className="pb-check-reminder-dialog__list">
              {dueMovements.map((name, i) => (
                <div key={i} className="pb-check-reminder-dialog__item">
                  <i className="pi pi-circle-fill" />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="pb-check-reminder-dialog__empty pb-hint">
            Все движения в отслеживаемых категориях проверены недавно.
          </div>
        )}

        <div className="pb-check-reminder-dialog__actions">
          <Button
            label="Проверить сейчас"
            icon="pi pi-verified"
            className="pb p-button-sm"
            onClick={onCheckNow}
            disabled={dueMovements.length === 0}
          />
          <Button
            label="Позже"
            icon="pi pi-clock"
            className="pb-soft p-button-sm"
            onClick={onLater}
          />
          <Button
            label="Не показывать"
            icon="pi pi-eye-slash"
            className="pb-soft p-button-sm"
            onClick={onNever}
            tooltip="Отключить это напоминание навсегда"
            tooltipOptions={{ position: 'top' }}
          />
        </div>
      </div>
    </Dialog>
  );
};