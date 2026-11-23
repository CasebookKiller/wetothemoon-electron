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
export type NavigatorChunk =
  | { type: 'text'; text: string; reset?: boolean }
  | { type: 'done' }
  | { type: string; [k: string]: unknown }; // forward-compat: другие чанки адаптера

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

declare global {
  interface Window {
    electronAPI: {
      navigator?: NavigatorAPI;
      // ... остальные модули
    };
  }
}