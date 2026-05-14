import React, { useState, useRef, useCallback } from 'react';
import { OllamaClient } from '@/api/ollama/ollamaClient'; // путь к вашему файлу с OllamaClient

import './OllamaChat.css'


interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface Tool {
  name: string;
  description: string;
  parameters: object;
}

const OllamaChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'simple' | 'context' | 'streaming' | 'history' | 'tools' | 'json'>('simple');
  const [context, setContext] = useState<number[] | undefined>(undefined);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const client = new OllamaClient();

  // Отправка простого запроса
  const handleSimpleRequest = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await client.simpleRequest(prompt);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt },
        { role: 'assistant', content: response }
      ]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `Ошибка: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Отправка запроса с context
  const handleContextRequest = useCallback(async (prompt: string) => {
    setIsLoading(true);
    try {
      const result = await client.contextRequest(prompt, context);
      setContext(result.newContext);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt },
        { role: 'assistant', content: result.response }
      ]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `Ошибка: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [client, context]);

  // Стриминговый запрос
  /*const handleStreamingRequest = useCallback(async (prompt: string) => {
    setIsLoading(true);
    let streamingMessage: Message = { role: 'assistant', content: '' };

    try {
      await client.streamRequest(
        prompt,
        undefined,
        { temperature: 0.7 },
        (chunk) => {
          streamingMessage.content += chunk;
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + chunk }
              ];
            }
            return [...prev, streamingMessage];
          });
        },
        () => {
          setIsLoading(false);
        }
      );
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `Ошибка стриминга: ${error.message}` }
      ]);
      setIsLoading(false);
    }
  }, [client]);*/

  const handleStreamingRequest = useCallback(async (prompt: string) => {
    setIsLoading(true);
    
    // Добавляем сообщение пользователя сразу
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    
    // Создаём ID для сообщения ассистента, чтобы потом его обновлять
    const assistantMessageId = Date.now();
    
    try {
      await client.streamRequest(
        prompt,
        undefined,
        { temperature: 0.7 },
        (chunk) => {
          console.log('Получен чанк:', JSON.stringify(chunk));
          // Обновляем только последнее сообщение (ассистента), если оно есть
          setMessages(prev => {
            if (prev.length === 0) return prev;
            
            const lastMsg = prev[prev.length - 1];
            if (lastMsg.role === 'assistant') {
              // Просто дописываем новый чанк к существующему тексту
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + chunk }
              ];
            } else {
              // Если ассистента ещё нет, добавляем новое сообщение
              return [...prev, { role: 'assistant', content: chunk }];
            }
          });
        },
        () => {
          setIsLoading(false);
        }
      );
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `Ошибка стриминга: ${error.message}` }
      ]);
      setIsLoading(false);
    }
  }, [client]);


  // Запрос с историей диалога
  const handleHistoryRequest = useCallback(async (prompt: string) => {
    setIsLoading(true);
    const history = messages.filter(msg => msg.role !== 'error');

    try {
      const response = await client.historyRequest(prompt, history);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt },
        { role: 'assistant', content: response }
      ]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `Ошибка истории: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [client, messages]);

  // Запрос с инструментами
  const handleToolsRequest = useCallback(async (prompt: string) => {
    setIsLoading(true);
    const tools: Tool[] = [
      {
        name: 'get_weather',
        description: 'Получить погоду в указанном городе',
        parameters: {
          city: { type: 'string', description: 'Название города' }
        }
      }
    ];

    try {
      const result = await client.toolsRequest(prompt, tools);
      let toolInfo = result.toolCalls ?
        `\nВызваны инструменты: ${JSON.stringify(result.toolCalls, null, 2)}` :
        '';

      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt },
        { role: 'assistant', content: result.response + toolInfo }
      ]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `Ошибка инструментов: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // JSON‑запрос
  const handleJsonRequest = useCallback(async (prompt: string) => {
    setIsLoading(true);
    const jsonSchema = {
      type: 'object',
      properties: {
        reasoning: { type: 'string' },
        answer: { type: 'string' },
        use_tool: { anyOf: [{ type: 'string' }, { type: 'null' }] }
      },
      required: ['reasoning', 'answer', 'use_tool']
    };

    try {
      const result = await client.simpleJsonRequest(prompt, jsonSchema);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt },
        {
          role: 'assistant',
          content: `JSON ответ:\n${JSON.stringify(result, null, 2)}`
        }
      ]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `Ошибка JSON: ${error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    switch (selectedMode) {
      case 'simple':
        handleSimpleRequest(input);
        break;
      case 'context':
        handleContextRequest(input);
        break;
      case 'streaming':
        handleStreamingRequest(input);
        break;
      case 'history':
        handleHistoryRequest(input);
        break;
      case 'tools':
        handleToolsRequest(input);
        break;
      case 'json':
        handleJsonRequest(input);
        break;
    }

    setInput('');
  };

  // Автопрокрутка к последним сообщениям
  React.useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [messages]);

    return (
    <div className="ollama-chat">
      <div className="chat-header">
        <h2>Ollama Chat с React</h2>
        <div className="mode-selector">
          <label>Режим: </label>
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as any)}
          >
            <option value="simple">Простой запрос</option>
            <option value="context">С context</option>
            <option value="streaming">Стриминг</option>
            <option value="history">С историей</option>
            <option value="tools">С инструментами</option>
            <option value="json">JSON‑запрос</option>
          </select>
        </div>
      </div>

      <div
        className="chat-messages"
        ref={logsContainerRef}
      >
        {messages.length === 0 ? (
          <div className="no-messages">Начните диалог — введите сообщение и выберите режим</div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message message-${msg.role}`}
            >
              <strong>{msg.role === 'user' ? 'Вы' : msg.role === 'error' ? 'Ошибка' : 'Ассистент'}: </strong>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Введите запрос (режим: ${selectedMode})...`}
          disabled={isLoading}
          className="chat-input"
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? 'Загружается...' : 'Отправить'}
        </button>
      </form>
    </div>
  );
};

export default OllamaChat;
