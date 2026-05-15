import path from 'path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { getMainWindow } from './mainWindow';

let mdWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createMDWindow = () => {
  if (mdWindow) {
    mdWindow.focus();
    return;
  }

  mdWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Markdown',
    webPreferences: {
      preload: preloadPath,//path.join(__dirname, '../../../preload.ts'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const mainWindow = getMainWindow();
  if (mainWindow && process.env.NODE_ENV === 'development') {
    const url = mainWindow.webContents.getURL() + '/#/md';
    mdWindow.loadURL(url);
    mdWindow.webContents.openDevTools();
  } else {
    // Логика для продакшена
  }

  mdWindow.on('closed', () => {
    mdWindow = null;
  });
};

export const getMDWindow = (): BrowserWindow | null => mdWindow;
