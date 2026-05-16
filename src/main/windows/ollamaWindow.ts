import path from 'path';
import { app, BrowserWindow } from 'electron';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

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

  //const mainWindow = getMainWindow();
  if (process.env.NODE_ENV === 'development') {
    ollamaWindow.loadURL(`${DEV_SERVER_URL}/#/ollama`);
  } else {
    ollamaWindow.loadFile(getMainWindowProdPath());
  }
  //if (mainWindow && process.env.NODE_ENV === 'development') {
  //  const url = mainWindow.webContents.getURL() + '/#/ollama';
  //  ollamaWindow.loadURL(url);
  //  ollamaWindow.webContents.openDevTools();
  //} else {
  //  // Логика для продакшена
  //}

  ollamaWindow.on('closed', () => {
    ollamaWindow = null;
  });
};

export const getOllamaWindow = (): BrowserWindow | null => ollamaWindow;
