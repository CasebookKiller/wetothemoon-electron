// src/components/PRANA_BINDU/PANELS/ProfilePanel/ProfilePanel.tsx
//
// Панель «Профиль»: HRmax / LTHR / RestHR + кнопки сохранения.
// Самодостаточна: сама грузит из pb:get-profile, сама сохраняет
// через pb:update-profile. Родитель может вызвать reload() после
// синка порогов / зон через ref.

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Message } from 'primereact/message';
import { Panel } from 'primereact/panel';

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
}

export const ProfilePanel = forwardRef<ProfilePanelHandle, Props>(
  ({ className }, ref) => {
    const api = (window as any).electronAPI;

    const [profile, setProfile] = useState<ProfileState>({
      maxHr: null,
      lthr: null,
      restingHr: null,
    });
    const [saving, setSaving] = useState(false);
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
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        header="Профиль"
        className={`shadow-5 mb-3 pb-panel ${className ?? ''}`}
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
        </div>

        {error && (
          <Message severity="error" text={error} className="w-full mt-2" />
        )}
      </Panel>
    );
  }
);

ProfilePanel.displayName = 'ProfilePanel';