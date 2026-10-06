// src/components/PRANA_BINDU/views/PlanEventView.tsx
//
// Полная карточка plan_event без Sidebar — для вкладки в DayDrawer.
// Функциональность идентична PlanEventDrawer.

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { WorkoutTimeline, type TimelineStep } from '../WorkoutTimeline';
import type { PlanEventLite } from '../PlanEventsPanel';
import { parseWorkoutText } from '@/main/services/pranaBindu/mentat/workoutParser';
import {
  DeletePlanEventDialog,
  type DeleteScope,
} from '../DeletePlanEventDialog';

interface Props {
  event: PlanEventLite;
  onBack: () => void;
  onChanged: () => void;
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
    const nested: any[] | undefined =
      (Array.isArray(s?.raw?.steps) && s.raw.steps) ||
      (Array.isArray(s?.raw?.raw?.steps) && s.raw.raw.steps) ||
      undefined;
    const reps = typeof s?.reps === 'number' && s.reps > 0 ? s.reps : 0;
    if (nested && nested.length > 0) {
      const repeat = reps > 0 ? reps : 1;
      for (let r = 0; r < repeat; r++) {
        for (let k = 0; k < nested.length; k++) {
          pushOne(nested[k], `${s?.text ?? s?.type ?? fallback} #${k + 1}`);
        }
      }
    } else {
      pushOne(s, fallback);
    }
  }
  return out;
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

export const PlanEventView: React.FC<Props> = ({ event, onBack, onChanged }) => {
  const api = (window as any).electronAPI;

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(event.name ?? '');
  const [description, setDescription] = useState((event as any).description ?? '');
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    setName(event.name ?? '');
    setDescription((event as any).description ?? '');
    setEditMode(false);
    setError('');
    setInfo('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const timelineSteps: TimelineStep[] = useMemo(() => {
    const es = event.steps as StepShape[] | undefined;
    if (es && es.length > 0) return stepsToTimeline(es);
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
  }, [event.steps, description]);

  const isRemote = (event.externalId ?? '').startsWith('intervals-icu-event:');

  const handleSaveLocal = async () => {
    setSaving(true); setError(''); setInfo('');
    try {
      const res = await api.pb.updatePlanEventLocally(event.id, {
        name: name.trim(), description,
      });
      if (res?.success) {
        setInfo('Сохранено локально');
        setEditMode(false);
        onChanged();
      } else setError(res?.error ?? 'Ошибка сохранения');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handlePush = async () => {
    setPushing(true); setError(''); setInfo('');
    try {
      if (editMode) {
        await api.pb.updatePlanEventLocally(event.id, {
          name: name.trim(), description,
        });
      }
      const res = await api.pb.pushPlanEvent(event.id);
      if (res?.success) {
        setInfo(res.action === 'created'
          ? `Создано в ICU (id ${res.icuId})`
          : `Обновлено в ICU (id ${res.icuId})`);
        setEditMode(false);
        onChanged();
      } else setError(res?.error ?? 'Ошибка push');
    } catch (e) { setError((e as Error).message); }
    finally { setPushing(false); }
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
        onChanged();
        onBack();
      } else {
        setError(r?.error ?? 'Не удалось удалить локально');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const timeOnly = event.startTime && event.startTime.length >= 16
    ? event.startTime.slice(11, 16) : '';

  return (
    <div className="pb-plan-event-view">
      <div className="pb-plan-event-view__back">
        <Button
          label="← К дню"
          icon="pi pi-arrow-left"
          className="pb-soft p-button-sm"
          onClick={onBack}
        />
        {isRemote && (
          <span className="pb-source-badge pb-source-badge--intervals-icu">
            ICU #{event.externalId.replace('intervals-icu-event:', '')}
          </span>
        )}
        <span className="pb-plan-event-view__date">
          {event.date}
          {timeOnly && timeOnly !== '00:00' && (
            <span className="pb-drawer__count"> {timeOnly}</span>
          )}
        </span>
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

      <div className="pb-plan-event__meta">
        {(() => {
          const badge = sportBadge(event.sport, event.generatorCategory);
          return badge.label && badge.label !== '—' ? (
            <span className={`pb-source-badge ${badge.cls}`}>
              {badge.label}
            </span>
          ) : null;
        })()}
        {event.category && event.category !== 'WORKOUT' && (
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

      {timelineSteps.length > 0 && (
        <>
          <div className="pb-drawer__section-title">Таймлайн</div>
          <WorkoutTimeline steps={timelineSteps} />
        </>
      )}

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

      {error && <Message severity="error" text={error} className="w-full mt-2" />}
      {info && <Message severity="success" text={info} className="w-full mt-2" />}

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
          <Button
            label={pushing ? 'Отправка…' : isRemote ? 'Обновить в ICU' : 'Отправить в ICU'}
            icon={pushing ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'}
            className="pb p-button-sm"
            onClick={handlePush}
            disabled={pushing || deleting || !description.trim()}
          />
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
    </div>
  );
};