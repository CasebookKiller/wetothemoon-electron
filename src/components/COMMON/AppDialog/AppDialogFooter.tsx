import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Выравнивание действий. */
  align?: 'right' | 'space-between';
}

/**
 * Футер диалога. Действия внутри — обычные <Button>.
 */
export const AppDialogFooter: React.FC<Props> = ({
  children,
  align = 'right',
}) => (
  <div className={`app-dialog__footer app-dialog__footer--${align}`}>
    {children}
  </div>
);

export default AppDialogFooter;