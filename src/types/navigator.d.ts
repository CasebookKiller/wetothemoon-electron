// src/types/navigator.d.ts

/** Категория инструмента (зеркало ToolKind из toolRegistry). */
export type NavigatorToolKind = 'llm' | 'site' | 'utility';

/** Описание инструмента для UI (сериализуемо по IPC, без функций). */
export interface NavigatorToolInfo {
  id: string;
  kind: NavigatorToolKind;
  displayName: string;
  requiresAuth: boolean;
}

/**
 * Чанк стрима LLM.
 * `text` — приращение; при `reset: true` — заменить весь буфер; `done` — финал.
 */
/** Формат содержимого чанка (зеркало ChunkFormat из providers/types.ts). */
export type NavigatorChunkFormat = 'text' | 'markdown' | 'html';

/**
 * Чанк стрима LLM. Зеркалит MessageChunk из providers/types.ts,
 * но с дискриминированным union для UI и fallback-веткой для forward-compat
 * (если завтра адаптер добавит новый `type` — UI не сломается на типах).
 */
export type NavigatorChunk =
  | { type: 'text'; text: string; reset?: boolean; format?: NavigatorChunkFormat }
  | { type: 'reasoning'; text: string }
  | { type: 'usage'; usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }
  | { type: 'done' }
  | { type: 'error'; text: string }
  | { type: 'unknown'; raw?: unknown }; // forward-compat: другие чанки адаптера

export interface NavigatorAPI {
  listTools: () => Promise<{
    success: boolean;
    data?: NavigatorToolInfo[];
    error?: string;
  }>;
  send: (
    profileId: string,
    message: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onChunk: (
    cb: (data: { profileId: string; chunk: NavigatorChunk }) => void,
  ) => () => void;
}

/** Диалог из gateway.db (зеркало ConversationListItem из cache/types.ts). */
export interface NavigatorConversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
  lastMessageAt?: number;
  pinned: boolean;
}

/** Сообщение из gateway.db (зеркало CachedMessage, но упрощённое для UI). */
export interface NavigatorStoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  format: 'text' | 'markdown' | 'html';
  thinking?: string;
  blocks?: unknown[];
  sources?: unknown[];
  sequence: number;
  savedAt: number;
}

export interface NavigatorAPI {
  listTools: () => Promise<{ success: boolean; data?: NavigatorToolInfo[]; error?: string }>;
  send: (profileId: string, message: string) => Promise<{ success: boolean; error?: string }>;
  onChunk: (cb: (data: { profileId: string; chunk: NavigatorChunk }) => void) => () => void;

  listConversations: (profileId: string) => Promise<{
    success: boolean;
    data?: NavigatorConversation[];
    error?: string;
  }>;
  getMessages: (conversationId: string) => Promise<{
    success: boolean;
    data?: NavigatorStoredMessage[];
    error?: string;
  }>;

  syncConversations: (profileId: string) => Promise<{ success: boolean; data?: { synced: number }; error?: string }>;
  syncMessages: (profileId: string, convId: string, url: string) => Promise<{ success: boolean; data?: { count: number }; error?: string }>;

  /** Событие: диалог сохранён/обновлён (после navigator:send или sync-messages). */
  onConversationSaved: (cb: (data: NavigatorConversationSaved) => void) => () => void;
}

export interface NavigatorConversationSaved {
  profileId: string;
  convId: string;
  count: number;
}

declare global {
  interface Window {
    electronAPI: {
      navigator?: NavigatorAPI;
      // ... остальные модули
    };
  }
}