// src/components/PRANA_BINDU/RunChainBadge.tsx
//
// Компактный бейдж «Primary · цепочка».
// Показывается в карточках пробежки (RunFactView, RunStreamsDrawer).
// В тултипе — полный список атомов цепочки с длинами и покрытием.

import React from 'react';
import { useRunChain } from './HOOKS/useRunChain';
import AppIcon from '../COMMON/AppIcon/AppIcon';

interface Props {
  runFactId: number | null;
  /** Если true — рендер в одну строку (для заголовков drawer). */
  compact?: boolean;
}

export const RunChainBadge: React.FC<Props> = ({ runFactId, compact = false }) => {
  const { loading, primary, alsoUsed, error } = useRunChain(runFactId);

  if (loading) {
    return (
      <small className="pb-hint" style={{ fontSize: '0.72rem', opacity: 0.7 }}>
        <AppIcon name="spinner" spin style={{ fontSize: '0.7rem' }} /> Цепочка…
      </small>
    );
  }

  if (error) {
    return (
      <small style={{ fontSize: '0.7rem', color: 'var(--tg-hint)' }} title={error}>
        Не удалось построить цепочку
      </small>
    );
  }

  if (!primary) {
    return (
      <small className="pb-hint" style={{ fontSize: '0.7rem' }}>
        Цепочка не найдена
      </small>
    );
  }

  const fmtLen = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(2)} км` : `${Math.round(m)} м`;

  const tooltip =
    `Цепочка: ${alsoUsed.length + 1} атомов\n\n` +
    `Primary: ${primary.name}\n` +
    `  ${fmtLen(primary.lengthM)}, покрытие ${primary.coveragePct}%, ` +
    `${primary.kind === 'loop' ? `×${primary.repeats}` : 'линейный'}\n` +
    (alsoUsed.length > 0
      ? `\nТакже на маршруте:\n` +
        alsoUsed
          .map(
            (a) =>
              `  • ${a.name} (${fmtLen(a.lengthM)}, ${a.coveragePct}%)`
          )
          .join('\n')
      : '');

  if (compact) {
    return (
      <span
        title={tooltip}
        style={{
          fontSize: '0.7rem',
          padding: '0.1rem 0.4rem',
          borderRadius: 3,
          background: 'rgba(106, 178, 242, 0.15)',
          color: '#6ab2f2',
          fontWeight: 600,
          cursor: 'help',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'inline-block',
          maxWidth: '100%',
        }}
      >
        <AppIcon name="link" style={{ fontSize: '0.65rem', marginRight: 4 }} />
        {primary.kind === 'loop' ? `×${primary.repeats} · ` : ''}
        {primary.name}
        {alsoUsed.length > 0 ? ` +${alsoUsed.length}` : ''}
      </span>
    );
  }

  return (
    <div
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.75rem',
        padding: '0.25rem 0.5rem',
        borderRadius: 4,
        background: 'rgba(106, 178, 242, 0.12)',
        border: '1px solid rgba(106, 178, 242, 0.3)',
        cursor: 'help',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <AppIcon name="link" color="#6ab2f2" size={13} style={{ flexShrink: 0 }} />
      <span
        style={{
          color: '#6ab2f2',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {primary.kind === 'loop' ? `×${primary.repeats} · ` : ''}
        {primary.name}
      </span>
      {alsoUsed.length > 0 && (
        <span
          style={{
            fontSize: '0.7rem',
            color: 'var(--tg-hint)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          +{alsoUsed.length}
        </span>
      )}
    </div>
  );
};