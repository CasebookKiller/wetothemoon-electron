// src/components/COMMON/CloseIcon/CloseIcon.tsx

import React from 'react';
import './CloseIcon.css';

interface Props {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  /** Размер кнопки. По умолчанию md — 2rem. */
  size?: 'sm' | 'md' | 'lg';
  /** Доп. классы. */
  className?: string;
  /** Доп. inline-стили. */
  style?: React.CSSProperties;
  /** aria-label. */
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Универсальная кнопка «×».
 * Цвет берётся из CSS-переменной --close-icon-color (устанавливается
 * модулем-родителем), либо наследуется (currentColor).
 */
const CloseIcon: React.FC<Props> = ({
  onClick,
  title = 'Закрыть',
  size = 'md',
  className,
  style,
  ariaLabel = 'Закрыть',
  disabled = false,
}) => {
  return (
    <button
      type="button"
      className={`app-close-icon app-close-icon--${size}${
        className ? ' ' + className : ''
      }`}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={style}
      disabled={disabled}
    >
      <i className="pi pi-times" />
    </button>
  );
};

export default CloseIcon;