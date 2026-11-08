// src/components/GATEWAY/GatewayFilePanel/GatewayFilePanel.tsx

import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, CopyIcon, CheckIcon, FileIcon, ImageIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';

export interface FilePanelBlock {
  type: 'text' | 'code' | 'file';
  content: string;
  mime?: string;
  size?: string;
  fileKind?: 'text' | 'image' | 'binary';
  fileId?: string;
  thumbUrl?: string;
  language?: string;
}

export interface FilePanelState {
  visible: boolean;
  block: FilePanelBlock | null;
  conversationId: string | null;
  messageHash: string | null;
  pwKey: string | null;
  chipIndex: number | null;
}

interface GatewayFilePanelProps {
  state: FilePanelState | null;
  onClose: () => void;
  onLoaded?: (messageHash: string, chipIndex: number) => void;
  width: number;
  onWidthChange: (w: number) => void;
  minWidth?: number;
}

const STORAGE_KEY = 'gateway.filePanelWidth';
const DEFAULT_WIDTH = 627;
const MIN_WIDTH = 380;

export const getStoredPanelWidth = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= MIN_WIDTH) return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDTH;
};

export const savePanelWidth = (w: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(w));
  } catch {
    /* ignore */
  }
};

export const GatewayFilePanel: React.FC<GatewayFilePanelProps> = ({
  state,
  onClose,
  onLoaded,
  width,
  onWidthChange,
  minWidth = MIN_WIDTH,
}) => {
  const api = (window as any).electronAPI;
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [waitMs, setWaitMs] = useState(0);
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // ── Загрузка содержимого ──
  useEffect(() => {
    if (!state?.visible) return;

    const block = state.block;
    const conversationId = state.conversationId;
    const messageHash = state.messageHash;
    const pwKey = state.pwKey;
    const chipIndex = state.chipIndex;

    if (!block || !conversationId || !messageHash || chipIndex === null) {
      setError('Некорректные параметры файла');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      setLoading(true);
      setContent(null);
      setError(null);
      setWaitMs(0);

      const started = Date.now();
      timer = setInterval(() => {
        if (!cancelled) setWaitMs(Date.now() - started);
      }, 1000);

      try {
        const cached = await api.gatewayFileContent(
          conversationId,
          messageHash,
          chipIndex
        );
        if (cancelled) return;
        if (cached.success && cached.data) {
          setContent(cached.data.content);
          onLoaded?.(messageHash, chipIndex);
          return;
        }

        const fetched = await api.gatewayFileFetch(
          conversationId,
          pwKey,
          block.content,
          chipIndex
        );
        if (cancelled) return;
        if (!fetched.success || !fetched.data) {
          throw new Error(fetched.error || 'Не удалось загрузить файл');
        }

        const { name, content: fetchedContent, fileId } = fetched.data;
        setContent(fetchedContent);
        onLoaded?.(messageHash, chipIndex);

        api
          .gatewayFileSave({
            conversationId,
            messageHash,
            chipIndex,
            name,
            mime: block.mime,
            sizeDisplay: block.size,
            fileKind: block.fileKind || 'text',
            fileId,
            content: fetchedContent,
          })
          .catch((e: Error) => {
            console.warn('[file-panel] save failed:', e.message);
          });
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        api
          .gatewayFileMarkFailed(
            conversationId,
            messageHash,
            chipIndex,
            (e as Error).message
          )
          .catch(() => {});
      } finally {
        if (timer) clearInterval(timer);
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.visible, state?.messageHash, state?.chipIndex]);

  // 5.8.2 (v2): auto-hide scrollbar.
  // Проблема: при открытии панели Chromium успевает отрисовать дефолтный
  // scrollbar ДО применения CSS-правил, и он "залипает". А при загрузке
  // контента Chromium иногда фаерит scroll-event, заставляя isScrolling
  // залипнуть в true на 1с.
  // Фикс: сбрасываем флаг при каждом изменении content и игнорируем scroll
  // в первые 300мс после смены content.
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentChangeRef = useRef<number>(0);

  // Reset на открытие панели
  useEffect(() => {
    if (!state?.visible) {
      setIsScrolling(false);
      lastContentChangeRef.current = Date.now();
    }
  }, [state?.visible]);

  // Reset на приход контента
  useEffect(() => {
    setIsScrolling(false);
    lastContentChangeRef.current = Date.now();
  }, [content]);

  const handleBodyScroll = () => {
    // Игнорируем «автоматический» scroll после вставки контента
    if (Date.now() - lastContentChangeRef.current < 300) return;
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
      scrollTimerRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  // ── Esc ──
  useEffect(() => {
    if (!state?.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.visible, loading, onClose]);

  // ── Resize ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const delta = r.startX - e.clientX; // тащим влево → панель шире
      let next = r.startWidth + delta;
      const maxW = Math.floor(window.innerWidth * 0.85);
      if (next < minWidth) next = minWidth;
      if (next > maxW) next = maxW;
      onWidthChange(next);
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      savePanelWidth(width);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [width, onWidthChange, minWidth]);

  if (!state?.visible || !state.block || state.block.type !== 'file') return null;
  const block = state.block;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileKind = block.fileKind || 'text';
  const secs = Math.floor(waitMs / 1000);
  const imageMime =
    (block.mime || 'PNG').toLowerCase() === 'jpg'
      ? 'image/jpeg'
      : `image/${(block.mime || 'png').toLowerCase()}`;

  return (
    <>
      <style>{`
        .gateway-file-panel__body::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .gateway-file-panel__body::-webkit-scrollbar-track {
          background: transparent !important;
        }
        /* 5.8.2 (v2): thumb полностью прозрачен, пока не hover/scroll */
        .gateway-file-panel__body::-webkit-scrollbar-thumb {
          background-color: transparent !important;
          border-radius: 4px;
        }
        .gateway-file-panel-wrapper:hover .gateway-file-panel__body::-webkit-scrollbar-thumb,
        .gateway-file-panel__body.is-scrolling::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.15) !important;
        }
        .gateway-file-panel__body.is-scrolling::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.25) !important;
        }
      `}</style>
    <div
      className="gateway-file-panel-wrapper"
      style={{ width, flexShrink: 0 }}
    >
      {/* Resize handle — абсолютный, свисает слева от панели */}
      <div
        className="gateway-file-panel__handle"
        onMouseDown={(e) => {
          resizingRef.current = { startX: e.clientX, startWidth: width };
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        role="separator"
        aria-orientation="vertical"
        title="Перетащите, чтобы изменить ширину"
      >
        <div className="gateway-file-panel__handle-grip" />
      </div>

      <div className="gateway-file-panel">
        <div className="gateway-file-panel__header">
          <div className="gateway-file-panel__title-wrap">
            <div className="gateway-file-panel__icon">
              {fileKind === 'image' ? <ImageIcon size={20} /> : <FileIcon size={20} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="gateway-file-panel__title" title={block.content}>
                {block.content}
              </div>
              <div className="gateway-file-panel__meta">
                {[block.mime, block.size].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div
            role="button"
            className="gateway-file-panel__close"
            onClick={() => !loading && onClose()}
            tabIndex={0}
          >
            <CloseIcon size={16} />
          </div>
        </div>

        <div
          className={
            'gateway-file-panel__body' + (isScrolling ? ' is-scrolling' : '')
          }
          onScroll={handleBodyScroll}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 0,
            // ⚠ НЕ ставить scrollbarWidth/scrollbarColor: в Chromium
            // они отключают ::-webkit-scrollbar-* и браузер рисует
            // всегда видимый дефолтный тонкий скроллбар.
          }}
        >
          {loading && (
            <div className="gateway-file-panel__loading">
              <div className="gateway-file-panel__spinner" />
              <div>Загрузка файла…</div>
              <div className="gateway-file-panel__hint">
                PoW может занять 20–30 секунд
                {secs > 0 ? ` (${secs}с)` : ''}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="gateway-file-panel__error">Ошибка: {error}</div>
          )}

          {!loading && !error && content !== null && fileKind === 'text' && (
            <div className="gateway-file-panel__content">{content}</div>
          )}

          {!loading && !error && content !== null && fileKind === 'image' && (
            <img
              className="gateway-file-panel__image"
              src={`data:${imageMime};base64,${content}`}
              alt={block.content}
            />
          )}

          {!loading && !error && content !== null && fileKind === 'binary' && (
            <div className="gateway-file-panel__binary">
              <div>Бинарный файл — предпросмотр пока не поддерживается.</div>
              <div className="gateway-file-panel__binary-hint">
                {block.mime || 'unknown'} · {block.size || '?'}
              </div>
            </div>
          )}
        </div>

        <div className="gateway-file-panel__footer">
          {!loading && !error && content !== null && fileKind === 'text' && (
            <div
              role="button"
              className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m"
              tabIndex={0}
              onClick={handleCopy}
            >
              <span className="ds-button__content">
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                {' '}
                {copied ? 'Скопировано' : 'Скопировать'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default GatewayFilePanel;