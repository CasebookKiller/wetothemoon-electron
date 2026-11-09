// src/components/GATEWAY/GatewayDialogLoadToast/GatewayDialogLoadToast.tsx

import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, CheckIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';

export interface DialogLoadInfo {
  convId: string;
  messagesTotal: number;
  filesTotal: number;
  filesLoaded: number;
  filesFailed: number;
}

interface GatewayDialogLoadToastProps {
  info: DialogLoadInfo | null;
  convTitle: string;
  onClose: () => void;
  onLoadRemaining?: (convId: string) => void;
  /** Прогресс batch, если идёт для этого же диалога */
  batchProgress?: { current: number; total: number; currentName?: string } | null;
}

const STORAGE_POS = 'gateway.dialogLoadToastPos';
const TOAST_WIDTH = 320;
const TOAST_HEIGHT_EST = 130;

const getStoredPos = (): { x: number; y: number } => {
  try {
    const raw = localStorage.getItem(STORAGE_POS);
    if (raw) {
      const p = JSON.parse(raw);
      if (
        typeof p?.x === 'number' &&
        typeof p?.y === 'number' &&
        p.x >= 0 &&
        p.y >= 0
      ) {
        return p;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    x: Math.max(20, window.innerWidth - TOAST_WIDTH - 20),
    y: Math.max(20, window.innerHeight - TOAST_HEIGHT_EST - 200),
  };
};

export const GatewayDialogLoadToast: React.FC<GatewayDialogLoadToastProps> = ({
  info,
  convTitle,
  onClose,
  onLoadRemaining,
  batchProgress,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => getStoredPos());
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = dragRef.current;
      if (!r) return;
      let x = e.clientX - r.offsetX;
      let y = e.clientY - r.offsetY;
      x = Math.max(0, Math.min(window.innerWidth - 100, x));
      y = Math.max(0, Math.min(window.innerHeight - 40, y));
      setPos({ x, y });
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(STORAGE_POS, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pos]);

  if (!info) return null;

  // Clamp: filesLoaded не может быть больше filesTotal (защита от дрейфа
  // инкрементального обновления или orphaned message_files).
  const filesLoaded = Math.min(info.filesLoaded, info.filesTotal);
  const filesFailed = Math.min(info.filesFailed, info.filesTotal);
  const pending = Math.max(0, info.filesTotal - filesLoaded - filesFailed);
  const allFilesLoaded = info.filesTotal > 0 && pending === 0;
  const noFiles = info.filesTotal === 0;

  return (
    <div
      className="gateway-dialog-load-toast"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
    >
      <div
        className="gateway-dialog-load-toast__header"
        onMouseDown={(e) => {
          dragRef.current = {
            offsetX: e.clientX - pos.x,
            offsetY: e.clientY - pos.y,
          };
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }}
      >
        <div className="gateway-dialog-load-toast__title">
          <span className="gateway-dialog-load-toast__title-icon">
            <CheckIcon size={14} />
          </span>
          Диалог загружен
        </div>
        <div
          role="button"
          className="gateway-dialog-load-toast__close"
          onClick={onClose}
          tabIndex={0}
          title="Закрыть"
        >
          <CloseIcon size={14} />
        </div>
      </div>

      <div
        className="gateway-dialog-load-toast__body"
        style={{ padding: '10px 12px 8px' }}
      >
        <div
          className="gateway-dialog-load-toast__name"
          title={convTitle}
          style={{ paddingTop: 2 }}
        >
          {convTitle}
        </div>
        <div className="gateway-dialog-load-toast__row">
          <span className="gateway-dialog-load-toast__label">Сообщений:</span>
          <span className="gateway-dialog-load-toast__value">
            {info.messagesTotal}
          </span>
        </div>
        <div className="gateway-dialog-load-toast__row">
          <span className="gateway-dialog-load-toast__label">Файлов:</span>
          <span className="gateway-dialog-load-toast__value">
            {noFiles ? '—' : `${filesLoaded}/${info.filesTotal}`}
            {!noFiles && filesFailed > 0 && (
              <span className="gateway-dialog-load-toast__failed">
                {' '}
                ({filesFailed} с ошибкой)
              </span>
            )}
            {allFilesLoaded && (
              <span className="gateway-dialog-load-toast__ok" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <AppIcon name="check" set="material" color="success" size={14} />
              </span>
            )}
          </span>
        </div>
        {batchProgress?.currentName && (
          <div
            className="gateway-dialog-load-toast__current"
            title={batchProgress.currentName}
          >
            Сейчас: {batchProgress.currentName}
          </div>
        )}
        {!batchProgress && pending > 0 && (
          <div className="gateway-dialog-load-toast__pending-hint">
            Осталось: {pending}
          </div>
        )}
      </div>

      <div className="gateway-dialog-load-toast__actions">
        {batchProgress && batchProgress.total > 0 ? (
          <div className="gateway-dialog-load-toast__action gateway-dialog-load-toast__action--loading">
            <AppIcon name="hourglass_top" set="material" spin /> Загрузка {batchProgress.current}/{batchProgress.total}…
          </div>
        ) : pending > 0 && onLoadRemaining ? (
          <div
            role="button"
            className="gateway-dialog-load-toast__action gateway-dialog-load-toast__action--primary"
            onClick={() => onLoadRemaining(info.convId)}
            tabIndex={0}
          >
            Загрузить оставшиеся ({pending})
          </div>
        ) : null}
        <div
          role="button"
          className="gateway-dialog-load-toast__action"
          onClick={onClose}
          tabIndex={0}
        >
          Закрыть
        </div>
      </div>
    </div>
  );
};

export default GatewayDialogLoadToast;