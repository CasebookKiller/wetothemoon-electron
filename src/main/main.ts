import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
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

import fs from 'fs';
import path from 'path';
import { PromptTemplate, validatePromptTemplate } from '@/types/promptgenerator.ts';
import { savePromptTemplateToFile } from './promptTemplateSaver.ts';

import { readFile, writeFile, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import WebSocket from 'ws';

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

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
  createMainWindow();
  
  // Регистрируем обработчики событий, за исключением открытия окон 
  registerDashboardHandlers();
  registerAIHandlers();
  registerPGHandlers();
  registerBondsHandlers();
  registerMDHandlers();
  registerTrainingHandlers();
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

const aiWindow = getAIWindow();

// API для открытия ai-окна из main-окна
ipcMain.handle('open-ai-window', () => {
  if (!aiWindow) {
    createAIWindow();
  } else {
    aiWindow.focus();
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



let currentRequest: import('http').ClientRequest | null = null;

console.log('[Main] registerMDStreamHandlers called');

const PROTO_PATH = path.join(__dirname, 'proto', 'marketdata.proto');
console.log('[Main] Proto path:', PROTO_PATH);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition) as any;
const MarketDataStreamService = proto.tinkoff.public.invest.api.contract.v1.MarketDataStreamService;
console.log('[Main] Proto loaded, service:', !!MarketDataStreamService);

const client = new MarketDataStreamService(
  'invest-public-api.tbank.ru:443',
  grpc.credentials.createSsl(
    null,        // корневой сертификат (null = использовать системные)
    null,        // приватный ключ
    null,        // сертификат клиента (если есть)
    { rejectUnauthorized: false }   // ← отключаем проверку сертификата
  ),
  {
    'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru',
  }
);
console.log('[Main] gRPC client created');

ipcMain.handle('md-stream-start', async (_, token: string, requestBody: any) => {
  console.log('[Main] md-stream-start called');
  console.log('[Main] Token:', token?.slice(0, 12) + '...');
  console.log('[Main] Request body:', JSON.stringify(requestBody).slice(0, 400));

  if (currentStream) {
    console.log('[Main] Stopping previous stream');
    currentStream.cancel();
    currentStream = null;
  }

  const metadata = new grpc.Metadata();
  metadata.add('Authorization', `Bearer ${token}`);

  console.log('[Main] Calling MarketDataServerSideStream...');
  const stream = client.MarketDataServerSideStream(requestBody, metadata);
  currentStream = stream;
  console.log('[Main] Stream created');

  // Буфер для неполных данных (если data приходит строкой)
  let buffer = '';

  stream.on('data', (data: any) => {
    // gRPC может отдавать уже готовый объект – сразу отправляем
    if (typeof data !== 'string' && typeof data !== 'object') return;

    // Если пришёл объект, превращаем в строку и добавляем в буфер
    const chunk = typeof data === 'string' ? data : JSON.stringify(data);
    buffer += chunk;

    // Потоковый разбор: ищем полные JSON-объекты по фигурным скобкам
    let begin = 0;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];

      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        if (depth === 0) begin = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = buffer.substring(begin, i + 1);
          try {
            // Проверяем, что jsonStr – валидный JSON
            JSON.parse(jsonStr);
            const win = getBondsWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send('md-stream-data', jsonStr);
            } else {
              console.warn('[Main] Bonds window not available');
            }
          } catch {
            // Невалидный JSON – игнорируем
            console.warn('[Main] Skipped invalid JSON fragment:', jsonStr.slice(0, 100));
          }
        }
      }
    }

    // Оставляем в буфере только незавершённый остаток
    if (depth > 0) {
      buffer = buffer.substring(begin);
    } else {
      buffer = '';
    }
  });

  stream.on('status', (status: any) => {
    const win = getBondsWindow();
    if (win) win.webContents.send('md-stream-closed');
  });

  stream.on('error', (err: any) => {
    const win = getBondsWindow();
    if (win) win.webContents.send('md-stream-error', err.message);
  });

  console.log('[Main] Request sent');
});

ipcMain.handle('md-stream-stop', async () => {
  console.log('[Main] md-stream-stop called');
  if (currentStream) {
    currentStream.cancel();
    currentStream = null;
  }
});

// ---------- OperationsStreamService ----------

let opsStreams: Record<string, grpc.ClientReadableStream<any> | null> = {
  portfolio: null,
  positions: null,
  operations: null,
};

let opsClient: any;

function ensureOpsClient(mainWindow: BrowserWindow) {
  if (opsClient) return opsClient;
  
  const OPS_PROTO_PATH = path.join(__dirname, 'proto', 'operations.proto');
  const packageDefinition = protoLoader.loadSync(OPS_PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  const OperationsStreamService = proto.tinkoff.public.invest.api.contract.v1.OperationsStreamService;

  opsClient = new OperationsStreamService(
    'invest-public-api.tbank.ru:443',
    grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false }),
    { 'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru' }
  );
  return opsClient;
}

ipcMain.handle('ops-stream-start', async (event, streamType: string, token: string, requestBody: any) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender) || null;
  const client = ensureOpsClient(mainWindow!);
  const metadata = new grpc.Metadata();
  metadata.add('Authorization', `Bearer ${token}`);

  // Остановить предыдущий стрим этого же типа
  if (opsStreams[streamType]) {
    opsStreams[streamType].cancel();
    opsStreams[streamType] = null;
  }

  let stream: grpc.ClientReadableStream<any>;
  try {
    if (streamType === 'portfolio') {
      stream = client.PortfolioStream(requestBody, metadata);
    } else if (streamType === 'positions') {
      stream = client.PositionsStream(requestBody, metadata);
    } else if (streamType === 'operations') {
      stream = client.OperationsStream(requestBody, metadata);
    } else {
      throw new Error(`Unknown stream type: ${streamType}`);
    }
  } catch (err: any) {
    mainWindow?.webContents.send('ops-stream-error', streamType, err.message);
    return;
  }

  opsStreams[streamType] = stream;

  let buffer = '';
  stream.on('data', (data: any) => {
    const chunk = JSON.stringify(data);
    buffer += chunk;
    // Потоковый парсер JSON (аналогично MarketData)
    let begin = 0, depth = 0, inString = false, escape = false;
    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') { if (depth === 0) begin = i; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = buffer.substring(begin, i + 1);
          try {
            JSON.parse(jsonStr);
            mainWindow?.webContents.send(`ops-${streamType}-data`, jsonStr);
          } catch { /* ignore invalid */ }
        }
      }
    }
    buffer = depth > 0 ? buffer.substring(begin) : '';
  });

  stream.on('status', (status: grpc.StatusObject) => {
    mainWindow?.webContents.send(`ops-${streamType}-closed`);
    opsStreams[streamType] = null;
  });

  stream.on('error', (err: any) => {
    mainWindow?.webContents.send('ops-stream-error', streamType, err.message);
    opsStreams[streamType] = null;
  });
});

ipcMain.handle('ops-stream-stop', async () => {
  for (const key of Object.keys(opsStreams)) {
    opsStreams[key]?.cancel();
    opsStreams[key] = null;
  }
});



// ---------- OrdersStreamService ----------

let ordersStreams: Record<string, grpc.ClientReadableStream<any> | null> = {
  trades: null,
  orderState: null,
};

let ordersClient: any;

function ensureOrdersClient() {
  if (ordersClient) return ordersClient;
  const PROTO_PATH = path.join(__dirname, 'proto', 'orders.proto'); // ваш файл с OrdersStreamService
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, { /* ... */ });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  const OrdersStreamService = proto.tinkoff.public.invest.api.contract.v1.OrdersStreamService;
  ordersClient = new OrdersStreamService(
    'invest-public-api.tbank.ru:443',
    grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false }),
    { 'grpc.ssl_target_name_override': 'invest-public-api.tbank.ru' }
  );
  return ordersClient;
}

ipcMain.handle('orders-stream-start', async (event, streamType: string, token: string, requestBody: any) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender) || null;
  const client = ensureOrdersClient();
  const metadata = new grpc.Metadata();
  metadata.add('Authorization', `Bearer ${token}`);

  if (ordersStreams[streamType]) {
    ordersStreams[streamType]!.cancel();
    ordersStreams[streamType] = null;
  }

  let stream: grpc.ClientReadableStream<any>;
  try {
    if (streamType === 'trades') {
      stream = client.TradesStream(requestBody, metadata);
    } else if (streamType === 'orderState') {
      stream = client.OrderStateStream(requestBody, metadata);
    } else {
      throw new Error(`Unknown stream type: ${streamType}`);
    }
  } catch (err: any) {
    mainWindow?.webContents.send('orders-stream-error', streamType, err.message);
    return;
  }

  ordersStreams[streamType] = stream;

  let buffer = '';
  stream.on('data', (data: any) => {
    const chunk = JSON.stringify(data);
    buffer += chunk;
    // Потоковый парсер JSON (как в OperationsStream)
    let begin = 0, depth = 0, inString = false, escape = false;
    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') { if (depth === 0) begin = i; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = buffer.substring(begin, i + 1);
          try {
            JSON.parse(jsonStr);
            mainWindow?.webContents.send(`orders-${streamType}-data`, jsonStr);
          } catch { /* ignore */ }
        }
      }
    }
    buffer = depth > 0 ? buffer.substring(begin) : '';
  });

  stream.on('status', () => {
    mainWindow?.webContents.send(`orders-${streamType}-closed`);
    ordersStreams[streamType] = null;
  });

  stream.on('error', (err: any) => {
    mainWindow?.webContents.send('orders-stream-error', streamType, err.message);
    ordersStreams[streamType] = null;
  });
});

ipcMain.handle('orders-stream-stop', async () => {
  for (const key of Object.keys(ordersStreams)) {
    ordersStreams[key]?.cancel();
    ordersStreams[key] = null;
  }
});