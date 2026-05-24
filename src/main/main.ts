// src/main/main.ts

import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, session } from 'electron';
import { createMainWindow } from './windows/mainWindow.ts';
//import { setupMenu } from './menus/menuBuilder.ts.old';
import { registerAIHandlers } from './ipcHandlers/aiHandlers.ts';
import { registerTrainingHandlers } from './ipcHandlers/trainingHandlers.ts';
import { createAIWindow, getAIWindow } from './windows/aiWindow.ts';
import { createBondsWindow, getBondsWindow } from './windows/bondsWindow.ts';
import { createMDWindow,getMDWindow } from './windows/mdWindow.ts';
import { createPGWindow,getPGWindow } from './windows/pgWindow.ts';
import { createOllamaWindow,getOllamaWindow } from './windows/ollamaWindow.ts';
import { AITrainer } from './training';
import { registerBondsHandlers } from './ipcHandlers/bondsHandlers.ts';
import { registerDashboardHandlers } from './ipcHandlers/dashboardHandlers.ts';
import { registerMDHandlers } from './ipcHandlers/mdHandlers.ts';
import { registerPGHandlers } from './ipcHandlers/pgHandlers.ts';
import { registerMarketdataStreamHandlers } from './streams/marketdata.ts';
import { registerOperationsStreamHandlers } from './streams/operations.ts';
import { registerOrdersStreamHandlers } from './streams/orders.ts';
import { createTradingAssistantWindow, getTradingAssistantWindow } from './windows/tradingAssistantWindow';
import { registerTradingAssistantHandlers } from './ipcHandlers/tradingAssistantHandlers';

import fs from 'fs';
import path from 'path';
import { PromptTemplate, validatePromptTemplate } from '@/shared/types/promptgenerator.ts';
import { savePromptTemplateToFile } from './services/promptTemplateSaver.ts';

import { readFile, writeFile, mkdir } from 'fs/promises';
import { exec } from 'child_process';

import WebSocket from 'ws';

import * as grpc from '@grpc/grpc-js';

import {
  mainMenuTemplate,
  aiWindowMenuTemplate,
  bondsWindowMenuTemplate,
  mdWindowMenuTemplate
} from './menus/windowMenus.ts';
import { registerGrpcHandlers } from './ipcHandlers/grpcHandlers.ts';
import { registerTasksHandlers } from './ipcHandlers/tasksHandlers.ts';
import { scheduler } from './services/scheduler';

import { mkdirSync, existsSync } from 'fs';

import { VolumeProfileEngine } from './services/volumeProfileEngine';
import { HistoricalDataLoader } from './services/historicalDataLoader.ts';
import { CandleInterval } from '@/api/tbank/marketdataTypes.ts';
import { VolumeAccumulationStrategy } from './services/backtest/strategies/VolumeAccumulationStrategy.ts';
import { BacktestEngine } from './services/backtest/backtestEngine.ts';
import { OrderManager } from './services/orderManager';

import { connectOrderManager } from './services/tradingConnector';
import { setOrderManagerInstance } from './ipcHandlers/tradingAssistantHandlers';

const scriptsDir = path.join(app.getPath('userData'), 'scripts');
if (!existsSync(scriptsDir)) {
  mkdirSync(scriptsDir, { recursive: true });
  console.log('[Main] Создана папка для скриптов:', scriptsDir);
}

let currentStream: grpc.ClientReadableStream<any> | null = null;

let ws: WebSocket | null = null;

// Этот метод будет вызван после того, как Electron завершит 
// инициализацию и будет готов к созданию окон браузера. 
// Некоторые API можно использовать только после этого события.
app.whenReady().then(() => {
  // Отключаем проверку SSL-сертификатов (только для разработки!)
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(0); // 0 = принять сертификат, -2 = отклонить
  });

  // Создаем главное окно
  const mainWindow = createMainWindow();
  const menu = Menu.buildFromTemplate(mainMenuTemplate);
  // Ищем пункт "Открыть Нейро" и назначаем действие
  const fileMenu = menu.items.find(i => i.label === 'Файл')?.submenu;
  if (fileMenu) {
    const openAI = fileMenu.items.find(i => i.label === 'Открыть Нейро');
    console.log('openAIItem found:', !!openAI);
    if (openAI) {
      openAI.click = () => {
        console.log('click on Open AI');
        const existing = getAIWindow();
        if (existing && !existing.isDestroyed()) {
          existing.focus();
        } else {
          const win = createAIWindow();
          if (win) applyMenuToWindow(win, aiWindowMenuTemplate);
        }
      };
    }

    // Аналогично для остальных пунктов
    const openMD = fileMenu.items.find(i => i.label === 'Открыть Markdown');
    if (openMD) {
      openMD.click = () => {
        const existing = getMDWindow();
        if (existing && !existing.isDestroyed()) existing.focus();
        else {
          const win = createMDWindow();
          if (win) applyMenuToWindow(win, mdWindowMenuTemplate);
        }
      };
    }

    const openBonds = fileMenu.items.find(i => i.label === 'Открыть Облигации');
    if (openBonds) {
      openBonds.click = () => {
        const existing = getBondsWindow();
        if (existing && !existing.isDestroyed()) existing.focus();
        else {
          const win = createBondsWindow();
          if (win) applyMenuToWindow(win, bondsWindowMenuTemplate);
        }
      };
    }

    const openPG = fileMenu.items.find(i => i.label === 'Открыть Генератор запросов');
    if (openPG) {
      openPG.click = () => {
        const existing = getPGWindow();
        if (existing && !existing.isDestroyed()) existing.focus();
        else {
          const win = createPGWindow();
          if (win) applyMenuToWindow(win, mainMenuTemplate); // или специальный шаблон, если есть
        }
      };
    }

    const openTrading = fileMenu.items.find(i => i.label === 'Открыть Трейдер');
    if (openTrading) {
      openTrading.click = () => {
        const existing = getTradingAssistantWindow();
        if (existing && !existing.isDestroyed()) existing.focus();
        else {
          const win = createTradingAssistantWindow();
          if (win) applyMenuToWindow(win, mainMenuTemplate); // или специальный шаблон, если есть
        }
      };
    }
  }

  mainWindow.setMenu(menu);
  console.log('Menu items:', menu.items.map(i => i.label));
  //const fileMenu = menu.items.find(i => i.label === 'Файл');
  //console.log('File submenu items:', fileMenu?.submenu?.items.map(i => i.label));

  
  // Регистрируем обработчики событий, за исключением открытия окон 
  registerDashboardHandlers(mainWindow);
  registerAIHandlers();
  registerPGHandlers();
  registerBondsHandlers();
  registerMDHandlers();
  registerTrainingHandlers();

  registerMarketdataStreamHandlers();
  registerOperationsStreamHandlers();
  registerOrdersStreamHandlers();

  registerGrpcHandlers();

  registerTasksHandlers();
  scheduler.start();

  registerTradingAssistantHandlers();

  // ----------------- Order Manager -----------------
  const orderManager = new OrderManager({
    demoMode: true,   // включите false, когда будете готовы к реальной песочнице
    token: '',        // можно задать позже через UI
    accountId: '',
  });
  connectOrderManager(orderManager);
  setOrderManagerInstance(orderManager);
  // -------------------------------------------------
});

// Завершать работу, когда закрыты все окна, за исключением macOS. Там это обычное дело
// приложения и их строка меню остаются активными до тех пор, пока пользователь не завершит работу
// явно с помощью Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // В OS X при нажатии на значок док-панели и при отсутствии других открытых 
  // окон обычно создается новое окно приложения.
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// В этот файл вы можете включить остальную часть основного кода вашего приложения.
// Вы также можете поместить их в отдельные файлы и импортировать сюда.

app.on('before-quit', () => {
  scheduler.stop();
});

const aiWindow = getAIWindow();

// API для открытия ai-окна из main-окна
ipcMain.handle('open-ai-window', () => {
  const existing = getAIWindow();
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const win = createAIWindow(); // теперь возвращает окно
  if (win) {
    applyMenuToWindow(win, aiWindowMenuTemplate);
  }
});

const bondsWindow = getBondsWindow();
ipcMain.handle('open-bonds-window', () => {
  if (!bondsWindow) {
    createBondsWindow();
  } else {
    bondsWindow.focus();
  }
});

const mdWindow = getMDWindow();
ipcMain.handle('open-md-window', () => {
  if (!mdWindow) {
    createMDWindow();
  } else {
    mdWindow.focus();
  }
});

const pgWindow = getPGWindow();
ipcMain.handle('open-pg-window', () => {
  if (!pgWindow) {
    createPGWindow();
  } else {
    pgWindow.focus();
  }
});

const ollamaWindow = getOllamaWindow();
ipcMain.handle('open-ollama-window', () => {
  if (!ollamaWindow) {
    createOllamaWindow();
  } else {
    ollamaWindow.focus();
  }
});

// Новый обработчик: чтение содержимого файлов
ipcMain.handle('open-file-picker', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Выберите файлы для программирования',
      defaultPath: path.join(__dirname, 'projects'),
      buttonLabel: 'Выбрать файлы',
      properties: ['openFile', 'multiSelections'],
      filters: [
        // Языки программирования (расширенный список)
        {
          name: 'Языки программирования',
          extensions: [
            'js', 'jsx', 'ts', 'tsx', 'd.ts',
            'py', 'pyi', 'pyw', 'pyd',
            'rb', 'gemspec',
            'go', 'mod', 'sum',
            'rs', 'rlib',
            'php', 'phar',
            'java', 'class', 'jar', 'war',
            'scala',
            'kt', 'kts',
            'swift',
            'cs',
            'cpp', 'cc', 'cxx', 'c++',
            'c', 'h', 'hpp',
            'sql', 'plsql'
          ]
        },
        // Конфигурационные файлы и данные
        {
          name: 'Конфигурационные файлы',
          extensions: [
            'json', 'json5',
            'yaml', 'yml',
            'xml', 'xsl', 'xslt', 'xsd',
            'toml',
            'env',
            'gitignore', 'dockerignore', 'npmignore',
            'editorconfig', 'prettierrc', 'eslintrc', 'stylelintrc'
          ]
        },
        // Документация и заметки
        {
          name: 'Документация и заметки',
          extensions: [
            'md', 'markdown',
            'txt', 'text', 'conf', 'ini',
            'log', 'out', 'err'
          ]
        },
        // Веб‑технологии
        {
          name: 'Веб‑технологии',
          extensions: [
            'html', 'htm', 'xhtml',
            'css', 'scss', 'sass', 'less', 'css.map',
            'js.map', 'ts.map',
            'ejs', 'mustache', 'haml', 'pug'
          ]
        },
        // Специфические файлы разработки
        {
          name: 'Файлы разработки',
          extensions: [
            'dockerfile',
            'gitlab-ci.yml', 'travis.yml', 'circle.yml',
            'package.json', 'yarn.lock', 'package-lock.json', 'composer.json',
            'makefile', 'build.xml', 'pom.xml', 'build.gradle',
            'gitattributes', 'gitmodules'
          ]
        },
        // Все файлы
        { name: 'Все файлы', extensions: ['*'] }
      ]
    });
    console.log(result);
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Ошибка в main процессе:', error);
    return null;
  }
});

// Определяем язык программирования по расширению файла
const getLanguageFromFilename = (filename: string): string => {
    // Извлекаем имя файла из полного пути (если нужно)
  const baseName = filename.split(/[\\/]/).pop() || filename;
  // Получаем расширение, приводим к нижнему регистру
  const extension = baseName.split('.').pop()?.toLowerCase();

  // Если расширения нет или оно пустое, возвращаем пустую строку
  if (!extension) {
    return '';
  }
  
  const languageMap: Record<string, string> = {
    // Языки программирования
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    'd.ts': 'typescript', // declaration files
    py: 'python',
    pyi: 'python', // stub files
    pyw: 'python', // Python scripts without console on Windows
    pyd: 'python', // Python DLL on Windows
    rb: 'ruby',
    gemspec: 'ruby', // RubyGems specifications
    go: 'go',
    mod: 'go', // Go module files
    sum: 'go', // Go checksum files
    rs: 'rust',
    rlib: 'rust', // Rust static libraries
    php: 'php',
    phar: 'php', // PHP archives
    java: 'java',
    class: 'java', // compiled Java classes
    jar: 'java', // Java archives
    war: 'java', // Web archives
    scala: 'scala',
    kt: 'kotlin',
    kts: 'kotlin', // Kotlin Script
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    cc: 'cpp', // alternative C++ extension
    cxx: 'cpp', // alternative C++ extension
    'c++': 'cpp', // alternative C++ extension
    c: 'c',
    h: 'c',
    hpp: 'cpp', // C++ header
    sql: 'sql',
    plsql: 'plsql',

    // Веб‑технологии
    html: 'html',
    htm: 'html',
    xhtml: 'xhtml',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    'css.map': 'css-sourcemap', // CSS source maps
    'js.map': 'javascript-sourcemap', // JavaScript source maps
    'ts.map': 'typescript-sourcemap', // TypeScript source maps
    ejs: 'ejs', // Embedded JavaScript
    mustache: 'mustache',
    haml: 'haml',
    pug: 'pug', // formerly Jade

    // Конфигурационные и данные
    json: 'json',
    json5: 'json5', // extended JSON
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    xsl: 'xsl', // XSLT transformations
    xslt: 'xslt', // XSLT files
    xsd: 'xsd', // XML Schema Definition
    toml: 'toml',
    env: 'env',
    gitignore: 'gitignore',
    dockerignore: 'dockerignore',
    npmignore: 'npmignore',
    editorconfig: 'editorconfig',
    prettierrc: 'prettierrc',
    eslintrc: 'eslintrc',
    stylelintrc: 'stylelintrc',

    // Документация и заметки
    md: 'markdown',
    markdown: 'markdown', // full extension
    txt: 'text',
    text: 'text', // alternative to txt
    conf: 'conf', // configuration files
    ini: 'ini', // INI files
    log: 'log',
    out: 'log', // output logs
    err: 'log', // error files

    // Специфические файлы разработки
    dockerfile: 'dockerfile',
    'gitlab-ci.yml': 'gitlab-ci',
    'travis.yml': 'travis',
    'circle.yml': 'circleci',
    'package.json': 'json', // package manifest
    'yarn.lock': 'yarn-lock',
    'package-lock.json': 'json', // npm lockfile
    'composer.json': 'json', // PHP dependencies
    makefile: 'makefile',
    'build.xml': 'ant-build', // Apache Ant
    'pom.xml': 'maven-pom', // Maven Project Object Model
    'build.gradle': 'gradle',
    gitattributes: 'gitattributes',
    gitmodules: 'gitmodules'
  };


  return languageMap[extension] || ''; // Возвращаем язык или пустую строку, если не найдено
};

// Новый обработчик: чтение содержимого файлов
ipcMain.handle('read-files-contents', async (event, filePaths: string[]) => {
  const filesContents: { path: string; filename: string; content: string; language: string }[] = [];

  for (const filePath of filePaths) {
    try {
      const language = getLanguageFromFilename(filePath);
      const fileName = path.basename(filePath);
      // Чтение содержимого файла
      const content = await new Promise<string>((resolve, reject) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
      filesContents.push({ path: filePath, filename: fileName, content: content, language: language });
    } catch (error: any) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      filesContents.push({
        path: filePath,
        filename: path.basename(filePath),
        content: `Ошибка чтения файла: ${error.message}`,
        language: ''
      });
    }
  }
  return filesContents;
});

ipcMain.handle('show-save-dialog', async (event, defaultName: string) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  return filePath;
});

ipcMain.handle('show-open-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  return filePaths?.[0];
});

// Обработчик для сохранения промпта
ipcMain.handle('save-prompt-template', async (event, template: PromptTemplate, fileName?: string) => {
  try {
    // Валидация шаблона
    if (!validatePromptTemplate(template)) {
      throw new Error('Невалидный шаблон промпта');
    }

    // Открываем диалог выбора пути сохранения
    const result = await dialog.showSaveDialog({
      title: 'Сохранить промпт‑шаблон',
      defaultPath: fileName || `${template.title}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, error: 'Сохранение отменено пользователем' };
    }

    const filePath = result.filePath!;

    // Создаём директорию, если нужно
    const dirPath = path.dirname(filePath);
    await mkdir(dirPath, { recursive: true });

    // Сохраняем файл
    await writeFile(
      filePath,
      JSON.stringify({
        ...template,
        createdAt: new Date(template.createdAt).toISOString().split('T')[0],
        updatedAt: new Date(template.updatedAt).toISOString().split('T')[0]
      }, null, 2),
      'utf-8'
    );

    return { success: true, filePath };
  } catch (error) {
    console.error('Ошибка сохранения шаблона:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
});

// Обработчик для загрузки шаблона из файла
ipcMain.handle('load-prompt-template', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Загрузить промпт‑шаблон',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, error: 'Загрузка отменена пользователем' };
    }

    const filePath = result.filePaths[0];

    // Читаем файл
    const fileContent = await readFile(filePath, 'utf-8');
    const loadedTemplate = JSON.parse(fileContent) as PromptTemplate;

    // Базовая валидация загруженного шаблона
    if (!loadedTemplate.id || !loadedTemplate.title) {
      throw new Error('Файл не содержит корректного шаблона промпта');
    }

    return {
      success: true,
      template: loadedTemplate,
      filePath
    };
  } catch (error) {
    console.error('Ошибка загрузки шаблона:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Выберите корневую директорию проекта'
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    console.error('Ошибка при выборе папки:', error);
    throw error;
  }
});

ipcMain.handle('get-project-tree', async (event, folderPath: string) => {
  return new Promise((resolve, reject) => {
    let command: string;

    // Базовая валидация пути
    if (!folderPath || typeof folderPath !== 'string') {
      reject(new Error('Некорректный путь к папке'));
      return;
    }

    // Проверяем существование папки (опционально)
    try {
      fs.accessSync(folderPath, fs.constants.R_OK);
    } catch (err) {
      reject(new Error('Нет доступа к указанной папке или она не существует'));
      return;
    }

    switch (process.platform) {
      case 'win32':
        // Windows: используем встроенную команду tree
        command = `tree "${folderPath}" /f /a`;
        break;

      case 'linux':
        command = `if command -v tree >/dev/null 2>&1; then
          tree -a --dirsfirst -L 3 "${folderPath}";  # Ограничиваем глубину до 3 уровней
        else
          find "${folderPath}" -type d -print -o -type f -print |
          sed -e 's;[^/]*/;├── ;g;s;├── ;└── ;' |
          sed 's;└── ;│   ;g; s;├── ;├── ;g';
        fi`;
        break;

      case 'darwin': // macOS
        // На macOS tree часто не установлен, используем find
        command = `if command -v tree >/dev/null 2>&1; then
          tree -a "${folderPath}";
        else
          find "${folderPath}" -print | sed -e 's;[^/]*/;|____;g;s;|____|; |;g';
        fi`;
        break;

      default:
        reject(new Error(`Неподдерживаемая операционная система: ${process.platform}`));
        return;
    }

    exec(command, { cwd: path.dirname(folderPath) }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(new Error(stderr));
        return;
      }
      resolve(stdout);
    });
  });
});

function applyMenuToWindow(win: BrowserWindow, template: MenuItemConstructorOptions[]) {
  const menu = Menu.buildFromTemplate(template);
  win.setMenu(menu);
}

//// --- Тестовый блок: проверка VolumeProfileEngine ---
//const engine = new VolumeProfileEngine();
//
//engine.on('profileUpdate', (profile) => {
//  console.log('[VolumeProfile] Обновлён профиль:');
//  console.log(`  Инструмент: ${profile.instrumentUid}`);
//  console.log(`  POC: ${profile.poc}`);
//  console.log(`  Value Area: ${profile.valueAreaLow} – ${profile.valueAreaHigh}`);
//  console.log(`  HVN: ${profile.hvn.join(', ')}`);
//  console.log(`  LVN: ${profile.lvn.join(', ')}`);
//  console.log(`  Суммарный объём: ${profile.totalVolume}`);
//});
//
//engine.on('signal', (signal) => {
//  console.log(`[VolumeProfile] Сигнал: ${signal.message}`);
//});
//// --- конец тестового блока ---


//// Временный тест – удалить после проверки
//(async () => {
//  const loader = new HistoricalDataLoader();
//  const token = process.env.VITE_TReadOnly || 't.rGCSw8v2Wku38hBeDq4vibP1rx2laBEKgYuGNzoclMUJNv99mTsuadh8iNn07y447bwZyelwn5GQNR7wHwmsVA';  // замените на реальный токен
//  const uid = 'e6123145-9665-43e0-8413-cd61b8aa9b13';
//
//  try {
//    console.log('[Test] Загружаем дневной профиль за 22 мая...');
//    const profile = await loader.loadDailyProfile(
//      uid,
//      new Date('2026-05-22T00:00:00Z'),
//      new Date('2026-05-23T00:00:00Z'),
//      token
//    );
//    console.log('[Test] Профиль:', profile);
//  } catch (err) {
//    console.error('[Test] Ошибка:', err);
//  }
//})();

(async () => {
  const loader = new HistoricalDataLoader();
  const token = process.env.VITE_TReadOnly || 't.rGCSw8v2Wku38hBeDq4vibP1rx2laBEKgYuGNzoclMUJNv99mTsuadh8iNn07y447bwZyelwn5GQNR7wHwmsVA';  // замените на реальный токен
  const uid = 'e6123145-9665-43e0-8413-cd61b8aa9b13';

  try {
    console.log('[Backtest] Загружаем дневной профиль за 22 мая...');
    const profile = await loader.loadDailyProfile(
      uid,
      new Date('2026-05-22T00:00:00Z'),
      new Date('2026-05-23T00:00:00Z'),
      token
    );
    console.log('[Backtest] Профиль:', profile);

    console.log('[Backtest] Загружаем минутные свечи за 22 мая...');
    const candles = await loader.loadIntradayCandles(
      uid,
      new Date('2026-05-22T07:00:00Z'),
      new Date('2026-05-22T16:00:00Z'),
      token,
      CandleInterval.CANDLE_INTERVAL_1_MIN
    );

    const strategy = new VolumeAccumulationStrategy(uid, profile);
    const engine = new BacktestEngine();
    const stats = engine.run(strategy, candles);

    console.log('[Backtest] Статистика:', stats);
    console.log('[Backtest] Сигналы:', strategy.getSignals());
  } catch (err) {
    console.error('[Backtest] Ошибка:', err);
  }
})();