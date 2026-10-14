// src/components/PRANA_BINDU/ExerciseGraph/PalettePanel.tsx

import AppIcon from '@/components/COMMON/AppIcon/AppIcon';
import React, { useState } from 'react';

interface PaletteItem {
  id: string;
  kind: string;
  label: string;
  labelRu?: string;
  meta?: string;
  source: string;
  graphId?: string;
  inGraph?: boolean;
  existingGraphId?: string;
  existingShort?: string;
  existingLabel?: string;
  state?: 'active' | 'linked' | 'candidate';
  candidate?: {
    source: string;
    sourceKey: string;
    sourceLevel: string | null;
    target: string;
    targetKey: string;
    targetLevel: string | null;
  };
}

interface PaletteGroup {
  id: string;
  label: string;
  labelRu: string;
  items: PaletteItem[];
}

interface Props {
  groups: PaletteGroup[];
  onAdd?: (item: PaletteItem) => void;
  onFocus?: (graphId: string) => void;
  onConfirm?: (candidate: NonNullable<PaletteItem['candidate']>, item: PaletteItem) => void;
}

export const PalettePanel: React.FC<Props> = ({
  groups,
  onAdd,
  onFocus,
  onConfirm,
}) => {
  const [activeGroup, setActiveGroup] = useState<string>(groups[0]?.id ?? '');
  const [search, setSearch] = useState('');

  if (groups.length === 0) {
    return <div className="pb-graph-view__detail">Палитра пуста</div>;
  }

  const group = groups.find((g) => g.id === activeGroup) ?? groups[0];
  const q = search.trim().toLowerCase();
  const items = q
    ? group.items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          (it.labelRu ?? '').toLowerCase().includes(q),
      )
    : group.items;

  return (
    <div className="pb-graph-view__detail pb-palette">
      <div className="pb-palette__tabs">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={g.id === activeGroup ? 'is-active' : ''}
            onClick={() => setActiveGroup(g.id)}
          >
            {g.labelRu}
            <span className="pb-palette__count">{g.items.length}</span>
          </button>
        ))}
      </div>

      <input
        type="text"
        className="pb-palette__search"
        placeholder="Поиск..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="pb-palette__list">
        {items.map((it) => {
          const state = it.state ?? (it.inGraph ? 'linked' : 'active');
          const short = it.existingShort;

          const cls = [
            'pb-palette__item',
            state === 'linked' ? 'is-linked' : '',
            state === 'candidate' ? 'is-candidate' : '',
          ].filter(Boolean).join(' ');

          const title =
            state === 'linked'
              ? `Уже размечено${short ? ': ' + short : ''}. Клик — показать.`
              : state === 'candidate'
                ? `Возможно совпадает${short ? ' с ' + short : ''}. Клик — подтвердить.`
                : 'Клик — добавить в граф';

          return (
            <div
              key={it.id}
              className={cls}
              title={title}
              onClick={() => {
                if (state === 'linked') {
                  if (it.existingGraphId) onFocus?.(it.existingGraphId);
                  return;
                }
                if (state === 'candidate') {
                  if (it.candidate) onConfirm?.(it.candidate, it);
                  return;
                }
                onAdd?.(it);
              }}
            >
              <div className="pb-palette__item-name">{it.labelRu ?? it.label}</div>
              {it.labelRu && it.label !== it.labelRu && (
                <div className="pb-palette__item-label">{it.label}</div>
              )}
              {it.meta && <div className="pb-palette__item-meta">{it.meta}</div>}

              {state === 'linked' && !short && (
                <AppIcon name="check" size="sm" color="success" className="pb-palette__check" />
              )}
              {state === 'linked' && short && (
                <span className="pb-palette__badge pb-palette__badge--linked">
                  ≈ {short}
                </span>
              )}
              {state === 'candidate' && short && (
                <span className="pb-palette__badge pb-palette__badge--candidate">
                  ? ≈ {short}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};