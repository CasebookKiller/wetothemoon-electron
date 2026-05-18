import React, { useState, useRef, useEffect } from 'react';
import { Message, ModelSettings, ChatState, Conversation, SavedConversation, LocalStorageData, ToolCall, Tag } from '../../../shared/types/chat';
import { exportConversationToFile, exportAllConversationsToFile } from '../../../shared/utils/chatExport';
import { ChatBackupService } from '../../../services/chatBackupService';

import { useLocalStorage } from '../../../hooks/useLocalStorage';

import MessageList from '@/components/AI/MessageList/MessageList';
import InputArea from '@/components/AI/InputArea/InputArea';
import Sidebar from '@/components/AI/Sidebar/Sidebar';

import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

import './ChatInterface.css';

const API_URL = 'http://localhost:11434/api/' ;//generate;
const MAX_CONTEXT_TOKENS = 40000; // Для Qwen3: 40 960, оставляем запас

const countTokens = (text: string): number => {
  // Упрощённая эвристика: 1 токен ≈ 4 символа для английского, 2–3 для русского
  return Math.ceil(text.length / 3);
};

const getContextMessages = (allMessages: Message[], modelSettings: ModelSettings): Message[] => {
  const maxTokens = modelSettings.contextLength || MAX_CONTEXT_TOKENS;
  let totalTokens = 0;
  const context: Message[] = [];

  // Берём сообщения с конца (самые свежие)
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i];
    const msgTokens = countTokens(msg.text);

    if (totalTokens + msgTokens > maxTokens) break;

    context.unshift(msg); // Добавляем в начало, чтобы сохранить порядок
    totalTokens += msgTokens;
  }

  return context;
};

const ChatInterface: React.FC = () => {
  const { setItem, getItem } = useLocalStorage();
  
  const loadModelSettings = (): ModelSettings => {
    console.log('loadModelSettings:: Загружаем настройки модели из localStorage');

    try {
      const saved = getItem('ai-model-settings');
      if (saved && typeof saved === 'object') {
        // Валидация загруженных данных
        const validatedSettings: ModelSettings = {
          model: typeof saved.model === 'string'
            ? saved.model
            : 't-tech/T-lite-it-2.1:q4_K_M',
          temperature: typeof saved.temperature === 'number'
            && saved.temperature >= 0
            && saved.temperature <= 2
            ? saved.temperature
            : 0.5,
          maxTokens: typeof saved.maxTokens === 'number'
            && saved.maxTokens >= 100
            && saved.maxTokens <= 40960
            ? saved.maxTokens
            : 40000,
          topP: typeof saved.topP === 'number'
            && saved.topP >= 0
            && saved.topP <= 1
            ? saved.topP
            : 0.9,
          frequencyPenalty: typeof saved.frequencyPenalty === 'number'
            && saved.frequencyPenalty >= -2
            && saved.frequencyPenalty <= 2
            ? saved.frequencyPenalty
            : 0,
          presencePenalty: typeof saved.presencePenalty === 'number'
            && saved.presencePenalty >= -2
            && saved.presencePenalty <= 2
            ? saved.presencePenalty
            : 0,
          topK: typeof saved.topK === 'number'
            && saved.topK >= 1
            && saved.topK <= 100
            ? saved.topK
            : 40,
          contextLength: typeof saved.contextLength === 'number'
            && saved.contextLength >= 512
            && saved.contextLength <= 40960
            ? saved.contextLength
            : 40000,
          stopSequences: Array.isArray(saved.stopSequences)
            ? saved.stopSequences
            : [],
          extended: typeof saved.extended === 'boolean'
            ? saved.extended
            : false
        };
        return validatedSettings;
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек из localStorage:', error);
    }

    // Значения по умолчанию
    return {
      model: 't-tech/T-lite-it-2.1:q4_K_M',
      temperature: 0.5,
      maxTokens: 40000,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topK: 40,
      contextLength: 40000,
      stopSequences: [],
      extended: false
    };
  };

  /*
  const loadChatState = (): ChatState => {
    // Загружаем состояние чата из localStorage
    console.log('loadChatState:: Загружаем состояние чата из localStorage');
    try {
      const saved = getItem('ai-chat-state');
      if (saved) {
        const conversations = Object.values(saved.conversations).map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt)
        }));
        return {
          currentConversationId: saved.currentConversationId,
          conversations: Object.fromEntries(
            conversations.map(conv => [conv.id, conv])
          )
        };
      }
    } catch (error) {
      console.error('Ошибка загрузки состояния чата:', error);
    }
    return {
      currentConversationId: null,
      conversations: {}
    };
  };
  */
  const loadChatState = (): ChatState => {
    console.log('loadChatState:: Загружаем состояние чата из localStorage');
    try {
      const saved = getItem('ai-chat-state');
      if (saved) {
        const conversations = Object.values(saved.conversations).map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          tags: conv.tags || [] // загружаем теги, если есть
        }));
        return {
          currentConversationId: saved.currentConversationId,
          conversations: Object.fromEntries(
            conversations.map(conv => [conv.id, conv])
          )
        };
      }
    } catch (error) {
      console.error('Ошибка загрузки состояния чата:', error);
    }
    return {
      currentConversationId: null,
      conversations: {}
    };
  };


  const [chatState, setChatState] = useState<ChatState>(loadChatState);
  
  const [messages, setMessages] = useState<Message[]>(() => {
    // Инициализация массива сообщений из localStorage
    // Здесь необходимо проверить синхронизацию с chatState
    console.log('messages:: Инициализация массива сообщений из localStorage');
    const saved = getItem('ai-chat-state');
    if (saved && saved.currentConversationId && saved.conversations[saved.currentConversationId]) {
      return saved.conversations[saved.currentConversationId].messages;
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const [currentResponseStartTime, setCurrentResponseStartTime] = useState<number | null>(null);
  const [receivedData, setReceivedData] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);

  const [settings, setSettings] = useState<ModelSettings>(loadModelSettings);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /*
  const saveChatState = () => {
    console.log('saveChatState:: Сохранение состояния чата в localStorage');
    console.log('Текущее состояние чата:', chatState);

    try {
      const saveableState: LocalStorageData = {
        currentConversationId: chatState.currentConversationId,
        conversations: Object.fromEntries(
          Object.entries(chatState.conversations).map(([id, conv]) => [
            id,
            {
              ...conv,
              createdAt: conv.createdAt.toISOString(),
              updatedAt: conv.updatedAt.toISOString()
            }
          ])
        ),
        lastBackup: new Date().toISOString()
      };
    
      // Проверка размера (например, не более 5 МБ)
      const sizeInBytes = new Blob([JSON.stringify(saveableState)]).size;
      if (sizeInBytes > 5 * 1024 * 1024) {
        console.warn('Состояние чата слишком большое, пропускаем сохранение');
        return;
      }

      setItem('ai-chat-state', saveableState);
      console.log('Состояние чата успешно сохранено');
    } catch (error) {
      console.error('Ошибка полного сохранения состояния:', error);
    }
  };
  */

  const saveChatState = () => {
    console.log('saveChatState:: Сохранение состояния чата в localStorage');

    try {
      const saveableState: LocalStorageData = {
        currentConversationId: chatState.currentConversationId,
        conversations: Object.fromEntries(
          Object.entries(chatState.conversations).map(([id, conv]) => [
            id,
            {
              ...conv,
              createdAt: conv.createdAt.toISOString(),
              updatedAt: conv.updatedAt.toISOString()
            }
          ])
        ),
        lastBackup: new Date().toISOString()
      };

      setItem('ai-chat-state', saveableState);
      console.log('Состояние чата успешно сохранено');
    } catch (error) {
      console.error('Ошибка полного сохранения состояния:', error);
    }
  };


  const handleExportCurrent = () => {
    // Экспорт текущего диалога в файл
    console.log('handleExportCurrent:: Экспорт текущего диалога в файл');
    if (chatState.currentConversationId && chatState.conversations[chatState.currentConversationId]) {
      exportConversationToFile(chatState.conversations[chatState.currentConversationId]);
    }
  };

  const handleExportAll = () => {
    // Экспорт всех диалогов в файл
    console.log('handleExportAll:: Экспорт всех диалогов в файл');
    exportAllConversationsToFile(chatState.conversations);
  };

  const handleBackupToSupabase = async () => {
    // Сохранение текущего диалога в Supabase
    console.log('handleBackupToSupabase:: Сохранение текущего диалога в Supabase');
    if (!chatState.currentConversationId) return;

    try {
      await ChatBackupService.backupToSupabase(
        chatState.conversations[chatState.currentConversationId],
        'current-user-id' // замените на реальный ID пользователя
      );
      alert('Диалог успешно сохранён в Supabase!');
    } catch (error) {
      alert('Ошибка сохранения в Supabase');
    }
  };

  const handleAbortResponse = () => {
    console.log('Прерывание ответа пользователем');
    setIsAborted(true);
    setIsLoading(false);

    // Удаляем временное сообщение ассистента, если оно не завершено
    setMessages(prev =>
      prev.filter(msg => !(msg.sender === 'assistant' && !msg.isComplete))
    );
  };

  const onExportCurrentConversationClick = async () => { // Обработчик события onMenu
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

    // Проверяем доступность API
    if (!electronAPI) {
      console.error('Electron API not available');
      return;
    }

    // Обработчик события из меню
    const handleExportCurrentConversationClick = (data: any) => {
      console.log('Data received from menu:', data);
      setReceivedData(data);

      // Добавляем запись в лог
      setLog(prev => [
        ...prev,
        `${new Date().toLocaleTimeString()}: Received: ${data.message}`
      ]);

      handleExportCurrent();
    };

    // Подписываемся на события
    await electronAPI.onExportCurrentConversatonClick(handleExportCurrentConversationClick);

    // Очистка подписки при размонтировании
    return () => {
      //if (electronAPI?.removeExportCurrentConversationListener) {
      //  electronAPI.removeExportCurrentConversationListener();
      //}
    };
  }

  const onExportAllConversationsClick = async () => { // Обработчик события onMenu
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

    // Проверяем доступность API
    if (!electronAPI) {
      console.error('Electron API not available');
      return;
    }

    // Обработчик события из меню
    const handleExportAllConversationsClick = (data: any) => {
      console.log('Data received from menu:', data);
      setReceivedData(data);

      // Добавляем запись в лог
      setLog(prev => [
        ...prev,
        `${new Date().toLocaleTimeString()}: Received: ${data.message}`
      ]);

      handleExportAll();
    };

    // Подписываемся на события
    await electronAPI.onExportAllConversationsClick(handleExportAllConversationsClick);

    // Очистка подписки при размонтировании
    return () => {
      //if (electronAPI?.removeExportAllConversationsListener) {
      //  electronAPI.removeExportAllConversationsListener();
      //}
    };
  }

  const onBackupToSupabaseClick = async () => { // Обработчик события onMenu
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;

    // Проверяем доступность API
    if (!electronAPI) {
      console.error('Electron API not available');
      return;
    }

    // Обработчик события из меню
    const handleBackupToSupabaseClick = (data: any) => {
      console.log('Data received from menu:', data);
      setReceivedData(data);

      // Добавляем запись в лог
      setLog(prev => [
        ...prev,
        `${new Date().toLocaleTimeString()}: Received: ${data.message}`
      ]);

      handleBackupToSupabase();
    };

    // Подписываемся на события
    await electronAPI.onBackupToSupabaseClick(handleBackupToSupabaseClick);

    // Очистка подписки при размонтировании
    return () => {
      //if (electronAPI?.removeExportAllConversationsListener) {
      //  electronAPI.removeExportAllConversationsListener();
      //}
    };
  }

  const handleConversationTitleChange = (conversationId: string, newTitle: string) => {
    console.log('Изменение названия диалога:', conversationId, 'на:', newTitle);

    setChatState(prev => {
      const updatedConv = {
        ...prev.conversations[conversationId],
        title: newTitle,
        updatedAt: new Date()
      };

      return {
        ...prev,
        conversations: {
          ...prev.conversations,
          [conversationId]: updatedConv
        }
      };
    });

    // Сохраняем в localStorage
    saveChatState();

    // Дополнительно сохраняем в Supabase, если есть активный диалог
    if (conversationId === chatState.currentConversationId) {
      handleBackupToSupabase();
    }
  };

  /*
  const handleTagsUpdate = (conversationId: string, tags: Tag[]) => {
    console.log('handleTagsUpdate:: Обновление тегов для диалога', conversationId, 'новые теги:', tags);

    setChatState(prev => {
      // Создаём копию обновляемого диалога
      const updatedConv = {
        ...prev.conversations[conversationId],
        tags: tags,
        updatedAt: new Date() // Обновляем временную метку
      };

      // Возвращаем новое состояние
      return {
        ...prev,
        conversations: {
          ...prev.conversations,
          [conversationId]: updatedConv
        }
      };
    });

    // Сохраняем обновлённое состояние в localStorage
    saveChatState();
  };
  */
  const handleTagsUpdate = (conversationId: string, tags: Tag[]) => {
    console.log('handleTagsUpdate:: Обновление тегов для диалога', conversationId);

    setChatState(prev => {
      const currentConv = prev.conversations[conversationId];
      // Проверка: изменились ли теги?
      const tagsAreEqual = currentConv.tags?.length === tags.length &&
        currentConv.tags?.every((tag, index) => tag.id === tags[index].id);

      if (tagsAreEqual) {
        console.log('Теги не изменились, пропуск обновления');
        return prev;
      }

      const updatedConv = {
        ...currentConv,
        tags: tags,
        updatedAt: new Date()
      };

      return {
        ...prev,
        conversations: {
          ...prev.conversations,
          [conversationId]: updatedConv
        }
      };
    });

    saveChatState();
  };



  useEffect(() => {
    console.log('ChatInterface state updated:', {
      currentConversationId: chatState.currentConversationId,
      conversationsCount: Object.keys(chatState.conversations).length
    });
  }, [chatState.currentConversationId, chatState.conversations]);

  const handleConversationSelect = (id: string) => {
    console.log('handleConversationSelect called with:', id);
    setChatState(prev => ({
      ...prev,
      currentConversationId: id
    }));
  };

  useEffect(() => {
    onExportCurrentConversationClick();
    onExportAllConversationsClick();
    onBackupToSupabaseClick();
  }, []);

  // Сохранение текущего диалога
  useEffect(() => {
    !isLoading && console.log('Обновление messages в текущем диалоге');
    !isLoading && console.log('messages: ', messages)
    if (chatState.currentConversationId && chatState.conversations[chatState.currentConversationId]) {
      try {
        // Сохраняем только текущий диалог отдельно для быстрого доступа
        const currentConv = chatState.conversations[chatState.currentConversationId];
        currentConv.messages = messages;

      } catch (error) {
        console.error('Ошибка сохранения текущего диалога:', error);
      }
    }
    // протестировать отключение отслеживания chatState.currentConversationId
  }, [messages]);

  useEffect(() => {
    if (!isLoading && chatState.currentConversationId) {
      setChatState(prev => {
        const updatedConv = {
          ...prev.conversations[chatState.currentConversationId as string],
          messages: messages,
          updatedAt: new Date()
        };
        return {
          ...prev,
          conversations: {
            ...prev.conversations,
            [chatState.currentConversationId as string]: updatedConv
          }
        };
      });
    }
  }, [messages, isLoading, chatState.currentConversationId]);

  // Синхронизация messages с текущим диалогом
  useEffect(() => {
    console.log('Обновление messages для диалога:', chatState.currentConversationId);

    if (chatState.currentConversationId) {
      const selectedConv = chatState.conversations[chatState.currentConversationId];
      if (selectedConv) {
        // Логируем сообщения перед установкой
        console.log('Сообщения для диалога:', selectedConv.messages);
        setMessages(selectedConv.messages || []);
        console.log('messages обновлены:', messages);
      } else {
        console.warn('Диалог не найден:', chatState.currentConversationId);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [chatState.currentConversationId, chatState.conversations]);
  
  // Периодическое полное сохранение состояния
  useEffect(() => {
    const saveInterval = setInterval(() => {
      saveChatState();
    }, 30000); // каждые 30 секунд

    return () => clearInterval(saveInterval);
  }, [chatState]);

  // Сохранение в localStorage при изменении настроек
  useEffect(() => {
    console.log('Сохранение настроек в localStorage');
    try {
      setItem('ai-model-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Ошибка сохранения настроек в localStorage:', error);
    }
  }, [settings]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date()
    };

    // Создаём или обновляем текущий диалог
    let currentConvId = chatState.currentConversationId;
    if (!currentConvId) {
      currentConvId = `conv-${Date.now()}`;
      const newConv: Conversation = {
        id: currentConvId,
        title: `Диалог ${new Date().toLocaleDateString()}`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        totalResponseTimeMs: 0
      };
      setChatState(prev => ({
        ...prev,
        currentConversationId: currentConvId,
        conversations: { ...prev.conversations, [currentConvId as string]: newConv }
      }));
    }

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    const startTime = Date.now();
    setCurrentResponseStartTime(startTime); // Фиксируем время начала

    // Создаём временное сообщение для ассистента
    const tempAssistantId = (Date.now() + 1).toString();
    const tempMessage: Message = {
      id: tempAssistantId,
      text: '',
      sender: 'assistant',
      timestamp: new Date(),
      isComplete: false // Изначально ответ не завершён
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
    // Функция для обновления текста сообщения по мере поступления данных
    const updateMessageText = (newText: string) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempAssistantId
            ? { ...msg, text: msg.text + newText }
            : msg
        )
      );
    };

    console.log('Отправка запроса к модели с контекстом:');
    console.log('Текущие сообщения:', messages);

    await sendToModel(text, settings, updateMessageText);

    // После успешного завершения устанавливаем флаг isComplete = true
    // и фиксируем время ответа
    const responseEndTime = Date.now();
    const responseTimeMs = startTime
      ? responseEndTime - startTime
      : 0;

    setMessages(prev =>
      prev.map(msg =>
        msg.id === tempAssistantId
          ? {
              ...msg,
              isComplete: true,
              responseTimeMs: responseTimeMs
            }
          : msg
      )
    );

    // Обновляем общее время в диалоге
    if (chatState.currentConversationId) {
      setChatState(prev => {
        const conv = prev.conversations[chatState.currentConversationId as string];
        return {
          ...prev,
          conversations: {
            ...prev.conversations,
            [chatState.currentConversationId as string]: {
              ...conv,
              totalResponseTimeMs: (conv.totalResponseTimeMs || 0) + responseTimeMs,
              updatedAt: new Date()
            }
          }
        };
      });
    }} catch (error) {
      console.error('Ошибка при общении с моделью:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempAssistantId
            ? {
                ...msg,
                text: 'Ошибка получения ответа',
                isComplete: true,
                responseTimeMs: startTime
                  ? Date.now() - startTime
                  : 0
              }
            : msg
          )
        );
    } finally {
      setIsLoading(false);
      setCurrentResponseStartTime(null); // Сброс времени начала
    }

    
  };

  const handleToolCalls = async (toolCalls: ToolCall[]) => {
    console.log('[TOOL-CALLING] Обработка tool calls:', toolCalls);

    // Здесь должна быть логика выполнения инструментов
    // Пока просто логируем
    for (const toolCall of toolCalls) {
      console.log(`[TOOL-CALLING] Выполняется инструмент: ${toolCall.function.name}`);
      console.log(`[TOOL-CALLING] Аргументы: ${toolCall.function.arguments}`);

      // Имитация выполнения инструмента
      try {
        const result = await executeTool(toolCall);
        console.log(`[TOOL-CALLING] Результат выполнения ${toolCall.function.name}:`, result);
      } catch (error) {
        console.error(`[TOOL-CALLING] Ошибка выполнения ${toolCall.function.name}:`, error);
      }
    }
  };

  const executeTool = async (toolCall: ToolCall): Promise<any> => {
    // Заглушка — здесь должна быть реальная реализация
    console.log(`[TOOL-CALLING] Выполнение инструмента: ${toolCall.function.name}`);
    return {
      status: 'success',
      data: `Результат выполнения ${toolCall.function.name}`
    };
  };

  const sendToModel = async (
    prompt: string,
    modelSettings: ModelSettings,
    onChunk: (chunk: string) => void
  ): Promise<string> => {
    const contextMessages = getContextMessages(messages, modelSettings);
    //const contextMessages = messages.slice(-30);
    console.log('contextMessages: ', contextMessages);
    console.log('Расширенные настройки:', modelSettings.extended);
    const promptWithContext = contextMessages
      .map(msg => {
        let content = `${msg.sender}: ${msg.text}`;
        if (msg.toolCalls) {
          console.log(`[TOOL-CALLING] Assistant запросил инструменты:`, msg.toolCalls);
          content += `\nTool calls: ${JSON.stringify(msg.toolCalls)}`;
        }
        if (msg.toolResults) {
          console.log(`[TOOL-CALLING] Получены результаты инструментов:`, msg.toolResults);
          content += `\nTool results: ${JSON.stringify(msg.toolResults)}`;
        }
        return content;
      })
      .join('\n') + `\nuser: ${prompt}\n`;

    console.log('promptWithContext: ', promptWithContext);

    const options = !modelSettings.extended ? {
            temperature: modelSettings.temperature,
            num_predict: modelSettings.maxTokens
          } : {
            temperature: modelSettings.temperature,
            num_predict: modelSettings.maxTokens,
            top_p: modelSettings.topP,
            frequency_penalty: modelSettings.frequencyPenalty,
            presence_penalty: modelSettings.presencePenalty,
            top_k: modelSettings.topK
          };

    const body = !modelSettings.extended ? {
          model: modelSettings.model,
          prompt: promptWithContext,
          options: options,
          stream: true, // Включение потоковой передачи
        } : {
          model: modelSettings.model,
          prompt: promptWithContext,
          options: options,
          stop: modelSettings.stopSequences,
          stream: true, // Включение потоковой передачи
        }

    const timeout = (ms: number) =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
        );

    try {
      const response = await fetch(API_URL+'generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      //const response: Response = await Promise.race([
      //  fetch(API_URL+'generate', {
      //    method: 'POST',
      //    headers: { 'Content-Type': 'application/json' },
      //    body: JSON.stringify(body)
      //  }),
      //  timeout(30000) // 30 секунд
      //]) as Response;

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      let fullResponse = '';
      let toolCalls: ToolCall[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Stream завершен');
            console.log('chatState: ', chatState);
            
            if (toolCalls.length > 0) {
              console.log('[TOOL-CALLING] Обнаружены tool calls в ответе:', toolCalls);
              // Здесь можно добавить обработку tool calls
              await handleToolCalls(toolCalls);
            }
            break;
          }

          // Декодируем чанк
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  fullResponse += data.response;
                  onChunk(data.response); // Передаём чанк в родительский компонент
                }
                // Логирование tool calls, если они есть в ответе модели
                if (data.tool_calls && data.tool_calls.length > 0) {
                  console.log('[TOOL-CALLING] Модель запросила инструменты:', data.tool_calls);
                  toolCalls = [...toolCalls, ...data.tool_calls];
                }
              } catch (e) {
                console.error('Error parsing stream chunk:', e);
              }
            }
          }
        }
      }

      return fullResponse;
    } catch (error) {
      console.error('Ошибка при общении с моделью:', error);
      throw error;
    }
  };

  const handleSettingsChange = (newSettings: Partial<ModelSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };
  

  return (
    <div className="h-screen flex flex-column surface-0">
      <div className="flex align-items-center justify-content-between p-3 border-bottom-1 surface-border gap-2">
        <h2 className="m-0 font-medium text-900">Нейро</h2>
        <div className="flex gap-2">
          <i className="pi pi-cog text-700 cursor-pointer" onClick={() => {}} />
          <i className="pi pi-refresh text-700 cursor-pointer" onClick={() => setMessages([])} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          settings={settings}
          onSettingsChange={handleSettingsChange}
          conversations={chatState.conversations}
          currentConversationId={chatState.currentConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={() => {
            const newConvId = `conv-${Date.now()}`;
            const newConv: Conversation = {
              id: newConvId,
              title: `Диалог ${new Date().toLocaleDateString()}`,
              messages: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              totalResponseTimeMs: 0
            };
            setChatState(prev => ({
              ...prev,
              currentConversationId: newConvId,
              conversations: { ...prev.conversations, [newConvId]: newConv }
            }));
            setMessages([]);
          }}
          onTitleChange={handleConversationTitleChange}
          setChatState={setChatState} // Передаём setChatState
          saveChatState={saveChatState} // Передаём saveChatState
          handleTagsUpdate={handleTagsUpdate} // Передаём функцию
          className="w-25rem flex-shrink-0 border-right-1 surface-border"
        />



        <div className="flex-1 flex flex-column">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            className="flex-1 overflow-auto"
          />
          <InputArea
            onSend={handleSendMessage}
            onAbort={handleAbortResponse}
            isLoading={isLoading}
            isAborted={isAborted}
            className="p-2 border-top-1 surface-border"
          />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;