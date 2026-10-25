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