import path from 'path';
import { app, BrowserWindow, Menu } from 'electron';
import { mainMenuTemplate } from '../menus/windowMenus'; // или специальный шаблон, если создадите
import { DEV_SERVER_URL, getMainWindowProdPath } from './paths';
import { osintWindowMenuTemplate } from '../menus/windowMenus';

let osintWindow: BrowserWindow | null = null;

const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload.js')
  : path.join(__dirname, '../../dist/main/preload.js');

export const createOsintWindow = (): BrowserWindow => {
  if (osintWindow && !osintWindow.isDestroyed()) {
    osintWindow.focus();
    return osintWindow;
  }

  osintWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'OSINT Tools',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    osintWindow.loadURL(`${DEV_SERVER_URL}/#/osint`);
  } else {
    osintWindow.loadFile(getMainWindowProdPath(), { hash: '/osint' });
  }

  // внутри createOsintWindow после создания окна:
  const menu = Menu.buildFromTemplate(osintWindowMenuTemplate);
  osintWindow.setMenu(menu);


  osintWindow.on('closed', () => {
    osintWindow = null;
  });

  return osintWindow;
};

export const getOsintWindow = (): BrowserWindow | null => osintWindow;