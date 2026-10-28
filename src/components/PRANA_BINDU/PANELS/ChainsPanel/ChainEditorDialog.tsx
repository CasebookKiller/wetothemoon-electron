// src/components/PRANA_BINDU/PANELS/ChainsPanel/ChainEditorDialog.tsx
//
// Диалог создания/редактирования цепочки: name, ordered, слоты.
// Каждый слот: type (atoms/clusters), specificAtoms | clusters,
// expectedRepeats [min..max], aggregate (best/sum), minCoverage, optional.

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';
import { MultiSelect } from 'primereact/multiselect';

export interface RefTrackLite {
  id: number;
  name: string;
  lengthM: number;
  kind: 'loop' | 'linear' | 'stadium' | null;
  tags: string[];
}

export interface ChainSlotDraft {
  orderIndex: number;
  expectedRepeatsMin: number;
  expectedRepeatsMax: number;
  aggregate: 'best' | 'sum';
  minCoverage: number;
  optional: boolean;
  direction?: 'any' | 'forward' | 'backward';
  clusters: string[];
  specificAtoms: number[];
  type: 'atoms' | 'clusters';
}

export interface ChainDraft {
  id?: number;
  name: string;
  ordered: boolean;
  slots: ChainSlotDraft[];
}

interface Props {
  visible: boolean;
  mode: 'create' | 'edit';
  initial: ChainDraft | null;
  refTracks: RefTrackLite[];
  saving: boolean;
  error: string;
  onHide: () => void;
  onSave: (draft: ChainDraft) => void;
}

function fmtLen(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} км` : `${Math.round(m)} м`;
}

function emptySlot(index: number): ChainSlotDraft {
  return {
    orderIndex: index,
    expectedRepeatsMin: 1,
    expectedRepeatsMax: 1,
    aggregate: 'best',
    minCoverage: 90,
    optional: false,
    direction: 'any',
    clusters: [],
    specificAtoms: [],
    type: 'atoms',
  };
}

export const ChainEditorDialog: React.FC<Props> = ({
  visible,
  mode,
  initial,
  refTracks,
  saving,
  error,
  onHide,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [ordered, setOrdered] = useState(false);
  const [slots, setSlots] = useState<ChainSlotDraft[]>([]);
  const [validationError, setValidationError] = useState('');

  // Загрузка initial при открытии
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setName(initial.name);
      setOrdered(initial.ordered);
      setSlots(initial.slots.map((s) => ({ ...s })));
    } else {
      setName('');
      setOrdered(false);
      setSlots([emptySlot(0)]);
    }
    setValidationError('');
  }, [visible, initial]);

  // Кластеры (уникальные group:* из тегов), исключая технические atom-*
  const clusterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of refTracks) {
      for (const t of r.tags ?? []) {
        if (!t.startsWith('group:')) continue;
        const name = t.slice(6);
        if (name.startsWith('atom-')) continue;
        set.add(name);
      }
    }
    return Array.from(set)
      .sort()
      .map((c) => ({ label: c, value: c }));
  }, [refTracks]);

  // Атомы (для MultiSelect)
  const atomOptions = useMemo(
    () =>
      refTracks.map((r) => ({
        label: `#${r.id} · ${r.name} (${fmtLen(r.lengthM)})`,
        value: r.id,
      })),
    [refTracks],
  );

  const updateSlot = (idx: number, patch: Partial<ChainSlotDraft>) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, emptySlot(prev.length)]);
  };

  const removeSlot = (idx: number) => {
    setSlots((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, orderIndex: i })),
    );
  };

  const handleSave = () => {
    setValidationError('');
    if (!name.trim()) {
      setValidationError('Название цепочки обязательно');
      return;
    }
    if (slots.length === 0) {
      setValidationError('Нужен хотя бы один слот');
      return;
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.specificAtoms.length === 0 && s.clusters.length === 0) {
        setValidationError(
          `Слот ${i + 1}: выберите хотя бы один атом или кластер`,
        );
        return;
      }
      if (s.expectedRepeatsMin < 0 || s.expectedRepeatsMax < s.expectedRepeatsMin) {
        setValidationError(`Слот ${i + 1}: проверьте min/max repeats`);
        return;
      }
    }
    const draft: ChainDraft = {
      id: initial?.id,
      name: name.trim(),
      ordered,
      slots: slots.map((s, i) => ({
        ...s,
        orderIndex: i,
        // В зависимости от type — оставляем только один массив
        specificAtoms: s.type === 'atoms' ? s.specificAtoms : [],
        clusters: s.type === 'clusters' ? s.clusters : [],
      })),
    };
    onSave(draft);
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={mode === 'create' ? 'Новая цепочка' : `Редактировать: ${initial?.name ?? ''}`}
      style={{ width: '820px', maxWidth: '95vw' }}
      modal
      className="pb-templates-dialog pb-settings-dialog"
      contentStyle={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Название */}
        <div>
          <label className="pb-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Название
          </label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%' }}
            placeholder="Например: Дом-Белокаменная-Дом"
            disabled={saving}
          />
        </div>

        {/* ordered */}
        <label
          className="pb-check-row pb-checkbox-dark"
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}
        >
          <Checkbox
            checked={ordered}
            onChange={(e) => setOrdered(!!e.checked)}
            disabled={saving}
          />
          <span>Строгий порядок слотов</span>
          <small className="pb-hint" style={{ marginLeft: '0.5rem' }}>
            (для интервалов; для обычных маршрутов — не нужно)
          </small>
        </label>

        {/* Слоты */}
        <div style={{ marginTop: '0.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.4rem',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pb-accent)' }}>
              Слоты ({slots.length})
            </span>
            <Button
              label="Слот"
              icon="pi pi-plus"
              className="pb-soft p-button-sm"
              style={{ marginLeft: 'auto' }}
              onClick={addSlot}
              disabled={saving}
            />
          </div>

          {slots.map((slot, idx) => (
            <div
              key={idx}
              style={{
                padding: '0.6rem 0.75rem',
                marginBottom: '0.5rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--surface-border)',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--pb-accent)',
                  }}
                >
                  Слот {idx + 1}
                </span>
                <Button
                  icon="pi pi-trash"
                  text
                  className="pb-drawer__name-edit"
                  style={{ marginLeft: 'auto', width: '1.6rem', height: '1.6rem', padding: 0 }}
                  onClick={() => removeSlot(idx)}
                  disabled={saving || slots.length <= 1}
                  tooltip="Удалить слот"
                  tooltipOptions={{ position: 'left' }}
                />
              </div>

              {/* Тип: атомы / кластеры */}
              <div style={{ marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                  Что засчитывается
                </div>
                <Dropdown
                  value={slot.type}
                  options={[
                    { label: 'Конкретные атомы', value: 'atoms' },
                    { label: 'Кластеры (по тегам group:*)', value: 'clusters' },
                  ]}
                  onChange={(e) => updateSlot(idx, { type: e.value })}
                  style={{ width: '100%' }}
                  panelClassName="pb-dropdown-panel"
                  emptyMessage="—"
                  disabled={saving}
                />
              </div>

              {/* Селектор: атомы или кластеры */}
              {slot.type === 'atoms' ? (
                <div style={{ marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                    Атомы ({slot.specificAtoms.length} выбрано)
                  </div>
                  <MultiSelect
                    value={slot.specificAtoms}
                    options={atomOptions}
                    onChange={(e) => updateSlot(idx, { specificAtoms: e.value })}
                    filter
                    display="chip"
                    placeholder="Выберите атомы…"
                    emptyMessage="Нет доступных атомов"
                    emptyFilterMessage="Ничего не найдено"
                    style={{ width: '100%' }}
                    panelClassName="pb-dropdown-panel"
                    disabled={saving}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                    Кластеры ({slot.clusters.length} выбрано)
                  </div>
                  <MultiSelect
                    value={slot.clusters}
                    options={clusterOptions}
                    onChange={(e) => updateSlot(idx, { clusters: e.value })}
                    filter
                    display="chip"
                    placeholder={
                      clusterOptions.length === 0
                        ? 'Нет доступных кластеров (нужны теги group:* на атомах)'
                        : 'Выберите кластеры…'
                    }
                    emptyMessage="Нет доступных кластеров"
                    emptyFilterMessage="Ничего не найдено"
                    style={{ width: '100%' }}
                    panelClassName="pb-dropdown-panel"
                    disabled={saving || clusterOptions.length === 0}
                  />
                </div>
              )}

              {/* expectedRepeats + aggregate + optional */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '0.5rem 0.6rem',
                  alignItems: 'end',
                  marginBottom: '0.5rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                    Повторов от
                  </div>
                  <InputNumber
                    value={slot.expectedRepeatsMin}
                    onValueChange={(e) => updateSlot(idx, { expectedRepeatsMin: e.value ?? 0 })}
                    min={0}
                    max={20}
                    showButtons
                    buttonLayout="horizontal"
                    incrementButtonIcon="pi pi-plus"
                    decrementButtonIcon="pi pi-minus"
                    style={{ width: '100%' }}
                    className="pb-debug__input"
                    disabled={saving}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                    до
                  </div>
                  <InputNumber
                    value={slot.expectedRepeatsMax}
                    onValueChange={(e) => updateSlot(idx, { expectedRepeatsMax: e.value ?? 0 })}
                    min={0}
                    max={20}
                    showButtons
                    buttonLayout="horizontal"
                    incrementButtonIcon="pi pi-plus"
                    decrementButtonIcon="pi pi-minus"
                    style={{ width: '100%' }}
                    className="pb-debug__input"
                    disabled={saving}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                    Направление
                  </div>
                  <Dropdown
                    value={slot.direction || 'any'}
                    options={[
                      { label: 'Любое', value: 'any' },
                      { label: 'Только туда →', value: 'forward' },
                      { label: 'Только обратно ←', value: 'backward' },
                    ]}
                    onChange={(e) => updateSlot(idx, { direction: e.value })}
                    style={{ width: '100%' }}
                    panelClassName="pb-dropdown-panel"
                    disabled={saving || slot.type === 'clusters'}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                    Агрегация
                  </div>
                  <Dropdown
                    value={slot.aggregate}
                    options={[
                      { label: 'Лучший', value: 'best' },
                      { label: 'Сумма', value: 'sum' },
                    ]}
                    onChange={(e) => updateSlot(idx, { aggregate: e.value })}
                    style={{ width: '100%' }}
                    panelClassName="pb-dropdown-panel"
                    emptyMessage="—"
                    disabled={saving}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--tg-hint)', marginBottom: '0.15rem' }}>
                    &nbsp;
                  </div>
                  <label
                    className="pb-check-row pb-checkbox-dark"
                    style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', cursor: 'pointer', height: '2.5rem' }}
                  >
                    <Checkbox
                      checked={slot.optional}
                      onChange={(e) => updateSlot(idx, { optional: !!e.checked })}
                      disabled={saving}
                    />
                    <span style={{ fontSize: '0.75rem' }}>Опционально</span>
                  </label>
                </div>
              </div>

              {/* minCoverage */}
              <div style={{ marginTop: '0.6rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                    color: 'var(--tg-hint)',
                    marginBottom: '0.3rem',
                  }}
                >
                  <span>Мин. покрытие</span>
                  <span style={{ fontFamily: 'monospace' }}>{slot.minCoverage}%</span>
                </div>
                <Slider
                  value={slot.minCoverage}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(e) => updateSlot(idx, { minCoverage: e.value as number })}
                  disabled={saving}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Ошибка */}
        {(validationError || error) && (
          <div style={{ color: 'var(--tg-destructive)', fontSize: '0.85rem' }}>
            {validationError || error}
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
          <Button
            label="Отмена"
            className="pb-soft p-button-sm"
            onClick={onHide}
            disabled={saving}
          />
          <Button
            label={saving ? 'Сохранение…' : 'Сохранить'}
            icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            className="pb p-button-sm"
            onClick={handleSave}
            disabled={saving}
          />
        </div>
      </div>
    </Dialog>
  );
};