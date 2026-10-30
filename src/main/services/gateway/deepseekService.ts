// src/main/services/gateway/deepseekService.ts

import { app, safeStorage } from 'electron';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { getCredentials, setCredentials } from '../osint/credentials'; // переиспользуем
import * as dotenv from 'dotenv';
import { SelectorProfileService } from './selectorProfiles/SelectorProfileService';
import { EventEmitter } from 'events';
import { INJECTED_SCRIPT } from './bridge/injectedScript';
import type { GatewayBridgeEvent } from './bridge/BridgeEvents';

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
  fullHtml?: string;   // точный HTML ассистентского ответа для рендера 1:1
}

export class DeepSeekService {
  private static instance: DeepSeekService;
  private profileService: SelectorProfileService;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;
  private bridgeEmitter = new EventEmitter();
  private lastContentTs = 0;
  private pendingContentHtml = '';
  private pendingContentTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.profileService = new SelectorProfileService('deepseek');
  }

  static getInstance(): DeepSeekService {
    if (!DeepSeekService.instance) {
      DeepSeekService.instance = new DeepSeekService();
    }
    return DeepSeekService.instance;
  }

  /**
   * EventEmitter, через который сервис публикует события из браузера.
   * Подписчик: gatewayHandlers.ts
   */
  getBridgeEmitter(): EventEmitter {
    return this.bridgeEmitter;
  }

  /**
   * Устанавливает мост между страницей Playwright и Node.
   * 1. exposeFunction('__gatewayBridge', ...) — функция доступна в window страницы
   * 2. addInitScript — для всех будущих навигаций
   * 3. evaluate(INJECTED_SCRIPT) — для уже загруженной страницы
   *
   * ВАЖНО: вызывать ДО первой навигации.
   */
  private async setupBridge(): Promise<void> {
    if (!this.page) return;

    // 1. Экспонируем функцию
    try {
      await this.page.exposeFunction(
        '__gatewayBridge',
        (type: string, payload: any) => {
          // Coalesce: assistant:content-update не чаще 100 мс,
          // но последнее значение всегда уходит
          if (type === 'assistant:content-update') {
            const now = Date.now();
            const elapsed = now - this.lastContentTs;

            if (elapsed >= 100) {
              this.lastContentTs = now;
              this.pendingContentHtml = '';
              if (this.pendingContentTimer) {
                clearTimeout(this.pendingContentTimer);
                this.pendingContentTimer = null;
              }
              this.bridgeEmitter.emit('event', {
                type: type as any,
                payload,
                ts: now,
              });
            } else {
              this.pendingContentHtml = payload.html;
              if (!this.pendingContentTimer) {
                this.pendingContentTimer = setTimeout(() => {
                  this.pendingContentTimer = null;
                  if (this.pendingContentHtml) {
                    const html = this.pendingContentHtml;
                    this.pendingContentHtml = '';
                    this.lastContentTs = Date.now();
                    this.bridgeEmitter.emit('event', {
                      type: 'assistant:content-update' as any,
                      payload: { html },
                      ts: Date.now(),
                    });
                  }
                }, 100 - elapsed);
              }
            }
            return;
          }

          const event: GatewayBridgeEvent = {
            type: type as any,
            payload,
            ts: Date.now(),
          };
          this.bridgeEmitter.emit('event', event);
        }
      );
      console.log('[DeepSeek] bridge exposeFunction установлен');
    } catch (e) {
      console.warn(
        '[DeepSeek] exposeFunction ошибка (уже установлен?):',
        (e as Error).message
      );
    }

    // 2. Для будущих навигаций
    try {
      await this.page.addInitScript({ content: INJECTED_SCRIPT });
    } catch (e) {
      console.warn(
        '[DeepSeek] addInitScript ошибка:',
        (e as Error).message
      );
    }

    // 3. Для текущей страницы
    try {
      await this.page.evaluate(INJECTED_SCRIPT);
      console.log('[DeepSeek] injectedScript применён на текущей странице');
    } catch (e) {
      // нормально, если страница ещё about:blank
      console.warn(
        '[DeepSeek] injectedScript на текущей странице:',
        (e as Error).message
      );
    }
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
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch { /* не критично */ }
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
    //await this.setRussianLanguage();     // ← добавить
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

    // Мост событий — ДО первой навигации
    await this.setupBridge();

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
    //await this.setRussianLanguage();     // ← добавить
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
    const textareaSelector = [
      'textarea[placeholder="Сообщение для DeepSeek"]',
      'textarea[placeholder="Message DeepSeek"]',
      'textarea[placeholder*="Сообщение"]',
      'textarea[placeholder*="Message"]',
    ].join(', ');
    await this.page.waitForSelector(textareaSelector, { timeout: 15000 });
  }

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
      ? `${message}\n\n(Ответь на русском языке)`
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

    // Ждём стабилизации содержимого — стрим завершён, когда HTML
    // не меняется 3 проверки подряд по 300 мс (≈900 мс)
    try {
      await this.page.waitForFunction(
        ({ selector }) => {
          const els = document.querySelectorAll(selector);
          const last = els[els.length - 1] as HTMLElement | null;
          if (!last) return false;
          const w = window as any;
          const current = last.innerHTML;
          if (!current) return false;
          if (current === w.__lastStableHtml) {
            w.__stableCount = (w.__stableCount || 0) + 1;
            return w.__stableCount >= 3;
          }
          w.__lastStableHtml = current;
          w.__stableCount = 0;
          return false;
        },
        { selector: assistantMessageSelector },
        { timeout: 120000, polling: 300 }
      );
      console.log('[DeepSeek] Ответ стабилизирован, читаем финальный HTML');
    } catch (e) {
      console.warn(
        '[DeepSeek] Стабилизация ответа не дождалась, читаем что есть:',
        (e as Error).message
      );
    }

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

      // Сохраняем HTML как есть — для точного рендера в нашем окне
      const fullHtml = el.innerHTML;

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
        fullHtml,
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
   * @deprecated Режимы модели (default/expert/vision) удалены из DeepSeek.
   * Метод сохранён для совместимости и всегда возвращает 'default'.
   */
  async selectModel(_modelType: string): Promise<void> {
    console.warn('[DeepSeek] selectModel устарел — режимы модели больше не поддерживаются сайтом');
  }

  /**
   * Ищет тумблер по тексту лейбла. Порядок labels — приоритет поиска.
   */
  private async findToggleByLabels(labels: string[]): Promise<import('playwright').Locator | null> {
    if (!this.page) return null;
    for (const label of labels) {
      const toggle = this.page
        .locator(`div.ds-toggle-button:has(span:has-text("${label}"))`)
        .first();
      if ((await toggle.count()) > 0) return toggle;
    }
    return null;
  }

  /**
   * Включает/выключает режим "Глубокое мышление" / "DeepThink".
   * Поддерживает русскую и английскую версии интерфейса.
   */
  async setDeepThinking(enabled: boolean): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');
    const toggle = await this.findToggleByLabels([
      'Глубокое мышление', 'DeepThink', 'Deep Think', 'Размышление',
    ]);
    if (!toggle) throw new Error('Тумблер DeepThink не найден');
    const isPressed = (await toggle.getAttribute('aria-pressed')) === 'true';
    if (isPressed !== enabled) await toggle.click({ force: true });
  }

  /**
   * Включает/выключает режим "Умный поиск" / "Search".
   */
  async setSearch(enabled: boolean): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');
    const toggle = await this.findToggleByLabels([
      'Умный поиск', 'Search', 'Поиск',
    ]);
    if (!toggle) { console.warn('[DeepSeek] Тумблер Search не найден'); return; }
    const isPressed = (await toggle.getAttribute('aria-pressed')) === 'true';
    if (isPressed !== enabled) await toggle.click({ force: true });
  }

  /**
   * @deprecated См. selectModel.
   */
  async getCurrentModel(): Promise<'default'> {
    return 'default';
  }

  /**
   * Возвращает состояние "Глубокое мышление".
   */
  async getDeepThinking(): Promise<boolean> {
    if (!this.page) return false;
    const toggle = await this.findToggleByLabels([
      'Глубокое мышление', 'DeepThink', 'Deep Think', 'Размышление',
    ]);
    if (!toggle) return false;
    return (await toggle.getAttribute('aria-pressed')) === 'true';
  }

  /**
   * Возвращает состояние "Умный поиск" (может быть скрыт в режиме expert).
   */
  async getSearch(): Promise<boolean> {
    if (!this.page) return false;
    const toggle = await this.findToggleByLabels([
      'Умный поиск', 'Search', 'Поиск',
    ]);
    if (!toggle) return false;
    return (await toggle.getAttribute('aria-pressed')) === 'true';
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

      // ============================================================
      // Собираем ВСЕ сообщения через скролл вверх-вниз.
      // Виртуальный список DeepSeek держит в DOM только видимую часть,
      // поэтому нужно проскроллить весь диапазон и собрать по ходу.
      // ============================================================

      const messageByKey = new Map<string, { key: number; html: string; role: 'user' | 'assistant' }>();

      const collectVisible = () => {
        const items = container.querySelectorAll('div[data-virtual-list-item-key]');
        items.forEach((item) => {
          const keyAttr = item.getAttribute('data-virtual-list-item-key');
          if (!keyAttr) return;
          const keyNum = parseInt(keyAttr, 10);
          if (isNaN(keyNum)) return;

          if (messageByKey.has(keyAttr)) return;

          const userContent = item.querySelector('div.fbb737a4');
          if (userContent) {
            // Для user берём html из .d29f3d7d (обёртка ds-message)
            const msgEl = item.querySelector('div.ds-message.d29f3d7d');
            messageByKey.set(keyAttr, {
              key: keyNum,
              html: msgEl ? (msgEl as HTMLElement).innerHTML : (item as HTMLElement).innerHTML,
              role: 'user',
            });
            return;
          }

          const assistantMain = item.querySelector('div.ds-markdown.ds-assistant-message-main-content');
          if (assistantMain) {
            const parentMessage = item as HTMLElement;
            const fullHtml = parentMessage.innerHTML;
            messageByKey.set(keyAttr, {
              key: keyNum,
              html: fullHtml,
              role: 'assistant',
            });
          }
        });
      };

      // 1. Собираем текущую позицию
      collectVisible();

      // 2. Скролл до самого верха с подгрузкой
      let prevHeight = 0;
      let stableCount = 0;
      let attempts = 0;
      const maxTopAttempts = 25;

      while (stableCount < 3 && attempts < maxTopAttempts) {
        attempts++;
        container.scrollTop = 0;
        await new Promise((resolve) => setTimeout(resolve, 700));
        collectVisible();
        const nowHeight = container.scrollHeight;
        if (nowHeight === prevHeight) stableCount++;
        else {
          stableCount = 0;
          prevHeight = nowHeight;
        }
      }

      // 3. Медленный скролл вниз — собираем всё видимое
      const totalRange = container.scrollHeight - container.clientHeight;
      const steps = Math.max(10, Math.ceil(totalRange / 400)); // каждые ~400px
      for (let i = 0; i <= steps; i++) {
        container.scrollTop = (totalRange * i) / steps;
        await new Promise((resolve) => setTimeout(resolve, 250));
        collectVisible();
      }

      // 4. Возвращаем вниз
      container.scrollTop = container.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 5. Парсим каждое сообщение в GatewayChatMessage по его HTML
      const sorted = Array.from(messageByKey.values()).sort((a, b) => a.key - b.key);

      const result: GatewayChatMessage[] = [];

      for (const entry of sorted) {
        // Создаём временный контейнер для парсинга
        const div = document.createElement('div');
        div.innerHTML = entry.html;

        if (entry.role === 'user') {
          // Для user — извлекаем .fbb737a4
          const fbb = div.querySelector('.fbb737a4');
          const content = fbb?.textContent?.trim() || div.textContent?.trim() || '';
          if (content) {
            result.push({
              role: 'user',
              blocks: [{ type: 'text', content }],
            });
          }
          continue;
        }

        // Assistant: извлекаем thinking + main content
        let thinking: string | undefined;
        const thinkingEl = div.querySelector('div.e1675d8b.ds-think-content');
        if (thinkingEl) {
          thinking = thinkingEl.textContent?.trim() || '';
        }

        const assistantMain = div.querySelector('div.ds-markdown.ds-assistant-message-main-content');
        if (!assistantMain) continue;

        const blocks: any[] = [];
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
          fullHtml: (assistantMain as HTMLElement).innerHTML,
        });
      }

      return result;
    });

    return messages as GatewayChatMessage[];
  }

  /**
   * Включает режим выбора сообщений (клик по кнопке в шапке).
   */
  async startSelectionMode(): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');
    const profile = await this.profileService.load();
    const button = await this.findWithFallback(
      'startSelectionButton',
      profile.selectors.startSelectionButton.chain
    );
    if (!button) throw new Error('Кнопка входа в режим выбора не найдена');
    await button.click({ force: true });
    console.log('[DeepSeek] Режим выбора включён');
  }

  /**
   * Отменяет режим выбора (клик по Cancel в нижней панели).
   */
  async cancelSelectionMode(): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');
    const cancelButton = this.page.locator('div.fab07e97 .ds-button--outlinedNeutral');
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click({ force: true });
      console.log('[DeepSeek] Режим выбора отменён');
    }
  }

  /**
   * Выбирает сообщения по индексам (0-based) в текущем списке.
   */
  async selectMessages(indices: number[]): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');
    if (!indices.length) return;

    const listSelector = 'div.ds-virtual-list';
    const list = this.page.locator(listSelector);
    await list.waitFor({ state: 'visible', timeout: 5000 });

    const sorted = [...indices].sort((a, b) => a - b);

    for (const index of sorted) {
      await this.scrollToMessageIndex(index);
      const message = this.page.locator(`div[data-virtual-list-item-key]`).nth(index);
      const checkbox = message.locator('.d30139ff .ds-checkbox');
      await checkbox.click({ force: true });
      await this.page.waitForTimeout(200);
    }
    console.log(`[DeepSeek] Выбрано сообщений: ${indices.length}`);
  }

  /**
   * Прокручивает список до сообщения с указанным индексом.
   */
  private async scrollToMessageIndex(index: number): Promise<void> {
    const page = this.page!;
    const listSelector = 'div.ds-virtual-list';

    const elementExists = await page.evaluate(
      ({ listSelector, index }) => {
        const list = document.querySelector(listSelector);
        if (!list) return false;
        const items = list.querySelectorAll('div[data-virtual-list-item-key]');
        return index < items.length;
      },
      { listSelector, index }
    );

    if (elementExists) {
      await page.evaluate(
        ({ listSelector, index }) => {
          const list = document.querySelector(listSelector);
          const items = list?.querySelectorAll('div[data-virtual-list-item-key]');
          if (items && items[index]) {
            items[index].scrollIntoView({ block: 'center' });
          }
        },
        { listSelector, index }
      );
      await page.waitForTimeout(500);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
      const found = await page.evaluate(
        ({ listSelector, index }) => {
          const list = document.querySelector(listSelector);
          if (!list) return false;
          const items = list.querySelectorAll('div[data-virtual-list-item-key]');
          if (index < items.length) {
            items[index].scrollIntoView({ block: 'center' });
            return true;
          }
          list.scrollTop = list.scrollHeight;
          return false;
        },
        { listSelector, index }
      );
      if (found) {
        await page.waitForTimeout(500);
        return;
      }
      await page.waitForTimeout(300);
      attempts++;
    }
    throw new Error(`Не удалось прокрутить до сообщения с индексом ${index}`);
  }

  /**
   * Создаёт публичную ссылку на выбранные сообщения.
   */
  async createPublicLink(): Promise<string> {
    if (!this.page) throw new Error('Браузер не запущен');

    //const createButton = this.page.locator('div.fab07e97 .ds-button--primary');
    const profile = await this.profileService.load();
    const createButton = await this.findWithFallback(
      'publicLinkButton',
      profile.selectors.publicLinkButton.chain
    );
    if (!createButton) throw new Error('Кнопка создания публичной ссылки не найдена');
    await createButton.click({ force: true });

    const modal = this.page.locator('div.ds-modal');
    await modal.waitFor({ state: 'visible', timeout: 10000 });

    const confirmButton = modal.locator('.ds-button--primary');
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await confirmButton.click({ force: true });

    const linkText = modal.locator('.ds-copyable-text-line__text');
    await linkText.waitFor({ state: 'visible', timeout: 10000 });

    const url = await linkText.textContent();
    if (!url) throw new Error('Не удалось получить ссылку');

    const closeButton = modal.locator('.ds-modal-content__close');
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ force: true });
    }

    return url.trim();
  }

  /**
   * Пытается установить русский язык интерфейса через Settings.
   * Best-effort: если что-то не найдено — не падаем, просто логируем.
   */
  async setRussianLanguage(): Promise<void> {
    console.warn('[DeepSeek] setRussianLanguage отключён — нужны селекторы страницы Settings');
    if (!this.page) return;

    try {
      // 1. Открываем меню профиля
      const profileBtn = this.page.locator('div._2afd28d').first();
      if ((await profileBtn.count()) === 0) {
        console.warn('[DeepSeek] Кнопка профиля не найдена');
        return;
      }
      await profileBtn.click({ force: true });
      await this.page.waitForTimeout(700);

      // 2. Ищем Settings / Настройки
      const settingsItem = this.page
        .locator('div.ds-dropdown-menu-option__label, div[role="menuitem"], button, div[role="button"]')
        .filter({ hasText: /Settings|Настройки/i })
        .first();
      if ((await settingsItem.count()) === 0) {
        console.warn('[DeepSeek] Пункт Settings не найден');
        await this.page.keyboard.press('Escape');
        return;
      }
      await settingsItem.click({ force: true });
      await this.page.waitForTimeout(1500);

      // 3. Ищем кнопку выбора языка (несколько возможных вариантов)
      const langCandidates = [
        'div[role="button"]:has-text("Language")',
        'div[role="button"]:has-text("Язык")',
        'div[role="button"]:has-text("Display Language")',
        'button:has-text("Language")',
      ];
      let langBtn = null as import('playwright').Locator | null;
      for (const sel of langCandidates) {
        const candidate = this.page.locator(sel).first();
        if (await candidate.count()) { langBtn = candidate; break; }
      }

      if (!langBtn) {
        console.warn('[DeepSeek] Кнопка выбора языка не найдена — сохраняем дамп для анализа');
        await this.dumpCurrentPage('settings_language_missing');
        await this.page.goBack({ waitUntil: 'commit', timeout: 8000 }).catch(() => {});
        return;
      }

      await langBtn.click({ force: true });
      await this.page.waitForTimeout(500);

      // 4. Ищем "Русский" в списке
      const ruOption = this.page
        .locator('div[role="option"], div[role="menuitem"], li, div[role="button"]')
        .filter({ hasText: /Русский|Russian/i })
        .first();

      if ((await ruOption.count()) === 0) {
        console.warn('[DeepSeek] Пункт "Русский" не найден');
        await this.page.keyboard.press('Escape');
        await this.page.goBack({ waitUntil: 'commit', timeout: 8000 }).catch(() => {});
        return;
      }

      await ruOption.click({ force: true });
      await this.page.waitForTimeout(1200);
      console.log('[DeepSeek] Язык переключён на русский');

      // 5. Возвращаемся к чату
      await this.page.goBack({ waitUntil: 'commit', timeout: 8000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    } catch (err) {
      console.warn('[DeepSeek] setRussianLanguage: ' + (err as Error).message);
      try { await this.page.keyboard.press('Escape'); } catch { /* ignore */ }
    }
  }

  /**
   * Повторно генерирует ответ ассистента для заданного сообщения.
   * @param conversationId ID текущего диалога
   * @param messageIndex Индекс сообщения ассистента в списке (0-based)
   */
  async regenerateMessage(conversationId: string, messageIndex: number): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    // Открываем диалог, если нужно
    const currentUrl = this.page.url();
    if (!currentUrl.includes(conversationId)) {
      await this.openConversation(conversationId);
    }

    // Ждём появления сообщений
    await this.page.waitForSelector('div.ds-markdown.ds-assistant-message-main-content', { timeout: 10000 });

    // Находим нужное сообщение по индексу
    const assistantMessages = this.page.locator('div.ds-markdown.ds-assistant-message-main-content');
    const count = await assistantMessages.count();
    if (messageIndex >= count) {
      throw new Error(`Индекс сообщения вне диапазона: ${messageIndex}, всего ${count}`);
    }

    // Ищем родительский контейнер сообщения
    const messageContainer = assistantMessages.nth(messageIndex).locator('xpath=ancestor::div[contains(@class, "_4f9bf79")]').first();
    
    // Кнопка "Повторить" — вторая кнопка с классом db183363 в панели кнопок
    const repeatButton = messageContainer.locator('div.db183363').nth(1); // 0 - copy, 1 - repeat, 2 - like, 3 - dislike, 4 - share
    await repeatButton.waitFor({ state: 'visible', timeout: 5000 });
    await repeatButton.click({ force: true });

    // Ждём завершения генерации (можно отследить появление спиннера или просто таймаут)
    await this.page.waitForTimeout(5000); // TODO: улучшить ожидание
    console.log(`[DeepSeek] Повторная генерация для сообщения ${messageIndex} выполнена`);
  }

  /**
   * Отправляет лайк/дизлайк для сообщения ассистента.
   */
  async sendFeedback(conversationId: string, messageIndex: number, type: 'like' | 'dislike'): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const currentUrl = this.page.url();
    if (!currentUrl.includes(conversationId)) {
      await this.openConversation(conversationId);
    }

    await this.page.waitForSelector('div.ds-markdown.ds-assistant-message-main-content', { timeout: 10000 });

    const assistantMessages = this.page.locator('div.ds-markdown.ds-assistant-message-main-content');
    const count = await assistantMessages.count();
    if (messageIndex >= count) throw new Error('Индекс сообщения вне диапазона');

    const messageContainer = assistantMessages.nth(messageIndex).locator('xpath=ancestor::div[contains(@class, "_4f9bf79")]').first();

    const buttonIndex = type === 'like' ? 2 : 3; // 2 - like, 3 - dislike
    const feedbackButton = messageContainer.locator('div.db183363').nth(buttonIndex);
    await feedbackButton.waitFor({ state: 'visible', timeout: 5000 });
    await feedbackButton.click({ force: true });

    console.log(`[DeepSeek] Отправлен ${type} для сообщения ${messageIndex}`);
  }

  async dumpCurrentPage(name: string = 'dump'): Promise<string> {
    if (!this.page) throw new Error('Браузер не запущен');
    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const filename = `${name}_${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
    const filePath = path.join(dir, filename);
    const html = await this.page.content();
    await fsPromises.writeFile(filePath, html, 'utf-8');
    console.log(`[DeepSeek] HTML дамп сохранён: ${filePath}`);
    return filePath;
  }

  // в deepseekService.ts
  private async findWithFallback(
    name: string,
    chain: string[],
    timeout = 5000
  ): Promise<import('playwright').Locator | null> {
    if (!this.page) return null;
    for (const selector of chain) {
      try {
        const locator = this.page.locator(selector).first();
        await locator.waitFor({ state: 'visible', timeout });
        return locator;
      } catch {
        // пробуем следующий селектор
      }
    }
    await this.dumpCurrentPage(`failed_${name}`);
    return null;
  }

  
  
}


