import { BrowserWindow, ipcMain } from 'electron';
import { createBondsWindow, getBondsWindow } from '../windows/bondsWindow';

import WebSocket from 'ws';

let ws: WebSocket | null = null;

const bondsWindow = getBondsWindow();

export const registerBondsHandlers = () => {
  // регистрируем обработчики API, за исключением open-ai-window

  ipcMain.handle('save-bonds-to-storage', async (event, message) => {
    // Пример регистрации обработчика
    try {
      // Здесь реализуем вызов API AI
      return {};//response;
    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  });

};