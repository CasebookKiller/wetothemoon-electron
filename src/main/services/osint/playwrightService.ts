import { Browser, chromium, Page } from 'playwright';
import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let browser: Browser | null = null;

export async function launchBrowser(): Promise<void> {
  if (browser && browser.isConnected()) return;
  browser = await chromium.launch({
    headless: false, // для отладки; можно сделать опциональным
    // channel: 'chrome' // если системный Chrome
  });
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export function getBrowser(): Browser | null {
  return browser;
}

// Функции для безопасного хранения учётных данных
export function encrypt(text: string): Buffer {
  return safeStorage.encryptString(text);
}

export function decrypt(buffer: Buffer): string {
  return safeStorage.decryptString(buffer);
}

// Пример сохранения/загрузки учётных данных в файл
interface Credentials {
  [site: string]: { login: string; password: string };
}

const credentialsPath = () => path.join(app.getPath('userData'), 'osint_credentials.json');

export function loadCredentials(): Credentials {
  if (!fs.existsSync(credentialsPath())) return {};
  try {
    const data = fs.readFileSync(credentialsPath(), 'utf-8');
    const parsed = JSON.parse(data);
    // Расшифровка
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