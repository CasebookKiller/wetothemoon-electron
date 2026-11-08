// src/components/GATEWAY/GatewayFileViewerModal/GatewayFileViewerModal.tsx

import React, { useEffect, useState } from 'react';
import { CloseIcon, CopyIcon, CheckIcon, FileIcon, ImageIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';

export interface FileViewerBlock {
  /**
   * Тип блока из GatewayUserBlock (совместим структурно).
   * onFileClick вызывается только для type='file', но для структурной
   * совместимости с GatewayUserBlock держим полный union.
   */
  type: 'text' | 'code' | 'file';
  content: string;
  mime?: string;
  size?: string;
  fileKind?: 'text' | 'image' | 'binary';
  fileId?: string;
  thumbUrl?: string;
  language?: string;
}

export interface FileViewerState {
  visible: boolean;
  block: FileViewerBlock | null;
  conversationId: string | null;
  messageHash: string | null;
  pwKey: string | null;
  chipIndex: number | null;
}

interface GatewayFileViewerModalProps {
  state: FileViewerState | null;
  onClose: () => void;
  onLoaded?: (messageHash: string, chipIndex: number) => void;
}

export const GatewayFileViewerModal: React.FC<GatewayFileViewerModalProps> = ({
  state,
  onClose,
  onLoaded,
}) => {
  const api = (window as any).electronAPI;
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [waitMs, setWaitMs] = useState(0);

  useEffect(() => {
    if (!state?.visible) return;

    // Сохраняем в локальные переменные — TS сужает их в async closure.
    const block = state.block;
    const conversationId = state.conversationId;
    const messageHash = state.messageHash;
    const pwKey = state.pwKey;
    const chipIndex = state.chipIndex;

    if (
      !block ||
      !conversationId ||
      !messageHash ||
      chipIndex === null
    ) {
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
        // 1. Из кеша
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

        // 2. Из PW (PoW 20–30с)
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

        // 3. Сохраняем в БД — не блокирует UI
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
            console.warn('[file-viewer] save failed:', e.message);
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

  useEffect(() => {
    if (!state?.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.visible, loading, onClose]);

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
    <div
      className="gateway-file-viewer-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="gateway-file-viewer-modal__content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gateway-file-viewer-modal__header">
          <div className="gateway-file-viewer-modal__title-wrap">
            <div className="gateway-file-viewer-modal__icon">
              {fileKind === 'image' ? <ImageIcon size={20} /> : <FileIcon size={20} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="gateway-file-viewer-modal__title"
                title={block.content}
              >
                {block.content}
              </div>
              <div className="gateway-file-viewer-modal__meta">
                {[block.mime, block.size].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div
            role="button"
            className="gateway-file-viewer-modal__close"
            onClick={() => !loading && onClose()}
            tabIndex={0}
          >
            <CloseIcon size={16} />
          </div>
        </div>

        <div className="gateway-file-viewer-modal__body">
          {loading && (
            <div className="gateway-file-viewer-modal__loading">
              <div className="gateway-file-viewer-modal__spinner" />
              <div>Загрузка файла…</div>
              <div className="gateway-file-viewer-modal__hint">
                PoW может занять 20–30 секунд
                {secs > 0 ? ` (${secs}с)` : ''}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="gateway-file-viewer-modal__error">
              Ошибка: {error}
            </div>
          )}

          {!loading && !error && content !== null && fileKind === 'text' && (
            <pre className="gateway-file-viewer-modal__pre">{content}</pre>
          )}

          {!loading && !error && content !== null && fileKind === 'image' && (
            <img
              className="gateway-file-viewer-modal__image"
              src={`data:${imageMime};base64,${content}`}
              alt={block.content}
            />
          )}

          {!loading && !error && content !== null && fileKind === 'binary' && (
            <div className="gateway-file-viewer-modal__binary">
              <div>Бинарный файл — предпросмотр пока не поддерживается.</div>
              <div className="gateway-file-viewer-modal__binary-hint">
                {block.mime || 'unknown'} · {block.size || '?'}
              </div>
            </div>
          )}
        </div>

        <div className="gateway-file-viewer-modal__actions">
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
          <div
            role="button"
            className="ds-button ds-button--primary ds-button--filled ds-button--capsule ds-button--m"
            tabIndex={0}
            onClick={() => !loading && onClose()}
            style={{
              pointerEvents: loading ? 'none' : 'auto',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <span className="ds-button__content">Закрыть</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GatewayFileViewerModal;