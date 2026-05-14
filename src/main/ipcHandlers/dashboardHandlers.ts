import { BrowserWindow, ipcMain } from 'electron';
import { createMainWindow, getMainWindow } from '../windows/mainWindow';

const mainWindow = getMainWindow();

export const registerDashboardHandlers = () => {
  // регистрируем обработчики API, за исключением open-main-window

  ipcMain.handle('get-tasks', async (event, message) => {
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