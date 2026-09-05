// src/components/GATEWAY/GatewayMessageAssistant/GatewayMessageAssistant.tsx

import React, { useState } from 'react';
import {
  CopyIcon,
  RepeatIcon,
  LikeIcon,
  DislikeIcon,
  ShareIcon,
  BrainIcon,
  ChevronIcon,
  CheckIcon,
} from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import { classNames } from '@/css/classnames';

interface GatewayMessageAssistantProps {
  thinking?: string;
  blocks: { type: 'text' | 'code'; content: string; language?: string }[];
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isLast?: boolean;
  onCopy?: (text: string) => void;
  onRegenerate?: () => void;
  onFeedback?: (type: 'like' | 'dislike') => void;
  onShare?: () => void;
}

export const GatewayMessageAssistant: React.FC<GatewayMessageAssistantProps> = ({
  thinking,
  blocks,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
  isLast = false,
  onCopy,
  onRegenerate,
  onFeedback,
  onShare,
}) => {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const handleCopy = () => {
    if (onCopy) {
      const text = blocks.map((b) => b.content).join('\n');
      onCopy(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    if (disliked) setDisliked(false);
    if (onFeedback) onFeedback('like');
  };

  const handleDislike = () => {
    setDisliked(!disliked);
    if (liked) setLiked(false);
    if (onFeedback) onFeedback('dislike');
  };

  const actionsStyle: React.CSSProperties = {
    visibility: selectMode ? 'hidden' : isLast || hovered ? 'visible' : 'hidden',
    opacity: selectMode ? 0 : isLast || hovered ? 1 : 0,
    transition: 'opacity 0.01s ease, visibility 0.01s ease',
    pointerEvents: selectMode ? 'none' : 'auto',
  };

  return (
    <div
      className={classNames({
        _4f9bf79: true,
        d7dc56a8: true,
        _43c05b5: true,
      })}
      data-virtual-list-item-key="assistant"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Чекбокс выбора */}
      {selectMode && (
        <div className={classNames({ d30139ff: true })}>
          <div className={classNames({ ad950ab7: true })}>
            <div
              className={classNames({ 'ds-checkbox-align-wrapper': true })}
              style={{
                alignSelf: 'flex-start',
                '--dsl-checkbox-line-height': 'unset',
              } as React.CSSProperties}
            >
              <div
                className={classNames({
                  'ds-checkbox': true,
                  'ds-checkbox--l': true,
                  'ds-checkbox--active': isSelected,
                  'ds-checkbox--none': true,
                })}
                tabIndex={0}
                onMouseDown={onToggleSelect}
              >
                <CheckIcon size={14} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Сообщение */}
      <div
        className={classNames({
          'ds-message': true,
          _63c77b1: true,
          _6e8caf5: isSelected,
          _7729a77: isSelected,
        })}
        style={isSelected ? { backgroundColor: 'transparent', background: 'transparent' } : undefined}
      >
        {/* Размышление */}
        {thinking && (
          <div
            className={classNames({ _74c0879: true })}
            style={
              isSelected
                ? {
                    backgroundColor: 'transparent',
                    background: 'transparent',
                    boxShadow: 'none',
                    transition: 'none',
                  }
                : undefined
            }
          >
            <div
              className={classNames({
                _245c867: true,
                _34a54ec: false,
              })}
              role="button"
              tabIndex={0}
              onClick={() => setThinkingExpanded((prev) => !prev)}
              style={
                isSelected
                  ? {
                      backgroundColor: 'transparent',
                      background: 'transparent',
                      boxShadow: 'none',
                      transition: 'none',
                    }
                  : undefined
              }
            >
              <div className={classNames({ _5ab5d64: true })}>
                <div
                  className={classNames({
                    'ds-icon': true,
                    _970ac5e: true,
                  })}
                  style={{ fontSize: 16, width: 16, height: 16 }}
                >
                  <BrainIcon size={16} />
                </div>
                <span className={classNames({ _5255ff8: false, _4d41763: true })}>
                  Размышление
                </span>
                <div className={classNames({ 'ds-icon': true })} style={{ fontSize: 14, width: 14, height: 14 }}>
                  <ChevronIcon size={14} expanded={thinkingExpanded} />
                </div>
              </div>
            </div>

            {thinkingExpanded && (
              <div
                className={classNames({ 
                  e1675d8b: true, 
                  'ds-think-content': true, 
                  _767406f: true
                })}
              >
                <div
                  className={classNames({ 
                    ddd26891: true,
                    _9b52f6c: true
                  })}
                  style={{ width: 16, height: 16 }}
                >
                  <div className={classNames({
                    a510c7ce: true,
                    _0652043: true
                  })} />
                </div>
                <div className={classNames({
                  _9ecc93a: true
                })} />
                <div className={classNames({
                  'ds-markdown': true,
                  'pointer-events-none': selectMode
                })}>
                  <p className={classNames({
                    'ds-markdown-paragraph': true
                  })}>{thinking}</p>
                </div>
              </div>
            )}

            <div className={classNames({
              c2b72bb8: true
            })} />
          </div>
        )}

        {/* Основной контент */}
        <div
          className={classNames({
            'ds-markdown': true,
            'ds-assistant-message-main-content': true,
            'pointer-events-none': selectMode,
          })}
        >
          {blocks.map((block, idx) => {
            if (block.type === 'code') {
              return (
                <div className={classNames({ 'md-code-block': true, 'md-code-block-dark': true })} key={idx}>
                  <pre>
                    <code className={`language-${block.language || 'text'}`}>{block.content}</code>
                  </pre>
                </div>
              );
            }
            return (
              <p className={classNames({ 'ds-markdown-paragraph': true })} key={idx}>
                {block.content}
              </p>
            );
          })}
        </div>
      </div>

      {/* Панель кнопок */}
      <div
        className={classNames({ 'ds-flex': true, _0a3d93b: true })}
        style={{
          ...actionsStyle,
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap-reverse',
        }}
      >
        <div className={classNames({ 'ds-flex': true, _965abe9: true, _54866f7: true })} style={{ alignItems: 'center', gap: 10 }}>
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

          {/* Кнопка повторной генерации */}
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
            onClick={onRegenerate}
          >
            <div className={classNames({ 'ds-button__background': true })} />
            <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
              <RepeatIcon size={16} />
            </div>
          </div>

          {/* Кнопка лайка */}
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
            onClick={handleLike}
            style={{ color: liked ? 'var(--dsw-alias-brand-primary)' : undefined }}
          >
            <div className={classNames({ 'ds-button__background': true })} />
            <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
              <LikeIcon size={16} />
            </div>
          </div>

          {/* Кнопка дизлайка */}
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
            onClick={handleDislike}
            style={{ color: disliked ? 'var(--dsw-alias-brand-primary)' : undefined }}
          >
            <div className={classNames({ 'ds-button__background': true })} />
            <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
              <DislikeIcon size={16} />
            </div>
          </div>

          {/* Кнопка "Поделиться" */}
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
            onClick={onShare}
          >
            <div className={classNames({ 'ds-button__background': true })} />
            <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
              <ShareIcon size={16} />
            </div>
          </div>
        </div>
        <div style={{ flex: '1 1 0%' }} />
      </div>
    </div>
  );
};