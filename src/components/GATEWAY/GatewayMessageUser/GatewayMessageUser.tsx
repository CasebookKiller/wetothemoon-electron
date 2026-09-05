import React, { useState, useLayoutEffect, useRef } from 'react';
import { CopyIcon, EditIcon, CheckIcon, ChevronIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import { classNames } from '@/css/classnames';

interface GatewayMessageUserProps {
  content: string;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isLast?: boolean;
  onCopy?: (text: string) => void;
  onEdit?: () => void;
}

export const GatewayMessageUser: React.FC<GatewayMessageUserProps> = ({
  content,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
  isLast = false,
  onCopy,
  onEdit,
}) => {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [isLong, setIsLong] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);

  // Определяем, длинный ли текст, ОДИН РАЗ при монтировании и изменении контента
  useLayoutEffect(() => {
    const el = textContainerRef.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight) {
      setIsLong(true);
    } else {
      setIsLong(false);
    }
  }, [content]);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const actionsStyle: React.CSSProperties = {
    visibility: selectMode ? 'hidden' : (isLast || hovered ? 'visible' : 'hidden'),
    opacity: selectMode ? 0 : (isLast || hovered ? 1 : 0),
    transition: 'opacity 0.2s ease, visibility 0.2s ease',
    pointerEvents: selectMode ? 'none' : 'auto',
  };

  return (
    <div
      className={classNames({
        _9663006: true,
        _2c189bc: true,
      })}
      data-virtual-list-item-key="user"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {selectMode && (
        <div className={classNames({ d30139ff: true })}>
          <div className={classNames({ ad950ab7: true })}>
            <div
              className={classNames({ 'ds-checkbox-align-wrapper': true })}
              style={{ alignSelf: 'flex-start', '--dsl-checkbox-line-height': 'unset' } as React.CSSProperties}
            >
              <div
                className={classNames({
                  'ds-checkbox': true,
                  'ds-checkbox--l': true,
                  'ds-checkbox--active': isSelected,
                  'ds-checkbox--none': true,
                })}
                tabIndex={0}
                onClick={onToggleSelect}
              >
                {isSelected && <CheckIcon size={14} />}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={classNames({
          'ds-message': true,
          d29f3d7d: true,
          _63c77b1: true,
          _6e8caf5: isSelected,
          _7729a77: isSelected,
        })}
      >
        <div className={classNames({ fbb737a4: true })}>
          <div
            ref={textContainerRef}
            className={classNames({ 'ds-collapsible-text': true })}
            style={{
              maxHeight: collapsed ? 192 : undefined,
              overflow: collapsed ? 'hidden' : undefined,
              transition: 'none',
            }}
          >
            <div>
              <span>{content}</span>
            </div>
            <div style={{ height: 24 }} />
          </div>
          {isLong && (
            <div
              className={classNames({
                'ds-collapsible-text-toggle-button': true,
                _5b3c8cd: true,
              })}
              onClick={() => setCollapsed(!collapsed)}
            >
              <div
                className={classNames({ d077096d: true })}
                style={{
                  transition: collapsed
                    ? 'none'
                    : 'opacity var(--dsl-collapsible-text-transition-duration) var(--dsl-collapsible-text-transition-timing-function)',
                  opacity: collapsed ? 1 : 0,
                }}
              />
              <div className={classNames({ _08f18f6: true })}>
                <div
                  className={classNames({
                    'ds-icon': true,
                    d630ec62: true,
                  })}
                  style={{
                    fontSize: 14,
                    width: 14,
                    height: 14,
                    transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: collapsed
                      ? 'none'
                      : 'transform var(--dsl-collapsible-text-transition-duration) var(--dsl-collapsible-text-transition-timing-function)',
                  }}
                >
                  <ChevronIcon size={14} expanded={true} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={classNames({ _11d6b3a: true })} style={actionsStyle}>
        <div className={classNames({ _425ea0b: true })}>
          <div
            className={classNames({
              'ds-flex': true,
              _78e0558: true,
              _0bbda35: true,
            })}
            style={{ alignItems: 'flex-end', gap: 0 }}
          >
            {/* Кнопка копирования */}
            <div
              role="button"
              className={classNames({
                'ds-button': true,
                'ds-button--iconLabelTertiary': true,
                'ds-button--icon': true,
                'ds-button--capsule': true,
                'ds-button--xs': true,
                'ds-button--icon-relative-l': true,
                db183363: true,
              })}
              tabIndex={0}
              onClick={handleCopy}
            >
              <div className={classNames({ 'ds-button__background': true })} />
              <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              </div>
            </div>

            {/* Кнопка редактирования */}
            <div
              aria-disabled="false"
              role="button"
              className={classNames({
                'ds-button': true,
                'ds-button--iconLabelTertiary': true,
                'ds-button--icon': true,
                'ds-button--capsule': true,
                'ds-button--xs': true,
                'ds-button--icon-relative-l': true,
                d4910adc: true,
              })}
              tabIndex={0}
              onClick={onEdit}
            >
              <div className={classNames({ 'ds-button__background': true })} />
              <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
                <EditIcon size={16} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};