import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let pgWindow: BrowserWindow | null = null;

//const preloadPath = app.isPackaged
//  ? path.join(process.resourcesPath, 'preloadpg.js')
//  : path.join(__dirname, '../../dist/main/preloadpg.js');
const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createPGWindow = () => {
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

  //const mainWindow = getMainWindow();
    if (process.env.NODE_ENV === 'development') {
      pgWindow.loadURL(`${DEV_SERVER_URL}/#/pg`);
    } else {
      pgWindow.loadFile(getMainWindowProdPath());
    }
  //if (mainWindow && process.env.NODE_ENV === 'development') {
  //  const url = mainWindow.webContents.getURL() + '/#/pg';
  //  pgWindow.loadURL(url);
  //  pgWindow.webContents.openDevTools();
  //} else {
  //  // Логика для продакшена
  //}

  pgWindow.on('closed', () => {
    pgWindow = null;
  });

  return pgWindow;
};

export const getPGWindow = (): BrowserWindow | null => pgWindow;
