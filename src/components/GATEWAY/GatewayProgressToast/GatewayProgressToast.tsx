// src/components/GATEWAY/GatewayProgressToast/GatewayProgressToast.tsx

import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';

export type BatchUIStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface BatchUIState {
  convId: string;
  total: number;
  processed: number;
  ok: number;
  failed: number;
  currentName?: string;
  currentChipIndex?: number;
  status: BatchUIStatus;
  cancelled: boolean;
  lastError?: string;
}

interface GatewayProgressToastProps {
  state: BatchUIState | null;
  onCancel: () => void;
  onDismiss: () => void;
}

const STORAGE_POS = 'gateway.progressToastPos';
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
  // Дефолт: правый нижний угол
  return {
    x: Math.max(20, window.innerWidth - TOAST_WIDTH - 20),
    y: Math.max(20, window.innerHeight - TOAST_HEIGHT_EST - 80),
  };
};

export const GatewayProgressToast: React.FC<GatewayProgressToastProps> = ({
  state,
  onCancel,
  onDismiss,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => getStoredPos());
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Автоскрытие через 3с после завершения
  useEffect(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    if (
      state &&
      (state.status === 'completed' ||
        state.status === 'failed' ||
        state.status === 'cancelled')
    ) {
      autoDismissTimer.current = setTimeout(() => {
        onDismiss();
      }, 3000);
    }
    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
      }
    };
  }, [state?.status, onDismiss]);

  // Drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = dragRef.current;
      if (!r) return;
      let x = e.clientX - r.offsetX;
      let y = e.clientY - r.offsetY;
      // Ограничения, чтобы не улетел за экран
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

  if (!state) return null;

  const progressPct =
    state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;
  const isRunning = state.status === 'running';

  const statusLabel = (() => {
    switch (state.status) {
      case 'running':
        return 'Загрузка файлов';
      case 'completed':
        return 'Готово';
      case 'failed':
        return 'Ошибка';
      case 'cancelled':
        return 'Отменено';
    }
  })();

  return (
    <div
      className="gateway-progress-toast"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
    >
      <div
        className="gateway-progress-toast__header"
        onMouseDown={(e) => {
          dragRef.current = {
            offsetX: e.clientX - pos.x,
            offsetY: e.clientY - pos.y,
          };
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }}
      >
        <div className="gateway-progress-toast__title">
          {statusLabel}: {state.processed}/{state.total}
          {state.failed > 0 && (
            <span className="gateway-progress-toast__failed"> · {state.failed} с ошибкой</span>
          )}
        </div>
        <div
          role="button"
          className="gateway-progress-toast__close"
          onClick={onDismiss}
          tabIndex={0}
          title="Скрыть"
        >
          <CloseIcon size={14} />
        </div>
      </div>

      <div
        className="gateway-progress-toast__body"
        style={{ padding: '10px 12px 8px' }}
      >
        {isRunning && state.currentName && (
          <div className="gateway-progress-toast__current" title={state.currentName}>
            {state.currentName}
          </div>
        )}
        {!isRunning && state.lastError && (
          <div className="gateway-progress-toast__error">
            {state.lastError}
          </div>
        )}
        <div className="gateway-progress-toast__bar">
          <div
            className="gateway-progress-toast__bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {isRunning && (
        <div className="gateway-progress-toast__actions">
          <div
            role="button"
            className="gateway-progress-toast__cancel"
            onClick={onCancel}
            tabIndex={0}
          >
            Отмена
          </div>
        </div>
      )}
    </div>
  );
};

export default GatewayProgressToast;