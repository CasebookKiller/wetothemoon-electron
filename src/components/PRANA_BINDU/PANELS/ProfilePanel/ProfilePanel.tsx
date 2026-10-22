// src/components/PRANA_BINDU/PANELS/ProfilePanel/ProfilePanel.tsx
//
// Панель «Профиль»: HRmax / LTHR / RestHR + кнопки сохранения.
// Самодостаточна: сама грузит из pb:get-profile, сама сохраняет
// через pb:update-profile. Родитель может вызвать reload() после
// синка порогов / зон через ref.

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { Panel } from 'primereact/panel';
import { Checkbox } from 'primereact/checkbox';

export interface ProfilePanelHandle {
  /** Перечитать профиль из БД. */
  reload: () => Promise<void>;
}

interface ProfileState {
  maxHr: number | null;
  lthr: number | null;
  restingHr: number | null;
  lthrSource?: string | null;
  maxHrSource?: string | null;
  restingHrSource?: string | null;
}

function labelForSource(src: string): string {
  switch (src) {
    case 'icu': return 'intervals.icu';
    case 'dodofo': return 'dodofo';
    case 'manual': return 'ручной ввод';
    case 'computed': return 'расчёт';
    default: return src;
  }
}

interface Props {
  className?: string;
  /**
   * Если true — панель рендерится без Panel-обёртки (без заголовка
   * и тени). Используется внутри SettingsDialog, где обёрткой
   * служит TabPanel.
   */
  embedded?: boolean;
}

export const ProfilePanel = forwardRef<ProfilePanelHandle, Props>(
  ({ className, embedded }, ref) => {
    const api = (window as any).electronAPI;

    const [profile, setProfile] = useState<ProfileState>({
      maxHr: null,
      lthr: null,
      restingHr: null,
    });
    const [saving, setSaving] = useState(false);
    const [computing, setComputing] = useState(false);
    const [windowDays, setWindowDays] = useState<number>(90);
    const [history, setHistory] = useState<any[]>([]);
    const [computed, setComputed] = useState<{
      lthr: number | null;
      hrmax: number | null;
      resthr: number | null;
      source: 'test_segments' | 'autoscan';
      notes: string;
      testsUsed: number;
    } | null>(null);
    const [lthrTestDuration, setLthrTestDuration] = useState<number>(1200);
    const [onlyClean, setOnlyClean] = useState<boolean>(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const load = async () => {
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
        /* ignore */
      }
    };

    useImperativeHandle(ref, () => ({ reload: load }), []);

    useEffect(() => {
      const saved = localStorage.getItem('pb.thresholds.windowDays');
      if (saved) setWindowDays(Number(saved));
      void load();
      void loadHistory();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      localStorage.setItem('pb.thresholds.windowDays', String(windowDays));
    }, [windowDays]);

    useEffect(() => {
      const savedDur = localStorage.getItem('pb.thresholds.lthrTestDuration');
      if (savedDur) setLthrTestDuration(Number(savedDur));
      const savedClean = localStorage.getItem('pb.thresholds.onlyClean');
      if (savedClean === '1') setOnlyClean(true);
    }, []);

    useEffect(() => {
      localStorage.setItem(
        'pb.thresholds.lthrTestDuration',
        String(lthrTestDuration),
      );
    }, [lthrTestDuration]);

    useEffect(() => {
      localStorage.setItem('pb.thresholds.onlyClean', onlyClean ? '1' : '0');
    }, [onlyClean]);

    const loadHistory = async () => {
      try {
        const res = await api.pb.getThresholdHistory();
        if (res.success) setHistory(res.items);
      } catch {}
    };


    const handleSave = async () => {
      if (!api?.pb?.updateProfile) {
        setError('electronAPI.pb.updateProfile недоступен');
        return;
      }
      setSaving(true);
      setError('');
      setSaved(false);
      try {
        const res = await api.pb.updateProfile({
          maxHr: profile.maxHr,
          lactateThresholdHr: profile.lthr,
          restingHr: profile.restingHr,
        });
        if (res?.success) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } else {
          setError(res?.error ?? 'Не удалось сохранить');
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <Panel
        header={embedded ? undefined : "Профиль"}
        className={
          embedded
            ? className ?? ''
            : `shadow-5 mb-3 pb-panel ${className ?? ''}`
        }
      >
        <div className="pb-profile__grid">
          <div className="pb-profile__field">
            <label className="pb-label" htmlFor="pb-profile-hrmax">
              HRmax
              {!profile.maxHr && (
                <span className="pb-profile__missing">не задан</span>
              )}
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
              {!profile.lthr && (
                <span className="pb-profile__missing">не задан</span>
              )}
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
              {!profile.restingHr && (
                <span className="pb-profile__missing">не задан</span>
              )}
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
            label={saving ? 'Сохранение…' : saved ? 'Сохранено' : 'Сохранить'}
            icon={
              saving
                ? 'pi pi-spin pi-spinner'
                : saved
                ? 'pi pi-check'
                : 'pi pi-save'
            }
            className="pb p-button-sm"
            onClick={handleSave}
            disabled={saving}
          />
          <Button
            label="Перечитать"
            icon="pi pi-refresh"
            className="pb-soft p-button-sm"
            onClick={load}
            disabled={saving}
          />
          <div className="flex align-items-center gap-2 flex-wrap">
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
            />
            <Dropdown
              value={lthrTestDuration}
              options={[
                { label: 'LTHR: 5 мин', value: 300 },
                { label: 'LTHR: 10 мин', value: 600 },
                { label: 'LTHR: 15 мин', value: 900 },
                { label: 'LTHR: 20 мин', value: 1200 },
                { label: 'LTHR: 30 мин', value: 1800 },
              ]}
              onChange={(e) => setLthrTestDuration(e.value)}
              className="pb-wade-programs__dd pb-wade-programs__dd--weeks"
              panelClassName="pb-dropdown-panel"
              style={{ minWidth: '10rem' }}
              tooltip="Длительность тестового отрезка, по которому считается LTHR"
              tooltipOptions={{ position: 'top' }}
            />
            <label
              className="pb-check-row pb-checkbox-dark"
              style={{ fontSize: '0.8rem', cursor: 'pointer' }}
            >
              <Checkbox
                checked={onlyClean}
                onChange={(e) => setOnlyClean(!!e.checked)}
              />
              <span className="pb-hint" style={{ marginLeft: '0.4rem' }}>
                Только чистые (дрейф &lt; 5%)
              </span>
            </label>
            <Button
              label={computing ? 'Расчёт…' : 'Рассчитать из фактов'}
              icon={computing ? 'pi pi-spin pi-spinner' : 'pi pi-calculator'}
              className="pb-soft p-button-sm"
              onClick={async () => {
                setComputing(true);
                try {
                  const res = await api.pb.computeThresholds({
                    windowDays,
                    lthrTestDuration,
                    onlyClean,
                  });
                  if (res.success) {
                    setComputed(res.data);
                    await loadHistory();
                  }
                } finally {
                  setComputing(false);
                }
              }}
              disabled={computing || saving}
            />
          </div>
        </div>

        {error && (
          <Message severity="error" text={error} className="w-full mt-2" />
        )}

        {/* Блок с результатом последнего расчёта */}
        {computed && (
          <div className="pb-profile__computed mt-3 p-3 border-round" style={{ border: '1px solid var(--pb-accent)', background: 'rgba(212, 163, 115, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--pb-accent)' }}>
                <i className="pi pi-calculator" /> Результат расчёта
              </span>
              {computed.source === 'test_segments' ? (
                <span
                  className="pb-source-badge"
                  style={{
                    background: 'rgba(111, 191, 115, 0.15)',
                    color: 'var(--tg-success)',
                    border: '1px solid var(--tg-success)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 4,
                    fontSize: '0.7rem',
                  }}
                >
                  ✓ по {computed.testsUsed} тестам
                </span>
              ) : (
                <span
                  className="pb-source-badge"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--tg-hint)',
                    border: '1px solid var(--surface-border)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 4,
                    fontSize: '0.7rem',
                  }}
                >
                  автопоиск
                </span>
              )}
            </div>
            <div className="grid">
              <div className="col-4">HRmax: <b>{computed.hrmax ?? '—'}</b></div>
              <div className="col-4">LTHR: <b>{computed.lthr ?? '—'}</b></div>
              <div className="col-4">RestHR: <b>{computed.resthr ?? '—'}</b></div>
            </div>
            <div className="pb-hint" style={{ fontSize: '0.72rem', marginTop: '0.4rem' }}>
              {computed.notes}
            </div>
            <Button
              label="Применить эти значения"
              icon="pi pi-check"
              className="pb-soft p-button-sm mt-2 w-full"
              onClick={() => {
                setProfile(p => ({
                  ...p,
                  maxHr: computed.hrmax ?? p.maxHr,
                  lthr: computed.lthr ?? p.lthr,
                  restingHr: computed.resthr ?? p.restingHr,
                }));
              }}
            />
          </div>
        )}

        {/* Подсказка по методике расчёта */}
        <div className="mt-3">
          <details style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--tg-theme-hint-color)' }}>
            <summary style={{ color: 'var(--pb-accent)', marginBottom: '0.5rem', fontWeight: 600 }}>
              <i className="pi pi-info-circle" /> Как мы считаем пороги
            </summary>
            <div className="pb-hint" style={{ lineHeight: '1.4', marginTop: '0.5rem' }}>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                <li><b>HRmax:</b> Абсолютный пик пульса из всех потоков за выбранное окно (обычно 365 дней).</li>
                <li><b>LTHR:</b> 95% от среднего пульса на лучшем 20-минутном отрезке во всех пробежках (тест TrainingPeaks).</li>
                <li><b>RestHR:</b> Медиана пульса покоя из дневника здоровья (recovery_logs) за тот же период.</li>
              </ul>
            </div>
          </details>
        </div>

        {/* История расчётов */}
        {history.length > 0 && (
          <div className="mt-4">
            <div className="pb-label mb-2" style={{ fontWeight: 600 }}>История расчётов (последний за день)</div>
            <div className="pb-threshold-table">
              <div className="pb-threshold-table__header">
                <span>Дата</span>
                <span>Окно</span>
                <span>HRmax</span>
                <span>LTHR</span>
                <span>RestHR</span>
              </div>
              {history.map((h) => (
                <div key={h.id} className="pb-threshold-table__row">
                  <span className="pb-threshold-table__date">{new Date(h.computed_at).toLocaleDateString('ru-RU')}</span>
                  <span className="pb-threshold-table__val">{h.window_days} дн.</span>
                  <span className="pb-threshold-table__val">{h.hrmax ?? '—'}</span>
                  <span className="pb-threshold-table__val">{h.lthr ?? '—'}</span>
                  <span className="pb-threshold-table__val">{h.resthr ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    );
  }
);

ProfilePanel.displayName = 'ProfilePanel';