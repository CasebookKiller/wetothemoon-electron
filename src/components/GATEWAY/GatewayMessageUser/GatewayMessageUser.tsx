import React, { useState, useLayoutEffect, useRef } from 'react';
import { CopyIcon, EditIcon, CheckIcon, ChevronIcon, FileIcon, ImageIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import { classNames } from '@/css/classnames';

export interface GatewayUserBlock {
  type: 'text' | 'code' | 'file';
  content: string;
  language?: string;
  size?: string;
  mime?: string;
  fileKind?: 'text' | 'image' | 'binary';
  thumbUrl?: string;
  fileId?: string;
}

interface GatewayMessageUserProps {
  blocks?: GatewayUserBlock[];
  content?: string;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isLast?: boolean;
  onCopy?: (text: string) => void;
  onEdit?: () => void;
  /** Клик по file-чипу: (block, chipIndex(file-only), messageHash) */
  onFileClick?: (
    block: GatewayUserBlock,
    chipIndex: number,
    messageHash: string | null
  ) => void;
  /** messageHash этого сообщения */
  messageHash?: string | null;
  /** Статусы файлов: `${messageHash}:${chipIndex}` → 'ok' | 'failed' */
  fileStatuses?: Map<string, 'ok' | 'failed'>;
  // 5.7.35: branching
  branchTotal?: number;
  branchIndex?: number;
  onBranchSwitch?: (direction: 'prev' | 'next') => void;
}

export const GatewayMessageUser: React.FC<GatewayMessageUserProps> = ({
  blocks: blocksProp,
  content: contentProp,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
  isLast = false,
  onCopy,
  onEdit,
  onFileClick,
  messageHash = null,
  fileStatuses,
  branchTotal = 1,
  branchIndex = 1,
  onBranchSwitch,
}) => {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [isLong, setIsLong] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);

  const blocks: GatewayUserBlock[] =
    blocksProp && blocksProp.length > 0
      ? blocksProp
      : contentProp
      ? [{ type: 'text', content: contentProp }]
      : [];

  const fileBlocks = blocks.filter((b) => b.type === 'file');
  const textBlocks = blocks.filter((b) => b.type !== 'file');
  const textContent = textBlocks.map((b) => b.content).join('\n\n');

  useLayoutEffect(() => {
    const el = textContainerRef.current;
    if (!el) return;
    if (!textContent) {
      setIsLong(false);
      return;
    }
    setIsLong(el.scrollHeight > el.clientHeight);
  }, [textContent]);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const actionsStyle: React.CSSProperties = {
    visibility: selectMode ? 'hidden' : isLast || hovered ? 'visible' : 'hidden',
    opacity: selectMode ? 0 : isLast || hovered ? 1 : 0,
    transition: 'opacity 0.2s ease, visibility 0.2s ease',
    pointerEvents: selectMode ? 'none' : 'auto',
  };

  return (
    <div
      className={classNames({ _9663006: true, _2c189bc: true })}
      data-virtual-list-item-key="user"
      data-message-hash={messageHash || ''}
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
        {fileBlocks.length > 0 && (
          <div className="eafda4ae" style={{ marginBottom: textBlocks.length > 0 ? 8 : 0 }}>
            <div className="gateway-file-chips">
              {fileBlocks.map((b, i) => {
                const status = messageHash
                  ? fileStatuses?.get(`${messageHash}:${i}`)
                  : undefined;
                const isLoaded = status === 'ok';
                const isFailed = status === 'failed';
                return (
                  <div
                    key={`${b.content}-${i}`}
                    className={classNames({
                      'gateway-file-chip': true,
                      'gateway-file-chip--loaded': isLoaded,
                      'gateway-file-chip--failed': isFailed,
                    })}
                    tabIndex={0}
                    role="button"
                    onClick={() => onFileClick?.(b, i, messageHash)}
                  >
                    {b.fileKind === 'image' && b.thumbUrl ? (
                      <img
                        src={b.thumbUrl}
                        alt={b.content}
                        className="gateway-file-chip__thumb"
                      />
                    ) : (
                      <div className="gateway-file-chip__icon">
                        {b.fileKind === 'image' ? (
                          <ImageIcon size={28} />
                        ) : (
                          <FileIcon size={28} />
                        )}
                      </div>
                    )}
                    <div className="gateway-file-chip__content">
                      <div className="gateway-file-chip__name" title={b.content}>
                        {b.content}
                      </div>
                      <div className="gateway-file-chip__meta">
                        {[b.mime, b.size].filter(Boolean).join(' ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {textContent && (
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
                <span>{textContent}</span>
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
                    className={classNames({ 'ds-icon': true, d630ec62: true })}
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
        )}
      </div>

      {/* 5.7.35: Переключатель веток (под сообщением) */}
      {branchTotal > 1 && (
        <div
          className={classNames({ _17e14c5: true, _6fbd7d4: true })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: 4,
            marginLeft: 4,
          }}
        >
          <div
            role="button"
            className={classNames({
              'ds-button': true,
              'ds-button--iconLabelTertiary': true,
              'ds-button--icon': true,
              'ds-button--capsule': true,
              'ds-button--xs': true,
              'ds-button--icon-relative-l': true,
              e7367035: true,
              'ds-button--disabled': branchIndex <= 1,
            })}
            tabIndex={0}
            onClick={() => branchIndex > 1 && onBranchSwitch?.('prev')}
          >
            <div className="ds-button__background"></div>
            <div className="ds-button__icon ds-button__icon--last-child">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.5 2.15137L8.07617 2.57617L5.34863 5.30273C5.09294 5.55843 4.86618 5.78438 4.70215 5.98828C4.53117 6.20088 4.38244 6.44405 4.33398 6.75C4.30778 6.91565 4.30778 7.08435 4.33398 7.25C4.38244 7.55595 4.53117 7.79912 4.70215 8.01172C4.86618 8.21561 5.09294 8.44157 5.34863 8.69727L8.07617 11.4238L8.5 11.8486L9.34863 11L8.92383 10.5762L6.19727 7.84863C5.92268 7.57405 5.75151 7.40124 5.6377 7.25977C5.53096 7.12709 5.52187 7.07728 5.51953 7.0625C5.51297 7.02105 5.51297 6.97895 5.51953 6.9375C5.52187 6.92272 5.53096 6.87291 5.6377 6.74023C5.75152 6.59876 5.92268 6.42595 6.19727 6.15137L8.92383 3.42383L9.34863 3L8.5 2.15137Z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          <div
            className="dd7e4fda"
            style={{
              fontSize: 12,
              color: 'var(--dsw-alias-text-secondary, #adb2b8)',
              padding: '0 6px',
              userSelect: 'none',
            }}
          >
            {branchIndex} / {branchTotal}
          </div>
          <div
            role="button"
            className={classNames({
              'ds-button': true,
              'ds-button--iconLabelTertiary': true,
              'ds-button--icon': true,
              'ds-button--capsule': true,
              'ds-button--xs': true,
              'ds-button--icon-relative-l': true,
              e7367035: true,
              'ds-button--disabled': branchIndex >= branchTotal,
            })}
            tabIndex={0}
            onClick={() => branchIndex < branchTotal && onBranchSwitch?.('next')}
          >
            <div className="ds-button__background"></div>
            <div className="ds-button__icon ds-button__icon--last-child">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 2.15137L5.92383 2.57617L8.65137 5.30273C8.90706 5.55843 9.13382 5.78438 9.29785 5.98828C9.46883 6.20088 9.61756 6.44405 9.66602 6.75C9.69222 6.91565 9.69222 7.08435 9.66602 7.25C9.61756 7.55595 9.46883 7.79912 9.29785 8.01172C9.13382 8.21561 8.90706 8.44157 8.65137 8.69727L5.92383 11.4238L5.5 11.8486L4.65137 11L5.07617 10.5762L7.80273 7.84863C8.07732 7.57405 8.24849 7.40124 8.3623 7.25977C8.46904 7.12709 8.47813 7.07728 8.48047 7.0625C8.48703 7.02105 8.48703 6.97895 8.48047 6.9375C8.47813 6.92272 8.46904 6.87291 8.3623 6.74023C8.24848 6.59876 8.07732 6.42595 7.80273 6.15137L5.07617 3.42383L4.65137 3L5.5 2.15137Z" fill="currentColor"/>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Панель действий (Копировать / Редактировать) */}
      <div className={classNames({ _11d6b3a: true })} style={actionsStyle}>
        <div className={classNames({ _425ea0b: true })}>
          <div
            className={classNames({ 'ds-flex': true, _78e0558: true, _0bbda35: true })}
            style={{ alignItems: 'flex-end', gap: 0 }}
          >
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