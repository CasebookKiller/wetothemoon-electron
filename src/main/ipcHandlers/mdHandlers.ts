import { BrowserWindow, ipcMain } from 'electron';
import { createMDWindow, getMDWindow } from '../windows/mdWindow';

const mdWindow = getMDWindow();

export const registerMDHandlers = () => {
  // регистрируем обработчики API, за исключением open-md-window

  ipcMain.handle('get-md-file', async (event, message) => {
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