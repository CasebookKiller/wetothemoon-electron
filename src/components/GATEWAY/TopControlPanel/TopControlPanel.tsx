// src/components/GATEWAY/TopControlPanel/TopControlPanel.tsx

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';

interface TopControlPanelProps {
  status: string;
  isLoggedIn: boolean;
  error: string;
  loading: boolean;
  sending: boolean;
  onLaunch: () => void;
  onClose: () => void;
  onRefreshConversations: () => void;
  onSelectModel: (model: 'default' | 'expert' | 'vision') => void;
  onToggleDeepThinking: (value: boolean) => void;
  onToggleSearch: (value: boolean) => void;
  modelType: 'default' | 'expert' | 'vision';
  deepThinking: boolean;
  search: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onPanelMouseEnter: () => void;
  onPanelMouseLeave: () => void;
}

export const TopControlPanel: React.FC<TopControlPanelProps> = (props) => {
    // Горячая клавиша Ctrl+`
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Backquote') {
        e.preventDefault();
        props.isOpen ? props.onClose() : props.onOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.isOpen]);

  if (!props.isOpen) return null;

  return (
    <div
      className="gateway-top-panel p-3 flex flex-wrap align-items-center gap-3 shadow-3"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000 }}
      onMouseEnter={props.onPanelMouseEnter}
      onMouseLeave={props.onPanelMouseLeave}
    >
      {props.isOpen && (
        <div
          className="gateway-top-panel p-3 flex flex-wrap align-items-center gap-3 shadow-3"
          style={{
            backgroundColor: 'rgba(30,30,30,0.95)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            margin: '8px',
          }}
        >
          <Button
            label="Запустить"
            icon="pi pi-play"
            className="p-button-sm p-button-raised p-button-accent"
            onClick={props.onLaunch}
            disabled={props.loading || props.sending}
          />
          <Button
            label="Остановить"
            icon="pi pi-stop"
            className="p-button-sm p-button-raised p-button-accent"
            onClick={props.onClose}
            disabled={props.loading || props.sending}
          />

          <span className="text-600">
            Статус: <strong>{status}</strong>
            {props.isLoggedIn && <span className="ml-2 text-green-600">(авторизован)</span>}
          </span>

          <Button
            label="Обновить диалоги"
            icon="pi pi-refresh"
            className="p-button-sm p-button-outlined"
            onClick={props.onRefreshConversations}
            disabled={!props.isLoggedIn}
          />

          <div className="flex align-items-center gap-2">
            <span className="text-600 mr-2">Режим:</span>
            {[
              { value: 'default', label: 'Быстрый' },
              { value: 'expert', label: 'Эксперт' },
              { value: 'vision', label: 'Распознавание' },
            ].map((m) => (
              <Button
                key={m.value}
                label={m.label}
                text
                size="small"
                className={`p-button-sm ${
                  props.modelType === m.value ? 'p-button-info' : 'p-button-secondary'
                }`}
                onClick={() => props.onSelectModel(m.value as 'default' | 'expert' | 'vision')}
              />
            ))}
          </div>

          <Button
            label={`Глубокое: ${props.deepThinking ? 'Вкл' : 'Выкл'}`}
            icon={props.deepThinking ? 'pi pi-check-circle' : 'pi pi-circle-off'}
            className="p-button-sm"
            onClick={() => props.onToggleDeepThinking(!props.deepThinking)}
          />
          <Button
            label={`Поиск: ${props.search ? 'Вкл' : 'Выкл'}`}
            icon={props.search ? 'pi pi-check-circle' : 'pi pi-circle-off'}
            className="p-button-sm"
            disabled={props.modelType === 'expert'}
            onClick={() => props.onToggleSearch(!props.search)}
          />

          {props.error && <span className="p-error">{props.error}</span>}
        </div>
      )}
    </div>
  );
};