// src/components/PRANA_BINDU/RouteMapEditor.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';
import {
  Map as MapLibreMap,
  Marker,
  LngLatBounds,
  NavigationControl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { groupRunFacts, type GroupedRunFact } from './UTILS/groupRunFacts';
import {
  RasterLayer,
  getSavedLayers,
  saveLayers,
  getOsmStyleObject,
  DEFAULT_LAYERS,
  TrackSettings,
  getSavedTrackSettings,
  saveTrackSettings,
  DEFAULT_TRACK_SETTINGS,
  GradientChannel,
  GradientSettings,
  getSavedGradient,
  saveGradient,
  PALETTES,
} from './mapStyles';
import { StoryGeneratorDialog } from './StoryGeneratorDialog';
import { TestCandidatesDialog } from './TestCandidatesDialog';
import { MedianTrackDialog } from './MedianTrackDialog';
import { EditReferenceDialog } from './EditReferenceDialog';
import {
  buildRefIndex,
  computeDeviationFast,
  classifyCoverage,
  type RefIndex,
  type FastDeviationResult,
  type CoverageClass,
} from './UTILS/coverageIndex';
import {
  getSavedCoverageThresholds,
  saveCoverageThresholds,
  DEFAULT_COVERAGE_THRESHOLDS,
  type CoverageThresholds,
} from './UTILS/coverageThresholds';
import {
  getSavedAllRefsStyles,
  saveAllRefsStyles,
  DEFAULT_ALL_REFS_STYLES,
  type AllRefsStyles,
} from './UTILS/allRefsStyles';
import { geometricLength, simplifyDP } from './UTILS/medianTrack';

interface Props {
  visible: boolean;
  onHide: () => void;
  initialRunId?: number;
}

type TabType = 'runs' | 'filters' | 'thresholds' | 'refs';

const HEADER_HEIGHT = 56;
const CHUNK_SIZE = 25;

// ==================== Утилиты для градиента ====================

function computeStats(values: (number | null)[] | undefined): { min: number; max: number } | null {
  if (!values || values.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
      count++;
    }
  }
  return count > 0 ? { min, max } : null;
}

function buildColorExpression(
  channel: GradientChannel,
  paletteKey: string,
  dataStats: { min: number; max: number } | null,
  fallbackColor: string
): any {
  if (channel === 'none' || !dataStats) return fallbackColor;
  const palette = PALETTES[paletteKey];
  if (!palette) return fallbackColor;

  const stops = palette.stops.map((s) => {
    const actualV = palette.absolute
      ? s.v
      : dataStats.min + (dataStats.max - dataStats.min) * s.v;
    return [actualV, s.c];
  });

  return [
    'coalesce',
    ['interpolate', ['linear'], ['get', channel], ...stops.flat()],
    fallbackColor,
  ];
}

// ==================== Утилиты для тестовых отрезков ====================

interface TestPoint {
  lat: number;
  lng: number;
}

interface TestDuration {
  type: 'time' | 'distance';
  value: number; // секунды или метры
}

const TEST_POINT_KEY = 'pb.testPoint';
const TEST_DURATION_KEY = 'pb.testDuration';

function loadTestPoint(): TestPoint | null {
  try {
    const raw = localStorage.getItem(TEST_POINT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.lat === 'number' && typeof p?.lng === 'number') {
      return { lat: p.lat, lng: p.lng };
    }
    return null;
  } catch {
    return null;
  }
}

function saveTestPoint(p: TestPoint | null): void {
  try {
    if (p) localStorage.setItem(TEST_POINT_KEY, JSON.stringify(p));
    else localStorage.removeItem(TEST_POINT_KEY);
  } catch { /* ignore */ }
}

function loadTestDuration(): TestDuration {
  try {
    const raw = localStorage.getItem(TEST_DURATION_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d?.type === 'time' || d?.type === 'distance') {
        return { type: d.type, value: Number(d.value) || 1200 };
      }
    }
  } catch { /* ignore */ }
  return { type: 'time', value: 1200 }; // 20 минут
}

function saveTestDuration(d: TestDuration): void {
  try {
    localStorage.setItem(TEST_DURATION_KEY, JSON.stringify(d));
  } catch { /* ignore */ }
}

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestIdx(
  latlng: (number | null)[][] | undefined,
  point: TestPoint
): number {
  if (!latlng || latlng.length === 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < latlng.length; i++) {
    const p = latlng[i];
    if (!p || p[0] == null || p[1] == null) continue;
    const d = haversineM(p[0], p[1], point.lat, point.lng);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function findEndIdxByTime(
  secT: number[] | undefined,
  startIdx: number,
  targetSec: number
): number {
  if (!secT || secT.length === 0) return startIdx;
  const startSec = secT[startIdx];
  for (let i = startIdx + 1; i < secT.length; i++) {
    if (secT[i] - startSec >= targetSec) return i;
  }
  return secT.length - 1;
}

function findEndIdxByDist(
  distM: number[] | undefined,
  latlng: (number | null)[][] | undefined,
  startIdx: number,
  targetM: number
): number {
  if (distM && distM.length > 0) {
    const startM = distM[startIdx];
    for (let i = startIdx + 1; i < distM.length; i++) {
      if (distM[i] - startM >= targetM) return i;
    }
    return distM.length - 1;
  }
  // fallback: считаем haversine накоплением
  if (!latlng) return startIdx;
  let cum = 0;
  for (let i = startIdx + 1; i < latlng.length; i++) {
    const a = latlng[i - 1];
    const b = latlng[i];
    if (!a || !b) continue;
    const aLat = a[0];
    const aLng = a[1];
    const bLat = b[0];
    const bLng = b[1];
    if (aLat == null || aLng == null || bLat == null || bLng == null) continue;
    cum += haversineM(aLat, aLng, bLat, bLng);
    if (cum >= targetM) return i;
  }
  return latlng.length - 1;
}

interface SegmentStats {
  durationSec: number;
  distanceM: number;
  paceSecPerKm: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrDriftPct: number | null;
  cadenceAvg: number | null;
}

function computeSegmentStats(
  streams: any,
  startIdx: number,
  endIdx: number
): SegmentStats {
  const secT = streams?.secT as number[] | undefined;
  const distM = streams?.distM as number[] | undefined;
  const hr = streams?.hr as (number | null)[] | undefined;
  const cadence = streams?.cadence as (number | null)[] | undefined;

  const durationSec =
    secT && secT[endIdx] != null && secT[startIdx] != null
      ? secT[endIdx] - secT[startIdx]
      : 0;
  const distanceM =
    distM && distM[endIdx] != null && distM[startIdx] != null
      ? distM[endIdx] - distM[startIdx]
      : 0;
  const paceSecPerKm =
    distanceM > 0 && durationSec > 0
      ? durationSec / (distanceM / 1000)
      : null;

  const hrs = (hr?.slice(startIdx, endIdx + 1) ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  const hrAvg =
    hrs.length > 0 ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;
  const hrMax = hrs.length > 0 ? Math.max(...hrs) : null;

  let hrDriftPct: number | null = null;
  if (hrs.length >= 4) {
    const mid = Math.floor(hrs.length / 2);
    const a1 = hrs.slice(0, mid);
    const a2 = hrs.slice(mid);
    const avg1 = a1.reduce((s, v) => s + v, 0) / a1.length;
    const avg2 = a2.reduce((s, v) => s + v, 0) / a2.length;
    if (avg1 > 0) hrDriftPct = ((avg2 - avg1) / avg1) * 100;
  }

  const cads = (cadence?.slice(startIdx, endIdx + 1) ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  const cadenceAvg =
    cads.length > 0 ? cads.reduce((s, v) => s + v, 0) / cads.length : null;

  return {
    durationSec,
    distanceM,
    paceSecPerKm,
    hrAvg,
    hrMax,
    hrDriftPct,
    cadenceAvg,
  };
}

function fmtSecAsPace(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSecAsDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${String(s).padStart(2, '0')}с`;
  return `${s}с`;
}

// ==================== Отклонение от эталона (C.5-A4a) ====================

// Метрики конкретного атома для текущего выбранного трека.
// Берутся из того же `batchCoverage` (computeDeviationFast),
// что и классификация used/similar, — поэтому цифры в карточке
// совпадают с бейджем «Пройдено / Похоже».
//
// Раньше здесь жила отдельная `computeDeviation` (полная медиана по
// всем точкам трека), что давало расхождения с классификатором
// (медиана 193–247 м в карточке против 30 м в бейдже).
// Унифицировано 2026-10-27 (см. 18b_ATOM_CHAINS.md).

// ==================== Компонент ====================

export const RouteMapEditor: React.FC<Props> = ({ visible, onHide, initialRunId }) => {
  const api = (window as any).electronAPI;

  const [rawFacts, setRawFacts] = useState<any[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);

  const [selectedGroup, setSelectedGroup] = useState<GroupedRunFact | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [streamsPayload, setStreamsPayload] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<TabType>('runs');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pb.mapEditor.leftPanelWidth');
      if (saved) {
        const n = Number(saved);
        if (n >= 280 && n <= 800) return n;
      }
    } catch {
      /* ignore */
    }
    return 380;
  });

  // Слои карты
  const [layers, setLayers] = useState<RasterLayer[]>(() => getSavedLayers());
  const [activeLayerId, setActiveLayerId] = useState<string>(layers[0]?.id || '');

  // Настройки трека
  const [trackSettings, setTrackSettings] = useState<TrackSettings>(() => getSavedTrackSettings());

  // Настройки градиента
  const [gradient, setGradient] = useState<GradientSettings>(() => getSavedGradient());

  const [loadingStreams, setLoadingStreams] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const leftPanelWidthRef = useRef(leftPanelWidth);
  useEffect(() => {
    leftPanelWidthRef.current = leftPanelWidth;
  }, [leftPanelWidth]);

  // Разметка / тестовая точка
  const [markupMode, setMarkupMode] = useState(false);
  const [testPoint, setTestPoint] = useState<TestPoint | null>(() => loadTestPoint());
  const [testDuration, setTestDuration] = useState<TestDuration>(() => loadTestDuration());
  const [testVisible, setTestVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.testVisible') !== '0';
    } catch {
      return true;
    }
  });
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');

    // Тестовые отрезки (C.2)
  const [segments, setSegments] = useState<
    Array<{
      id: number;
      runFactId: number;
      durationType: 'time' | 'distance';
      durationValue: number;
      distanceM: number;
      durationSec: number;
      paceSecPerKm: number | null;
      hrAvg: number | null;
      hrMax: number | null;
      hrDriftPct: number | null;
      cadenceAvg: number | null;
      note: string | null;
      createdAt: string;
    }>
  >([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [candidatesVisible, setCandidatesVisible] = useState(false);
  // Медианный трек
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [medianDialogVisible, setMedianDialogVisible] = useState(false);
  // Эталонные маршруты (C.5, фаза A3)
  const [referenceTracks, setReferenceTracks] = useState<
    Array<{
      id: number;
      name: string;
      coords: [number, number][];
      lengthM: number;
      kind: 'loop' | 'linear' | 'stadium' | null;
      /** Свободная строка: базовая или кастомная категория. */
      category: string | null;
      tags: string[];
      notes: string | null;
      createdAt: string;
    }>
  >([]);
  const [refTracksLoading, setRefTracksLoading] = useState(false);
  const [selectedRefTrackId, setSelectedRefTrackId] = useState<number | null>(null);
  const [editRefVisible, setEditRefVisible] = useState(false);
  const [editRefItem, setEditRefItem] = useState<{
    id: number;
    name: string;
    category: string | null;
    tags: string[];
  } | null>(null);
  // --- Режим редактирования точек эталона (P1) ---
  const [editPointsMode, setEditPointsMode] = useState(false);
  const [editPointsRefId, setEditPointsRefId] = useState<number | null>(null);
  const [showAllRefs, setShowAllRefs] = useState(false);
  const [allRefsStyles, setAllRefsStyles] = useState<AllRefsStyles>(
    () => getSavedAllRefsStyles(),
  );
  const allRefsStylesRef = useRef(allRefsStyles);
  useEffect(() => {
    allRefsStylesRef.current = allRefsStyles;
  }, [allRefsStyles]);
  const [editPointsDraft, setEditPointsDraft] = useState<[number, number][]>([]);
  const [editPointsDpEpsilon, setEditPointsDpEpsilon] = useState<number>(5);
  const [editPointsSaveStatus, setEditPointsSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [editPointsSaveError, setEditPointsSaveError] = useState('');
    // --- Режим «Разделить на атомы» (внутри editPoints) ---
  const [splitMode, setSplitMode] = useState(false);
  const [splitBoundaries, setSplitBoundaries] = useState<Set<number>>(new Set());
  const [splitDeleteSource, setSplitDeleteSource] = useState(true);
  const [splitSaveStatus, setSplitSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  // --- B.1: batch-coverage ---
  const [coverageThresholds, setCoverageThresholds] =
    useState<CoverageThresholds>(() => getSavedCoverageThresholds());
  // --- B.3: Секции и фильтр по атому ---
  const [filterByRefId, setFilterByRefId] = useState<number | null>(null);
  // Когда фильтр по атому включён: показывать только пробежки, где
  // этот атом — primary (а не просто «задет»). По умолчанию false —
  // показываем все «задетые» (старое поведение).
  const [filterOnlyPrimary, setFilterOnlyPrimary] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.mapEditor.onlyPrimaryFilter') === '1';
    } catch {
      return false;
    }
  });
  const [expandedRefGroups, setExpandedRefGroups] = useState<Set<string>>(new Set());
  const [groupedRunsView, setGroupedRunsView] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pb.mapEditor.groupedRuns') !== '0';
    } catch {
      return true;
    }
  });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(['similar', 'unused'])
  );
  const [batchLatlng, setBatchLatlng] = useState<
    Map<number, { latlng: [number, number][]; lengthM: number }>
  >(new Map());
  const refIndexesCacheRef = useRef<Map<number, RefIndex>>(new Map());
  const coverageCacheRef = useRef<
    Map<number, Map<number, FastDeviationResult>>
  >(new Map());
  const [splitSaveError, setSplitSaveError] = useState('');
  const editMarkersRef = useRef<Marker[]>([]);
  const editPointsDraftRef = useRef<[number, number][]>([]);
  useEffect(() => {
    editPointsDraftRef.current = editPointsDraft;
  }, [editPointsDraft]);

  const editDraftLength = useMemo(
    () => (editPointsMode ? geometricLength(editPointsDraft) : 0),
    [editPointsMode, editPointsDraft],
  );

  // Хелпер: метрики конкретного атома для текущего выбранного трека.
  // Источник — batchCoverage (тот же computeDeviationFast, что и бейдж),
  // поэтому цифры совпадают с классификацией.
  const getRefCoverage = (refId: number) => {
    if (!selectedGroup) return null;
    const covs = batchCoverage.get(selectedGroup.primary.id);
    return covs?.find((c) => c.refId === refId) ?? null;
  };

  const editPointsSourceAtom = useMemo(
    () =>
      editPointsRefId
        ? referenceTracks.find((r) => r.id === editPointsRefId) ?? null
        : null,
    [editPointsRefId, referenceTracks],
  );

  const splitParts = useMemo(() => {
    if (!splitMode || editPointsDraft.length < 2) return [];
    const validBounds = [...splitBoundaries]
      .filter((idx) => idx > 0 && idx < editPointsDraft.length - 1)
      .sort((a, b) => a - b);
    const indices = [0, ...validBounds, editPointsDraft.length - 1];
    const parts: Array<{
      startIdx: number;
      endIdx: number;
      lengthM: number;
    }> = [];
    for (let i = 0; i < indices.length - 1; i++) {
      const startIdx = indices[i];
      const endIdx = indices[i + 1];
      if (endIdx <= startIdx) continue;
      const coords = editPointsDraft.slice(startIdx, endIdx + 1);
      parts.push({
        startIdx,
        endIdx,
        lengthM: geometricLength(coords),
      });
    }
    return parts;
  }, [splitMode, editPointsDraft, splitBoundaries]);
  // Рисование эталонного маршрута (C.5, фаза A2)
  const [drawMode, setDrawMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [saveRefVisible, setSaveRefVisible] = useState(false);
  const [saveRefName, setSaveRefName] = useState('');
  const [saveRefStatus, setSaveRefStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveRefError, setSaveRefError] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<
    'all' | 'time-60' | 'time-300' | 'time-600' | 'time-1200' | 'time-1800' | 'distance'
  >('all');

  const testMarkerRef = useRef<Marker | null>(null);
  const testFinishMarkerRef = useRef<Marker | null>(null);

  const markupClickHandlerRef = useRef<((e: any) => void) | null>(null);
  const drawClickHandlerRef = useRef<((e: any) => void) | null>(null);
  const draftMarkersRef = useRef<Marker[]>([]);

  const markersRef = useRef<Marker[]>([]);
  const retryTimerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [storyVisible, setStoryVisible] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);

  // Ref для trackSettings — чтобы draw-эффект видел актуальное значение,
  // но не перерисовывался при каждом изменении width/opacity.
  const trackSettingsRef = useRef(trackSettings);
  useEffect(() => { trackSettingsRef.current = trackSettings; }, [trackSettings]);

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];
  const groupedRuns = useMemo(() => groupRunFacts(rawFacts, {}), [rawFacts]);

  // ==================== Загрузка списка треков ====================
  useEffect(() => {
    if (!visible) return;
    setLoadingFacts(true);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 365);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromIso = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
    const toIso = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`;

    api.pb.listRunFacts(fromIso, toIso)
      .then((res: any) => {
        if (res?.success) setRawFacts(res.items || []);
      })
      .finally(() => setLoadingFacts(false));
  }, [visible, api]);

  // Standalone автовыбор
  useEffect(() => {
    if (visible && initialRunId && groupedRuns.length > 0) {
      const grp = groupedRuns.find(g => g.items.some((it: any) => it.id === initialRunId));
      if (grp) {
        const fact = grp.items.find((it: any) => it.id === initialRunId);
        setSelectedGroup(grp);
        setSelectedSource(fact?.source || grp.primary.source);
      }
    }
  }, [visible, initialRunId, groupedRuns]);

  useEffect(() => { setVisibleCount(CHUNK_SIZE); }, [rawFacts, searchQuery]);

  // Автовыбор последней пробежки при открытии редактора
  useEffect(() => {
    if (visible && !initialRunId && groupedRuns.length > 0 && !selectedGroup) {
      setSelectedGroup(groupedRuns[0]);
      setSelectedSource(groupedRuns[0].primary.source);
    }
  }, [visible, initialRunId, groupedRuns, selectedGroup]);

  // Фильтрация по поисковому запросу
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedRuns;
    const lower = searchQuery.toLowerCase();
    return groupedRuns.filter((g) =>
      g.displayName.toLowerCase().includes(lower)
    );
  }, [groupedRuns, searchQuery]);

  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleCount),
    [filteredGroups, visibleCount]
  );

  // Подгрузка по скроллу
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 50) {
        setVisibleCount(prev => Math.min(prev + CHUNK_SIZE, groupedRuns.length));
      }
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, [filteredGroups.length]);

  // ==================== Инициализация карты ====================
  useEffect(() => {
    if (!visible) return;
    let attempts = 0;
    const maxAttempts = 30;
    const tryInit = () => {
      attempts++;
      const el = mapContainerRef.current;
      if (!el || el.clientWidth < 10 || el.clientHeight < 10) {
        if (attempts < maxAttempts) retryTimerRef.current = window.setTimeout(tryInit, 100);
        return;
      }
      if (mapRef.current) return;
      try {
        const map = new MapLibreMap({
          container: el,
          style: getOsmStyleObject(layers),
          center: [37.618423, 55.751244],
          zoom: 12,
          attributionControl: { compact: true },
          canvasContextAttributes: {
            preserveDrawingBuffer: true,
          },
        } as any);
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.on('style.load', () => setMapLoaded(true));
        mapRef.current = map;
      } catch (err) {
        console.error('[RouteMapEditor] init error:', err);
      }
    };
    retryTimerRef.current = window.setTimeout(tryInit, 100);
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, [visible]);

  // Ресайз карты при сворачивании/разворачивании левой панели
  useEffect(() => {
    if (mapRef.current) {
      const t = setTimeout(() => {
        mapRef.current?.resize();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isLeftPanelOpen]);

  // ==================== Ресайз левой панели ====================

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const container = editorContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = e.clientX - rect.left;
      const clamped = Math.max(280, Math.min(800, w));
      setLeftPanelWidth(clamped);
      if (mapRef.current) mapRef.current.resize();
    };

    const onMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      try {
        localStorage.setItem(
          'pb.mapEditor.leftPanelWidth',
          String(leftPanelWidthRef.current),
        );
      } catch {
        /* ignore */
      }
      if (mapRef.current) mapRef.current.resize();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ==================== Режим разметки: клик по карте ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (markupClickHandlerRef.current) {
      map.off('click', markupClickHandlerRef.current);
      markupClickHandlerRef.current = null;
    }

    const canvas = map.getCanvas();
    canvas.style.cursor = markupMode ? 'crosshair' : '';

    if (!markupMode) return;

    const handler = (e: any) => {
      const { lat, lng } = e.lngLat;
      const p: TestPoint = { lat, lng };
      setTestPoint(p);
      saveTestPoint(p);
    };
    map.on('click', handler);
    markupClickHandlerRef.current = handler;

    return () => {
      if (markupClickHandlerRef.current) {
        map.off('click', markupClickHandlerRef.current);
        markupClickHandlerRef.current = null;
      }
      canvas.style.cursor = '';
    };
  }, [mapLoaded, markupMode]);

  // Сохранение видимости тестового отрезка
  useEffect(() => {
    try {
      localStorage.setItem('pb.testVisible', testVisible ? '1' : '0');
    } catch { /* ignore */ }
  }, [testVisible]);

  useEffect(() => {
    try {
      localStorage.setItem('pb.mapEditor.groupedRuns', groupedRunsView ? '1' : '0');
    } catch { /* ignore */ }
  }, [groupedRunsView]);

  useEffect(() => {
    try {
      localStorage.setItem('pb.mapEditor.onlyPrimaryFilter', filterOnlyPrimary ? '1' : '0');
    } catch { /* ignore */ }
  }, [filterOnlyPrimary]);

  // ==================== Рисование эталона: клики ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (drawClickHandlerRef.current) {
      map.off('click', drawClickHandlerRef.current);
      drawClickHandlerRef.current = null;
    }

    const canvas = map.getCanvas();

    if (!drawMode) {
      canvas.style.cursor = markupMode ? 'crosshair' : '';
      if (map.getLayer('active-track')) {
        map.setLayoutProperty(
          'active-track',
          'visibility',
          trackSettingsRef.current.visible ? 'visible' : 'none',
        );
      }
      if (map.getLayer('active-track-glow')) {
        map.setLayoutProperty(
          'active-track-glow',
          'visibility',
          trackSettingsRef.current.glow && trackSettingsRef.current.visible
            ? 'visible'
            : 'none',
        );
      }
      if (map.getLayer('test-segment')) {
        map.setLayoutProperty('test-segment', 'visibility', 'visible');
      }
      if (map.getLayer('test-segment-outline')) {
        map.setLayoutProperty('test-segment-outline', 'visibility', 'visible');
      }
      return;
    }

    canvas.style.cursor = 'crosshair';

    if (map.getLayer('active-track')) {
      map.setLayoutProperty('active-track', 'visibility', 'none');
    }
    if (map.getLayer('active-track-glow')) {
      map.setLayoutProperty('active-track-glow', 'visibility', 'none');
    }
    if (map.getLayer('test-segment')) {
      map.setLayoutProperty('test-segment', 'visibility', 'none');
    }
    if (map.getLayer('test-segment-outline')) {
      map.setLayoutProperty('test-segment-outline', 'visibility', 'none');
    }

    const handler = (e: any) => {
      const { lat, lng } = e.lngLat;
      setDraftPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last) {
          const d = haversineM(last[0], last[1], lat, lng);
          if (d < 1) return prev;
        }
        return [...prev, [lat, lng]];
      });
    };
    map.on('click', handler);
    drawClickHandlerRef.current = handler;

    return () => {
      if (drawClickHandlerRef.current) {
        map.off('click', drawClickHandlerRef.current);
        drawClickHandlerRef.current = null;
      }
    };
  }, [drawMode, mapLoaded, markupMode]);

  // ==================== Рисование эталона: линия и маркеры ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    draftMarkersRef.current.forEach((m) => m.remove());
    draftMarkersRef.current = [];

    if (map.getLayer('draft-line')) map.removeLayer('draft-line');
    if (map.getSource('draft-line')) map.removeSource('draft-line');

    if (!drawMode) return;
    if (draftPoints.length === 0) return;

    draftPoints.forEach((p, i) => {
      const isFirst = i === 0;
      const isLast = i === draftPoints.length - 1 && draftPoints.length > 1;
      const color = isFirst
        ? '#6fbf73'
        : isLast
        ? '#ff5a00'
        : '#d4a373';
      const marker = new Marker({ color })
        .setLngLat([p[1], p[0]])
        .addTo(map);
      draftMarkersRef.current.push(marker);
    });

    if (draftPoints.length >= 2) {
      const coords = draftPoints.map((p) => [p[1], p[0]]);
      map.addSource('draft-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#d4a373',
          'line-width': 3,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
        },
      });
    }
  }, [draftPoints, drawMode, mapLoaded]);

  // ==================== Режим редактирования точек эталона ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    editMarkersRef.current.forEach((m) => m.remove());
    editMarkersRef.current = [];
    if (map.getLayer('edit-draft-line')) map.removeLayer('edit-draft-line');
    if (map.getSource('edit-draft-line')) map.removeSource('edit-draft-line');

    if (!editPointsMode) return;
    if (editPointsDraft.length === 0) return;

    editPointsDraft.forEach((p, i) => {
      const isStart = i === 0;
      const isEnd = i === editPointsDraft.length - 1 && editPointsDraft.length > 1;
      const isBoundary =
        splitMode && splitBoundaries.has(i) && !isStart && !isEnd;
      const color = isStart
        ? '#6fbf73'
        : isEnd
        ? '#ff5a00'
        : isBoundary
        ? '#e53935'
        : '#8a8a8a';
      const marker = new Marker({ color, draggable: true })
        .setLngLat([p[1], p[0]])
        .addTo(map);
      const idx = i;

      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        setEditPointsDraft((prev) => {
          const next = [...prev];
          next[idx] = [ll.lat, ll.lng];
          return next;
        });
      });

      const el = marker.getElement();
      el.title = isStart
        ? 'Старт (не удаляется, можно перетащить)'
        : isEnd
        ? 'Финиш (ПКМ — удалить, если останется ≥2 точек)'
        : isBoundary
        ? `Граница (клик — снять)`
        : splitMode
        ? `Клик — сделать границей · ПКМ — удалить`
        : `Вершина ${idx + 1} (ПКМ — удалить)`;

      el.addEventListener('click', (ev) => {
        if (!splitMode || isStart || isEnd) return;
        ev.stopPropagation();
        setSplitBoundaries((prev) => {
          const next = new Set(prev);
          if (next.has(idx)) next.delete(idx);
          else next.add(idx);
          return next;
        });
      });

      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (isStart) return;
        if (isEnd) {
          setEditPointsDraft((prev) =>
            prev.length > 2 ? prev.slice(0, -1) : prev,
          );
          if (splitMode) {
            setSplitBoundaries((prev) => {
              const next = new Set<number>();
              for (const b of prev) {
                if (b < editPointsDraft.length - 1) next.add(b);
              }
              return next;
            });
          }
          return;
        }
        setEditPointsDraft((prev) => prev.filter((_, j) => j !== idx));
        if (splitMode) {
          setSplitBoundaries((prev) => {
            const next = new Set<number>();
            for (const b of prev) {
              if (b === idx) continue;
              next.add(b > idx ? b - 1 : b);
            }
            return next;
          });
        }
      });

      editMarkersRef.current.push(marker);
    });

    if (editPointsDraft.length >= 2) {
      const coords = editPointsDraft.map((p) => [p[1], p[0]]);
      map.addSource('edit-draft-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });
      map.addLayer({
        id: 'edit-draft-line',
        type: 'line',
        source: 'edit-draft-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#d4a373',
          'line-width': 4,
          'line-opacity': 0.75,
          'line-dasharray': [2, 1],
        },
      });
    }
  }, [editPointsMode, editPointsDraft, mapLoaded, splitMode, splitBoundaries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !editPointsMode) return;

    map.doubleClickZoom.disable();

    const HIT_TOLERANCE_PX = 20;

    const pointToSegmentPx = (
      px: number,
      py: number,
      ax: number,
      ay: number,
      bx: number,
      by: number,
    ): { distancePx: number; t: number } => {
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = 0;
      if (len2 > 0) {
        t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
      }
      const projX = ax + t * dx;
      const projY = ay + t * dy;
      const ddx = px - projX;
      const ddy = py - projY;
      return { distancePx: Math.sqrt(ddx * ddx + ddy * ddy), t };
    };

    const handler = (e: any) => {
      const draft = editPointsDraftRef.current;
      if (draft.length < 2) return;

      const px = e.point.x;
      const py = e.point.y;

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < draft.length - 1; i++) {
        const a = map.project([draft[i][1], draft[i][0]]);
        const b = map.project([draft[i + 1][1], draft[i + 1][0]]);
        const r = pointToSegmentPx(px, py, a.x, a.y, b.x, b.y);
        if (r.distancePx < bestDist) {
          bestDist = r.distancePx;
          bestIdx = i;
        }
      }

      if (bestIdx < 0 || bestDist > HIT_TOLERANCE_PX) return;

      const clickLat = e.lngLat.lat;
      const clickLng = e.lngLat.lng;
      const insertAt = bestIdx + 1;

      setEditPointsDraft((prev) => {
        const next = [...prev];
        next.splice(insertAt, 0, [clickLat, clickLng]);
        return next;
      });
      if (splitMode) {
        setSplitBoundaries((prev) => {
          const next = new Set<number>();
          for (const b of prev) {
            next.add(b >= insertAt ? b + 1 : b);
          }
          return next;
        });
      }
    };

    map.on('click', handler);
    map.on('contextmenu', handler);

    return () => {
      map.off('click', handler);
      map.off('contextmenu', handler);
      map.doubleClickZoom.enable();
    };
  }, [editPointsMode, mapLoaded, splitMode]);

  useEffect(() => {
    if (!editPointsMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditPointsMode(false);
        setEditPointsRefId(null);
        setEditPointsDraft([]);
        setEditPointsSaveStatus('idle');
        setEditPointsSaveError('');
        setSplitMode(false);
        setSplitBoundaries(new Set());
        setSplitSaveStatus('idle');
        setSplitSaveError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editPointsMode]);

  useEffect(() => {
    if (!drawMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawMode(false);
        setDraftPoints([]);
        setSaveRefVisible(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawMode]);

  // ==================== Отрисовка выбранного эталона на карте ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('ref-line-outline')) map.removeLayer('ref-line-outline');
    if (map.getLayer('ref-line')) map.removeLayer('ref-line');
    if (map.getSource('ref-line')) map.removeSource('ref-line');

    if (!selectedRefTrackId || drawMode) return;

    const ref = referenceTracks.find((r) => r.id === selectedRefTrackId);
    if (!ref || ref.coords.length < 2) return;

    const coords = ref.coords.map((p) => [p[1], p[0]]);

    map.addSource('ref-line', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    });

    map.addLayer({
      id: 'ref-line-outline',
      type: 'line',
      source: 'ref-line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#000000',
        'line-width': trackSettingsRef.current.width + 6,
        'line-opacity': 0.35,
      },
    });

    map.addLayer({
      id: 'ref-line',
      type: 'line',
      source: 'ref-line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#6ab2f2',
        'line-width': trackSettingsRef.current.width + 1,
        'line-opacity': 0.85,
        'line-dasharray': [3, 2],
      },
    });
  }, [selectedRefTrackId, referenceTracks, mapLoaded, drawMode]);

  // ==================== Загрузка сохранённых тестовых отрезков ====================

  const loadSegments = async () => {
    if (!api?.pb?.testSegmentList) return;
    setSegmentsLoading(true);
    try {
      const res = await api.pb.testSegmentList();
      if (res?.success) {
        setSegments(res.items ?? []);
      }
    } catch (e) {
      console.error('[pb-map] test-segment list error:', e);
    } finally {
      setSegmentsLoading(false);
    }
  };

  useEffect(() => {
    if (visible && activeTab === 'thresholds') {
      void loadSegments();
    }
  }, [visible, activeTab]);

  // ==================== Загрузка эталонных треков ====================

  const loadReferenceTracks = async () => {
    if (!api?.pb?.referenceTrackList) return;
    setRefTracksLoading(true);
    try {
      const res = await api.pb.referenceTrackList();
      if (res?.success) {
        setReferenceTracks(res.items ?? []);
      }
    } catch (e) {
      console.error('[pb-map] ref tracks load error:', e);
    } finally {
      setRefTracksLoading(false);
    }
  };

  useEffect(() => {
    if (visible && activeTab === 'refs') {
      void loadReferenceTracks();
    }
  }, [visible, activeTab]);

  useEffect(() => {
    if (!selectedRefTrackId) return;
    if (activeTab !== 'refs') return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`pb-ref-item-${selectedRefTrackId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedRefTrackId, activeTab]);

  // Пересборка grid-индексов при изменении эталонов или радиусов
  useEffect(() => {
    const next = new Map<number, RefIndex>();
    for (const ref of referenceTracks) {
      if (ref.coords.length >= 2) {
        next.set(ref.id, buildRefIndex(ref.coords));
      }
    }
    refIndexesCacheRef.current = next;
    coverageCacheRef.current = new Map();
  }, [
    referenceTracks,
    coverageThresholds.coverageRadiusM,
    coverageThresholds.onRefRadiusM,
    coverageThresholds.checkpointCount,
  ]);

  // Загрузка latlng для видимых пробежек (batch)
  useEffect(() => {
    if (!visible) return;
    if (referenceTracks.length === 0) return;
    if (visibleGroups.length === 0) return;

    const missing: number[] = [];
    for (const g of visibleGroups) {
      if (!batchLatlng.has(g.primary.id)) {
        missing.push(g.primary.id);
      }
    }
    if (missing.length === 0) return;

    let cancelled = false;
    api.pb
      .runLatlngBatch(missing, { samples: 1000 })
      .then((res: any) => {
        if (cancelled || !res?.success) return;
        setBatchLatlng((prev) => {
          const next = new Map(prev);
          for (const [idStr, data] of Object.entries(res.data ?? {})) {
            next.set(Number(idStr), data as any);
          }
          return next;
        });
      })
      .catch((err: any) => {
        console.error('[pb-map] run-latlng-batch error:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, visibleGroups, referenceTracks.length, batchLatlng, api]);

  // Batch coverage для всех видимых пробежек
  const batchCoverage = useMemo(() => {
    const result = new Map<
      number,
      Array<{
        refId: number;
        cls: CoverageClass;
        ratio: number;
        repeats: number;
        score: number;
        dev: FastDeviationResult;
      }>
    >();
    if (referenceTracks.length === 0) return result;
    if (batchLatlng.size === 0) return result;

    for (const g of visibleGroups) {
      const factId = g.primary.id;
      const track = batchLatlng.get(factId);
      if (!track || track.latlng.length < 10) continue;

      const arr: Array<{
        refId: number;
        cls: CoverageClass;
        ratio: number;
        repeats: number;
        score: number;
        dev: FastDeviationResult;
      }> = [];

      for (const ref of referenceTracks) {
        const idx = refIndexesCacheRef.current.get(ref.id);
        if (!idx) continue;

        let dev = coverageCacheRef.current.get(factId)?.get(ref.id);
        if (!dev) {
          // Передаём checkpointCount из настроек (по умолчанию 6)
          dev = computeDeviationFast(
            track.latlng,
            idx,
            coverageThresholds.coverageRadiusM,
            coverageThresholds.onRefRadiusM,
            coverageThresholds.checkpointCount ?? 6,
          ) ?? undefined;
          if (!dev) continue;
          let m = coverageCacheRef.current.get(factId);
          if (!m) {
            m = new Map();
            coverageCacheRef.current.set(factId, m);
          }
          m.set(ref.id, dev);
        }

        const clsRes = classifyCoverage(
          {
            coveragePct: dev.coveragePct,
            medianM: dev.medianM,
            metersOnRef: dev.metersOnRef,
            atomLenM: ref.lengthM,
            atomKind: ref.kind,
            repeats: dev.repeats,
          },
          coverageThresholds,
        );

        arr.push({ refId: ref.id, ...clsRes, dev });
      }

      arr.sort((a, b) => b.score - a.score);
      result.set(factId, arr);
    }
    return result;
  }, [
    visibleGroups,
    referenceTracks,
    batchLatlng,
    coverageThresholds,
  ]);

  const primaryPerRun = useMemo(() => {
    const result = new Map<
      number,
      {
        refId: number;
        name: string;
        repeats: number;
        coveragePct: number;
        isLoop: boolean;
        alsoUsed: Array<{
          refId: number;
          name: string;
          coveragePct: number;
          repeats: number;
        }>;
      }
    >();

    for (const [factId, arr] of batchCoverage.entries()) {
      const used = arr.filter((x) => x.cls === 'used');
      if (used.length === 0) continue;

      const scored = used.map((u) => {
        const r = referenceTracks.find((x) => x.id === u.refId);
        const len = r?.lengthM || 0;
        const isPerfect = u.dev.coveragePct >= 95;
        const isLoop = r?.kind === 'loop' || r?.kind === 'stadium';

        return {
          ...u,
          ref: r,
          isLoop,
          isPerfect,
          sortScore: isPerfect ? len : u.dev.coveragePct * len
        };
      });

      scored.sort((a, b) => {
        if (a.isPerfect && !b.isPerfect) return -1;
        if (!a.isPerfect && b.isPerfect) return 1;
        return b.sortScore - a.sortScore;
      });
      const best = scored[0];
      if (!best.ref) continue;

      result.set(factId, {
        refId: best.ref.id,
        name: best.ref.name,
        repeats: best.repeats,
        coveragePct: best.dev.coveragePct,
        isLoop: best.isLoop,
        alsoUsed: scored.slice(1).map((u) => ({
          refId: u.refId,
          name: u.ref?.name ?? `#${u.refId}`,
          coveragePct: u.dev.coveragePct,
          repeats: u.repeats,
        })),
      });
    }
    return result;
  }, [batchCoverage, referenceTracks]);

  // ==================== Отрисовка всех эталонов на карте ====================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const cleanup = () => {
      if (!map || map._removed) return;
      ['all-refs-unused', 'all-refs-similar', 'all-refs-used', 'all-refs-selected'].forEach((id) => {
        try {
          if (map.getLayer(id)) map.removeLayer(id);
        } catch (e) {
          /* ignore */
        }
      });
      try {
        if (map.getSource('all-refs-source')) map.removeSource('all-refs-source');
      } catch (e) {
        /* ignore */
      }
    };

    cleanup();

    if (!showAllRefs) {
      if (map.getLayer('active-track')) {
        map.setPaintProperty('active-track', 'line-opacity', trackSettingsRef.current.opacity);
      }
      return;
    }

    if (referenceTracks.length === 0) return;
    if (!selectedGroup) return;

    if (map.getLayer('active-track')) {
      map.setPaintProperty('active-track', 'line-opacity', 0.25);
    }

    const covs = batchCoverage.get(selectedGroup.primary.id) ?? [];
    const covMap = new Map(covs.map((c) => [c.refId, c.cls]));

    const features = referenceTracks
      .filter((ref) => ref.coords.length >= 2)
      .map((ref) => {
        const cls = covMap.get(ref.id) ?? 'unused';
        return {
          type: 'Feature' as const,
          properties: { refId: ref.id, status: cls },
          geometry: {
            type: 'LineString' as const,
            coordinates: ref.coords.map((p) => [p[1], p[0]]),
          },
        };
      });

    try {
      map.addSource('all-refs-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection' as const,
          features,
        },
      });
    } catch (e) {
      console.warn('[pb-map] addSource all-refs failed:', e);
    }

    const tryAddLayer = (config: any) => {
      try {
        if (!map.getLayer(config.id)) map.addLayer(config);
      } catch (e) {
        /* ignore */
      }
    };

    const s = allRefsStylesRef.current;

    const buildPaint = (st: { color: string; width: number; opacity: number; dashed: boolean }) => {
      const base: any = {
        'line-color': st.color,
        'line-width': st.width,
        'line-opacity': st.opacity,
      };
      if (st.dashed) base['line-dasharray'] = [3, 2];
      return base;
    };

    tryAddLayer({
      id: 'all-refs-unused',
      type: 'line',
      source: 'all-refs-source',
      filter: ['==', ['get', 'status'], 'unused'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: buildPaint(s.unused),
    });

    tryAddLayer({
      id: 'all-refs-similar',
      type: 'line',
      source: 'all-refs-source',
      filter: ['==', ['get', 'status'], 'similar'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: buildPaint(s.similar),
    });

    tryAddLayer({
      id: 'all-refs-used',
      type: 'line',
      source: 'all-refs-source',
      filter: ['==', ['get', 'status'], 'used'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: buildPaint(s.used),
    });

    tryAddLayer({
      id: 'all-refs-selected',
      type: 'line',
      source: 'all-refs-source',
      filter: ['==', ['get', 'refId'], -1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ff5a00',
        'line-width': 6,
        'line-opacity': 0.75,
      },
    });

    const onLayerClick = (e: any) => {
      if (e.features && e.features.length > 0) {
        const refId = Number(e.features[0].properties.refId);
        setSelectedRefTrackId(refId);
        setActiveTab('refs');
      }
    };

    const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onMouseLeave = () => { map.getCanvas().style.cursor = ''; };

    try {
      map.on('click', 'all-refs-unused', onLayerClick);
      map.on('click', 'all-refs-similar', onLayerClick);
      map.on('click', 'all-refs-used', onLayerClick);
      map.on('mouseenter', 'all-refs-unused', onMouseEnter);
      map.on('mouseenter', 'all-refs-similar', onMouseEnter);
      map.on('mouseenter', 'all-refs-used', onMouseEnter);
      map.on('mouseleave', 'all-refs-unused', onMouseLeave);
      map.on('mouseleave', 'all-refs-similar', onMouseLeave);
      map.on('mouseleave', 'all-refs-used', onMouseLeave);
    } catch (e) {
      /* ignore */
    }

    return () => {
      try {
        map.off('click', 'all-refs-unused', onLayerClick);
        map.off('click', 'all-refs-similar', onLayerClick);
        map.off('click', 'all-refs-used', onLayerClick);
        map.off('mouseenter', 'all-refs-unused', onMouseEnter);
        map.off('mouseenter', 'all-refs-similar', onMouseEnter);
        map.off('mouseenter', 'all-refs-used', onMouseEnter);
        map.off('mouseleave', 'all-refs-unused', onMouseLeave);
        map.off('mouseleave', 'all-refs-similar', onMouseLeave);
        map.off('mouseleave', 'all-refs-used', onMouseLeave);
      } catch (e) {
        /* ignore */
      }
      cleanup();
    };
  }, [showAllRefs, mapLoaded, referenceTracks, batchCoverage, selectedGroup]);

  // Живое обновление стилей слоёв all-refs
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!showAllRefs) return;

    const apply = (layerId: string, st: { color: string; width: number; opacity: number; dashed: boolean }) => {
      if (!map.getLayer(layerId)) return;
      try {
        map.setPaintProperty(layerId, 'line-color', st.color);
        map.setPaintProperty(layerId, 'line-width', st.width);
        map.setPaintProperty(layerId, 'line-opacity', st.opacity);
        map.setPaintProperty(
          layerId,
          'line-dasharray',
          (st.dashed ? [3, 2] : null) as any,
        );
      } catch (e) {
        /* ignore */
      }
    };

    apply('all-refs-unused', allRefsStyles.unused);
    apply('all-refs-similar', allRefsStyles.similar);
    apply('all-refs-used', allRefsStyles.used);
  }, [allRefsStyles, mapLoaded, showAllRefs]);

  // Подсветка выбранного атома в режиме «Все эталоны»
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!map.getLayer('all-refs-selected')) return;
    try {
      map.setFilter('all-refs-selected', [
        '==',
        ['get', 'refId'],
        selectedRefTrackId ?? -1,
      ]);
    } catch (e) {
      /* ignore */
    }
  }, [selectedRefTrackId, mapLoaded, showAllRefs]);

  // Группировка видимых пробежек для левой панели
  const categorizedGroups = useMemo(() => {
    let list = [...visibleGroups];

        // 1. Фильтрация по атому
    if (filterByRefId !== null) {
      list = list.filter((g) => {
        const covs = batchCoverage.get(g.primary.id);
        if (!covs) return false;

        // «Только primary» — оставляем лишь пробежки, где этот атом
        // выбран primaryPerRun как главный маршрут.
        if (filterOnlyPrimary) {
          const prim = primaryPerRun.get(g.primary.id);
          return prim?.refId === filterByRefId;
        }

        // Обычный фильтр: атом задет (used или similar), неважно, primary ли он.
        const target = covs.find((c) => c.refId === filterByRefId);
        return target && (target.cls === 'used' || target.cls === 'similar');
      });
    }

    const used: typeof list = [];
    const similar: typeof list = [];
    const unused: typeof list = [];

    for (const g of list) {
      const hasPrimary = primaryPerRun.has(g.primary.id);
      const covs = batchCoverage.get(g.primary.id);
      const hasSimilar = covs?.some((c) => c.cls === 'similar');

      if (hasPrimary) used.push(g);
      else if (hasSimilar) similar.push(g);
      else unused.push(g);
    }

    return { used, similar, unused };
  }, [visibleGroups, filterByRefId, filterOnlyPrimary, batchCoverage, primaryPerRun]);

  // Очистка
  useEffect(() => {
    if (!visible && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = [];
      if (testMarkerRef.current) {
        testMarkerRef.current.remove();
        testMarkerRef.current = null;
      }
      if (testFinishMarkerRef.current) {
        testFinishMarkerRef.current.remove();
        testFinishMarkerRef.current = null;
      }
      draftMarkersRef.current.forEach((m) => m.remove());
      draftMarkersRef.current = [];
      markupClickHandlerRef.current = null;
      drawClickHandlerRef.current = null;
      setMarkupMode(false);
      setDrawMode(false);
      setDraftPoints([]);
      setSaveRefVisible(false);
      setSelectedRefTrackId(null);
      setMapLoaded(false);
      setEditPointsMode(false);
      setEditPointsRefId(null);
      setEditPointsDraft([]);
      setEditPointsSaveStatus('idle');
      setEditPointsSaveError('');
      setSplitMode(false);
      setSplitBoundaries(new Set());
      setSplitSaveStatus('idle');
      setSplitSaveError('');
      setShowAllRefs(false);
      setBatchLatlng(new Map());
      refIndexesCacheRef.current = new Map();
      coverageCacheRef.current = new Map();
      editMarkersRef.current.forEach((m) => m.remove());
      editMarkersRef.current = [];
    }
  }, [visible]);

  // Применение стилей слоёв на лету
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    layers.forEach(l => {
      if (map.getLayer(l.id)) {
        map.setLayoutProperty(l.id, 'visibility', l.visible ? 'visible' : 'none');
        map.setPaintProperty(l.id, 'raster-opacity', l.opacity);
        map.setPaintProperty(l.id, 'raster-brightness-min', l.brightnessMin);
        map.setPaintProperty(l.id, 'raster-brightness-max', l.brightnessMax);
        map.setPaintProperty(l.id, 'raster-saturation', l.saturation);
        map.setPaintProperty(l.id, 'raster-contrast', l.contrast);
        map.setPaintProperty(l.id, 'raster-hue-rotate', l.hueRotate);
      }
    });
    saveLayers(layers);
  }, [layers, mapLoaded]);

  // ==================== Загрузка streams при выборе тренировки ====================
  useEffect(() => {
    if (!selectedGroup || !selectedSource) {
      setStreamsPayload(null);
      return;
    }
    const fact = selectedGroup.items.find((it: any) => it.source === selectedSource) || selectedGroup.primary;

    setLoadingStreams(true);
    api.pb.getRunStreamsMeta(fact.id)
      .then((metaRes: any) => {
        let actualSource = fact.source;
        if (metaRes?.success && metaRes.items?.length > 0) {
          const fitStream = metaRes.items.find((s: any) => s.source === 'fit');
          actualSource = fitStream ? 'fit' : metaRes.items[0].source;
        }
        return api.pb.getRunStreams(fact.id, actualSource);
      })
      .then((res: any) => {
        if (res?.success && res.payload) {
          setStreamsPayload(res.payload);
        } else {
          setStreamsPayload(null);
        }
      })
      .catch((err: any) => {
        console.error('[RouteMapEditor] stream error:', err);
        setStreamsPayload(null);
      })
      .finally(() => setLoadingStreams(false));
  }, [selectedGroup, selectedSource, api]);

  // ==================== Отрисовка трека (с градиентом) ====================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (map.getLayer('active-track-glow')) map.removeLayer('active-track-glow');
    if (map.getLayer('active-track')) map.removeLayer('active-track');
    if (map.getSource('active-track')) map.removeSource('active-track');

    if (!streamsPayload?.latlng || streamsPayload.latlng.length < 2) return;

    const coords: [number, number][] = streamsPayload.latlng
      .filter((p: any) => p != null)
      .map((p: [number, number]) => [p[1], p[0]]);

    if (coords.length < 2) return;

    const ts = trackSettingsRef.current;
    let sourceData: any;
    let colorExpr: any = ts.color;

    if (gradient.channel === 'none') {
      sourceData = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      };
    } else {
      const channelValues = streamsPayload[gradient.channel] as (number | null)[] | undefined;
      const stats = computeStats(channelValues);
      if (stats) {
        colorExpr = buildColorExpression(gradient.channel, gradient.palette, stats, ts.color);
      }

      const step = Math.max(5, Math.floor(coords.length / 1000));
      const features: any[] = [];

      for (let i = 0; i < coords.length - 1; i += step) {
        const endIdx = Math.min(i + step, coords.length - 1);
        const slice = coords.slice(i, endIdx + 1);
        if (slice.length < 2) continue;

        let avg: number | null = null;
        if (channelValues) {
          const segVals = channelValues.slice(i, endIdx + 1);
          const valid = segVals.filter((v): v is number => v != null && Number.isFinite(v));
          if (valid.length > 0) {
            avg = valid.reduce((a, b) => a + b, 0) / valid.length;
          }
        }

        features.push({
          type: 'Feature',
          properties: avg != null ? { [gradient.channel]: avg } : {},
          geometry: { type: 'LineString', coordinates: slice },
        });
      }

      sourceData = { type: 'FeatureCollection', features };
    }

    map.addSource('active-track', {
      type: 'geojson',
      data: sourceData,
    });

    if (!ts.visible) {
      return;
    }

    if (ts.glow) {
      map.addLayer({
        id: 'active-track-glow',
        type: 'line',
        source: 'active-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ts.color,
          'line-width': ts.width * 3,
          'line-opacity': ts.opacity * 0.3,
          'line-blur': 10,
        },
      });
    }

    map.addLayer({
      id: 'active-track',
      type: 'line',
      source: 'active-track',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
        'visibility': ts.visible ? 'visible' : 'none'
      },
      paint: {
        'line-color': colorExpr,
        'line-width': ts.width,
        'line-opacity': ts.opacity,
      },
    });

    const bounds = coords.reduce(
      (b: any, c: any) => b.extend(c),
      new LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 50, duration: 800 });

    markersRef.current.push(
      new Marker({ color: '#6fbf73' }).setLngLat(coords[0]).addTo(map)
    );
  }, [
    streamsPayload,
    mapLoaded,
    gradient.channel,
    gradient.palette,
    trackSettings.glow,
    trackSettings.color,
  ]);

  // ==================== Отрисовка тестовой точки + отрезка ====================

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('test-segment-outline')) map.removeLayer('test-segment-outline');
    if (map.getLayer('test-segment')) map.removeLayer('test-segment');
    if (map.getSource('test-segment')) map.removeSource('test-segment');
    if (testMarkerRef.current) {
      testMarkerRef.current.remove();
      testMarkerRef.current = null;
    }
    if (testFinishMarkerRef.current) {
      testFinishMarkerRef.current.remove();
      testFinishMarkerRef.current = null;
    }

    if (!testVisible) return;
    if (!testPoint) return;

    const startMarker = new Marker({
      color: '#d4a373',
      draggable: true,
    })
      .setLngLat([testPoint.lng, testPoint.lat])
      .addTo(map);

    startMarker.on('dragend', () => {
      const lngLat = startMarker.getLngLat();
      const p: TestPoint = { lat: lngLat.lat, lng: lngLat.lng };
      setTestPoint(p);
      saveTestPoint(p);
    });

    testMarkerRef.current = startMarker;

    const latlng = streamsPayload?.latlng as (number | null)[][] | undefined;
    if (!latlng || latlng.length < 2) return;

    const startIdx = findNearestIdx(latlng, testPoint);
    if (startIdx < 0) return;

    let endIdx: number;
    if (testDuration.type === 'time') {
      endIdx = findEndIdxByTime(streamsPayload.secT, startIdx, testDuration.value);
    } else {
      endIdx = findEndIdxByDist(
        streamsPayload.distM,
        latlng,
        startIdx,
        testDuration.value
      );
    }
    if (endIdx <= startIdx) return;

    const segCoords: [number, number][] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const p = latlng[i];
      if (p && p[0] != null && p[1] != null) {
        segCoords.push([p[1], p[0]]);
      }
    }
    if (segCoords.length < 2) return;

    map.addSource('test-segment', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: segCoords },
      },
    });

    map.addLayer({
      id: 'test-segment-outline',
      type: 'line',
      source: 'test-segment',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#000000',
        'line-width': trackSettingsRef.current.width + 6,
        'line-opacity': 0.4,
      },
    });

    map.addLayer({
      id: 'test-segment',
      type: 'line',
      source: 'test-segment',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#d4a373',
        'line-width': trackSettingsRef.current.width + 2,
        'line-opacity': 0.95,
      },
    });

    const last = latlng[endIdx];
    if (last && last[0] != null && last[1] != null) {
      const finishMarker = new Marker({ color: '#ff5a00' })
        .setLngLat([last[1], last[0]])
        .addTo(map);
      testFinishMarkerRef.current = finishMarker;
    }
  }, [streamsPayload, mapLoaded, testPoint, testDuration, testVisible]);

  // ==================== Хендлеры ====================

  const handleClose = () => {
    setSelectedGroup(null);
    setSelectedSource(null);
    setStreamsPayload(null);
    onHide();
  };

  const handleSliderChange = (layerId: string, key: keyof RasterLayer, val: number) => {
    if (mapRef.current && mapRef.current.getLayer(layerId)) {
      const paintKey = {
        opacity: 'raster-opacity',
        brightnessMin: 'raster-brightness-min',
        brightnessMax: 'raster-brightness-max',
        saturation: 'raster-saturation',
        contrast: 'raster-contrast',
        hueRotate: 'raster-hue-rotate',
      }[key as string];
      if (paintKey) {
        mapRef.current.setPaintProperty(layerId, paintKey as any, val);
      }
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      setLayers(prev => {
        const next = prev.map(l => l.id === layerId ? { ...l, [key]: val } : l);
        saveLayers(next);
        return next;
      });
    }, 50);
  };

  const updateTrackSetting = (key: keyof TrackSettings, val: any) => {
    const next = { ...trackSettings, [key]: val };
    setTrackSettings(next);
    saveTrackSettings(next);

    const map = mapRef.current;
    if (!map) return;
    if (key === 'width') {
      if (map.getLayer('active-track')) map.setPaintProperty('active-track', 'line-width', val);
      if (map.getLayer('active-track-glow')) map.setPaintProperty('active-track-glow', 'line-width', val * 3);
    } else if (key === 'opacity') {
      if (map.getLayer('active-track')) map.setPaintProperty('active-track', 'line-opacity', val);
      if (map.getLayer('active-track-glow')) map.setPaintProperty('active-track-glow', 'line-opacity', val * 0.3);
    } else if (key === 'visible') {
      if (map.getLayer('active-track')) {
        map.setLayoutProperty('active-track', 'visibility', val ? 'visible' : 'none');
      }
      if (map.getLayer('active-track-glow')) {
        map.setLayoutProperty('active-track-glow', 'visibility', val ? 'visible' : 'none');
      }
    }
  };

  const updateGradient = (patch: Partial<GradientSettings>) => {
    const next = { ...gradient, ...patch };
    setGradient(next);
    saveGradient(next);
  };

  const gradientStats = useMemo(() => {
    if (gradient.channel === 'none' || !streamsPayload) return null;
    const values = streamsPayload[gradient.channel] as (number | null)[] | undefined;
    return computeStats(values);
  }, [gradient.channel, streamsPayload]);

  const addLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer: RasterLayer = {
      id: newId, name: `Слой ${layers.length + 1}`, visible: true,
      opacity: 0.5, brightnessMin: 0, brightnessMax: 1, saturation: 0, contrast: 0, hueRotate: 0,
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(newId);
    if (mapRef.current) {
      mapRef.current.addLayer({
        id: newId, type: 'raster', source: 'osm-source',
        paint: {
          'raster-opacity': newLayer.opacity,
          'raster-brightness-min': newLayer.brightnessMin,
          'raster-brightness-max': newLayer.brightnessMax,
          'raster-saturation': newLayer.saturation,
          'raster-contrast': newLayer.contrast,
          'raster-hue-rotate': newLayer.hueRotate,
        },
      });
    }
  };

  const removeLayer = (id: string) => {
    if (layers.length <= 1) return;
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) setActiveLayerId(layers[0].id);
    if (mapRef.current && mapRef.current.getLayer(id)) mapRef.current.removeLayer(id);
  };

  const sourceOptions = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.items.map((it: any) => ({
      label: it.source + (it.name ? ` · ${it.name}` : ''),
      value: it.source,
    }));
  }, [selectedGroup]);

  const paletteOptions = useMemo(() => {
    return Object.entries(PALETTES)
      .filter(([, p]) => !p.channels || p.channels.includes(gradient.channel))
      .map(([key, p]) => ({ label: p.label, value: key }));
  }, [gradient.channel]);

  const handlePrevTrack = () => {
    if (!selectedGroup) return;
    const currentIndex = filteredGroups.findIndex(g => g.startTime === selectedGroup.startTime && g.primary.id === selectedGroup.primary.id);
    if (currentIndex > 0) {
      const nextGroup = filteredGroups[currentIndex - 1];
      setSelectedGroup(nextGroup);
      setSelectedSource(nextGroup.primary.source);
    }
  };

  const handleNextTrack = () => {
    if (!selectedGroup) return;
    const currentIndex = filteredGroups.findIndex(g => g.startTime === selectedGroup.startTime && g.primary.id === selectedGroup.primary.id);
    if (currentIndex < filteredGroups.length - 1) {
      const nextGroup = filteredGroups[currentIndex + 1];
      setSelectedGroup(nextGroup);
      setSelectedSource(nextGroup.primary.source);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    const next = layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
    setLayers(next);
    saveLayers(next);
    if (mapRef.current && mapRef.current.getLayer(layerId)) {
      const targetLayer = next.find(l => l.id === layerId);
      mapRef.current.setLayoutProperty(layerId, 'visibility', targetLayer?.visible ? 'visible' : 'none');
    }
  };

  // ==================== Расчёт тестового отрезка ====================

  const segmentInfo = useMemo(() => {
    if (!testPoint || !streamsPayload?.latlng) return null;
    const latlng = streamsPayload.latlng as (number | null)[][];
    const startIdx = findNearestIdx(latlng, testPoint);
    if (startIdx < 0) return null;

    const endIdx =
      testDuration.type === 'time'
        ? findEndIdxByTime(streamsPayload.secT, startIdx, testDuration.value)
        : findEndIdxByDist(
            streamsPayload.distM,
            latlng,
            startIdx,
            testDuration.value
          );
    if (endIdx <= startIdx) return null;

    const stats = computeSegmentStats(streamsPayload, startIdx, endIdx);
    return { startIdx, endIdx, stats };
  }, [testPoint, testDuration, streamsPayload]);

  const handleSaveTest = async () => {
    if (!segmentInfo || !selectedGroup || !testPoint) return;
    const fact =
      selectedGroup.items.find((it: any) => it.source === selectedSource) ||
      selectedGroup.primary;
    if (!fact?.id) return;

    setSaveStatus('saving');
    try {
      const api = (window as any).electronAPI;
      const res = await api.pb.testSegmentCreate({
        runFactId: fact.id,
        startLat: testPoint.lat,
        startLng: testPoint.lng,
        startIdx: segmentInfo.startIdx,
        endIdx: segmentInfo.endIdx,
        durationType: testDuration.type,
        durationValue: testDuration.value,
        distanceM: segmentInfo.stats.distanceM,
        durationSec: segmentInfo.stats.durationSec,
        paceSecPerKm: segmentInfo.stats.paceSecPerKm,
        hrAvg: segmentInfo.stats.hrAvg,
        hrMax: segmentInfo.stats.hrMax,
        hrDriftPct: segmentInfo.stats.hrDriftPct,
        cadenceAvg: segmentInfo.stats.cadenceAvg,
        note: null,
        kind: 'intentional',
      });
      if (res?.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
        void loadSegments();
      } else {
        console.error('[pb-map] test-segment save error:', res?.error);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (e) {
      console.error('[pb-map] test-segment save:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // ==================== Обработчики для вкладки «Пороги» ====================

  const handleDeleteSegment = async (id: number) => {
    if (!window.confirm('Удалить этот тестовый отрезок?')) return;
    try {
      const res = await api.pb.testSegmentDelete(id);
      if (res?.success) {
        setSegments((prev) => prev.filter((s) => s.id !== id));
      } else {
        console.error('[pb-map] test-segment delete error:', res?.error);
      }
    } catch (e) {
      console.error('[pb-map] test-segment delete:', e);
    }
  };

  const fmtSegDuration = (s: {
    durationType: 'time' | 'distance';
    durationValue: number;
  }): string => {
    if (s.durationType === 'time') {
      const v = s.durationValue;
      if (v < 60) return `${v}с`;
      if (v < 3600) return `${Math.round(v / 60)}м`;
      return `${Math.round(v / 3600)}ч`;
    }
    const v = s.durationValue;
    if (v < 1000) return `${v}м`;
    return `${(v / 1000).toFixed(1)}км`;
  };

  const fmtSegDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return iso;
    }
  };

  const fmtSegPace = (sec: number | null): string => {
    if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  const getFactInfo = (runFactId: number): { date: string; name: string } => {
    const fact = rawFacts.find((f) => f.id === runFactId);
    if (!fact) return { date: '—', name: `#${runFactId}` };
    const name = fact.user_name || fact.name || fact.date || `#${runFactId}`;
    return { date: fact.date || '—', name };
  };

  const filteredSegments = useMemo(() => {
    if (segmentFilter === 'all') return segments;
    if (segmentFilter === 'distance') {
      return segments.filter((s) => s.durationType === 'distance');
    }
    const map: Record<string, number> = {
      'time-60': 60,
      'time-300': 300,
      'time-600': 600,
      'time-1200': 1200,
      'time-1800': 1800,
    };
    const target = map[segmentFilter];
    if (target == null) return segments;
    return segments.filter(
      (s) => s.durationType === 'time' && s.durationValue === target
    );
  }, [segments, segmentFilter]);

  const segmentMedians = useMemo(() => {
    if (filteredSegments.length === 0) return null;
    const hrs = filteredSegments
      .map((s) => s.hrAvg)
      .filter((v): v is number => v != null);
    const paces = filteredSegments
      .map((s) => s.paceSecPerKm)
      .filter((v): v is number => v != null);
    const drifts = filteredSegments
      .map((s) => s.hrDriftPct)
      .filter((v): v is number => v != null);
    return {
      hrMedian: median(hrs),
      paceMedian: median(paces),
      driftMedian: median(drifts),
      count: filteredSegments.length,
    };
  }, [filteredSegments]);

  const refCategoryOptions = useMemo(() => {
    const base = ['loop', 'stairs', 'connector', 'segment', 'landmark'];
    const existing = new Set(
      referenceTracks
        .map((r) => r.category)
        .filter((c): c is string => c != null && c !== ''),
    );
    return Array.from(new Set([...base, ...Array.from(existing)]));
  }, [referenceTracks]);

  // ==================== Сохранение эталона ====================

  const computeDraftLength = (): number => {
    if (draftPoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < draftPoints.length; i++) {
      total += haversineM(
        draftPoints[i - 1][0],
        draftPoints[i - 1][1],
        draftPoints[i][0],
        draftPoints[i][1],
      );
    }
    return Math.round(total);
  };

  const detectDraftKind = (): 'loop' | 'linear' => {
    if (draftPoints.length < 3) return 'linear';
    const first = draftPoints[0];
    const last = draftPoints[draftPoints.length - 1];
    const dist = haversineM(first[0], first[1], last[0], last[1]);
    return dist < 50 ? 'loop' : 'linear';
  };

  const openSaveRefDialog = () => {
    if (draftPoints.length < 2) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const kind = detectDraftKind();
    const lengthM = computeDraftLength();
    const lengthStr =
      lengthM >= 1000 ? `${(lengthM / 1000).toFixed(1)} км` : `${lengthM} м`;
    const defaultName =
      kind === 'loop'
        ? `Круг ${lengthStr}`
        : `Отрезок ${lengthStr}`;
    setSaveRefName(defaultName);
    setSaveRefStatus('idle');
    setSaveRefError('');
    setSaveRefVisible(true);
  };

  const handleSaveReference = async () => {
    if (!saveRefName.trim() || draftPoints.length < 2) return;
    setSaveRefStatus('saving');
    setSaveRefError('');
    try {
      const api = (window as any).electronAPI;
      const res = await api.pb.referenceTrackCreate({
        name: saveRefName.trim(),
        coords: draftPoints,
        kind: detectDraftKind(),
        notes: null,
      });
      if (res?.success) {
        setSaveRefStatus('saved');
        const newId = res.id;
        setTimeout(() => {
          setSaveRefVisible(false);
          setDrawMode(false);
          setDraftPoints([]);
          void loadReferenceTracks();
          setSelectedRefTrackId(newId ?? null);
        }, 1200);
      } else {
        setSaveRefError(res?.error ?? 'Не удалось сохранить');
        setSaveRefStatus('error');
      }
    } catch (e) {
      setSaveRefError((e as Error).message);
      setSaveRefStatus('error');
    }
  };

  const handleDeleteReference = async (id: number) => {
    if (!window.confirm('Удалить этот эталонный маршрут?')) return;
    try {
      const res = await api.pb.referenceTrackDelete(id);
      if (res?.success) {
        setReferenceTracks((prev) => prev.filter((r) => r.id !== id));
        if (selectedRefTrackId === id) setSelectedRefTrackId(null);
      } else {
        console.error('[pb-map] ref delete error:', res?.error);
      }
    } catch (e) {
      console.error('[pb-map] ref delete:', e);
    }
  };

  // ==================== Редактирование точек эталона ====================

  const openEditPoints = (ref: {
    id: number;
    coords: [number, number][];
  }) => {
    if (drawMode) {
      setDrawMode(false);
      setDraftPoints([]);
      setSaveRefVisible(false);
    }
    if (markupMode) setMarkupMode(false);
    setSelectedRefTrackId(ref.id);
    setEditPointsRefId(ref.id);
    setEditPointsDraft(ref.coords.map((p) => [p[0], p[1]] as [number, number]));
    setEditPointsSaveStatus('idle');
    setEditPointsSaveError('');
    setSplitMode(false);
    setSplitBoundaries(new Set());
    setSplitDeleteSource(true);
    setSplitSaveStatus('idle');
    setSplitSaveError('');
    setEditPointsMode(true);
  };

  const closeEditPoints = () => {
    setEditPointsMode(false);
    setEditPointsRefId(null);
    setEditPointsDraft([]);
    setEditPointsSaveStatus('idle');
    setEditPointsSaveError('');
    setSplitMode(false);
    setSplitBoundaries(new Set());
    setSplitSaveStatus('idle');
    setSplitSaveError('');
  };

  const toggleSplitMode = (on: boolean) => {
    setSplitMode(on);
    if (!on) {
      setSplitBoundaries(new Set());
      setSplitSaveStatus('idle');
      setSplitSaveError('');
    }
  };

  const handleOptimizeEditPoints = () => {
    if (splitMode) return;
    if (editPointsDraft.length < 3) return;
    const simplified = simplifyDP(editPointsDraft, editPointsDpEpsilon);
    setEditPointsDraft(simplified);
  };

  const handleSplitAtom = async () => {
    if (!editPointsRefId || splitParts.length < 2) return;
    setSplitSaveStatus('saving');
    setSplitSaveError('');
    try {
      if (!splitDeleteSource) {
        const saveRes = await api.pb.referenceTrackUpdate(editPointsRefId, {
          coords: editPointsDraft,
        });
        if (!saveRes?.success) {
          setSplitSaveError(saveRes?.error ?? 'Не удалось сохранить геометрию');
          setSplitSaveStatus('error');
          return;
        }
      }

      const rawName =
        editPointsSourceAtom?.name ?? `#${editPointsRefId}`;
      const sourceName = rawName.replace(/\s*·\s*ч\.\d+\s*$/u, '').trim();
      const sourceCategory = editPointsSourceAtom?.category ?? null;

      const parts = splitParts.map((p, i) => ({
        startIdx: p.startIdx,
        endIdx: p.endIdx,
        name: `${sourceName} · ч.${i + 1}`,
        category: sourceCategory,
        tags: [],
      }));

      const res = await api.pb.referenceTrackSplit(editPointsRefId, parts, {
        deleteSource: splitDeleteSource,
      });

      if (res?.success) {
        setSplitSaveStatus('saved');
        void loadReferenceTracks();
        setActiveTab('refs');
        setTimeout(() => {
          closeEditPoints();
        }, 800);
      } else {
        setSplitSaveError(res?.error ?? 'Не удалось разделить');
        setSplitSaveStatus('error');
      }
    } catch (e) {
      setSplitSaveError((e as Error).message);
      setSplitSaveStatus('error');
    }
  };

  const handleSaveEditPoints = async () => {
    if (!editPointsRefId || editPointsDraft.length < 2) return;
    setEditPointsSaveStatus('saving');
    setEditPointsSaveError('');
    try {
      const res = await api.pb.referenceTrackUpdate(editPointsRefId, {
        coords: editPointsDraft,
      });
      if (res?.success) {
        setEditPointsSaveStatus('saved');
        void loadReferenceTracks();
        setTimeout(() => {
          setEditPointsMode(false);
          setEditPointsRefId(null);
          setEditPointsDraft([]);
          setEditPointsSaveStatus('idle');
        }, 700);
      } else {
        setEditPointsSaveError(res?.error ?? 'Не удалось сохранить');
        setEditPointsSaveStatus('error');
      }
    } catch (e) {
      setEditPointsSaveError((e as Error).message);
      setEditPointsSaveStatus('error');
    }
  };

  const fmtRefLength = (m: number): string => {
    if (m < 1000) return `${Math.round(m)} м`;
    return `${(m / 1000).toFixed(2)} км`;
  };

  const fmtRefDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    } catch {
      return iso;
    }
  };

  const refKindLabel = (kind: 'loop' | 'linear' | 'stadium' | null): string => {
    if (kind === 'loop') return 'замкнутый';
    if (kind === 'linear') return 'линейный';
    if (kind === 'stadium') return 'стадион';
    return '—';
  };

  const openEditReference = (ref: {
    id: number;
    name: string;
    category: string | null;
    tags: string[];
  }) => {
    setEditRefItem({
      id: ref.id,
      name: ref.name,
      category: ref.category,
      tags: ref.tags,
    });
    setEditRefVisible(true);
  };

  const toggleRunSelection = (runFactId: number) => {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runFactId)) next.delete(runFactId);
      else next.add(runFactId);
      return next;
    });
  };

  const selectedRunsForMedian = useMemo(() => {
    const out: Array<{
      runFactId: number;
      name: string;
      date: string;
      source: string;
      lengthM: number;
    }> = [];
    for (const g of groupedRuns) {
      for (const it of g.items ?? []) {
        if (selectedRunIds.has(it.id)) {
          out.push({
            runFactId: it.id,
            name: g.displayName,
            date: g.date,
            source: it.source,
            lengthM: (it.actual_km ?? 0) * 1000,
          });
        }
      }
    }
    return out;
  }, [groupedRuns, selectedRunIds]);

  // Группировка эталонов
  const groupedRefs = useMemo(() => {
    const groups: Record<string, typeof referenceTracks> = {};
    const singles: typeof referenceTracks = [];

    for (const ref of referenceTracks) {
      const groupTag = ref.tags.find((t) => t.startsWith('group:'));
      if (groupTag) {
        const groupName = groupTag.replace('group:', '');
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(ref);
      } else {
        singles.push(ref);
      }
    }

    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    }

    return { groups, singles };
  }, [referenceTracks]);

  // ==================== Рендер ====================

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header="Картографический редактор"
      maximizable
      modal
      className="pb-debug-dialog pb-map-editor-dialog"
      contentStyle={{ padding: 0, display: 'flex', overflow: 'hidden' }}
    >
      <div
        ref={editorContainerRef}
        style={{ display: 'flex', width: '100%', height: '100%' }}
      >
        {!initialRunId && isLeftPanelOpen && (
          <>
            <div
              style={{
                width: `${leftPanelWidth}px`,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >

            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
              <div className="pb-catalog__chips" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '0.25rem' }}>
                <button
                  type="button"
                  className={`pb-catalog__chip ${activeTab === 'runs' ? 'is-on' : ''}`}
                  onClick={() => setActiveTab('runs')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  Треки
                </button>
                <button
                  type="button"
                  className={`pb-catalog__chip ${activeTab === 'filters' ? 'is-on' : ''}`}
                  onClick={() => setActiveTab('filters')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  Стиль
                </button>
                <button
                  type="button"
                  className={`pb-catalog__chip ${activeTab === 'thresholds' ? 'is-on' : ''}`}
                  onClick={() => setActiveTab('thresholds')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  Пороги
                </button>
                <button
                  type="button"
                  className={`pb-catalog__chip ${activeTab === 'refs' ? 'is-on' : ''}`}
                  onClick={() => setActiveTab('refs')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  Эталоны
                </button>
              </div>
            </div>



            {activeTab === 'runs' && (
              <>
                {selectedRunIds.size >= 1 && (
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid var(--surface-border)',
                      background: 'rgba(212, 163, 115, 0.08)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.4rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ color: 'var(--pb-accent)', fontWeight: 600 }}>
                        Выбрано: {selectedRunIds.size}
                      </span>
                      <Button
                        label="Снять"
                        icon="pi pi-times"
                        text
                        className="pb-soft p-button-sm"
                        onClick={() => setSelectedRunIds(new Set())}
                        style={{ marginLeft: 'auto', padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}
                      />
                    </div>
                    <Button
                      label={
                        selectedRunIds.size === 1
                          ? 'Сохранить как эталон'
                          : 'Построить медианный трек'
                      }
                      icon={
                        selectedRunIds.size === 1
                          ? 'pi pi-save'
                          : 'pi pi-chart-line'
                      }
                      className="pb p-button-sm w-full"
                      onClick={() => setMedianDialogVisible(true)}
                    />
                  </div>
                )}
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="pb-run-filters__row">
                    <label className="pb-label">Поиск по названию</label>
                    <span className="pb-run-filters__search-wrap">
                      <i className="pi pi-search" />
                      <InputText
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Утренний, длинная, 1047…"
                        className="pb-run-filters__search"
                      />
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <Button
                      icon={groupedRunsView ? 'pi pi-list' : 'pi pi-th-large'}
                      label={groupedRunsView ? 'Список' : 'По группам'}
                      className="pb-soft p-button-sm"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setGroupedRunsView(!groupedRunsView)}
                      tooltip={
                        groupedRunsView
                          ? 'Показать без секций'
                          : 'Группировка по статусу (Пройдено / Похоже / Без маршрута)'
                      }
                      tooltipOptions={{ position: 'bottom' }}
                      disabled={referenceTracks.length === 0}
                    />
                    {referenceTracks.length === 0 && (
                      <span className="pb-hint" style={{ fontSize: '0.68rem' }}>
                        Группировка недоступна
                      </span>
                    )}
                  </div>
                </div>
                {filterByRefId !== null && (
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderBottom: '1px solid var(--surface-border)',
                      background: 'rgba(106, 178, 242, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <i className="pi pi-filter" style={{ color: '#6ab2f2' }} />
                    <span style={{ color: '#6ab2f2', fontWeight: 600 }}>
                      Фильтр: {referenceTracks.find((r) => r.id === filterByRefId)?.name ?? '...'}
                    </span>

                    <label
                      className="pb-check-row pb-checkbox-dark"
                      style={{ fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      title="Показывать только те пробежки, где этот атом — главный маршрут"
                    >
                      <Checkbox
                        checked={filterOnlyPrimary}
                        onChange={(e) => setFilterOnlyPrimary(!!e.checked)}
                      />
                      <span>Только primary</span>
                    </label>

                    <Button
                      icon="pi pi-times"
                      text
                      className="pb-soft p-button-sm"
                      style={{ marginLeft: 'auto', padding: '0.1rem', width: '1.8rem', height: '1.8rem' }}
                      onClick={() => setFilterByRefId(null)}
                      tooltip="Сбросить фильтр"
                      tooltipOptions={{ position: 'bottom' }}
                    />
                  </div>
                )}

                <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {loadingFacts && (
                    <div className="pb-hint" style={{ textAlign: 'center', padding: '1rem' }}>
                      Загрузка...
                    </div>
                  )}
                  {!loadingFacts && !groupedRunsView && (() => {
                    // Плоский список — без секций, без группировки
                    const flat = filterByRefId !== null
                      ? visibleGroups.filter((g) => {
                          const covs = batchCoverage.get(g.primary.id);
                          if (!covs) return false;
                          if (filterOnlyPrimary) {
                            const prim = primaryPerRun.get(g.primary.id);
                            return prim?.refId === filterByRefId;
                          }
                          const target = covs.find((c) => c.refId === filterByRefId);
                          return target && (target.cls === 'used' || target.cls === 'similar');
                        })
                      : visibleGroups;
                    return (
                      <>
                        {flat.map((g, idx) => {
                          const isSelected = selectedGroup?.primary.id === g.primary.id && selectedGroup?.startTime === g.startTime;
                          return (
                            <div
                              key={`${g.date}-${g.startTime ?? idx}-${g.primary.id}`}
                              onClick={() => {
                                setSelectedGroup(g);
                                setSelectedSource(g.primary.source);
                              }}
                              style={{
                                padding: '0.5rem',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                marginBottom: '0.25rem',
                                background: isSelected ? 'rgba(212,163,115,0.15)' : 'transparent',
                                border: isSelected ? '1px solid var(--pb-accent)' : '1px solid transparent',
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'flex-start',
                              }}
                            >
                              <label
                                className="pb-checkbox-dark"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'inline-flex', cursor: 'pointer', marginTop: '0.1rem', flexShrink: 0 }}
                                title="Отметить для построения медианного трека"
                              >
                                <Checkbox
                                  checked={selectedRunIds.has(g.primary.id)}
                                  onChange={() => toggleRunSelection(g.primary.id)}
                                />
                              </label>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.displayName}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }}>{g.date}</span>
                                </div>
                                <div className="pb-source-badges" style={{ marginTop: '0.25rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {g.sources.map((s: any) => (
                                    <span key={s} className={`pb-source-badge pb-source-badge--${s}`}>{s}</span>
                                  ))}
                                  <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginLeft: 'auto' }}>
                                    {g.primary.actual_km ? `${g.primary.actual_km.toFixed(2)} км` : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {flat.length === 0 && (
                          <div className="pb-hint" style={{ textAlign: 'center', padding: '1rem' }}>
                            Нет пробежек под этот фильтр
                          </div>
                        )}
                        {visibleCount < filteredGroups.length && filterByRefId === null && (
                          <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                            <Button
                              label="Показать ещё"
                              className="pb-soft p-button-sm"
                              onClick={() => setVisibleCount((prev) => prev + CHUNK_SIZE)}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {!loadingFacts && groupedRunsView && (() => {
                    const renderSection = (
                      key: string,
                      title: string,
                      items: typeof categorizedGroups.used,
                    ) => {
                      if (items.length === 0) return null;
                      const isCollapsed = collapsedSections.has(key);
                      return (
                        <div key={key} style={{ marginBottom: '0.5rem' }}>
                          <div
                            onClick={() => {
                              const next = new Set(collapsedSections);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              setCollapsedSections(next);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.5rem',
                              cursor: 'pointer',
                              background: 'rgba(255,255,255,0.03)',
                              borderRadius: 4,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--tg-hint)',
                              userSelect: 'none',
                            }}
                          >
                            <i
                              className={`pi ${
                                isCollapsed ? 'pi-chevron-right' : 'pi-chevron-down'
                              }`}
                              style={{ fontSize: '0.65rem' }}
                            />
                            {title}
                            <span
                              style={{
                                marginLeft: 'auto',
                                opacity: 0.6,
                                fontFamily: 'monospace',
                              }}
                            >
                              {items.length}
                            </span>
                          </div>
                          {!isCollapsed && (
                            <div style={{ marginTop: '0.3rem' }}>
                              {items.map((g, idx) => {
                                const isSelected =
                                  selectedGroup?.primary.id === g.primary.id &&
                                  selectedGroup?.startTime === g.startTime;
                                return (
                                  <div
                                    key={`${g.date}-${g.startTime ?? idx}-${g.primary.id}`}
                                    onClick={() => {
                                      setSelectedGroup(g);
                                      setSelectedSource(g.primary.source);
                                    }}
                                    style={{
                                      padding: '0.5rem',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                      marginBottom: '0.25rem',
                                      background: isSelected
                                        ? 'rgba(212,163,115,0.15)'
                                        : 'transparent',
                                      border: isSelected
                                        ? '1px solid var(--pb-accent)'
                                        : '1px solid transparent',
                                      display: 'flex',
                                      gap: '0.5rem',
                                      alignItems: 'flex-start',
                                    }}
                                  >
                                    <label
                                      className="pb-checkbox-dark"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        display: 'inline-flex',
                                        cursor: 'pointer',
                                        marginTop: '0.1rem',
                                        flexShrink: 0,
                                      }}
                                      title="Отметить для построения медианного трека"
                                    >
                                      <Checkbox
                                        checked={selectedRunIds.has(g.primary.id)}
                                        onChange={() => toggleRunSelection(g.primary.id)}
                                      />
                                    </label>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                          {g.displayName}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }}>
                                          {g.date}
                                        </span>
                                      </div>
                                      <div
                                        className="pb-source-badges"
                                        style={{
                                          marginTop: '0.25rem',
                                          alignItems: 'center',
                                          flexWrap: 'wrap',
                                          gap: '0.25rem',
                                        }}
                                      >
                                        {g.sources.map((s: any) => (
                                          <span
                                            key={s}
                                            className={`pb-source-badge pb-source-badge--${s}`}
                                          >
                                            {s}
                                          </span>
                                        ))}
                                        {(() => {
                                          const prim = primaryPerRun.get(g.primary.id);
                                          if (!prim) return null;
                                          const tooltip =
                                            `Primary: ${prim.name} (${
                                              prim.isLoop ? `×${prim.repeats}, ` : ''
                                            }${prim.coveragePct}%)` +
                                            (prim.alsoUsed.length > 0
                                              ? '\nТакже на: ' +
                                                prim.alsoUsed
                                                  .map((u) => `${u.name} (${u.coveragePct}%)`)
                                                  .join(', ')
                                              : '');
                                          return (
                                            <span
                                              title={tooltip}
                                              style={{
                                                fontSize: '0.65rem',
                                                padding: '0.05rem 0.35rem',
                                                borderRadius: 3,
                                                background: 'rgba(106, 178, 242, 0.15)',
                                                color: '#6ab2f2',
                                                fontWeight: 600,
                                                cursor: 'help',
                                                maxWidth: '11rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                display: 'inline-block',
                                              }}
                                            >
                                              {prim.isLoop && prim.repeats > 0
                                                ? `×${prim.repeats}`
                                                : `${prim.coveragePct}%`}
                                              {' · '}
                                              <span style={{ opacity: 0.85, fontWeight: 400 }}>
                                                {prim.name.length > 14
                                                  ? prim.name.slice(0, 14) + '…'
                                                  : prim.name}
                                              </span>
                                            </span>
                                          );
                                        })()}
                                        <span
                                          style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--tg-hint)',
                                            marginLeft: 'auto',
                                          }}
                                        >
                                          {g.primary.actual_km
                                            ? `${g.primary.actual_km.toFixed(2)} км`
                                            : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        {renderSection('used', '🟢 Пройдено', categorizedGroups.used)}
                        {renderSection('similar', '🟡 Похоже на маршрут', categorizedGroups.similar)}
                        {renderSection('unused', '⚪ Без маршрута', categorizedGroups.unused)}
                        {categorizedGroups.used.length === 0 &&
                          categorizedGroups.similar.length === 0 &&
                          categorizedGroups.unused.length === 0 && (
                            <div
                              className="pb-hint"
                              style={{ textAlign: 'center', padding: '1rem' }}
                            >
                              Нет пробежек под этот фильтр
                            </div>
                          )}
                        {visibleCount < filteredGroups.length && filterByRefId === null && (
                          <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                            <Button
                              label="Показать ещё"
                              className="pb-soft p-button-sm"
                              onClick={() => setVisibleCount((prev) => prev + CHUNK_SIZE)}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            )}

            {activeTab === 'filters' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>

                {/* Слои */}
                <div className="pb-connections__block">
                  <div className="pb-connections__title">
                    <i className="pi pi-clone" /> Слои карты
                    <Button
                      icon="pi pi-plus"
                      text
                      className="pb-soft p-button-sm"
                      style={{ marginLeft: 'auto', padding: '0.1rem', width: '1.8rem', height: '1.8rem' }}
                      onClick={addLayer}
                      tooltip="Добавить слой"
                      tooltipOptions={{ position: 'bottom' }}
                    />
                  </div>
                  {layers.map(l => (
                    <div key={l.id}
                      onClick={() => setActiveLayerId(l.id)}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '0.4rem',
                        borderRadius: '4px', cursor: 'pointer', marginBottom: '0.25rem',
                        background: activeLayerId === l.id ? 'rgba(212,163,115,0.1)' : 'transparent',
                        border: activeLayerId === l.id ? '1px solid var(--pb-accent)' : '1px solid transparent',
                      }}
                    >
                      <label className="pb-check-row pb-checkbox-dark" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={l.visible}
                          onChange={(e) => {
                            const next = layers.map(x => x.id === l.id ? { ...x, visible: !!e.checked } : x);
                            setLayers(next);
                            if (mapRef.current && mapRef.current.getLayer(l.id)) {
                              mapRef.current.setLayoutProperty(l.id, 'visibility', (e.checked ? 'visible' : 'none') as any);
                            }
                          }}
                        />
                      </label>
                      <span style={{ marginLeft: '0.5rem', flex: 1, fontSize: '0.8rem' }}>{l.name}</span>
                      <Button
                        icon="pi pi-trash"
                        text
                        className="pb-drawer__name-edit"
                        onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }}
                        tooltip="Удалить слой"
                        tooltipOptions={{ position: 'left' }}
                      />
                    </div>
                  ))}
                </div>

                {/* Настройки активного слоя */}
                {activeLayer && (
                  <div className="pb-connections__block mt-2">
                    <div className="pb-connections__title">Свойства: {activeLayer.name}</div>
                    {(['opacity','brightnessMin','brightnessMax','saturation','contrast','hueRotate'] as (keyof RasterLayer)[]).map(k => (
                      <div key={k} style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                          <span>{k === 'brightnessMin' ? 'Яркость (мин)' : k === 'brightnessMax' ? 'Яркость (макс)' : k === 'hueRotate' ? 'Сдвиг цвета (°)' : k}</span>
                          <span style={{ fontFamily: 'monospace' }}>{(activeLayer[k] as number).toFixed(2)}</span>
                        </div>
                        <Slider
                          value={activeLayer[k] as number}
                          min={k === 'hueRotate' ? 0 : k === 'saturation' || k === 'contrast' ? -1 : 0}
                          max={k === 'hueRotate' ? 360 : 1}
                          step={k === 'hueRotate' ? 5 : 0.05}
                          onChange={(e) => handleSliderChange(activeLayerId, k, e.value as number)}
                        />
                      </div>
                    ))}
                    <Button label="Сбросить слой" icon="pi pi-refresh" className="pb-soft p-button-sm w-full mt-3"
                      onClick={() => {
                        const def = DEFAULT_LAYERS.find(d => d.id === 'layer-base')!;
                        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...def, id: l.id, name: l.name } : l));
                      }} />
                  </div>
                )}

                {/* Настройки трека */}
                <div className="pb-connections__block mt-2">
                  <div className="pb-connections__title">Настройки трека</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--tg-hint)' }}>Цвет (базовый)</span>
                    <input
                      type="color"
                      value={trackSettings.color}
                      onChange={(e) => updateTrackSetting('color', e.target.value)}
                      style={{ width: '2.5rem', height: '1.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                      <span>Толщина</span>
                      <span style={{ fontFamily: 'monospace' }}>{trackSettings.width}px</span>
                    </div>
                    <Slider
                      value={trackSettings.width}
                      min={1} max={10} step={1}
                      onChange={(e) => updateTrackSetting('width', e.value as number)}
                    />
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--tg-hint)' }}>
                      <span>Прозрачность</span>
                      <span style={{ fontFamily: 'monospace' }}>{trackSettings.opacity.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={trackSettings.opacity}
                      min={0.1} max={1} step={0.1}
                      onChange={(e) => updateTrackSetting('opacity', e.value as number)}
                    />
                  </div>

                  <div className="flex align-items-center mt-3 pb-check-row pb-checkbox-dark" style={{ cursor: 'pointer' }}>
                    <Checkbox
                      checked={trackSettings.glow}
                      onChange={(e) => updateTrackSetting('glow', !!e.checked)}
                    />
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>Свечение под треком</span>
                  </div>

                  <Button
                    label="Сбросить настройки трека"
                    icon="pi pi-refresh"
                    className="pb-soft p-button-sm w-full mt-3"
                    onClick={() => {
                      setTrackSettings(DEFAULT_TRACK_SETTINGS);
                      saveTrackSettings(DEFAULT_TRACK_SETTINGS);
                    }}
                  />
                </div>

                {/* Градиент по данным */}
                <div className="pb-connections__block mt-2">
                  <div className="pb-connections__title">Градиент по данным</div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.35rem' }}>Канал</div>
                    <Dropdown
                      value={gradient.channel}
                      options={[
                        { label: 'Нет (сплошной)', value: 'none' },
                        { label: 'Пульс', value: 'hr' },
                        { label: 'Скорость', value: 'speedKmh' },
                        { label: 'Высота', value: 'elevationM' },
                        { label: 'Каденс', value: 'cadence' },
                      ]}
                      onChange={(e) => updateGradient({ channel: e.value })}
                      className="pb-wade-programs__dd w-full"
                      panelClassName="pb-dropdown-panel"
                    />
                  </div>

                  {gradient.channel !== 'none' && (
                    <>
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--tg-hint)', marginBottom: '0.35rem' }}>Палитра</div>
                        <Dropdown
                          value={gradient.palette}
                          options={paletteOptions}
                          onChange={(e) => updateGradient({ palette: e.value })}
                          className="pb-wade-programs__dd w-full"
                          panelClassName="pb-dropdown-panel"
                        />
                      </div>

                      {gradientStats && (
                        <div className="pb-hint" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
                          Диапазон: {gradientStats.min.toFixed(1)} – {gradientStats.max.toFixed(1)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Пороги автоопределения */}
                <div id="pb-coverage-thresholds" className="pb-connections__block mt-2">
                  <div className="pb-connections__title">
                    <i className="pi pi-sliders-h" /> Пороги автоопределения
                  </div>

                  {(
                    [
                      {
                        key: 'coverageUsed' as const,
                        label: 'Coverage для used',
                        min: 50, max: 95, step: 1, suffix: '%',
                      },
                      {
                        key: 'coverageSimilar' as const,
                        label: 'Coverage для similar',
                        min: 20, max: 70, step: 1, suffix: '%',
                      },
                      {
                        key: 'ratioLoopMin' as const,
                        label: 'Ratio loop (мин.)',
                        min: 0.7, max: 1.2, step: 0.05, suffix: '',
                      },
                      {
                        key: 'ratioLinearMin' as const,
                        label: 'Ratio linear (мин.)',
                        min: 0.5, max: 1.0, step: 0.05, suffix: '',
                      },
                      {
                        key: 'ratioLinearMax' as const,
                        label: 'Ratio linear (макс.)',
                        min: 1.0, max: 2.0, step: 0.05, suffix: '',
                      },
                      {
                        key: 'medianMaxM' as const,
                        label: 'Медиана откл. (макс., м)',
                        min: 20, max: 200, step: 5, suffix: ' м',
                      },
                      {
                        key: 'coverageRadiusM' as const,
                        label: 'Радиус покрытия',
                        min: 5, max: 50, step: 1, suffix: ' м',
                      },
                      {
                        key: 'onRefRadiusM' as const,
                        label: 'Радиус на эталоне',
                        min: 10, max: 100, step: 5, suffix: ' м',
                      },
                      {
                        key: 'checkpointCount' as const,
                        label: 'Количество КП',
                        min: 3, max: 12, step: 1, suffix: '',
                      },
                    ] as const
                  ).map((p) => (
                    <div key={p.key} style={{ marginTop: '0.6rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.72rem',
                          color: 'var(--tg-hint)',
                        }}
                      >
                        <span>{p.label}</span>
                        <span style={{ fontFamily: 'monospace' }}>
                          {coverageThresholds[p.key] ?? '—'}
                          {p.suffix}
                        </span>
                      </div>
                      <Slider
                        value={(coverageThresholds[p.key] as number) ?? p.min}
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        onChange={(e) => {
                          const val = e.value as number;
                          const next = {
                            ...coverageThresholds,
                            [p.key]: val,
                          };
                          setCoverageThresholds(next);
                          saveCoverageThresholds(next);
                        }}
                      />
                    </div>
                  ))}

                  <Button
                    label="Сбросить к дефолтам"
                    icon="pi pi-refresh"
                    className="pb-soft p-button-sm w-full mt-3"
                    onClick={() => {
                      setCoverageThresholds(DEFAULT_COVERAGE_THRESHOLDS);
                      saveCoverageThresholds(DEFAULT_COVERAGE_THRESHOLDS);
                    }}
                  />
                  <div className="pb-hint" style={{ fontSize: '0.7rem', marginTop: '0.4rem' }}>
                    Влияют на классификацию used / similar и выбор primary-атома. Пересчёт мгновенный.
                    Больше КП — точнее подсчёт кругов на сложных маршрутах (детуры, петли).
                  </div>
                </div>

                {/* Стиль эталонов на карте */}
                <div id="pb-all-refs-styles" className="pb-connections__block mt-2">
                  <div className="pb-connections__title">
                    <i className="pi pi-palette" /> Стиль эталонов на карте
                  </div>

                  <div className="pb-hint" style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>
                    Применяется в режиме «Все эталоны» (кнопка 🗺️ на карте).
                  </div>

                  {(
                    [
                      { key: 'used' as const, label: '🟢 Пройдено (used)' },
                      { key: 'similar' as const, label: '🟡 Похоже (similar)' },
                      { key: 'unused' as const, label: '⚪ Не пройдено (unused)' },
                    ]
                  ).map((cat) => {
                    const st = allRefsStyles[cat.key];
                    const update = (patch: Partial<typeof st>) => {
                      const next = {
                        ...allRefsStyles,
                        [cat.key]: { ...st, ...patch },
                      };
                      setAllRefsStyles(next);
                      saveAllRefsStyles(next);
                    };
                    return (
                      <div
                        key={cat.key}
                        style={{
                          marginTop: '0.75rem',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--surface-border)',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          {cat.label}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '0.3rem',
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', color: 'var(--tg-hint)' }}>Цвет</span>
                          <input
                            type="color"
                            value={st.color}
                            onChange={(e) => update({ color: e.target.value })}
                            style={{
                              width: '2.5rem',
                              height: '1.5rem',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                          />
                        </div>

                        <div style={{ marginTop: '0.4rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.7rem',
                              color: 'var(--tg-hint)',
                            }}
                          >
                            <span>Толщина</span>
                            <span style={{ fontFamily: 'monospace' }}>{st.width}px</span>
                          </div>
                          <Slider
                            value={st.width}
                            min={1}
                            max={10}
                            step={1}
                            onChange={(e) => update({ width: e.value as number })}
                          />
                        </div>

                        <div style={{ marginTop: '0.4rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.7rem',
                              color: 'var(--tg-hint)',
                            }}
                          >
                            <span>Прозрачность</span>
                            <span style={{ fontFamily: 'monospace' }}>{st.opacity.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={st.opacity}
                            min={0.1}
                            max={1}
                            step={0.1}
                            onChange={(e) => update({ opacity: e.value as number })}
                          />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '0.4rem',
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', color: 'var(--tg-hint)' }}>Пунктир</span>
                          <label
                            className="pb-checkbox-dark"
                            style={{ display: 'inline-flex', cursor: 'pointer' }}
                          >
                            <Checkbox
                              checked={st.dashed}
                              onChange={(e) => update({ dashed: !!e.checked })}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    label="Сбросить стили эталонов"
                    icon="pi pi-refresh"
                    className="pb-soft p-button-sm w-full mt-3"
                    onClick={() => {
                      const def = JSON.parse(JSON.stringify(DEFAULT_ALL_REFS_STYLES));
                      setAllRefsStyles(def);
                      saveAllRefsStyles(def);
                    }}
                  />
                </div>

              </div>
            )}

            {activeTab === 'thresholds' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span
                    className="pb-hint"
                    style={{ fontSize: '0.75rem', flex: 1 }}
                  >
                    {segments.length === 0
                      ? 'Пока нет сохранённых отрезков'
                      : `Всего: ${segments.length}`}
                  </span>
                  <Button
                    label="Найти кандидатов"
                    icon="pi pi-search"
                    className="pb-soft p-button-sm"
                    onClick={() => setCandidatesVisible(true)}
                    disabled={!testPoint || !selectedGroup}
                    tooltip={!testPoint ? 'Сначала поставьте точку старта (🎯)' : 'Сканировать тренировки и найти подходящие отрезки'}
                    tooltipOptions={{ position: 'bottom' }}
                  />
                  <Button
                    icon="pi pi-refresh"
                    text
                    className="pb-soft p-button-sm"
                    style={{
                      padding: '0.1rem',
                      width: '1.8rem',
                      height: '1.8rem',
                    }}
                    onClick={() => void loadSegments()}
                    disabled={segmentsLoading}
                    tooltip="Обновить"
                    tooltipOptions={{ position: 'bottom' }}
                  />
                </div>

                <div
                  className="pb-catalog__chips"
                  style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}
                >
                  {[
                    { id: 'all', label: 'Все' },
                    { id: 'time-60', label: '1м' },
                    { id: 'time-300', label: '5м' },
                    { id: 'time-600', label: '10м' },
                    { id: 'time-1200', label: '20м' },
                    { id: 'time-1800', label: '30м' },
                    { id: 'distance', label: 'Дист.' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`pb-catalog__chip ${
                        segmentFilter === f.id ? 'is-on' : ''
                      }`}
                      onClick={() =>
                        setSegmentFilter(f.id as typeof segmentFilter)
                      }
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {segmentsLoading && (
                  <div
                    className="pb-hint"
                    style={{ textAlign: 'center', padding: '0.5rem' }}
                  >
                    <i className="pi pi-spin pi-spinner" /> Загрузка…
                  </div>
                )}

                {segmentMedians && segmentMedians.count > 0 && (
                  <div
                    style={{
                      background: 'rgba(212, 163, 115, 0.08)',
                      border: '1px solid rgba(212, 163, 115, 0.3)',
                      borderRadius: 6,
                      padding: '0.5rem 0.6rem',
                      marginBottom: '0.75rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        color: 'var(--pb-accent)',
                        fontWeight: 600,
                        marginBottom: '0.3rem',
                      }}
                    >
                      Медиана {segmentFilter === 'all' ? 'всех' : 'по фильтру'} (
                      {segmentMedians.count}{' '}
                      {segmentMedians.count === 1 ? 'тест' : 'тестов'})
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr',
                        gap: '0.15rem 0.5rem',
                      }}
                    >
                      <span style={{ color: 'var(--tg-hint)' }}>HR:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {segmentMedians.hrMedian != null
                          ? Math.round(segmentMedians.hrMedian)
                          : '—'}{' '}
                        уд/мин
                      </span>
                      <span style={{ color: 'var(--tg-hint)' }}>Темп:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {fmtSegPace(segmentMedians.paceMedian)} /км
                      </span>
                      <span style={{ color: 'var(--tg-hint)' }}>Дрейф:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {segmentMedians.driftMedian != null
                          ? `${
                              segmentMedians.driftMedian >= 0 ? '+' : ''
                            }${segmentMedians.driftMedian.toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>
                    {segmentMedians.count < 3 && (
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--tg-hint)',
                          marginTop: '0.3rem',
                        }}
                      >
                        Для статистики нужно ≥3 теста
                      </div>
                    )}
                  </div>
                )}

                {filteredSegments.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.72rem',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--surface-border)',
                            color: 'var(--tg-hint)',
                            textAlign: 'left',
                          }}
                        >
                          <th style={{ padding: '0.4rem 0.3rem' }}>Дата</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Трек</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Длит.</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Темп</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>HR</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Макс</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}>Дрейф</th>
                          <th style={{ padding: '0.4rem 0.3rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSegments.map((s) => {
                          const info = getFactInfo(s.runFactId);
                          return (
                            <tr
                              key={s.id}
                              style={{
                                borderBottom:
                                  '1px solid rgba(255,255,255,0.04)',
                              }}
                            >
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  color: 'var(--tg-hint)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {fmtSegDate(s.createdAt)}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  maxWidth: '100px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={info.name}
                              >
                                {info.name}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {fmtSegDuration(s)}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {fmtSegPace(s.paceSecPerKm)}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {s.hrAvg != null ? Math.round(s.hrAvg) : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {s.hrMax ?? '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  fontFamily: 'monospace',
                                  color:
                                    s.hrDriftPct != null &&
                                    Math.abs(s.hrDriftPct) > 5
                                      ? 'var(--tg-destructive)'
                                      : undefined,
                                }}
                              >
                                {s.hrDriftPct != null
                                  ? `${
                                      s.hrDriftPct >= 0 ? '+' : ''
                                    }${s.hrDriftPct.toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.35rem 0.3rem',
                                  width: '30px',
                                }}
                              >
                                <Button
                                  icon="pi pi-trash"
                                  text
                                  className="pb-drawer__name-edit"
                                  style={{
                                    width: '1.7rem',
                                    height: '1.7rem',
                                    padding: 0,
                                  }}
                                  onClick={() => void handleDeleteSegment(s.id)}
                                  tooltip="Удалить"
                                  tooltipOptions={{ position: 'left' }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!segmentsLoading &&
                  filteredSegments.length === 0 &&
                  segments.length > 0 && (
                    <div
                      className="pb-hint"
                      style={{
                        textAlign: 'center',
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      Нет отрезков под этот фильтр
                    </div>
                  )}

                {!segmentsLoading && segments.length === 0 && (
                  <div
                    className="pb-hint"
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      border: '1px dashed var(--surface-border)',
                      borderRadius: 6,
                    }}
                  >
                    Поставьте точку старта на карте (🎯), выберите длительность
                    и сохраните тест.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'refs' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span className="pb-hint" style={{ fontSize: '0.75rem', flex: 1 }}>
                    {referenceTracks.length === 0
                      ? 'Нет сохранённых эталонов'
                      : `Всего: ${referenceTracks.length}`}
                  </span>
                  <Button
                    label="Рисовать"
                    icon="pi pi-pencil"
                    className={drawMode ? 'pb p-button-sm' : 'pb-soft p-button-sm'}
                    onClick={() => {
                      if (markupMode) setMarkupMode(false);
                      if (drawMode) {
                        setDrawMode(false);
                        setDraftPoints([]);
                        setSaveRefVisible(false);
                      } else {
                        setDrawMode(true);
                        setDraftPoints([]);
                        setSelectedRefTrackId(null);
                      }
                    }}
                    tooltip="Нарисовать новый эталонный маршрут"
                    tooltipOptions={{ position: 'bottom' }}
                  />
                  <Button
                    icon="pi pi-sliders-h"
                    text
                    className="pb-soft p-button-sm"
                    style={{
                      padding: '0.1rem',
                      width: '1.8rem',
                      height: '1.8rem',
                    }}
                    onClick={() => {
                      setActiveTab('filters');
                      setTimeout(() => {
                        document
                          .getElementById('pb-coverage-thresholds')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                      }, 150);
                    }}
                    tooltip="Пороги автоопределения"
                    tooltipOptions={{ position: 'bottom' }}
                  />
                  <Button
                    icon="pi pi-refresh"
                    text
                    className="pb-soft p-button-sm"
                    style={{
                      padding: '0.1rem',
                      width: '1.8rem',
                      height: '1.8rem',
                    }}
                    onClick={() => void loadReferenceTracks()}
                    disabled={refTracksLoading}
                    tooltip="Обновить"
                    tooltipOptions={{ position: 'bottom' }}
                  />
                </div>

                {refTracksLoading && (
                  <div className="pb-hint" style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <i className="pi pi-spin pi-spinner" /> Загрузка…
                  </div>
                )}

                {!refTracksLoading && referenceTracks.length === 0 && (
                  <div
                    className="pb-hint"
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      border: '1px dashed var(--surface-border)',
                      borderRadius: 6,
                    }}
                  >
                    Нарисуйте первый эталон: кнопка «Рисовать» → кликайте по карте → «Сохранить».
                  </div>
                )}

                {!refTracksLoading && (() => {
                  const renderRefItem = (ref: typeof referenceTracks[0], isChild = false) => {
                    const isSelected = selectedRefTrackId === ref.id;
                    return (
                      <div
                        key={ref.id}
                        id={`pb-ref-item-${ref.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.6rem',
                          borderRadius: 6,
                          marginBottom: '0.3rem',
                          marginLeft: isChild ? '1.5rem' : 0,
                          background: isSelected ? 'rgba(212, 163, 115, 0.25)' : 'transparent',
                          border: isSelected ? '2px solid var(--pb-accent)' : '1px solid var(--surface-border)',
                          boxShadow: isSelected ? '0 0 12px rgba(212, 163, 115, 0.4)' : 'none',
                          cursor: 'pointer',
                          transition: 'background 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => setSelectedRefTrackId(isSelected ? null : ref.id)}
                      >
                        <i
                          className={isSelected ? 'pi pi-eye' : 'pi pi-eye-slash'}
                          style={{ color: isSelected ? 'var(--pb-accent)' : 'var(--tg-hint)', fontSize: '0.85rem', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ref.name}>
                              {ref.name}
                            </span>
                            {ref.category && (
                              <span style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem', borderRadius: 3, background: 'rgba(212, 163, 115, 0.15)', color: 'var(--pb-accent)', flexShrink: 0 }}>
                                {ref.category}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.68rem', color: 'var(--tg-hint)', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                            <span>{fmtRefLength(ref.lengthM)}</span>
                            <span>{refKindLabel(ref.kind)}</span>
                            {(() => {
                              const cov = getRefCoverage(ref.id);
                              if (!cov || ref.kind !== 'loop' || cov.repeats <= 0) return null;
                              return (
                                <span
                                  style={{ fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: 3, background: 'rgba(106, 178, 242, 0.15)', color: '#6ab2f2', fontWeight: 600 }}
                                  title={`Кругов: ${cov.repeats} (покрытие ${cov.dev.coveragePct}%)`}
                                >
                                  ×{cov.repeats}
                                </span>
                              );
                            })()}
                            <span>{fmtRefDate(ref.createdAt)}</span>
                          </div>
                          {(() => {
                            const cov = getRefCoverage(ref.id);
                            if (!cov) return null;
                            const dev = cov.dev;
                            let statusBadge = null;
                            if (cov.cls === 'used') {
                              statusBadge = <span style={{ fontSize: '0.6rem', padding: '0.05rem 0.25rem', borderRadius: 3, background: 'rgba(111, 191, 115, 0.2)', color: '#6fbf73', marginLeft: '0.35rem' }}>Primary</span>;
                            } else if (cov.cls === 'similar') {
                              statusBadge = <span style={{ fontSize: '0.6rem', padding: '0.05rem 0.25rem', borderRadius: 3, background: 'rgba(232, 168, 56, 0.2)', color: '#e8a838', marginLeft: '0.35rem' }}>Похоже</span>;
                            }
                            return (
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', marginTop: '0.2rem', color: dev.isClean ? 'var(--tg-success)' : 'var(--tg-hint)' }}
                                title={`Медиана: ${dev.medianM} м\nПокрытие: ${dev.coveragePct}%\n${dev.isClean ? '✓ Чистый' : '⚠ Есть отклонения'}`}
                              >
                                <i className={`pi ${dev.isClean ? 'pi-check-circle' : 'pi-exclamation-triangle'}`} style={{ fontSize: '0.72rem' }} />
                                <span>{dev.medianM} м</span>
                                {statusBadge}
                                <span style={{ opacity: 0.5 }}>·</span>
                                <span>{dev.coveragePct}%</span>
                                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', opacity: 0.7 }}>p95 {dev.p95M} м</span>
                              </div>
                            );
                          })()}
                        </div>
                        <Button icon="pi pi-filter" text className="pb-drawer__name-edit" style={{ width: '1.8rem', height: '1.8rem', padding: 0, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); setFilterByRefId(ref.id); setActiveTab('runs'); }} tooltip="Показать пробежки" tooltipOptions={{ position: 'left' }} />
                        <Button icon="pi pi-pencil" text className="pb-drawer__name-edit" style={{ width: '1.8rem', height: '1.8rem', padding: 0, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); openEditReference(ref); }} tooltip="Редактировать" tooltipOptions={{ position: 'left' }} />
                        <Button icon="pi pi-trash" text className="pb-drawer__name-edit" style={{ width: '1.8rem', height: '1.8rem', padding: 0, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); void handleDeleteReference(ref.id); }} tooltip="Удалить" tooltipOptions={{ position: 'left' }} />
                      </div>
                    );
                  };

                  return (
                    <>
                      {Object.entries(groupedRefs.groups).map(([groupName, refs]) => {
                        const isExpanded = expandedRefGroups.has(groupName);
                        const rootName = refs[0]?.name.replace(/\s*·\s*ч\.\d+$/u, '') || groupName;
                        return (
                          <div key={groupName} style={{ marginBottom: '0.5rem', border: '1px solid var(--surface-border)', borderRadius: 6, overflow: 'hidden' }}>
                            <div
                              onClick={() => {
                                const next = new Set(expandedRefGroups);
                                if (next.has(groupName)) next.delete(groupName);
                                else next.add(groupName);
                                setExpandedRefGroups(next);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                            >
                              <i className={`pi ${isExpanded ? 'pi-folder-open' : 'pi-folder'}`} style={{ color: 'var(--pb-accent)' }} />
                              <span style={{ flex: 1 }}>{rootName} <span style={{ color: 'var(--tg-hint)', fontWeight: 400 }}>({refs.length} ч.)</span></span>
                              <i className={`pi ${isExpanded ? 'pi-chevron-up' : 'pi-chevron-down'}`} style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }} />
                            </div>
                            {isExpanded && (
                              <div style={{ padding: '0.3rem' }}>
                                {refs.map((r) => renderRefItem(r, true))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {groupedRefs.singles.map((r) => renderRefItem(r, false))}

                      {referenceTracks.length === 0 && (
                        <div className="pb-hint" style={{ padding: '0.75rem', fontSize: '0.75rem', textAlign: 'center', border: '1px dashed var(--surface-border)', borderRadius: 6 }}>
                          Нарисуйте первый эталон: кнопка «Рисовать» → кликайте по карте → «Сохранить».
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            </div>

            <div
              onMouseDown={(e) => {
                e.preventDefault();
                isResizingRef.current = true;
                document.body.style.cursor = 'col-resize';
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  'var(--pb-accent)';
              }}
              onMouseLeave={(e) => {
                if (!isResizingRef.current) {
                  (e.currentTarget as HTMLDivElement).style.background =
                    'var(--surface-border)';
                }
              }}
              style={{
                width: '4px',
                flexShrink: 0,
                cursor: 'col-resize',
                background: 'var(--surface-border)',
                transition: 'background 0.15s ease',
                position: 'relative',
                zIndex: 1,
              }}
              title="Потяните, чтобы изменить ширину панели"
            />
          </>
        )}

        <div style={{ flex: 1, position: 'relative', height: '100%' }}>

          {loadingStreams && (
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
              <i className="pi pi-spin pi-spinner" />
            </div>
          )}

          {selectedGroup && (
            <div style={{
              position: 'absolute', top: 10, left: 10, zIndex: 5,
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              pointerEvents: 'none'
            }}>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {!initialRunId && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(23, 33, 43, 0.85)', borderRadius: '6px', border: '1px solid var(--surface-border)',
                    backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', boxSizing: 'border-box'
                  }}>
                    <Button
                      icon={isLeftPanelOpen ? 'pi pi-angle-double-left' : 'pi pi-angle-double-right'}
                      text
                      className="pb-drawer__name-edit"
                      onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                      tooltip={isLeftPanelOpen ? 'Свернуть панель' : 'Развернуть панель'}
                      tooltipOptions={{ position: 'bottom' }}
                    />
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(23, 33, 43, 0.85)', borderRadius: '6px', border: '1px solid var(--surface-border)',
                  backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', width: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button
                    icon="pi pi-camera"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => {
                      setMapSnapshot(null);
                      setStoryVisible(true);
                    }}
                    tooltip="Сделать сторис"
                    tooltipOptions={{ position: 'bottom' }}
                  />
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: markupMode ? 'rgba(212, 163, 115, 0.2)' : 'rgba(23, 33, 43, 0.85)',
                  borderRadius: '6px',
                  border: `1px solid ${markupMode ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                  backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', width: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button
                    icon="pi pi-map-marker"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => {
                      if (drawMode) {
                        setDrawMode(false);
                        setDraftPoints([]);
                        setSaveRefVisible(false);
                      }
                      setMarkupMode((v) => !v);
                    }}
                    tooltip={markupMode ? 'Выйти из разметки' : 'Разметка: клик по карте — поставить точку старта'}
                    tooltipOptions={{ position: 'bottom' }}
                    style={{ color: markupMode ? 'var(--pb-accent)' : undefined }}
                    disabled={drawMode}
                  />
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: drawMode ? 'rgba(212, 163, 115, 0.2)' : 'rgba(23, 33, 43, 0.85)',
                  borderRadius: '6px',
                  border: `1px solid ${drawMode ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                  backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', width: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button
                    icon="pi pi-pencil"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => {
                      if (markupMode) setMarkupMode(false);
                      if (editPointsMode) closeEditPoints();
                      if (drawMode) {
                        setDrawMode(false);
                        setDraftPoints([]);
                        setSaveRefVisible(false);
                      } else {
                        setDrawMode(true);
                        setDraftPoints([]);
                      }
                    }}
                    tooltip={drawMode ? 'Выйти из рисования (Esc)' : 'Нарисовать эталонный маршрут'}
                    tooltipOptions={{ position: 'bottom' }}
                    style={{ color: drawMode ? 'var(--pb-accent)' : undefined }}
                    disabled={markupMode}
                  />
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: showAllRefs ? 'rgba(212, 163, 115, 0.2)' : 'rgba(23, 33, 43, 0.85)',
                  borderRadius: '6px',
                  border: `1px solid ${showAllRefs ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                  backdropFilter: 'blur(4px)', pointerEvents: 'auto', height: '2.5rem', width: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button
                    icon="pi pi-map"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => {
                      if (markupMode) setMarkupMode(false);
                      if (drawMode) { setDrawMode(false); setDraftPoints([]); }
                      if (editPointsMode) closeEditPoints();
                      setShowAllRefs(!showAllRefs);
                    }}
                    tooltip={showAllRefs ? 'Скрыть все эталоны' : 'Показать все эталоны (цвета: синий-used, жёлтый-similar, серый-unused)'}
                    tooltipOptions={{ position: 'bottom' }}
                    style={{ color: showAllRefs ? 'var(--pb-accent)' : undefined }}
                  />
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: editPointsMode
                    ? 'rgba(212, 163, 115, 0.2)'
                    : 'rgba(23, 33, 43, 0.85)',
                  borderRadius: '6px',
                  border: `1px solid ${editPointsMode ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                  backdropFilter: 'blur(4px)',
                  pointerEvents: 'auto',
                  height: '2.5rem',
                  width: '2.5rem',
                  boxSizing: 'border-box',
                  opacity: selectedRefTrackId == null && !editPointsMode ? 0.5 : 1,
                }}>
                  <Button
                    icon="pi pi-expand"
                    text
                    className="pb-drawer__name-edit"
                    onClick={() => {
                      if (editPointsMode) {
                        closeEditPoints();
                        return;
                      }
                      if (markupMode) setMarkupMode(false);
                      if (drawMode) {
                        setDrawMode(false);
                        setDraftPoints([]);
                        setSaveRefVisible(false);
                      }
                      const ref = referenceTracks.find((r) => r.id === selectedRefTrackId);
                      if (ref) openEditPoints(ref);
                    }}
                    tooltip={
                      editPointsMode
                        ? 'Выйти из редактирования точек (Esc)'
                        : selectedRefTrackId == null
                        ? 'Сначала выберите эталон на карте'
                        : 'Редактировать точки эталона'
                    }
                    tooltipOptions={{ position: 'bottom' }}
                    style={{ color: editPointsMode ? 'var(--pb-accent)' : undefined }}
                    disabled={selectedRefTrackId == null && !editPointsMode}
                  />
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  background: 'rgba(23, 33, 43, 0.85)', padding: '0.25rem',
                  borderRadius: '6px', border: '1px solid var(--surface-border)',
                  backdropFilter: 'blur(4px)',
                  pointerEvents: 'auto', width: 'fit-content', height: '2.5rem', boxSizing: 'border-box'
                }}>
                  <Button icon="pi pi-chevron-left" text className="pb-drawer__name-edit"
                    onClick={handlePrevTrack} disabled={filteredGroups[0]?.primary.id === selectedGroup.primary.id}
                    tooltip="Предыдущий трек" tooltipOptions={{ position: 'bottom' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--pb-accent)', minWidth: '7rem', textAlign: 'center', lineHeight: 1.2 }}>
                    {selectedGroup.displayName} <br/>
                    <span style={{ color: 'var(--tg-hint)', fontSize: '0.65rem' }}>{selectedGroup.date}</span>
                  </div>
                  <Button icon="pi pi-chevron-right" text className="pb-drawer__name-edit"
                    onClick={handleNextTrack} disabled={filteredGroups[filteredGroups.length - 1]?.primary.id === selectedGroup.primary.id}
                    tooltip="Следующий трек" tooltipOptions={{ position: 'bottom' }}
                  />
                </div>

                {sourceOptions.length > 1 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'rgba(23, 33, 43, 0.85)', padding: '0.4rem 0.5rem',
                    borderRadius: '6px', border: '1px solid var(--surface-border)',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'auto', width: 'fit-content', height: '2.5rem', boxSizing: 'border-box'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--pb-accent)', whiteSpace: 'nowrap' }}>Источник:</span>
                    <Dropdown
                      value={selectedSource}
                      options={sourceOptions}
                      onChange={(e) => setSelectedSource(e.value)}
                      className="pb-wade-programs__dd"
                      style={{ minWidth: '10rem', height: '2rem', fontSize: '0.8rem' }}
                      panelClassName="pb-dropdown-panel"
                    />
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex', flexDirection: 'row', gap: '0.75rem', alignItems: 'center',
                background: 'rgba(23, 33, 43, 0.85)', padding: '0.4rem 0.75rem',
                borderRadius: '6px', border: '1px solid var(--surface-border)',
                backdropFilter: 'blur(4px)',
                pointerEvents: 'auto', width: 'fit-content'
              }}>
                <label className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                  <Checkbox
                    checked={trackSettings.visible}
                    onChange={(e) => updateTrackSetting('visible', !!e.checked)}
                  />
                  <span>Трек</span>
                </label>
                {layers.map(l => (
                  <label key={l.id} className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                    <Checkbox
                      checked={l.visible}
                      onChange={() => toggleLayerVisibility(l.id)}
                    />
                    <span>{l.name}</span>
                  </label>
                ))}
                {testPoint && (
                  <label className="pb-check-row pb-checkbox-dark" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>
                    <Checkbox
                      checked={testVisible}
                      onChange={(e) => setTestVisible(!!e.checked)}
                    />
                    <span>Тест</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {testVisible && segmentInfo && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 100,
                  right: 10,
                  zIndex: 5,
                  background: 'rgba(23, 33, 43, 0.92)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 8,
                  padding: '0.6rem 0.8rem',
                  backdropFilter: 'blur(4px)',
                  minWidth: '200px',
                  fontSize: '0.8rem',
                  pointerEvents: 'auto',
                }}
              >
                <div style={{
                  fontWeight: 600, color: 'var(--pb-accent)',
                  marginBottom: '0.4rem', fontSize: '0.85rem'
                }}>
                  Тестовый отрезок
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.5rem' }}>
                  <span style={{ color: 'var(--tg-hint)' }}>Время:</span>
                  <span style={{ fontFamily: 'monospace' }}>{fmtSecAsDuration(segmentInfo.stats.durationSec)}</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Дистанция:</span>
                  <span style={{ fontFamily: 'monospace' }}>{(segmentInfo.stats.distanceM / 1000).toFixed(2)} км</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Темп:</span>
                  <span style={{ fontFamily: 'monospace' }}>{fmtSecAsPace(segmentInfo.stats.paceSecPerKm)} /км</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Ср. пульс:</span>
                  <span style={{ fontFamily: 'monospace' }}>{segmentInfo.stats.hrAvg != null ? Math.round(segmentInfo.stats.hrAvg) : '—'} уд/мин</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Макс. пульс:</span>
                  <span style={{ fontFamily: 'monospace' }}>{segmentInfo.stats.hrMax ?? '—'} уд/мин</span>
                  <span style={{ color: 'var(--tg-hint)' }}>Дрейф HR:</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {segmentInfo.stats.hrDriftPct != null
                      ? `${segmentInfo.stats.hrDriftPct >= 0 ? '+' : ''}${segmentInfo.stats.hrDriftPct.toFixed(1)}%`
                      : '—'}
                  </span>
                  <span style={{ color: 'var(--tg-hint)' }}>Каденс:</span>
                  <span style={{ fontFamily: 'monospace' }}>{segmentInfo.stats.cadenceAvg != null ? Math.round(segmentInfo.stats.cadenceAvg) : '—'}</span>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveTest}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  className="pb-soft p-button-sm"
                  style={{
                    width: '100%',
                    marginTop: '0.6rem',
                    ...(saveStatus === 'saved' && {
                      color: 'var(--tg-success)',
                      borderColor: 'var(--tg-success)',
                    }),
                    ...(saveStatus === 'error' && {
                      color: 'var(--tg-destructive)',
                      borderColor: 'var(--tg-destructive)',
                    }),
                  }}
                  icon={
                    saveStatus === 'saving'
                      ? 'pi pi-spin pi-spinner'
                      : saveStatus === 'saved'
                      ? 'pi pi-check'
                      : saveStatus === 'error'
                      ? 'pi pi-times'
                      : 'pi pi-save'
                  }
                  label={
                    saveStatus === 'saving'
                      ? 'Сохранение…'
                      : saveStatus === 'saved'
                      ? 'Сохранено'
                      : saveStatus === 'error'
                      ? 'Ошибка сохранения'
                      : 'Сохранить как тест'
                  }
                />
              </div>
          )}

          {testVisible && testPoint && streamsPayload?.latlng && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                background: 'rgba(23, 33, 43, 0.92)',
                border: '1px solid var(--surface-border)',
                borderRadius: 8,
                padding: '0.4rem 0.6rem',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                pointerEvents: 'auto',
              }}
            >
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--tg-hint)', fontSize: '0.7rem', minWidth: '70px' }}>По времени:</span>
                {[
                  { label: '1м', value: 60 },
                  { label: '5м', value: 300 },
                  { label: '10м', value: 600 },
                  { label: '15м', value: 900 },
                  { label: '20м', value: 1200 },
                  { label: '30м', value: 1800 },
                ].map((o) => {
                  const active = testDuration.type === 'time' && testDuration.value === o.value;
                  return (
                    <button
                      key={`time-${o.value}`}
                      type="button"
                      onClick={() => {
                        const d: TestDuration = { type: 'time', value: o.value };
                        setTestDuration(d);
                        saveTestDuration(d);
                      }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.72rem',
                        border: `1px solid ${active ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                        background: active ? 'rgba(212, 163, 115, 0.15)' : 'transparent',
                        color: active ? 'var(--pb-accent)' : 'var(--tg-text)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--tg-hint)', fontSize: '0.7rem', minWidth: '70px' }}>По дистанции:</span>
                {[
                  { label: '100м', value: 100 },
                  { label: '200м', value: 200 },
                  { label: '400м', value: 400 },
                  { label: '500м', value: 500 },
                  { label: '1км', value: 1000 },
                  { label: '2км', value: 2000 },
                  { label: '5км', value: 5000 },
                ].map((o) => {
                  const active = testDuration.type === 'distance' && testDuration.value === o.value;
                  return (
                    <button
                      key={`dist-${o.value}`}
                      type="button"
                      onClick={() => {
                        const d: TestDuration = { type: 'distance', value: o.value };
                        setTestDuration(d);
                        saveTestDuration(d);
                      }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.72rem',
                        border: `1px solid ${active ? 'var(--pb-accent)' : 'var(--surface-border)'}`,
                        background: active ? 'rgba(212, 163, 115, 0.15)' : 'transparent',
                        color: active ? 'var(--pb-accent)' : 'var(--tg-text)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--tg-hint)', textAlign: 'center' }}>
                Маркер можно перетащить. Клик в режиме «Разметка» ставит новую точку.
              </div>
            </div>
          )}

          {editPointsMode && editPointsRefId && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                background: 'rgba(23, 33, 43, 0.92)',
                border: '1px solid var(--pb-accent)',
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                pointerEvents: 'auto',
                minWidth: '340px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                <i className="pi pi-expand" style={{ color: 'var(--pb-accent)' }} />
                <span style={{ color: 'var(--pb-accent)', fontWeight: 600 }}>
                  Редактирование точек
                </span>
                <span className="pb-hint" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                  Drag · Клик по линии — добавить · ПКМ на точке — удалить
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                <span>
                  Точек: <b style={{ fontFamily: 'monospace' }}>{editPointsDraft.length}</b>
                </span>
                <span>
                  Длина: <b style={{ fontFamily: 'monospace' }}>{Math.round(editDraftLength).toLocaleString('ru-RU')} м</b>
                </span>
                <span style={{ color: 'var(--tg-hint)', fontSize: '0.7rem' }}>
                  Esc — отмена
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--tg-hint)', fontSize: '0.72rem' }}>DP:</span>
                <select
                  value={editPointsDpEpsilon}
                  onChange={(e) => setEditPointsDpEpsilon(Number(e.target.value))}
                  disabled={editPointsSaveStatus === 'saving' || splitMode}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--tg-text)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 4,
                    padding: '0.15rem 0.35rem',
                    fontSize: '0.72rem',
                  }}
                >
                  <option value={2}>2 м (точно)</option>
                  <option value={5}>5 м (средне)</option>
                  <option value={10}>10 м (грубо)</option>
                  <option value={20}>20 м (оч. грубо)</option>
                </select>
                <Button
                  label="Оптимизировать"
                  icon="pi pi-filter"
                  className="pb-soft p-button-sm"
                  onClick={handleOptimizeEditPoints}
                  disabled={
                    editPointsDraft.length < 3 ||
                    editPointsSaveStatus === 'saving' ||
                    splitMode
                  }
                  tooltip={
                    splitMode
                      ? 'Недоступно в режиме разделения'
                      : 'Удалить точки на прямых участках'
                  }
                  tooltipOptions={{ position: 'top' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  paddingTop: '0.4rem',
                  borderTop: '1px solid var(--surface-border)',
                  marginTop: '0.2rem',
                }}
              >
                <label
                  className="pb-check-row pb-checkbox-dark"
                  style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  <Checkbox
                    checked={splitMode}
                    onChange={(e) => toggleSplitMode(!!e.checked)}
                    disabled={
                      editPointsSaveStatus === 'saving' ||
                      splitSaveStatus === 'saving'
                    }
                  />
                  <span>Разделить на атомы</span>
                </label>
                {splitMode && (
                  <span
                    className="pb-hint"
                    style={{ fontSize: '0.7rem', marginLeft: 'auto' }}
                  >
                    Клик по серой вершине — граница
                  </span>
                )}
              </div>

              {splitMode && (
                <>
                  {splitParts.length >= 2 ? (
                    <div
                      style={{
                        background: 'rgba(106, 178, 242, 0.08)',
                        border: '1px solid rgba(106, 178, 242, 0.3)',
                        borderRadius: 6,
                        padding: '0.4rem 0.55rem',
                        fontSize: '0.72rem',
                      }}
                    >
                      <div
                        style={{
                          color: '#6ab2f2',
                          fontWeight: 600,
                          marginBottom: '0.25rem',
                        }}
                      >
                        Границ: {splitParts.length - 1} →{' '}
                        {splitParts.length}{' '}
                        {splitParts.length === 1
                          ? 'атом'
                          : splitParts.length < 5
                          ? 'атома'
                          : 'атомов'}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.15rem',
                        }}
                      >
                        {splitParts.map((p, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              gap: '0.4rem',
                              color: 'var(--tg-hint)',
                            }}
                          >
                            <span style={{ minWidth: '4.5rem' }}>ч.{i + 1}:</span>
                            <span style={{ fontFamily: 'monospace' }}>
                              {p.endIdx - p.startIdx + 1} точ. ·{' '}
                              {Math.round(p.lengthM)} м
                            </span>
                          </div>
                        ))}
                      </div>
                      <label
                        className="pb-check-row pb-checkbox-dark"
                        style={{
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          marginTop: '0.3rem',
                        }}
                      >
                        <Checkbox
                          checked={splitDeleteSource}
                          onChange={(e) => setSplitDeleteSource(!!e.checked)}
                          disabled={splitSaveStatus === 'saving'}
                        />
                        <span>Удалить исходный атом после разделения</span>
                      </label>
                    </div>
                  ) : (
                    <div
                      className="pb-hint"
                      style={{
                        fontSize: '0.72rem',
                        textAlign: 'center',
                        padding: '0.3rem',
                      }}
                    >
                      Поставь хотя бы одну границу кликом по серой вершине
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                <Button
                  label="Отмена"
                  icon="pi pi-times"
                  className="pb-destructive-soft p-button-sm"
                  onClick={closeEditPoints}
                  disabled={
                    editPointsSaveStatus === 'saving' ||
                    splitSaveStatus === 'saving'
                  }
                  style={{ flex: 1 }}
                />
                {splitMode ? (
                  <Button
                    label={
                      splitSaveStatus === 'saving'
                        ? 'Разделение…'
                        : splitSaveStatus === 'saved'
                        ? 'Разделено'
                        : `Разделить (${splitParts.length})`
                    }
                    icon={
                      splitSaveStatus === 'saving'
                        ? 'pi pi-spin pi-spinner'
                        : splitSaveStatus === 'saved'
                        ? 'pi pi-check'
                        : 'pi pi-sitemap'
                    }
                    className="pb p-button-sm"
                    onClick={handleSplitAtom}
                    disabled={
                      splitParts.length < 2 ||
                      splitSaveStatus === 'saving' ||
                      splitSaveStatus === 'saved'
                    }
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Button
                    label={
                      editPointsSaveStatus === 'saving'
                        ? 'Сохранение…'
                        : editPointsSaveStatus === 'saved'
                        ? 'Сохранено'
                        : 'Сохранить'
                    }
                    icon={
                      editPointsSaveStatus === 'saving'
                        ? 'pi pi-spin pi-spinner'
                        : editPointsSaveStatus === 'saved'
                        ? 'pi pi-check'
                        : 'pi pi-save'
                    }
                    className="pb p-button-sm"
                    onClick={handleSaveEditPoints}
                    disabled={
                      editPointsDraft.length < 2 ||
                      editPointsSaveStatus === 'saving' ||
                      editPointsSaveStatus === 'saved'
                    }
                    style={{ flex: 1 }}
                  />
                )}
              </div>
              {(editPointsSaveStatus === 'error' ||
                splitSaveStatus === 'error') && (
                <div style={{ color: 'var(--tg-destructive)', fontSize: '0.72rem' }}>
                  {editPointsSaveError || splitSaveError}
                </div>
              )}
            </div>
          )}

          {drawMode && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                background: 'rgba(23, 33, 43, 0.92)',
                border: '1px solid var(--pb-accent)',
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                pointerEvents: 'auto',
                minWidth: '280px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                <i className="pi pi-pencil" style={{ color: 'var(--pb-accent)' }} />
                <span style={{ color: 'var(--pb-accent)', fontWeight: 600 }}>
                  Рисование эталона
                </span>
                <span className="pb-hint" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                  Клик по карте — добавить вершину
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                <span>
                  Точек: <b style={{ fontFamily: 'monospace' }}>{draftPoints.length}</b>
                </span>
                {draftPoints.length >= 2 && (
                  <span>
                    Длина:{' '}
                    <b style={{ fontFamily: 'monospace' }}>
                      {computeDraftLength().toLocaleString('ru-RU')} м
                    </b>
                  </span>
                )}
                <span style={{ marginLeft: 'auto', color: 'var(--tg-hint)', fontSize: '0.7rem' }}>
                  Esc — отмена
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                <Button
                  label="Отменить последнюю"
                  icon="pi pi-undo"
                  className="pb-soft p-button-sm"
                  onClick={() => setDraftPoints((prev) => prev.slice(0, -1))}
                  disabled={draftPoints.length === 0}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Отмена"
                  icon="pi pi-times"
                  className="pb-destructive-soft p-button-sm"
                  onClick={() => {
                    setDrawMode(false);
                    setDraftPoints([]);
                    setSaveRefVisible(false);
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Сохранить"
                  icon="pi pi-check"
                  className="pb p-button-sm"
                  onClick={openSaveRefDialog}
                  disabled={draftPoints.length < 2}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          )}

          {!testPoint && streamsPayload?.latlng && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                background: 'rgba(23, 33, 43, 0.85)',
                border: '1px dashed var(--surface-border)',
                borderRadius: 6,
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--tg-hint)',
                pointerEvents: 'none',
              }}
            >
              🎯 Включите «Разметку» и кликните по карте — поставите точку старта
            </div>
          )}

          <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
      </div>

      <MedianTrackDialog
        visible={medianDialogVisible}
        onHide={() => setMedianDialogVisible(false)}
        selectedRuns={selectedRunsForMedian}
        onSaved={() => {
          void loadReferenceTracks();
          setSelectedRunIds(new Set());
          setActiveTab('refs');
        }}
      />

      {testPoint && (
        <TestCandidatesDialog
          visible={candidatesVisible}
          onHide={() => setCandidatesVisible(false)}
          testPoint={testPoint}
          durationType={testDuration.type}
          durationValue={testDuration.value}
          onSaved={() => {
            void loadSegments();
          }}
        />
      )}

      <Dialog
        visible={saveRefVisible}
        onHide={() => {
          if (saveRefStatus !== 'saving') {
            setSaveRefVisible(false);
            setSaveRefError('');
          }
        }}
        header="Сохранить эталонный маршрут"
        style={{ width: '420px' }}
        modal
        className="pb-templates-dialog pb-settings-dialog"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
          <div>
            <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Имя маршрута
            </label>
            <InputText
              value={saveRefName}
              onChange={(e) => setSaveRefName(e.target.value)}
              className="w-full"
              disabled={saveRefStatus === 'saving' || saveRefStatus === 'saved'}
              placeholder="Например: Круг в Гольяново"
            />
          </div>

          <div className="pb-hint" style={{ fontSize: '0.75rem' }}>
            Точек: {draftPoints.length} · Длина:{' '}
            {computeDraftLength().toLocaleString('ru-RU')} м · Тип:{' '}
            {detectDraftKind() === 'loop' ? 'замкнутый' : 'линейный'}
          </div>

          {saveRefStatus === 'saved' && (
            <div style={{ color: 'var(--tg-success)', fontSize: '0.85rem' }}>
              <i className="pi pi-check-circle" /> Сохранено
            </div>
          )}
          {saveRefError && (
            <div style={{ color: 'var(--tg-destructive)', fontSize: '0.85rem' }}>
              {saveRefError}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <Button
            label="Отмена"
            className="pb-soft p-button-sm"
            onClick={() => setSaveRefVisible(false)}
            disabled={saveRefStatus === 'saving' || saveRefStatus === 'saved'}
          />
          <Button
            label={saveRefStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}
            icon={saveRefStatus === 'saving' ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="pb p-button-sm"
            onClick={handleSaveReference}
            disabled={
              !saveRefName.trim() ||
              saveRefStatus === 'saving' ||
              saveRefStatus === 'saved'
            }
            loading={saveRefStatus === 'saving'}
          />
        </div>
      </Dialog>

      <EditReferenceDialog
        visible={editRefVisible}
        refItem={editRefItem}
        referenceTracks={referenceTracks}
        onHide={() => {
          setEditRefVisible(false);
          setEditRefItem(null);
        }}
        onSaved={() => {
          void loadReferenceTracks();
        }}
      />

      {selectedGroup && (
        <StoryGeneratorDialog
          visible={storyVisible}
          onHide={() => setStoryVisible(false)}
          mapRef={mapRef}
          initialSnapshot={mapSnapshot}
          fact={selectedGroup.primary}
          displayName={selectedGroup.displayName}
          streams={streamsPayload}
          initialTrackSettings={trackSettings}
          gradient={gradient}
        />
      )}
    </Dialog>
  );
};