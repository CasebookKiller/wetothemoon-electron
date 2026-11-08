// src/components/GATEWAY/GatewayInputModal/GatewayInputModal.tsx
import React, { useEffect, useState } from 'react';
import { CloseIcon } from '../GatewayIcons/GatewayIcons';

interface GatewayInputModalProps {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const GatewayInputModal: React.FC<GatewayInputModalProps> = ({
  visible,
  title,
  initialValue = '',
  placeholder = '',
  confirmLabel = 'Сохранить',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  if (!visible) return null;

  return (
    <div className="ds-modal ds-fade-in-zoom-in-enter gateway-input-modal" aria-modal="true">
      <div className="ds-modal-focus-lock gateway-input-modal__focus-lock">
        <div className="ds-modal-content ds-elevated ds-modal-content--dialog gateway-input-modal__content">
          <div className="ds-modal-content__header-wrapper">
            <div className="ds-modal-content__title">{title}</div>
            <div className="ds-modal-content__close" onClick={onCancel} tabIndex={0}>
              <CloseIcon size={14} />
            </div>
          </div>
          <div className="ds-modal-content__main" style={{ padding: '20px' }}>
            <input
              type="text"
              className="ds-input__input gateway-input-modal__input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm(value.trim());
                if (e.key === 'Escape') onCancel();
              }}
            />
          </div>
          <div className="ds-modal-content__footer">
            <div className="ds-modal-content__button-group">
              <div
                role="button"
                className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m ds-button--min-width"
                onClick={onCancel}
              >
                <span className="ds-button__content">Отмена</span>
              </div>
              <div
                role="button"
                className="ds-button ds-button--primary ds-button--filled ds-button--capsule ds-button--m ds-button--min-width"
                onClick={() => onConfirm(value.trim())}
              >
                <span className="ds-button__content">{confirmLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};