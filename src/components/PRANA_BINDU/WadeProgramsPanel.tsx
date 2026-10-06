// src/components/PRANA_BINDU/WadeProgramsPanel.tsx
//
// Третья вкладка в WorkoutTemplatesDialog: программы.
// Wade / Runner / Cali. Пока без IPC — только предпросмотр.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import {
  ALL_PROGRAMS,
  listProgramsByCategory,
  CATEGORY_LABELS,
} from '@/main/services/pranaBindu/mentat/programs';
import type {
  ProgramSpec,
  ProgramCategory,
} from '@/main/services/pranaBindu/mentat/types';
import {
  buildProgramPreview,
  buildEventText,
  listProgramProgressions,
  type MovementState,
} from '@/main/services/pranaBindu/mentat/wadeProgramGenerator';
import { findProgressionsByKey } from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { RadioButton } from 'primereact/radiobutton';
import { Message } from 'primereact/message';

const CATEGORIES: ProgramCategory[] = ['wade', 'runner', 'cali', 'prehab'];

const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  label: `L${i + 1}`,
  value: i + 1,
}));

const RUNG_OPTIONS = [
  { label: 'R1', value: 1 },
  { label: 'R2', value: 2 },
  { label: 'R3', value: 3 },
];

const WEEKS_OPTIONS = [2, 4, 8, 12].map((w) => ({
  label: `${w} нед.`,
  value: w,
}));

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  className?: string;
}

export const WadeProgramsPanel: React.FC<Props> = ({ className }) => {
  const [category, setCategory] = useState<ProgramCategory>('wade');
  const [programKey, setProgramKey] = useState<string>(
    listProgramsByCategory('wade')[0]?.key ?? ALL_PROGRAMS[0].key
  );
  const [states, setStates] = useState<Record<string, MovementState>>({});
  const [weeks, setWeeks] = useState<number>(4);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [conflictPolicy, setConflictPolicy] = useState<'skip' | 'append' | 'replace'>('skip');
  const [target, setTarget] = useState<'local' | 'local+icu'>('local');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState('');
  const [genError, setGenError] = useState('');
  const programsForCat = useMemo(
    () => listProgramsByCategory(category),
    [category]
  );

  const program: ProgramSpec = useMemo(
    () =>
      programsForCat.find((p) => p.key === programKey) ??
      programsForCat[0] ??
      ALL_PROGRAMS[0],
    [programsForCat, programKey]
  );

  // Какие прогрессии есть в программе → показать «Мои уровни».
  const progKeys = useMemo(() => listProgramProgressions(program), [program]);

  // Добавляем дефолтное состояние для новых ключей.
  useEffect(() => {
    setStates((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of progKeys) {
        if (!next[k]) {
          next[k] = { level: 1, rung: 1 };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [progKeys]);

  // При смене категории — переключаем программу на первую из списка.
  useEffect(() => {
    if (!programsForCat.some((p) => p.key === programKey)) {
      setProgramKey(programsForCat[0]?.key ?? '');
    }
  }, [programsForCat, programKey]);

  const preview = useMemo(
    () =>
      buildProgramPreview({
        program,
        states,
        from: todayIso(),
        weeks,
      }),
    [program, states, weeks]
  );

  const updateLevel = (mk: string, level: number) => {
    setStates((prev) => ({ ...prev, [mk]: { ...prev[mk], level } }));
  };
  const updateRung = (mk: string, rung: number) => {
    setStates((prev) => ({ ...prev, [mk]: { ...prev[mk], rung } }));
  };

  return (
    <div className={`pb-wade-programs ${className ?? ''}`}>
      {/* Левая колонка — программы */}
      <div className="pb-wade-programs__left">
        <div className="pb-wade-programs__chips">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`pb-catalog__chip ${
                category === c ? 'is-on' : ''
              }`}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className="pb-catalog__section-title">Программа</div>
        <div className="pb-wade-programs__list">
          {programsForCat.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`pb-wade-programs__item ${
                p.key === program.key ? 'is-active' : ''
              }`}
              onClick={() => setProgramKey(p.key)}
            >
              <div className="pb-wade-programs__item-name">
                {p.name}
                {p.nameRu && (
                  <span className="pb-wade-programs__item-name-ru">
                    {' · '}
                    {p.nameRu}
                  </span>
                )}
              </div>
              <div className="pb-wade-programs__item-desc">
                {p.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Правая колонка — уровни и превью */}
      <div className="pb-wade-programs__right">
        {progKeys.length > 0 ? (
          <>
            <div className="pb-catalog__section-title">Мои уровни</div>
            <div className="pb-wade-programs__states">
              {progKeys.map((mk) => {
                const entry = findProgressionsByKey(mk);
                const st = states[mk] ?? { level: 1, rung: 1 };
                const lvl = entry?.levels.find(
                  (l) => l.level === st.level
                );
                const rungStr = lvl?.benchmarkLadder?.[st.rung - 1];
                const ladder = lvl?.benchmarkLadder;

                return (
                  <div key={mk} className="pb-wade-programs__state">
                    <div className="pb-wade-programs__state-row">
                      <span className="pb-wade-programs__state-name">
                        {entry?.label ?? mk}
                      </span>
                      <Dropdown
                        value={st.level}
                        options={LEVEL_OPTIONS}
                        onChange={(e) => updateLevel(mk, e.value)}
                        className="pb-wade-programs__dd pb-wade-programs__dd--lvl"
                        panelClassName="pb-dropdown-panel"
                      />
                      <Dropdown
                        value={st.rung}
                        options={RUNG_OPTIONS}
                        onChange={(e) => updateRung(mk, e.value)}
                        className="pb-wade-programs__dd pb-wade-programs__dd--rung"
                        panelClassName="pb-dropdown-panel"
                      />
                    </div>
                    <div className="pb-wade-programs__state-hint">
                      {lvl ? (
                        <>
                          <span className="pb-wade-programs__state-lvl-name">
                            {lvl.name}
                            {lvl.nameRu && (
                              <span className="pb-wade-programs__state-lvl-ru">
                                {' · '}
                                {lvl.nameRu}
                              </span>
                            )}
                          </span>
                          {rungStr && (
                            <span className="pb-wade-programs__state-rung">
                              Ступень {st.rung}: {rungStr}
                              {ladder && ladder.length > 1 && (
                                <>
                                  {' · '}
                                  <span className="pb-wade-programs__state-ladder">
                                    {ladder.join(' → ')}
                                  </span>
                                </>
                              )}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="pb-wade-programs__states-empty pb-hint">
            В этой программе нет прогрессий — уровни не нужны.
          </div>
        )}

        <div className="pb-wade-programs__toolbar">
          <span className="pb-label">Горизонт:</span>
          <Dropdown
            value={weeks}
            options={WEEKS_OPTIONS}
            onChange={(e) => setWeeks(e.value)}
            className="pb-wade-programs__dd pb-wade-programs__dd--weeks"
            panelClassName="pb-dropdown-panel"
          />
          <span className="pb-hint">{preview.length} событий</span>
          <Button
            label="Сгенерировать план"
            icon="pi pi-check"
            className="pb p-button-sm"
            disabled={preview.length === 0}
            onClick={() => {
              setGenResult('');
              setGenError('');
              setConfirmVisible(true);
            }}
          />
        </div>

        <div className="pb-catalog__section-title">Предпросмотр</div>
        <div className="pb-wade-programs__preview">
          {preview.length === 0 ? (
            <div className="pb-drawer__empty">Нет событий</div>
          ) : (
            preview.map((ev) => {
              const t = buildEventText(program.name, ev.dayLabel, ev.lines);
              return (
                <div key={ev.date} className="pb-wade-programs__event">
                  <div className="pb-wade-programs__event-head">
                    <span className="pb-wade-programs__event-date">
                      {ev.date}
                    </span>
                    <span className="pb-wade-programs__event-label">
                      {ev.dayLabel}
                    </span>
                  </div>
                  <pre className="pb-wade-programs__event-body">
                    {t.description}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog
        visible={confirmVisible}
        onHide={generating ? () => {} : () => setConfirmVisible(false)}
        header="Сгенерировать план"
        style={{ width: '520px' }}
        modal
        className="pb-debug-dialog"
      >
        <div className="pb-debug__body">
          <div>
            Программа <b>{program.name}</b>, {preview.length} событий с сегодня.
          </div>

          <div className="pb-catalog__section-title">Существующие события</div>
          <div className="pb-wade-programs__radios">
            <label className="pb-wade-programs__radio">
              <RadioButton
                value="skip"
                checked={conflictPolicy === 'skip'}
                onChange={(e) => setConflictPolicy(e.value)}
                disabled={generating}
              />
              <span>Пропустить даты, где уже есть события</span>
            </label>
            <label className="pb-wade-programs__radio">
              <RadioButton
                value="append"
                checked={conflictPolicy === 'append'}
                onChange={(e) => setConflictPolicy(e.value)}
                disabled={generating}
              />
              <span>Добавить рядом (может быть 2 события в день)</span>
            </label>
            <label className="pb-wade-programs__radio">
              <RadioButton
                value="replace"
                checked={conflictPolicy === 'replace'}
                onChange={(e) => setConflictPolicy(e.value)}
                disabled={generating}
              />
              <span>Заменить ранее сгенерированные этой программой</span>
            </label>
          </div>

          <div className="pb-catalog__section-title">Куда добавить</div>
          <div className="pb-wade-programs__radios">
            <label className="pb-wade-programs__radio">
              <RadioButton
                value="local"
                checked={target === 'local'}
                onChange={(e) => setTarget(e.value)}
                disabled={generating}
              />
              <span>Только в приложение</span>
            </label>
            <label className="pb-wade-programs__radio">
              <RadioButton
                value="local+icu"
                checked={target === 'local+icu'}
                onChange={(e) => setTarget(e.value)}
                disabled={generating}
              />
              <span>В приложение и в intervals.icu</span>
            </label>
          </div>

          {genError && (
            <Message severity="error" text={genError} className="w-full" />
          )}
          {genResult && (
            <Message severity="success" text={genResult} className="w-full" />
          )}

          <div className="flex gap-2 justify-content-end mt-3">
            <Button
              label="Отмена"
              icon="pi pi-times"
              className="pb-soft p-button-sm"
              onClick={() => setConfirmVisible(false)}
              disabled={generating}
            />
            <Button
              label={generating ? 'Генерация…' : 'Сгенерировать'}
              icon={generating ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              className="pb p-button-sm"
              onClick={async () => {
                setGenerating(true);
                setGenError('');
                setGenResult('');
                try {
                  const res = await (window as any).electronAPI?.pb?.generateProgram({
                    programKey: program.key,
                    states,
                    from: todayIso(),
                    weeks,
                    conflictPolicy,
                    target,
                  });
                  if (res?.success) {
                    setGenResult(
                      `Готово: создано ${res.created}, ` +
                      `в ICU ${res.pushed}, ` +
                      `пропущено ${res.skipped}` +
                      (res.removed ? `, удалено ${res.removed}` : '') +
                      (res.failed ? `, ошибок ${res.failed}` : '')
                    );
                  } else {
                    setGenError(res?.error ?? 'Ошибка генерации');
                  }
                } catch (e) {
                  setGenError((e as Error).message);
                } finally {
                  setGenerating(false);
                }
              }}
              disabled={generating}
            />
          </div>
        </div>
      </Dialog>

    </div>
  );
};