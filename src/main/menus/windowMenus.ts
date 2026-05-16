import { app, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { getAIWindow } from '../windows/aiWindow';

export const mainMenuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'Файл',
    submenu: [
      { label: 'Открыть Нейро', id: 'open-ai' },   // добавим id для поиска
      { label: 'Открыть Markdown', id: 'open-md' },
      { label: 'Открыть Облигации', id: 'open-bonds' },
      { label: 'Открыть Генератор запросов', id: 'open-pg' },
      { type: 'separator' },
      { label: 'Выйти', click: () => app.quit(), accelerator: 'CmdOrCtrl+Q' }
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

export const aiWindowMenuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'Нейро',
    submenu: [
      { label: 'Сохранить результат', 
        click: () => {
          // Отправляем IPC‑сообщение для сохранения AI‑результата
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send('save-ai-result');
          }
        }
      },
      { label: 'Очистить историю', click: () => {
          // Отправляем IPC‑сообщение для очистки AI‑истории
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send('clear-ai-history');
          }
        }
      },
      { type: 'separator' },
      { label: 'Экспорт текущего диалога', click: () => {
          const wins = BrowserWindow.getAllWindows();
          // предполагаем, что нужное окно – последнее активное или с определённым title
          // но проще всего найти окно по id или использовать именование. Пока применим поиск по title.
          const aiWin = wins.find(w => w.title === 'Нейро');
          aiWin?.webContents.send('export-current-conversation', {
            action: 'send-data',
            timestamp: Date.now(),
            message: 'Выбран пункт меню "Экспорт текущего диалога"!'
          });
          console.log('Выбран пункт меню "Экспорт текущего диалога" - для отправки сообщения React');
          
        } 
      },
      { label: 'Экспорт всех диалогов', click: () => {
        
        getAIWindow()?.webContents.send('export-all-conversations', {
            action: 'send-data',
            timestamp: Date.now(),
            message: 'Выбран пункт меню "Экспорт всех диалогов"!'
          });
          console.log('Выбран пункт меню "Экспорт всех диалогов" - для отправки сообщения React');
          
        } 
      },
      { label: 'Сохранить в Supabase', click: () => {
        getAIWindow()?.webContents.send('backup-to-supabase', {
            action: 'send-data',
            timestamp: Date.now(),
            message: 'Выбран пункт меню "Сохранить в Supabase"!'
          });
          console.log('Выбран пункт меню "Сохранить в Supabase" - для отправки сообщения React');
        } 
      },
      { type: 'separator' },
      { label: 'Закрыть окно', accelerator: 'CmdOrCtrl+W', role: 'close' }
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

export const mdWindowMenuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'Markdown-окно',
    submenu: [
      { label: 'Экспорт в PDF', click: () => {
          // Отправляем IPC‑сообщение для экспорта в PDF
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send('export-md-to-pdf');
          }
        }
      },
      { label: 'Превью', click: () => {
          // Отправляем IPC‑сообщение для предпросмотра Markdown
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send('toggle-md-preview');
          }
        }
      },
      { type: 'separator' },
      { label: 'Закрыть окно', accelerator: 'CmdOrCtrl+W', role: 'close' }
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

export const bondsWindowMenuTemplate: MenuItemConstructorOptions[] = [
  {
    label: 'Облигации',
    submenu: [
      { label: 'Экспорт в JSON', click: () => {
          // Отправляем IPC‑сообщение для экспорта в JSON
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send('export-bonds-to-json');
          }
        }
      },
      { type: 'separator' },
      { label: 'Закрыть окно', accelerator: 'CmdOrCtrl+W', role: 'close' }
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
