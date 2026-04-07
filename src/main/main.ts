import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, session } from 'electron';
import path from 'path';
import started from 'electron-squirrel-startup';

let mainWindow: BrowserWindow | null = null;
let llamaWindow: BrowserWindow | null = null;

let MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:5574';
let LLAMA_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:5575';

process.on('message', (msg: { type: string } & { data: any }) => {
  if (msg?.type === 'MAIN_WINDOW_READY') {
    MAIN_WINDOW_VITE_DEV_SERVER_URL = msg.data.url;
    console.log('Main window URL set to:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else if (msg?.type === 'LLAMA_WINDOW_READY') {
    LLAMA_WINDOW_VITE_DEV_SERVER_URL = msg.data.url;
    console.log('Llama window URL set to:', LLAMA_WINDOW_VITE_DEV_SERVER_URL);
  }
});

// Обработка создания/удаления ярлыков в Windows при установке/деинсталляции.
if (started) {
  app.quit();
}

// Создание главного окна
const createWindow = () => {
  // Создаем главное окно браузера.
  mainWindow = new BrowserWindow({
    width: 1024, //800,
    height: 768, //600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // обязательно для безопасности
      nodeIntegration: false, // рекомендуется отключить
    },
  });

  // и загружаем index.html приложения.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('%cMAIN_WINDOW_VITE_DEV_SERVER_URL: %s','color: cyan;',MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Открываем DevTools.
  mainWindow.webContents.openDevTools();
};

// Создание окна с Llama
function createLlamaWindow() {
  llamaWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Llama Window',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // обязательно для безопасности
      nodeIntegration: false, // рекомендуется отключить
    }
  });

  /*
  if (process.env.NODE_ENV === 'development') {
    llamaWindow.loadURL('http://localhost:5175'); // другой порт для llama
  } else {
    llamaWindow.loadFile(path.join(__dirname, '../.vite/llama-build/index.html'));
  }*/

  // и загружаем index.html приложения.
  if (LLAMA_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('%cLLAMA_WINDOW_VITE_DEV_SERVER_URL: %s','color: cyan;',LLAMA_WINDOW_VITE_DEV_SERVER_URL);
    llamaWindow.loadURL(LLAMA_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    llamaWindow.loadFile(
      //path.join(__dirname, `../renderer/${LLAMA_WINDOW_VITE_NAME}/index.html`),
      path.join(__dirname, `../renderer/llama-window/index.html`),
    );
  }
}

// Руссифицированное меню
const menuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'Файл',
    submenu: [
      {
        label: 'Открыть Нейро',
        click: createLlamaWindow
      },
      {
        label: 'Выйти',
        accelerator: 'CmdOrCtrl+Q',
        click: () => app.quit()
      }
    ]
  },
  {
    label: 'Правка',
    submenu: [
      { label: 'Отменить', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
      { label: 'Повторить', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
      { type: 'separator' },
      { label: 'Вырезать', accelerator: 'CmdOrCtrl+X', role: 'cut' },
      { label: 'Копировать', accelerator: 'CmdOrCtrl+C', role: 'copy' },
      { label: 'Вставить', accelerator: 'CmdOrCtrl+V', role: 'paste' }
    ]
  },
  {
    label: 'Вид',
    submenu: [
      { label: 'Перезагрузить', accelerator: 'CmdOrCtrl+R', role: 'reload' },
      { label: 'Инструменты разработчика', accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', role: 'toggleDevTools' }
    ]
  },
  {
    label: 'Окно',
    submenu: [
      { label: 'Свернуть', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
      { label: 'Увеличить', role: 'zoom' },
      { label: 'Закрыть', accelerator: 'CmdOrCtrl+W', role: 'close' }
    ],
    role: 'windowMenu'
  }
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);


// Этот метод будет вызван после того, как Electron завершит 
// инициализацию и будет готов к созданию окон браузера. 
// Некоторые API можно использовать только после этого события.
app.on("ready", ()=>{
  // это опасное решение
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    // Только для разработки!
    callback(0); // 0 = принять сертификат
  });

  createWindow()}
);

// Завершать работу, когда закрыты все окна, за исключением macOS. Там это обычное дело
// приложения и их строка меню остаются активными до тех пор, пока пользователь не завершит работу
// явно с помощью Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // В OS X при нажатии на значок док-панели и при отсутствии других открытых 
  // окон обычно создается новое окно приложения.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// В этот файл вы можете включить остальную часть основного кода вашего приложения.
// Вы также можете поместить их в отдельные файлы и импортировать сюда.

// API для открытия llama-окна из main-окна
ipcMain.handle('open-llama-window', () => {
  if (!llamaWindow) {
    createLlamaWindow();
  } else {
    llamaWindow.focus();
  }
});

ipcMain.handle('send-to-llama', async (event, message) => {
  try {
    // Здесь реализуем вызов API Llama 3.2
    // Например, через Ollama API или локальный сервер
    const response = await callLlamaAPI(message);
    console.log('API response:', response);
    return response;
  } catch (error) {
    console.error('Llama API error:', error);
    throw error;
  }
});

// Пример функции вызова API
const callLlamaAPI = async (prompt: string): Promise<string> => {
  // Реализация зависит от способа доступа к Llama 3.2:
  // - Локальный запуск через Ollama (`http://localhost:11434/api/generate`)
  // - Облачный API-провайдер
  // - Собственный бэкенд
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:3b',
      prompt: prompt,
      stream: false
    })
  });
  const data = await response.json();
  console.log('callLlamaAPI response:', data);
  return data.response || 'Нет ответа';
};
