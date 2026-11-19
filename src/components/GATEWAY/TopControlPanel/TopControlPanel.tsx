// src/components/GATEWAY/TopControlPanel/TopControlPanel.tsx

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { GatewayAccountsButton } from '../GatewayAccountsButton/GatewayAccountsButton';
import './TopControlPanel.css';

interface TopControlPanelProps {
  status: string;
  isLoggedIn: boolean;
  error: string;
  loading: boolean;
  sending: boolean;
  onLaunch: () => void;
  onClose: () => void;
  onRefreshConversations: () => void;
  onToggleDeepThinking: (value: boolean) => void;
  onToggleSearch: (value: boolean) => void;
  deepThinking: boolean;
  search: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onPanelMouseEnter: () => void;
  onPanelMouseLeave: () => void;
  onOpenCacheManager: () => void;
}

export const TopControlPanel: React.FC<TopControlPanelProps> = (props) => {
  const [handoffLoading, setHandoffLoading] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Backquote') {
        e.preventDefault();
        props.isOpen ? props.onClose() : props.onOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.isOpen, props.onClose, props.onOpen]);

  // Не размонтируем при закрытии — иначе теряется state дочерних компонентов
  // (например, модалка создания профиля в GatewayAccountsDialog).
  return (
    <div
      className="gateway-top-panel-wrapper"
      style={{ display: props.isOpen ? undefined : 'none' }}
      onMouseEnter={props.onPanelMouseEnter}
      onMouseLeave={props.onPanelMouseLeave}
    >
      <div className="gateway-top-panel">
        <Button
          label="Запустить"
          icon="pi pi-play"
          className="pb"
          onClick={props.onLaunch}
          disabled={props.loading || props.sending}
        />

        <span className="gateway-top-panel__status">
          Статус: <strong>{props.status}</strong>
          {props.isLoggedIn && (
            <span className="gateway-top-panel__status-ok">(авторизован)</span>
          )}
        </span>

        <GatewayAccountsButton />

        <Button
          label={handoffLoading ? 'Собираю…' : 'Handoff'}
          icon={handoffLoading ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
          className="pb-soft"
          disabled={handoffLoading}
          loading={handoffLoading}
          tooltip="Собрать состояние проекта в .md (для нового чата)"
          tooltipOptions={{ position: 'bottom' }}
          onClick={async () => {
            if (handoffLoading) return;
            setHandoffLoading(true);
            try {
              const r = await (window as any).electronAPI.gatewayExportHandoff({
                taskTitle: 'Продолжение работы',
              });
              if (r.success && r.data) {
                try {
                  await navigator.clipboard.writeText(r.data.markdown);
                  alert(
                    `✅ Handoff сохранён и скопирован в буфер\n\n` +
                    `${r.data.path}\n(${r.data.bytes} байт)\n\n` +
                    `Секции: ${r.data.sections.join(', ')}`
                  );
                } catch {
                  alert(
                    `✅ Handoff сохранён (буфер недоступен)\n\n${r.data.path}\n(${r.data.bytes} байт)`
                  );
                }
              } else {
                alert('❌ ' + (r.error || 'Не удалось собрать handoff'));
              }
            } catch (e: any) {
              alert('❌ ' + e.message);
            } finally {
              setHandoffLoading(false);
            }
          }}
        />

        <Button
          label="Обновить диалоги"
          icon="pi pi-refresh"
          className="pb-soft"
          onClick={props.onRefreshConversations}
          disabled={!props.isLoggedIn}
        />

        <span className="gateway-top-panel__sep" />

        <Button
          label="Кэш"
          icon="pi pi-database"
          className="pb-soft"
          onClick={props.onOpenCacheManager}
          disabled={props.loading}
        />

        <span className="gateway-top-panel__sep" />

        <Button
          label={`Глубокое: ${props.deepThinking ? 'Вкл' : 'Выкл'}`}
          icon={props.deepThinking ? 'pi pi-check-circle' : 'pi pi-circle-off'}
          className="pb-soft"
          onClick={() => props.onToggleDeepThinking(!props.deepThinking)}
        />
        <Button
          label={`Поиск: ${props.search ? 'Вкл' : 'Выкл'}`}
          icon={props.search ? 'pi pi-check-circle' : 'pi pi-circle-off'}
          className="pb-soft"
          onClick={() => props.onToggleSearch(!props.search)}
        />

        {props.error && (
          <span className="gateway-top-panel__error">{props.error}</span>
        )}
      </div>
    </div>
  );
};