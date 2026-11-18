// src/components/GATEWAY/GatewayInputArea/GatewayInputArea.tsx

import React, { useState } from 'react';
import {
  DeepThinkIcon,
  WebSearchIcon,
  SendIcon,
  IconPaperclip,
  IconFile,
  IconClose,
} from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import { GatewayFilePickerModal } from '../GatewayFilePickerModal/GatewayFilePickerModal';
import type { GatewayAttachedFile } from '../GatewayFilePickerModal/GatewayFilePickerModal';
import { estimateTokens, CONTEXT_WINDOW_TOKENS } from '@/components/GATEWAY/utils/tokenEstimator';

interface GatewayInputAreaProps {
  value: string;
  onChange: (val: string) => void;
  onSend: (files: GatewayAttachedFile[]) => void;
  disabled: boolean;
  sending: boolean;
  deepThinking: boolean;
  search: boolean;
  onToggleDeepThinking: () => void;
  onToggleSearch: () => void;
  /** Приблизительное количество токенов в текущем диалоге */
  contextUsedTokens?: number;
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
  contextUsedTokens = 0,
}) => {
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<GatewayAttachedFile[]>([]);

  // Универсальный ключ файла: для archive — resourceKey, для disk — path
  const fileKey = (f: GatewayAttachedFile): string =>
    f.kind === 'disk' ? (f.path || f.name) : (f.resourceKey || f.name);

  const handleSendClick = () => {
    if (disabled || sending || !value.trim()) return;
    onSend(selectedFiles);
    setSelectedFiles([]); // Очищаем чипы после отправки
  };

  const handleRemoveFile = (key: string) => {
    setSelectedFiles(prev => prev.filter(f => fileKey(f) !== key));
  };

  const contextPercent = Math.min(100, Math.round((contextUsedTokens / CONTEXT_WINDOW_TOKENS) * 100));
  const contextColor =
    contextPercent > 85 ? '#ff6b6b' :
    contextPercent > 60 ? '#ffd93d' :
    '#6bcb77';

  return (
    <div className="aaff8b8f">
      {/* Индикатор контекста */}
      {contextUsedTokens > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '0 12px 4px',
          fontSize: 11,
          color: '#888',
        }}>
          <div style={{
            width: 60,
            height: 4,
            background: '#333',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${contextPercent}%`,
              height: '100%',
              background: contextColor,
              transition: 'width 0.3s, background 0.3s',
            }} />
          </div>
          <span style={{ color: contextColor }}>
            {(contextUsedTokens / 1000).toFixed(1)}k / {(CONTEXT_WINDOW_TOKENS / 1000).toFixed(0)}k ({contextPercent}%)
          </span>
        </div>
      )}
      <div className="_77cefa5 _9996a53">
        <div className="_020ab5b">
          {/* Отрисовка выбранных файлов (чипы) — нативная структура PW */}
          {selectedFiles.length > 0 && (
            <div className="eafda4ae" style={{ padding: '0 12px 8px' }}>
              {selectedFiles.map(f => {
                const key = fileKey(f);
                return (
                  <div key={key} className="_25c7358 dafb6286" tabIndex={0}>
                    <div className="cd314545">
                      <div className="_1c3b90b">
                        <IconFile style={{ width: 28, height: 28 }} />
                      </div>
                      <div className="_158cea4">
                        <div className="_967f3f9">
                          <div className="e70accd6">{f.name}</div>
                        </div>
                      </div>
                      <div 
                        className="_8402d8c" 
                        tabIndex={0} 
                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(key); }}
                        title="Убрать из вложений"
                      >
                        <IconClose style={{ width: 14, height: 14 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                <div
                  className="ds-focus-ring"
                  style={{ '--dsl-focus-ring-offset': '-1px' } as React.CSSProperties}
                />
              </div>

              {/* Кнопка "Умный поиск" */}
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
                <div
                  className="ds-focus-ring"
                  style={{ '--dsl-focus-ring-offset': '-1px' } as React.CSSProperties}
                />
              </div>
            </div>

            <button
              type="button"
              className="gateway-attach-btn"
              onClick={() => setIsFilePickerOpen(true)}
              title="Прикрепить файл"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: 8,
              }}
            >
              <IconPaperclip />
            </button>

            {/* Кнопка отправки */}
            <div className="bf38813a">
              <div
                role="button"
                className="ds-button ds-button--primary ds-button--filled ds-button--circle ds-button--m ds-button--icon-relative-m"
                tabIndex={0}
                onClick={handleSendClick}
                style={
                  {
                    '--dsl-button-height': '34px',
                    pointerEvents:
                      disabled || !value.trim() || sending ? 'none' : 'auto',
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

      <GatewayFilePickerModal
        isOpen={isFilePickerOpen}
        onClose={() => setIsFilePickerOpen(false)}
        onSelect={(picked) => {
          // picked: GatewayAttachedFile[]
          setSelectedFiles(prev => {
            const existing = new Set(prev.map(fileKey));
            return [...prev, ...picked.filter(f => !existing.has(fileKey(f)))];
          });
        }}
      />
    </div>
  );
};