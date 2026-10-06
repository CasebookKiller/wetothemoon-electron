// src/components/PRANA_BINDU/PlanEventDrawer.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { WorkoutTimeline, type TimelineStep } from './WorkoutTimeline';
import type { PlanEventLite } from './PlanEventsPanel';
import { parseWorkoutText } from '@/main/services/pranaBindu/mentat/workoutParser';
import {
  DeletePlanEventDialog,
  type DeleteScope,
} from './DeletePlanEventDialog';
import { LogWorkoutSessionDialog } from './LogWorkoutSessionDialog';

interface Props {
  visible: boolean;
  event: PlanEventLite | null;
  onHide: () => void;
  onSaved: () => void;
}

interface StepShape {
  type?: string;
  duration?: number;
  distance?: number;
  hrZone?: number;
  paceZone?: number;
  powerZone?: number;
  reps?: number;
  label?: string;
}

function fmtSec(s: number): string {
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}ч ${String(m).padStart(2, '0')}м`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${m}м`;
  }
  return `${s}с`;
}

function fmtDistance(m?: number): string {
  if (m == null || m <= 0) return '';
  if (m >= 1000) return `${(m / 1000).toFixed(2)} км`;
  return `${Math.round(m)} м`;
}

/** Приводит любое представление зоны к числу 1..7. */
function parseZoneValue(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string') {
    const m = v.trim().match(/^Z?(\d+)$/i);
    if (m) {
      const n = Number(m[1]);
      return n > 0 ? n : undefined;
    }
  }
  return undefined;
}

function extractZone(s: any): number | undefined {
  return (
    parseZoneValue(s?.hrZone) ??
    parseZoneValue(s?.paceZone) ??
    parseZoneValue(s?.powerZone) ??
    parseZoneValue(s?.hr?.value) ??
    parseZoneValue(s?.pace?.value) ??
    parseZoneValue(s?.power?.value) ??
    parseZoneValue(s?.target?.value) ??
    parseZoneValue(s?.target?.zone) ??
    parseZoneValue(s?.zone) ??
    undefined
  );
}

function extractLabel(s: any, fallback: string): string {
  return s?.label ?? s?.type ?? s?.text ?? fallback;
}

/**
 * Разворачивает шаги в плоский список для таймлайна.
 *
 * Логика:
 *  - Шаг с reps > 0 и вложенными raw.steps → разворачиваем reps раз,
 *    каждый вложенный шаг становится колонкой.
 *  - Шаг с вложенными raw.steps без reps → просто вставляем вложенные.
 *  - Обычный шаг → одна колонка.
 */
function stepsToTimeline(steps: StepShape[]): TimelineStep[] {
  const out: TimelineStep[] = [];

  const pushOne = (s: any, fallbackLabel: string) => {
    let durationSec = s?.duration ?? 0;
    if (!durationSec && s?.distance) {
      durationSec = Math.round(s.distance / 2.22);
    }
    if (!durationSec) durationSec = 60;
    out.push({
      label: extractLabel(s, fallbackLabel),
      durationSec,
      zone: extractZone(s),
    });
  };

  for (let i = 0; i < steps.length; i++) {
    const s: any = steps[i];
    const fallback = `Шаг ${i + 1}`;

    // Достаём вложенные шаги — могут быть в s.raw.steps (после rowToDomain)
    // или в s.raw.raw.steps (двойная обёртка). Проверяем оба.
    const nested: any[] | undefined =
      (Array.isArray(s?.raw?.steps) && s.raw.steps) ||
      (Array.isArray(s?.raw?.raw?.steps) && s.raw.raw.steps) ||
      undefined;

    const reps = typeof s?.reps === 'number' && s.reps > 0 ? s.reps : 0;

    if (nested && nested.length > 0) {
      const repeat = reps > 0 ? reps : 1;
      for (let r = 0; r < repeat; r++) {
        for (let k = 0; k < nested.length; k++) {
          pushOne(nested[k], `${fallbackLabelOr(fallback, s)} #${k + 1}`);
        }
      }
    } else {
      pushOne(s, fallback);
    }
  }

  return out;
}

function fallbackLabelOr(fallback: string, s: any): string {
  return s?.text ?? s?.type ?? fallback;
}

function sportBadge(
  sport?: string,
  generatorCategory?: string | null
): { label: string; cls: string } {
  if (generatorCategory) {
    return { label: generatorCategory, cls: 'pb-source-badge--manual' };
  }
  if (!sport) return { label: '—', cls: '' };
  const s = sport.toLowerCase();
  if (s.includes('run')) return { label: 'run', cls: 'pb-source-badge--tcx' };
  if (s.includes('workout') || s.includes('weight')) {
    return { label: 'workout', cls: 'pb-source-badge--manual' };
  }
  if (s.includes('ride') || s.includes('bike')) {
    return { label: 'ride', cls: 'pb-source-badge--dodofo' };
  }
  return { label: sport, cls: '' };
}

export const PlanEventDrawer: React.FC<Props> = ({
  visible,
  event,
  onHide,
  onSaved,
}) => {
  const api = (window as any).electronAPI;

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);   // ← сюда
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [logVisible, setLogVisible] = useState(false);

  useEffect(() => {
    if (!event) return;
    setName(event.name ?? '');
    setDescription((event as any).description ?? '');
    setEditMode(false);
    setError('');
    setInfo('');
  }, [event?.id, visible]);

  // Steps: если из ICU — берём из event.steps, иначе парсим текст.
  const timelineSteps: TimelineStep[] = useMemo(() => {
    if (!event) return [];

    // 1. Если у события уже есть разобранные steps (sync из ICU) —
    //    используем их. Это точнее, чем наш парсер.
    const es = event.steps as StepShape[] | undefined;
    if (es && es.length > 0) {
      return stepsToTimeline(es);
    }

    // 2. Иначе — парсим текст нашим парсером.
    const parsed = parseWorkoutText(description ?? '');
    return parsed.flatSteps
      .filter((s) => s.durationSec != null || s.distanceM != null)
      .map((s, i) => {
        let durationSec = s.durationSec ?? 0;
        if (!durationSec && s.distanceM) {
          durationSec = Math.round(s.distanceM / 2.22);
        }
        if (!durationSec) durationSec = 60;
        return {
          label: s.label || `Шаг ${i + 1}`,
          durationSec,
          zone: s.zone,
        };
      });
  }, [event?.steps, description]);

  if (!event) return null;

  const isRemote = (event.externalId ?? '').startsWith('intervals-icu-event:');

  // --- Сохранить локально ---
  const handleSaveLocal = async () => {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await api.pb.updatePlanEventLocally(event.id, {
        name: name.trim(),
        description,
      });
      if (res?.success) {
        setInfo('Сохранено локально');
        setEditMode(false);
        onSaved();
      } else {
        setError(res?.error ?? 'Ошибка сохранения');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // --- Push в ICU ---
  const handlePush = async () => {
    setPushing(true);
    setError('');
    setInfo('');
    try {
      // Сначала сохраняем локально, чтобы текст точно попал в plan_events.
      if (editMode) {
        await api.pb.updatePlanEventLocally(event.id, {
          name: name.trim(),
          description,
        });
      }
      const res = await api.pb.pushPlanEvent(event.id);
      if (res?.success) {
        setInfo(
          res.action === 'created'
            ? `Создано в ICU (id ${res.icuId})`
            : `Обновлено в ICU (id ${res.icuId})`
        );
        setEditMode(false);
        onSaved();
      } else {
        setError(res?.error ?? 'Ошибка push');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPushing(false);
    }
  };

  const handleDelete = async (scope: DeleteScope) => {
    setDeleting(true);
    setError('');
    setInfo('');
    try {
      if (scope === 'both' && isRemote) {
        const r = await api.pb.deletePlanEventRemote(event.id);
        if (!r?.success) {
          setError(r?.error ?? 'Не удалось удалить из ICU');
          setDeleting(false);
          return;
        }
      }
      const r = await api.pb.deletePlanEventLocally(event.id);
      if (r?.success) {
        setConfirmDelete(false);
        onSaved();
        onHide();
      } else {
        setError(r?.error ?? 'Не удалось удалить локально');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const timeOnly =
    event.startTime && event.startTime.length >= 16
      ? event.startTime.slice(11, 16)
      : '';

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      style={{ width: '640px', maxWidth: '96vw' }}
      className="pb-drawer"
    >
      {/* Header */}
      <div className="pb-drawer__header">
        <div className="pb-drawer__title">
          <i className="pi pi-calendar pb-drawer__icon" />
          {event.date}
          {timeOnly && timeOnly !== '00:00' && (
            <span className="pb-drawer__count"> {timeOnly}</span>
          )}
          {isRemote && (
            <span className="pb-source-badge pb-source-badge--intervals-icu">
              ICU #{event.externalId.replace('intervals-icu-event:', '')}
            </span>
          )}
        </div>
        <Button
          icon="pi pi-trash"
          text
          className="pb-drawer__name-edit"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          tooltip="Удалить"
          tooltipOptions={{ position: 'left' }}
        />
      </div>

      {/* Название */}
      <div className="pb-plan-event__name-edit">
        {!editMode ? (
          <>
            <span className="pb-plan-event__name">{event.name}</span>
            <Button
              icon="pi pi-pencil"
              text
              className="pb-drawer__name-edit"
              onClick={() => setEditMode(true)}
              tooltip="Редактировать"
              tooltipOptions={{ position: 'left' }}
            />
          </>
        ) : (
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="pb-plan-event__name-input"
            placeholder="Название"
          />
        )}
      </div>

      {/* Мета */}
      <div className="pb-plan-event__meta">
        {(() => {
          const badge = sportBadge(event.sport, event.generatorCategory);
          return badge.label && badge.label !== '—' ? (
            <span className={`pb-source-badge ${badge.cls}`}>
              {badge.label}
            </span>
          ) : null;
        })()}
        {event.category && event.category.toUpperCase() !== 'WORKOUT' && (
          <span className="pb-source-badge pb-source-badge--manual">
            {event.category.toLowerCase()}
          </span>
        )}
        {event.distanceM != null && event.distanceM > 0 && (
          <span className="pb-plan-event__chip">
            <i className="pi pi-map-marker" /> {fmtDistance(event.distanceM)}
          </span>
        )}
        {event.durationSec != null && event.durationSec > 0 && (
          <span className="pb-plan-event__chip">
            <i className="pi pi-clock" /> {fmtSec(event.durationSec)}
          </span>
        )}
        {event.plannedLoad != null && (
          <span className="pb-plan-event__chip">
            <i className="pi pi-bolt" /> {Math.round(event.plannedLoad)} TSS
          </span>
        )}
      </div>

      {/* Таймлайн */}
      {(() => {
        console.log('[PlanEventDrawer] timelineSteps:', timelineSteps);
        console.log('[PlanEventDrawer] description:', description);
        console.log('[PlanEventDrawer] event.steps:', event.steps);
        return null;
      })()}
      {timelineSteps.length > 0 && (
        <>
          <div className="pb-drawer__section-title">Таймлайн</div>
          <WorkoutTimeline steps={timelineSteps} />
        </>
      )}

      {/* Текст конструктора */}
      <div className="pb-drawer__section-title">Текст конструктора</div>
      {!editMode ? (
        <pre className="pb-plan-event__description">
          {description?.trim() || '(пусто)'}
        </pre>
      ) : (
        <InputTextarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={12}
          autoResize
          className="pb-plan-event__description-input"
          placeholder={'Например:\nWarmup\n- 2km Z2 Pace\n\nMain Set\n- 5km Z3 Pace'}
        />
      )}

      {/* Сообщения */}
      {error && (
        <Message severity="error" text={error} className="w-full mt-2" />
      )}
      {info && (
        <Message severity="success" text={info} className="w-full mt-2" />
      )}

      {/* Кнопки действий */}
      <div className="pb-drawer__actions">
        {editMode ? (
          <>
            <Button
              label={saving ? 'Сохранение…' : 'Сохранить локально'}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
              className="pb-soft p-button-sm"
              onClick={handleSaveLocal}
              disabled={saving || pushing}
            />
            <Button
              label={pushing ? 'Отправка…' : 'Отправить в ICU'}
              icon={pushing ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'}
              className="pb p-button-sm"
              onClick={handlePush}
              disabled={saving || pushing || !description.trim()}
            />
            <Button
              label="Отмена"
              icon="pi pi-times"
              className="pb-soft p-button-sm"
              onClick={() => {
                setEditMode(false);
                setName(event.name);
                setDescription((event as any).description ?? '');
              }}
              disabled={saving || pushing}
            />
          </>
        ) : (
          <>
            <Button
              label="Записать результат"
              icon="pi pi-check-square"
              className="pb-soft p-button-sm"
              onClick={() => setLogVisible(true)}
              disabled={pushing || deleting}
            />
            <Button
              label={pushing ? 'Отправка…' : isRemote ? 'Обновить в ICU' : 'Отправить в ICU'}
              icon={pushing ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'}
              className="pb p-button-sm"
              onClick={handlePush}
              disabled={pushing || deleting || !description.trim()}
            />
          </>
        )}
      </div>

      <DeletePlanEventDialog
        visible={confirmDelete}
        eventName={event.name}
        isRemote={isRemote}
        remoteId={
          isRemote
            ? event.externalId.replace('intervals-icu-event:', '')
            : null
        }
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />

      <LogWorkoutSessionDialog
        visible={logVisible}
        planEvent={event}
        onHide={() => setLogVisible(false)}
        onSaved={() => {
          onSaved();
        }}
      />
    </Sidebar>
  );
};