// src/pages/PranaBinduPage/PranaBinduPage.tsx

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Panel } from 'primereact/panel';
import {
  RunStreamsDrawer,
  type RunFactLite,
} from '@/components/PRANA_BINDU/RunStreamsDrawer';
import {
  RunFiltersPanel,
  type RunFilters,
  EMPTY_FILTERS,
} from '@/components/PRANA_BINDU/RunFiltersPanel';
import { DodofoDebugDialog } from '@/components/PRANA_BINDU/DodofoDebugDialog';

import './PranaBinduPage.css';
import { InputNumber } from 'primereact/inputnumber';

import { ProgressBar } from 'primereact/progressbar';


import {
  PlanEventsPanel,
  type PlanEventLite,
} from '@/components/PRANA_BINDU/PlanEventsPanel';
import { PlanEventDrawer } from '@/components/PRANA_BINDU/PlanEventDrawer';

import { WorkoutTemplatesDialog } from '@/components/PRANA_BINDU/WorkoutTemplatesDialog';

import { WellnessDrawer, type RecoveryLogLite } from '@/components/PRANA_BINDU/WellnessDrawer';

import { YearCalendar } from '@/components/COMMON/YearCalendar/YearCalendar';

import { CalendarPanel } from '@/components/COMMON/CalendarPanel/CalendarPanel';

import { DayDrawer } from '@/components/PRANA_BINDU/DayDrawer';

import {
  groupRunFacts,
  sourceBadge,
  type GroupedRunFact,
} from '@/components/PRANA_BINDU/utils/groupRunFacts';

import {
  MirrorDeleteDialog,
  type StaleCandidate,
} from '@/components/PRANA_BINDU/MirrorDeleteDialog';

import { FullWeek } from '@/components/PRANA_BINDU/FullWeek';

import { DeleteGeneratedDialog } from '@/components/PRANA_BINDU/DeleteGeneratedDialog';

import { CheckReminderDialog } from '@/components/PRANA_BINDU/CheckReminderDialog';
import { ExerciseCategory } from '@/main/services/pranaBindu/mentat/types';
import { PROGRESSIONS_CATALOG } from '@/main/services/pranaBindu/mentat/exerciseCatalog';
import { Checkbox } from 'primereact/checkbox';

interface ProviderOption {
  label: string;
  value: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { label: 'dodofo (активности)', value: 'dodofo' },
  { label: 'intervals.icu (активности + события)', value: 'intervals-icu' },
  { label: 'dofek-zepp (резерв)', value: 'dofek-zepp' },
  { label: 'zepp-mcp (не реализован)', value: 'zepp-mcp' },
  { label: 'zeppbridge (не реализован)', value: 'zeppbridge' },
];

const MODULES = [
  { name: 'Stillsuit', description: 'Марафон: пульс, темп, экономичность' },
  { name: 'Crysknife', description: 'Big-6: сила, контроль, сухожилия' },
  { name: 'Mentat', description: 'Календарь, периодизация, подводка к старту' },
  { name: 'Water Discipline', description: 'Сон, HRV, гидратация, восстановление' },
  { name: 'Spice', description: 'Аналитика, Google Fit, Zepp, dodofo' },
];

const IMPORT_ORIGIN_OPTIONS = [
  { label: 'Zepp / Amazfit', value: 'zepp-app' },
  { label: 'Strava-архив', value: 'strava-archive' },
  { label: 'Garmin Connect', value: 'garmin-connect' },
  { label: 'Coros', value: 'coros' },
  { label: 'Polar', value: 'polar' },
  { label: 'Suunto', value: 'suunto' },
  { label: 'Ручной импорт', value: 'manual-import' },
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
//const SAME_WORKOUT_WINDOW_MIN = 30;
//const SAME_WORKOUT_WINDOW_MS = SAME_WORKOUT_WINDOW_MIN * 60 * 1000;

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

function fmtKm(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(2);
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/*
const SOURCE_PRIORITY: Record<string, number> = {
  fit: 1,
  tcx: 2,
  manual: 3,
  dodofo: 4,
  zepp: 5,
  'strava-csv': 6
};*/

/*function sourceBadge(source: string | null, origin: string | null): string {
  if (source === 'fit' || source === 'tcx') {
    if (origin === 'zepp-app') return 'zepp';
    if (origin === 'manual-import') return 'manual';
    return source;
  }
  return source ?? '—';
}*/

/*interface GroupedRunFact {
  date: string;
  startTime: string | null;   // якорь группы
  sources: string[];
  primary: any;
  items: any[];      // ← новое
  count: number;
  hasStreams: boolean;
  displayName: string;   // ← user_name ?? name
  hasUserName: boolean;   // ← новое
}*/

/*function groupRunFacts(
  items: any[],
  streamsMap: Record<number, any[]>
): GroupedRunFact[] {
  if (items.length === 0) return [];

  // 1. Сортировка: по дате, потом по start_time (null — в конец)
  const sorted = [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const sa = a.start_time ?? '9999-12-31T23:59:59Z';
    const sb = b.start_time ?? '9999-12-31T23:59:59Z';
    return sa.localeCompare(sb);
  });

  // 2. Группировка: подряд идущие записи с одной датой.
  //    Если хотя бы у одной в группе нет start_time — считаем её той же тренировкой.
  const groups: any[][] = [];
  for (const it of sorted) {
    const last = groups[groups.length - 1];

    if (last && last.length > 0) {
      const anchor = last[0];
      const sameDate = anchor.date === it.date;

      if (sameDate) {
        const anchorMs = anchor.start_time
          ? new Date(anchor.start_time).getTime()
          : null;
        const itMs = it.start_time
          ? new Date(it.start_time).getTime()
          : null;

        // Одна тренировка, если:
        //  a) хотя бы у одной нет start_time
        //  b) или времена в пределах окна
        const noTime = anchorMs == null || itMs == null;
        const withinWindow =
          anchorMs != null &&
          itMs != null &&
          Math.abs(itMs - anchorMs) <= SAME_WORKOUT_WINDOW_MS;

        if (noTime || withinWindow) {
          last.push(it);
          continue;
        }
      }
    }

    groups.push([it]);
  }

  // 3. Из каждой группы — GroupedRunFact
  return groups
    .map((group) => {
      const sortedGroup = [...group].sort((a, b) => {
        const pa = SOURCE_PRIORITY[a.source ?? ''] ?? 99;
        const pb = SOURCE_PRIORITY[b.source ?? ''] ?? 99;
        if (pa !== pb) return pa - pb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const sources = sortedGroup.map((s) => sourceBadge(s.source, s.origin));
      const hasStreams = sortedGroup.some((s) => streamsMap[s.id]?.length);

      // Якорный start_time: берём первый непустой из группы
      const anchorStartTime =
        sortedGroup.find((s) => s.start_time)?.start_time ?? null;
      const primary = sortedGroup[0];
      const groupUserName =
        sortedGroup.find((s) => s.user_name)?.user_name ?? null;
      const groupName =
        sortedGroup.find((s) => s.name)?.name ?? null;
      const displayName = groupUserName ?? groupName ?? '—';
      const hasUserName = !!groupUserName;

      return {
        date: group[0].date,
        startTime: anchorStartTime,
        sources,
        primary: primary,
        items: sortedGroup,
        displayName: displayName,
        hasUserName,   // ← новое
        count: sortedGroup.length,
        hasStreams,
      };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const sa = a.startTime ?? '';
      const sb = b.startTime ?? '';
      return sb.localeCompare(sa);
    });
}*/

function labelForSource(src: string): string {
  switch (src) {
    case 'icu': return 'intervals.icu';
    case 'dodofo': return 'dodofo';
    case 'manual': return 'ручной ввод';
    case 'computed': return 'расчёт';
    default: return src;
  }
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

  const [provider, setProvider] = useState<string>('dodofo');
  const [providerCaps, setProviderCaps] = useState<{
    workouts: boolean;
    streams: boolean;
    thresholds: boolean;
    zones: boolean;
    wellness: boolean;
  } | null>(null);
  
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Синхронизация
  const initialRange = loadStoredRange() ?? defaultSyncRange();
  const [syncFrom, setSyncFrom] = useState<Date>(initialRange.from);
  const [syncTo, setSyncTo] = useState<Date>(initialRange.to);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    added: number;
    updated: number;
    total: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<string>('');

  // dodofo
  const [dodofoToken, setDodofoToken] = useState('');
  const [hasDodofoToken, setHasDodofoToken] = useState(false);

  // Zepp (резерв)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Таблица пробежек
  const [runFacts, setRunFacts] = useState<any[]>([]);
  
  const [factsLoading, setFactsLoading] = useState(false);
  const [factsError, setFactsError] = useState('');

  // Потоки
  const [streamsMap, setStreamsMap] = useState<Record<number, any[]>>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedFact, setSelectedFact] = useState<RunFactLite | null>(null);
  const [syncingStreams, setSyncingStreams] = useState(false);
  /** Тумблер «Перезалить существующие» — влияет на onlyMissing
   *  в syncRunStreamsAll. Сохраняется в localStorage (по умолчанию выкл). */
  const [overwriteStreams, setOverwriteStreams] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.syncOverwriteStreams') === '1';
    } catch {
      return false;
    }
  });
  const [streamsAllResult, setStreamsAllResult] = useState<{
    fetched: number;
    skipped: number;
    failed: number;
    total: number;
  } | null>(null);
  const [streamsAllError, setStreamsAllError] = useState('');

  const [syncingThresholds, setSyncingThresholds] = useState(false);
  const [thresholdsResult, setThresholdsResult] = useState<string>('');
  const [thresholdsError, setThresholdsError] = useState('');

  // Debug
  const [debugVisible, setDebugVisible] = useState(false);

  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    filename: string;
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const [zeppArchivePath, setZeppArchivePath] = useState<string>('');
  const [zeppUpdating, setZeppUpdating] = useState(false);
  const [zeppResult, setZeppResult] = useState<{
    imported: number; skipped: number; failed: number; total: number;
  } | null>(null);
  const [zeppError, setZeppError] = useState('');

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

  // ========================== Профиль =============================
  const [profile, setProfile] = useState<{
    maxHr: number | null;
    lthr: number | null;
    restingHr: number | null;
    lthrSource?: string | null;
    maxHrSource?: string | null;
    restingHrSource?: string | null;
  }>({ maxHr: null, lthr: null, restingHr: null });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const [syncingWellness, setSyncingWellness] = useState(false);
  const [wellnessResult, setWellnessResult] = useState<string>('');
  const [wellnessError, setWellnessError] = useState('');

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

  const [dragActive, setDragActive] = useState(false);

  const [importOrigin, setImportOrigin] = useState<string>('zepp-app');

  const [intervalsApiKey, setIntervalsApiKey] = useState('');
  const [intervalsAthleteId, setIntervalsAthleteId] = useState('');
  const [intervalsHasKey, setIntervalsHasKey] = useState(false);
  const [intervalsSaving, setIntervalsSaving] = useState(false);
  const [intervalsError, setIntervalsError] = useState('');
  const [intervalsInfo, setIntervalsInfo] = useState('');

  const [recoveryLogs, setRecoveryLogs] = useState<any[]>([]);
  const [selectedRecovery, setSelectedRecovery] = useState<RecoveryLogLite | null>(null);
  const [wellnessDrawerVisible, setWellnessDrawerVisible] = useState(false);

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

  const [syncStreamsProgress, setSyncStreamsProgress] = useState<{
    current: number;
    total: number;
    runFactId: number;
    externalId: string | null;
    fetched: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const [mirrorCandidates, setMirrorCandidates] = useState<StaleCandidate[]>([]);
  const [mirrorDialogVisible, setMirrorDialogVisible] = useState(false);
  const [mirrorBusy, setMirrorBusy] = useState(false);

  const [reminderVisible, setReminderVisible] = useState(false);
  const [reminderCategories, setReminderCategories] = useState<Set<ExerciseCategory>>(
    () => loadReminderCategories()
  );
  const [reminderDue, setReminderDue] = useState<string[]>([]);
  const [templatesInitialMode, setTemplatesInitialMode] = useState<
    'templates' | 'catalog' | 'programs' | undefined
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

  const loadProfile = async () => {
    if (!api?.pb?.getProfile) return;
    try {
      const res = await api.pb.getProfile();
      if (res?.success) {
        const d = res.data ?? {};
        setProfile({
          maxHr: d.maxHr ?? null,
          lthr: d.lactateThresholdHr ?? d.lthr ?? null,
          restingHr: d.restingHr ?? null,
          lthrSource: d.lthrSource ?? null,
          maxHrSource: d.maxHrSource ?? null,
          restingHrSource: d.restingHrSource ?? null,
        });
      }
    } catch {
      // ignore
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

  // Загрузка токена + пробежек при монтировании
  useEffect(() => {
    (async () => {
      if (!api?.pb?.dodofoTokenStatus) return;
      try {
        const res = await api.pb.dodofoTokenStatus();
        if (res?.success) setHasDodofoToken(!!res.hasToken);
      } catch {
        // ignore
      }
    })();
    (async () => {
      try {
        const res = await api.pb.fitArchivePathGet?.();
        if (res?.success && res.path) setFitArchivePath(res.path);
      } catch {
        // ignore
      }
    })();
    (async () => {
      try {
        const res = await api.pb.zeppArchivePathGet?.();
        if (res?.success && res.path) setZeppArchivePath(res.path);
      } catch { /* ignore */ }
    })();
    (async () => {
      try {
        const r = await api.pb.intervalsStatus?.();
        if (r?.success) {
          setIntervalsHasKey(!!r.hasApiKey);
          setIntervalsAthleteId(r.athleteId ?? '');
        }
      } catch { /* ignore */ }
    })();
    //loadRunFacts();
    loadProfile();   // ← добавил
    loadRecoveryLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Сброс статуса при смене провайдера
  useEffect(() => {
    setStatus('');
    (async () => {
      if (!api?.pb?.providerCapabilities) return;
      try {
        const res = await api.pb.providerCapabilities(provider);
        if (res?.success) setProviderCaps(res.data);
        else setProviderCaps(null);
      } catch {
        setProviderCaps(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  useEffect(() => {
    if (!api?.pb?.onImportProgress) return;
    api.pb.onImportProgress((data: any) => setImportProgress(data));
    return () => {
      api.pb.removeImportProgressListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!api?.pb?.onSyncProgress) return;
    api.pb.onSyncProgress((data: any) => setSyncStreamsProgress(data));
    return () => {
      api.pb.removeSyncProgressListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автосохранение диапазона
  // Перезагружаем при смене диапазона (с дебаунсом 400 мс,
  // чтобы не дёргать БД на каждое движение календаря)
  useEffect(() => {
    if (syncFrom && syncTo) saveStoredRange(syncFrom, syncTo);
    const t = setTimeout(() => {
      loadRunFacts();
      loadRecoveryLogs();
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

  // ==================== Проверка доступности ====================

  const handleCheck = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен — модуль ещё не собран');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const res = await api.pb.zeppCheckProvider(provider);
      setStatus(JSON.stringify(res));
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Синхронизация тренировок ====================

  const handleSync = async () => {
    if (!api?.pb?.syncNow) {
      setSyncError('electronAPI.pb.syncNow недоступен');
      return;
    }
    if (!syncFrom || !syncTo) {
      setSyncError('Укажите обе даты');
      return;
    }
    setSyncing(true);
    setSyncError('');
    setSyncResult(null);
    try {
      const res = await api.pb.syncNow(
        toIsoDate(syncFrom),
        toIsoDate(syncTo),
        provider                 // ← добавить
      );
      if (res.success) {
        setSyncResult({
          added: res.added ?? 0,
          updated: res.updated ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setSyncError(res.error ?? 'Неизвестная ошибка');
      }
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  // ==================== Массовая заливка потоков ====================

    const handleSyncAllStreams = async () => {
    if (!api?.pb?.syncRunStreamsAll) {
      setStreamsAllError('electronAPI.pb.syncRunStreamsAll недоступен');
      return;
    }
    if (!syncFrom || !syncTo) {
      setStreamsAllError('Укажите обе даты');
      return;
    }
    setSyncingStreams(true);
    setStreamsAllError('');
    setStreamsAllResult(null);
    setSyncStreamsProgress(null);
    try {
      const res = await api.pb.syncRunStreamsAll(
        toIsoDate(syncFrom),
        toIsoDate(syncTo),
        { provider, onlyMissing: !overwriteStreams }
      );
      if (res.success) {
        setStreamsAllResult({
          fetched: res.fetched ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setStreamsAllError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setStreamsAllError((e as Error).message);
    } finally {
      setSyncingStreams(false);
      setSyncStreamsProgress(null);
    }
  };

  const handleCancelSyncStreams = async () => {
    try {
      await api.pb.syncCancel?.();
    } catch {
      // ignore
    }
  };

  // ==================== Синхронизация порогов ====================

  const handleSyncThresholds = async () => {
    if (!api?.pb?.syncThresholds) return;
    setSyncingThresholds(true);
    setThresholdsError('');
    setThresholdsResult('');
    try {
      const res = await api.pb.syncThresholds(provider);
      if (res.success) {
        setThresholdsResult((res.applied ?? []).join(' · ') || 'обновлено');
        await loadProfile();          // ← добавить
      } else {
        setThresholdsError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setThresholdsError((e as Error).message);
    } finally {
      setSyncingThresholds(false);
    }
  };

  const [syncingZones, setSyncingZones] = useState(false);
  const [zonesResult, setZonesResult] = useState('');
  const [zonesError, setZonesError] = useState('');

  const handleSyncZones = async () => {
    if (!api?.pb?.syncZones) return;
    setSyncingZones(true);
    setZonesError('');
    setZonesResult('');
    try {
      const res = await api.pb.syncZones(provider);
      if (res.success) {
        setZonesResult(
          Array.isArray(res.zones) ? res.zones.join(' · ') : 'обновлено'
        );
        await loadProfile();
      } else {
        setZonesError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setZonesError((e as Error).message);
    } finally {
      setSyncingZones(false);
    }
  };

  // ==================== dodofo ====================

  const handleSaveDodofo = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен');
      return;
    }
    if (!dodofoToken.trim()) {
      setStatus('Введите токен dodofo');
      return;
    }
    setLoading(true);
    setStatus('Сохранение токена...');
    try {
      const res = await api.pb.dodofoConnect(dodofoToken.trim());
      if (res.success) {
        setStatus('Токен сохранён и проверен');
        setHasDodofoToken(true);
        setDodofoToken('');
      } else {
        setStatus(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Zepp (резерв) ====================

  const handleConnectZepp = async () => {
    if (!api?.pb) {
      setStatus('electronAPI.pb недоступен');
      return;
    }
    if (!email || !password) {
      setStatus('Введите email и пароль');
      return;
    }
    setLoading(true);
    setStatus('Подключение...');
    try {
      const res = await api.pb.zeppConnect(email, password);
      if (res.success) {
        setStatus(
          `Успех: userId=${res.userId}, authHost=${res.authHost}, dataHost=${res.dataHost}`
        );
        setPassword('');
      } else {
        setStatus(`Ошибка: ${res.error}`);
      }
    } catch (e) {
      setStatus(`Ошибка: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Рендер формы по провайдеру ====================

  const renderProviderForm = () => {
    if (provider === 'dodofo') {
      return (
        <small className="pb-hint">
          dodofo — основной агрегатор. Токен задаётся в панели
          «Подключения» выше.
        </small>
      );
    }

    if (provider === 'intervals-icu') {
      return (
        <small className="pb-hint">
          intervals.icu подключён как источник активностей и wellness.
          API-ключ и athlete ID — в панели «Подключения» выше.
        </small>
      );
    }

    if (provider === 'dofek-zepp') {
      return (
        <small className="pb-hint">
          dofek-zepp — резервный провайдер Zepp. Логин и пароль —
          в панели «Подключения» выше.
        </small>
      );
    }

    return (
      <small className="pb-hint">
        Провайдер «{provider}» пока не реализован.
        Используй dodofo или intervals-icu.
      </small>
    );
  };

  // ==================== Сохранение Профиля ===============

  const handleSaveProfile = async () => {
    if (!api?.pb?.updateProfile) {
      setProfileError('electronAPI.pb.updateProfile недоступен');
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    setProfileSaved(false);
    try {
      const res = await api.pb.updateProfile({
        maxHr: profile.maxHr,
        lactateThresholdHr: profile.lthr,
        restingHr: profile.restingHr,
      });
      if (res?.success) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      } else {
        setProfileError(res?.error ?? 'Не удалось сохранить');
      }
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setProfileSaving(false);
    }
  };

  const [fitArchivePath, setFitArchivePath] = useState<string>('');
  const [archiveUpdating, setArchiveUpdating] = useState(false);
  const [archiveResult, setArchiveResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    total: number;
  } | null>(null);
  const [archiveError, setArchiveError] = useState('');

  const handlePickArchiveFolder = async (): Promise<string | null> => {
    if (!api?.pb?.pickDirectory) return null;
    const res = await api.pb.pickDirectory({
      title: 'Выберите папку с FIT-файлами Strava',
      defaultPath: fitArchivePath || undefined,
    });
    if (!res?.success || !res.path) return null;
    return res.path;
  };

  const handleUpdateFitArchive = async () => {
    if (!api?.pb?.importFitDir) {
      setArchiveError('electronAPI.pb.importFitDir недоступен');
      return;
    }
    setArchiveUpdating(true);
    setArchiveError('');
    setArchiveResult(null);

    try {
      let targetPath = fitArchivePath;
      if (!targetPath) {
        const picked = await handlePickArchiveFolder();
        if (!picked) {
          setArchiveUpdating(false);
          return; // отмена пользователя
        }
        targetPath = picked;
      }

      const res = await api.pb.importFitDir(targetPath, {
        origin: 'strava-archive',
        skipImported: false, // обновляем
        savePath: true,
      });

      if (res.success) {
        setFitArchivePath(targetPath);
        setArchiveResult({
          imported: res.imported ?? 0,
          updated: res.updated ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setArchiveError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setArchiveError((e as Error).message);
    } finally {
      setArchiveUpdating(false);
      setImportProgress(null);
    }
  };

  const handleChangeArchiveFolder = async () => {
    const picked = await handlePickArchiveFolder();
    if (!picked) return;
    setFitArchivePath(picked);
    // Сохраним путь сразу, без импорта
    try {
      await api.pb.importFitDir(picked, {
        skipImported: true,
        savePath: true,
      });
    } catch {
      // ignore
    }
  };

  const handleCancelImport = async () => {
    try {
      await api.pb.importCancel?.();
    } catch {
      // ignore
    }
  };

  const runImportPaths = async (
    paths: string[],
    opts?: { origin?: string; skipImported?: boolean }
  ) => {
    if (!api?.pb?.importFiles) {
      setArchiveError('electronAPI.pb.importFiles недоступен');
      return;
    }
    if (paths.length === 0) return;

    setArchiveUpdating(true);
    setArchiveError('');
    setArchiveResult(null);
    try {
      const res = await api.pb.importFiles(paths, {
        origin: opts?.origin ?? 'manual-import',
        skipImported: opts?.skipImported === true,
      });
      if (res.success) {
        setArchiveResult({
          imported: res.imported ?? 0,
          updated: res.updated ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setArchiveError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setArchiveError((e as Error).message);
    } finally {
      setArchiveUpdating(false);
      setImportProgress(null);
    }
  };

  const handlePickFiles = async () => {
    if (!api?.pb?.pickFiles) return;
    const res = await api.pb.pickFiles({ multiple: true });
    if (!res?.success || !Array.isArray(res.paths)) return;
    await runImportPaths(res.paths, { origin: importOrigin });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer?.files ?? []);
    const paths: string[] = [];
    for (const f of files) {
      try {
        const p = api.getPathForFile?.(f);
        if (p && typeof p === 'string') paths.push(p);
      } catch {
        // ignore
      }
    }
    await runImportPaths(paths, { origin: importOrigin });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleSyncWellness = async () => {
    if (!api?.pb?.syncWellness) {
      setWellnessError('electronAPI.pb.syncWellness недоступен');
      return;
    }
    if (!syncFrom || !syncTo) {
      setWellnessError('Укажите обе даты');
      return;
    }
    setSyncingWellness(true);
    setWellnessError('');
    setWellnessResult('');
    try {
      const res = await api.pb.syncWellness(
        undefined,
        toIsoDate(syncFrom),
        toIsoDate(syncTo)
      );
      if (res.success) {
        setWellnessResult(
          `Добавлено ${res.added} · обновлено ${res.updated} · всего ${res.total}`
        );
        await loadRecoveryLogs();
      } else {
        setWellnessError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setWellnessError((e as Error).message);
    } finally {
      setSyncingWellness(false);
    }
  };

  const handleIntervalsSave = async () => {
    if (!api?.pb?.intervalsSetup) return;
    if (!intervalsApiKey.trim() && !intervalsHasKey) {
      setIntervalsError('API key обязателен');
      return;
    }
    setIntervalsSaving(true);
    setIntervalsError('');
    setIntervalsInfo('');
    try {
      const res = await api.pb.intervalsSetup(
        intervalsApiKey.trim(),
        intervalsAthleteId.trim()
      );
      if (res.success) {
        setIntervalsHasKey(true);
        setIntervalsApiKey('');
        setIntervalsInfo('Ключ сохранён и проверен');
      } else {
        setIntervalsError(res.error ?? 'Ошибка');
      }
    } catch (e) {
      setIntervalsError((e as Error).message);
    } finally {
      setIntervalsSaving(false);
    }
  };

const handleSyncWellnessNew = async () => {
  if (!api?.pb?.syncWellness) return;
  if (!syncFrom || !syncTo) {
    setWellnessError('Укажите обе даты');
    return;
  }
  setSyncingWellness(true);
  setWellnessError('');
  setWellnessResult('');
  try {
    const res = await api.pb.syncWellness(
      undefined, // мультирежим: все провайдеры с wellness
      toIsoDate(syncFrom),
      toIsoDate(syncTo)
    );

    if (!res.success) {
      setWellnessError(res.error ?? 'Ошибка');
      return;
    }

    const perProvider: Array<{
      provider: string;
      added: number;
      updated: number;
      total: number;
      error?: string;
    }> = res.perProvider ?? [];

    const errors = perProvider.filter((p) => p.error);
    const ok = perProvider.filter((p) => !p.error);

    const summary = `Добавлено ${res.added} · обновлено ${res.updated} · всего ${res.total}`;

    if (errors.length > 0) {
      const errLines = errors
        .map((p) => `${p.provider}: ${p.error}`)
        .join('; ');
      // Показываем и сводку, и ошибки.
      setWellnessError(
        `${summary}. Ошибки — ${errLines}`
      );
    }

    if (ok.length > 0) {
      const okLines = ok
        .map((p) => `${p.provider}: +${p.added} ~${p.updated}`)
        .join(' · ');
      setWellnessResult(`${summary} · ${okLines}`);
    } else if (errors.length === 0) {
      setWellnessResult(summary);
    }

    await loadRecoveryLogs();
  } catch (e) {
    setWellnessError((e as Error).message);
  } finally {
    setSyncingWellness(false);
  }
};

  const loadRecoveryLogs = async () => {
    if (!api?.pb?.listRecoveryLogs) return;
    try {
      const res = await api.pb.listRecoveryLogs(
        toIsoDate(syncFrom),
        toIsoDate(syncTo)
      );
      if (res?.success) setRecoveryLogs(res.items ?? []);
    } catch {
      // ignore
    }
  };

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

  const handleImportStravaCsv = async () => {
    if (!api?.pb?.pickCsv || !api?.pb?.importStravaCsv) {
      setArchiveError('electronAPI.pb.pickCsv / importStravaCsv недоступен');
      return;
    }
    const picked = await api.pb.pickCsv();
    if (!picked?.success || !picked.path) return;

    setArchiveUpdating(true);
    setArchiveError('');
    setArchiveResult(null);
    try {
      const res = await api.pb.importStravaCsv(picked.path);
      if (res.success) {
        setArchiveResult({
          imported: res.added ?? 0,
          updated: res.updated ?? 0,
          skipped: 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setArchiveError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setArchiveError((e as Error).message);
    } finally {
      setArchiveUpdating(false);
    }
  };

  const handlePickZeppFolder = async (): Promise<string | null> => {
    if (!api?.pb?.pickDirectory) return null;
    const res = await api.pb.pickDirectory({
      title: 'Выберите папку с FIT-файлами Zepp',
      defaultPath: zeppArchivePath || undefined,
    });
    if (!res?.success || !res.path) return null;
    return res.path;
  };

  const handleChangeZeppFolder = async () => {
    const picked = await handlePickZeppFolder();
    if (!picked) return;
    setZeppArchivePath(picked);
    try {
      await api.pb.zeppArchivePathSet?.(picked);
    } catch { /* ignore */ }
  };

  const handleUpdateZepp = async () => {
    if (!api?.pb?.importZeppDir) {
      setZeppError('electronAPI.pb.importZeppDir недоступен');
      return;
    }
    setZeppUpdating(true);
    setZeppError('');
    setZeppResult(null);

    try {
      let target = zeppArchivePath;
      if (!target) {
        const picked = await handlePickZeppFolder();
        if (!picked) { setZeppUpdating(false); return; }
        target = picked;
      }

      const res = await api.pb.importZeppDir(target, {
        skipIfFileExists: true,
        savePath: true,
      });

      if (res.success) {
        setZeppArchivePath(target);
        setZeppResult({
          imported: res.imported ?? 0,
          skipped: res.skipped ?? 0,
          failed: res.failed ?? 0,
          total: res.total ?? 0,
        });
        await loadRunFacts();
      } else {
        setZeppError(res.error ?? 'Ошибка импорта');
      }
    } catch (e) {
      setZeppError((e as Error).message);
    } finally {
      setZeppUpdating(false);
      setImportProgress(null);
    }
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
        <Panel header="Профиль" className="shadow-5 mb-3 pb-panel">
          <div className="pb-profile__grid">
            <div className="pb-profile__field">
              <label className="pb-label" htmlFor="pb-profile-hrmax">
                HRmax
                {!profile.maxHr && <span className="pb-profile__missing">не задан</span>}
              </label>
              <InputNumber
                inputId="pb-profile-hrmax"
                value={profile.maxHr}
                onValueChange={(e) =>
                  setProfile((p) => ({ ...p, maxHr: e.value ?? null }))
                }
                placeholder="напр. 178"
                min={100}
                max={230}
                showButtons
                buttonLayout="horizontal"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                className="pb-debug__input"
              />
              <small className="pb-hint">
                Максимальный пульс.
                {profile.maxHrSource && (
                  <>
                    {' '}
                    <span className="pb-profile__src">
                      источник: {labelForSource(profile.maxHrSource)}
                    </span>
                  </>
                )}
              </small>
            </div>

            <div className="pb-profile__field">
              <label className="pb-label" htmlFor="pb-profile-lthr">
                LTHR
                {!profile.lthr && <span className="pb-profile__missing">не задан</span>}
              </label>
              <InputNumber
                inputId="pb-profile-lthr"
                value={profile.lthr}
                onValueChange={(e) =>
                  setProfile((p) => ({ ...p, lthr: e.value ?? null }))
                }
                placeholder="напр. 165"
                min={80}
                max={220}
                showButtons
                buttonLayout="horizontal"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                className="pb-debug__input"
              />
              <small className="pb-hint">
                Лактатный порог. Ключевой параметр для зон.
                {profile.lthrSource && (
                  <>
                    {' '}
                    <span className="pb-profile__src">
                      источник: {labelForSource(profile.lthrSource)}
                    </span>
                  </>
                )}
              </small>
            </div>

            <div className="pb-profile__field">
              <label className="pb-label" htmlFor="pb-profile-resthr">
                RestHR
                {!profile.restingHr && <span className="pb-profile__missing">не задан</span>}
              </label>
              <InputNumber
                inputId="pb-profile-resthr"
                value={profile.restingHr}
                onValueChange={(e) =>
                  setProfile((p) => ({ ...p, restingHr: e.value ?? null }))
                }
                placeholder="напр. 48"
                min={30}
                max={120}
                showButtons
                buttonLayout="horizontal"
                incrementButtonIcon="pi pi-plus"
                decrementButtonIcon="pi pi-minus"
                className="pb-debug__input"
              />
              <small className="pb-hint">
                Пульс покоя.
                {profile.restingHrSource && (
                  <>
                    {' '}
                    <span className="pb-profile__src">
                      источник: {labelForSource(profile.restingHrSource)}
                    </span>
                  </>
                )}
              </small>
            </div>
          </div>

          <div className="pb-profile__actions">
            <Button
              label={
                profileSaving
                  ? 'Сохранение…'
                  : profileSaved
                  ? 'Сохранено'
                  : 'Сохранить'
              }
              icon={
                profileSaving
                  ? 'pi pi-spin pi-spinner'
                  : profileSaved
                  ? 'pi pi-check'
                  : 'pi pi-save'
              }
              className="pb p-button-sm"
              onClick={handleSaveProfile}
              disabled={profileSaving}
            />
            <Button
              label="Перечитать"
              icon="pi pi-refresh"
              className="pb-soft p-button-sm"
              onClick={loadProfile}
              disabled={profileSaving}
            />
          </div>

          {profileError && (
            <Message severity="error" text={profileError} className="w-full mt-2" />
          )}
        </Panel>

        {/* ==================== ПОДКЛЮЧЕНИЯ ==================== */}
        <Panel header="Подключения" className="shadow-5 mb-3 pb-panel">
          <div className="pb-connections">
            {/* --- dodofo --- */}
            <div className="pb-connections__block">
              <div className="pb-connections__title">
                <i className="pi pi-link" /> dodofo
                {hasDodofoToken && (
                  <span className="pb-label-ok">✓ сохранён</span>
                )}
              </div>
              <div className="flex flex-column gap-2">
                <InputText
                  id="pb-dodofo-token"
                  value={dodofoToken}
                  onChange={(e) => setDodofoToken(e.target.value)}
                  placeholder="dodofo_..."
                  className="w-full"
                />
                <small className="pb-hint">
                  Токен создаётся в профиле dodofo.ru. Хранится
                  зашифрованным через safeStorage.
                </small>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    label={loading ? 'Сохранение...' : 'Сохранить токен'}
                    icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
                    className="pb p-button-sm"
                    onClick={handleSaveDodofo}
                    disabled={loading || !dodofoToken.trim()}
                  />
                  <Button
                    label={loading ? 'Проверка...' : 'Проверить'}
                    icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-question-circle'}
                    className="pb-soft p-button-sm"
                    onClick={handleCheck}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* --- intervals.icu --- */}
            <div className="pb-connections__block">
              <div className="pb-connections__title">
                <i className="pi pi-heart" /> intervals.icu
                {intervalsHasKey && (
                  <span className="pb-label-ok">✓ сохранён</span>
                )}
              </div>
              <div className="flex flex-column gap-2">
                <InputText
                  type="password"
                  value={intervalsApiKey}
                  onChange={(e) => setIntervalsApiKey(e.target.value)}
                  placeholder={
                    intervalsHasKey
                      ? '•••••••• (оставьте пустым)'
                      : 'ваш ключ из Settings → Developer'
                  }
                  className="w-full"
                />
                <InputText
                  value={intervalsAthleteId}
                  onChange={(e) => setIntervalsAthleteId(e.target.value)}
                  placeholder="i123456 — athlete id (или пусто для «self»)"
                  className="w-full"
                />
                <small className="pb-hint">
                  API-ключ: intervals.icu → Settings → Developer.
                  Athlete ID — из URL интерфейса, необязательно.
                </small>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    label={intervalsSaving ? 'Сохранение…' : 'Сохранить ключ'}
                    icon={intervalsSaving ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
                    className="pb p-button-sm"
                    onClick={handleIntervalsSave}
                    disabled={
                      intervalsSaving ||
                      (!intervalsApiKey.trim() && !intervalsHasKey)
                    }
                  />
                </div>
                {intervalsError && (
                  <Message severity="error" text={intervalsError} className="w-full" />
                )}
                {intervalsInfo && (
                  <Message severity="success" text={intervalsInfo} className="w-full" />
                )}
              </div>
            </div>

            {/* --- Zepp (резерв) --- */}
            <div className="pb-connections__block pb-connections__block--collapsed">
              <div className="pb-connections__title">
                <i className="pi pi-mobile" /> Zepp (резерв)
              </div>
              <div className="flex flex-column gap-2">
                <InputText
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full"
                />
                <InputText
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full"
                />
                <small className="pb-hint">
                  Резервный способ. Основной — dodofo и intervals.icu.
                </small>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    label={loading ? 'Подключение...' : 'Подключить'}
                    icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'}
                    className="pb p-button-sm"
                    onClick={handleConnectZepp}
                    disabled={loading || !email || !password}
                  />
                </div>
              </div>
            </div>

            {status && (
              <div className="pb-status">
                <code>{status}</code>
              </div>
            )}
          </div>
        </Panel>

        {/* ==================== СИНХРОНИЗАЦИЯ (API) ==================== */}
        <Panel header="Синхронизация (API)" className="shadow-5 mb-3 pb-panel">
          <div className="flex flex-column gap-3">
            <div className="flex flex-column gap-2">
              <label className="pb-label">Диапазон</label>
              <div className="flex gap-2 flex-wrap align-items-center">
                <Calendar
                  value={syncFrom}
                  onChange={(e) => setSyncFrom(e.value as Date)}
                  dateFormat="dd.mm.yy"
                  placeholder="С"
                  showIcon
                  className="pb-cal"
                  maxDate={syncTo ?? undefined}
                />
                <span className="pb-hint">—</span>
                <Calendar
                  value={syncTo}
                  onChange={(e) => setSyncTo(e.value as Date)}
                  dateFormat="dd.mm.yy"
                  placeholder="По"
                  showIcon
                  className="pb-cal"
                  minDate={syncFrom ?? undefined}
                />
                <Button
                  label="30 дней"
                  icon="pi pi-calendar"
                  className="pb-soft p-button-sm"
                  onClick={() => {
                    const r = defaultSyncRange();
                    setSyncFrom(r.from);
                    setSyncTo(r.to);
                  }}
                />
                <Button
                  label="За всё время"
                  icon="pi pi-calendar-plus"
                  className="pb-soft p-button-sm"
                  onClick={() => {
                    setSyncFrom(new Date(2020, 0, 1));
                    setSyncTo(new Date());
                  }}
                />
                <Button
                  label="+30 дней"
                  icon="pi pi-calendar"
                  className="pb-soft p-button-sm"
                  onClick={() => {
                    const now = new Date();
                    const to = new Date();
                    to.setDate(to.getDate() + 30);
                    setSyncFrom(now);
                    setSyncTo(to);
                  }}
                  tooltip="Текущий месяц + следующий"
                />
                <Button
                  label="+90 дней"
                  icon="pi pi-calendar-plus"
                  className="pb-soft p-button-sm"
                  onClick={() => {
                    const now = new Date();
                    const to = new Date();
                    to.setDate(to.getDate() + 90);
                    setSyncFrom(now);
                    setSyncTo(to);
                  }}
                  tooltip="Ближайший квартал"
                />
              </div>
            </div>

            <div className="flex flex-column gap-2">
              <label htmlFor="pb-provider" className="pb-label">
                Провайдер
              </label>
              <Dropdown
                inputId="pb-provider"
                value={provider}
                options={PROVIDER_OPTIONS}
                onChange={(e) => setProvider(e.value)}
                className="w-full"
                panelClassName="pb-dropdown-panel"
              />
              {renderProviderForm()}
            </div>

            <hr className="pb-sep" />

            <div className="flex flex-column gap-2">
              <label className="pb-label">Операции</label>
              <div className="flex gap-2 flex-wrap align-items-center">
                <Button
                  label={syncing ? 'Синхронизация...' : 'Синхронизировать'}
                  icon={syncing ? 'pi pi-spin pi-spinner' : 'pi pi-sync'}
                  className="pb p-button-sm"
                  onClick={handleSync}
                  disabled={syncing || !providerCaps?.workouts || !syncFrom || !syncTo}
                  tooltip={
                    !providerCaps?.workouts
                      ? `Провайдер «${provider}» не поддерживает список тренировок`
                      : 'Получить список активностей'
                  }
                />
                <Button
                  label={syncingStreams ? 'Потоки…' : 'Залить потоки'}
                  icon={syncingStreams ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-download'}
                  className="pb-soft p-button-sm"
                  onClick={handleSyncAllStreams}
                  disabled={syncingStreams || !providerCaps?.streams || !syncFrom || !syncTo}
                  tooltip={
                    !providerCaps?.streams
                      ? `Провайдер «${provider}» не поддерживает потоки`
                      : 'Загрузить FIT + потоки за выбранный период'
                  }
                />
                <label className="pb-check-row pb-checkbox-dark">
                  <Checkbox
                    inputId="pb-overwrite-streams"
                    checked={overwriteStreams}
                    onChange={(e) => {
                      const v = !!e.checked;
                      setOverwriteStreams(v);
                      try {
                        localStorage.setItem('pb.syncOverwriteStreams', v ? '1' : '0');
                      } catch { /* ignore */ }
                    }}
                  />
                  <span title="Перезаписать .msgpack у фактов, у которых потоки уже сохранены. Нужно, чтобы подтянуть GPS в старые dodofo-записи.">
                    Перезалить
                  </span>
                </label>
                <Button
                  label={syncingThresholds ? 'Пороги…' : 'Подтянуть пороги'}
                  icon={syncingThresholds ? 'pi pi-spin pi-spinner' : 'pi pi-sliders-h'}
                  className="pb-soft p-button-sm"
                  onClick={handleSyncThresholds}
                  disabled={syncingThresholds || !providerCaps?.thresholds}
                  tooltip={
                    !providerCaps?.thresholds
                      ? `Провайдер «${provider}» не поддерживает пороги`
                      : 'Забрать пороги в профиль'
                  }
                />
                <Button
                  label={syncingZones ? 'Зоны…' : 'Подтянуть зоны'}
                  icon={syncingZones ? 'pi pi-spin pi-spinner' : 'pi pi-chart-bar'}
                  className="pb-soft p-button-sm"
                  onClick={handleSyncZones}
                  disabled={syncingZones}
                  tooltip="Читает HR-зоны из последней активности ICU"
                />
                <Button
                  label={syncingWellness ? 'Здоровье…' : 'Подтянуть Здоровье (ICU + dodofo)'}
                  icon={syncingWellness ? 'pi pi-spin pi-spinner' : 'pi pi-heart'}
                  className="pb-soft p-button-sm"
                  onClick={handleSyncWellnessNew}
                  disabled={syncingWellness || !syncFrom || !syncTo}
                  tooltip={
                    'Сон, HRV, пульс покоя (из intervals.icu и dodofo)'
                  }
                />
                <Button
                  label="Отладка"
                  icon="pi pi-code"
                  className="pb-soft p-button-sm"
                  onClick={() => setDebugVisible(true)}
                  tooltip="Сырые ответы провайдеров API"
                />
              </div>
              <small className="pb-hint">
                Повторный запуск за тот же период не создаёт дубликаты —
                обновляет существующие записи.
              </small>
            </div>

            {syncingStreams && syncStreamsProgress && (
              <div className="pb-import-progress">
                <div className="pb-import-progress__header">
                  <span>
                    {syncStreamsProgress.current} / {syncStreamsProgress.total}
                    {' · '}
                    <code>{syncStreamsProgress.externalId ?? '—'}</code>
                  </span>
                  <Button
                    label="Отмена"
                    icon="pi pi-times"
                    className="pb-soft p-button-sm"
                    onClick={handleCancelSyncStreams}
                  />
                </div>
                <ProgressBar
                  value={Math.round(
                    (syncStreamsProgress.current / syncStreamsProgress.total) * 100
                  )}
                  showValue={false}
                  style={{ height: '6px' }}
                />
                <div className="pb-import-progress__stats">
                  <span>+{syncStreamsProgress.fetched}</span>
                  <span>·{syncStreamsProgress.skipped}</span>
                  {syncStreamsProgress.failed > 0 && (
                    <span className="pb-import-progress__fail">
                      ✗{syncStreamsProgress.failed}
                    </span>
                  )}
                </div>
              </div>
            )}

            {syncError && (
              <Message severity="error" text={syncError} className="w-full" />
            )}
            {syncResult && (
              <Message
                severity={syncResult.added > 0 ? 'success' : 'info'}
                className="w-full"
                content={
                  <span>
                    Добавлено: <b>{syncResult.added}</b>
                    {' · '}Обновлено: <b>{syncResult.updated}</b>
                    {' · '}Всего из источника: <b>{syncResult.total}</b>
                  </span>
                }
              />
            )}
            {streamsAllError && (
              <Message severity="error" text={streamsAllError} className="w-full" />
            )}
            {streamsAllResult && (
              <Message
                severity={streamsAllResult.failed > 0 ? 'warn' : 'info'}
                className="w-full"
                content={
                  <div>
                    <span>
                      Потоки: загружено <b>{streamsAllResult.fetched}</b>
                      {' · '}пропущено <b>{streamsAllResult.skipped}</b>
                      {streamsAllResult.failed > 0 && (
                        <> · ошибок <b>{streamsAllResult.failed}</b></>
                      )}
                    </span>
                    {streamsAllResult.skipped > 0 && !overwriteStreams && (
                      <div className="pb-hint" style={{ marginTop: '0.4rem' }}>
                        Часть потоков уже была в БД и не обновлялась. Включите
                        «Перезалить существующие», чтобы перекачать с GPS.
                      </div>
                    )}
                  </div>
                }
              />
            )}
            {thresholdsError && (
              <Message severity="error" text={thresholdsError} className="w-full" />
            )}
            {thresholdsResult && (
              <Message
                severity="success"
                className="w-full"
                content={<span>Пороги обновлены: <b>{thresholdsResult}</b></span>}
              />
            )}
            {zonesError && (
              <Message severity="error" text={zonesError} className="w-full" />
            )}
            {zonesResult && (
              <Message
                severity="success"
                className="w-full"
                content={<span>HR-зоны: <b>{zonesResult}</b></span>}
              />
            )}
            {wellnessError && (
              <Message severity="error" text={wellnessError} className="w-full" />
            )}
            {wellnessResult && (
              <Message
                severity="success"
                className="w-full"
                content={<span>Здоровье: {wellnessResult}</span>}
              />
            )}
          </div>
        </Panel>

        {/* ==================== ИМПОРТ ФАЙЛОВ ==================== */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`pb-archive-dropzone ${dragActive ? 'pb-archive-dropzone--active' : ''}`}
        >
          <Panel header="Импорт файлов" className="shadow-5 mb-3 pb-panel">
            <div className="flex flex-column gap-2">
              <div className="pb-archive-origin">
                <label className="pb-label">Откуда файлы</label>
                <Dropdown
                  value={importOrigin}
                  options={IMPORT_ORIGIN_OPTIONS}
                  onChange={(e) => setImportOrigin(e.value)}
                  className="pb-archive-origin__dropdown"
                  panelClassName="pb-dropdown-panel"
                />
                <small className="pb-hint">
                  Метка источника сохраняется при первом импорте и не меняется
                  при повторных загрузках того же файла.
                </small>
              </div>
            </div>
            <div className="flex flex-column gap-2">
              <label className="pb-label">Путь к папке с FIT/TCX-файлами</label>
              <div className="flex gap-2 flex-wrap align-items-center">
                <span className="pb-archive-path" title={fitArchivePath || undefined}>
                  {fitArchivePath || <i>папка не выбрана</i>}
                </span>
                <Button
                  label={fitArchivePath ? 'Сменить папку' : 'Выбрать папку'}
                  icon="pi pi-folder-open"
                  className="pb-soft p-button-sm"
                  onClick={handleChangeArchiveFolder}
                  disabled={archiveUpdating}
                />
                <Button
                  label={archiveUpdating ? 'Обновление…' : 'Обновить архив'}
                  icon={archiveUpdating ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                  className="pb p-button-sm"
                  onClick={handleUpdateFitArchive}
                  disabled={archiveUpdating}
                />
                <Button
                  label="Импортировать файлы"
                  icon="pi pi-upload"
                  className="pb-soft p-button-sm"
                  onClick={handlePickFiles}
                  disabled={archiveUpdating}
                  tooltip="Выбрать отдельные FIT/TCX файлы для импорта"
                />
                <Button
                  label="Импорт Strava CSV"
                  icon="pi pi-file-import"
                  className="pb-soft p-button-sm"
                  onClick={handleImportStravaCsv}
                  disabled={archiveUpdating}
                  tooltip="Импортировать activities.csv из архива Strava"
                />
              </div>
              <small className="pb-hint">
                Перетащите FIT/TCX файлы в эту панель, чтобы импортировать их
                без выбора папки.
              </small>
            </div>

            {archiveUpdating && importProgress && (
              <div className="pb-import-progress">
                <div className="pb-import-progress__header">
                  <span>
                    {importProgress.current} / {importProgress.total}
                    {' · '}
                    <code>{importProgress.filename}</code>
                  </span>
                  <Button
                    label="Отмена"
                    icon="pi pi-times"
                    className="pb-soft p-button-sm"
                    onClick={handleCancelImport}
                  />
                </div>
                <ProgressBar
                  value={Math.round(
                    (importProgress.current / importProgress.total) * 100
                  )}
                  showValue={false}
                  style={{ height: '6px' }}
                />
                <div className="pb-import-progress__stats">
                  <span>+{importProgress.imported}</span>
                  <span>~{importProgress.updated}</span>
                  <span>·{importProgress.skipped}</span>
                  {importProgress.failed > 0 && (
                    <span className="pb-import-progress__fail">
                      ✗{importProgress.failed}
                    </span>
                  )}
                </div>
              </div>
            )}

            {archiveError && (
              <Message severity="error" text={archiveError} className="w-full mt-2" />
            )}

            {archiveResult && (
              <Message
                severity={archiveResult.failed > 0 ? 'warn' : 'success'}
                className="w-full mt-2"
                content={
                  <span>
                    Добавлено <b>{archiveResult.imported}</b>
                    {' · '}обновлено <b>{archiveResult.updated}</b>
                    {archiveResult.skipped > 0 && (
                      <> · пропущено <b>{archiveResult.skipped}</b></>
                    )}
                    {archiveResult.failed > 0 && (
                      <> · ошибок <b>{archiveResult.failed}</b></>
                    )}
                    {' · '}всего файлов <b>{archiveResult.total}</b>
                  </span>
                }
              />
            )}
            <hr className="pb-sep" />

            <div className="flex flex-column gap-2">
              <label className="pb-label">Папка с FIT-файлами Zepp (Yandex.Disk)</label>
              <div className="flex gap-2 flex-wrap align-items-center">
                <span className="pb-archive-path" title={zeppArchivePath || undefined}>
                  {zeppArchivePath || <i>папка не выбрана</i>}
                </span>
                <Button
                  label={zeppArchivePath ? 'Сменить папку' : 'Выбрать папку'}
                  icon="pi pi-folder-open"
                  className="pb-soft p-button-sm"
                  onClick={handleChangeZeppFolder}
                  disabled={zeppUpdating}
                />
                <Button
                  label={zeppUpdating ? 'Обновление…' : 'Обновить Zepp'}
                  icon={zeppUpdating ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                  className="pb p-button-sm"
                  onClick={handleUpdateZepp}
                  disabled={zeppUpdating}
                  tooltip="Импортировать только те тренировки, которых ещё нет"
                />
              </div>
              <small className="pb-hint">
                Тренировки, уже загруженные через Strava-архив (± 2 мин
                по времени старта), будут пропущены.
              </small>
            </div>

            {zeppUpdating && importProgress && (
              <div className="pb-import-progress">
                <div className="pb-import-progress__header">
                  <span>
                    {importProgress.current} / {importProgress.total}
                    {' · '}
                    <code>{importProgress.filename}</code>
                  </span>
                  <Button
                    label="Отмена"
                    icon="pi pi-times"
                    className="pb-soft p-button-sm"
                    onClick={handleCancelImport}
                  />
                </div>
                <ProgressBar
                  value={Math.round(
                    (importProgress.current / importProgress.total) * 100
                  )}
                  showValue={false}
                  style={{ height: '6px' }}
                />
                <div className="pb-import-progress__stats">
                  <span>+{importProgress.imported}</span>
                  <span>·{importProgress.skipped}</span>
                  {importProgress.failed > 0 && (
                    <span className="pb-import-progress__fail">
                      ✗{importProgress.failed}
                    </span>
                  )}
                </div>
              </div>
            )}

            {zeppUpdating && importProgress && (
              <div className="pb-import-progress">
                <div className="pb-import-progress__header">
                  <span>
                    {importProgress.current} / {importProgress.total}
                    {' · '}
                    <code>{importProgress.filename}</code>
                  </span>
                  <Button
                    label="Отмена"
                    icon="pi pi-times"
                    className="pb-soft p-button-sm"
                    onClick={handleCancelImport}
                  />
                </div>
                <ProgressBar
                  value={Math.round(
                    (importProgress.current / importProgress.total) * 100
                  )}
                  showValue={false}
                  style={{ height: '6px' }}
                />
                <div className="pb-import-progress__stats">
                  <span>+{importProgress.imported}</span>
                  <span>~{importProgress.updated}</span>
                  <span>·{importProgress.skipped}</span>
                  {importProgress.failed > 0 && (
                    <span className="pb-import-progress__fail">
                      ✗{importProgress.failed}
                    </span>
                  )}
                </div>
              </div>
            )}

            {zeppError && (
              <Message severity="error" text={zeppError} className="w-full mt-2" />
            )}

            {zeppResult && (
              <Message
                severity={zeppResult.failed > 0 ? 'warn' : 'success'}
                className="w-full mt-2"
                content={
                  <span>
                    Zepp: добавлено <b>{zeppResult.imported}</b>
                    {' · '}пропущено <b>{zeppResult.skipped}</b>
                    {zeppResult.failed > 0 && (
                      <> · ошибок <b>{zeppResult.failed}</b></>
                    )}
                    {' · '}всего <b>{zeppResult.total}</b>
                  </span>
                }
              />
            )}
          </Panel>
        </div>

        {/* ==================== WELLNESS (таблица) ==================== */}
        <Panel header="Здоровье" className="shadow-5 mb-3 pb-panel">
          {recoveryLogs.length === 0 ? (
            <small className="pb-hint">
              Нет данных за выбранный диапазон. Нажмите «Подтянуть Здоровье»
              в панели «Синхронизация (API)».
            </small>
          ) : (
            <div className="pb-wellness-table pb-wellness-table--scrollable">
              <div className="pb-wellness-table__header">
                <span>Дата</span>
                <span title="Пульс покоя">RHR</span>
                <span title="Сон, часов">Сон</span>
                <span title="Sleep score">Score</span>
                <span title="Шаги">Шаги</span>
                <span title="Chronic Training Load">CTL</span>
                <span title="Acute Training Load">ATL</span>
              </div>
              <div className="pb-wellness-table__body">
                {recoveryLogs.map((r) => {
                  const avgRhr =
                    recoveryLogs.filter((x) => x.resting_hr != null).reduce(
                      (a, x) => a + x.resting_hr,
                      0
                    ) /
                    (recoveryLogs.filter((x) => x.resting_hr != null).length || 1);
                  const rhrCls =
                    r.resting_hr == null
                      ? ''
                      : r.resting_hr <= avgRhr - 2
                      ? 'pb-wellness-table__val--good'
                      : r.resting_hr >= avgRhr + 3
                      ? 'pb-wellness-table__val--warn'
                      : '';

                  return (
                    <div
                      key={r.date}
                      className="pb-wellness-table__row pb-wellness-table__row--clickable"
                      onClick={() => {
                        setSelectedRecovery(r as RecoveryLogLite);
                        setWellnessDrawerVisible(true);
                      }}
                      title="Открыть полную карточку дня"
                    >
                      <span className="pb-wellness-table__date">
                        {r.date}
                      </span>
                      <span className={`pb-wellness-table__val ${rhrCls}`}>
                        {r.resting_hr ?? '—'}
                      </span>
                      <span className="pb-wellness-table__val">
                        {r.sleep_hours != null ? r.sleep_hours.toFixed(1) : '—'}
                      </span>
                      <span className="pb-wellness-table__val">
                        {r.sleep_score ?? '—'}
                      </span>
                      <span className="pb-wellness-table__val">
                        {r.steps != null ? r.steps.toLocaleString('ru-RU') : '—'}
                      </span>
                      <span className="pb-wellness-table__val pb-wellness-table__val--dim">
                        {r.ctl != null ? r.ctl.toFixed(1) : '—'}
                      </span>
                      <span className="pb-wellness-table__val pb-wellness-table__val--dim">
                        {r.atl != null ? r.atl.toFixed(1) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>

        <Panel header="Календарь" className="shadow-5 mb-3 pb-panel">
          <CalendarPanel
            loadRange={handleLoadCalendarRange}
            onDayClick={(d) => setDayDrawerDate(d)}
          />
        </Panel>

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
        />

        <Panel
          header={
            activeFilterCount > 0
              ? `Пробежки (${filteredFacts.length} из ${groupedFacts.length})`
              : `Пробежки (${groupedFacts.length}${
                  groupedFacts.length !== runFacts.length
                    ? ` · ${runFacts.length} записей`
                    : ''
                })`
          }
          className="shadow-5 mb-3 pb-panel"
        >
          {factsError && (
            <Message severity="error" text={factsError} className="w-full mb-2" />
          )}

          <RunFiltersPanel
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            activeCount={activeFilterCount}
          />

          <DataTable
            value={filteredFacts}
            loading={factsLoading}
            size="small"
            stripedRows
            scrollable
            scrollHeight="520px"
            virtualScrollerOptions={{ itemSize: 38 }}
            emptyMessage="За выбранный период пробежек нет"
            className="p-datatable-sm"
            selectionMode="single"
            onRowClick={(e) => {
              const g = e.data as GroupedRunFact;
              setSelectedFact({
                ...(g.primary as RunFactLite),
                start_time: g.startTime,
              });
              setDrawerVisible(true);
            }}
          >
            <Column
              header=""
              style={{ width: '40px', textAlign: 'center' }}
              body={(r: GroupedRunFact) =>
                r.hasStreams ? (
                  <i
                    className="pi pi-chart-line"
                    style={{ color: 'var(--pb-accent)' }}
                    title="Есть потоки"
                  />
                ) : (
                  <i
                    className="pi pi-minus"
                    style={{ opacity: 0.25 }}
                    title="Потоков нет"
                  />
                )
              }
            />
            <Column
              field="date"
              header="Дата"
              sortable
              style={{ width: '140px' }}
              body={(r: GroupedRunFact) => {
                let time = '';
                if (r.startTime) {
                  const t = new Date(r.startTime);
                  if (!Number.isNaN(t.getTime())) {
                    time = ` ${String(t.getHours()).padStart(2, '0')}:${String(
                      t.getMinutes()
                    ).padStart(2, '0')}`;
                  }
                }
                return (
                  <span title={`Источников: ${r.count}`}>
                    {r.date}
                    {time}
                  </span>
                );
              }}
            />
            <Column
              header="Название"
              style={{ width: '220px' }}
              body={(r: GroupedRunFact) => r.displayName}
            />
            <Column
              header="Км"
              sortable
              sortField="primary.actual_km"
              style={{ width: '80px' }}
              body={(r: GroupedRunFact) => fmtKm(r.primary.actual_km)}
            />
            <Column
              header="Темп"
              style={{ width: '80px' }}
              body={(r: GroupedRunFact) => r.primary.actual_pace ?? '—'}
            />
            <Column
              header="Время"
              style={{ width: '100px' }}
              body={(r: GroupedRunFact) => fmtDuration(r.primary.duration_sec)}
            />
            <Column
              header="Ср. пульс"
              style={{ width: '100px' }}
              body={(r: GroupedRunFact) => r.primary.avg_hr ?? '—'}
            />
            <Column
              header="Макс. пульс"
              style={{ width: '110px' }}
              body={(r: GroupedRunFact) => r.primary.max_hr ?? '—'}
            />
            <Column
              header="Источники"
              style={{ width: '160px' }}
              body={(r: GroupedRunFact) => (
                <div className="pb-source-badges">
                  {r.sources.map((s, i) => (
                    <span
                      key={`${r.date}-${s}-${i}`}
                      className={`pb-source-badge pb-source-badge--${s}`}
                      title={s}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            />
          </DataTable>
        </Panel>

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

        <WellnessDrawer
          visible={wellnessDrawerVisible}
          log={selectedRecovery}
          onHide={() => setWellnessDrawerVisible(false)}
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