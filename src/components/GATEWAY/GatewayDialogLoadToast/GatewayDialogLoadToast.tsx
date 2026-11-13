// src/components/GATEWAY/GatewayDialogLoadToast/GatewayDialogLoadToast.tsx

import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, CheckIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';
import AppIcon from '@/components/COMMON/AppIcon/AppIcon';
import type { ScrollProgressMeta } from '@/main/services/gateway/bridge/BridgeEvents';

export interface DialogLoadInfo {
  convId: string;
  messagesTotal: number;
  filesTotal: number;
  filesLoaded: number;
  filesFailed: number;
  progress?: ScrollProgressMeta;
  finalElapsedMs?: number;
}

interface GatewayDialogLoadToastProps {
  info: DialogLoadInfo | null;
  convTitle: string;
  onClose: () => void;
  onLoadRemaining?: (convId: string) => void;
  batchProgress?: { current: number; total: number; currentName?: string } | null;
  onCancelTraverse?: () => void;
  onForceResync?: () => void;
}

const STORAGE_POS = 'gateway.dialogLoadToastPos';
const TOAST_WIDTH = 320;
const TOAST_HEIGHT_EST = 160;

const getStoredPos = (): { x: number; y: number } => {
  try {
    const raw = localStorage.getItem(STORAGE_POS);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p?.x === 'number' && typeof p?.y === 'number' && p.x >= 0 && p.y >= 0) {
        return p;
      }
    }
  } catch { /* ignore */ }
  return {
    x: Math.max(20, window.innerWidth - TOAST_WIDTH - 20),
    y: Math.max(20, window.innerHeight - TOAST_HEIGHT_EST - 200),
  };
};

const PHASE_LABEL: Record<ScrollProgressMeta['phase'], string> = {
  'bottom-up': 'снизу вверх',
  'top-down': 'сверху вниз',
  final: 'финальный проход',
  gaps: 'проход по дыркам',
  traverse: 'обход веток',
  verify: 'проверка состояния',
};

const DIRECTION_ICON: Record<ScrollProgressMeta['direction'], string> = {
  up: '↑', down: '↓', bidir: '⇅',
};

const formatProgress = (p: ScrollProgressMeta): string => {
  const icon = DIRECTION_ICON[p.direction];
  const sec = Math.round(p.elapsedMs / 1000);
  const parts: string[] = [`${icon} ${PHASE_LABEL[p.phase]} · ${sec}с`];
  parts.push(`${p.collectedCount} сообщ.`);
  if (p.branchTotal > 0) parts.push(`ветки ${p.branchDone}/${p.branchTotal}`);
  if (p.totalPasses > 1) parts.push(`pass ${p.pass + 1}/${p.totalPasses}`);
  return parts.join(' · ');
};

export const GatewayDialogLoadToast: React.FC<GatewayDialogLoadToastProps> = ({
  info,
  convTitle,
  onClose,
  onLoadRemaining,
  batchProgress,
  onCancelTraverse,
  onForceResync,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => getStoredPos());
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [copied, setCopied] = useState(false);

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
      try { localStorage.setItem(STORAGE_POS, JSON.stringify(pos)); } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pos]);

  if (!info) return null;

  const filesLoaded = Math.min(info.filesLoaded, info.filesTotal);
  const filesFailed = Math.min(info.filesFailed, info.filesTotal);
  const pending = Math.max(0, info.filesTotal - filesLoaded - filesFailed);
  const allFilesLoaded = info.filesTotal > 0 && pending === 0;
  const noFiles = info.filesTotal === 0;

  const progress = info.progress;
  const canCancel = !!progress && typeof onCancelTraverse === 'function';
  const canResync = typeof onForceResync === 'function';

  const handleCopyLog = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[toast] copy failed:', e);
    }
  };

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
            {progress ? (
              <AppIcon name="hourglass_top" set="material" spin size={14} />
            ) : (
              <CheckIcon size={14} />
            )}
          </span>
          {progress ? 'Загрузка диалога' : 'Диалог загружен'}
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

      <div className="gateway-dialog-load-toast__body" style={{ padding: '10px 12px 8px' }}>
        <div className="gateway-dialog-load-toast__name" title={convTitle} style={{ paddingTop: 2 }}>
          {convTitle}
        </div>

        {/* Прогресс (только во время загрузки) */}
        {progress && (
          <div
            className="gateway-dialog-load-toast__progress"
            style={{
              fontSize: 12,
              color: 'var(--dsw-alias-label-secondary, #999)',
              padding: '4px 0 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span>{formatProgress(progress)}</span>
            {progress.currentPwKey && (
              <span style={{ fontSize: 11, opacity: 0.75, fontFamily: 'monospace' }}>
                #{progress.currentPwKey}
              </span>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={onCancelTraverse}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  fontSize: 11,
                  background: 'transparent',
                  border: '1px solid var(--dsw-alias-border-l3, #444)',
                  borderRadius: 4,
                  color: 'var(--dsw-alias-label-primary, #eee)',
                  cursor: 'pointer',
                }}
                title="Прервать текущий проход, оставить как есть"
              >
                Не ждать
              </button>
            )}
          </div>
        )}

        {/* Итоговое время (только после загрузки) */}
        {!progress && info.finalElapsedMs != null && info.finalElapsedMs > 0 && (
          <div
            className="gateway-dialog-load-toast__progress"
            style={{
              fontSize: 12,
              color: 'var(--dsw-alias-label-secondary, #999)',
              padding: '4px 0 6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <AppIcon name="check" set="material" color="success" size={12} />
            Загружено за {Math.round(info.finalElapsedMs / 1000)}с
          </div>
        )}

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
                {' '}({filesFailed} с ошибкой)
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
          <div className="gateway-dialog-load-toast__current" title={batchProgress.currentName}>
            Сейчас: {batchProgress.currentName}
          </div>
        )}
        {!batchProgress && pending > 0 && (
          <div className="gateway-dialog-load-toast__pending-hint">
            Осталось: {pending}
          </div>
        )}
      </div>

      <div className="gateway-dialog-load-toast__actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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

        {canResync && (
          <div
            role="button"
            className="gateway-dialog-load-toast__action"
            onClick={() => { if (!progress) onForceResync?.(); }}
            tabIndex={0}
            title={
              progress
                ? 'Идёт загрузка — дождитесь или нажмите «Не ждать»'
                : 'Принудительная синхронизация (Ctrl+Alt+R)'
            }
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              opacity: progress ? 0.4 : 1,
              cursor: progress ? 'not-allowed' : 'pointer',
              pointerEvents: progress ? 'none' : 'auto',
            }}
          >
            <AppIcon name="sync" set="material" size={14} />
            Синхронизировать
          </div>
        )}
        <div
          role="button"
          className="gateway-dialog-load-toast__action"
          onClick={handleCopyLog}
          tabIndex={0}
          title="Скопировать лог в JSON"
          style={{
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {copied ? (
            <>
              <AppIcon name="check" set="material" color="success" size={14} />
              Скопировано
            </>
          ) : (
            <>
              <AppIcon name="content_copy" set="material" size={14} />
              JSON
            </>
          )}
        </div>
        <div
          role="button"
          className="gateway-dialog-load-toast__action"
          onClick={onClose}
          tabIndex={0}
          style={{ flex: '0 0 auto' }}
        >
          Закрыть
        </div>
      </div>
    </div>
  );
};

export default GatewayDialogLoadToast;