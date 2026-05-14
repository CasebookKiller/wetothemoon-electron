import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { mainMenuTemplate } from '../menus/windowMenus';

import { resolveAppPath } from '../utils/pathUtils';

let mainWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

/*
console.log('=== Preload Script Check ===');
console.log('app.isPackaged:', app.isPackaged);
console.log('process.resourcesPath:', process.resourcesPath);

console.log('preload.js path:', preloadPath);

try {
  const fs = require('fs');
  fs.accessSync(preloadPath, fs.constants.F_OK);
  console.log('✅ Preload script found and accessible!');
} catch (err: any) {
  console.error('❌ Preload script not found or not accessible:', err.message);
}
console.log('===========================');
*/
const MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:5173';
const MAIN_WINDOW_PROD_PATH = path.join(__dirname, '../../renderer/main-window/index.html');

export const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'Мы на Луну!',
    webPreferences: {
      preload: preloadPath,//path.join(__dirname, '../../preload.ts'),
      //preload: resolveAppPath('src/preload.ts'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Устанавливаем меню только для этого окна
  const menu = Menu.buildFromTemplate(mainMenuTemplate);
  mainWindow.setMenu(menu);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    //const url = mainWindow.webContents.getURL() + '/#/dashboard';
    //const url = MAIN_WINDOW_VITE_DEV_SERVER_URL +`/#/ai`;
    //console.log('%cMAIN_WINDOW__URL: %s','color: cyan;',url);
    //mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(MAIN_WINDOW_PROD_PATH);
  }

  mainWindow.webContents.openDevTools();
};

export const getMainWindow = (): BrowserWindow | null => {
  //console.log('getMainWindow: ', mainWindow);
  return (mainWindow);
}
export const getMainWindowProdPath = (): string => MAIN_WINDOW_PROD_PATH;
