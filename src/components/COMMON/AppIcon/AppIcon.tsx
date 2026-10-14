// src/components/COMMON/AppIcon/AppIcon.tsx
//
// Универсальная иконка PrimeIcons.
//   <AppIcon name="check" />
//   <AppIcon name="spinner" spin />
//   <AppIcon name="trash" color="danger" />
//
// Цвет управляется семантическим пропом color или через --app-icon-color
// у родителя. Не путать с иконками внутри PrimeReact-Button/Dialog —
// там icon="pi pi-..." используется напрямую.

import React from 'react';
import './AppIcon.css';

export type AppIconColor =
  | 'inherit'
  | 'accent'
  | 'muted'
  | 'success'
  | 'warning'
  | 'danger'
  | 'custom';

export type AppIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  /** Имя иконки без «pi pi-» (например 'check', 'cloud-download'). */
  name: string;
  size?: AppIconSize;
  color?: AppIconColor;
  /** Крутить (для spinner, sync, refresh). */
  spin?: boolean;
  /** Доп. CSS-классы. */
  className?: string;
  /** Inline-стили. */
  style?: React.CSSProperties;
  /** Тултип. */
  title?: string;
  /** aria-label. */
  ariaLabel?: string;
}

const COLOR_CLASS: Record<AppIconColor, string> = {
  inherit: '',
  accent: 'app-icon--accent',
  muted: 'app-icon--muted',
  success: 'app-icon--success',
  warning: 'app-icon--warning',
  danger: 'app-icon--danger',
  custom: '',
};

export const AppIcon: React.FC<Props> = ({
  name,
  size = 'md',
  color = 'inherit',
  spin = false,
  className,
  style,
  title,
  ariaLabel,
}) => {
  const cls = [
    'pi',
    `pi-${name}`,
    'app-icon',
    `app-icon--${size}`,
    COLOR_CLASS[color],
    spin ? 'pi-spin' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <i className={cls} style={style} title={title} aria-label={ariaLabel} />
  );
};

export default AppIcon;