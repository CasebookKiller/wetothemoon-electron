// src/components/GATEWAY/GatewayInputArea/GatewayInputArea.tsx

import React from 'react';
import { DeepThinkIcon, WebSearchIcon, SendIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';

interface GatewayInputAreaProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  disabled: boolean;
  sending: boolean;
  deepThinking: boolean;
  search: boolean;
  onToggleDeepThinking: () => void;
  onToggleSearch: () => void;
  isExpert: boolean;
}

export const GatewayInputArea: React.FC<GatewayInputAreaProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  deepThinking,
  search,
  onToggleDeepThinking,
  onToggleSearch,
  isExpert,
}) => {
  return (
    <div className="aaff8b8f">
      <div className="_77cefa5 _9996a53">
        <div className="_020ab5b">
          <div className="_24fad49">
            <textarea
              className="_27c9245 ds-scroll-area ds-scroll-area--show-on-focus-within ds-scroll-area--enabled d96f2d2a"
              placeholder="Сообщение для DeepSeek"
              rows={2}
              autoComplete="off"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled || sending}
              style={{ '--container-height': '60px' } as React.CSSProperties}
            />
            <div className="b13855df" />
          </div>

          <div className="ec4f5d61">
            <div className="_58b31c9">
              {/* Кнопка "Глубокое мышление" */}
              <div
                tabIndex={0}
                aria-pressed={deepThinking}
                className={`f79352dc ds-toggle-button ds-toggle-button--m ${
                  deepThinking ? 'ds-toggle-button--selected' : ''
                }`}
                onClick={onToggleDeepThinking}
              >
                <div className="ds-toggle-button__icon">
                  <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                    <DeepThinkIcon size={16} />
                  </div>
                </div>
                <span className="_6dbc175">Глубокое мышление</span>
                <div className="ds-focus-ring" style={{ '--dsl-focus-ring-offset': '-1px' } as React.CSSProperties} />
              </div>

              {/* Кнопка "Умный поиск" */}
              {!isExpert && (
                <div
                  tabIndex={0}
                  aria-pressed={search}
                  className={`f79352dc ds-toggle-button ds-toggle-button--m ${
                    search ? 'ds-toggle-button--selected' : ''
                  }`}
                  onClick={onToggleSearch}
                >
                  <div className="ds-toggle-button__icon">
                    <div className="ds-icon" style={{ fontSize: 'inherit' }}>
                      <WebSearchIcon size={16} />
                    </div>
                  </div>
                  <span className="_6dbc175">Умный поиск</span>
                  <div className="ds-focus-ring" style={{ '--dsl-focus-ring-offset': '-1px' } as React.CSSProperties} />
                </div>
                )}
            </div>

            {/* Кнопка отправки */}
            <div className="bf38813a">
              <div
                role="button"
                className="ds-button ds-button--primary ds-button--filled ds-button--circle ds-button--m ds-button--icon-relative-m"
                tabIndex={0}
                onClick={onSend}
                style={
                  {
                    '--dsl-button-height': '34px',
                    pointerEvents: disabled || !value.trim() || sending ? 'none' : 'auto',
                    opacity: disabled || !value.trim() || sending ? 0.5 : 1,
                  } as React.CSSProperties
                }
              >
                <div className="ds-button__background" />
                <div className="ds-button__icon ds-button__icon--last-child">
                  <SendIcon size={16} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};