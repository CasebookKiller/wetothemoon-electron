// src/components/COMMON/AppIcon/AppIcon.tsx
//
// Единая точка входа для иконок: PrimeIcons (шрифт), Custom SVG
// (Bootstrap Icons), Material Symbols (заглушка, SVG).
//
//   <AppIcon name="check" />                              // prime, md
//   <AppIcon name="water" set="custom" size={14} />        // SVG, 14px
//   <AppIcon name="water" set="custom" color="accent" />   // var(--module-accent)
//   <AppIcon name="close" onClick={onClose} />             // accessible button
//
// Цвет:
//   - preset (accent/muted/success/warning/danger/inherit) → CSS-класс,
//     поэтому работает override через --app-icon-color у родителя;
//   - любая другая строка → inline style.color.
//   accent резолвится через var(--module-accent) — переключается между
//   модулями (PB/OSINT) автоматически.
//
// Не путать с icon="pi pi-..." внутри PrimeReact-Button/Dialog — там
// PrimeReact сам управляет разметкой.

import React from 'react';
import './AppIcon.css';
import { CUSTOM_ICONS } from './icons/custom';

export type AppIconSet = 'prime' | 'material' | 'custom';

export type AppIconColorPreset =
  | 'inherit'
  | 'accent'
  | 'muted'
  | 'success'
  | 'warning'
  | 'danger';

// (string & {}) даёт автокомплит по пресетам + принимает любую строку.
export type AppIconColor = AppIconColorPreset | (string & {});

export type AppIconSizePreset = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AppIconSize = AppIconSizePreset | number;

interface Props {
  /** Имя иконки. Для prime — без «pi pi-» (напр. 'check', 'cloud-download'). */
  name: string;
  /** Набор. Дефолт 'prime'. */
  set?: AppIconSet;
  /** 'xs'=10, 'sm'=14, 'md'=16, 'lg'=20, 'xl'=24, или число в px. */
  size?: AppIconSize;
  /** Preset или CSS-цвет ('#hex', 'var(--x)'). */
  color?: AppIconColor;
  /** Крутить (spinner, sync, refresh). */
  spin?: boolean;
  /** material: заливка (0 — контур, 1 — залитая). */
  filled?: boolean;
  /** material: толщина линии 100–700. */
  weight?: number;
  /** material: оптический размер 20–48. */
  opticalSize?: number;
  /** material: grade/акцент -25..200. */
  grade?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

const SIZE_PX: Record<AppIconSizePreset, number> = {
  xs: 10,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

const COLOR_CLASS: Record<AppIconColorPreset, string> = {
  inherit: '',
  accent: 'app-icon--accent',
  muted: 'app-icon--muted',
  success: 'app-icon--success',
  warning: 'app-icon--warning',
  danger: 'app-icon--danger',
};

function isColorPreset(c: AppIconColor): c is AppIconColorPreset {
  return (
    c === 'inherit' ||
    c === 'accent' ||
    c === 'muted' ||
    c === 'success' ||
    c === 'warning' ||
    c === 'danger'
  );
}

function resolveSizePx(size: AppIconSize): number {
  return typeof size === 'number' ? size : SIZE_PX[size];
}

// Предупреждаем по одному разу на «set:name» — чтобы не засорять консоль.
const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[AppIcon] ${msg}`);
}

export const AppIcon: React.FC<Props> = ({
  name,
  set = 'prime',
  size = 'md',
  color = 'inherit',
  spin = false,
  filled = false,
  weight,
  opticalSize,
  grade,
  className,
  style,
  title,
  ariaLabel,
  onClick,
}) => {
  const px = resolveSizePx(size);
  const colorPreset = isColorPreset(color);

  // ---- Accessibility ---------------------------------------------------
  const interactive = Boolean(onClick);
  const ariaProps: Record<string, unknown> = interactive
    ? { role: 'button', tabIndex: 0, 'aria-label': ariaLabel ?? title ?? name }
    : ariaLabel
      ? { role: 'img', 'aria-label': ariaLabel }
      : { 'aria-hidden': true };

  const handleKeyDown = interactive
    ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }
    : undefined;

  // ---- Общие стили -----------------------------------------------------
  const baseStyle: React.CSSProperties = {
    flexShrink: 0,
    ...(interactive ? { cursor: 'pointer' } : null),
    ...(colorPreset ? null : { color }), // preset через класс
    ...style,
  };

  // ---- PrimeIcons (шрифт) ---------------------------------------------
  if (set === 'prime') {
    const cls = [
      'pi',
      `pi-${name}`,
      'app-icon',
      colorPreset ? COLOR_CLASS[color as AppIconColorPreset] : '',
      spin ? 'app-icon--spin' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <i
        className={cls}
        style={{ ...baseStyle, fontSize: `${px}px` }}
        title={title}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...ariaProps}
      />
    );
  }

  // ---- Material Symbols (шрифт, лигатуры) -----------------------------
  if (set === 'material') {
    const cls = [
      'material-symbols-outlined',
      'app-icon',
      'app-icon--material',
      colorPreset ? COLOR_CLASS[color as AppIconColorPreset] : '',
      spin ? 'app-icon--spin' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    const variation = [
      `'FILL' ${filled ? 1 : 0}`,
      weight != null ? `'wght' ${weight}` : null,
      opticalSize != null ? `'opsz' ${opticalSize}` : null,
      grade != null ? `'GRAD' ${grade}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <span
        className={cls}
        style={{
          ...baseStyle,
          fontSize: `${px}px`,
          // 👇 ДОБАВЛЯЕМ ЭТУ СТРОКУ 👇
          fontFamily: "'Material Symbols Outlined Variable', 'Material Symbols Outlined', sans-serif",
          ...(variation ? { fontVariationSettings: variation } : null),
        }}
        title={title}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...ariaProps}
      >
        {name}
      </span>
    );
  }

  // ---- SVG (custom) ---------------------------------------------------
  const child = CUSTOM_ICONS[name];

  if (!child) {
    warnOnce(`custom:${name}`, `иконка "${name}" не найдена в наборе "custom"`);
    return (
      <span
        className={`app-icon app-icon--placeholder ${className ?? ''}`}
        style={{ ...baseStyle, width: px, height: px, display: 'inline-block' }}
        title={title}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...ariaProps}
      />
    );
  }

  const cls = [
    'app-icon',
    'app-icon--svg',
    colorPreset ? COLOR_CLASS[color as AppIconColorPreset] : '',
    spin ? 'app-icon--spin' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  // Важно: SVGProps в React НЕ поддерживает title/onClick/a11y-атрибуты
  // (title — это HTML-атрибут; в SVG есть только <title>-элемент).
  // Поэтому вешаем всё на обёртку <span>, а SVG оставляем «глухим» —
  // цвет пробрасывается через fill="currentColor".
  return (
    <span
      className={cls}
      style={baseStyle}
      title={title}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...ariaProps}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width={px}
        height={px}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        {child}
      </svg>
    </span>
  );
};

export default AppIcon;