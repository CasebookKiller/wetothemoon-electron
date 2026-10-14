import React from 'react';
import { Dialog, type DialogProps } from 'primereact/dialog';
import './AppDialog.css';

export interface AppDialogProps extends Omit<DialogProps, 'header'> {
  /** Заголовок диалога. */
  title?: React.ReactNode;
  /** Иконка PrimeIcons без префикса (например 'share-alt'). */
  titleIcon?: string;
  children: React.ReactNode;
}

/**
 * Универсальный диалог.
 * - Единый стиль в любом модуле (через CSS-переменные).
 * - Кнопки закрытия/максимизации — из PrimeReact, стилизуются общим override.
 * - className добавляется к 'app-dialog' — можно передать модульный класс.
 */
export const AppDialog: React.FC<AppDialogProps> = ({
  title,
  titleIcon,
  children,
  className,
  ...dialogProps
}) => {
  const fullClassName = `app-dialog${className ? ' ' + className : ''}`;

  const header =
    title || titleIcon ? (
      <div className="app-dialog__header-inner">
        {titleIcon && (
          <i className={`pi ${titleIcon} app-dialog__title-icon`} />
        )}
        {title && <span className="app-dialog__title-text">{title}</span>}
      </div>
    ) : undefined;

  return (
    <Dialog {...dialogProps} className={fullClassName} header={header}>
      {children}
    </Dialog>
  );
};

export default AppDialog;