// src/pages/GatewayPage/GatewayPage.tsx

import React, { useState, useEffect } from 'react';

import { TopControlPanel } from '@/components/GATEWAY/TopControlPanel/TopControlPanel';
import { GatewaySidebar } from '@/components/GATEWAY/GatewaySidebar/GatewaySidebar';
import { GatewayChatHeader } from '@/components/GATEWAY/GatewayChatHeader/GatewayChatHeader';
import { GatewayMessageUser } from '@/components/GATEWAY/GatewayMessageUser/GatewayMessageUser';
import { GatewayMessageAssistant } from '@/components/GATEWAY/GatewayMessageAssistant/GatewayMessageAssistant';
import { GatewayInputArea } from '@/components/GATEWAY/GatewayInputArea/GatewayInputArea';

//import './GatewayPage.css';
//import '@/themes/deepseek-theme/main.css';
//import '@/themes/deepseek-theme/katex.css';
import { GatewayModeSelector } from '@/components/GATEWAY/GatewayModeSelector/GatewayModeSelector';
import GatewayShareModal from '@/components/GATEWAY/GatewayShareModal/GatewayShareModal';
import { GatewaySelectionPreview } from '@/components/GATEWAY/GatewaySelectionPreview/GatewaySelectionPreview';
import GatewayDeepseekShadowRoot from '@/components/GATEWAY/GatewayDeepseekShadowRoot/GatewayDeepseekShadowRoot';
import { CheckIcon } from '@/components/GATEWAY/GatewayIcons/GatewayIcons';

interface ChatMessage {
  role: 'user' | 'assistant';
  thinking?: string;
  blocks: { type: 'text' | 'code'; content: string; language?: string }[];
}

export const GatewayPage: React.FC = () => {
  const [status, setStatus] = useState('stopped');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<{ id: string; title: string }[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [modelType, setModelType] = useState<'default' | 'expert' | 'vision'>('default');
  const [deepThinking, setDeepThinking] = useState(true);
  const [search, setSearch] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [topPanelOpen, setTopPanelOpen] = useState(false);
  const [panelHovered, setPanelHovered] = useState(false);

  const api = (window as any).electronAPI;

  const updateStatus = async () => {
    try {
      const s = await api.gatewayGetStatus();
      setStatus(s.status);
      setIsLoggedIn(s.isLoggedIn);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.add('dark');
    document.body.setAttribute('data-ds-dark-theme', 'dark');
    return () => {
      document.body.classList.remove('dark');
      document.body.removeAttribute('data-ds-dark-theme');
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const centerLeft = window.innerWidth * 0.25;
      const centerRight = window.innerWidth * 0.75;

      if (e.clientY <= 40 && e.clientX > centerLeft && e.clientX < centerRight) {
        setTopPanelOpen(true);
      } else if (!panelHovered && (e.clientY > 100 || e.clientX <= centerLeft || e.clientX >= centerRight)) {
        setTopPanelOpen(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [panelHovered]); // зависимость от panelHovered

  const syncModelState = async () => {
    try {
      const model = await api.gatewayGetCurrentModel();
      if (model.success) setModelType(model.data);
      const dt = await api.gatewayGetDeepThinking();
      if (dt.success) setDeepThinking(dt.data);
      const st = await api.gatewayGetSearch();
      if (st.success) setSearch(st.data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      syncModelState();
      handleRefreshConversations();
    }
  }, [isLoggedIn]);

  const handleLaunch = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.gatewayLaunch();
      if (result.success) {
        const data = result.data;
        setStatus(data.status);
        setIsLoggedIn(!data.loginRequired);
      } else {
        setError(result.error || 'Ошибка запуска');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.gatewayClose();
      if (result.success) {
        setStatus('stopped');
        setIsLoggedIn(false);
        setMessages([]);
      } else {
        setError(result.error || 'Ошибка остановки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError('');

    const userMsg: ChatMessage = {
      role: 'user',
      blocks: [{ type: 'text', content: message }],
    };

    try {
      const result = await api.gatewaySendMessage(message);
      if (result.success) {
        const assistantMsg = result.data as ChatMessage;
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
      } else {
        setMessages((prev) => [...prev, userMsg]);
        setError(result.error || 'Ошибка отправки');
      }
    } catch (e) {
      setMessages((prev) => [...prev, userMsg]);
      setError((e as Error).message);
    } finally {
      setSending(false);
      setMessage('');
    }
  };

  const handleRefreshConversations = async () => {
    try {
      const result = await api.gatewayGetConversations();
      if (result.success) {
        setConversations(result.data || []);
      } else {
        setError(result.error || 'Ошибка загрузки диалогов');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSelectModel = async (value: 'default' | 'expert' | 'vision') => {
    setModelType(value);
    if (value === 'expert') setSearch(false);
    try {
      await api.gatewaySelectModel(value);
      await syncModelState();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDeepThinkingChange = async (value: boolean) => {
    setDeepThinking(value);
    try {
      await api.gatewaySetDeepThinking(value);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSearchChange = async (value: boolean) => {
    setSearch(value);
    try {
      await api.gatewaySetSearch(value);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleOpenConversation = async (id: string) => {
    setSelectedConversation(id);
    try {
      const resultOpen = await api.gatewayOpenConversation(id);
      if (!resultOpen.success) {
        setError(resultOpen.error || 'Ошибка открытия диалога');
        return;
      }
      const resultMessages = await api.gatewayGetConversationMessages();
      if (resultMessages.success) {
        setMessages(resultMessages.data);
      } else {
        setError(resultMessages.error || 'Ошибка загрузки сообщений');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleNewChat = () => {
    setSelectedConversation(null);
    setMessages([]);
    setMessage('');
  };

  const handleToggleSelectMode = async () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIndices(new Set());
      await api.gatewayCancelSelectionMode().catch(() => {});
    } else {
      setSelectionMode(true);
      await api.gatewayStartSelectionMode().catch(() => {});

      // Даём интерфейсу DeepSeek время переключиться в режим выбора
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Выбираем все сообщения
      const allIndices = messages.map((_, idx) => idx);
      setSelectedIndices(new Set(allIndices));
      await api.gatewaySelectMessages(allIndices).catch(() => {});
    }
  };

  const handleToggleMessageSelect = async (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
    await api.gatewaySelectMessages(Array.from(newSelected)).catch(() => {});
  };

  const handleSelectAll = async () => {
    if (selectedIndices.size === messages.length && messages.length > 0) {
      // Снять выделение со всех
      setSelectedIndices(new Set());
      await api.gatewaySelectMessages([]).catch(() => {});
    } else {
      const allIndices = messages.map((_, idx) => idx);
      setSelectedIndices(new Set(allIndices));
      await api.gatewaySelectMessages(allIndices).catch(() => {});
    }
  };

  const createLink = async (): Promise<string> => {
    const result = await api.gatewayCreatePublicLink();
    if (!result.success) {
      throw new Error(result.error || 'Ошибка создания ссылки');
    }
    return result.data;
  };

  const handleCreatePublicLink = () => {
    console.log('Opening share modal');
    if (!selectedIndices.size) return;
    setShareModalVisible(true);
  };

  /*
  const handleCreatePublicLink = async () => {
    console.log('handleCreatePublicLink called, selectedIndices:', selectedIndices);  
    if (!selectedIndices.size) return;
    setIsCreatingLink(true);
    try {
      await api.gatewaySelectMessages(Array.from(selectedIndices));
      await new Promise(resolve => setTimeout(resolve, 500)); // даём интерфейсу обновиться
      const result = await api.gatewayCreatePublicLink();
      console.log('gatewayCreatePublicLink result:', result);
      if (result.success) {
        setShareUrl(result.data);
        setShareModalVisible(true);
        setSelectionMode(false);
        setSelectedIndices(new Set());
        await api.gatewayCancelSelectionMode().catch(() => {});
      } else {
        setError(result.error || 'Ошибка создания ссылки');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsCreatingLink(false);
    }
  };
  */

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error('Ошибка копирования в буфер обмена:', err);
    });
  };

  const handleEditMessage = () => {
    // TODO: Реализовать редактирование сообщения (возможно, вызов IPC)
    console.warn('Редактирование сообщения пока не реализовано');
  };

  const handleRegenerate = async (conversationId: string, messageIndex: number) => {
    if (!conversationId) {
      setError('Не выбран диалог');
      return;
    }
    try {
      await api.gatewayRegenerateMessage(conversationId, messageIndex);
      // Обновляем сообщения после регенерации
      const result = await api.gatewayGetConversationMessages();
      if (result.success) {
        setMessages(result.data);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleFeedback = async (conversationId: string, messageIndex: number, type: 'like' | 'dislike') => {
    if (!conversationId) {
      setError('Не выбран диалог');
      return;
    }
    try {
      await api.gatewaySendFeedback(conversationId, messageIndex, type);
      // Локально состояние уже обновлено в компоненте, дополнительно ничего не делаем
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleShareSingle = async (index: number) => {
    setSelectionMode(true);
    setSelectedIndices(new Set([index]));
    try {
      await api.gatewayStartSelectionMode();
      await api.gatewaySelectMessages([index]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <TopControlPanel
        status={status}
        isLoggedIn={isLoggedIn}
        error={error}
        loading={loading}
        sending={sending}
        onLaunch={handleLaunch}
        //onClose={handleClose}
        onRefreshConversations={handleRefreshConversations}
        onSelectModel={handleSelectModel}
        onToggleDeepThinking={handleDeepThinkingChange}
        onToggleSearch={handleSearchChange}
        modelType={modelType}
        deepThinking={deepThinking}
        search={search}
        isOpen={topPanelOpen}
        onOpen={() => setTopPanelOpen(true)}
        onClose={() => setTopPanelOpen(false)}
        onPanelMouseEnter={() => setPanelHovered(true)}
        onPanelMouseLeave={() => setPanelHovered(false)}
      />
      <GatewayDeepseekShadowRoot>
        <GatewayShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          onCreateLink={createLink}
          onCreated={() => {
            setSelectionMode(false);
            setSelectedIndices(new Set());
            api.gatewayCancelSelectionMode().catch(() => {});
          }}
        />
        <div className="cb86951c" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="cddfb2ed" />
          <div className="c3ecdb44" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div className="dc04ec1d" style={{ display: 'flex' }}>
              <GatewaySidebar
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleOpenConversation}
                onRefresh={handleRefreshConversations}
                isLoggedIn={isLoggedIn}
                onNewChat={handleNewChat}
              />
            </div>
            <div className="_4cbcd96" />
            <div
              className="_7780f2e"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: selectionMode ? 'row' : 'column',
                minHeight: 0,
                position: 'relative',
              }}
            >
              {messages.length === 0 ? (
                <div
                  className="_765a5cd"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    width: '100%',
                  }}
                >
                  <div
                    className="_660ca72"
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 24px',
                      width: '100%',
                    }}
                  >
                    <GatewayModeSelector modelType={modelType} onSelectModel={handleSelectModel} />
                    <div style={{ width: '100%', maxWidth: '780px', margin: '0 auto' }}>
                      <GatewayInputArea
                        value={message}
                        onChange={setMessage}
                        onSend={handleSend}
                        disabled={!isLoggedIn}
                        sending={sending}
                        deepThinking={deepThinking}
                        search={search}
                        onToggleDeepThinking={() => handleDeepThinkingChange(!deepThinking)}
                        onToggleSearch={() => handleSearchChange(!search)}
                        isExpert={modelType === 'expert'}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Основная колонка */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                    <div className="_765a5cd" style={{ flexShrink: 0, width: '100%' }}>
                      <GatewayChatHeader
                        title={
                          selectedConversation
                            ? conversations.find(c => c.id === selectedConversation)?.title || 'Диалог'
                            : 'Новый чат'
                        }
                        modelType={modelType}
                        onSelectModel={handleSelectModel}
                        showTitle={true}
                        onToggleSelectMode={handleToggleSelectMode}
                      />
                    </div>

                    {/* Список сообщений */}
                    <div
                      className="ds-virtual-list ds-virtual-list--printable"
                      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                    >
                      <div
                        className="ds-virtual-list-items _6f2c522"
                        style={{
                          paddingTop: '0px',
                          paddingLeft: 'calc((100% - var(--message-list-max-width)) / 2)',
                          paddingRight: 'calc((100% - var(--message-list-max-width)) / 2)',
                          flexShrink: '0',
                          flexGrow: '1',
                          minHeight: '0',
                        }}
                      >
                        <div className="ds-virtual-list-visible-items">
                          {messages.map((msg, idx) => {
                            const isLast = idx === messages.length - 1;
                            return msg.role === 'user' ? (
                              <GatewayMessageUser
                                key={idx}
                                content={msg.blocks[0]?.content || ''}
                                selectMode={selectionMode}
                                isSelected={selectedIndices.has(idx)}
                                onToggleSelect={() => handleToggleMessageSelect(idx)}
                                isLast={isLast}
                                onCopy={handleCopyMessage}
                                onEdit={handleEditMessage}
                              />
                            ) : (
                              <GatewayMessageAssistant
                                key={idx}
                                thinking={msg.thinking}
                                blocks={msg.blocks}
                                selectMode={selectionMode}
                                isSelected={selectedIndices.has(idx)}
                                onToggleSelect={() => handleToggleMessageSelect(idx)}
                                isLast={isLast}
                                onCopy={handleCopyMessage}
                                onRegenerate={() => handleRegenerate(selectedConversation!, idx)}
                                onFeedback={(type) => handleFeedback(selectedConversation!, idx, type)}
                                onShare={() => handleShareSingle(idx)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Поле ввода и подпись скрыты в режиме выбора */}
                    {!selectionMode && (
                      <>
                        <div className="_871cbca">
                          <div className="d72636e2" />
                          <GatewayInputArea
                            value={message}
                            onChange={setMessage}
                            onSend={handleSend}
                            disabled={!isLoggedIn}
                            sending={sending}
                            deepThinking={deepThinking}
                            search={search}
                            onToggleDeepThinking={() => handleDeepThinkingChange(!deepThinking)}
                            onToggleSearch={() => handleSearchChange(!search)}
                            isExpert={modelType === 'expert'}
                          />
                        </div>
                        <div className="_0fcaa63" style={{ width: '100%', flexShrink: 0 }}>
                          Сгенерировано ИИ, только для справки
                        </div>
                      </>
                    )}

                    {/* Нижняя панель выбора */}
                    {selectionMode && (
                      <div className="_43d222b _117e7c4">
                        <div className="_9f86274">
                          <div
                            className="ds-checkbox-wrapper ds-checkbox-wrapper--l _692accd"
                            style={{
                              color: 'inherit',
                              '--dsl-checkbox-font-size': 'inherit',
                              '--dsl-checkbox-label-gap': '12px',
                            } as React.CSSProperties}
                          >
                            <div className="ds-checkbox-align-wrapper">
                              <div
                                className={`ds-checkbox ds-checkbox--l ${
                                  selectedIndices.size === messages.length && messages.length > 0
                                    ? 'ds-checkbox--active'
                                    : ''
                                } ds-checkbox--none`}
                                tabIndex={0}
                                onClick={handleSelectAll}
                              >
                                {selectedIndices.size === messages.length && messages.length > 0 && (
                                  <CheckIcon size={14} />
                                )}
                              </div>
                            </div>
                            <div className="ds-checkbox-label">Выбрать все</div>
                          </div>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="2"
                            height="15"
                            viewBox="0 0 2 15"
                            fill="none"
                            style={{ color: 'var(--dsw-alias-border-l3)' }}
                          >
                            <path d="M1 0.5V14.5" stroke="currentColor" />
                          </svg>
                          <span className="dcaa34cd">Выбрано {selectedIndices.size} диалогов</span>
                          <div className="fab07e97">
                            <div
                              role="button"
                              className="ds-button ds-button--outlinedNeutral ds-button--outlined ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width _43443f1"
                              tabIndex={0}
                              onClick={handleToggleSelectMode}
                            >
                              <span className="ds-button__content">Отмена</span>
                            </div>
                            <div
                              role="button"
                              className={`ds-button ds-button--primary ds-button--filled ds-button--capsule ds-button--m ds-button--icon-relative-m ds-button--min-width ${
                                selectedIndices.size === 0 ? 'ds-button--disabled' : ''
                              }`}
                              tabIndex={0}
                              onClick={handleCreatePublicLink}
                              style={{ pointerEvents: selectedIndices.size === 0 ? 'none' : 'auto' }}
                            >
                              <span className="ds-button__content">Создать публичную ссылку</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Правая панель предпросмотра */}
                  {selectionMode && (
                    <GatewaySelectionPreview messages={messages} selectedIndices={selectedIndices} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </GatewayDeepseekShadowRoot>
    </div>
  );
};