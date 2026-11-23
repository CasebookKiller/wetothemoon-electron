// src/types/navigator.d.ts
export interface NavigatorAPI {
  openWindow: () => Promise<void>;
  // Этап 1: добавим listTools, send, onChunk
}

declare global {
  interface Window {
    electronAPI: {
      navigator?: NavigatorAPI;
      // ... остальные модули
    };
  }
}