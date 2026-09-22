// src/main/services/osint/playwrightService.ts

import { Browser, chromium, Page } from 'playwright';
import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

let browser: Browser | null = null;
let currentPage: Page | null = null;

export function getPage(): Page | null {
  return currentPage;
}

// === Общие опции для всех запусков ===
// ВАЖНО: минимум флагов. --disable-gpu ломает WebGL (SwiftShader),
// из-за чего ЕСИА блокирует SAML и Pravocaptcha не работает.
const LAUNCH_ARGS = ['--disable-blink-features=AutomationControlled'];

const CONTEXT_OPTIONS = {
  viewport: { width: 1440, height: 900 },
  locale: 'ru-RU',
};

export async function launchBrowser(): Promise<void> {
  if (browser && browser.isConnected()) return;
  console.log('launching browser...');

  try {
    browser = await chromium.launch({
      headless: false,
      args: LAUNCH_ARGS,
    });

    const context = await browser.newContext(CONTEXT_OPTIONS);
    currentPage = await context.newPage();
    await currentPage.goto('https://www.rusprofile.ru', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Browser launched and navigated to rusprofile.ru');
  } catch (error) {
    console.error('Failed to launch browser:', error);
    throw error;
  }
}

export async function launchBrowserWithRusprofile(): Promise<void> {
  if (browser && browser.isConnected()) return;

  browser = await chromium.launch({
    headless: false,
    args: LAUNCH_ARGS,
  });

  const context = await browser.newContext(CONTEXT_OPTIONS);
  currentPage = await context.newPage();
  await currentPage.goto('https://www.rusprofile.ru', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Browser launched and navigated to rusprofile.ru');
}

// ==================== СЕССИИ ====================

/**
 * Возвращает путь к файлу сохранённого состояния браузера (cookies, localStorage)
 * для указанного сайта.
 */
export function getStorageStatePath(site: string): string {
  return path.join(app.getPath('userData'), `${site}_storage.json`);
}

/**
 * Запускает браузер, восстанавливая сессию из файла, если он существует.
 * Опции запуска идентичны bash-тесту launch-manual.mjs — минимум флагов,
 * viewport и locale заданы. Это критично для прохождения ЕСИА и Pravocaptcha.
 */
export async function launchBrowserWithSession(
  site: string,
  initialUrl?: string
): Promise<void> {
  if (browser && browser.isConnected()) return;
  console.log(`Запуск браузера с сессией для ${site}...`);

  const statePath = getStorageStatePath(site);
  let contextOptions: any = { ...CONTEXT_OPTIONS };

  if (fs.existsSync(statePath)) {
    console.log(`Найден файл сессии ${site}, восстанавливаем состояние.`);
    contextOptions.storageState = statePath;
  } else {
    console.log(`Файл сессии ${site} не найден, будет выполнен вход.`);
  }

  try {
    browser = await chromium.launch({
      headless: false,
      args: LAUNCH_ARGS,
    });

    const context = await browser.newContext(contextOptions);

    // Блокируем WASM-модули Pravocaptcha. У kad.arbitr они по неочевидным URL,
    // не /Content/Static/js/. Абсолютные адреса — чтобы не задеть ЕСИА.
    //
    // При abort() jQuery вызывает error-колбэк, что для Pravocaptcha означает:
    //   - initializeFp → reject → .finally() → loadWasm
    //   - loadWasm → error → callback() → checkRelevance
    // Это позволяет chain пройти до конца без падающего WASM.
    await context.route('https://kad.arbitr.ru/Wasm/api/v1/wasm.js*', (route) => route.abort());
    await context.route('https://kad.arbitr.ru/Wasm/api/v1/wasm_bg.wasm*', (route) => route.abort());
    await context.route('https://kad.arbitr.ru/Content/Static/js/common/fp.js*', (route) => route.abort());
    await context.route('https://kad.arbitr.ru/Content/Static/js/common/fp_bg.wasm*', (route) => route.abort());

    await context.addInitScript(() => {
      // deviceMemory — как было
      try {
        Object.defineProperty(Navigator.prototype, 'deviceMemory', {
          get: () => 8,
          configurable: true,
        });
      } catch {}
    });

    currentPage = await context.newPage();

    const url = initialUrl || 'https://www.rusprofile.ru';
    await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`Браузер запущен, страница ${url} открыта.`);
  } catch (error) {
    console.error('Ошибка при запуске браузера с сессией:', error);
    throw error;
  }
}

// ==================== УПРАВЛЕНИЕ ====================

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    currentPage = null;
  }
}

export function getBrowser(): Browser | null {
  return browser;
}

// ==================== КРЕДЫ ====================

export function encrypt(text: string): Buffer {
  return safeStorage.encryptString(text);
}

export function decrypt(buffer: Buffer): string {
  return safeStorage.decryptString(buffer);
}

interface Credentials {
  [site: string]: { login: string; password: string };
}

const credentialsPath = () => path.join(app.getPath('userData'), 'osint_credentials.json');

export function loadCredentials(): Credentials {
  if (!fs.existsSync(credentialsPath())) return {};
  try {
    const data = fs.readFileSync(credentialsPath(), 'utf-8');
    const parsed = JSON.parse(data);
    for (const site in parsed) {
      parsed[site].login = decrypt(Buffer.from(parsed[site].login, 'base64'));
      parsed[site].password = decrypt(Buffer.from(parsed[site].password, 'base64'));
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveCredentials(credentials: Credentials): void {
  const encrypted: Credentials = {};
  for (const site in credentials) {
    encrypted[site] = {
      login: encrypt(credentials[site].login).toString('base64'),
      password: encrypt(credentials[site].password).toString('base64'),
    };
  }
  fs.writeFileSync(credentialsPath(), JSON.stringify(encrypted, null, 2), 'utf-8');
}

export function getCredentials(site: string): { login: string; password: string } | null {
  const creds = loadCredentials();
  return creds[site] || null;
}