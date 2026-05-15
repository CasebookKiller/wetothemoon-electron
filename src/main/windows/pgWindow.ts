import { app, BrowserWindow, ipcMain } from 'electron';
import { getMainWindow } from './mainWindow';
import path from 'path';

let pgWindow: BrowserWindow | null = null;

//const preloadPath = app.isPackaged
//  ? path.join(process.resourcesPath, 'preloadpg.js')
//  : path.join(__dirname, '../../dist/main/preloadpg.js');
const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createPGWindow = () => {
  if (pgWindow) {
    pgWindow.focus();
    return;
  }

  pgWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Генератор запросов',
    webPreferences: {
      preload: preloadPath,//preload: path.join(__dirname, '../../../preload.ts'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const mainWindow = getMainWindow();
  if (mainWindow && process.env.NODE_ENV === 'development') {
    const url = mainWindow.webContents.getURL() + '/#/pg';
    pgWindow.loadURL(url);
    pgWindow.webContents.openDevTools();
  } else {
    // Логика для продакшена
  }

  pgWindow.on('closed', () => {
    pgWindow = null;
  });
};

export const getPGWindow = (): BrowserWindow | null => pgWindow;
