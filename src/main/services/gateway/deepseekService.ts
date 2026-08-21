// src/main/services/gateway/deepseekService.ts

import { app, safeStorage } from 'electron';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getCredentials, setCredentials } from '../osint/credentials'; // переиспользуем
import * as dotenv from 'dotenv';

dotenv.config();

const DEEPSEEK_URL = 'https://chat.deepseek.com';
const LOGIN_URL = 'https://chat.deepseek.com/sign_in';
const STORAGE_FILE = 'deepseek_storage.json';

interface DeepSeekCredentials {
  login: string;
  password: string;
}

interface LaunchResult {
  status: string;
  loginRequired?: boolean;
}

export class DeepSeekService {
  private static instance: DeepSeekService;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;

  private constructor() {}

  static getInstance(): DeepSeekService {
    if (!DeepSeekService.instance) {
      DeepSeekService.instance = new DeepSeekService();
    }
    return DeepSeekService.instance;
  }

  private getStoragePath(): string {
    return path.join(app.getPath('userData'), STORAGE_FILE);
  }

  private getCredentialsFromEnv(): DeepSeekCredentials | null {
    const login = process.env.VITE_DEEPSEEK_LOGIN;
    const password = process.env.VITE_DEEPSEEK_PASSWORD;
    if (login && password) {
      return { login, password };
    }
    return null;
  }

  private getCredentials(): DeepSeekCredentials {
    // 1. Пробуем защищённое хранилище (safeStorage)
    const stored = getCredentials('deepseek');
    if (stored) {
      return stored;
    }
    // 2. Из .env
    const envCreds = this.getCredentialsFromEnv();
    if (envCreds) {
      return envCreds;
    }
    throw new Error(
      'Учётные данные DeepSeek не найдены. Укажите VITE_DEEPSEEK_LOGIN и VITE_DEEPSEEK_PASSWORD в .env или сохраните их через интерфейс.'
    );
  }

  private async saveStorageState(): Promise<void> {
    if (!this.context) return;
    const state = await this.context.storageState();
    fs.writeFileSync(this.getStoragePath(), JSON.stringify(state, null, 2), 'utf-8');
    console.log('DeepSeek storage state saved');
  }

  private async loadStorageState(): Promise<boolean> {
    const storagePath = this.getStoragePath();
    if (!fs.existsSync(storagePath)) {
      console.log('DeepSeek storage file not found, will login');
      return false;
    }
    try {
      const state = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      if (!state.cookies || state.cookies.length === 0) {
        console.log('DeepSeek storage empty');
        return false;
      }
      // Создаём контекст с восстановленным состоянием
      this.context = await this.browser!.newContext({ storageState: state });
      console.log('DeepSeek storage state loaded');
      return true;
    } catch (e) {
      console.error('Ошибка загрузки storage state:', e);
      return false;
    }
  }

  /**
   * Проверяет, авторизован ли пользователь.
   * Ориентируемся на наличие поля ввода сообщения (характерно для авторизованного чата).
   * Селектор можно уточнить при необходимости.
   */
  private async isAuthenticated(): Promise<boolean> {
    if (!this.page) return false;
    try {
      // Ищем textarea, которая появляется после входа
      await this.page.waitForSelector(
        'textarea[placeholder*="Message"], textarea[placeholder*="Send"], textarea[placeholder*="输入"], textarea[placeholder*="消息"]',
        { timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Выполняет вход на chat.deepseek.com.
   * Учётные данные берутся из хранилища или .env.
   * После входа сохраняет storageState.
   */
  private async login(): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const credentials = this.getCredentials();

    console.log('Выполняется вход в DeepSeek...');
    await this.page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Актуальные селекторы страницы входа
    const loginInput = this.page.locator(
      'input[type="text"].ds-input__input, input[placeholder="Номер телефона / адрес электронной почты"]'
    ).first();
    const passwordInput = this.page.locator(
      'input[type="password"].ds-input__input, input[placeholder="Пароль"]'
    ).first();
    const submitButton = this.page.locator(
      'div.ds-button--primary.ds-button--filled, div[role="button"]:has-text("Войти")'
    ).first();

    await loginInput.waitFor({ state: 'visible', timeout: 15000 });
    await loginInput.fill(credentials.login);
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(credentials.password);
    await submitButton.click();

    // Ожидаем перехода на главную страницу чата
    await this.page.waitForURL('**/chat.deepseek.com/**', { timeout: 20000 });

    // Проверяем, что авторизовались
    this.isLoggedIn = await this.isAuthenticated();
    if (this.isLoggedIn) {
      // Сохраняем учётные данные в safeStorage (если они были из .env)
      setCredentials('deepseek', credentials.login, credentials.password);
      await this.saveStorageState();
      console.log('Вход выполнен успешно');
    } else {
      throw new Error('Не удалось войти в DeepSeek. Проверьте учётные данные и селекторы.');
    }
  }

  /**
   * Запускает браузер и открывает DeepSeek.
   * Если сессия есть, восстанавливает её; иначе выполняет вход.
   */
  async launch(): Promise<LaunchResult> {
    if (this.browser && this.browser.isConnected()) {
      // Браузер уже запущен – проверяем текущий статус
      if (this.page && (await this.isAuthenticated())) {
        this.isLoggedIn = true;
        return { status: 'logged_in' };
      }
      return { status: 'running', loginRequired: true };
    }

    console.log('Запуск браузера для DeepSeek...');

    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11'],
    });

    const storageLoaded = await this.loadStorageState();

    if (!storageLoaded) {
      this.context = await this.browser.newContext();
    }

    this.page = await this.context!.newPage();
    await this.page.goto(DEEPSEEK_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Проверяем авторизацию после загрузки страницы
    this.isLoggedIn = await this.isAuthenticated();

    if (!this.isLoggedIn) {
      // Требуется вход
      console.log('Сессия недействительна или отсутствует, требуется вход');
      await this.login();
      return { status: 'logged_in' };
    }

    // Сессия восстановлена успешно
    await this.saveStorageState();
    return { status: 'logged_in' };
  }

  /**
   * Закрывает браузер и сохраняет состояние сессии.
   */
  async close(): Promise<void> {
    if (this.browser) {
      if (this.context) {
        await this.saveStorageState();
        await this.context.close();
        this.context = null;
      }
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      console.log('Браузер DeepSeek закрыт, сессия сохранена');
    }
  }

  /**
   * Возвращает текущий статус (для UI).
   */
  getStatus(): { status: string; isLoggedIn: boolean } {
    return {
      status: this.browser ? 'running' : 'stopped',
      isLoggedIn: this.isLoggedIn,
    };
  }

  /**
   * Возвращает текущую страницу (понадобится для отправки сообщений на этапе 4).
   */
  getPage(): Page | null {
    return this.page;
  }
}