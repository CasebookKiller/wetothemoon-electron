import path from 'path';

import { app,BrowserWindow, ipcMain, Menu } from 'electron';
import { bondsWindowMenuTemplate } from '../menus/windowMenus';
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let bondsWindow: BrowserWindow | null = null;

//const preloadPath = app.isPackaged
//  ? path.join(process.resourcesPath, 'preloadbonds.js')
//  : path.join(__dirname, '../../dist/main/preloadbonds.js');
const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createBondsWindow = () => {
  bondsWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'Облигации',
    webPreferences: {
      preload: preloadPath, // path.join(__dirname, '../../../preload.ts'),
      contextIsolation: true, // обязательно для безопасности
      nodeIntegration: false, // рекомендуется отключить
    }
  });

  // Загружаем ТОТ ЖЕ сервер, но с параметром в URL
  //const mainWindow = getMainWindow();
  //const MAIN_WINDOW_PROD_PATH = getMainWindowProdPath();
  if (process.env.NODE_ENV === 'development') {
    bondsWindow.loadURL(`${DEV_SERVER_URL}/#/bonds`);
  } else {
    bondsWindow.loadFile(getMainWindowProdPath());
  }
  //if (mainWindow && process.env.NODE_ENV === 'development') {
  //  const url = mainWindow.webContents.getURL() + '/#/bonds';
  //  //const url = MAIN_WINDOW_VITE_DEV_SERVER_URL +`/#/ai`;
  //  console.log('%cAI_WINDOW__URL: %s','color: cyan;',url);
  //  bondsWindow.loadURL(url);
  //  bondsWindow.webContents.openDevTools();
  //} else {
  //  bondsWindow.loadFile(MAIN_WINDOW_PROD_PATH); 
  //}

  // Для разработки можно открыть DevTools, чтобы видеть ошибки
  //if (process.env.NODE_ENV === 'development') {
  //  aiWindow.webContents.openDevTools();
  //}

  // Индивидуальное меню для AI-окна
  const menu = Menu.buildFromTemplate(bondsWindowMenuTemplate);
  bondsWindow.setMenu(menu);

  bondsWindow.on('closed', () => {
    bondsWindow = null;
  });

  return bondsWindow;
};

export const getBondsWindow = (): BrowserWindow | null => bondsWindow;
