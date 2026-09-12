import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { databaseWindowMenuTemplate } from '../menus/windowMenus'; // создадим ниже
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';

let databaseWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createDatabaseWindow = (): BrowserWindow => {
  if (databaseWindow && !databaseWindow.isDestroyed()) {
    databaseWindow.focus();
    return databaseWindow;
  }

  databaseWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Ситч',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    databaseWindow.loadURL(`${DEV_SERVER_URL}/#/database`);
  } else {
    databaseWindow.loadFile(getMainWindowProdPath(), { hash: '/database' });
  }

  const menu = Menu.buildFromTemplate(databaseWindowMenuTemplate);
  databaseWindow.setMenu(menu);

  databaseWindow.on('closed', () => {
    databaseWindow = null;
  });

  return databaseWindow;
};

export const getDatabaseWindow = (): BrowserWindow | null => databaseWindow;