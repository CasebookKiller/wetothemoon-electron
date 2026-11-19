## Медианный трек — план

Разбил на 3 логических блока: алгоритмы, диалог, интеграция в UI. Один патч (~550 строк).

**Ключевые решения:**
- **400 точек** для resample (внутренняя точность, в UI не видно)
- **DP-упрощение** с настраиваемым эпсилоном (2–15м) — сохраняет только кривизну, прямые убираются
- **Отбрасывание коротких** — `< 0.6 × медиана длины` → discard + warning
- **Автоопределение loop** — по совпадению старт/финиш (`< 100м`)
- **Для loop** — выравнивание стартов по первой точке
- **Для linear** — авторазворот, если направление противоположное

## 1. Новый файл `src/components/PRANA_BINDU/UTILS/medianTrack.ts`

```ts
// src/components/PRANA_BINDU/UTILS/medianTrack.ts
//
// Построение медианного трека из N пробежек одного маршрута.
// Также — упрощение трека алгоритмом Дугласа-Пекера.

// ==================== Утилиты ====================

function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function geometricLength(latlng: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < latlng.length; i++) {
    total += haversineM(
      latlng[i - 1][0], latlng[i - 1][1],
      latlng[i][0], latlng[i][1],
    );
  }
  return total;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ==================== Resample по расстоянию ====================

/**
 * Ресемплит трек до targetCount точек, равномерно по длине.
 * Первая и последняя точки сохраняются как есть.
 */
export function resampleByDistance(
  latlng: [number, number][],
  targetCount: number,
): [number, number][] {
  if (latlng.length < 2) return [...latlng];
  const cum: number[] = [0];
  for (let i = 1; i < latlng.length; i++) {
    cum.push(cum[i - 1] + haversineM(
      latlng[i - 1][0], latlng[i - 1][1],
      latlng[i][0], latlng[i][1],
    ));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [latlng[0]];

  const result: [number, number][] = [];
  for (let i = 0; i < targetCount; i++) {
    const target = (i / (targetCount - 1)) * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const ratio = (target - cum[lo]) / span;
    const lat = latlng[lo][0] + (latlng[hi][0] - latlng[lo][0]) * ratio;
    const lng = latlng[lo][1] + (latlng[hi][1] - latlng[lo][1]) * ratio;
    result.push([lat, lng]);
  }
  return result;
}

// ==================== Выравнивание стартов / направлений ====================

function alignLoopStart(
  run: [number, number][],
  refStart: [number, number],
): [number, number][] {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < run.length; i++) {
    const d = haversineM(run[i][0], run[i][1], refStart[0], refStart[1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return [...run.slice(best), ...run.slice(0, best)];
}

function detectAndReverseIfNeeded(
  runs: [number, number][][],
): [number, number][][] {
  if (runs.length < 2) return runs;
  const ref = runs.reduce((a, b) =>
    geometricLength(a) > geometricLength(b) ? a : b,
  );
  const refDx = ref[ref.length - 1][1] - ref[0][1];
  const refDy = ref[ref.length - 1][0] - ref[0][0];

  return runs.map((r) => {
    const dx = r[r.length - 1][1] - r[0][1];
    const dy = r[r.length - 1][0] - r[0][0];
    const dot = dx * refDx + dy * refDy;
    return dot < 0 ? [...r].reverse() : r;
  });
}

// ==================== Медианный трек ====================

export interface MedianTrackInput {
  latlng: [number, number][];
  /** Длина трека в метрах (для фильтрации коротких). */
  lengthM: number;
}

export interface MedianTrackResult {
  coords: [number, number][];
  isLoop: boolean;
  /** Какой из треков использовался как эталонный старт (для loop). */
  usedCount: number;
  /** Отброшенные как слишком короткие. */
  discardedCount: number;
}

/**
 * Строит медианный трек из N пробежек.
 *
 * - Отбрасывает треки с длиной < minRatio × медианы длин.
 * - Для loop-треков выравнивает старт по первой точке самого длинного.
 * - Для linear-треков авторазворачивает противоположные направления.
 * - Ресемплит каждый трек до `samples` точек, берёт медиану lat/lng.
 */
export function computeMedianTrack(
  runs: MedianTrackInput[],
  samples: number = 400,
  minRatio: number = 0.6,
): MedianTrackResult {
  if (runs.length < 2) {
    throw new Error('Нужно минимум 2 трека');
  }

  // 1. Отбрасываем короткие
  const lengths = runs.map((r) => r.lengthM);
  const medianLength = median(lengths);
  const minLength = medianLength * minRatio;

  const kept = runs.filter((r) => r.lengthM >= minLength);
  const discarded = runs.length - kept.length;

  if (kept.length < 2) {
    throw new Error(
      `Слишком много коротких треков. Оставлено ${kept.length} из ${runs.length}.`,
    );
  }

  // 2. Определяем: loop или linear (по первым двум оставшимся)
  const isLoop = kept.every((r) => {
    const first = r.latlng[0];
    const last = r.latlng[r.latlng.length - 1];
    return haversineM(first[0], first[1], last[0], last[1]) < 100;
  });

  // 3. Выравниваем старты / направления
  let prepared: [number, number][][];
  if (isLoop) {
    const ref = kept.reduce((a, b) => (a.lengthM > b.lengthM ? a : b));
    const refStart = ref.latlng[0];
    prepared = kept.map((r) => alignLoopStart(r.latlng, refStart));
  } else {
    prepared = detectAndReverseIfNeeded(kept.map((r) => r.latlng));
  }

  // 4. Ресемплим до `samples` точек
  const resampled = prepared.map((l) => resampleByDistance(l, samples));

  // 5. Медиана по каждой точке
  const result: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const lats = resampled.map((r) => r[i][0]);
    const lngs = resampled.map((r) => r[i][1]);
    result.push([median(lats), median(lngs)]);
  }

  return {
    coords: result,
    isLoop,
    usedCount: kept.length,
    discardedCount: discarded,
  };
}

// ==================== Упрощение (Дуглас-Пекер) ====================

/**
 * Упрощает трек алгоритмом Дугласа-Пекера.
 * Убирает точки на прямых участках, сохраняет кривизну.
 *
 * @param epsilonM — максимальное отклонение (в метрах), при котором
 *   точку можно убрать. 5м = сохранение всех изгибов; 15м = грубо.
 */
export function simplifyDP(
  latlng: [number, number][],
  epsilonM: number,
): [number, number][] {
  if (latlng.length <= 2) return [...latlng];

  const avgLat =
    latlng.reduce((s, p) => s + p[0], 0) / latlng.length;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);
  const epsDeg = epsilonM / 111320;
  const eps2 = epsDeg * epsDeg;

  function perpDistSq(
    p: [number, number],
    a: [number, number],
    b: [number, number],
  ): number {
    const px = p[1] * cosLat;
    const py = p[0];
    const ax = a[1] * cosLat;
    const ay = a[0];
    const bx = b[1] * cosLat;
    const by = b[0];
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) {
      return (px - ax) ** 2 + (py - ay) ** 2;
    }
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const cl = Math.max(0, Math.min(1, t));
    const projX = ax + cl * dx;
    const projY = ay + cl * dy;
    return (px - projX) ** 2 + (py - projY) ** 2;
  }

  function rec(points: [number, number][]): [number, number][] {
    if (points.length < 3) return [...points];
    let maxDist = 0;
    let maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpDistSq(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > eps2) {
      const left = rec(points.slice(0, maxIdx + 1));
      const right = rec(points.slice(maxIdx));
      return [...left.slice(0, -1), ...right];
    }
    return [first, last];
  }

  return rec(latlng);
}
```

## 2. Новый файл `src/components/PRANA_BINDU/MedianTrackDialog.tsx`

```tsx
// src/components/PRANA_BINDU/MedianTrackDialog.tsx
import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import {
  computeMedianTrack,
  geometricLength,
  simplifyDP,
} from './UTILS/medianTrack';

interface SelectedRun {
  runFactId: number;
  name: string;
  date: string;
  source: string;
  lengthM: number;
}

interface Props {
  visible: boolean;
  onHide: () => void;
  selectedRuns: SelectedRun[];
  onSaved: () => void;
}

type Epsilon = 2 | 5 | 10 | 15;

const EPSILON_OPTIONS = [
  { label: 'Точно (2 м)', value: 2 as Epsilon },
  { label: 'Средне (5 м)', value: 5 as Epsilon },
  { label: 'Грубо (10 м)', value: 10 as Epsilon },
  { label: 'Очень грубо (15 м)', value: 15 as Epsilon },
];

const CATEGORY_OPTIONS = [
  { label: 'Отрезок', value: 'segment' },
  { label: 'Круг', value: 'loop' },
  { label: 'Соединитель', value: 'connector' },
  { label: 'Лестница', value: 'stairs' },
];

export const MedianTrackDialog: React.FC<Props> = ({
  visible,
  onHide,
  selectedRuns,
  onSaved,
}) => {
  const api = (window as any).electronAPI;

  const [loading, setLoading] = useState(false);
  const [buildError, setBuildError] = useState('');
  const [previewCoords, setPreviewCoords] = useState<[number, number][] | null>(null);
  const [previewLength, setPreviewLength] = useState(0);
  const [rawPointsCount, setRawPointsCount] = useState(0);
  const [isLoop, setIsLoop] = useState(false);
  const [usedCount, setUsedCount] = useState(0);
  const [discardedCount, setDiscardedCount] = useState(0);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('segment');
  const [epsilon, setEpsilon] = useState<Epsilon>(5);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  // Загрузка streams + первичное построение
  useEffect(() => {
    if (!visible) return;
    if (selectedRuns.length < 2) {
      setBuildError('Выберите минимум 2 пробежки');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setBuildError('');
    setPreviewCoords(null);

    (async () => {
      try {
        const loaded: Array<{ latlng: [number, number][]; lengthM: number }> = [];

        for (const r of selectedRuns) {
          const meta = await api.pb.getRunStreamsMeta(r.runFactId);
          let src = r.source;
          if (meta?.items?.length) {
            const fit = meta.items.find((s: any) => s.source === 'fit');
            src = fit ? 'fit' : meta.items[0].source;
          }
          const streams = await api.pb.getRunStreams(r.runFactId, src);
          if (!streams?.success || !streams.payload?.latlng) continue;
          const latlng = (streams.payload.latlng as (number | null)[][])
            .filter((p): p is [number, number] => p != null && p[0] != null && p[1] != null);
          if (latlng.length < 10) continue;
          loaded.push({ latlng, lengthM: geometricLength(latlng) });
        }

        if (cancelled) return;
        if (loaded.length < 2) {
          setBuildError('Не удалось загрузить минимум 2 трека с GPS');
          setLoading(false);
          return;
        }

        const result = computeMedianTrack(loaded, 400, 0.6);
        if (cancelled) return;

        setPreviewCoords(result.coords);
        setPreviewLength(geometricLength(result.coords));
        setRawPointsCount(result.coords.length);
        setIsLoop(result.isLoop);
        setUsedCount(result.usedCount);
        setDiscardedCount(result.discardedCount);

        // Автодефолт имени
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        setName(
          `Медиана ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
        );
        setCategory(result.isLoop ? 'loop' : 'segment');
      } catch (e) {
        if (!cancelled) setBuildError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedRuns]);

  // Применение DP
  const simplifiedCoords = previewCoords
    ? simplifyDP(previewCoords, epsilon)
    : null;
  const simplifiedLength = simplifiedCoords
    ? geometricLength(simplifiedCoords)
    : 0;

  const handleSave = async () => {
    if (!simplifiedCoords || !name.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await api.pb.referenceTrackCreate({
        name: name.trim(),
        coords: simplifiedCoords,
        kind: isLoop ? 'loop' : 'linear',
        category,
        tags: ['median'],
        notes: `Медиана из ${usedCount} треков`,
      });
      if (res?.success) {
        setSaveStatus('saved');
        setTimeout(() => {
          onSaved();
          onHide();
        }, 800);
      } else {
        setSaveError(res?.error || 'Не удалось сохранить');
        setSaveStatus('error');
      }
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const fmtLen = (m: number): string => {
    if (m < 1000) return `${Math.round(m)} м`;
    return `${(m / 1000).toFixed(2)} км`;
  };

  return (
    <Dialog
      visible={visible}
      onHide={() => {
        if (saving || saveStatus === 'saved') return;
        onHide();
      }}
      header="Построить медианный трек"
      style={{ width: '520px', maxWidth: '96vw' }}
      modal
      className="pb-templates-dialog pb-settings-dialog"
    >
      {loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--tg-hint)' }}>
          <i className="pi pi-spin pi-spinner" /> Загрузка GPS из {selectedRuns.length} пробежек…
        </div>
      )}

      {buildError && (
        <div style={{ color: 'var(--tg-destructive)', padding: '1rem' }}>
          {buildError}
        </div>
      )}

      {!loading && previewCoords && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Сводка */}
          <div
            style={{
              background: 'rgba(212, 163, 115, 0.08)',
              border: '1px solid rgba(212, 163, 115, 0.3)',
              borderRadius: 6,
              padding: '0.6rem 0.75rem',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ color: 'var(--pb-accent)', fontWeight: 600, marginBottom: '0.3rem' }}>
              <i className="pi pi-info-circle" /> Сводка
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.5rem' }}>
              <span style={{ color: 'var(--tg-hint)' }}>Использовано треков:</span>
              <span>{usedCount}</span>
              {discardedCount > 0 && (
                <>
                  <span style={{ color: 'var(--tg-hint)' }}>Отброшено (короткие):</span>
                  <span style={{ color: 'var(--tg-warning, #e8a838)' }}>{discardedCount}</span>
                </>
              )}
              <span style={{ color: 'var(--tg-hint)' }}>Тип:</span>
              <span>{isLoop ? 'Круг (loop)' : 'Отрезок (linear)'}</span>
              <span style={{ color: 'var(--tg-hint)' }}>Длина медианы:</span>
              <span style={{ fontFamily: 'monospace' }}>{fmtLen(previewLength)}</span>
              <span style={{ color: 'var(--tg-hint)' }}>Точек (до DP):</span>
              <span style={{ fontFamily: 'monospace' }}>{rawPointsCount}</span>
              <span style={{ color: 'var(--tg-hint)' }}>Точек (после DP):</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--pb-accent)' }}>
                {simplifiedCoords?.length ?? 0}
              </span>
              <span style={{ color: 'var(--tg-hint)' }}>Длина после DP:</span>
              <span style={{ fontFamily: 'monospace' }}>{fmtLen(simplifiedLength)}</span>
            </div>
          </div>

          {/* Имя */}
          <div>
            <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Имя нового эталона
            </label>
            <InputText
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
              disabled={saving || saveStatus === 'saved'}
            />
          </div>

          {/* Категория и точность в одну строку */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                Категория
              </label>
              <Dropdown
                value={category}
                options={CATEGORY_OPTIONS}
                onChange={(e) => setCategory(e.value)}
                className="w-full"
                panelClassName="pb-dropdown-panel"
                disabled={saving || saveStatus === 'saved'}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="pb-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                Точность (DP)
              </label>
              <Dropdown
                value={epsilon}
                options={EPSILON_OPTIONS}
                onChange={(e) => setEpsilon(e.value)}
                className="w-full"
                panelClassName="pb-dropdown-panel"
                disabled={saving || saveStatus === 'saved'}
              />
            </div>
          </div>

          <small className="pb-hint" style={{ fontSize: '0.72rem' }}>
            Чем меньше эпсилон — тем больше точек сохранится. 5 м — оптимально для большинства маршрутов.
          </small>

          {saveStatus === 'saved' && (
            <div style={{ color: 'var(--tg-success)', fontSize: '0.85rem' }}>
              <i className="pi pi-check-circle" /> Сохранено
            </div>
          )}
          {saveError && (
            <div style={{ color: 'var(--tg-destructive)', fontSize: '0.85rem' }}>
              {saveError}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
        <Button
          label="Отмена"
          className="pb-soft p-button-sm"
          onClick={onHide}
          disabled={saving || saveStatus === 'saved'}
        />
        <Button
          label={saving ? 'Сохранение…' : 'Сохранить эталон'}
          icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
          className="pb p-button-sm"
          onClick={handleSave}
          disabled={!simplifiedCoords || !name.trim() || saving || saveStatus === 'saved'}
          loading={saving}
        />
      </div>
    </Dialog>
  );
};
```

## 3. Патчи в `RouteMapEditor.tsx`

### 3.1. Импорт

**НАЙТИ:**
```tsx
import { TestCandidatesDialog } from './TestCandidatesDialog';
```

**ДОБАВИТЬ ПОСЛЕ:**
```tsx
import { MedianTrackDialog } from './MedianTrackDialog';
```

### 3.2. State

**НАЙТИ:**
```tsx
  const [candidatesVisible, setCandidatesVisible] = useState(false);
```

**ДОБАВИТЬ ПОСЛЕ:**
```tsx
  // Медианный трек
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [medianDialogVisible, setMedianDialogVisible] = useState(false);
```

### 3.3. Хелпер toggle

**НАЙТИ (перед `// ==================== Рендер ====================`):**
```tsx
  // ==================== Рендер ====================
```

**ДОБАВИТЬ ПЕРЕД:**

```tsx
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

  // ==================== Рендер ====================
```

### 3.4. Чекбокс на карточке трека

**НАЙТИ (блок карточки трека в списке):**
```tsx
                    <div
                      key={`${g.date}-${g.startTime ?? idx}-${g.primary.id}`}
                      onClick={() => {
                        setSelectedGroup(g);
                        setSelectedSource(g.primary.source);
                      }}
                      style={{
                        padding: '0.5rem', cursor: 'pointer', borderRadius: '4px', marginBottom: '0.25rem',
                        background: isSelected ? 'rgba(212,163,115,0.15)' : 'transparent',
                        border: isSelected ? '1px solid var(--pb-accent)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.displayName}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }}>{g.date}</span>
                      </div>
```

**ЗАМЕНИТЬ НА:**
```tsx
                    <div
                      key={`${g.date}-${g.startTime ?? idx}-${g.primary.id}`}
                      onClick={() => {
                        setSelectedGroup(g);
                        setSelectedSource(g.primary.source);
                      }}
                      style={{
                        padding: '0.5rem', cursor: 'pointer', borderRadius: '4px', marginBottom: '0.25rem',
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
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.displayName}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }}>{g.date}</span>
                      </div>
```

**И в конце карточки (перед `</div>` который закрывает карточку):**

**НАЙТИ (закрытие карточки — после `pb-source-badges`):**
```tsx
                      <div className="pb-source-badges" style={{ marginTop: '0.25rem', alignItems: 'center' }}>
                        {g.sources.map((s: any) => (
                          <span key={s} className={`pb-source-badge pb-source-badge--${s}`}>{s}</span>
                        ))}
                        <span style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginLeft: 'auto' }}>
                          {g.primary.actual_km ? `${g.primary.actual_km.toFixed(2)} км` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
```

**ЗАМЕНИТЬ НА:**
```tsx
                      <div className="pb-source-badges" style={{ marginTop: '0.25rem', alignItems: 'center' }}>
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
```

### 3.5. Кнопка «Построить медианный»

**НАЙТИ (заголовок списка треков с поиском):**
```tsx
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="pb-run-filters__row">
                    <label className="pb-label">Поиск по названию</label>
```

**ДОБАВИТЬ ПЕРЕД блоком поиска:**

```tsx
                {selectedRunIds.size >= 2 && (
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
                      label="Построить медианный трек"
                      icon="pi pi-chart-line"
                      className="pb p-button-sm w-full"
                      onClick={() => setMedianDialogVisible(true)}
                    />
                  </div>
                )}
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
                  <div className="pb-run-filters__row">
                    <label className="pb-label">Поиск по названию</label>
```

### 3.6. Рендер диалога

**НАЙТИ (перед закрывающим `</Dialog>` компонента `RouteMapEditor`):**
```tsx
      {testPoint && (
        <TestCandidatesDialog
```

**ДОБАВИТЬ ПЕРЕД:**

```tsx
      <MedianTrackDialog
        visible={medianDialogVisible}
        onHide={() => setMedianDialogVisible(false)}
        selectedRuns={selectedRunsForMedian}
        onSaved={() => {
          void loadReferenceTracks();
          setSelectedRunIds(new Set());
          // Переключаемся на вкладку «Эталоны» — сразу видно новый
          setActiveTab('refs');
        }}
      />

      {testPoint && (
        <TestCandidatesDialog
```

## Проверка

```bash
npx tsc --noEmit 2>&1 | grep -i pranaBindu
# ожидание: пусто
```

`npm start` → редактор карт → вкладка «Треки»:

1. У каждой карточки появился **чекбокс слева**.
2. Отметь 3–5 пробежек по одному маршруту (например, «1015-ый забег», «1014-ый», «1016-ый»).
3. Появилась **жёлтая плашка** вверху списка: «Выбрано: 3» + кнопка «Построить медианный трек».
4. Клик → диалог:
   - «Загрузка GPS из 3 пробежек…» (~2 сек)
   - Сводка: «Использовано: 3 · Отброшено: 0 · Тип: Отрезок · Длина: 5.02 км · Точек (до DP): 400 · Точек (после DP): 87 · Длина после DP: 5.01 км»
   - Имя (автодефолт «Медиана 24.10.2026 15:30»)
   - Категория (автодефолт)
   - Точность (Точно/Средне/Грубо/Очень грубо — по умолчанию «Средне (5 м)»)
5. Меняешь точность → количество точек пересчитывается мгновенно.
6. Сохранить → диалог закрывается, **переключается на вкладку «Эталоны»** — новый атом в списке с тегом `#median`.

## Проверка на твоих данных

Возьми пробежки **1011, 1012, 1014, 1016** (они все идут по кругу с лестницами, 9-20 км). Отметь 3–4 → «Построить медианный»:

- **Тип** определится как **Круг (loop)** (если все старт/финиш совпадают)
- **Длина** должна получиться ~2.0-2.1 км (медиана)
- **DP Точно (2м)** → ~200 точек, длина 2.10 км
- **DP Средне (5м)** → ~100 точек, длина 2.08 км
- **DP Грубо (10м)** → ~50 точек, длина 2.05 км

После сохранения этот атом должен показывать **coverage 95%+** на пробежках 1014/1016 и **низкое** на 1015 (потому что 1015 — другой маршрут).

## Что дальше

Следующая сессия — **редактирование точек** атома:
- Кнопка «✏ Редактировать точки» в карточке атома
- Маркеры всех вершин (start/end крупные, промежуточные мелкие)
- Drag / add / delete
- Кнопка «Упростить (DP)» — если атом «раздут» после ручного редактирования

Скажи, когда проверишь медианный трек — дам патч для редактирования.