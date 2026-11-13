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
import { renderMarkdown } from '@/components/GATEWAY/utils/markdownRenderer';

interface GatewayMessageAssistantProps {
  thinking?: string;
  blocks: Array<{ type: 'text' | 'code' | 'file'; content: string; language?: string }>;
  fullHtml?: string;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isLast?: boolean;
  onCopy?: (text: string) => void;
  onRegenerate?: () => void;
  onFeedback?: (type: 'like' | 'dislike') => void;
  onShare?: () => void;
  // 5.7: branching (наследуется бэкендом, но в UI не рендерится)
  branchTotal?: number;
  branchIndex?: number;
  onBranchSwitch?: (direction: 'prev' | 'next') => void;
}

export const GatewayMessageAssistant: React.FC<GatewayMessageAssistantProps> = ({
  thinking,
  blocks,
  fullHtml,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
  isLast = false,
  onCopy,
  onRegenerate,
  onFeedback,
  onShare,
  branchTotal,
  branchIndex,
  onBranchSwitch,
}) => {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  // 5.8.3: если fullHtml из PW — используем как есть. Но в двух случаях
  // он «битый», и тогда мы рендерим markdown через Prism:
  //   1) сломанная таблица: осталась как текст с |---|
  //   2) неподсвеченный код: есть <code language-X>, но нет token-классов
  const renderedHtml = React.useMemo(() => {
    const md = (blocks || [])
      .filter((b) => b.type === 'text' || b.type === 'code')
      .map((b) =>
        b.type === 'code'
          ? '```' + (b.language || '') + '\n' + b.content + '\n```'
          : b.content
      )
      .join('\n\n');

    if (fullHtml) {
      const hasBrokenTable =
        /<br>\|\s*[-:]+\s*\|/.test(fullHtml) ||
        fullHtml.includes('|---|');
      const hasUnhighlightedCode =
        /<pre><code class="language-[^"]+">/.test(fullHtml) &&
        !fullHtml.includes('class="token');
      if (!hasBrokenTable && !hasUnhighlightedCode) {
        return fullHtml;
      }
    }

    return md ? renderMarkdown(md) : '';
  }, [fullHtml, blocks]);


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

  const hasBranch = branchTotal != null && branchTotal > 1;
  const actionsStyle: React.CSSProperties = {
    visibility: selectMode ? 'hidden' : hasBranch || isLast || hovered ? 'visible' : 'hidden',
    opacity: selectMode ? 0 : hasBranch || isLast || hovered ? 1 : 0,
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
        {/* 5.8.3: fullHtml — из PW DOM (идеал), иначе — markdown+Prism */}
        <div
          className={classNames({
            'ds-markdown': true,
            'ds-assistant-message-main-content': true,
            'pointer-events-none': selectMode,
          })}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
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
        {branchTotal != null && branchTotal > 1 && (
          <div
            className={classNames({ 'ds-flex': true, _965abe9: true, _54866f7: true })}
            style={{ alignItems: 'center', gap: 4 }}
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
              })}
              tabIndex={0}
              onClick={() => {
                if (branchIndex != null && branchIndex > 1) onBranchSwitch?.('prev');
              }}
              style={{ opacity: branchIndex === 1 ? 0.35 : 1 }}
              aria-label="Предыдущая ветка"
            >
              <div className={classNames({ 'ds-button__background': true })} />
              <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
                <div style={{ transform: 'rotate(-90deg)', display: 'flex' }}>
                  <ChevronIcon size={14} expanded={true} />
                </div>
              </div>
            </div>
            <span
              className="dd7e4fda"
              style={{
                fontSize: 12,
                color: 'var(--dsw-alias-label-secondary, #999)',
                minWidth: 28,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {branchIndex} / {branchTotal}
            </span>
            <div
              role="button"
              className={classNames({
                'ds-button': true,
                'ds-button--iconLabelTertiary': true,
                'ds-button--icon': true,
                'ds-button--capsule': true,
                'ds-button--xs': true,
                'ds-button--icon-relative-l': true,
              })}
              tabIndex={0}
              onClick={() => {
                if (branchIndex != null && branchTotal != null && branchIndex < branchTotal) {
                  onBranchSwitch?.('next');
                }
              }}
              style={{ opacity: branchIndex === branchTotal ? 0.35 : 1 }}
              aria-label="Следующая ветка"
            >
              <div className={classNames({ 'ds-button__background': true })} />
              <div className={classNames({ 'ds-button__icon': true, 'ds-button__icon--last-child': true })}>
                <div style={{ transform: 'rotate(90deg)', display: 'flex' }}>
                  <ChevronIcon size={14} expanded={true} />
                </div>
              </div>
            </div>
          </div>
        )}

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
            style={{ color: disliked ? 'var(--ds-alias-brand-primary)' : undefined }}
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