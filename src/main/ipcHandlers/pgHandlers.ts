import { BrowserWindow, ipcMain } from 'electron';
import { createPGWindow, getPGWindow } from '../windows/pgWindow';
import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
const pgWindow = getPGWindow();

// Интерфейс возвращаемых данных
interface PackageDependencies {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  category?: string;
  children?: TreeNode[];
}

export const registerPGHandlers = () => {
  // регистрируем обработчики API, за исключением open-ai-window
  
  ipcMain.handle('get-package-dependencies', async (): Promise<PackageDependencies> => {
    try {
      // Путь к package.json в корне собранного приложения
      // В режиме разработки app.getAppPath() вернёт корень проекта
      const packageJsonPath = path.join(app.getAppPath(), 'package.json');

      // Читаем и парсим
      const rawData = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(rawData);

      return {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
      };
    } catch (error) {
      console.error('Ошибка чтения package.json:', error);
      // Возвращаем пустые объекты в случае ошибки
      return {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
      };
    }
  });

  // Этот интерфейс можно вынести в общие типы
  interface PackageJson {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    // ... любые другие поля
    [key: string]: unknown;
  }

  // Получение package.json целиком
  ipcMain.handle('get-package-json', async (): Promise<PackageJson> => {
    try {
      // app.getAppPath() — путь к корню приложения
      // В разработке это корень проекта, в продакшене — resources/app (или asar)
      const packagePath = path.join(app.getAppPath(), 'package.json');
      const rawData = await fs.readFile(packagePath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(rawData);
      return packageJson;
    } catch (error) {
      console.error('Ошибка чтения package.json:', error);
      // Возвращаем пустой объект в случае ошибки
      return {};
    }
  });

  // Обработчик для чтения произвольного конфига
  ipcMain.handle('get-config-file', async (_, fileName: string, parseJson: boolean = true) => {
    try {
      const filePath = path.join(app.getAppPath(), fileName);
      // Проверяем существование и доступность для чтения
      await fs.access(filePath, fs.constants.R_OK);
      const raw = await fs.readFile(filePath, 'utf-8');
      return parseJson ? JSON.parse(raw) : raw;
    } catch (err) {
      // Файл отсутствует или нет прав – не фатально, возвращаем null
      console.warn(`Конфиг ${fileName} не найден или недоступен:`, err);
      return null;
    }
  });

  // Категоризация по имени/расширению файла
  function categorizeFile(fileName: string): string {
    const ext = extname(fileName).toLowerCase();
    const base = basename(fileName).toLowerCase();
  
    // Явные конфигурационные файлы
    if (
      base === 'package.json' ||
      base === '.eslintrc.json' || base === '.eslintrc.js' ||
      base === '.prettierrc' || base === '.prettierrc.json' || base === 'prettier.config.js' ||
      base === 'postcss.config.js' || base === 'tailwind.config.js' ||
      base === '.env' || base.startsWith('.env.') ||
      base === 'forge.config.js' || base === 'forge.config.ts' || base === 'forge.env.d.ts' ||
      base === 'electron-builder.yml' || base === 'builder.config.ts'
    ) {
      return 'config';
    }

    // Все файлы, начинающиеся с tsconfig или vite, если в имени есть 'config'
    if (
      base.startsWith('tsconfig') ||
      (base.startsWith('vite') && base.includes('config'))
    ) {
      return 'config';
    }

    // Дополнительно можно захватить любые *.config.*
    if (base.match(/\.config\.(js|ts|json|yaml|yml)/)) {
      return 'config';
    }
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (['.js', '.jsx'].includes(ext)) return 'javascript';
    if (['.css', '.scss', '.less', '.sass'].includes(ext)) return 'style';
    if (['.html', '.htm'].includes(ext)) return 'html';
    if (['.json'].includes(ext)) return 'data';
    if (['.md', '.txt'].includes(ext)) return 'documentation';
    return 'other';
  }

  async function buildTree(rootPath: string, currentPath: string = rootPath): Promise<TreeNode[]> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      const relativePath = fullPath.replace(rootPath, '').replace(/^[/\\]/, '');
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue; // пропускаем служебные папки
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children: await buildTree(rootPath, fullPath),
        });
      } else {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          extension: extname(entry.name).substring(1),
          category: categorizeFile(entry.name),
        });
      }
    }
    return nodes;
  }

  ipcMain.handle('get-project-tree-json', async (_, folderPath?: string) => {
    const root = folderPath || app.getAppPath();
    const tree = await buildTree(root);   // ваша рекурсивная функция
    return tree;
  });

};