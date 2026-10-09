// src/components/PRANA_BINDU/PlanEventsPanel.tsx
//
// Панель «План» — мини-таблица событий из plan_events.
// Глупый компонент: получает events + callbacks, ничего не знает
// про IPC.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Message } from 'primereact/message';
import { THENICS_CATALOG } from '@/main/services/pranaBindu/mentat/thenicsCatalog';

export interface PlanEventLite {
  id: number;
  externalId: string;
  date: string;
  startTime?: string;
  category: string;
  sport?: string;
  name: string;
  plannedLoad?: number;
  durationSec?: number;
  distanceM?: number;
  steps?: Array<unknown>;
  pairedActivityId?: number;
  generatorCategory?: string | null;
  generatorProgramKey?: string | null;
}

interface Props {
  events: PlanEventLite[];
  loading: boolean;
  syncing: boolean;
  clearing: boolean;
  error: string;
  syncResult: string;
  onSync: () => void;
  onClear: () => void;
  onOpenEvent: (event: PlanEventLite) => void;
  onOpenTemplates: () => void;
  onOpenEquivalences: () => void;
  onMassDelete: () => void;
}

function fmtDistance(m?: number): string {
  if (m == null) return '—';
  return `${(m / 1000).toFixed(m >= 1000 ? 1 : 2)} км`;
}

function fmtDuration(sec?: number): string {
  if (sec == null || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  return `${m}м`;
}

function sportBadge(
  sport?: string,
  generatorCategory?: string | null
): { label: string; cls: string } {
  // Сгенерированные программы: показываем категорию генератора.
  if (generatorCategory) {
    return {
      label: generatorCategory,
      cls: 'pb-source-badge--manual',
    };
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

export const PlanEventsPanel: React.FC<Props> = ({
  events,
  loading,
  syncing,
  clearing,
  error,
  syncResult,
  onSync,
  onClear,
  onMassDelete,
  onOpenEvent,
  onOpenTemplates,
  onOpenEquivalences,
}) => {
    const api = (window as any).electronAPI;

  // Счётчик разметки Thenics для баннера.
  const [mappedCount, setMappedCount] = useState<number | null>(null);
  const [bannerHidden, setBannerHidden] = useState(false);

  const totalCount = THENICS_CATALOG.length;

  const BANNER_HIDE_KEY = 'pb.equivBanner.hiddenUntil';

  useEffect(() => {
    // Скрыт до даты?
    try {
      const raw = localStorage.getItem(BANNER_HIDE_KEY);
      if (raw) {
        const until = Number(raw);
        if (Number.isFinite(until) && Date.now() < until) {
          setBannerHidden(true);
        } else {
          localStorage.removeItem(BANNER_HIDE_KEY);
        }
      }
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        const res = await api?.pb?.listEquivalences?.();
        if (res?.success) {
          const keys = new Set<string>();
          for (const e of res.items ?? []) {
            if (e.source === 'thenics') keys.add(e.sourceKey);
          }
          setMappedCount(keys.size);
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hideBannerForToday = () => {
    try {
      // Скрыть до конца текущего дня.
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      localStorage.setItem(BANNER_HIDE_KEY, String(tomorrow.getTime()));
    } catch {
      /* ignore */
    }
    setBannerHidden(true);
  };

  const showBanner =
    !bannerHidden &&
    mappedCount != null &&
    mappedCount < totalCount;

  return (
    <div className="pb-plan-panel">
      <div className="pb-plan__toolbar">
        <Button
          label={syncing ? 'Обновление…' : 'Обновить из ICU'}
          icon={syncing ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-download'}
          className="pb p-button-sm"
          onClick={onSync}
          disabled={syncing || clearing}
        />
        <Button
          label={clearing ? 'Очистка…' : 'Очистить'}
          icon={clearing ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
          className="pb-destructive-soft p-button-sm"
          onClick={onClear}
          disabled={syncing || clearing || events.length === 0}
          tooltip="Удалить план за выбранный диапазон"
        />
        <Button
          label="Удалить по фильтру"
          icon="pi pi-filter-slash"
          className="pb-soft p-button-sm"
          onClick={onMassDelete}
          tooltip="Массовое удаление сгенерированных и ручных событий"
          tooltipOptions={{ position: 'bottom' }}
        />
        <Button
          label="Упражнения"
          icon="pi pi-book"
          className="pb-soft p-button-sm"
          onClick={onOpenTemplates}
          disabled={syncing || clearing}
          tooltip="Готовые шаблоны тренировок для конструктора ICU"
        />
      </div>

            {showBanner && (
        <div className="pb-equiv-banner">
          <i className="pi pi-info-circle pb-equiv-banner__icon" />
          <div className="pb-equiv-banner__body">
            <span className="pb-equiv-banner__title">
              Упражнения Thenics не размечены
            </span>
            <span className="pb-equiv-banner__hint">
              {mappedCount} из {totalCount} сопоставлено с нашими
              упражнениями. Чем больше разметки — тем точнее подсказки
              «≈ Thenics X» в карточках тренировок.
            </span>
          </div>
          <Button
            label="Разметить"
            icon="pi pi-arrow-right"
            className="pb-soft p-button-sm pb-equiv-banner__action"
            onClick={onOpenEquivalences}
          />
          <Button
            icon="pi pi-times"
            text
            className="pb-equiv-banner__close"
            onClick={hideBannerForToday}
            tooltip="Скрыть до завтра"
            tooltipOptions={{ position: 'bottom' }}
          />
        </div>
      )}

      {error && (
        <Message severity="error" text={error} className="w-full mt-2 mb-2" />
      )}
      {syncResult && (
        <Message
          severity="success"
          text={syncResult}
          className="w-full mt-2 mb-2"
        />
      )}

      <DataTable
        value={events}
        loading={loading}
        size="small"
        stripedRows
        scrollable
        scrollHeight="360px"
        virtualScrollerOptions={{ itemSize: 34 }}
        emptyMessage="Плана нет за выбранный период. Нажмите «Обновить из ICU»."
        className="p-datatable-sm"
        selectionMode="single"
        onRowClick={(e) => onOpenEvent(e.data as PlanEventLite)}
      >
        <Column
          field="date"
          header="Дата"
          style={{ width: '110px' }}
          body={(r: PlanEventLite) => r.date}
        />
        <Column
          header="Спорт"
          style={{ width: '90px' }}
          body={(r: PlanEventLite) => {
            const { label, cls } = sportBadge(r.sport, r.generatorCategory);
            return (
              <span className={`pb-source-badge ${cls}`}>{label}</span>
            );
          }}
        />
        <Column
          field="name"
          header="Название"
          style={{ width: '220px' }}
          body={(r: PlanEventLite) => r.name}
        />
        <Column
          header="Шаги"
          style={{ width: '70px' }}
          body={(r: PlanEventLite) =>
            r.steps && r.steps.length > 0 ? String(r.steps.length) : '—'
          }
        />
        <Column
          header="Дистанция"
          style={{ width: '100px' }}
          body={(r: PlanEventLite) => fmtDistance(r.distanceM)}
        />
        <Column
          header="Время"
          style={{ width: '90px' }}
          body={(r: PlanEventLite) => fmtDuration(r.durationSec)}
        />
        <Column
          header="Нагрузка"
          style={{ width: '90px' }}
          body={(r: PlanEventLite) =>
            r.plannedLoad != null ? Math.round(r.plannedLoad) : '—'
          }
        />
        <Column
          header="Факт"
          style={{ width: '80px', textAlign: 'center' }}
          body={(r: PlanEventLite) =>
            r.pairedActivityId ? (
              <i
                className="pi pi-check-circle"
                style={{ color: '#6fbf73' }}
                title={`Связано с run_fact #${r.pairedActivityId}`}
              />
            ) : (
              <i className="pi pi-minus" style={{ opacity: 0.25 }} />
            )
          }
        />
      </DataTable>
    </div>
  );
};