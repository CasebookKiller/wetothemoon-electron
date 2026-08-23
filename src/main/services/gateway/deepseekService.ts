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

export interface GatewayChatBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

export interface GatewayChatMessage {
  role: 'user' | 'assistant';
  thinking?: string;
  blocks: GatewayChatBlock[];
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

    // Если URL содержит sign_in, точно не авторизованы
    const currentUrl = this.page.url();
    if (currentUrl.includes('/sign_in') || currentUrl.includes('/sign-in')) {
      return false;
    }

    // Проверяем наличие textarea или кнопки профиля
    const selectors = [
      'textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]',
      'div._2afd28d', // кнопка профиля (если textarea не виден)
    ];

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 8000 });
        return true;
      } catch {
        // пробуем следующий
      }
    }

    return false;
  }

  /**
   * Ожидает, пока капча исчезнет из DOM.
   * Используется для ручного прохождения капчи пользователем.
   */

  private async waitForCaptchaToDisappear(timeoutMs: number): Promise<void> {
    const captchaSelector = '#ds_aws_captcha, #cf-overlay';
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const captcha = this.page!.locator(captchaSelector);
      const visible = await captcha.isVisible().catch(() => false);
      if (!visible) {
        return;
      }
      await this.page!.waitForTimeout(2000);
    }
    throw new Error('Время ожидания ручного прохождения капчи истекло');
  }

  /**
   * Переходит по URL с минимальным ожиданием (commit), игнорируя таймауты.
   */
  private async gotoWithTimeout(url: string, timeoutMs = 15000): Promise<void> {
    if (!this.page) return;

    try {
      // 'commit' ждёт только первый ответ сервера, не полную загрузку
      await this.page.goto(url, { waitUntil: 'commit', timeout: timeoutMs });

      // После перехода эмулируем завершение загрузки, чтобы убрать троббер
      await this.page.evaluate(() => {
        // 1. Диспатчим событие load (иногда помогает)
        window.dispatchEvent(new Event('load'));

        // 2. Скрываем видимые спиннеры/лоадеры
        document.querySelectorAll(
          '.loading, .loader, .spinner, [class*="loading"], [class*="spinner"]'
        ).forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });

        // 3. Если сайт использует jQuery, триггерим и его load
        if (typeof (window as any).jQuery !== 'undefined') {
          (window as any).jQuery(window).trigger('load');
        }
      });

      console.log(`[DeepSeek] Переход на ${url} завершён, троббер остановлен`);
    } catch (error) {
      // Если таймаут, но страница загрузилась визуально — продолжаем
      console.warn(`[DeepSeek] Переход на ${url} не завершился полностью: ${(error as Error).message}`);
    }
  }

  /**
   * Открывает и закрывает меню профиля, чтобы остановить бесконечный индикатор загрузки.
   * Это обходной приём, так как DeepSeek после авторизации может держать троббер.
   */
  private async stopLoadingSpinner(): Promise<void> {
    const page = this.page;
    if (!page) return;

    try {
      // 1. Кликаем по кнопке профиля
      const profileButton = page.locator('div._2afd28d').first();
      await profileButton.waitFor({ state: 'visible', timeout: 10000 });
      await profileButton.scrollIntoViewIfNeeded();
      await profileButton.click({ force: true });
      console.log('[DeepSeek] Клик по профилю выполнен');

      // 2. Ждём появления меню
      const menuSelector = 'div.ds-dropdown-menu';
      await page.locator(menuSelector).waitFor({ state: 'visible', timeout: 5000 });
      console.log('[DeepSeek] Меню открыто');

      // 3. Кликаем по пункту "Настройки"
      const settingsItem = page.locator('div.ds-dropdown-menu-option__label', { hasText: 'Настройки' });
      await settingsItem.waitFor({ state: 'visible', timeout: 5000 });
      await settingsItem.click({ force: true });
      console.log('[DeepSeek] Клик по "Настройки" выполнен');

      // 4. Ждём перехода на страницу настроек
      await page.waitForTimeout(2000);

      // 5. Возвращаемся обратно (назад к чату)
      try {
        await page.goBack({ waitUntil: 'commit', timeout: 10000 });
      } catch (goBackError) {
        console.warn('[DeepSeek] goBack не сработал, пробуем клик по логотипу');
        await page.locator('div.e066abb8').first().click({ force: true });
      }
      await page.waitForTimeout(1000);

      console.log('[DeepSeek] Спиннер остановлен через меню настроек');
    } catch (error) {
      console.warn('[DeepSeek] Не удалось остановить спиннер через меню настроек:', error);
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch {}
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
    console.log('[DeepSeek] Получены учётные данные');

    console.log('[DeepSeek] Переходим на страницу входа');
    await this.gotoWithTimeout(LOGIN_URL, 20000);
    console.log('[DeepSeek] Переход выполнен');

    const loginInput = this.page.locator('input[type="text"].ds-input__input');
    const passwordInput = this.page.locator('input[type="password"].ds-input__input');
    const submitButton = this.page.locator('div.ds-button--primary.ds-button--filled');

    console.log('[DeepSeek] Ожидание полей ввода');
    await loginInput.waitFor({ state: 'visible', timeout: 15000 });
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    console.log('[DeepSeek] Поля найдены');

    await loginInput.fill('');
    await loginInput.fill(credentials.login);
    await passwordInput.fill('');
    await passwordInput.fill(credentials.password);
    console.log('[DeepSeek] Поля заполнены');

    // Проверка капчи до клика
    const captchaSelector = '#ds_aws_captcha, #cf-overlay';
    if (await this.page.locator(captchaSelector).isVisible().catch(() => false)) {
      console.log('[DeepSeek] Капча до клика, ждём ручного прохождения...');
      await this.waitForCaptchaToDisappear(120000);
    }

    console.log('[DeepSeek] Клик по кнопке Войти');
    await submitButton.click();
    console.log('[DeepSeek] Клик выполнен');

    const textareaSelector = 'textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]';
    try {
      console.log('[DeepSeek] Ожидание textarea (признак входа)...');
      await this.page.waitForSelector(textareaSelector, { timeout: 20000 });
      console.log('[DeepSeek] Textarea появился');
    } catch {
      console.log('[DeepSeek] Textarea не появился, проверяем капчу после клика...');
      if (await this.page.locator(captchaSelector).isVisible().catch(() => false)) {
        console.log('[DeepSeek] Капча после клика, ждём...');
        await this.waitForCaptchaToDisappear(120000);
        await this.page.waitForSelector(textareaSelector, { timeout: 20000 });
      } else {
        console.log('[DeepSeek] Капчи нет, возможно ошибка входа');
        await this.page.waitForTimeout(5000);
      }
    }

    // Если textarea так и не появился, выбрасываем ошибку
    const textareaVisible = await this.page.locator(textareaSelector).isVisible().catch(() => false);
    if (!textareaVisible) {
      throw new Error('Не удалось войти в DeepSeek. Проверьте учётные данные и попробуйте ещё раз.');
    }

    // Успешный вход
    this.isLoggedIn = true;
    setCredentials('deepseek', credentials.login, credentials.password);
    await this.saveStorageState();
    console.log('[DeepSeek] Вход выполнен успешно, сессия сохранена');

    // Останавливаем спиннер через меню профиля
    await this.stopLoadingSpinner();
  }

  /**
   * Запускает браузер и открывает DeepSeek.
   * Если сессия есть, восстанавливает её; иначе выполняет вход.
   */
  async launch(): Promise<LaunchResult> {
    if (this.browser && this.browser.isConnected()) {
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
    console.log('[DeepSeek] Открываем главную страницу');
    await this.gotoWithTimeout(DEEPSEEK_URL, 20000);
    await this.page.waitForTimeout(3000);
    console.log('[DeepSeek] Главная страница загружена (или таймаут проигнорирован)');

    const authed = await this.isAuthenticated();
    if (!authed) {
      console.log('[DeepSeek] Требуется вход');
      await this.login(); // login уже устанавливает isLoggedIn = true и сохраняет сессию
      return { status: 'logged_in' };
    }

    // Уже авторизованы
    this.isLoggedIn = true;
    await this.stopLoadingSpinner();
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

  /**
   * Проверяет, загружен ли интерфейс чата (поле ввода).
   * Если открыт экран выбора режима, кликает по "Быстрому" режиму.
   */
  private async ensureReadyForChat(): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const textareaSelector = 'textarea[placeholder="Сообщение для DeepSeek"]';
    // Если textarea уже есть — выходим
    const textarea = this.page.locator(textareaSelector);
    if (await textarea.count() > 0) return;

    console.log('Интерфейс чата не обнаружен, пробуем выбрать режим...');
    // Ищем кнопку выбора режима "Быстрый" (data-model-type="default")
    const fastModeSelector = '[data-model-type="default"][role="radio"]';
    const fastMode = this.page.locator(fastModeSelector);
    await fastMode.waitFor({ state: 'visible', timeout: 10000 });
    await fastMode.click();

    // Ждём появления textarea после выбора
    await this.page.waitForSelector(textareaSelector, { timeout: 15000 });
    console.log('Готов к отправке сообщений');
  }

  /**
   * Отправляет сообщение в DeepSeek и возвращает текст ответа.
   */
/**
 * Интерфейс сообщения чата Gateway.
 */

  /**
   * Отправляет сообщение в DeepSeek и возвращает структурированный ответ.
   */
  async sendMessage(message: string): Promise<GatewayChatMessage> {
    if (!this.page) throw new Error('Браузер не запущен');
    if (!this.isLoggedIn && !(await this.isAuthenticated())) {
      throw new Error('Не авторизован в DeepSeek');
    }

    await this.ensureReadyForChat();

    // Автоматически добавляем просьбу отвечать на русском, если сообщение содержит кириллицу
    const finalMessage = /[а-яА-ЯёЁ]/.test(message)
      ? `${message}\n\n(Пожалуйста, ответь на русском языке)`
      : message;

    const textareaSelector = 'textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]';
    const assistantMessageSelector = 'div.ds-markdown.ds-assistant-message-main-content';

    // Запоминаем количество сообщений ассистента до отправки
    const messagesBefore = await this.page.locator(assistantMessageSelector).count();

    const textarea = this.page.locator(textareaSelector).first();
    await textarea.waitFor({ state: 'visible', timeout: 10000 });
    await textarea.fill(finalMessage);
    await textarea.press('Enter');

    // Ждём появления нового сообщения ассистента
    await this.page.waitForFunction(
      ({ selector, prevCount }) => {
        const elements = document.querySelectorAll(selector);
        return elements.length > prevCount;
      },
      { selector: assistantMessageSelector, prevCount: messagesBefore },
      { timeout: 60000 }
    );

    // Небольшая пауза для полной отрисовки
    await this.page.waitForTimeout(1000);

    const lastMessage = this.page.locator(assistantMessageSelector).last();

    const messageData = await lastMessage.evaluate((el) => {
      const parentMessage = el.closest('div[data-virtual-list-item-key]') as HTMLElement | null;

      let thinking: string | undefined;
      if (parentMessage) {
        const thinkingEl = parentMessage.querySelector('div.e1675d8b.ds-think-content');
        if (thinkingEl) {
          thinking = thinkingEl.textContent?.trim() || '';
        }
      }

      const blocks: any[] = [];

      // Проходим по дочерним узлам основного markdown-контента в исходном порядке
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;

          // Если это блок кода
          if (element.classList.contains('md-code-block')) {
            const langEl = element.querySelector('span.d813de27');
            const codeEl = element.querySelector('pre');
            const language = langEl?.textContent?.trim() || 'text';
            const code = codeEl?.textContent || '';
            if (code.trim()) {
              blocks.push({
                type: 'code',
                content: code,
                language,
              });
            }
          } else {
            // Любой другой элемент (p, h3, ul, blockquote и т.п.) — текстовый блок
            const text = element.textContent?.trim() || '';
            if (text) {
              blocks.push({
                type: 'text',
                content: text,
              });
            }
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          // Могут быть отдельные текстовые узлы (обычно нет, но на всякий случай)
          const text = node.textContent?.trim() || '';
          if (text) {
            blocks.push({
              type: 'text',
              content: text,
            });
          }
        }
      });

      // Если blocks пуст, добавляем весь текст как один блок
      if (blocks.length === 0) {
        const text = el.textContent?.trim() || '';
        if (text) {
          blocks.push({ type: 'text', content: text });
        }
      }

      return {
        role: 'assistant',
        thinking,
        blocks,
      } as GatewayChatMessage;
    });

    return messageData;
  }

  /**
   * Возвращает список диалогов из сайдбара DeepSeek.
   */
  async getConversations(): Promise<{ id: string; title: string }[]> {
    if (!this.page) throw new Error('Браузер не запущен');

    const conversations = await this.page.$$eval('a._546d736', (links) => {
      return links
        .map((link) => {
          const href = link.getAttribute('href') || '';
          const titleEl = link.querySelector('.c08e6e93');
          const title = titleEl ? titleEl.textContent?.trim() : '';
          // ID — последний сегмент пути
          const id = href.split('/').pop() || '';
          return { id, title };
        })
        .filter((item) => item.title && item.id);
    });

    return conversations;
  }

  /**
   * Открывает конкретный диалог по ID.
   */
  async openConversation(id: string): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const url = `https://chat.deepseek.com/a/chat/s/${id}`;
    console.log(`[DeepSeek] Открываем диалог: ${url}`);
    await this.gotoWithTimeout(url, 15000);
    await this.page.waitForTimeout(2000);
  }

  /**
   * Выбирает режим модели: 'default' (Быстрый), 'expert' (Эксперт), 'vision' (Распознавание).
   */
  async selectModel(modelType: 'default' | 'expert' | 'vision'): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const selector = `[data-model-type="${modelType}"][role="radio"]`;
    const radio = this.page.locator(selector).first();
    await radio.waitFor({ state: 'visible', timeout: 10000 });
    await radio.click({ force: true });
    console.log(`[DeepSeek] Выбран режим: ${modelType}`);
  }

  /**
   * Включает/выключает режим «Глубокое мышление».
   */
  async setDeepThinking(enabled: boolean): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const toggle = this.page.locator('div.ds-toggle-button:has(span:has-text("Глубокое мышление"))').first();
    await toggle.waitFor({ state: 'visible', timeout: 10000 });

    const isPressed = (await toggle.getAttribute('aria-pressed')) === 'true';
    if (isPressed !== enabled) {
      await toggle.click({ force: true });
    }
    console.log(`[DeepSeek] Глубокое мышление: ${enabled}`);
  }

  /**
   * Включает/выключает режим «Умный поиск».
   */
  async setSearch(enabled: boolean): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const toggle = this.page.locator('div.ds-toggle-button:has(span:has-text("Умный поиск"))').first();
    const isVisible = await toggle.isVisible().catch(() => false);
    if (!isVisible) {
      console.warn('[DeepSeek] Кнопка "Умный поиск" недоступна в текущем режиме');
      return;
    }

    await toggle.waitFor({ state: 'visible', timeout: 10000 });
    const isPressed = (await toggle.getAttribute('aria-pressed')) === 'true';
    if (isPressed !== enabled) {
      await toggle.click({ force: true });
    }
    console.log(`[DeepSeek] Умный поиск: ${enabled}`);
  }

  // В классе DeepSeekService добавьте:

  /**
   * Возвращает текущий выбранный режим модели.
   */
  async getCurrentModel(): Promise<'default' | 'expert' | 'vision'> {
    if (!this.page) throw new Error('Браузер не запущен');

    const types: ('default' | 'expert' | 'vision')[] = ['default', 'expert', 'vision'];
    for (const type of types) {
      const radio = this.page.locator(`[data-model-type="${type}"][role="radio"]`);
      const isChecked = await radio.getAttribute('aria-checked').catch(() => 'false');
      if (isChecked === 'true') return type;
    }
    return 'default';
  }

  /**
   * Возвращает состояние "Глубокое мышление".
   */
  async getDeepThinking(): Promise<boolean> {
    if (!this.page) return false;
    const toggle = this.page.locator('div.ds-toggle-button:has(span:has-text("Глубокое мышление"))').first();
    const pressed = await toggle.getAttribute('aria-pressed').catch(() => 'false');
    return pressed === 'true';
  }

  /**
   * Возвращает состояние "Умный поиск" (может быть скрыт в режиме expert).
   */
  async getSearch(): Promise<boolean> {
    if (!this.page) return false;
    const toggle = this.page.locator('div.ds-toggle-button:has(span:has-text("Умный поиск"))').first();
    const visible = await toggle.isVisible().catch(() => false);
    if (!visible) return false;
    const pressed = await toggle.getAttribute('aria-pressed').catch(() => 'false');
    return pressed === 'true';
  }

  async getConversationMessages(): Promise<GatewayChatMessage[]> {
    if (!this.page) throw new Error('Браузер не запущен');

    try {
      await this.page.waitForSelector('div.ds-virtual-list.ds-virtual-list--printable', { timeout: 10000 });
    } catch {
      return [];
    }

    const messages = await this.page.evaluate(async () => {
      const container = document.querySelector('div.ds-virtual-list.ds-virtual-list--printable') as HTMLElement | null;
      if (!container) return [];

      // Прокручиваем до верха для подгрузки всех элементов
      let prevCount = 0;
      let stableCount = 0;
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        container.scrollTop = 0;
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const items = container.querySelectorAll('div[data-virtual-list-item-key]');
        const currentCount = items.length;
        if (currentCount === prevCount) {
          stableCount++;
          if (stableCount >= 2) break;
        } else {
          prevCount = currentCount;
          stableCount = 0;
        }
      }

      const result: GatewayChatMessage[] = [];
      const messageItems = container.querySelectorAll('div[data-virtual-list-item-key]');

      messageItems.forEach((item) => {
        // Пользовательское сообщение
        const userContent = item.querySelector('div.fbb737a4');
        if (userContent) {
          result.push({
            role: 'user',
            blocks: [{ type: 'text', content: userContent.textContent?.trim() || '' }],
          });
          return;
        }

        // Ассистентское сообщение
        const assistantMain = item.querySelector('div.ds-markdown.ds-assistant-message-main-content');
        if (!assistantMain) return;

        // Извлекаем размышление
        let thinking: string | undefined;
        const thinkingEl = item.querySelector('div.e1675d8b.ds-think-content');
        if (thinkingEl) {
          thinking = thinkingEl.textContent?.trim() || '';
        }

        // Извлекаем блоки в исходном порядке
        const blocks: GatewayChatBlock[] = [];
        assistantMain.childNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.classList.contains('md-code-block')) {
              const langEl = element.querySelector('span.d813de27');
              const codeEl = element.querySelector('pre');
              const language = langEl?.textContent?.trim() || 'text';
              const code = codeEl?.textContent || '';
              if (code.trim()) {
                blocks.push({ type: 'code', content: code, language });
              }
            } else {
              const text = element.textContent?.trim() || '';
              if (text) {
                blocks.push({ type: 'text', content: text });
              }
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim() || '';
            if (text) {
              blocks.push({ type: 'text', content: text });
            }
          }
        });

        if (blocks.length === 0) {
          const text = assistantMain.textContent?.trim() || '';
          if (text) {
            blocks.push({ type: 'text', content: text });
          }
        }

        result.push({
          role: 'assistant',
          thinking,
          blocks,
        });
      });

      // Дедупликация
      const seen = new Set<string>();
      const unique: GatewayChatMessage[] = [];
      for (const msg of result) {
        const key = `${msg.role}:${JSON.stringify(msg.blocks)}:${msg.thinking || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(msg);
        }
      }

      return unique;
    });

    return messages as GatewayChatMessage[];
  }
}