import React, { Suspense, useState, useEffect } from 'react';
import { Message } from '../../../types/chat';
import { MarkdownHooks } from 'react-markdown';

import { unified } from 'unified';

import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import remarkParse from 'remark-parse';

import CodeBlock from '../CodeBlock/CodeBlock';
import MessageActions from '../MessageActions/MessageActions';

import './MessageList.css';

const MAX_CONTEXT_TOKENS = 40000; // Для Qwen3: 40 960, оставляем запас

interface CodeBlock {
  language: string;
  content: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  className?: string;
}

const countTokens = (text: string): number => {
  // Упрощённая эвристика: 1 токен ≈ 4 символа для английского, 2–3 для русского
  return Math.ceil(text.length / 3);
};

async function extractCodeBlocks(markdown: string): Promise<{ language: string; content: string }[]> {
  const file = await unified()
    .use(remarkParse)
    .parse(markdown);

  const codeBlocks: Array<{ language: string; content: string }> = [];
  const traverse = (node: any) => {
    if (node.type === 'code') {
      codeBlocks.push({
        language: node.lang || 'text',
        content: node.value || ''
      });
    }
    if (node.children) {
      node.children.forEach((child: any) => traverse(child));
    }
  };
  traverse(file);
  return codeBlocks;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading, className }) => {
  // Состояние для хранения извлечённого кода для всех сообщений
  const [extractedCodeMap, setExtractedCodeMap] = useState<Record<string, CodeBlock[]>>({});

  // Предпарсим код для всех сообщений при монтировании компонента
  useEffect(() => {
    const loadAllCodeBlocks = async () => {
      try {
        const codePromises = messages.map(async (message) => {
          const codeBlocks = await extractCodeBlocks(message.text);
          return { [message.id]: codeBlocks };
        });
        const results = await Promise.all(codePromises);
        const map = results.reduce((acc, item) => ({ ...acc, ...item }), {});
        setExtractedCodeMap(map);
      } catch (error) {
        console.error('Error extracting code blocks:', error);
      }
    };
    loadAllCodeBlocks();
  }, [messages]);

  // Функция для извлечения языка из className
  const getLanguageFromClassName = (className: string | undefined): string => {
    if (!className) return 'text';
    const match = className.match(/language-(\w+)/);
    return match ? match[1] : 'text';
  };

  const tokensUsed = messages.reduce((sum, msg) => sum + countTokens(msg.text), 0);
  const percentage = (tokensUsed / MAX_CONTEXT_TOKENS) * 100;

  // В JSX:
  const indicator = <div className='text-accent'>
    Контекст: {tokensUsed}/{MAX_CONTEXT_TOKENS} ({percentage.toFixed(1)}%)
  </div>

  return (
    <div className="message-list">
      <div className={`message-list-container bottom-0 flex flex-column gap-4 ${className}`}>
        <div className="context-indicator ml-2">
          {indicator}
        </div>
        {messages.map(message => {
          // Получаем уже извлечённый код для текущего сообщения
          const extractedCode = extractedCodeMap[message.id] || [];

          return (
            <div
              key={message.id}
              className={`p-3 border-round surface-card ${
                message.sender === 'user' ? 'ml-auto' : 'mr-auto'
              }`}
              style={{ maxWidth: '80%' }}
            >
              <div className="font-bold text-accent mb-2">
                {message.sender === 'user' ? 'Вы' : 'Нейро'}
              </div>

              <Suspense fallback={<div>Загрузка подсветки синтаксиса...</div>}>
                <MarkdownHooks
                  remarkPlugins={[
                    [remarkRehype],
                    [remarkGfm],
                  ]}
                  rehypePlugins={[
                    [rehypeRaw],
                    [rehypeHighlight, {
                      ignoreMissing: true,
                      detect: false,
                      code: (className: any, node: any) => {
                        const parent = node.parent;
                        if (parent && parent.tagName !== 'pre') {
                          return 'inline-code';
                        }
                        return className;
                      }
                    }]
                  ]}
                  components={{
                    // ... существующие компоненты
                    code: ({ node, className, children, ...props }) => {
                      const language = getLanguageFromClassName(className);
                      // Ищем соответствующий блок кода
                      const codeBlock = extractedCode.find(block =>
                        block.language === language
                      );

                      // Если это inline-код (в одной строке), отображаем без рамки
                      if (node?.data?.meta || String(children).includes('\n')) {
                        return (
                          <CodeBlock
                            language={language}
                            className={className}
                            codeString={codeBlock?.content || String(children)}
                          >
                            {children}
                          </CodeBlock>
                        );
                      }

                      // Inline-код — просто оборачиваем в <code>
                      return <code className={className} {...props}>{children}</code>;
                    }
                  }}
                >
                  {message.text}
                </MarkdownHooks>
              </Suspense>

              <div className="text-500 text-sm mt-2">
                <span className='mx-2'>{ new Date(message.timestamp).toLocaleString() }</span>
                {message.sender === 'assistant' && isLoading && (
                    <span className="text-700">
                      <span className="pi pi-spin pi-spinner" />
                      &nbsp;Готовит ответ...
                    </span>
                )}
                {message.responseTimeMs && (
                  <span className="text-100">
                    Время ответа: {(message.responseTimeMs / 1000).toFixed(1)} с
                  </span>
                )}

              </div>

              {/* Кнопки только для ответов «Нейро» И после завершения ответа */}
              {message.sender === 'assistant' && message.isComplete && (
                <MessageActions
                  messageText={message.text}
                  messageId={message.id}
                />
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MessageList;