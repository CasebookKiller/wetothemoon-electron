// src/pages/PranaBinduPage/PranaBinduPage.tsx

import React, { useEffect, useState } from 'react';
import {
  RunStreamsDrawer,
  type RunFactLite,
} from '@/components/PRANA_BINDU/RunStreamsDrawer';
import {
  type RunFilters,
  EMPTY_FILTERS,
} from '@/components/PRANA_BINDU/PANELS/RunsPanel/RunFiltersPanel';
import { RunsPanel } from '@/components/PRANA_BINDU/PANELS/RunsPanel/RunsPanel';
import { DodofoDebugDialog } from '@/components/PRANA_BINDU/DodofoDebugDialog';

import './PranaBinduPage.css';
import {
  PlanEventsPanel,
  type PlanEventLite,
} from '@/components/PRANA_BINDU/PlanEventsPanel';
import { PlanEventDrawer } from '@/components/PRANA_BINDU/PlanEventDrawer';

import { WorkoutTemplatesDialog } from '@/components/PRANA_BINDU/WorkoutTemplatesDialog';

import { CalendarPanel } from '@/components/COMMON/CalendarPanel/CalendarPanel';

import { DayDrawer } from '@/components/PRANA_BINDU/DayDrawer';

import {
  groupRunFacts,
  sourceBadge,
} from '@/components/PRANA_BINDU/UTILS/groupRunFacts';

import {
  MirrorDeleteDialog,
  type StaleCandidate,
} from '@/components/PRANA_BINDU/MirrorDeleteDialog';

import { FullWeek } from '@/components/PRANA_BINDU/FullWeek';

import {
  ProfilePanel,
  type ProfilePanelHandle,
} from '@/components/PRANA_BINDU/PANELS/ProfilePanel/ProfilePanel';

import {
  ConnectionsPanel,
} from '@/components/PRANA_BINDU/PANELS/ConnectionsPanel/ConnectionsPanel';

import { DeleteGeneratedDialog } from '@/components/PRANA_BINDU/DeleteGeneratedDialog';

import { CheckReminderDialog } from '@/components/PRANA_BINDU/CheckReminderDialog';
import { ExerciseCategory } from '@/main/services/pranaBindu/mentat/types';
import { PROGRESSIONS_CATALOG } from '@/main/services/pranaBindu/mentat/exerciseCatalog';

import { ImportPanel } from '@/components/PRANA_BINDU/PANELS/ImportPanel/ImportPanel';

import {
  TrainingTabs,
} from '@/components/PRANA_BINDU/PANELS/TrainingTabs/TrainingTabs';

import { SyncPanel } from '@/components/PRANA_BINDU/PANELS/SyncPanel/SyncPanel';

import {
  WellnessPanel,
  type WellnessPanelHandle,
} from '@/components/PRANA_BINDU/PANELS/WellnessPanel/WellnessPanel';

const MODULES = [
  { name: 'Stillsuit', description: 'Марафон: пульс, темп, экономичность' },
  { name: 'Crysknife', description: 'Big-6: сила, контроль, сухожилия' },
  { name: 'Mentat', description: 'Календарь, периодизация, подводка к старту' },
  { name: 'Water Discipline', description: 'Сон, HRV, гидратация, восстановление' },
  { name: 'Spice', description: 'Аналитика, Google Fit, Zepp, dodofo' },
];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Две записи считаются «одной тренировкой из разных источников»,
 * если start_time отличается меньше чем на это окно.
 * Потом вынесем в настройки приложения.
 */

const PB_RANGE_STORAGE_KEY = 'pb.syncRange';
const PB_FILTERS_STORAGE_KEY = 'pb.filters.v1';

function loadStoredFilters(): RunFilters {
  try {
    const raw = localStorage.getItem(PB_FILTERS_STORAGE_KEY);
    if (!raw) return EMPTY_FILTERS;
    const parsed = JSON.parse(raw) as Partial<RunFilters>;
    return { ...EMPTY_FILTERS, ...parsed };
  } catch {
    return EMPTY_FILTERS;
  }
}

function saveStoredFilters(f: RunFilters): void {
  try {
    localStorage.setItem(PB_FILTERS_STORAGE_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}

function parsePaceToSec(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

interface StoredRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function loadStoredRange(): { from: Date; to: Date } | null {
  try {
    const raw = localStorage.getItem(PB_RANGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRange;
    if (!parsed.from || !parsed.to) return null;
    const from = new Date(parsed.from + 'T00:00:00');
    const to = new Date(parsed.to + 'T00:00:00');
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    return { from, to };
  } catch {
    return null;
  }
}

function saveStoredRange(from: Date, to: Date): void {
  try {
    const payload: StoredRange = {
      from: toIsoDate(from),
      to: toIsoDate(to),
    };
    localStorage.setItem(PB_RANGE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function defaultSyncRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from, to };
}

const REMINDER_HIDDEN_KEY = 'pb.checkReminder.hidden';
const REMINDER_LAST_SHOWN_KEY = 'pb.checkReminder.lastShown';
const REMINDER_CATEGORIES_KEY = 'pb.checkReminder.categories';
const REMINDER_STALE_DAYS = 28;

/** Движение с флагом — есть ли у него reps-ladder для теста. */
interface TrackableMovement {
  key: string;
  label: string;
  category: ExerciseCategory;
  hasLadder: boolean;
}

/** Все прогрессии каталога. Ladder может быть пустым. */
const TRACKABLE_MOVEMENTS: TrackableMovement[] =
  PROGRESSIONS_CATALOG.map((e) => ({
    key: e.key,
    label: e.label,
    category: e.category,
    hasLadder: e.levels.some((l) => l.benchmarkLadder?.length),
  }));

/** Все категории, в которых есть прогрессии. */
const ALL_TRACKABLE_CATEGORIES: ExerciseCategory[] = Array.from(
  new Set(TRACKABLE_MOVEMENTS.map((m) => m.category))
);

/** Счётчики по категориям: всего движений / тестируемых. */
const CATEGORY_COUNTS: Record<
  string,
  { total: number; testable: number }
> = (() => {
  const out: Record<string, { total: number; testable: number }> = {};
  for (const m of TRACKABLE_MOVEMENTS) {
    const c = m.category;
    if (!out[c]) out[c] = { total: 0, testable: 0 };
    out[c].total++;
    if (m.hasLadder) out[c].testable++;
  }
  return out;
})();

function loadReminderCategories(): Set<ExerciseCategory> {
  try {
    const raw = localStorage.getItem(REMINDER_CATEGORIES_KEY);
    if (!raw) return new Set(['wade']);
    const arr = JSON.parse(raw) as string[];
    const valid = arr.filter((c): c is ExerciseCategory =>
      ALL_TRACKABLE_CATEGORIES.includes(c as ExerciseCategory)
    );
    return valid.length > 0 ? new Set(valid) : new Set(['wade']);
  } catch {
    return new Set(['wade']);
  }
}

function saveReminderCategories(set: Set<ExerciseCategory>): void {
  try {
    localStorage.setItem(
      REMINDER_CATEGORIES_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {
    /* ignore */
  }
}

export const PranaBinduPage: React.FC = () => {
  const api = (window as any).electronAPI;

  // Синхронизация
  const initialRange = loadStoredRange() ?? defaultSyncRange();
  const [syncFrom, setSyncFrom] = useState<Date>(initialRange.from);
  const [syncTo, setSyncTo] = useState<Date>(initialRange.to);

  // Таблица пробежек
  const [runFacts, setRunFacts] = useState<any[]>([]);
  
  const [factsLoading, setFactsLoading] = useState(false);
  const [factsError, setFactsError] = useState('');

  // Потоки
  const [streamsMap, setStreamsMap] = useState<Record<number, any[]>>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedFact, setSelectedFact] = useState<RunFactLite | null>(null);
  
  // Debug
  const [debugVisible, setDebugVisible] = useState(false);

  const [massDeleteVisible, setMassDeleteVisible] = useState(false);

  // ==================== Загрузка потоков (map) ====================

  const loadStreamsMap = async (items: any[]) => {
    if (!api?.pb?.listRunStreamsBatch || items.length === 0) {
      setStreamsMap({});
      return;
    }
    try {
      const ids = items.map((x) => x.id);
      const merged: Record<number, any[]> = {};
      // Чанкуем по 500 — сервер режет массив, а нам нужны все.
      const CHUNK = 500;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = await api.pb.listRunStreamsBatch(chunk);
        if (res?.success && res.data) {
          Object.assign(merged, res.data);
        }
      }
      setStreamsMap(merged);
    } catch {
      // ignore
    }
  };

  const profilePanelRef = React.useRef<ProfilePanelHandle>(null);
  const wellnessPanelRef = React.useRef<WellnessPanelHandle>(null);

  const groupedFacts = React.useMemo(
    () => groupRunFacts(runFacts, streamsMap),
    [runFacts, streamsMap]
  );

  const [filters, setFilters] = useState<RunFilters>(() => loadStoredFilters());
  
  const activeFilterCount = React.useMemo(() => {
    let n = 0;
    if (filters.nameQuery.trim()) n++;
    if (filters.sources.length > 0) n++;
    if (filters.kmFrom != null || filters.kmTo != null) n++;
    if (filters.hrFrom != null || filters.hrTo != null) n++;
    if (filters.paceFrom.trim() || filters.paceTo.trim()) n++;
    if (filters.durFromMin != null || filters.durToMin != null) n++;
    if (filters.streamsMode !== 'all') n++;
    if (filters.onlyUnnamed) n++;
    return n;
  }, [filters]);

  const filteredFacts = React.useMemo(() => {
    const searchLower = filters.nameQuery.toLowerCase().trim();
    const paceFromSec = parsePaceToSec(filters.paceFrom);
    const paceToSec = parsePaceToSec(filters.paceTo);

    return groupedFacts.filter((g) => {
      // Источники: если выбраны — оставляем только группы,
      // где есть любой из выбранных бейджей.
      if (filters.sources.length > 0) {
        const hit = g.sources.some((s) => filters.sources.includes(s));
        if (!hit) return false;
      }

      // Поиск по названию
      if (searchLower) {
        let matched = false;
        // displayName (единое название тренировки)
        if (g.displayName.toLowerCase().includes(searchLower)) matched = true;
        // провайдерские name — только в выбранных источниках
        if (!matched && g.items) {
          for (const it of g.items as any[]) {
            const badge = sourceBadge(it.source, it.origin);
            if (filters.sources.length > 0 && !filters.sources.includes(badge)) {
              continue;
            }
            const nm = (it.name ?? '') as string;
            if (nm && nm.toLowerCase().includes(searchLower)) {
              matched = true;
              break;
            }
          }
        }
        if (!matched) return false;
      }

      const km = g.primary.actual_km;
      if (filters.kmFrom != null && (km == null || km < filters.kmFrom)) return false;
      if (filters.kmTo != null && (km == null || km > filters.kmTo)) return false;

      const hr = g.primary.avg_hr;
      if (filters.hrFrom != null && (hr == null || hr < filters.hrFrom)) return false;
      if (filters.hrTo != null && (hr == null || hr > filters.hrTo)) return false;

      const paceSec = parsePaceToSec(g.primary.actual_pace);
      if (paceFromSec != null && (paceSec == null || paceSec < paceFromSec)) return false;
      if (paceToSec != null && (paceSec == null || paceSec > paceToSec)) return false;

      const durMin =
        g.primary.duration_sec != null ? g.primary.duration_sec / 60 : null;
      if (
        filters.durFromMin != null &&
        (durMin == null || durMin < filters.durFromMin)
      ) return false;
      if (
        filters.durToMin != null &&
        (durMin == null || durMin > filters.durToMin)
      ) return false;

      if (filters.streamsMode === 'with' && !g.hasStreams) return false;
      if (filters.streamsMode === 'without' && g.hasStreams) return false;

      // Название: показываем только группы без user_name
      if (filters.onlyUnnamed && g.hasUserName) return false;

      return true;
    });
  }, [groupedFacts, filters]);

  const handleResetFilters = () => setFilters(EMPTY_FILTERS);

  const [planEvents, setPlanEvents] = useState<PlanEventLite[]>([]);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [planSyncing, setPlanSyncing] = useState(false);
  const [planClearing, setPlanClearing] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planSyncResult, setPlanSyncResult] = useState('');
  const [selectedPlanEvent, setSelectedPlanEvent] = useState<PlanEventLite | null>(null);
  const [dayDrawerDate, setDayDrawerDate] = useState<string | null>(null);
  const [planDrawerVisible, setPlanDrawerVisible] = useState(false);

  const [mirrorCandidates, setMirrorCandidates] = useState<StaleCandidate[]>([]);
  const [mirrorDialogVisible, setMirrorDialogVisible] = useState(false);
  const [mirrorBusy, setMirrorBusy] = useState(false);

  const [reminderVisible, setReminderVisible] = useState(false);
  const [reminderCategories, setReminderCategories] = useState<Set<ExerciseCategory>>(
    () => loadReminderCategories()
  );
  const [reminderDue, setReminderDue] = useState<string[]>([]);
  const [templatesInitialMode, setTemplatesInitialMode] = useState<
    'templates' | 'catalog' | 'programs' | 'equivalences' | undefined
  >(undefined);

  // ==================== Загрузка списка пробежек ====================

  const loadRunFacts = async (from?: Date, to?: Date) => {
    if (!api?.pb?.listRunFacts) return;
    setFactsLoading(true);
    setFactsError('');
    try {
      const f = toIsoDate(from ?? syncFrom);
      const t = toIsoDate(to ?? syncTo);
      const res = await api.pb.listRunFacts(f, t);
      if (res.success) {
        const items = res.items ?? [];
        setRunFacts(items);
        await loadStreamsMap(items);
      } else {
        setFactsError(res.error ?? 'Ошибка загрузки');
      }
    } catch (e) {
      setFactsError((e as Error).message);
    } finally {
      setFactsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // 1. Отключено пользователем?
        if (localStorage.getItem(REMINDER_HIDDEN_KEY) === '1') return;

        // 2. Уже показывали сегодня?
        const today = new Date();
        const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const lastShown = localStorage.getItem(REMINDER_LAST_SHOWN_KEY);
        if (lastShown === todayIso) return;

        // 3. Загружаем реальные тесты за последние 60 дней.
        const from = new Date();
        from.setDate(from.getDate() - 60);
        const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
        const res = await api.pb.listWorkoutSessions(fromIso, todayIso);
        const lastTestAt: Record<string, number> = {};
        if (res?.success) {
          for (const s of res.items ?? []) {
            if (!s.isTest) continue;
            const created = new Date(s.createdAt).getTime();
            if (!Number.isFinite(created)) continue;
            for (const ex of s.exercises ?? []) {
              const key = ex.movementKey;
              if (!key) continue;
              if (!lastTestAt[key] || lastTestAt[key] < created) {
                lastTestAt[key] = created;
              }
            }
          }
        }

        // 4. Кого пора проверить (фильтр по активным категориям)?
        const staleCutoff = Date.now() - REMINDER_STALE_DAYS * 86400 * 1000;
        const due: string[] = [];
        for (const m of TRACKABLE_MOVEMENTS) {
          if (!reminderCategories.has(m.category)) continue;
          if (!m.hasLadder) continue;
          const t = lastTestAt[m.key];
          if (!t || t < staleCutoff) {
            due.push(m.label);
          }
        }

        if (due.length > 0) {
          setReminderDue(due);
          setReminderVisible(true);
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reminderVisible) return;
    // Пересчитать список due при изменении категорий.
    (async () => {
      try {
        const today = new Date();
        const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const from = new Date();
        from.setDate(from.getDate() - 60);
        const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
        const res = await api.pb.listWorkoutSessions(fromIso, todayIso);
        const lastTestAt: Record<string, number> = {};
        if (res?.success) {
          for (const s of res.items ?? []) {
            if (!s.isTest) continue;
            const created = new Date(s.createdAt).getTime();
            if (!Number.isFinite(created)) continue;
            for (const ex of s.exercises ?? []) {
              if (!ex.movementKey) continue;
              if (!lastTestAt[ex.movementKey] || lastTestAt[ex.movementKey] < created) {
                lastTestAt[ex.movementKey] = created;
              }
            }
          }
        }
        const staleCutoff = Date.now() - REMINDER_STALE_DAYS * 86400 * 1000;
        const due: string[] = [];
        for (const m of TRACKABLE_MOVEMENTS) {
          if (!reminderCategories.has(m.category)) continue;
          if (!m.hasLadder) continue;
          const t = lastTestAt[m.key];
          if (!t || t < staleCutoff) due.push(m.label);
        }
        setReminderDue(due);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderCategories]);

  // Автосохранение диапазона
  // Перезагружаем при смене диапазона (с дебаунсом 400 мс,
  // чтобы не дёргать БД на каждое движение календаря)
  useEffect(() => {
    if (syncFrom && syncTo) saveStoredRange(syncFrom, syncTo);
    const t = setTimeout(() => {
      loadRunFacts();
      wellnessPanelRef.current?.reload();
      loadPlanEvents();     // ← добавить
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncFrom, syncTo]);

  useEffect(() => {
    document.body.setAttribute('data-module', 'prana-bindu');
    return () => document.body.removeAttribute('data-module');
  }, []);

  useEffect(() => {
    saveStoredFilters(filters);
  }, [filters]);

  const loadPlanEvents = async (from?: Date, to?: Date) => {
    if (!api?.pb?.listPlanEvents) return;
    setPlanLoading(true);
    setPlanError('');
    try {
      const f = toIsoDate(from ?? syncFrom);
      const t = toIsoDate(to ?? syncTo);
      const res = await api.pb.listPlanEvents(f, t);
      if (res?.success) {
        setPlanEvents(res.items ?? []);
      } else {
        setPlanError(res?.error ?? 'Ошибка загрузки плана');
      }
    } catch (e) {
      setPlanError((e as Error).message);
    } finally {
      setPlanLoading(false);
    }
  };

  const handleSyncPlan = async () => {
    if (!api?.pb?.syncPlan) return;
    setPlanSyncing(true);
    setPlanError('');
    setPlanSyncResult('');
    try {
      const res = await api.pb.syncPlan(
        toIsoDate(syncFrom),
        toIsoDate(syncTo)
      );
      if (res.success) {
        setPlanSyncResult(
          `+${res.added} · ~${res.updated} · связанных: ${res.linked ?? 0}`
        );
        await loadPlanEvents();

        const stale: StaleCandidate[] = res.staleCandidates ?? [];
        if (stale.length > 0) {
          setMirrorCandidates(stale);
          setMirrorDialogVisible(true);
        }
      } else {
        setPlanError(res.error ?? 'Ошибка синхронизации');
      }
    } catch (e) {
      setPlanError((e as Error).message);
    } finally {
      setPlanSyncing(false);
    }
  };

  const handleClearPlan = async () => {
    if (!api?.pb?.clearPlan) return;
    const confirmed = window.confirm(
      'Удалить все события плана за выбранный диапазон?'
    );
    if (!confirmed) return;
    setPlanClearing(true);
    setPlanError('');
    setPlanSyncResult('');
    try {
      const res = await api.pb.clearPlan(
        toIsoDate(syncFrom),
        toIsoDate(syncTo)
      );
      if (res.success) {
        setPlanSyncResult(`Удалено: ${res.deleted ?? 0}`);
        await loadPlanEvents();
      } else {
        setPlanError(res.error ?? 'Ошибка очистки');
      }
    } catch (e) {
      setPlanError((e as Error).message);
    } finally {
      setPlanClearing(false);
    }
  };

  const handleOpenPlanEvent = (event: PlanEventLite) => {
    setSelectedPlanEvent(event);
    setPlanDrawerVisible(true);
  };

  const handleLoadCalendarRange = React.useCallback(
    async (from: string, to: string) => {
      const planDays = new Set<string>();
      const factDays = new Set<string>();
      if (!api?.pb?.listPlanEvents || !api?.pb?.listRunFacts) {
        return { planDays, factDays };
      }
      try {
        const [planRes, factRes] = await Promise.all([
          api.pb.listPlanEvents(from, to),
          api.pb.listRunFacts(from, to),
        ]);
        if (planRes?.success) {
          for (const e of planRes.items ?? []) {
            if (e.date) planDays.add(String(e.date).slice(0, 10));
          }
        }
        if (factRes?.success) {
          for (const e of factRes.items ?? []) {
            if (e.date) factDays.add(String(e.date).slice(0, 10));
          }
        }
      } catch {
        // ignore
      }
      return { planDays, factDays };
    },
    [api]
  );

  const handleMirrorApply = async (
    deleteIds: number[],
    keepIds: number[]
  ) => {
    setMirrorBusy(true);
    try {
      if (keepIds.length > 0) {
        await api.pb.planEventsSetKeep(keepIds, true);
      }
      if (deleteIds.length > 0) {
        await api.pb.planEventsDeleteBulk(deleteIds);
      }
      setMirrorDialogVisible(false);
      await loadPlanEvents();
    } finally {
      setMirrorBusy(false);
    }
  };

  const handleReminderCheckNow = () => {
    try {
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      localStorage.setItem(REMINDER_LAST_SHOWN_KEY, todayIso);
    } catch { /* ignore */ }
    setReminderVisible(false);
    setTemplatesInitialMode('programs');
    setTemplatesVisible(true);
  };

  const handleReminderLater = () => {
    try {
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      localStorage.setItem(REMINDER_LAST_SHOWN_KEY, todayIso);
    } catch { /* ignore */ }
    setReminderVisible(false);
  };

  const handleReminderNever = () => {
    try {
      localStorage.setItem(REMINDER_HIDDEN_KEY, '1');
    } catch { /* ignore */ }
    setReminderVisible(false);
  };

  const handleToggleReminderCategory = (c: ExerciseCategory) => {
    setReminderCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      saveReminderCategories(next);
      return next;
    });
  };

  return (
    <div className="pb-page-root">
      <FullWeek
        onDayClick={(d) => setDayDrawerDate(d)}
        onOpenPlanEvent={(id) => {
          const ev = planEvents.find((p) => p.id === id) ?? null;
          if (ev) {
            setSelectedPlanEvent(ev);
            setPlanDrawerVisible(true);
          }
        }}
        onOpenRunFact={(id) => {
          const fact = runFacts.find((r) => r.id === id) ?? null;
          if (fact) {
            setSelectedFact({
              ...(fact as RunFactLite),
              start_time: fact.start_time,
            });
            setDrawerVisible(true);
          }
        }}
      />

      <div className="pb-page p-4">
        <div className="mb-4">
          <h1 className="pb-title">
            <i className="pi pi-wave-pulse pb-title-icon" />
            Prana-Bindu
          </h1>
          <p className="pb-subtitle">Тренировки тела: бег и сила</p>
        </div>

        <div className="grid mb-3">
          {MODULES.map((m) => (
            <div key={m.name} className="col-12 md:col-6 lg:col-4 p-2">
              <div className="surface-card p-3 shadow-2 border-round h-full">
                <div className="pb-module-name">{m.name}</div>
                <div className="pb-module-desc">{m.description}</div>
              </div>
            </div>
          ))}

          {/* Сюда надо перенести панели, но здесь надо поработать над стилями, шириной и стилями панелей при расзмещении в решетке */}
          
        </div>

        {/* ==================== ПРОФИЛЬ ==================== */}
        <ProfilePanel ref={profilePanelRef} />

        {/* ==================== ПОДКЛЮЧЕНИЯ ==================== */}
        <ConnectionsPanel />

        {/* ==================== СИНХРОНИЗАЦИЯ (API) ==================== */}
        <SyncPanel
          from={syncFrom}
          to={syncTo}
          onFromChange={setSyncFrom}
          onToChange={setSyncTo}
          onOpenDebug={() => setDebugVisible(true)}
          onAfterSync={async () => {
            await loadRunFacts();
          }}
          onAfterThresholds={async () => {
            await profilePanelRef.current?.reload();
          }}
          onAfterZones={async () => {
            await profilePanelRef.current?.reload();
          }}
          onAfterWellness={async () => {
            await wellnessPanelRef.current?.reload();
          }}
        />

        {/* ==================== ИМПОРТ ФАЙЛОВ ==================== */}
        <ImportPanel onAfterImport={loadRunFacts} />

        {/* ==================== WELLNESS (таблица) ==================== */}
        <WellnessPanel ref={wellnessPanelRef} from={syncFrom} to={syncTo} />

        <TrainingTabs
          tabs={[
            {
              key: 'calendar',
              label: 'Календарь',
              title: 'Календарь',
              node: (
                <CalendarPanel
                  loadRange={handleLoadCalendarRange}
                  onDayClick={(d) => setDayDrawerDate(d)}
                />
              ),
            },
            {
              key: 'plan',
              label: 'План',
              title:
                planEvents.length > 0
                  ? `План · ${planEvents.length}`
                  : 'План',
              node: (
                <PlanEventsPanel
                  events={planEvents}
                  loading={planLoading}
                  syncing={planSyncing}
                  clearing={planClearing}
                  error={planError}
                  syncResult={planSyncResult}
                  onSync={handleSyncPlan}
                  onClear={handleClearPlan}
                  onMassDelete={() => setMassDeleteVisible(true)}
                  onOpenEvent={handleOpenPlanEvent}
                  onOpenTemplates={() => setTemplatesVisible(true)}
                  onOpenEquivalences={() => {
                    setTemplatesInitialMode('equivalences');
                    setTemplatesVisible(true);
                  }}
                />
              ),
            },
            {
              key: 'runs',
              label: 'Пробежки',
              title:
                activeFilterCount > 0
                  ? `Пробежки · ${filteredFacts.length} из ${groupedFacts.length}`
                  : `Пробежки · ${groupedFacts.length}${
                      groupedFacts.length !== runFacts.length
                        ? ` (${runFacts.length} записей)`
                        : ''
                    }`,
              node: (
                <RunsPanel
                  items={filteredFacts}
                  loading={factsLoading}
                  error={factsError}
                  filters={filters}
                  onFiltersChange={setFilters}
                  onResetFilters={handleResetFilters}
                  activeFilterCount={activeFilterCount}
                  onOpenFact={(fact) => {
                    setSelectedFact(fact);
                    setDrawerVisible(true);
                  }}
                />
              ),
            },
          ]}
        />

        <DodofoDebugDialog
          visible={debugVisible}
          onHide={() => setDebugVisible(false)}
          initialRunFactId={selectedFact?.id ?? null}
        />

        <RunStreamsDrawer
          visible={drawerVisible}
          runFact={selectedFact}
          onHide={() => setDrawerVisible(false)}
          onAfterSync={() => loadRunFacts()}
        />

        <PlanEventDrawer
          visible={planDrawerVisible}
          event={selectedPlanEvent}
          onHide={() => {
            setPlanDrawerVisible(false);
            requestAnimationFrame(() => {
              const el = document.activeElement;
              if (el instanceof HTMLElement) el.blur();
            });
          }}
          onSaved={() => {
            void loadPlanEvents();
          }}
        />

        <MirrorDeleteDialog
          visible={mirrorDialogVisible}
          candidates={mirrorCandidates}
          rangeFrom={toIsoDate(syncFrom)}
          rangeTo={toIsoDate(syncTo)}
          busy={mirrorBusy}
          onCancel={() => setMirrorDialogVisible(false)}
          onApply={handleMirrorApply}
        />

        <DeleteGeneratedDialog
          visible={massDeleteVisible}
          defaultFrom={syncFrom}
          defaultTo={syncTo}
          onHide={() => setMassDeleteVisible(false)}
          onAfterDelete={() => {
            void loadPlanEvents();
          }}
        />

        <WorkoutTemplatesDialog
          visible={templatesVisible}
          initialMode={templatesInitialMode}
          onHide={() => {
            setTemplatesVisible(false);
            // Сброс, чтобы при следующем открытии через «Упражнения»
            // из панели «План» мы не навязывали вкладку «Программы».
            setTemplatesInitialMode(undefined);
          }}
        />

        <DayDrawer
          visible={!!dayDrawerDate}
          date={dayDrawerDate}
          onHide={() => {
            setDayDrawerDate(null);
            // Снимаем фокус с кнопки-даты, чтобы после закрытия не
            // осталась focus-рамка (PrimeReact возвращает фокус на триггер).
            requestAnimationFrame(() => {
              const el = document.activeElement;
              if (el instanceof HTMLElement) el.blur();
            });
          }}
          onAfterChange={() => {
            void loadPlanEvents();
            void loadRunFacts();
          }}
        />

      </div>

      <CheckReminderDialog
        visible={reminderVisible}
        dueMovements={reminderDue}
        categories={reminderCategories}
        categoryCounts={CATEGORY_COUNTS}
        onToggleCategory={handleToggleReminderCategory}
        onCheckNow={handleReminderCheckNow}
        onLater={handleReminderLater}
        onNever={handleReminderNever}
      />

    </div>
  );
};