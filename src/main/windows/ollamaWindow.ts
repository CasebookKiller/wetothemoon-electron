import path from 'path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { getMainWindow } from './mainWindow';

let ollamaWindow: BrowserWindow | null = null;
const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createOllamaWindow = () => {
  if (ollamaWindow) {
    ollamaWindow.focus();
    return;
  }

  ollamaWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Клиент Ollama ',
    webPreferences: {
      preload: preloadPath,//path.join(__dirname, '../../../preload.ts'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const mainWindow = getMainWindow();
  if (mainWindow && process.env.NODE_ENV === 'development') {
    const url = mainWindow.webContents.getURL() + '/#/ollama';
    ollamaWindow.loadURL(url);
    ollamaWindow.webContents.openDevTools();
  } else {
    // Логика для продакшена
  }

  ollamaWindow.on('closed', () => {
    ollamaWindow = null;
  });
};

export const getOllamaWindow = (): BrowserWindow | null => ollamaWindow;
