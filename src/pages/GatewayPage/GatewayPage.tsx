import React, { useState, useEffect } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { ToggleButton } from 'primereact/togglebutton';
import { ListBox } from 'primereact/listbox';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
    // Добавляем сообщение пользователя в ленту
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    try {
      const result = await api.gatewaySendMessage(message);
      if (result.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: result.data }]);
      } else {
        setError(result.error || 'Ошибка отправки');
      }
    } catch (e) {
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
      // Синхронизируем состояния после смены режима
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
    try {
      const resultOpen = await api.gatewayOpenConversation(id);
      if (!resultOpen.success) {
        setError(resultOpen.error || 'Ошибка открытия диалога');
        return;
      }

      // Загружаем историю сообщений из открытого диалога
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

  return (
    <React.Fragment>
      {/* Панель управления браузером */}
      <Panel className="shadow-5 mx-1" header="Браузер DeepSeek">
        <div className="flex flex-wrap app p-2 align-items-center gap-4 item-border-bottom">
          <div className="flex-1 flex flex-column gap-1 xl:mr-8">
            <div className="flex align-items-center gap-2">
              <Button
                label="Запустить"
                icon="pi pi-play"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleLaunch}
                disabled={loading || sending}
              />
              <Button
                label="Остановить"
                icon="pi pi-stop"
                className="p-button-lg p-button-raised p-button-accent"
                onClick={handleClose}
                disabled={loading || sending}
              />
            </div>
            <div className="mt-3">
              <span className="app font-size-subheading">Статус: {status}</span>
              {isLoggedIn && <span className="ml-2 text-green-600">(авторизован)</span>}
            </div>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="app p-0">
          <div className="p-error mx-2">{error}</div>
        </div>
      )}

      {/* Основной макет: слева диалоги, справа чат */}
      <div className="grid mx-1 mt-2" style={{ minHeight: '600px' }}>
        {/* Боковая панель диалогов */}
        <div className="col-12 md:col-3">
          <Panel className="shadow-5 h-full" header="Диалоги">
            <div className="p-2 flex flex-column" style={{ height: '100%' }}>
              <Button
                label="Обновить"
                icon="pi pi-refresh"
                className="p-button-sm p-button-raised p-button-accent mb-2"
                onClick={handleRefreshConversations}
                disabled={!isLoggedIn}
              />
              <ListBox
                value={selectedConversation}
                options={conversations}
                onChange={(e) => {
                  setSelectedConversation(e.value);
                  if (e.value) handleOpenConversation(e.value);
                }}
                optionLabel="title"
                optionValue="id"
                style={{ width: '100%', flex: '1 1 auto' }}
                listStyle={{ maxHeight: '400px' }}
              />
            </div>
          </Panel>
        </div>

        {/* Область чата */}
        <div className="col-12 md:col-9">
          <Panel className="shadow-5 h-full" header="Чат DeepSeek">
            <div className="flex flex-column h-full p-2">
              {/* Выбор режима */}
              <div className="flex justify-content-center gap-3 mb-3 flex-nowrap overflow-x-auto">
                {[
                  { type: 'default', label: 'Быстрый', icon: 'pi pi-bolt' },
                  { type: 'expert', label: 'Эксперт', icon: 'pi pi-star' },
                  { type: 'vision', label: 'Распознавание', icon: 'pi pi-eye' },
                ].map((mode) => (
                  <div
                    key={mode.type}
                    className={`flex align-items-center gap-2 px-4 py-2 border-round-3xl cursor-pointer ${
                      modelType === mode.type ? 'bg-primary text-white' : 'surface-100 text-700'
                    }`}
                    onClick={() => handleSelectModel(mode.type as 'default' | 'expert' | 'vision')}
                  >
                    <i className={mode.icon} />
                    <span>{mode.label}</span>
                  </div>
                ))}
              </div>

              {/* Сообщения */}
              <div
                className="flex-1 overflow-y-auto p-3 surface-100 border-round"
                style={{ minHeight: '300px' }}
              >
                {messages.length === 0 ? (
                  <p className="text-center text-color-secondary">Нет сообщений</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'} mb-3`}
                    >
                      <div
                        className={`p-3 border-round-3xl max-w-30rem ${
                          msg.role === 'user'
                            ? 'bg-primary text-white'
                            : 'surface-200 text-900'
                        }`}
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Переключатели "Глубокое мышление" и "Умный поиск" */}
              <div className="flex gap-3 mt-3">
                <div
                  className={`inline-flex align-items-center gap-2 px-3 py-1 border-round-3xl cursor-pointer ${
                    deepThinking ? 'bg-primary text-white' : 'surface-100 text-700'
                  }`}
                  onClick={() => handleDeepThinkingChange(!deepThinking)}
                >
                  <i className="pi pi-lightbulb" />
                  <span>Глубокое мышление</span>
                </div>

                <div
                  className={`inline-flex align-items-center gap-2 px-3 py-1 border-round-3xl cursor-pointer ${
                    search ? 'bg-primary text-white' : 'surface-100 text-700'
                  } ${modelType === 'expert' ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => handleSearchChange(!search)}
                >
                  <i className="pi pi-search" />
                  <span>Умный поиск</span>
                </div>
              </div>

              {/* Поле ввода */}
              <div className="flex align-items-end gap-2 mt-3">
                <InputTextarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  autoResize
                  placeholder="Сообщение для DeepSeek"
                  disabled={!isLoggedIn || sending}
                  className="flex-1"
                />
                <Button
                  icon="pi pi-arrow-up"
                  className="p-button-rounded p-button-lg p-button-primary"
                  onClick={handleSend}
                  disabled={!isLoggedIn || !message.trim() || sending}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </React.Fragment>
  );
};