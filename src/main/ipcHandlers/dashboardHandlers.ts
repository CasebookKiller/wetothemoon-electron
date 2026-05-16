import { BrowserWindow, ipcMain } from 'electron';

export const registerDashboardHandlers = (mainWindow: BrowserWindow) => {
  // регистрируем обработчики API, за исключением open-main-window

  ipcMain.handle('get-tasks', async (event, message) => {
    try {
      // Здесь реализуем вызов API AI
      return {}; // response;
    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  });
};