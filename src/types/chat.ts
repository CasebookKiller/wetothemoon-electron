export interface CodeBlock {
  language: string;
  content: string;
}

export interface ModelSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  contextLength?: number;
  stopSequences?: string[];
  extended?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  tags: string[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON-строка
  };
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant' | 'tool';
  timestamp: Date;
  codeBlocks?: CodeBlock[];
  isComplete?: boolean; // Флаг завершения ответа
  responseTimeMs?: number; // Время генерации ответа в миллисекундах
  toolCalls?: ToolCall[]; // Новые tool-calls
  toolResults?: Array<{
    toolCallId: string;
    result: any;
  }>; // Результаты выполнения инструментов
}

export interface Tag {
  id: string;
  name: string;
  color?: string; // опционально — цвет для визуализации
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  totalResponseTimeMs: number;
  tags?: Tag[]; // массив тегов для диалога
}

export interface ChatState {
  currentConversationId: string | null;
  conversations: Record<string, Conversation>;
}

export interface SavedConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string; // сохраняем как строку ISO
  updatedAt: string;
}

export interface LocalStorageData {
  currentConversationId: string | null;
  conversations: Record<string, SavedConversation>;
  lastBackup: string | null; // дата последнего бэкапа
}