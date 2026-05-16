import path from 'path';

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { aiWindowMenuTemplate } from '../menus/windowMenus';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let aiWindow: BrowserWindow | null = null;

//const preloadPath = app.isPackaged
//  ? path.join(process.resourcesPath, 'preloadai.js')
//  : path.join(__dirname, '../../dist/main/preloadai.js');
const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createAIWindow = () => {
  if (aiWindow) {
    aiWindow.focus();
    return;
  }

  aiWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Нейро',
    webPreferences: {
      preload: preloadPath,//preload: path.join(__dirname, '../../src/preloadai.ts'),
      contextIsolation: true, // обязательно для безопасности
      nodeIntegration: false, // рекомендуется отключить
    }
  });

  // Загружаем ТОТ ЖЕ сервер, но с параметром в URL
  //const mainWindow = getMainWindow();
  //const MAIN_WINDOW_PROD_PATH = getMainWindowProdPath();
  if (process.env.NODE_ENV === 'development') {
    aiWindow.loadURL(`${DEV_SERVER_URL}/#/ai`);
  } else {
    aiWindow.loadFile(getMainWindowProdPath());
  }
  //if (mainWindow && process.env.NODE_ENV === 'development') {
  //  const url = mainWindow.webContents.getURL() + '/#/ai';
  //  //const url = MAIN_WINDOW_VITE_DEV_SERVER_URL +`/#/ai`;
  //  //console.log('%cAI_WINDOW__URL: %s','color: cyan;',url);
  //  aiWindow.loadURL(url);
  //  aiWindow.webContents.openDevTools();
  //} else {
  //  aiWindow.loadFile(MAIN_WINDOW_PROD_PATH); 
  //}

  // Для разработки можно открыть DevTools, чтобы видеть ошибки
  //if (process.env.NODE_ENV === 'development') {
  //  aiWindow.webContents.openDevTools();
  //}

  // Индивидуальное меню для AI-окна
  const menu = Menu.buildFromTemplate(aiWindowMenuTemplate);
  aiWindow.setMenu(menu);

  aiWindow.on('closed', () => {
    aiWindow = null;
  });
};

export const getAIWindow = (): BrowserWindow | null => aiWindow;
