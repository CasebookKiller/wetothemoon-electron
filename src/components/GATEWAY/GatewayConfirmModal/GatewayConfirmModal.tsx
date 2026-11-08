// src/components/GATEWAY/GatewayConfirmModal/GatewayConfirmModal.tsx

import React, { useEffect } from 'react';
import { CloseIcon } from '../GatewayIcons/GatewayIcons';

export interface GatewayConfirmModalProps {
  visible: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const GatewayConfirmModal: React.FC<GatewayConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, loading, onCancel]);

  if (!visible) return null;

  return (
    <div
      className="ds-modal ds-fade-in-zoom-in-enter ds-fade-in-zoom-in-active gateway-confirm-modal"
      aria-modal="true"
      role="dialog"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="ds-modal-focus-lock"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          tabIndex={-1}
          className="ds-modal-content ds-elevated ds-modal-content--dialog"
        >
          <div className="ds-modal-content__header-wrapper">
            <div className="ds-modal-content__title">{title}</div>
            <div
              role="button"
              className="ds-modal-content__close"
              onClick={() => !loading && onCancel()}
              tabIndex={0}
            >
              <CloseIcon size={14} />
            </div>
          </div>
          {message && (
            <div className="ds-modal-content__main">{message}</div>
          )}
          <div className="ds-modal-content__footer">
            <div className="ds-modal-content__button-group">
              <div
                role="button"
                className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width"
                tabIndex={0}
                onClick={() => !loading && onCancel()}
              >
                <div className="ds-button__background" />
                <div className="ds-button__border" />
                <span className="ds-button__content">{cancelLabel}</span>
              </div>
              <div
                role="button"
                className={`ds-button ds-button--filled ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width ${
                  danger ? 'ds-button--error' : 'ds-button--primary'
                } ${loading ? 'ds-button--disabled' : ''}`}
                tabIndex={0}
                onClick={() => !loading && onConfirm()}
                style={{ pointerEvents: loading ? 'none' : 'auto' }}
              >
                <div className="ds-button__background" />
                <span className="ds-button__content">
                  {loading ? '…' : confirmLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatewayConfirmModal;