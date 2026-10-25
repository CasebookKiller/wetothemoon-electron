// src/components/PRANA_BINDU/TestCandidatesDialog.tsx
import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';

interface Candidate {
  runFactId: number;
  date: string;
  startTime: string | null;
  factSource: string;
  streamSource: string;
  name: string | null;
  durationSec: number;
  distanceM: number;
  paceSecPerKm: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrDriftPct: number | null;
  cadenceAvg: number | null;
  coveragePct: number;
  isClean: boolean;
  canSave: boolean;
  alreadySaved: boolean;
  startIdx: number;
  endIdx: number;
}

interface Props {
  visible: boolean;
  onHide: () => void;
  testPoint: { lat: number; lng: number };
  durationType: 'time' | 'distance';
  durationValue: number;
  onSaved: () => void;
}

function fmtSec(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtPace(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export const TestCandidatesDialog: React.FC<Props> = ({
  visible,
  onHide,
  testPoint,
  durationType,
  durationValue,
  onSaved,
}) => {
  const [windowDays, setWindowDays] = useState(90);
  const [items, setItems] = useState<Candidate[]>([]);
  const [diagnostics, setDiagnostics] = useState<{
    factsInWindow: number;
    factsWithStreams: number;
    factsWithLatlng: number;
    candidatesAfterCompute: number;
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCandidates = async () => {
    setLoading(true);
    setError('');
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - windowDays);
      const pad = (n: number) => String(n).padStart(2, '0');
      const iso = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      const api = (window as any).electronAPI;
      const res = await api.pb.testSegmentCandidates({
        from: iso(from),
        to: iso(to),
        testPoint,
        durationType,
        durationValue,
        minCoveragePct: 95,
      });
      if (!res?.success) {
        setError(res?.error ?? 'Ошибка загрузки');
        return;
      }
      setItems(res.items ?? []);
      setDiagnostics(res.diagnostics ?? null);

      // Автовыбор: canSave + clean + не alreadySaved
      const auto = new Set<number>();
      for (const c of res.items ?? []) {
        if (c.canSave && c.isClean && !c.alreadySaved) {
          auto.add(c.runFactId);
        }
      }
      setSelected(auto);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    void loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, windowDays]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllValid = () => {
    const valid = items.filter(
      (c) => c.canSave && !c.alreadySaved,
    );
    if (selected.size === valid.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(valid.map((c) => c.runFactId)));
    }
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError('');
    try {
      const api = (window as any).electronAPI;
      let saved = 0;
      for (const c of items) {
        if (!selected.has(c.runFactId)) continue;
        const res = await api.pb.testSegmentCreate({
          runFactId: c.runFactId,
          startLat: testPoint.lat,
          startLng: testPoint.lng,
          startIdx: c.startIdx,
          endIdx: c.endIdx,
          durationType,
          durationValue,
          distanceM: c.distanceM,
          durationSec: c.durationSec,
          paceSecPerKm: c.paceSecPerKm,
          hrAvg: c.hrAvg,
          hrMax: c.hrMax,
          hrDriftPct: c.hrDriftPct,
          cadenceAvg: c.cadenceAvg,
          note: 'из списка кандидатов',
          kind: 'candidate',
        });
        if (res?.success) saved++;
      }
      if (saved > 0) onSaved();
      onHide();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const validCount = items.filter((c) => c.canSave && !c.alreadySaved).length;

  return (
    <Dialog
      visible={visible}
      onHide={saving ? () => {} : onHide}
      header="Найти кандидатов для теста"
      style={{ width: '960px', maxWidth: '96vw' }}
      modal
      className="pb-templates-dialog pb-settings-dialog"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span className="pb-label">Окно:</span>
        <Dropdown
          value={windowDays}
          options={[
            { label: '30 дней', value: 30 },
            { label: '90 дней', value: 90 },
            { label: '180 дней', value: 180 },
            { label: '365 дней', value: 365 },
          ]}
          onChange={(e) => setWindowDays(e.value)}
          className="pb-wade-programs__dd pb-wade-programs__dd--weeks"
          panelClassName="pb-dropdown-panel"
          style={{ minWidth: '9rem' }}
          disabled={loading}
        />
        <span className="pb-hint" style={{ fontSize: '0.75rem', flex: 1 }}>
          {loading
            ? 'Сканируем…'
            : (() => {
                const d = diagnostics;
                const parts: string[] = [];
                if (d) {
                  parts.push(`в окне: ${d.factsInWindow}`);
                  parts.push(`с потоками: ${d.factsWithStreams}`);
                  parts.push(`с GPS: ${d.factsWithLatlng}`);
                  parts.push(`отрезков: ${d.candidatesAfterCompute}`);
                }
                parts.push(`подходят: ${validCount}`);
                parts.push(`выбрано: ${selected.size}`);
                return parts.join(' · ');
              })()}
        </span>
        <Button
          label="Выбрать все валидные"
          icon="pi pi-check-square"
          className="pb-soft p-button-sm"
          onClick={toggleAllValid}
          disabled={loading || validCount === 0}
        />
      </div>

      {error && <Message severity="error" text={error} className="w-full mb-2" />}

      <div style={{ maxHeight: '60vh', overflowY: 'auto', border: '1px solid var(--surface-border)', borderRadius: 6 }}>
        {items.length === 0 && !loading && (
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <div className="pb-hint" style={{ marginBottom: '0.5rem' }}>
              Кандидатов нет.
            </div>
            {diagnostics && (
              <div className="pb-hint" style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                В окне {diagnostics.factsInWindow} тренировок,
                с потоками — {diagnostics.factsWithStreams},
                с GPS — {diagnostics.factsWithLatlng}.
                {diagnostics.factsWithStreams > 0 && diagnostics.factsWithLatlng === 0 && (
                  <> Похоже, потоки без `latlng` — нечего накладывать на точку.</>
                )}
                {diagnostics.factsWithLatlng > 0 && (
                  <> Возможно, тренировки короче выбранной длительности
                  ({durationType === 'time' ? `${Math.round(durationValue / 60)}м` : `${durationValue}м`}).
                  Попробуйте сменить длительность в dropdown на 5м или 10м.</>
                )}
              </div>
            )}
          </div>
        )}
        {items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--tg-hint)', textAlign: 'left', position: 'sticky', top: 0, background: 'var(--tg-theme-bg-color, #17212b)', zIndex: 1 }}>
                <th style={{ padding: '0.5rem 0.4rem', width: '40px' }}></th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Дата</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Название</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Покр.</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Время</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Дист.</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Темп</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>HR</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Дрейф</th>
                <th style={{ padding: '0.5rem 0.4rem' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const disabled = !c.canSave || c.alreadySaved;
                const isSel = selected.has(c.runFactId);
                return (
                  <tr
                    key={c.runFactId}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      opacity: disabled ? 0.4 : 1,
                    }}
                  >
                    <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                      <label
                        className="pb-checkbox-dark"
                        style={{
                          display: 'inline-flex',
                          cursor: disabled ? 'default' : 'pointer',
                        }}
                      >
                        <Checkbox
                          checked={isSel}
                          disabled={disabled}
                          onChange={() => toggle(c.runFactId)}
                        />
                      </label>
                    </td>
                    <td style={{ padding: '0.4rem', whiteSpace: 'nowrap', color: 'var(--tg-hint)' }}>
                      {c.date}
                    </td>
                    <td style={{ padding: '0.4rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name ?? ''}>
                      {c.name ?? `#${c.runFactId}`}
                      <span className={`pb-source-badge pb-source-badge--${c.factSource}`} style={{ marginLeft: '0.4rem' }}>
                        {c.factSource}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace', color: c.coveragePct >= 95 ? 'var(--tg-success)' : 'var(--tg-destructive)' }}>
                      {c.coveragePct}%
                    </td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{fmtSec(c.durationSec)}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{(c.distanceM / 1000).toFixed(2)}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{fmtPace(c.paceSecPerKm)}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>
                      {c.hrAvg != null ? Math.round(c.hrAvg) : '—'}
                      {c.hrMax != null && <span style={{ color: 'var(--tg-hint)' }}> / {c.hrMax}</span>}
                    </td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace', color: c.isClean ? undefined : 'var(--tg-destructive)' }}>
                      {c.hrDriftPct != null ? `${c.hrDriftPct >= 0 ? '+' : ''}${c.hrDriftPct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '0.4rem', fontSize: '0.7rem' }}>
                      {c.alreadySaved
                        ? <span style={{ color: 'var(--tg-success)' }}>✓ сохранён</span>
                        : !c.canSave
                        ? <span style={{ color: 'var(--tg-destructive)' }}>коротко</span>
                        : !c.isClean
                        ? <span style={{ color: '#e8a838' }}>грязный</span>
                        : <span style={{ color: 'var(--pb-accent)' }}>готов</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
        <Button label="Отмена" className="pb-soft p-button-sm" onClick={onHide} disabled={saving} />
        <Button
          label={saving ? 'Сохранение…' : `Сохранить выбранные (${selected.size})`}
          icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-save'}
          className="pb p-button-sm"
          onClick={handleSave}
          disabled={selected.size === 0 || saving}
        />
      </div>
    </Dialog>
  );
};