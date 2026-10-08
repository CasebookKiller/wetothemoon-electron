// src/components/PRANA_BINDU/CheckLevelDialog.tsx
//
// Диалог проверки уровня пользователя по движению из каталога.
// Пользователь делает один подход до комфортного максимума,
// вводит reps (или "3x50" / "50 48 45"), система:
//   1) сохраняет запись в workout_sessions с isTest: true;
//   2) сравнивает reps с ladder текущего уровня;
//   3) обновляет exercise_progress (level / rung);
//   4) если достигнут целевой rung — предлагает level++.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { findProgressionsByKey } from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import type { SessionExercise } from '@/main/services/pranaBindu/core/types';

interface Props {
  visible: boolean;
  /** Список movement_key, по которым можно пройти тест. */
  movementKeys: string[];
  onHide: () => void;
  onSaved: () => void;
}

interface LadderPart {
  sets: number;
  reps: number;
  raw: string;
  /** true → reps — это секунды удержания, sets = 1. */
  isTime: boolean;
}

/** Разбор одного элемента ladder: '1×10', '2×25', '3×50'. */
function parseLadderStep(raw: string): LadderPart | null {
  // Reps-based: '3×10', '1×5'
  const m1 = raw.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (m1) {
    return {
      sets: Number(m1[1]),
      reps: Number(m1[2]),
      raw,
      isTime: false,
    };
  }
  // Time-based: '30s', '60s', '120s'
  const m2 = raw.match(/^(\d+)\s*s$/i);
  if (m2) {
    return {
      sets: 1,
      reps: Number(m2[1]),
      raw,
      isTime: true,
    };
  }
  return null;
}

/** Разбор фактического ввода: '3x50' или '50 48 45' или '50'. */
function parseActualSets(text: string): number[] | null {
  const t = text.trim();
  if (!t) return null;
  // '3x10'
  const m = t.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (m) {
    const sets = Number(m[1]);
    const reps = Number(m[2]);
    if (sets > 0 && reps > 0) return Array(sets).fill(reps);
  }
  // '10 8 6' или '30 25 20' или '30s 25s'
  const cleaned = t
    .replace(/[\[\]]/g, '')
    .replace(/s\b/gi, '');
  const parts = cleaned
    .split(/[,\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parts.length > 0 ? parts : null;
}

/** Какому rung соответствует фактическая сумма reps. */
function detectRung(
  ladder: LadderPart[],
  actual: number[]
): { rung: number; achievedTarget: boolean } {
  const actualSum = actual.reduce((s, n) => s + n, 0);
  let bestRung = 0;
  for (let i = 0; i < ladder.length; i++) {
    const targetSum = ladder[i].isTime
      ? ladder[i].reps // целевое время в секундах
      : ladder[i].sets * ladder[i].reps;
    if (actualSum >= targetSum) bestRung = i + 1;
  }
  const lastIdx = ladder.length - 1;
  const lastTarget = ladder[lastIdx].isTime
    ? ladder[lastIdx].reps
    : ladder[lastIdx].sets * ladder[lastIdx].reps;
  const achievedTarget = bestRung >= ladder.length && actualSum >= lastTarget;
  return { rung: bestRung, achievedTarget };
}


export const CheckLevelDialog: React.FC<Props> = ({
  visible,
  movementKeys,
  onHide,
  onSaved,
}) => {
  const api = (window as any).electronAPI;

  const [movementKey, setMovementKey] = useState<string>(movementKeys[0] ?? '');
  const [level, setLevel] = useState<number>(1);
  const [rung, setRung] = useState<number>(1);
  const [actualText, setActualText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    detectedRung: number;
    achievedTarget: boolean;
    savedId: number | null;
  } | null>(null);

  const options = useMemo(
    () =>
      movementKeys
        .map((k) => {
          const entry = findProgressionsByKey(k);
          return entry
            ? { label: `${entry.label} (${entry.icuName})`, value: k }
            : null;
        })
        .filter(Boolean) as Array<{ label: string; value: string }>,
    [movementKeys]
  );

  useEffect(() => {
    if (!visible) return;
    setResult(null);
    setError('');
    setActualText('');
    if (!movementKey && movementKeys.length > 0) {
      setMovementKey(movementKeys[0]);
      return;
    }
    (async () => {
      if (!movementKey) return;
      try {
        const res = await api.pb.getExerciseProgress(movementKey);
        if (res?.success && res.data) {
          setLevel(res.data.currentLevel);
          setRung(res.data.currentRung);
        } else {
          setLevel(1);
          setRung(1);
        }
      } catch {
        setLevel(1);
        setRung(1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, movementKey]);

  const entry = movementKey
    ? findProgressionsByKey(movementKey)
    : undefined;
  // Wade → W<N>, все остальные категории (cali / runner / core /
  // posture / weightloss) → L<N>. Совпадает с DayDrawer и
  // wadeProgramGenerator.
  const prefix = entry?.category === 'wade' ? 'W' : 'L';
  const levelOptions = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        label: `${prefix}${i + 1}`,
        value: i + 1,
      })),
    [prefix]
  );
  const lvl = entry?.levels.find((l) => l.level === level);
  const rawLadder = lvl?.benchmarkLadder ?? [];
  const ladder: LadderPart[] = rawLadder
    .map(parseLadderStep)
    .filter((x): x is LadderPart => x != null);

  const handleSave = async () => {
    if (!movementKey || !entry) return;
    const isTimeBased = ladder[0]?.isTime ?? false;
    const actual = parseActualSets(actualText);
    if (!actual) {
      setError(
        isTimeBased
          ? 'Укажите время в секундах: например "30" или "30 25 20"'
          : 'Укажите результат: например "3x10" или "10 8 6"'
      );
      return;
    }
    if (ladder.length === 0) {
      setError('Для этого уровня нет reps-ladder (time-based). Тест недоступен.');
      return;
    }
    setSaving(true);
    setError('');
    setResult(null);
    try {
      // Сначала считаем достигнутый rung — нужен и для сессии
      // (снимок «что показал тест»), и для прогресса.
      const { rung: detected, achievedTarget } = detectRung(ladder, actual);

      const exercises: SessionExercise[] = [
        {
          movementKey,
          level,
          // В сессию пишем достигнутый rung, а не текущий из
          // exercise_progress. Иначе в DayDrawer виден «rung до
          // теста», а не «rung после». 0 → 1, чтобы UI не показывал
          // пустой тег (тест мог не дотянуть до первого rung).
          rung: detected > 0 ? detected : 1,
          target: ladder[ladder.length - 1].raw,
          actualSets: actual,
          isTimeBased: isTimeBased,
        },
      ];
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const saveRes = await api.pb.createWorkoutSession({
        date,
        startTime: null,
        planEventId: null,
        programKey: null,
        generatorCategory: 'test',
        exercises,
        rpe: null,
        isTest: true,
        notes: 'Проверка уровня',
      });
      if (!saveRes?.success) {
        setError(saveRes?.error ?? 'Ошибка сохранения теста');
        return;
      }

      const newRung = Math.max(rung, Math.min(detected, ladder.length));
      const newLevel = achievedTarget ? Math.min(level + 1, 10) : level;
      const finalRung = achievedTarget ? 1 : newRung;

      await api.pb.setExerciseProgress(movementKey, newLevel, finalRung);

      setResult({
        detectedRung: detected,
        achievedTarget,
        savedId: saveRes.id ?? null,
      });
      setLevel(newLevel);
      setRung(finalRung);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const closeAndReset = () => {
    setResult(null);
    setActualText('');
    onHide();
  };

  return (
    <Dialog
      visible={visible}
      onHide={saving ? () => {} : closeAndReset}
      header="Проверить уровень"
      style={{ width: '520px' }}
      modal
      className="pb-debug-dialog pb-check-level-dialog"
    >
      <div className="pb-debug__body">
        <div className="pb-log-workout-dialog__hint pb-hint">
          Сделайте один подход до комфортного максимума (не до отказа).
          Введите результат как <code>3x10</code> или <code>10 8 6</code>.
          Система сравнит с целевой ladder и предложит перейти на
          следующий уровень.
        </div>

        <div className="pb-check-level-dialog__row">
          <span className="pb-check-level-dialog__label">Движение:</span>
          <Dropdown
            value={movementKey}
            options={options}
            onChange={(e) => setMovementKey(e.value)}
            className="pb-check-level-dialog__dd"
            panelClassName="pb-dropdown-panel"
            disabled={saving}
          />
        </div>

        {lvl && (
          <div className="pb-check-level-dialog__ladder">
            {/* Выбор уровня */}
            <div className="pb-check-level-dialog__row">
              <span className="pb-check-level-dialog__label">Уровень:</span>
              <Dropdown
                value={level}
                options={levelOptions}
                onChange={(e) => {
                  setLevel(e.value);
                  setResult(null);
                }}
                className="pb-check-level-dialog__dd"
                panelClassName="pb-dropdown-panel"
                disabled={saving}
              />
            </div>

            {/* Название выбранного уровня */}
            <div className="pb-check-level-dialog__row">
              <span className="pb-check-level-dialog__label">Название:</span>
              <span className="pb-check-level-dialog__value">
                {lvl.name}
                {lvl.nameRu ? ` · ${lvl.nameRu}` : ''}
              </span>
            </div>

            {ladder.length > 0 ? (
              <div className="pb-check-level-dialog__row">
                <span className="pb-check-level-dialog__label">Цель:</span>
                <span className="pb-check-level-dialog__value">
                  {ladder.map((p, i) => (
                    <span
                      key={i}
                      className={`pb-check-level-dialog__rung ${
                        i + 1 === rung ? 'is-current' : ''
                      }`}
                    >
                      {p.raw}
                    </span>
                  ))}
                </span>
              </div>
            ) : (
              <div className="pb-check-level-dialog__row">
                <span className="pb-hint">
                  Для этого уровня нет reps-ladder (time-based) — тест
                  недоступен.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="pb-check-level-dialog__row">
          <span className="pb-check-level-dialog__label">Результат:</span>
          <InputText
            value={actualText}
            onChange={(e) => setActualText(e.target.value)}
            placeholder={
              ladder[0]?.isTime
                ? '30 или 30 25 20 (секунды)'
                : '3x10 или 10 8 6'
            }
            className="pb-check-level-dialog__input"
            disabled={saving || ladder.length === 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
        </div>

        {result && (
          <div className="pb-check-level-dialog__result">
            <div className="pb-check-level-dialog__result-line">
              <i className="pi pi-check" /> Сохранено.
              {' '}Определён rung{' '}
              <b>{result.detectedRung}</b> из {ladder.length}.
            </div>
            {result.achievedTarget && (
              <div className="pb-check-level-dialog__result-line pb-check-level-dialog__result-line--success">
                <i className="pi pi-star" /> Целевая ступень достигнута.
                Уровень повышен до <b>{prefix}{level}</b>.
              </div>
            )}
            {!result.achievedTarget && result.detectedRung === 0 && (
              <div className="pb-check-level-dialog__result-line pb-hint">
                Не хватило до первого rung. Продолжайте тренироваться.
              </div>
            )}
          </div>
        )}

        {error && (
          <Message severity="error" text={error} className="w-full" />
        )}

        <div className="flex gap-2 justify-content-end mt-3">
          <Button
            label={result ? 'Закрыть' : 'Отмена'}
            icon={result ? 'pi pi-check' : 'pi pi-times'}
            className="pb-soft p-button-sm"
            onClick={closeAndReset}
            disabled={saving}
          />
          {!result && (
            <Button
              label={saving ? 'Сохранение…' : 'Сохранить результат'}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
              className="pb p-button-sm"
              onClick={handleSave}
              disabled={saving || ladder.length === 0 || !actualText.trim()}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};