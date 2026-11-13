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
  id?: string;         // стабильный id сообщения (data-virtual-list-item-key)
  role: 'user' | 'assistant';
  thinking?: string;
  blocks: GatewayChatBlock[];
  fullHtml?: string;   // точный HTML ассистентского ответа для рендера 1:1
  // 5.7: branching
  branchTotal?: number;
  branchIndex?: number;
  // 5.7.21: 1 = активная ветка, 0 = сохранена для истории
  isActive?: number;
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
  private navigationInFlight = false;
  private backgroundScrollInFlight: Promise<void> | null = null;
  // 5.8.2: флаг отмены traverse (устанавливается IPC gateway:cancel-traverse)
  private cancelTraverseRequested = false;

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

    // 2.5: 5.8.2 — флаг отмены traverse
    try {
      await this.page.exposeFunction('__gatewayCancelCheck', () =>
        this.cancelTraverseRequested
      );
    } catch (e) {
      console.warn(
        '[DeepSeek] exposeFunction __gatewayCancelCheck ошибка:',
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

    // 2.5. Проброс console PW в терминал Electron
    // (увидим [bg-scroll] collected: N в основном логе)
    try {
      this.page.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('[bg-scroll]') ||
          text.includes('[DeepSeek]') ||
          text.includes('[injected]')   // ← добавить
        ) {
          console.log('[PW]', text);
        }
      });
    } catch (e) {
      console.warn('[DeepSeek] page.on(console) ошибка:', (e as Error).message);
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
    if (!this.page || this.page.isClosed()) return false;

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
    // Если браузер жив, страница открыта и мы авторизованы — просто возвращаем статус
    if (this.browser && this.browser.isConnected() && this.page && !this.page.isClosed()) {
      if (await this.isAuthenticated()) {
        this.isLoggedIn = true;
        return { status: 'logged_in' };
      }
      return { status: 'running', loginRequired: true };
    }

    // Если браузер "мертв" или страница закрыта — очищаем старые ссылки
    if (this.browser) {
      try { await this.browser.close(); } catch (e) { /* ignore */ }
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
    }

    console.log('Запуск браузера для DeepSeek...');
    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11'],
    });

    // Слушаем событие, если пользователь закроет окно PW руками
    this.browser.on('disconnected', () => {
      console.log('[DeepSeek] Браузер был закрыт извне (disconnected)');
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
      // Дать знать FileBatchService и другим подписчикам
      try {
        this.bridgeEmitter.emit('disconnected');
      } catch {
        /* ignore */
      }
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
   * 5.8.2: запрос отмены текущего doBackgroundScroll.
   * Устанавливает флаг, который проверяется в page.evaluate через
   * exposeFunction('__gatewayCancelCheck'). Сбрасывается в finally.
   */
  cancelTraverse(): void {
    this.cancelTraverseRequested = true;
    console.log('[DeepSeek] cancelTraverse requested');
  }

  /**
   * Возвращает текущий статус (для UI).
   */
  getStatus(): { status: string; isLoggedIn: boolean } {
    const isRunning = !!(this.browser?.isConnected() && this.page && !this.page.isClosed());
    return {
      status: isRunning ? 'running' : 'stopped',
      isLoggedIn: this.isLoggedIn && isRunning,
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
    if (!this.page || this.page.isClosed()) throw new Error('Браузер не запущен или окно закрыто');
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

    // Считаем существующие error-кнопки ДО (могут быть старые ошибки в чате)
    const errorsBefore = await this.page
      .locator('div.ds-message .ds-button--warning')
      .count();

    // Ждём ЛИБО нового сообщения ассистента, ЛИБО появления новой ошибки
    const outcome = (await this.page
      .waitForFunction(
        ({ selector, prevCount, errPrevCount }) => {
          // 1. Успех: новое сообщение ассистента появилось
          const elements = document.querySelectorAll(selector);
          if (elements.length > prevCount) {
            return { type: 'success' as const };
          }

          // 2. Ошибка: появилась новая retry-warning кнопка
          const errBtns = document.querySelectorAll(
            'div.ds-message .ds-button--warning'
          );
          if (errBtns.length > errPrevCount) {
            const lastBtn = errBtns[errBtns.length - 1] as HTMLElement;
            const item = lastBtn.closest('[data-virtual-list-item-key]');
            const errContainer = item?.querySelector(
              '._11d6b3a, [class*="error"]'
            );
            const textSpan = errContainer?.querySelector(
              '._1ce76f5, span[class*="error"], [class*="error-text"]'
            );
            const text =
              textSpan?.textContent?.trim() ||
              errContainer?.textContent?.trim()?.slice(0, 200) ||
              'Unknown network error';
            return { type: 'error' as const, text };
          }

          return false;
        },
        {
          selector: assistantMessageSelector,
          prevCount: messagesBefore,
          errPrevCount: errorsBefore,
        },
        { timeout: 120000, polling: 500 }
      )
      .then((h) => h.jsonValue())) as
      | { type: 'success' }
      | { type: 'error'; text: string }
      | null;

    if (outcome?.type === 'error') {
      // Дамп для диагностики + осмысленная ошибка для GW
      let dumpPath = '';
      try {
        dumpPath = await this.dumpCurrentPage('send_network_error');
      } catch {
        /* не критично */
      }
      throw new Error(
        `DeepSeek не смог обработать запрос: "${outcome.text}".` +
          (dumpPath ? ` Дамп: ${dumpPath}` : '')
      );
    }

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
      const key = parentMessage?.getAttribute('data-virtual-list-item-key');

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
        id: key ? String(key) : undefined,
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
  async getConversations(): Promise<{ id: string; title: string; group?: string }[]> {
    if (!this.page) throw new Error('Браузер не запущен');

    const conversations = await this.page.evaluate(() => {
      const result: { id: string; title: string; group?: string }[] = [];
      
      const groupContainers = document.querySelectorAll('._3098d02');
      
      if (groupContainers.length > 0) {
        groupContainers.forEach((container) => {
          const headerEl = container.querySelector('.f3d18f6a');
          let groupName = 'Все диалоги';
          
          if (headerEl) {
            // Ищем span внутри заголовка, чтобы отсечь иконку стрелочки, если она текстовая
            const titleSpan = headerEl.querySelector('span');
            groupName = titleSpan ? titleSpan.textContent?.trim() || '' : headerEl.textContent?.trim() || '';
          }
          
          container.querySelectorAll('a._546d736').forEach((link) => {
            const href = link.getAttribute('href') || '';
            const titleEl = link.querySelector('.c08e6e93');
            const title = titleEl ? titleEl.textContent?.trim() : '';
            const id = href.split('/').pop() || '';
            if (title && id) {
              result.push({ id, title, group: groupName });
            }
          });
        });
      } else {
        // Фоллбэк, если группы не найдены
        document.querySelectorAll('a._546d736').forEach((link) => {
          const href = link.getAttribute('href') || '';
          const titleEl = link.querySelector('.c08e6e93');
          const title = titleEl ? titleEl.textContent?.trim() : '';
          const id = href.split('/').pop() || '';
          if (title && id) {
            result.push({ id, title });
          }
        });
      }
      
      return result;
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
    this.navigationInFlight = true;
    try {
      await this.gotoWithTimeout(url, 15000);
      await this.page.waitForTimeout(2000);
    } finally {
      this.navigationInFlight = false;
    }
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

  async getConversationMessages(opts?: {
    skipBackgroundScroll?: boolean;
  }): Promise<GatewayChatMessage[]> {
    if (!this.page) throw new Error('Браузер не запущен');

    try {
      await this.page.waitForSelector('div.ds-virtual-list.ds-virtual-list--printable', { timeout: 10000 });
    } catch {
      return [];
    }

    // 1. Быстро отдаём ТОЛЬКО видимые сейчас сообщения (без скролла)
    const initial = await this.page.evaluate(() => {
      const container = document.querySelector('div.ds-virtual-list.ds-virtual-list--printable') as HTMLElement | null;
      if (!container) return [];

    const parse = (entry: {
        key: string;
        numericKey: number | null;
        html: string;
        role: 'user' | 'assistant';
        domIndex: number;
      }) => {
        const div = document.createElement('div');
        div.innerHTML = entry.html;
        const id = entry.numericKey !== null ? entry.key : undefined;

        // 5.7.7: Ищем ветки регуляркой прямо в HTML.
        let branchTotal = 1;
        let branchIndex = 1;
        const branchMatch = entry.html.match(/dd7e4fda[^>]*>(\d+)\s*\/\s*(\d+)<\/div>/);
        if (branchMatch) {
          branchIndex = parseInt(branchMatch[1], 10);
          branchTotal = parseInt(branchMatch[2], 10);
        }
        // 5.7.42: наследование branchTotal/branchIndex для assistant
        // от ближайшего user сверху (у assistant нет своего switcher'а).
        if (
          entry.role === 'assistant' &&
          branchTotal === 1 &&
          (entry as any).inheritBranchTotal &&
          (entry as any).inheritBranchTotal > 1
        ) {
          branchTotal = (entry as any).inheritBranchTotal;
          branchIndex = (entry as any).inheritBranchIndex;
        }

        if (entry.role === 'user') {
          const blocks: any[] = [];
          const chipContainer = div.querySelector('.eafda4ae');
          if (chipContainer) {
            chipContainer.querySelectorAll('._25c7358').forEach((chip) => {
              const nameEl = chip.querySelector('.e70accd6');
              const metaEl = chip.querySelector('._7103a25');
              const name = nameEl?.textContent?.trim() || '';
              if (!name) return;
              const metaText = metaEl?.textContent?.trim() || '';
              const parts = metaText.split(/\s+/).filter(Boolean);
              const mime = (parts[0] || '').toUpperCase();
              const size = parts.slice(1).join(' ');

              let fileKind: 'text' | 'image' | 'binary' = 'binary';
              if (/^(TXT|MD|JSON|CSV|LOG|XML|YAML|YML|JS|TS|PY|HTML|CSS|SQL)$/.test(mime)) {
                fileKind = 'text';
              } else if (/^(PNG|JPG|JPEG|GIF|WEBP|SVG|BMP|HEIC)$/.test(mime)) {
                fileKind = 'image';
              }

              const imgEl = chip.querySelector('img');
              const thumbUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || undefined;
              blocks.push({ type: 'file', content: name, mime, size, fileKind, thumbUrl });
            });
          }

          const fbb = div.querySelector('.fbb737a4');
          const text = fbb?.textContent?.trim() || '';
          if (text) blocks.push({ type: 'text', content: text });

          if (blocks.length === 0) return null;
          return { id, role: 'user', blocks, branchTotal, branchIndex };
        }

        let thinking: string | undefined;
        const tEl = div.querySelector('div.e1675d8b.ds-think-content');
        if (tEl) thinking = tEl.textContent?.trim() || '';

        const main = div.querySelector('div.ds-markdown.ds-assistant-message-main-content');
        
        // 5.7.7: Если это ассистент, но main ещё пуст (lazy-load),
        // мы НЕ возвращаем null, а отдаём пустой блок. Это гарантирует,
        // что сообщение сохранится в БД, а следующий sync его обновит.
        if (!main) {
          return { id, role: 'assistant', blocks: [], branchTotal, branchIndex };
        }

        const mainClone = main.cloneNode(true) as HTMLElement;
        mainClone.querySelectorAll('.md-code-block-banner-wrap').forEach((el) => el.remove());

        const blocks: any[] = [];
        mainClone.childNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const el = n as HTMLElement;
            if (el.classList.contains('md-code-block')) {
              const lang = el.querySelector('span.d813de27')?.textContent?.trim() || 'text';
              const code = el.querySelector('pre')?.textContent || '';
              if (code.trim()) blocks.push({ type: 'code', content: code, language: lang });
            } else {
              const text = el.textContent?.trim() || '';
              if (text) blocks.push({ type: 'text', content: text });
            }
          } else if (n.nodeType === Node.TEXT_NODE) {
            const text = n.textContent?.trim() || '';
            if (text) blocks.push({ type: 'text', content: text });
          }
        });
        
        if (blocks.length === 0) {
          const text = mainClone.textContent?.trim() || '';
          if (text) blocks.push({ type: 'text', content: text });
        }

        return {
          id,
          role: 'assistant',
          thinking,
          blocks,
          fullHtml: (main as HTMLElement).innerHTML,
          branchTotal,
          branchIndex,
        };
      };

      type RawEntry = {
        key: string;
        numericKey: number | null;
        html: string;
        role: 'user' | 'assistant';
        domIndex: number;
        absTop: number;
      };

      // Ключ = СТРОКА (content-hash для non-numeric). См. комментарий
      // в backgroundScrollAndEmit — PW переиспользует HTMLElement.
      const simpleHash = (s: string): string => {
        let h = 5381;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        }
        return (h >>> 0).toString(36);
      };

      const map = new Map<string, RawEntry>();
      let domIndex = 0;

      const cRect = container.getBoundingClientRect();
      const cScrollTop = container.scrollTop;

      container.querySelectorAll('div[data-virtual-list-item-key]').forEach((itemEl) => {
        const el = itemEl as HTMLElement;
        const keyAttr = el.getAttribute('data-virtual-list-item-key') || '';
        if (!keyAttr) return;
        const keyNum = parseInt(keyAttr, 10);
        const numericKey = isNaN(keyNum) ? null : keyNum;
        const storedKey = numericKey !== null ? keyAttr : '';
        const hasUserText = !!el.querySelector('div.fbb737a4');
        const hasFileChips = !!el.querySelector('.eafda4ae');
        const isUser = hasUserText || hasFileChips;
        let html = '';
        let role: 'user' | 'assistant';
        if (isUser) {
          // 5.7.5: Берём весь HTML, чтобы захватить switcher веток
          html = el.innerHTML;
          role = 'user';
        } else {
          const main = el.querySelector('div.ds-markdown.ds-assistant-message-main-content');
          if (!main) return;
          html = el.innerHTML;
          role = 'assistant';
        }
        // 5.6.2: absTop — абсолютная позиция сообщения в скролле.
        // Используется для сортировки non-numeric сообщений (user/assistant
        // без numeric data-virtual-list-item-key), которые иначе уезжают в конец.
        const r = el.getBoundingClientRect();
        const absTop = r.top - cRect.top + cScrollTop;
        const mapKey = storedKey || `h_${simpleHash(html)}`;
        if (map.has(mapKey)) return;
        map.set(mapKey, {
          key: storedKey,
          numericKey,
          html,
          role,
          domIndex: domIndex++,
          absTop,
        });
      });

      const entries = Array.from(map.values());
      const nonNumeric = entries.filter((e) => e.numericKey === null);
      if (nonNumeric.length > 0) {
        console.log(
          '[DeepSeek] ⚠ non-numeric keys:',
          nonNumeric.length,
          'items — dedupe by element ref, not key'
        );
      }
      // 5.6.2: единая сортировка по absTop (позиция в документе).
      // Фолбэк по numericKey, затем по domIndex.
      entries.sort((a, b) => {
        // 5.7.2: Приоритет numericKey. absTop ненадежен для виртуального списка.
        if (a.numericKey !== null && b.numericKey !== null) {
          return a.numericKey - b.numericKey;
        }
        if (Math.abs(a.absTop - b.absTop) > 1) return a.absTop - b.absTop;
        if (a.numericKey !== null) return -1;
        if (b.numericKey !== null) return 1;
        return a.domIndex - b.domIndex;
      });
      // 5.7.42: наследование branchTotal/branchIndex для assistant
      // от ближайшего user сверху (у assistant нет своего switcher'а).
      const enriched = entries.map((entry, idx) => {
        if (entry.role !== 'assistant') return entry;
        for (let i = idx - 1; i >= 0; i--) {
          if (entries[i].role === 'user') {
            const tmp = document.createElement('div');
            tmp.innerHTML = entries[i].html;
            for (const textEl of Array.from(tmp.querySelectorAll('.dd7e4fda'))) {
              const m = (textEl.textContent || '').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
              if (m) {
                return {
                  ...entry,
                  inheritBranchIndex: parseInt(m[1], 10),
                  inheritBranchTotal: parseInt(m[2], 10),
                };
              }
            }
            break;
          }
        }
        return entry;
      });
      return enriched.map(parse).filter(Boolean);
    });

    // 2. Запускаем фоновый сбор всей истории (если не отключено)
    if (!opts?.skipBackgroundScroll) {
      void this.backgroundScrollAndEmit();
    }

    return initial as GatewayChatMessage[];
  }

  /**
   * 5.6: публичная обёртка для IPC `gateway:scroll-history`.
   * Возвращает Promise, который резолвится после history:complete.
   * Если скролл уже идёт — join'ится к текущему (а не отдаёт мгновенный void).
   */
  async scrollHistory(opts?: {
    collectInactive?: boolean;
    speed?: 'fast' | 'normal' | 'slow';
  }): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');
    await this.backgroundScrollAndEmit(
      opts?.collectInactive === true,
      opts?.speed ?? 'normal'
    );
  }

  /**
   * 5.8.3-snapshot: читает ВСЕ ветки диалога из IndexedDB (deepseek-chat).
   * За <1с получает полное дерево сообщений (chat_messages с parent_id)
   * без кликов switcher'ов и без PoW.
   *
   * Fallback на doBackgroundScroll(traverse) при ошибке — достигнутый
   * прогресс не теряется.
   */
  async snapshotHistory(opts?: {
    fallbackOnError?: boolean;
  }): Promise<'indexeddb' | 'traverse'> {
    if (!this.page) throw new Error('Браузер не запущен');

    // Определяем активный convId по URL
    const url = this.page.url();
    const m = url.match(/\/a\/chat\/s\/([a-f0-9-]+)/i);
    if (!m) {
      throw new Error('Не удалось определить convId из URL PW');
    }
    const convId = m[1];
    console.log(`[snapshot] convId=${convId}`);

    const t0 = Date.now();
    try {
      const raw = await this.page.evaluate(async (id: string) => {
        const db = await new Promise<IDBDatabase>((res, rej) => {
          const req = indexedDB.open('deepseek-chat');
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
        try {
          if (!db.objectStoreNames.contains('history-message')) {
            return { ok: false, error: 'store history-message not found' };
          }
          const tx = db.transaction('history-message', 'readonly');
          const store = tx.objectStore('history-message');
          const value = await new Promise<any>((res, rej) => {
            const req = store.get(id);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
          if (!value) return { ok: false, error: 'no entry for ' + id };
          return { ok: true, data: value };
        } finally {
          db.close();
        }
      }, convId);

      if (!raw || !raw.ok) {
        throw new Error(`IndexedDB: ${raw?.error || 'empty result'}`);
      }

      const parsed = this.parseIndexedDbSnapshot(raw.data);
      console.log(
        `[snapshot] IndexedDB OK: ${parsed.length} msgs, ${
          Date.now() - t0
        }ms`
      );

      // Отправляем через bridgeEmitter как 'history:complete'
      this.bridgeEmitter.emit('event', {
        type: 'history:complete',
        payload: {
          rawMessages: parsed,
          source: 'indexeddb',
          elapsedMs: Date.now() - t0,
        },
        ts: Date.now(),
      });

      return 'indexeddb';
    } catch (e) {
      console.warn(
        `[snapshot] IndexedDB failed (${(e as Error).message}), fallback to traverse`
      );
      if (opts?.fallbackOnError === false) {
        throw e;
      }
      await this.backgroundScrollAndEmit(true, 'normal');
      return 'traverse';
    }
  }

  /**
   * 5.8.3: минимальный markdown → HTML для snapshot из IndexedDB.
   * Использует CSS-классы DeepSeek (.ds-markdown-paragraph, .md-code-block),
   * чтобы тема применилась к нашему HTML.
   *
   * Поддержка: code blocks, inline code, headers, bold, italic,
   * blockquote, ul, ol, параграфы.
   *
   * НЕ идеален: таблицы, math, сложные списки — без обработки.
   * Для точного HTML видимых сообщений — visible-sync обновит из PW DOM.
   */
  private markdownToHtml(md: string): string {
    if (!md) return '';
    let html = md;

    // 1. Code blocks: ```lang\ncode\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      const escaped = String(code)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const langLabel = lang
        ? `<span class="d813de27">${lang}</span>`
        : '';
      const langClass = lang ? ` class="language-${lang}"` : '';
      return (
        `<div class="md-code-block md-code-block-dark">` +
        langLabel +
        `<pre><code${langClass}>${escaped}</code></pre></div>`
      );
    });

    // 2. Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // 3. Headers
    html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // 4. Bold / italic
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    // 5. Blockquote
    html = html.replace(
      /^> (.*)$/gm,
      '<blockquote class="ds-markdown-blockquote">$1</blockquote>'
    );

    // 6. Unordered list (группа строк "- ...")
    html = html.replace(/(?:^- .+$\n?)+/gm, (match) => {
      const items = match
        .trim()
        .split('\n')
        .map((l) => l.replace(/^- /, ''))
        .map((l) => `<li>${l}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    });

    // 7. Ordered list
    html = html.replace(/(?:^\d+\. .+$\n?)+/gm, (match) => {
      const items = match
        .trim()
        .split('\n')
        .map((l) => l.replace(/^\d+\. /, ''))
        .map((l) => `<li>${l}</li>`)
        .join('');
      return `<ol>${items}</ol>`;
    });

    // 8. Параграфы: разбиваем по пустым строкам, каждый не-тег → <p>
    const blocks = html.split(/\n{2,}/);
    html = blocks
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        // Уже HTML-тег?
        if (/^<(h[1-6]|ul|ol|blockquote|div|pre|p)\b/i.test(trimmed)) {
          return trimmed;
        }
        return `<p class="ds-markdown-paragraph">${trimmed.replace(
          /\n/g,
          '<br>'
        )}</p>`;
      })
      .join('');

    return html;
  }

  /**
   * Парсер IndexedDB snapshot → GatewayChatMessage[].
   * Восстанавливает дерево веток через parent_id + current_message_id.
   */
  private parseIndexedDbSnapshot(raw: any): GatewayChatMessage[] {
    const data = raw?.data || raw;
    const chatSession = data?.chat_session || {};
    const chatMessages = (data?.chat_messages || []) as any[];
    const currentMessageId = chatSession?.current_message_id as
      | number
      | undefined;

    if (!Array.isArray(chatMessages) || chatMessages.length === 0) {
      return [];
    }

    // 1. Индексируем по message_id
    const byId = new Map<number, any>();
    for (const m of chatMessages) {
      const id = Number(m?.message_id);
      if (!isNaN(id)) byId.set(id, m);
    }

    // 2. Группируем по parent_id → siblings = switcher'ы
    const byParent = new Map<number | null, number[]>();
    for (const [id, m] of byId) {
      const pRaw = m?.parent_id;
      const parentId =
        pRaw == null || pRaw === '' ? null : Number(pRaw);
      if (parentId !== null && isNaN(parentId)) continue;
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId)!.push(id);
    }
    // Сортируем siblings по message_id (стабильный порядок: старая → новая)
    for (const arr of byParent.values()) arr.sort((a, b) => a - b);

    // 3. Восстанавливаем "active path" от current_message_id вверх
    const activePath = new Set<number>();
    if (currentMessageId != null && byId.has(currentMessageId)) {
      let cur: number | null = currentMessageId;
      const safety = new Set<number>();
      while (cur != null && byId.has(cur) && !safety.has(cur)) {
        safety.add(cur);
        activePath.add(cur);
        const pRaw: any = byId.get(cur)?.parent_id;
        const parent: number | null =
          pRaw == null || pRaw === '' ? null : Number(pRaw);
        cur = parent;
      }
    }

    // 4. Для каждого сообщения — branchTotal/branchIndex/isActive
    const result: GatewayChatMessage[] = [];

    for (const m of chatMessages) {
      const messageId = Number(m?.message_id);
      if (isNaN(messageId)) continue;

      const pRaw = m?.parent_id;
      const parentId = pRaw == null || pRaw === '' ? null : Number(pRaw);
      const siblings =
        parentId !== null || byParent.has(null)
          ? byParent.get(parentId) || []
          : [messageId];

      const branchTotal = Math.max(1, siblings.length);
      const branchIndex =
        branchTotal > 1 ? siblings.indexOf(messageId) + 1 : 1;

      const roleRaw = String(m?.role || '').toUpperCase();
      const role: 'user' | 'assistant' =
        roleRaw === 'USER' ? 'user' : 'assistant';

      // fragments
      const fragments = (m?.fragments || []) as any[];
      let thinking: string | undefined;
      let userText = '';
      let assistantText = '';
      const files: any[] = [];

      for (const f of fragments) {
        const type = String(f?.type || '').toUpperCase();
        const content = f?.content || '';
        if (type === 'THINK') {
          thinking = (thinking || '') + String(content);
        } else if (type === 'REQUEST') {
          userText += String(content);
        } else if (type === 'RESPONSE') {
          assistantText += String(content);
        } else if (type === 'FILE' || type === 'ATTACHMENT') {
          files.push({
            type: 'file' as const,
            content: String(f?.name || 'file'),
            mime: f?.mime,
            size: f?.size,
          });
        }
      }

      // blocks
      const blocks: any[] = [];
      if (role === 'user') {
        if (files.length > 0) blocks.push(...files);
        if (userText) blocks.push({ type: 'text', content: userText.trim() });
      } else {
        // Ассистент: markdown-контент → plain text (fallback, visible-sync
        // потом подтянет полный HTML из PW DOM)
        if (assistantText) {
          blocks.push({ type: 'text', content: assistantText.trim() });
        }
      }

      if (blocks.length === 0) continue;

      // 5.8.3: генерируем HTML из markdown для assistant-сообщений.
      // Без этого UI рендерит plain text (fallback из blocks), и всё
      // форматирование (код, заголовки, списки) теряется.
      const fullHtml =
        role === 'assistant' && assistantText
          ? this.markdownToHtml(assistantText)
          : undefined;

      result.push({
        id: String(messageId),
        role,
        thinking,
        blocks,
        fullHtml,
        branchTotal,
        branchIndex,
        isActive: activePath.has(messageId) ? 1 : 0,
      });
    }

    // Сортируем по message_id (порядок в дереве — от корня к листьям)
    result.sort((a, b) => {
      const an = parseInt(a.id || '0', 10);
      const bn = parseInt(b.id || '0', 10);
      return an - bn;
    });

    return result;
  }

  private async backgroundScrollAndEmit(
    collectInactive = false,
    speed: 'fast' | 'normal' | 'slow' = 'normal'
  ): Promise<void> {
    if (!this.page) return;
    if (this.navigationInFlight) {
      console.debug(
        '[DeepSeek] backgroundScrollAndEmit пропущен — идёт навигация'
      );
      return;
    }
    const inflight = this.backgroundScrollInFlight;
    if (inflight) {
      console.debug(
        '[DeepSeek] backgroundScrollAndEmit уже выполняется — ждём завершения'
      );
      return inflight;
    }
    this.backgroundScrollInFlight = this.doBackgroundScroll(collectInactive, speed);
    try {
      await this.backgroundScrollInFlight;
    } finally {
      this.backgroundScrollInFlight = null;
    }
  }

  private async doBackgroundScroll(
    collectInactive = false,
    speed: 'fast' | 'normal' | 'slow' = 'normal'
  ): Promise<void> {
    if (!this.page) return;
    try {
      await this.page.evaluate(async (args: { collectInactive: boolean; speed: string }) => {
        const collectInactiveArg = args.collectInactive;
        const speed = args.speed;
        // 5.8.2: время начала сбора (для elapsedMs)
        const startTs = Date.now();
        
        // 5.8.2: флаг отмены + helper. Вызывается из каждого цикла.
        let wasCancelled = false;
        const checkCancel = async (): Promise<boolean> => {
          try {
            const fn = (window as any).__gatewayCancelCheck;
            if (typeof fn !== 'function') return false;
            const c = await fn();
            if (c) {
              wasCancelled = true;
              console.log('[bg-scroll] cancel detected, breaking');
            }
            return !!c;
          } catch {
            return false;
          }
        };

        // 5.8.3: скорость скроллинга
        const speedConfig = {
          fast: { step: 400, delay: 300 },
          normal: { step: 250, delay: 500 },
          slow: { step: 150, delay: 800 },
        }[speed as 'fast' | 'normal' | 'slow'] || { step: 250, delay: 500 };
        const container = document.querySelector(
          'div.ds-virtual-list.ds-virtual-list--printable'
        ) as HTMLElement | null;
        if (!container) return;

        (window as any).__gatewayIsScrolling = true;

        const parse = (entry: {
          key: string;
          numericKey: number | null;
          html: string;
          role: 'user' | 'assistant';
          seq: number;
          isActive: number;
        }) => {
          const div = document.createElement('div');
          div.innerHTML = entry.html;
          const id = entry.numericKey !== null ? entry.key : undefined;

          // 5.7.14: querySelector вместо regex — dumpFullPWState находит switcher
          // через querySelector всегда, а regex иногда нет.
          let branchTotal = 1;
          let branchIndex = 1;
          for (const textEl of Array.from(
            div.querySelectorAll('.dd7e4fda')
          )) {
            const m = (textEl.textContent || '').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
            if (m) {
              branchIndex = parseInt(m[1], 10);
              branchTotal = parseInt(m[2], 10);
              break;
            }
          }
          // 5.7.31: наследование от предыдущего user (см. обогащение в send())
          if (
            entry.role === 'assistant' &&
            branchTotal === 1 &&
            (entry as any).inheritBranchTotal &&
            (entry as any).inheritBranchTotal > 1
          ) {
            branchTotal = (entry as any).inheritBranchTotal;
            branchIndex = (entry as any).inheritBranchIndex;
          }

          if (entry.role === 'user') {
            const blocks: any[] = [];
            const chipContainer = div.querySelector('.eafda4ae');
            if (chipContainer) {
              chipContainer.querySelectorAll('._25c7358').forEach((chip) => {
                const nameEl = chip.querySelector('.e70accd6');
                const metaEl = chip.querySelector('._7103a25');
                const name = nameEl?.textContent?.trim() || '';
                if (!name) return;
                const metaText = metaEl?.textContent?.trim() || '';
                const parts = metaText.split(/\s+/).filter(Boolean);
                const mime = (parts[0] || '').toUpperCase();
                const size = parts.slice(1).join(' ');

                let fileKind: 'text' | 'image' | 'binary' = 'binary';
                if (/^(TXT|MD|JSON|CSV|LOG|XML|YAML|YML|JS|TS|PY|HTML|CSS|SQL)$/.test(mime)) {
                  fileKind = 'text';
                } else if (/^(PNG|JPG|JPEG|GIF|WEBP|SVG|BMP|HEIC)$/.test(mime)) {
                  fileKind = 'image';
                }

                const imgEl = chip.querySelector('img');
                const thumbUrl =
                  imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || undefined;

                blocks.push({ type: 'file', content: name, mime, size, fileKind, thumbUrl });
              });
            }

            const fbb = div.querySelector('.fbb737a4');
            const text = fbb?.textContent?.trim() || '';
            if (text) blocks.push({ type: 'text', content: text });

            if (blocks.length === 0) return null;
            return {
              id,
              role: 'user',
              blocks,
              branchTotal,
              branchIndex,
              isActive: entry.isActive,
            };
          }

          let thinking: string | undefined;
          const tEl = div.querySelector('div.e1675d8b.ds-think-content');
          if (tEl) thinking = tEl.textContent?.trim() || '';

          const main = div.querySelector(
            'div.ds-markdown.ds-assistant-message-main-content'
          );

          // 5.7.10: пустой main = lazy-load, а НЕ отсутствие сообщения.
          // Возвращаем «пустышку» с id, чтобы sync вставил строку в БД
          // (следующий partial-sync её обновит).
          if (!main) {
            return {
              id,
              role: 'assistant',
              blocks: [],
              fullHtml: '',
              branchTotal,
              branchIndex,
            };
          }

          const blocks: any[] = [];
          main.childNodes.forEach((n) => {
            if (n.nodeType === Node.ELEMENT_NODE) {
              const el = n as HTMLElement;
              if (el.classList.contains('md-code-block')) {
                const lang =
                  el.querySelector('span.d813de27')?.textContent?.trim() || 'text';
                const code = el.querySelector('pre')?.textContent || '';
                if (code.trim())
                  blocks.push({ type: 'code', content: code, language: lang });
              } else {
                const text = el.textContent?.trim() || '';
                if (text) blocks.push({ type: 'text', content: text });
              }
            } else if (n.nodeType === Node.TEXT_NODE) {
              const text = n.textContent?.trim() || '';
              if (text) blocks.push({ type: 'text', content: text });
            }
          });
          if (blocks.length === 0) {
            const text = main.textContent?.trim() || '';
            if (text) blocks.push({ type: 'text', content: text });
          }
          return {
            id,
            role: 'assistant',
            thinking,
            blocks,
            fullHtml: (main as HTMLElement).innerHTML,
            branchTotal,
            branchIndex,
            isActive: entry.isActive,
          };
        };

        type RawEntry = {
          key: string;
          numericKey: number | null;
          html: string;
          role: 'user' | 'assistant';
          seq: number;
          absTop: number;
          isActive: number;
        };

        const simpleHash = (s: string): string => {
          let h = 5381;
          for (let i = 0; i < s.length; i++) {
            h = ((h << 5) + h + s.charCodeAt(i)) | 0;
          }
          return (h >>> 0).toString(36);
        };

        const map = new Map<string, RawEntry>();
        let nextSeq = 0;
        let lastSentSize = 0;

        // 5.7.23: флаг — пока true, все сканированные сообщения
        // помечаются как неактивные. Нужно, чтобы MutationObserver,
        // срабатывающий во время switch, не записывал 41/42 как active.
        let traverseInactive = false;

        // 5.7.28: явный список "навсегда неактивных" pwKeys.
        // Без него промежуточные collect() после switch-back возвращают
        // 41/42 в активные, и в БД уходит 0 inactive.
        const inactivePwKeys = new Set<number>();

        const collect = (asInactive?: boolean) => {
          // 5.7.26: параметр переопределяет traverseInactive локально.
          // Используется для явного вызова из traverse-цикла (collect(true)
          // после клика prev), но при этом сам флаг traverseInactive
          // остаётся для MutationObserver.
          const inactive = asInactive === true || traverseInactive;

          const cRect = container.getBoundingClientRect();
          const cScrollTop = container.scrollTop;
          container
            .querySelectorAll('div[data-virtual-list-item-key]')
            .forEach((node) => {
              const el = node as HTMLElement;
              // 5.7.8: НЕ отсеиваем по offsetHeight — это ломало lazy-load
              // и теряло сообщения (например, 48). Дедуп по key работает
              // и так, а «ghost»-элементы после prune удалятся.
              
              const keyAttr = el.getAttribute('data-virtual-list-item-key') || '';
              if (!keyAttr) return;
              const keyNum = parseInt(keyAttr, 10);
              const numericKey = isNaN(keyNum) ? null : keyNum;
              const hasUserText = !!el.querySelector('div.fbb737a4');
              const hasFileChips = !!el.querySelector('.eafda4ae');
              const isUser = hasUserText || hasFileChips;
              const main = isUser
                ? null
                : el.querySelector('div.ds-markdown.ds-assistant-message-main-content');
              // 5.7.11: assistant без main = lazy-load, НЕ отсеиваем.
              // Запись создастся с пустым HTML, следующий sync её обновит.
              const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
              // 5.7.5: Берём весь HTML, чтобы захватить switcher веток
              const html = el.innerHTML;
              const storedKey = numericKey !== null ? keyAttr : '';
              const r = el.getBoundingClientRect();
              const absTop = r.top - cRect.top + cScrollTop;

              const mapKey = storedKey || `h_${simpleHash(html)}`;
              const existing = map.get(mapKey);
              if (existing) {
                existing.absTop = absTop;
                const hasBranch = html.includes('dd7e4fda');
                const hadBranch = existing.html.includes('dd7e4fda');
                const longer = html.length > existing.html.length;
                if ((hasBranch && !hadBranch) || (hasBranch === hadBranch && longer)) {
                  existing.html = html;
                }
                // 5.7.29: во время traverse (inactive=true) НЕ трогаем
                // isActive у существующих — иначе 34-40 (общие сообщения
                // из обеих веток) сбрасываются в неактивные и попадают
                // в blacklist. Трогаем только в обычном collect.
                if (!inactive) {
                  if (numericKey === null || !inactivePwKeys.has(numericKey)) {
                    existing.isActive = 1;
                  }
                }
                return;
              }
              // Новый элемент (не было в map до этого collect).
              // Если traverse — помечаем неактивным и добавляем в blacklist.
              const isNewInactive =
                inactive ||
                (numericKey !== null && inactivePwKeys.has(numericKey));
              if (isNewInactive && numericKey !== null) {
                inactivePwKeys.add(numericKey);
              }
              map.set(mapKey, {
                key: storedKey,
                numericKey,
                html,
                role,
                seq: nextSeq++,
                absTop,
                isActive: isNewInactive ? 0 : 1,
              });
            });
        };

        // 5.8.2: throttle для progress-событий (не спамить IPC)
        let lastProgressTs = 0;
        const THROTTLE_MS = 500;

        const send = (
          isComplete: boolean,
          progress?: {
            phase:
              | 'bottom-up'
              | 'top-down'
              | 'final'
              | 'gaps'
              | 'traverse'
              | 'verify';
            direction: 'up' | 'down' | 'bidir';
            pass: number;
            totalPasses: number;
            currentPwKey?: string;
            branchTotal?: number;
            branchDone?: number;
          },
          cancelled?: boolean
        ) => {
          const arr = Array.from(map.values()).sort((a, b) => {
            if (a.numericKey !== null && b.numericKey !== null) {
              return a.numericKey - b.numericKey;
            }
            if (Math.abs(a.absTop - b.absTop) > 1) return a.absTop - b.absTop;
            if (a.numericKey !== null) return -1;
            if (b.numericKey !== null) return 1;
            return a.seq - b.seq;
          });
          // 5.7.18: диагностика — что реально лежит в arr для 43/47
          // до вызова parse. Если has_dd7e4fda=false — значит collect
          // не сохранил версию со switcher'ом.
          const m43 = arr.find((a) => a.numericKey === 43);
          const m47 = arr.find((a) => a.numericKey === 47);
          if (m43) {
            console.log(
              `[bg-scroll] before parse: 43 has_dd7e4fda=${m43.html.includes('dd7e4fda')} html_len=${m43.html.length}`
            );
          } else {
            console.log('[bg-scroll] before parse: 43 NOT IN MAP');
          }
          if (m47) {
            console.log(
              `[bg-scroll] before parse: 47 has_dd7e4fda=${m47.html.includes('dd7e4fda')} html_len=${m47.html.length}`
            );
          } else {
            console.log('[bg-scroll] before parse: 47 NOT IN MAP');
          }
          // 5.7.31: у assistant в PW нет своего switcher'а — наследуем
          // branchTotal/branchIndex от ближайшего user сверху.
          // Это гарантирует, что assistant получит тот же _b${branchIndex}
          // в salt → новый hash → нет коллизий с другими ветками.
          const enriched = arr.map((entry, idx) => {
            if (entry.role !== 'assistant') return entry;
            for (let i = idx - 1; i >= 0; i--) {
              if (arr[i].role === 'user') {
                const tmp = document.createElement('div');
                tmp.innerHTML = arr[i].html;
                for (const el of Array.from(
                  tmp.querySelectorAll('.dd7e4fda')
                )) {
                  const m = (el.textContent || '').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
                  if (m) {
                    return {
                      ...entry,
                      inheritBranchIndex: parseInt(m[1], 10),
                      inheritBranchTotal: parseInt(m[2], 10),
                    } as typeof entry;
                  }
                }
                break;
              }
            }
            return entry;
          });

          const parsed = enriched.map(parse).filter(Boolean);
          // 5.7.18: что получилось после parse
          const p43 = parsed.find((p: any) => p.id === '43');
          const p47 = parsed.find((p: any) => p.id === '47');
          if (p43) {
            console.log(
              `[bg-scroll] after parse: 43 branch=${p43.branchIndex}/${p43.branchTotal}`
            );
          }
          if (p47) {
            console.log(
              `[bg-scroll] after parse: 47 branch=${p47.branchIndex}/${p47.branchTotal}`
            );
          }
          if (typeof (window as any).__gatewayBridge === 'function') {
            // 5.8.2: собираем scrollProgress, если задан и не complete
            let scrollProgress: any = undefined;
            if (progress && !isComplete) {
              const now = Date.now();
              if (now - lastProgressTs >= THROTTLE_MS) {
                lastProgressTs = now;
                scrollProgress = {
                  phase: progress.phase,
                  direction: progress.direction,
                  pass: progress.pass,
                  totalPasses: progress.totalPasses,
                  elapsedMs: now - startTs,
                  collectedCount: map.size,
                  branchTotal: progress.branchTotal ?? 0,
                  branchDone: progress.branchDone ?? 0,
                  currentPwKey: progress.currentPwKey,
                };
              }
            }
            (window as any).__gatewayBridge(
              isComplete ? 'history:complete' : 'history:progress',
              {
                rawMessages: parsed,
                scrollProgress,
                cancelled: cancelled === true,
              }
            );
          }
        };

        const observer = new MutationObserver(() => {
          collect();
        });
        observer.observe(container, { childList: true, subtree: true });

        try {
          container.scrollTop = 0;
          await new Promise((r) => setTimeout(r, 1500));
          collect();
          if (map.size > 0) {
            send(false);
            lastSentSize = map.size;
          }

          // 5.7.6: Экстремально медленный шаг (150px) с большой паузой (800мс).
          // Это нужно, чтобы виртуалка PW успела отрисовать длинные сообщения.
          const step = 400;

          // Снизу вверх
          let pos = container.scrollHeight;
          while (pos >= 0) {
            if (await checkCancel()) break;
            container.scrollTop = pos;
            try { container.dispatchEvent(new Event('scroll', { bubbles: true })); } catch {}
            await new Promise((r) => setTimeout(r, speedConfig.delay));
            collect();
            send(false, {
              phase: 'bottom-up',
              direction: 'up',
              pass: 1,
              totalPasses: 1,
            });
            pos -= speedConfig.step;
          }

          // 5.8.2: top-down НЕ нужен — bottom-up уже прогрел все lazy-load
          // элементы, virtual-list переиспользует их. Дублирование = -25с.
          if (!wasCancelled) {
            container.scrollTop = 0;
            try { container.dispatchEvent(new Event('scroll', { bubbles: true })); } catch {}
            await new Promise((r) => setTimeout(r, speedConfig.delay));
            collect();
            send(false, {
              phase: 'top-down',
              direction: 'down',
              pass: 1,
              totalPasses: 1,
            });
          }

          if (!wasCancelled) {
            // Финальный проход
            // 5.8.2: final — короткий проход для lazy-load switcher'ов.
            // Шаг 400/300мс вместо 200/500 = -50с на больших диалогах.
            container.scrollTop = 0;
            await new Promise((r) => setTimeout(r, 1500));
            collect();
            for (let p = 0; p <= container.scrollHeight; p += 400) {
              if (await checkCancel()) break;
              container.scrollTop = p;
              await new Promise((r) => setTimeout(r, 300));
              collect();
              send(false, {
                phase: 'final',
                direction: 'down',
                pass: 1,
                totalPasses: 1,
              });
            }
          }

          if (!wasCancelled) {
            // 5.7.6: точечный скролл к «дыркам» в числовых ключах
            // 5.7.15: до 3 проходов по пробелам, чтобы PW успел отрендерить
            for (let pass = 0; pass < 2; pass++) {
              if (await checkCancel()) break;
              const numericKeys = Array.from(map.values())
                .map((e) => e.numericKey)
                .filter((k): k is number => k !== null)
                .sort((a, b) => a - b);

              let foundGap = false;
              for (let i = 1; i < numericKeys.length; i++) {
                if (numericKeys[i] - numericKeys[i - 1] > 1) {
                  foundGap = true;
                  const nextKey = String(numericKeys[i]);
                  const nextEl = container.querySelector(
                    `[data-virtual-list-item-key="${nextKey}"]`
                  ) as HTMLElement | null;
                  if (nextEl) {
                    console.log(
                      `[bg-scroll] pass ${pass}: gap before ${nextKey} — targeted scroll`
                    );
                    send(false, {
                      phase: 'gaps',
                      direction: 'bidir',
                      pass,
                      totalPasses: 2,
                      currentPwKey: nextKey,
                    });
                    // 5.7.16: не scrollIntoView (virtual-list его игнорирует),
                    // а прямой scrollTop контейнера с центровкой.
                    const cRect = container.getBoundingClientRect();
                    const elRect = nextEl.getBoundingClientRect();
                    const offsetInContainer =
                      elRect.top - cRect.top + container.scrollTop;
                    container.scrollTop =
                      offsetInContainer -
                      container.clientHeight / 2 +
                      elRect.height / 2;
                    try {
                      container.dispatchEvent(
                        new Event('scroll', { bubbles: true })
                      );
                    } catch {}
                    await new Promise((r) => setTimeout(r, 1200));
                    collect();
                  }
                }
              }
              if (!foundGap) break;
            }
          }
          console.log('[bg-scroll] final collect before send:', map.size);
          collect();

          // 5.7.24: обход веток — только если включён флаг collectInactive
          if (collectInactiveArg && !wasCancelled) {
            // 5.7.51: несколько switcher'ов могут иметь одинаковый total
            // (user-ветки + assistant-ветки). userText НЕнадёжен:
            //  - у assistant его нет (пустая строка)
            //  - у user он меняется после switch prev (43 → 41)
            // Ключ: (role, branchTotal, groupIndex), где groupIndex —
            // номер в группе (role, total), sorted by pwKey.
            // Стабилен между switch'ами одного turn'а.
            type RawPoint = {
              pwKey: number;
              branchIndex: number;
              branchTotal: number;
              userText: string;
              role: 'user' | 'assistant';
            };

            const rawPoints: RawPoint[] = [];
            const sortedNumeric = Array.from(map.values())
              .map((e) => e.numericKey)
              .filter((k): k is number => k !== null)
              .sort((a, b) => a - b);

            for (const keyNum of sortedNumeric) {
              const entry = Array.from(map.values()).find(
                (e) => e.numericKey === keyNum
              );
              if (!entry) continue;
              const tmp = document.createElement('div');
              tmp.innerHTML = entry.html;
              let bi = 1;
              let bt = 1;
              for (const el of Array.from(tmp.querySelectorAll('.dd7e4fda'))) {
                const m = (el.textContent || '')
                  .trim()
                  .match(/^(\d+)\s*\/\s*(\d+)$/);
                if (m) {
                  bi = parseInt(m[1], 10);
                  bt = parseInt(m[2], 10);
                  break;
                }
              }
              if (bt > 1) {
                const userText = (
                  tmp.querySelector('.fbb737a4')?.textContent || ''
                ).trim();
                rawPoints.push({
                  pwKey: keyNum,
                  branchIndex: bi,
                  branchTotal: bt,
                  userText,
                  role: entry.role,
                });
              }
            }

            // groupIndex per (role, total), sorted by pwKey
            type BranchPoint = RawPoint & { groupIndex: number };
            const groups = new Map<string, RawPoint[]>();
            for (const p of rawPoints) {
              const key = `${p.role}_${p.branchTotal}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(p);
            }
            const branchPoints: BranchPoint[] = [];
            for (const [_, group] of groups) {
              group.sort((a, b) => a.pwKey - b.pwKey);
              group.forEach((p, i) => {
                branchPoints.push({ ...p, groupIndex: i });
              });
            }
            branchPoints.sort((a, b) => a.pwKey - b.pwKey);

            const activeSnapshot = branchPoints.map((p) => ({
              role: p.role,
              branchTotal: p.branchTotal,
              branchIndex: p.branchIndex,
              groupIndex: p.groupIndex,
              userText: p.userText,
            }));

            console.log(
              `[bg-scroll] branch traverse (collectInactive=true): ${branchPoints.length} points (bottom-up)`
            );
            console.log(
              `[bg-scroll] active snapshot:`,
              activeSnapshot.map(
                (s) =>
                  `[${s.role}#${s.groupIndex}] "${s.userText.slice(0, 25)}" ${s.branchIndex}/${s.branchTotal}`
              )
            );

            // findLiveSwitcher by (role, total, groupIndex)
            const findLiveSwitcher = (
              total: number,
              role: 'user' | 'assistant',
              groupIndex: number
            ): {
              btns: NodeListOf<Element>;
              idx: number;
              tot: number;
              userText: string;
            } | null => {
              const candidates: Array<{
                pwKey: number;
                textEl: Element;
                idx: number;
                tot: number;
                userText: string;
              }> = [];

              for (const textEl of Array.from(
                container.querySelectorAll('.dd7e4fda')
              )) {
                const f = (textEl.textContent || '')
                  .trim()
                  .match(/^(\d+)\s*\/\s*(\d+)$/);
                if (!f) continue;
                const idx = parseInt(f[1], 10);
                const tot = parseInt(f[2], 10);
                if (tot !== total) continue;
                const msgEl = textEl.closest(
                  'div[data-virtual-list-item-key]'
                ) as HTMLElement | null;
                if (!msgEl) continue;
                const keyNum = parseInt(
                  msgEl.getAttribute('data-virtual-list-item-key') || '',
                  10
                );
                if (isNaN(keyNum)) continue;
                const hasUserText = !!msgEl.querySelector('.fbb737a4');
                const hasFileChips = !!msgEl.querySelector('.eafda4ae');
                const thisRole: 'user' | 'assistant' =
                  hasUserText || hasFileChips ? 'user' : 'assistant';
                if (thisRole !== role) continue;
                candidates.push({
                  pwKey: keyNum,
                  textEl,
                  idx,
                  tot,
                  userText: (
                    msgEl.querySelector('.fbb737a4')?.textContent || ''
                  ).trim(),
                });
              }

              candidates.sort((a, b) => a.pwKey - b.pwKey);
              const target = candidates[groupIndex];
              if (!target) return null;
              const switcher = target.textEl.parentElement;
              if (!switcher) return null;
              const btns = switcher.querySelectorAll('[role="button"]');
              if (btns.length < 2) return null;
              return {
                btns,
                idx: target.idx,
                tot: target.tot,
                userText: target.userText,
              };
            };

            const bottomUp = [...branchPoints].sort(
              (a, b) => b.pwKey - a.pwKey
            );

            let traverseDone = 0;
            for (const point of bottomUp) {
              if (await checkCancel()) break;
              const pwKey = String(point.pwKey);
              console.log(
                `[bg-scroll]   traverse ${pwKey} [${point.role}#${point.groupIndex}] (currently ${point.branchIndex}/${point.branchTotal})`
              );
              send(false, {
                phase: 'traverse',
                direction: 'bidir',
                pass: traverseDone,
                totalPasses: bottomUp.length,
                currentPwKey: pwKey,
                branchTotal: bottomUp.length,
                branchDone: traverseDone,
              });
              traverseDone++;

              let msgEl0 = container.querySelector(
                `div[data-virtual-list-item-key="${pwKey}"]`
              ) as HTMLElement | null;

              if (!msgEl0) {
                const scrollStep = Math.max(
                  250,
                  container.clientHeight * 0.5
                );
                const origScroll = container.scrollTop;
                const positions: number[] = [];
                for (
                  let p = origScroll;
                  p <= container.scrollHeight;
                  p += scrollStep
                )
                  positions.push(p);
                for (
                  let p = origScroll - scrollStep;
                  p >= 0;
                  p -= scrollStep
                )
                  positions.push(p);
                for (const p of positions) {
                  container.scrollTop = Math.min(p, container.scrollHeight);
                  try {
                    container.dispatchEvent(
                      new Event('scroll', { bubbles: true })
                    );
                  } catch {}
                  await new Promise((r) => setTimeout(r, 700));
                  collect(false);
                  msgEl0 = container.querySelector(
                    `div[data-virtual-list-item-key="${pwKey}"]`
                  ) as HTMLElement | null;
                  if (msgEl0) break;
                }
              }

              if (!msgEl0) {
                console.warn(
                  `[bg-scroll]     target ${pwKey} not in DOM after scroll — skip`
                );
                continue;
              }

              console.log(`[bg-scroll]     found ${pwKey}, switching...`);

              const textEl1 = msgEl0.querySelector('.dd7e4fda');
              const switcher1 = textEl1?.parentElement;
              const btns1 =
                switcher1?.querySelectorAll('[role="button"]') ?? [];
              let switched = false;
              if (btns1.length >= 2) {
                traverseInactive = true;
                (btns1[0] as HTMLElement).click();
                switched = true;
                await new Promise((r) => setTimeout(r, 1200));
                collect(true);
                const afterPrev = Array.from(map.values()).filter(
                  (e) => e.isActive === 0
                );
                console.log(
                  `[bg-scroll]     collected inactive: ${afterPrev.length} total, blacklist size: ${inactivePwKeys.size}`
                );
                traverseInactive = false;
              }

              if (switched) {
                let safety = 0;
                let target = findLiveSwitcher(
                  point.branchTotal,
                  point.role,
                  point.groupIndex
                );
                if (!target) {
                  console.warn(
                    `[bg-scroll]     return switcher NOT FOUND (role=${point.role} total=${point.branchTotal} group=${point.groupIndex})`
                  );
                } else {
                  while (target.idx !== point.branchIndex && safety < 5) {
                    const btn = (
                      target.idx < point.branchIndex
                        ? target.btns[1]
                        : target.btns[0]
                    ) as HTMLElement;
                    if (btn.classList.contains('ds-button--disabled')) {
                      console.warn(
                        `[bg-scroll]     return: arrow disabled at ${target.idx}/${target.tot}`
                      );
                      break;
                    }
                    btn.click();
                    safety++;
                    await new Promise((r) => setTimeout(r, 1200));
                    const refreshed = findLiveSwitcher(
                      point.branchTotal,
                      point.role,
                      point.groupIndex
                    );
                    if (!refreshed) {
                      console.warn(
                        `[bg-scroll]     return: switcher lost after click`
                      );
                      break;
                    }
                    target = refreshed;
                  }
                  collect(false);
                  console.log(
                    `[bg-scroll]     returned to ${target.idx}/${target.tot} (was ${point.branchIndex}/${point.branchTotal})`
                  );
                }
              }
            }

            if (!wasCancelled) {
              console.log(`[bg-scroll] verify active state after traverse...`);
              send(false, {
                phase: 'verify',
                direction: 'bidir',
                pass: 1,
                totalPasses: 1,
              });
              for (const snap of activeSnapshot) {
                if (await checkCancel()) break;
                let safety = 0;
                while (safety < 5) {
                  const live = findLiveSwitcher(
                    snap.branchTotal,
                    snap.role,
                    snap.groupIndex
                  );
                  if (!live) {
                    console.warn(
                      `[bg-scroll] verify: [${snap.role}#${snap.groupIndex}] NOT FOUND`
                    );
                    break;
                  }
                  if (live.idx === snap.branchIndex) break;
                  const btn = (
                    live.idx < snap.branchIndex
                      ? live.btns[1]
                      : live.btns[0]
                  ) as HTMLElement;
                  if (btn.classList.contains('ds-button--disabled')) {
                    console.warn(
                      `[bg-scroll] verify: arrow disabled at ${live.idx}/${live.tot}`
                    );
                    break;
                  }
                  console.log(
                    `[bg-scroll] verify: restoring [${snap.role}#${snap.groupIndex}] ${live.idx}/${live.tot} → ${snap.branchIndex}/${snap.branchTotal}`
                  );
                  btn.click();
                  safety++;
                  await new Promise((r) => setTimeout(r, 2000));
                }
                collect(false);
              }
            }
          } else {
            console.log(
              '[bg-scroll] branch traverse skipped (collectInactive=false)'
            );
          }

          const inactiveFinal = Array.from(map.values()).filter(
            (e) => e.isActive === 0
          );
          const activeFinal = Array.from(map.values()).filter(
            (e) => e.isActive === 1
          );
          console.log(
            `[bg-scroll] collected: ${map.size} total (${activeFinal.length} active, ${inactiveFinal.length} inactive), blacklist=[${Array.from(inactivePwKeys).sort((a, b) => a - b).join(',')}]`
          );
          send(true, undefined, wasCancelled);
        } finally {
          observer.disconnect();
        }
      }, { collectInactive, speed });
    } catch (e) {
      const msg = (e as Error).message || '';
      if (
        msg.includes('Execution context was destroyed') ||
        msg.includes('Target closed')
      ) {
        console.debug('[DeepSeek] backgroundScrollAndEmit прерван навигацией');
      } else {
        console.error('[DeepSeek] backgroundScrollAndEmit failed:', e);
      }
    } finally {
      // 5.8.2: сбрасываем флаг отмены после завершения scroll
      this.cancelTraverseRequested = false;
      if (this.page && !this.page.isClosed()) {
        try {
          await this.page.evaluate(() => {
            (window as any).__gatewayIsScrolling = false;
          });
        } catch {
          /* ignore */
        }
      }
    }
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

  /**
   * Recon: дампит структуру списка сообщений в PW.
   *   - DOM-порядок vs сортировка по data-virtual-list-item-key
   *   - что GW возьмёт (user/assistant) vs что пропустит (SKIPPED)
   *   - file-like элементы (file/attach/chip/document/media/reference) в каждом item
   *   - outerHTML item'ов с file-like элементами — отдельными файлами
   *
   * Ничего не кликает. Безопасно.
   */
  async reconUserMessages(convId?: string): Promise<{
    jsonPath: string;
    htmlPaths: string[];
    summary: any;
  }> {
    if (!this.page) throw new Error('Браузер не запущен');

    if (convId) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(convId)) {
        await this.openConversation(convId);
      }
    }

    try {
      await this.page.waitForSelector(
        'div.ds-virtual-list.ds-virtual-list--printable',
        { timeout: 10000 }
      );
    } catch {
      throw new Error('Список сообщений не появился в PW');
    }

    // Прогреваем виртуальный список: низ → верх → низ
    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 500));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 800));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
    });

    const recon = await this.page.evaluate(() => {
      const container = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      );
      if (!container) {
        return { error: 'no container', domCount: 0, domOrder: [], gwParse: [], itemsWithFiles: [] };
      }

      const items = Array.from(
        container.querySelectorAll('div[data-virtual-list-item-key]')
      ) as HTMLElement[];

      const domOrder: any[] = [];
      const gwParse: any[] = [];
      const itemsWithFiles: { key: string; html: string }[] = [];

      for (const el of items) {
        const key = el.getAttribute('data-virtual-list-item-key') || '';
        const fbb = el.querySelector('.fbb737a4');
        const main = el.querySelector(
          'div.ds-markdown.ds-assistant-message-main-content'
        );
        const thinking = el.querySelector('div.e1675d8b.ds-think-content');
        const isUser = !!fbb;
        const isAssistant = !!main;

        // Дочерние элементы 1-го уровня
        const children = Array.from(el.children).map((c) => {
          const ce = c as HTMLElement;
          return {
            tag: ce.tagName,
            classes: typeof ce.className === 'string' ? ce.className : '',
            textLen: (ce.textContent || '').length,
            textPreview: (ce.textContent || '').trim().slice(0, 100),
            hasImgOrSvg: !!ce.querySelector('img, svg'),
            role: ce.getAttribute('role'),
          };
        });

        // File-like элементы (широкий матч по классам)
        const fileCandidates: any[] = [];
        el.querySelectorAll('*').forEach((node) => {
          const n = node as HTMLElement;
          const cls = typeof n.className === 'string' ? n.className : '';
          const lower = cls.toLowerCase();
          const hit =
            lower.includes('file') ||
            lower.includes('attach') ||
            lower.includes('upload') ||
            lower.includes('document') ||
            lower.includes('chip') ||
            lower.includes('media') ||
            lower.includes('reference');
          if (!hit || fileCandidates.length >= 15) return;
          const r = n.getBoundingClientRect();
          fileCandidates.push({
            tag: n.tagName,
            classes: cls,
            text: (n.textContent || '').trim().slice(0, 100),
            role: n.getAttribute('role'),
            hasImgOrSvg: !!n.querySelector('img, svg'),
            box: { w: Math.round(r.width), h: Math.round(r.height) },
          });
        });

        domOrder.push({
          key,
          isUser,
          isAssistant,
          rootClass: typeof el.className === 'string' ? el.className : '',
          textLen: (el.textContent || '').length,
          textPreview: (el.textContent || '').trim().slice(0, 150),
          htmlLen: el.innerHTML.length,
          hasThinking: !!thinking,
          hasImgOrSvg: !!el.querySelector('img, svg'),
          children,
          fileCandidates,
        });

        // Симуляция GW: что возьмём, что скипнем
        let gwRole: string;
        if (isUser) gwRole = 'user';
        else if (isAssistant) gwRole = 'assistant';
        else gwRole = 'SKIPPED';
        gwParse.push({ key, gwRole });

        if (fileCandidates.length > 0) {
          itemsWithFiles.push({ key, html: el.outerHTML });
        }
      }

      return {
        domCount: items.length,
        url: location.href,
        domOrder,
        gwParse,
        itemsWithFiles,
      };
    });

    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const shortId = convId ? convId.slice(0, 8) : 'current';

    const jsonPath = path.join(dir, `recon_${shortId}_${ts}.json`);
    const { itemsWithFiles, ...reconNoHtml } = recon as any;
    await fsPromises.writeFile(jsonPath, JSON.stringify(reconNoHtml, null, 2), 'utf-8');

    const htmlPaths: string[] = [];
    for (const { key, html } of itemsWithFiles as Array<{ key: string; html: string }>) {
      const htmlPath = path.join(dir, `recon_${shortId}_${ts}_item_${key}.html`);
      await fsPromises.writeFile(htmlPath, html, 'utf-8');
      htmlPaths.push(htmlPath);
    }

    const domRoles = (recon as any).domOrder.map(
      (x: any) => `${x.key}:${x.isUser ? 'U' : x.isAssistant ? 'A' : '?'}`
    );
    const gwRoles = (recon as any).gwParse.map(
      (x: any) => `${x.key}:${x.gwRole === 'user' ? 'U' : x.gwRole === 'assistant' ? 'A' : 'SKIP'}`
    );
    const gwSkipKeys = (recon as any).gwParse
      .filter((x: any) => x.gwRole === 'SKIPPED')
      .map((x: any) => x.key);

    const summary = {
      jsonPath,
      htmlPaths,
      domCount: (recon as any).domCount,
      domRoles,
      gwRoles,
      gwSkipKeys,
      itemsWithFiles: (recon as any).itemsWithFiles.map((x: any) => x.key),
    };

    console.log('[DeepSeek] ═══════════ RECON ═══════════');
    console.log('[DeepSeek] DOM order :', domRoles.join(' → '));
    console.log('[DeepSeek] GW parse  :', gwRoles.join(' → '));
    console.log('[DeepSeek] GW SKIP   :', gwSkipKeys.length, '→', gwSkipKeys.join(', '));
    console.log('[DeepSeek] With files:', summary.itemsWithFiles.join(', ') || '(none)');
    console.log('[DeepSeek] JSON      :', jsonPath);
    console.log('[DeepSeek] HTMLs     :', htmlPaths.length ? htmlPaths.join(', ') : '(none)');
    console.log('[DeepSeek] ═════════════════════════');

    return { jsonPath, htmlPaths, summary };
  }

    /**
   * Recon: кликает по file-чипу в отправленном user-сообщении
   * и дампит появившуюся боковую панель.
   *
   * Что собирает:
   *   - атрибуты чипа (в т.ч. data-*, href у вложенных <a>)
   *   - сетевые запросы, инициированные кликом (fetch к /api/...)
   *   - outerHTML панели и контента (для анализа селекторов)
   *
   * Безопасно: панель закрывается в конце.
   */
  async reconFileChip(
    convId?: string,
    chipIndex: number = 0
  ): Promise<{ jsonPath: string; htmlPaths: string[]; summary: any }> {
    if (!this.page) throw new Error('Браузер не запущен');

    if (convId) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(convId)) {
        await this.openConversation(convId);
      }
    }

    try {
      await this.page.waitForSelector(
        'div.ds-virtual-list.ds-virtual-list--printable',
        { timeout: 10000 }
      );
    } catch {
      throw new Error('Список сообщений не появился в PW');
    }

    // Прогреваем список
    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 800));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 300));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 500));
    });

    // Собираем список чипов
    const chips = await this.page.evaluate(() => {
      const container = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      );
      if (!container) return [];
      const result: any[] = [];
      container
        .querySelectorAll('div[data-virtual-list-item-key]')
        .forEach((msgEl) => {
          const msgKey = msgEl.getAttribute('data-virtual-list-item-key') || '';
          const chipContainer = msgEl.querySelector('.eafda4ae');
          if (!chipContainer) return;
          chipContainer.querySelectorAll('._25c7358').forEach((chip, chipIdx) => {
            const ce = chip as HTMLElement;
            const attrs: Record<string, string> = {};
            for (const a of Array.from(ce.attributes)) attrs[a.name] = a.value;
            const nameEl = ce.querySelector('.e70accd6');
            const metaEl = ce.querySelector('._7103a25');
            result.push({
              messageKey: msgKey,
              chipIndexInMessage: chipIdx,
              name: nameEl?.textContent?.trim() || '',
              meta: metaEl?.textContent?.trim() || '',
              chipClasses: typeof ce.className === 'string' ? ce.className : '',
              chipAttributes: attrs,
              outerHTML: ce.outerHTML,
            });
          });
        });
      return result;
    });

    if (chips.length === 0) {
      throw new Error('Не найдено ни одного file-чипа в DOM');
    }

    const targetChip = chips[Math.min(chipIndex, chips.length - 1)];

    // Ловим ВСЕ не-статические сетевые запросы
    const networkRequests: Array<{
      url: string;
      method: string;
      resourceType: string;
      postDataSnippet?: string;
      responseStatus?: number;
      responseBodySnippet?: string;
    }> = [];

    const onResponse = async (resp: any) => {
      const url = resp.url();
      const resourceType = resp.request().resourceType();
      const isStatic =
        resourceType === 'image' ||
        resourceType === 'font' ||
        resourceType === 'stylesheet' ||
        resourceType === 'script' ||
        resourceType === 'media' ||
        url.startsWith('data:') ||
        url.includes('.hot-update.') ||
        url.includes('/_next/') ||
        url.includes('favicon');
      if (isStatic) return;

      const entry: any = {
        url,
        method: resp.request().method(),
        resourceType,
        postDataSnippet: (resp.request().postData() || '').slice(0, 300),
        responseStatus: resp.status(),
      };
      // Пытаемся прочесть body для потенциально-релевантных
      if (
        resourceType === 'fetch' ||
        resourceType === 'xhr' ||
        url.includes('/api/')
      ) {
        try {
          const body = await resp.text();
          // Для /api/ — сохраняем больше (файл может быть 10-25KB)
          const limit = url.includes('/api/') ? 30000 : 1500;
          entry.responseBodySnippet = body.slice(0, limit);
        } catch {
          /* ignore */
        }
      }
      networkRequests.push(entry);
    };
    this.page.on('response', onResponse);

    // Клик
    let clicked = false;
    try {
      const chipLocator = this.page
        .locator(
          `div[data-virtual-list-item-key="${targetChip.messageKey}"] .eafda4ae ._25c7358`
        )
        .nth(targetChip.chipIndexInMessage);
      await chipLocator.scrollIntoViewIfNeeded({ timeout: 3000 });
      await chipLocator.click({ force: true, timeout: 3000 });
      clicked = true;
    } catch (e) {
      console.warn(
        '[reconFileChip] locator.click не удался, fallback на evaluate.click:',
        (e as Error).message
      );
      try {
        clicked = await this.page.evaluate(
          ({ msgKey, chipIdx }) => {
            const c = document.querySelector(
              'div.ds-virtual-list.ds-virtual-list--printable'
            );
            const msgEl = c?.querySelector(
              `div[data-virtual-list-item-key="${msgKey}"]`
            );
            const chipList = msgEl?.querySelectorAll('.eafda4ae ._25c7358');
            const el = chipList?.[chipIdx] as HTMLElement | undefined;
            if (!el) return false;
            el.click();
            return true;
          },
          {
            msgKey: targetChip.messageKey,
            chipIdx: targetChip.chipIndexInMessage,
          }
        );
      } catch (e2) {
        console.warn(
          '[reconFileChip] evaluate.click тоже не удался:',
          (e2 as Error).message
        );
      }
    }

    // Ждём панель
    let panelFound = false;
    try {
      await this.page.waitForSelector('._26c5bc2', {
        state: 'visible',
        timeout: 5000,
      });
      panelFound = true;
    } catch {
      /* ok */
    }

    // Ждём контент до 60 секунд (PoW в DeepSeek может занять 10-30с)
    let contentLoaded = false;
    let contentWaitMs = 0;
    if (panelFound) {
      const start = Date.now();
      while (Date.now() - start < 60000) {
        const has = await this.page.evaluate(() => {
          const el = document.querySelector(
            '._26c5bc2 .abbe3c45'
          ) as HTMLElement | null;
          return !!(el && el.textContent && el.textContent.trim().length > 50);
        });
        if (has) {
          contentLoaded = true;
          contentWaitMs = Date.now() - start;
          break;
        }
        await this.page.waitForTimeout(300);
      }
      // Если по таймауту — фиксируем сколько реально ждали
      if (!contentLoaded) {
        contentWaitMs = Date.now() - start;
      }
    }

    // Собираем панель
    let panelData: any = null;
    if (panelFound) {
      panelData = await this.page.evaluate(() => {
        const panel = document.querySelector('._26c5bc2') as HTMLElement | null;
        if (!panel) return null;
        const header = panel.querySelector('._2c74d7a');
        const title =
          header?.querySelector('[role="heading"]')?.textContent?.trim() || '';
        const contentEl = panel.querySelector('.abbe3c45') as HTMLElement | null;
        const content = contentEl?.textContent || '';
        const contentHtml = contentEl?.innerHTML || '';

        // Признаки загрузки
        const hasLoader = !!panel.querySelector('.ds-loading');
        const panelText = panel.textContent || '';

        const attrs: Record<string, string> = {};
        for (const a of Array.from(panel.attributes)) attrs[a.name] = a.value;
        return {
          title,
          hasLoader,
          contentLength: content.length,
          contentPreview: content.slice(0, 2000),
          contentHtml,
          panelAttributes: attrs,
          panelTextLength: panelText.length,
          panelOuterHTML: panel.outerHTML,
        };
      });
    }

    // Закрываем панель
    if (panelFound) {
      try {
        await this.page.evaluate(() => {
          const btn = document.querySelector(
            '._26c5bc2 ._5d271a3'
          ) as HTMLElement | null;
          if (btn) btn.click();
        });
        await this.page.waitForTimeout(300);
      } catch {
        /* ignore */
      }
    }

    this.page.off('response', onResponse);

    // Сохраняем
    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const shortId = convId ? convId.slice(0, 8) : 'current';

    const jsonPath = path.join(dir, `recon_chip_${shortId}_${ts}.json`);
    const payload = {
      convId: convId || 'current',
      url: this.page.url(),
      chipIndex,
      totalChips: chips.length,
      allChips: chips.map((c: any) => ({
        messageKey: c.messageKey,
        chipIndexInMessage: c.chipIndexInMessage,
        name: c.name,
        meta: c.meta,
      })),
      targetChip: {
        messageKey: targetChip.messageKey,
        chipIndexInMessage: targetChip.chipIndexInMessage,
        name: targetChip.name,
        meta: targetChip.meta,
        chipClasses: targetChip.chipClasses,
        chipAttributes: targetChip.chipAttributes,
      },
      clicked,
      panelFound,
      contentLoaded,
      contentWaitMs,
      panel: panelData
        ? {
            title: panelData.title,
            hasLoader: panelData.hasLoader,
            contentLength: panelData.contentLength,
            contentPreview: panelData.contentPreview,
            panelAttributes: panelData.panelAttributes,
          }
        : null,
      networkRequests,
    };
    await fsPromises.writeFile(
      jsonPath,
      JSON.stringify(payload, null, 2),
      'utf-8'
    );

    const htmlPaths: string[] = [];

    const chipHtmlPath = path.join(
      dir,
      `recon_chip_${shortId}_${ts}_chip.html`
    );
    await fsPromises.writeFile(chipHtmlPath, targetChip.outerHTML, 'utf-8');
    htmlPaths.push(chipHtmlPath);

    if (panelData) {
      const panelHtmlPath = path.join(
        dir,
        `recon_chip_${shortId}_${ts}_panel.html`
      );
      await fsPromises.writeFile(
        panelHtmlPath,
        panelData.panelOuterHTML,
        'utf-8'
      );
      htmlPaths.push(panelHtmlPath);

      if (panelData.contentHtml) {
        const contentHtmlPath = path.join(
          dir,
          `recon_chip_${shortId}_${ts}_content.html`
        );
        await fsPromises.writeFile(
          contentHtmlPath,
          panelData.contentHtml,
          'utf-8'
        );
        htmlPaths.push(contentHtmlPath);
      }
    }

    const summary = {
      jsonPath,
      htmlPaths,
      totalChips: chips.length,
      targetChip: {
        messageKey: targetChip.messageKey,
        chipIndexInMessage: targetChip.chipIndexInMessage,
        name: targetChip.name,
        meta: targetChip.meta,
      },
      clicked,
      panelFound,
      contentLoaded,
      contentWaitMs,
      panel: panelData
        ? {
            title: panelData.title,
            hasLoader: panelData.hasLoader,
            contentLength: panelData.contentLength,
          }
        : null,
      networkRequestsCount: networkRequests.length,
      networkRequests: networkRequests.map((r) => ({
        method: r.method,
        status: r.responseStatus,
        resourceType: r.resourceType,
        url: r.url,
        bodySnippet: r.responseBodySnippet?.slice(0, 200),
      })),
    };

    console.log('[DeepSeek] ═══════════ RECON FILE CHIP v3 ═══════════');
    console.log('[DeepSeek] Total chips    :', chips.length);
    console.log(
      '[DeepSeek] Target chip    :',
      targetChip.name,
      '(msg',
      targetChip.messageKey,
      '/ idx',
      targetChip.chipIndexInMessage,
      ')'
    );
    console.log('[DeepSeek] Clicked        :', clicked);
    console.log('[DeepSeek] Panel found    :', panelFound);
    console.log('[DeepSeek] Content loaded :', contentLoaded, '(', contentWaitMs, 'ms)');
    if (panelData) {
      console.log('[DeepSeek] Panel title    :', panelData.title);
      console.log('[DeepSeek] Has loader     :', panelData.hasLoader);
      console.log('[DeepSeek] Content len    :', panelData.contentLength);
      console.log(
        '[DeepSeek] Content prev   :',
        panelData.contentPreview.slice(0, 200).replace(/\n/g, ' ')
      );
    }
    console.log('[DeepSeek] Network req    :', networkRequests.length);
    networkRequests.forEach((r) => {
      const isStatic =
        r.url.includes('fe-static.') ||
        r.url.includes('.js') ||
        r.url.includes('.wasm');
      const marker = isStatic ? '  ' : '★ ';
      console.log(
        `[DeepSeek] ${marker} →`,
        r.method,
        r.responseStatus,
        r.resourceType,
        r.url.slice(0, 140)
      );
    });
    console.log('[DeepSeek] JSON           :', jsonPath);
    console.log('[DeepSeek] HTMLs          :');
    htmlPaths.forEach((p) => console.log('[DeepSeek]   -', p));
    console.log('[DeepSeek] ═══════════════════════════════════════');

    return { jsonPath, htmlPaths, summary };
  }

  /**
   * Recon: собирает computed styles всех file-чипов в PW.
   * Нужно, чтобы точно воспроизвести размеры/отступы/цвета в GW.
   * Ничего не кликает.
   */
  async reconFileChipStyles(convId?: string): Promise<{
    jsonPath: string;
    summary: any;
  }> {
    if (!this.page) throw new Error('Браузер не запущен');

    if (convId) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(convId)) {
        await this.openConversation(convId);
      }
    }

    try {
      await this.page.waitForSelector(
        'div.ds-virtual-list.ds-virtual-list--printable',
        { timeout: 10000 }
      );
    } catch {
      throw new Error('Список сообщений не появился в PW');
    }

    // Прогрев — чтобы все чипы попали в DOM
    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 800));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 500));
    });

    const recon = await this.page.evaluate(() => {
      const pick = (el: HTMLElement | null) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          classes: typeof el.className === 'string' ? el.className : '',
          rect: {
            width: Math.round(r.width * 100) / 100,
            height: Math.round(r.height * 100) / 100,
          },
          style: {
            display: cs.display,
            flexDirection: cs.flexDirection,
            alignItems: cs.alignItems,
            justifyContent: cs.justifyContent,
            gap: cs.gap,
            padding: cs.padding,
            margin: cs.margin,
            background: cs.backgroundColor,
            border: cs.border,
            borderRadius: cs.borderRadius,
            boxSizing: cs.boxSizing,
            width: cs.width,
            height: cs.height,
            minWidth: cs.minWidth,
            maxWidth: cs.maxWidth,
            minHeight: cs.minHeight,
            maxHeight: cs.maxHeight,
            overflow: cs.overflow,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            color: cs.color,
            fontFamily: cs.fontFamily,
            whiteSpace: cs.whiteSpace,
            textOverflow: cs.textOverflow,
            flexShrink: cs.flexShrink,
            flexGrow: cs.flexGrow,
            flexBasis: cs.flexBasis,
          },
        };
      };

      const chips = Array.from(
        document.querySelectorAll(
          'div.ds-virtual-list.ds-virtual-list--printable .eafda4ae > div._25c7358'
        )
      ) as HTMLElement[];

      const result = chips.map((chip, idx) => {
        const inner = chip.querySelector('.cd314545') as HTMLElement | null;
        const iconWrap = chip.querySelector('._1c3b90b') as HTMLElement | null;
        const svg = chip.querySelector('svg') as SVGElement | null;
        const body = chip.querySelector('._158cea4') as HTMLElement | null;
        const titleWrap = chip.querySelector('._967f3f9') as HTMLElement | null;
        const title = chip.querySelector('.e70accd6') as HTMLElement | null;
        const meta = chip.querySelector('._7103a25') as HTMLElement | null;

        // CSS-переменные на чипе (deepseek-тема часто использует)
        const cssVars: Record<string, string> = {};
        const inlineStyle = chip.getAttribute('style') || '';
        if (inlineStyle) cssVars['inline'] = inlineStyle;
        const cs = window.getComputedStyle(chip);
        // Собираем все кастомные переменные (--*)
        for (let i = 0; i < cs.length; i++) {
          const prop = cs[i];
          if (prop.startsWith('--')) {
            cssVars[prop] = cs.getPropertyValue(prop).trim();
          }
        }

        return {
          index: idx,
          chip: pick(chip),
          inner: pick(inner),
          iconWrap: pick(iconWrap),
          svg: svg
            ? {
                width: svg.getAttribute('width'),
                height: svg.getAttribute('height'),
                viewBox: svg.getAttribute('viewBox'),
                rect: {
                  w: Math.round(svg.getBoundingClientRect().width),
                  h: Math.round(svg.getBoundingClientRect().height),
                },
              }
            : null,
          body: pick(body),
          titleWrap: pick(titleWrap),
          title: pick(title),
          meta: pick(meta),
          cssVars,
          titleText: title?.textContent?.trim() || '',
          metaText: meta?.textContent?.trim() || '',
        };
      });

      // Сравнение размеров
      const widths = result.map((r) => r.chip?.rect.width ?? 0);
      const heights = result.map((r) => r.chip?.rect.height ?? 0);
      const uniqueWidths = Array.from(new Set(widths));
      const uniqueHeights = Array.from(new Set(heights));

      return {
        totalChips: result.length,
        uniqueWidths,
        uniqueHeights,
        allSameSize:
          uniqueWidths.length === 1 && uniqueHeights.length === 1,
        chips: result,
      };
    });

    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const shortId = convId ? convId.slice(0, 8) : 'current';
    const jsonPath = path.join(dir, `recon_chip_styles_${shortId}_${ts}.json`);
    await fsPromises.writeFile(
      jsonPath,
      JSON.stringify(recon, null, 2),
      'utf-8'
    );

    const summary = {
      jsonPath,
      totalChips: (recon as any).totalChips,
      uniqueWidths: (recon as any).uniqueWidths,
      uniqueHeights: (recon as any).uniqueHeights,
      allSameSize: (recon as any).allSameSize,
    };

    console.log('[DeepSeek] ═══════════ RECON CHIP STYLES ═══════════');
    console.log('[DeepSeek] Total chips    :', summary.totalChips);
    console.log('[DeepSeek] Unique widths  :', JSON.stringify(summary.uniqueWidths));
    console.log('[DeepSeek] Unique heights :', JSON.stringify(summary.uniqueHeights));
    console.log('[DeepSeek] All same size  :', summary.allSameSize);
    if ((recon as any).chips[0]) {
      const c0 = (recon as any).chips[0];
      console.log('[DeepSeek] Chip[0] classes:', c0.chip?.classes);
      console.log('[DeepSeek] Chip[0] style  :', JSON.stringify(c0.chip?.style, null, 2));
      console.log('[DeepSeek] Inner style    :', JSON.stringify(c0.inner?.style, null, 2));
      console.log('[DeepSeek] Title style    :', JSON.stringify(c0.title?.style, null, 2));
      console.log('[DeepSeek] Meta style     :', JSON.stringify(c0.meta?.style, null, 2));
      console.log('[DeepSeek] CSS vars       :', JSON.stringify(c0.cssVars, null, 2));
    }
    console.log('[DeepSeek] JSON           :', jsonPath);
    console.log('[DeepSeek] ═══════════════════════════════════════');

    return { jsonPath, summary };
  }

  /**
   * Recon: боковая панель-шторка file-чипа в PW.
   * Собирает:
   *   - ширину (default, min, max)
   *   - position/transform/transition (анимация появления)
   *   - resize-handle (ручка для ресайза)
   *   - CSS vars на родителе (--panel-width и т.п.)
   *   - z-index и box-shadow
   * Открывает чип, снимает стили до/после, закрывает.
   */
  async reconFilePanel(convId?: string, chipIndex = 0): Promise<{
    jsonPath: string;
    summary: any;
  }> {
    if (!this.page) throw new Error('Браузер не запущен');

    if (convId) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(convId)) {
        await this.openConversation(convId);
      }
    }

    await this.page.waitForSelector(
      'div.ds-virtual-list.ds-virtual-list--printable',
      { timeout: 10000 }
    );

    // Прогрев
    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 900));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 500));
    });

    // 1. Снимок ДО клика — какие глобальные vars/атрибуты есть
    const before = await this.page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const cs = window.getComputedStyle(root);
      const vars: Record<string, string> = {};
      // --panel-width на :root, body и на родительских контейнерах
      const targets = [
        { label: ':root', el: root },
        { label: 'body', el: body },
      ];
      for (const t of targets) {
        if (!t.el) continue;
        const c = window.getComputedStyle(t.el);
        const pw = c.getPropertyValue('--panel-width');
        if (pw) vars[`${t.label}:--panel-width`] = pw.trim();
      }
      return {
        panelExists: !!document.querySelector('._26c5bc2'),
        vars,
        bodyClasses: body.className,
        bodyAttrs: Array.from(body.attributes).reduce(
          (acc, a) => ({ ...acc, [a.name]: a.value }),
          {} as Record<string, string>
        ),
        rootVars: {
          '--panel-width': cs.getPropertyValue('--panel-width').trim(),
          '--sidebar-width': cs.getPropertyValue('--sidebar-width').trim(),
        },
      };
    });

    // 2. Клик
    const clicked = await this.page.evaluate(
      (idx) => {
        const container = document.querySelector(
          'div.ds-virtual-list.ds-virtual-list--printable'
        );
        if (!container) return false;
        const chips = Array.from(
          container.querySelectorAll('.eafda4ae ._25c7358')
        ) as HTMLElement[];
        const chip = chips[idx];
        if (!chip) return false;
        chip.scrollIntoView({ block: 'center' });
        chip.click();
        return true;
      },
      chipIndex
    );

    // 3. Ждём панель
    let panelFound = false;
    try {
      await this.page.waitForSelector('._26c5bc2', {
        state: 'visible',
        timeout: 5000,
      });
      panelFound = true;
    } catch {
      /* ok */
    }

    // 4. Даём анимации доехать (300-500мс)
    await this.page.waitForTimeout(600);

    // 5. Снимок ПОСЛЕ клика
    const after = await this.page.evaluate(() => {
      const pick = (el: HTMLElement | null) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          classes: typeof el.className === 'string' ? el.className : '',
          rect: {
            width: Math.round(r.width * 100) / 100,
            height: Math.round(r.height * 100) / 100,
            top: Math.round(r.top),
            left: Math.round(r.left),
            right: Math.round(r.right),
          },
          style: {
            position: cs.position,
            top: cs.top,
            right: cs.right,
            left: cs.left,
            bottom: cs.bottom,
            width: cs.width,
            height: cs.height,
            minWidth: cs.minWidth,
            maxWidth: cs.maxWidth,
            transform: cs.transform,
            transition: cs.transition,
            zIndex: cs.zIndex,
            boxShadow: cs.boxShadow,
            backgroundColor: cs.backgroundColor,
            borderRadius: cs.borderRadius,
            overflow: cs.overflow,
            display: cs.display,
            flexDirection: cs.flexDirection,
          },
        };
      };

      const panel = document.querySelector('._26c5bc2') as HTMLElement | null;
      if (!panel) return { panelFound: false };

      // Все возможные элементы-ручки ресайза
      const resizeCandidates: any[] = [];
      panel.querySelectorAll('*').forEach((el) => {
        const e = el as HTMLElement;
        const cs = window.getComputedStyle(e);
        const r = e.getBoundingClientRect();
        // Узкий элемент по краю панели → ручка ресайза
        const isNarrow = r.width <= 12 && r.height > 40;
        const isAtEdge = Math.abs(r.left - panel.getBoundingClientRect().left) < 20;
        const hasResizeCursor =
          cs.cursor === 'col-resize' ||
          cs.cursor === 'ew-resize' ||
          cs.cursor === 'w-resize';
        if (isNarrow || isAtEdge || hasResizeCursor) {
          resizeCandidates.push({
            tag: e.tagName,
            classes: typeof e.className === 'string' ? e.className : '',
            role: e.getAttribute('role'),
            width: Math.round(r.width),
            height: Math.round(r.height),
            cursor: cs.cursor,
            rectLeft: Math.round(r.left),
            reasons: {
              isNarrow,
              isAtEdge,
              hasResizeCursor,
            },
          });
        }
      });

      // Родитель — на нём обычно --panel-width
      const parent = panel.parentElement;
      const parentCs = parent ? window.getComputedStyle(parent) : null;
      const parentVars: Record<string, string> = {};
      if (parent && parentCs) {
        for (let i = 0; i < parentCs.length; i++) {
          const p = parentCs[i];
          if (p.startsWith('--')) {
            const v = parentCs.getPropertyValue(p).trim();
            if (v) parentVars[p] = v;
          }
        }
      }

      // Всё на body и :root (могут быть активны при открытой панели)
      const rootVars: Record<string, string> = {};
      const rcs = window.getComputedStyle(document.documentElement);
      for (let i = 0; i < rcs.length; i++) {
        const p = rcs[i];
        if (p.startsWith('--panel')) {
          rootVars[p] = rcs.getPropertyValue(p).trim();
        }
      }

      // Все элементы с role="separator" (ARIA для resize-handle)
      const separators: any[] = [];
      document.querySelectorAll('[role="separator"]').forEach((sep) => {
        const e = sep as HTMLElement;
        const cs = window.getComputedStyle(e);
        const r = e.getBoundingClientRect();
        separators.push({
          classes: typeof e.className === 'string' ? e.className : '',
          cursor: cs.cursor,
          width: Math.round(r.width),
          height: Math.round(r.height),
          ariaLabel: e.getAttribute('aria-label'),
        });
      });

      return {
        panelFound: true,
        panel: pick(panel),
        panelParent: pick(parent),
        parentVars,
        rootVars,
        resizeCandidates: resizeCandidates.slice(0, 15),
        separators,
      };
    });

    // 6. Закрываем панель (крестик)
    try {
      await this.page.evaluate(() => {
        const btn = document.querySelector(
          '._26c5bc2 ._5d271a3'
        ) as HTMLElement | null;
        if (btn) btn.click();
      });
      await this.page.waitForTimeout(400);
    } catch {
      /* ignore */
    }

    // Сохраняем результат
    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const shortId = convId ? convId.slice(0, 8) : 'current';
    const jsonPath = path.join(dir, `recon_panel_${shortId}_${ts}.json`);

    await fsPromises.writeFile(
      jsonPath,
      JSON.stringify({ before, clicked, after }, null, 2),
      'utf-8'
    );

    const summary = {
      jsonPath,
      panelFound: (after as any).panelFound,
      before: (before as any),
      panel: (after as any).panel,
      panelParent: (after as any).panelParent,
      parentVars: (after as any).parentVars,
      rootVars: (after as any).rootVars,
      resizeCandidates: (after as any).resizeCandidates,
      separators: (after as any).separators,
    };

    console.log('[DeepSeek] ═══════════ RECON FILE PANEL ═══════════');
    console.log('[DeepSeek] Panel found:', summary.panelFound);
    console.log('[DeepSeek] Panel:', JSON.stringify(summary.panel, null, 2));
    console.log('[DeepSeek] Parent:', JSON.stringify(summary.panelParent, null, 2));
    console.log('[DeepSeek] Parent vars:', JSON.stringify(summary.parentVars, null, 2));
    console.log('[DeepSeek] Root --panel-* :', JSON.stringify(summary.rootVars, null, 2));
    console.log('[DeepSeek] Resize candidates:');
    (summary.resizeCandidates || []).forEach((c: any, i: number) => {
      console.log(
        `[DeepSeek]   [${i}] <${c.tag}> .${c.classes} w=${c.width} h=${c.height} cursor=${c.cursor} role=${c.role} reasons=${JSON.stringify(c.reasons)}`
      );
    });
    console.log('[DeepSeek] role="separator":');
    (summary.separators || []).forEach((s: any, i: number) => {
      console.log(
        `[DeepSeek]   [${i}] .${s.classes} cursor=${s.cursor} w=${s.width} h=${s.height}`
      );
    });
    console.log('[DeepSeek] JSON:', jsonPath);
    console.log('[DeepSeek] ═══════════════════════════════════════');

    return { jsonPath, summary };
  }

    /**
   * Recon v2: ищем resize-handle и --panel-width на сообщении.
   * Снимает состояние ДО / клик / ПОСЛЕ / hover на 8px слева от панели.
   */
  async reconFilePanelV2(convId?: string, chipIndex = 0): Promise<{
    jsonPath: string;
    summary: any;
  }> {
    if (!this.page) throw new Error('Браузер не запущен');

    if (convId) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(convId)) {
        await this.openConversation(convId);
      }
    }

    await this.page.waitForSelector(
      'div.ds-virtual-list.ds-virtual-list--printable',
      { timeout: 10000 }
    );

    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 900));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 500));
    });

    // 1. Снимок ДО
    const before = await this.page.evaluate(() => {
      // Ищем --panel-width на ВСЕХ элементах с inline-style
      const panelVarSources: Array<{
        tag: string;
        classes: string;
        inlineStyle: string;
        value: string;
      }> = [];
      document.querySelectorAll('[style*="--panel-width"]').forEach((el) => {
        const e = el as HTMLElement;
        panelVarSources.push({
          tag: e.tagName,
          classes: typeof e.className === 'string' ? e.className.slice(0, 100) : '',
          inlineStyle: e.getAttribute('style') || '',
          value: e.style.getPropertyValue('--panel-width') || '',
        });
      });
      return { panelVarSources };
    });

    // 2. Клик
    await this.page.evaluate(
      (idx) => {
        const container = document.querySelector(
          'div.ds-virtual-list.ds-virtual-list--printable'
        );
        const chips = Array.from(
          container?.querySelectorAll('.eafda4ae ._25c7358') || []
        ) as HTMLElement[];
        chips[idx]?.click();
      },
      chipIndex
    );

    await this.page.waitForSelector('._26c5bc2', { state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(700); // анимация

    // 3. Снимок ПОСЛЕ — ищем ручку везде
    const after = await this.page.evaluate(() => {
      const panelVarSources: Array<{ tag: string; classes: string; value: string }> = [];
      document.querySelectorAll('[style*="--panel-width"]').forEach((el) => {
        const e = el as HTMLElement;
        panelVarSources.push({
          tag: e.tagName,
          classes: typeof e.className === 'string' ? e.className.slice(0, 100) : '',
          value: e.style.getPropertyValue('--panel-width') || '',
        });
      });

      const panel = document.querySelector('._26c5bc2') as HTMLElement | null;
      if (!panel) return { panelFound: false, panelVarSources };

      const panelRect = panel.getBoundingClientRect();

      // ВСЁ содержимое родителя (siblings панели)
      const parent = panel.parentElement;
      const parentChildren: any[] = [];
      if (parent) {
        Array.from(parent.children).forEach((child) => {
          const c = child as HTMLElement;
          const cs = window.getComputedStyle(c);
          const r = c.getBoundingClientRect();
          parentChildren.push({
            tag: c.tagName,
            classes: typeof c.className === 'string' ? c.className.slice(0, 100) : '',
            rect: {
              left: Math.round(r.left),
              width: Math.round(r.width),
              height: Math.round(r.height),
            },
            position: cs.position,
            zIndex: cs.zIndex,
            cursor: cs.cursor,
            isPanel: c === panel,
          });
        });
      }

      // Ручек ресайза ищем ШИРЕ — в родителе, siblings, во всём документе
      // возле левой границы панели (panelRect.left ± 15px)
      const resizeCandidates: any[] = [];
      const searchRoots = [document, parent].filter(Boolean);
      for (const root of searchRoots) {
        if (!root) continue;
        root.querySelectorAll('*').forEach((el) => {
          const e = el as HTMLElement;
          if (e === panel) return;
          const cs = window.getComputedStyle(e);
          const r = e.getBoundingClientRect();
          // Кандидат: либо cursor resize, либо узкий vertical-элемент близко к panelRect.left
          const nearLeftEdge = Math.abs(r.left - panelRect.left) <= 15 || Math.abs(r.right - panelRect.left) <= 15;
          const isVerticalStrip = r.width <= 15 && r.height >= 100;
          const hasResizeCursor =
            cs.cursor === 'col-resize' ||
            cs.cursor === 'ew-resize' ||
            cs.cursor === 'w-resize' ||
            cs.cursor === 'e-resize';
          const hasSeparatorRole = e.getAttribute('role') === 'separator';
          if (
            hasResizeCursor ||
            hasSeparatorRole ||
            (isVerticalStrip && nearLeftEdge)
          ) {
            if (resizeCandidates.length < 20) {
              resizeCandidates.push({
                tag: e.tagName,
                classes: typeof e.className === 'string' ? e.className.slice(0, 150) : '',
                role: e.getAttribute('role'),
                cursor: cs.cursor,
                rect: {
                  left: Math.round(r.left),
                  top: Math.round(r.top),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                },
                style: {
                  position: cs.position,
                  backgroundColor: cs.backgroundColor,
                  opacity: cs.opacity,
                  zIndex: cs.zIndex,
                },
                reasons: { nearLeftEdge, isVerticalStrip, hasResizeCursor, hasSeparatorRole },
              });
            }
          }
        });
      }

      return {
        panelFound: true,
        panelVarSources,
        panelRect: {
          left: Math.round(panelRect.left),
          width: Math.round(panelRect.width),
          height: Math.round(panelRect.height),
        },
        parentChildren,
        resizeCandidates,
      };
    });

    // 4. Hover 8px слева от панели — вдруг ручка появляется при hover
    let hoverResult: any = null;
    if ((after as any).panelFound) {
      const pr = (after as any).panelRect;
      try {
        await this.page.mouse.move(pr.left - 4, pr.height / 2);
        await this.page.waitForTimeout(300);
        hoverResult = await this.page.evaluate(() => {
          const panel = document.querySelector('._26c5bc2') as HTMLElement | null;
          if (!panel) return null;
          const pr = panel.getBoundingClientRect();
          // Ищем элементы, которые стали видимы / изменили cursor
          const items: any[] = [];
          document.querySelectorAll('*').forEach((el) => {
            const e = el as HTMLElement;
            const cs = window.getComputedStyle(e);
            const r = e.getBoundingClientRect();
            const nearLeft = Math.abs(r.left - pr.left) <= 15 || Math.abs(r.right - pr.left) <= 15;
            if (!nearLeft) return;
            if (cs.cursor === 'col-resize' || cs.cursor === 'ew-resize' || cs.cursor === 'w-resize') {
              items.push({
                tag: e.tagName,
                classes: typeof e.className === 'string' ? e.className.slice(0, 100) : '',
                cursor: cs.cursor,
                opacity: cs.opacity,
                rect: { left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) },
              });
            }
          });
          return { items };
        });
      } catch {
        /* ignore */
      }
    }

    // 5. Закрываем
    try {
      await this.page.evaluate(() => {
        const btn = document.querySelector('._26c5bc2 ._5d271a3') as HTMLElement | null;
        if (btn) btn.click();
      });
      await this.page.waitForTimeout(400);
    } catch {}

    // Сохраняем
    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const shortId = convId ? convId.slice(0, 8) : 'current';
    const jsonPath = path.join(dir, `recon_panel_v2_${shortId}_${ts}.json`);
    const payload = { before, after, hoverResult };
    await fsPromises.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');

    const summary = {
      jsonPath,
      before,
      after,
      hoverResult,
    };

    console.log('[DeepSeek] ═══════════ RECON PANEL v2 ═══════════');
    console.log('[DeepSeek] --panel-width (before):', JSON.stringify((before as any).panelVarSources, null, 2));
    console.log('[DeepSeek] --panel-width (after):', JSON.stringify((after as any).panelVarSources, null, 2));
    console.log('[DeepSeek] panelRect:', (after as any).panelRect);
    console.log('[DeepSeek] parentChildren:', JSON.stringify((after as any).parentChildren, null, 2));
    console.log('[DeepSeek] resizeCandidates:');
    ((after as any).resizeCandidates || []).forEach((c: any, i: number) => {
      console.log(
        `[DeepSeek]   [${i}] <${c.tag}> .${c.classes} cursor=${c.cursor} role=${c.role} w=${c.rect.width} h=${c.rect.height} reasons=${JSON.stringify(c.reasons)}`
      );
    });
    console.log('[DeepSeek] hoverResizeItems:', JSON.stringify((hoverResult as any)?.items || [], null, 2));
    console.log('[DeepSeek] JSON:', jsonPath);
    console.log('[DeepSeek] ═══════════════════════════════════════');

    return { jsonPath, summary };
  }

  /**
   * Recon: computed styles контента боковой панели file-чипа.
   * Снимает ВСЮ цепочку: panel → scroll-area → inner → scrollable → content.
   * + scrollbar-параметры (gutter, overflow, scrollbar-width).
   * Закрывает панель в конце.
   */
  async reconFilePanelContentStyles(
    convId?: string,
    chipIndex = 0
  ): Promise<{ jsonPath: string; summary: any }> {
    if (!this.page) throw new Error('Браузер не запущен');

    if (convId) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(convId)) {
        await this.openConversation(convId);
      }
    }

    await this.page.waitForSelector(
      'div.ds-virtual-list.ds-virtual-list--printable',
      { timeout: 10000 }
    );

    // Прогрев: top → bottom → top (как recon v2 — иначе top-чипы виртуализируются)
    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 900));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 500));
    });

    // Диагностика: какие чипы в DOM
    const chipInfo = await this.page.evaluate(() => {
      const chips = Array.from(
        document.querySelectorAll('.eafda4ae ._25c7358')
      ) as HTMLElement[];
      return {
        count: chips.length,
        names: chips.map(
          (c) => c.querySelector('.e70accd6')?.textContent?.trim() || ''
        ),
      };
    });
    console.log(
      '[recon-panel-content] chips in DOM:',
      chipInfo.count,
      chipInfo.names
    );

    if (chipInfo.count === 0) {
      throw new Error(
        'Не найдено ни одного file-чипа в DOM после прогрева. Возможно, chat не содержит файлов или страница не загрузилась.'
      );
    }
    if (chipIndex >= chipInfo.count) {
      throw new Error(
        `chipIndex=${chipIndex} вне диапазона (всего ${chipInfo.count} чипов)`
      );
    }

    // Клик через locator с scrollIntoView
    const chipLocator = this.page
      .locator('.eafda4ae ._25c7358')
      .nth(chipIndex);
    await chipLocator.scrollIntoViewIfNeeded({ timeout: 5000 });
    await chipLocator.click({ force: true, timeout: 5000 });

    await this.page.waitForSelector('._26c5bc2', {
      state: 'visible',
      timeout: 10000,
    });

    // Ждём контент
    let hasContent = false;
    const start = Date.now();
    while (Date.now() - start < 60000) {
      hasContent = await this.page.evaluate(() => {
        const el = document.querySelector('._26c5bc2 .abbe3c45') as HTMLElement | null;
        return !!(el && el.textContent && el.textContent.trim().length > 50);
      });
      if (hasContent) break;
      await this.page.waitForTimeout(300);
    }

    await this.page.waitForTimeout(500); // stabilization

    // Снимаем стили всей цепочки
    const styles = await this.page.evaluate(() => {
      const pick = (el: HTMLElement | null, withRect = true) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          classes: typeof el.className === 'string' ? el.className : '',
          ...(withRect
            ? {
                rect: {
                  width: Math.round(r.width * 100) / 100,
                  height: Math.round(r.height * 100) / 100,
                  top: Math.round(r.top),
                  left: Math.round(r.left),
                },
              }
            : {}),
          style: {
            display: cs.display,
            position: cs.position,
            flexDirection: cs.flexDirection,
            flex: `${cs.flexGrow} ${cs.flexShrink} ${cs.flexBasis}`,
            width: cs.width,
            height: cs.height,
            minWidth: cs.minWidth,
            maxWidth: cs.maxWidth,
            minHeight: cs.minHeight,
            maxHeight: cs.maxHeight,
            padding: cs.padding,
            paddingTop: cs.paddingTop,
            paddingRight: cs.paddingRight,
            paddingBottom: cs.paddingBottom,
            paddingLeft: cs.paddingLeft,
            margin: cs.margin,
            boxSizing: cs.boxSizing,
            overflow: cs.overflow,
            overflowX: cs.overflowX,
            overflowY: cs.overflowY,
            whiteSpace: cs.whiteSpace,
            wordBreak: cs.wordBreak,
            overflowWrap: cs.overflowWrap,
            wordSpacing: cs.wordSpacing,
            letterSpacing: cs.letterSpacing,
            lineHeight: cs.lineHeight,
            fontSize: cs.fontSize,
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            fontStyle: cs.fontStyle,
            textAlign: cs.textAlign,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            border: cs.border,
            borderRadius: cs.borderRadius,
            scrollbarWidth: cs.scrollbarWidth,
            scrollbarColor: cs.scrollbarColor,
            scrollbarGutter: cs.scrollbarGutter,
          },
        };
      };

      const panel = document.querySelector('._26c5bc2') as HTMLElement | null;
      if (!panel) return null;

      const header = panel.querySelector('._2c74d7a') as HTMLElement | null;
      const scrollArea = panel.querySelector('.fcd12e6e') as HTMLElement | null;
      const gutterV = panel.querySelector('.ds-scroll-area__vertical-gutter') as HTMLElement | null;
      const gutterBar = panel.querySelector('.ds-scroll-area__vertical-bar') as HTMLElement | null;
      const inner = panel.querySelector('.d1d2eae1') as HTMLElement | null;
      const scrollable = panel.querySelector('.a44e8e96') as HTMLElement | null;
      const content = panel.querySelector('.abbe3c45') as HTMLElement | null;

      // CSS vars на panel (могут влиять на отступы)
      const panelVars: Record<string, string> = {};
      const pcs = window.getComputedStyle(panel);
      for (let i = 0; i < pcs.length; i++) {
        const prop = pcs[i];
        if (prop.startsWith('--')) {
          const v = pcs.getPropertyValue(prop).trim();
          if (v) panelVars[prop] = v;
        }
      }

      // Content: sample of first 500 chars, split by \n for line breaks
      const contentText = content?.textContent || '';
      const contentSample = contentText.slice(0, 500);
      const lineCount = contentText.split('\n').length;

      // innerHTML первых 3 строк (чтобы понять структуру)
      const contentHtmlSample = (content?.innerHTML || '').slice(0, 1000);

      return {
        header: pick(header),
        panel: pick(panel),
        scrollArea: pick(scrollArea),
        gutterV: pick(gutterV),
        gutterBar: pick(gutterBar),
        inner: pick(inner),
        scrollable: pick(scrollable),
        content: pick(content),
        panelVars,
        contentMeta: {
          length: contentText.length,
          lines: lineCount,
          sample: contentSample,
          htmlSample: contentHtmlSample,
        },
      };
    });

    // Закрываем
    try {
      await this.page.evaluate(() => {
        const btn = document.querySelector('._26c5bc2 ._5d271a3') as HTMLElement | null;
        if (btn) btn.click();
      });
      await this.page.waitForTimeout(300);
    } catch {
      /* ignore */
    }

    // Сохраняем
    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const shortId = convId ? convId.slice(0, 8) : 'current';
    const jsonPath = path.join(dir, `recon_panel_content_${shortId}_${ts}.json`);
    await fsPromises.writeFile(jsonPath, JSON.stringify(styles, null, 2), 'utf-8');

    console.log('[DeepSeek] ═══════════ RECON PANEL CONTENT ═══════════');
    console.log('[DeepSeek] hasContent:', hasContent);
    if (styles) {
      const s = styles as any;
      console.log('[DeepSeek] contentMeta:', JSON.stringify(s.contentMeta, null, 2));
      console.log('[DeepSeek] header:', JSON.stringify(s.header?.style, null, 2));
      console.log('[DeepSeek] scrollArea:', JSON.stringify(s.scrollArea?.style, null, 2));
      console.log('[DeepSeek] gutterV:', JSON.stringify(s.gutterV?.style, null, 2));
      console.log('[DeepSeek] gutterBar:', JSON.stringify(s.gutterBar?.style, null, 2));
      console.log('[DeepSeek] inner:', JSON.stringify(s.inner?.style, null, 2));
      console.log('[DeepSeek] scrollable:', JSON.stringify(s.scrollable?.style, null, 2));
      console.log('[DeepSeek] content:', JSON.stringify(s.content?.style, null, 2));
      console.log('[DeepSeek] content rect:', JSON.stringify(s.content?.rect, null, 2));
    }
    console.log('[DeepSeek] JSON:', jsonPath);
    console.log('[DeepSeek] ═══════════════════════════════════════');

    return { jsonPath, summary: styles };
  }

  /**
   * Recon: как PW переключает ветки (branching).
   * Ищет переключатели несколькими стратегиями:
   *   1) textContent элемента содержит паттерн "число/число" (например, 1/2, 1 / 2, 2 / 3)
   *   2) Рядом два SVG-стрелки (назад/вперёд)
   *   3) aria-label / title содержит "branch", "variant", "alternative", "ветка", "вариант"
   *
   * Всегда сохраняет HTML последних 3 сообщений — пригодятся даже если
   * switcher не найден.
   */
  async reconBranches(convId?: string): Promise<{
    jsonPath: string;
    summary: any;
  }> {
    if (!this.page) throw new Error('Браузер не запущен');

    if (convId) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(convId)) {
        await this.openConversation(convId);
        await this.page.waitForTimeout(2000);
      }
    }

    try {
      await this.page.waitForSelector(
        'div.ds-virtual-list.ds-virtual-list--printable',
        { timeout: 10000 }
      );
    } catch {
      throw new Error('Список сообщений не появился в PW');
    }

    // Прогрев
    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 800));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 500));
    });

    // 1. Ищем переключатели несколькими стратегиями
    const searchResult = await this.page.evaluate(() => {
      const container = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      );
      if (!container) return { candidates: [], lastMessages: [], totalItems: 0 };

      const candidates: any[] = [];
      const seen = new Set<HTMLElement>();

      // Стратегия A: textContent содержит \d+\s*/\s*\d+
      const reFraction = /\d+\s*\/\s*\d+/;
      container.querySelectorAll('*').forEach((el) => {
        const e = el as HTMLElement;
        if (seen.has(e)) return;
        const text = (e.textContent || '').trim();
        if (text.length > 50) return; // слишком длинный — не переключатель
        if (!reFraction.test(text)) return;

        // Проверим, что это «лист» (у ребёнка уже нет цифр/дроби)
        // или что он сам по себе не гигантский контейнер
        const isSmall = text.length <= 15;
        if (!isSmall) return;

        seen.add(e);
        candidates.push({
          source: 'fraction-text',
          text,
          tag: e.tagName,
          classes: typeof e.className === 'string' ? e.className : '',
          role: e.getAttribute('role'),
          ariaLabel: e.getAttribute('aria-label'),
          title: e.getAttribute('title'),
          childrenCount: e.children.length,
          svgCount: e.querySelectorAll('svg').length,
          html: e.outerHTML.slice(0, 2000),
          parentHtml: (e.parentElement?.outerHTML || '').slice(0, 3000),
        });
      });

      // Стратегия B: элемент содержит ровно 2 SVG-стрелки и текст
      container.querySelectorAll('div, span, button').forEach((el) => {
        const e = el as HTMLElement;
        if (seen.has(e)) return;
        const svgs = e.querySelectorAll('svg');
        if (svgs.length !== 2) return;
        const text = (e.textContent || '').trim();
        if (text.length > 30) return;
        // Проверим, что в SVG есть path (это действительно стрелки)
        const hasPaths = Array.from(svgs).every((s) => s.querySelector('path'));
        if (!hasPaths) return;

        seen.add(e);
        candidates.push({
          source: 'two-svgs',
          text,
          tag: e.tagName,
          classes: typeof e.className === 'string' ? e.className : '',
          role: e.getAttribute('role'),
          ariaLabel: e.getAttribute('aria-label'),
          title: e.getAttribute('title'),
          childrenCount: e.children.length,
          svgCount: svgs.length,
          html: e.outerHTML.slice(0, 2000),
          parentHtml: (e.parentElement?.outerHTML || '').slice(0, 3000),
        });
      });

      // Стратегия C: aria-label/title содержит branch/variant/ветка/вариант
      const reKeyword = /branch|variant|alternative|ветк|вариант/i;
      container.querySelectorAll('*').forEach((el) => {
        const e = el as HTMLElement;
        if (seen.has(e)) return;
        const attrs = [
          e.getAttribute('aria-label') || '',
          e.getAttribute('title') || '',
          typeof e.className === 'string' ? e.className : '',
        ];
        if (!attrs.some((s) => reKeyword.test(s))) return;

        seen.add(e);
        candidates.push({
          source: 'keyword-attr',
          text: (e.textContent || '').trim().slice(0, 50),
          tag: e.tagName,
          classes: typeof e.className === 'string' ? e.className : '',
          role: e.getAttribute('role'),
          ariaLabel: e.getAttribute('aria-label'),
          title: e.getAttribute('title'),
          childrenCount: e.children.length,
          svgCount: e.querySelectorAll('svg').length,
          html: e.outerHTML.slice(0, 2000),
          parentHtml: (e.parentElement?.outerHTML || '').slice(0, 3000),
        });
      });

      // Последние 3 сообщения целиком (для ручного анализа)
      const items = Array.from(
        container.querySelectorAll('div[data-virtual-list-item-key]')
      ) as HTMLElement[];
      const lastMessages = items.slice(-3).map((el) => ({
        key: el.getAttribute('data-virtual-list-item-key'),
        html: el.outerHTML.slice(0, 15000),
      }));

      return {
        candidates,
        lastMessages,
        totalItems: items.length,
      };
    });

    // 2. Снимаем HTML всего контейнера до клика (на случай если ничего не нашли)
    const htmlBefore = await this.page.evaluate(() => {
      const container = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      );
      return container ? container.outerHTML.slice(0, 300000) : '';
    });

    // 3. Пробуем кликнуть, если нашли кандидатов
    const networkRequests: Array<{
      url: string;
      method: string;
      resourceType: string;
      postDataSnippet?: string;
      responseStatus?: number;
      responseBodySnippet?: string;
    }> = [];

    let clicked = false;

    if (searchResult.candidates.length > 0) {
      const onResponse = async (resp: any) => {
        const url = resp.url();
        const resourceType = resp.request().resourceType();
        const isStatic =
          resourceType === 'image' ||
          resourceType === 'font' ||
          resourceType === 'stylesheet' ||
          resourceType === 'script' ||
          resourceType === 'media' ||
          url.startsWith('data:') ||
          url.includes('.hot-update.') ||
          url.includes('/_next/') ||
          url.includes('favicon');
        if (isStatic) return;

        const entry: any = {
          url,
          method: resp.request().method(),
          resourceType,
          postDataSnippet: (resp.request().postData() || '').slice(0, 500),
          responseStatus: resp.status(),
        };
        if (
          resourceType === 'fetch' ||
          resourceType === 'xhr' ||
          url.includes('/api/')
        ) {
          try {
            const body = await resp.text();
            entry.responseBodySnippet = body.slice(0, 5000);
          } catch {
            /* ignore */
          }
        }
        networkRequests.push(entry);
      };

      this.page.on('response', onResponse);

      // Кликаем по ВТОРОМУ SVG внутри первого кандидата (обычно это ">")
      try {
        clicked = await this.page.evaluate(() => {
          const container = document.querySelector(
            'div.ds-virtual-list.ds-virtual-list--printable'
          );
          if (!container) return false;

          // Повторяем поиск, чтобы получить живой element
          const reFraction = /\d+\s*\/\s*\d+/;
          const all = Array.from(container.querySelectorAll('*')) as HTMLElement[];
          let target: HTMLElement | null = null;

          // Сначала — fraction-text
          for (const e of all) {
            const text = (e.textContent || '').trim();
            if (text.length > 15) continue;
            if (!reFraction.test(text)) continue;
            target = e;
            break;
          }

          if (!target) {
            // Fallback — элемент с 2 SVG
            for (const e of all) {
              if (e.querySelectorAll('svg').length === 2) {
                const text = (e.textContent || '').trim();
                if (text.length <= 30) {
                  target = e;
                  break;
                }
              }
            }
          }

          if (!target) return false;

          target.scrollIntoView({ block: 'center' });
          // Кликаем по правой половине элемента
          const rect = target.getBoundingClientRect();
          const clickX = rect.right - rect.width * 0.15;
          const clickY = rect.top + rect.height / 2;

          // Ищем правый SVG
          const svgs = target.querySelectorAll('svg');
          if (svgs.length >= 2) {
            const rightSvg = svgs[svgs.length - 1] as SVGElement;
            const r = rightSvg.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              rightSvg.dispatchEvent(
                new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: r.left + r.width / 2,
                  clientY: r.top + r.height / 2,
                })
              );
              return true;
            }
          }

          // Fallback — клик по координатам
          const elAtPoint = document.elementFromPoint(clickX, clickY);
          if (elAtPoint) {
            elAtPoint.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: clickX,
                clientY: clickY,
              })
            );
            return true;
          }
          return false;
        });
      } catch (e) {
        console.warn(
          '[reconBranches] click failed:',
          (e as Error).message
        );
      }

      await this.page.waitForTimeout(3000);
      this.page.off('response', onResponse);
    }

    // 4. Снимаем HTML после
    const htmlAfter = await this.page.evaluate(() => {
      const container = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      );
      return container ? container.outerHTML.slice(0, 300000) : '';
    });

    // 5. Сохраняем
    const dir = path.join(app.getPath('userData'), 'debug_dumps');
    await fsPromises.mkdir(dir, { recursive: true });
    const ts = Date.now();
    const shortId = convId ? convId.slice(0, 8) : 'current';
    const jsonPath = path.join(dir, `recon_branches_${shortId}_${ts}.json`);

    const payload = {
      convId: convId || 'current',
      url: this.page.url(),
      candidatesCount: searchResult.candidates.length,
      candidates: searchResult.candidates,
      totalItems: searchResult.totalItems,
      lastMessages: searchResult.lastMessages,
      clicked,
      networkRequests,
      htmlBefore,
      htmlAfter,
    };

    await fsPromises.writeFile(
      jsonPath,
      JSON.stringify(payload, null, 2),
      'utf-8'
    );

    const summary = {
      jsonPath,
      candidatesCount: searchResult.candidates.length,
      totalItems: searchResult.totalItems,
      clicked,
      networkRequestsCount: networkRequests.length,
      networkRequests: networkRequests.map((r) => ({
        method: r.method,
        status: r.responseStatus,
        resourceType: r.resourceType,
        url: r.url,
        postDataSnippet: r.postDataSnippet?.slice(0, 300),
        bodySnippet: r.responseBodySnippet?.slice(0, 300),
      })),
    };

    console.log('[DeepSeek] ═══════════ RECON BRANCHES ═══════════');
    console.log('[DeepSeek] Total messages   :', searchResult.totalItems);
    console.log('[DeepSeek] Candidates found :', searchResult.candidates.length);
    searchResult.candidates.slice(0, 5).forEach((c, i) => {
      console.log(
        `[DeepSeek]   [${i}] src=${c.source} text="${c.text}" tag=${c.tag} svg=${c.svgCount} children=${c.childrenCount}`
      );
      console.log(`[DeepSeek]       classes: ${c.classes}`);
      if (c.ariaLabel) console.log(`[DeepSeek]       aria: ${c.ariaLabel}`);
    });
    console.log('[DeepSeek] Clicked          :', clicked);
    console.log('[DeepSeek] Network req      :', networkRequests.length);
    networkRequests.forEach((r) => {
      console.log(
        `[DeepSeek]  ★ ${r.method} ${r.responseStatus} ${r.resourceType} ${r.url.slice(0, 120)}`
      );
      if (r.postDataSnippet) {
        console.log('   body:', r.postDataSnippet.slice(0, 300));
      }
    });
    console.log('[DeepSeek] JSON             :', jsonPath);
    console.log('[DeepSeek] ══════════════════════════════════════');

    return { jsonPath, summary };
  }

    /**
   * 5.7: переключение ветки в PW.
   * @param messageKey — data-virtual-list-item-key числового сообщения
   * @param direction — 'prev' (левая стрелка) | 'next' (правая стрелка)
   */
  async switchBranch(
    messageKey: string,
    direction: 'prev' | 'next',
    opts?: {
      branchTotal?: number;
      branchIndex?: number;
      role?: 'user' | 'assistant';
    }
  ): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    console.log('[switchBranch] invoked:', {
      messageKey,
      direction,
      opts,
      optsIsUndefined: opts === undefined,
    });

    // ─── 1. Поиск pwKey ─────────────────────────────────
    const search = await this.page.evaluate(
      async (key: string) => {
        const container = document.querySelector(
          'div.ds-virtual-list.ds-virtual-list--printable'
        ) as HTMLElement | null;
        if (!container)
          return { found: false, keys: [], log: ['no container'] };

        const q = () =>
          document.querySelector(
            `div[data-virtual-list-item-key="${key}"]`
          ) as HTMLElement | null;
        const getKeys = () =>
          Array.from(
            container.querySelectorAll('[data-virtual-list-item-key]')
          )
            .map((e) => e.getAttribute('data-virtual-list-item-key'))
            .filter(Boolean) as string[];
        const log: string[] = [];

        if (q()) return { found: true, keys: getKeys(), log: ['initial'] };

        container.scrollTop = container.scrollHeight;
        try {
          container.dispatchEvent(new Event('scroll', { bubbles: true }));
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
        log.push(`bottom: keys=${getKeys().join(',')}`);
        if (q()) return { found: true, keys: getKeys(), log };

        container.scrollTop = 0;
        try {
          container.dispatchEvent(new Event('scroll', { bubbles: true }));
        } catch {}
        await new Promise((r) => setTimeout(r, 800));
        log.push(`top: keys=${getKeys().join(',')}`);
        if (q()) return { found: true, keys: getKeys(), log };

        const step = Math.max(300, container.clientHeight * 0.7);
        for (let pos = 0; pos <= container.scrollHeight; pos += step) {
          container.scrollTop = pos;
          try {
            container.dispatchEvent(new Event('scroll', { bubbles: true }));
          } catch {}
          await new Promise((r) => setTimeout(r, 500));
          if (q()) {
            log.push(`step ${pos}: found`);
            return { found: true, keys: getKeys(), log };
          }
        }
        log.push(`all steps done, final keys=${getKeys().join(',')}`);
        return { found: false, keys: getKeys(), log };
      },
      messageKey
    );

    for (const line of (search as any).log || []) {
      console.log(`[switchBranch] ${line}`);
    }

    let found = search.found;

    // ─── 2. SIBLING-FALLBACK ────────────────────────────
    const total = opts?.branchTotal;
    const uiIdx = opts?.branchIndex;
    const role: 'user' | 'assistant' | null = opts?.role ?? null;

    if (!found && total != null && total > 1 && uiIdx != null) {
      const targetIdx =
        direction === 'prev'
          ? Math.max(1, uiIdx - 1)
          : Math.min(total, uiIdx + 1);

      console.log(
        `[switchBranch] sibling-fallback: role=${role ?? '?'} total=${total}, ` +
          `ui.current=${uiIdx}, target=${targetIdx}/${total}`
      );

      for (let attempt = 0; attempt < 6; attempt++) {
        type Sibling = {
          idx: number;
          tot: number;
          hasPrev: boolean;
          hasNext: boolean;
        };
        type SiblingArg = { total: number; role: 'user' | 'assistant' | null };

        const siblingArg: SiblingArg = { total, role };

        const sibling: Sibling | null = await this.page.evaluate(
          (arg: SiblingArg): Sibling | null => {
            const c = document.querySelector(
              'div.ds-virtual-list.ds-virtual-list--printable'
            );
            if (!c) return null;
            for (const textEl of Array.from(c.querySelectorAll('.dd7e4fda'))) {
              const f = (textEl.textContent || '')
                .trim()
                .match(/^(\d+)\s*\/\s*(\d+)$/);
              if (!f) continue;
              const idx = parseInt(f[1], 10);
              const tot = parseInt(f[2], 10);
              if (tot !== arg.total) continue;
              const msgEl = textEl.closest(
                'div[data-virtual-list-item-key]'
              ) as HTMLElement | null;
              if (!msgEl) continue;
              const hasUserText = !!msgEl.querySelector('.fbb737a4');
              const hasFileChips = !!msgEl.querySelector('.eafda4ae');
              const thisRole: 'user' | 'assistant' =
                hasUserText || hasFileChips ? 'user' : 'assistant';
              if (arg.role && thisRole !== arg.role) continue;
              const switcher = textEl.parentElement;
              if (!switcher) continue;
              const btns = switcher.querySelectorAll('[role="button"]');
              if (btns.length < 2) continue;
              const hasPrev = !(btns[0] as HTMLElement).classList.contains(
                'ds-button--disabled'
              );
              const hasNext = !(btns[1] as HTMLElement).classList.contains(
                'ds-button--disabled'
              );
              return { idx, tot, hasPrev, hasNext };
            }
            return null;
          },
          siblingArg
        );

        if (!sibling) {
          console.warn('[switchBranch] sibling switcher NOT FOUND');
          break;
        }

        console.log(
          `[switchBranch] sibling at ${sibling.idx}/${sibling.tot} ` +
            `(hasPrev=${sibling.hasPrev}, hasNext=${sibling.hasNext})`
        );

        if (sibling.idx === targetIdx) {
          found = await this.page.evaluate(
            (k: string): boolean => {
              const c = document.querySelector(
                'div.ds-virtual-list.ds-virtual-list--printable'
              );
              return !!c?.querySelector(
                `div[data-virtual-list-item-key="${k}"]`
              );
            },
            messageKey
          );
          if (found) {
            console.log(
              `[switchBranch] sibling aligned to ${targetIdx}/${total}, target ${messageKey} now in DOM`
            );
            break;
          }
          await this.page.waitForTimeout(500);
          continue;
        }

        const clickDir: 'prev' | 'next' =
          sibling.idx < targetIdx ? 'next' : 'prev';

        type ClickArg = {
          total: number;
          dir: 'prev' | 'next';
          role: 'user' | 'assistant' | null;
        };
        const clickArg: ClickArg = { total, dir: clickDir, role };

        const clickOk: boolean = await this.page.evaluate(
          (arg: ClickArg): boolean => {
            const c = document.querySelector(
              'div.ds-virtual-list.ds-virtual-list--printable'
            );
            if (!c) return false;
            for (const textEl of Array.from(c.querySelectorAll('.dd7e4fda'))) {
              const f = (textEl.textContent || '')
                .trim()
                .match(/^(\d+)\s*\/\s*(\d+)$/);
              if (!f) continue;
              const tot = parseInt(f[2], 10);
              if (tot !== arg.total) continue;
              const msgEl = textEl.closest(
                'div[data-virtual-list-item-key]'
              ) as HTMLElement | null;
              if (!msgEl) continue;
              const hasUserText = !!msgEl.querySelector('.fbb737a4');
              const hasFileChips = !!msgEl.querySelector('.eafda4ae');
              const thisRole: 'user' | 'assistant' =
                hasUserText || hasFileChips ? 'user' : 'assistant';
              if (arg.role && thisRole !== arg.role) continue;
              const switcher = textEl.parentElement;
              if (!switcher) continue;
              const btns = switcher.querySelectorAll('[role="button"]');
              if (btns.length < 2) continue;
              const btn = (
                arg.dir === 'prev' ? btns[0] : btns[1]
              ) as HTMLElement;
              if (btn.classList.contains('ds-button--disabled')) return false;
              btn.click();
              return true;
            }
            return false;
          },
          clickArg
        );

        console.log(
          `[switchBranch] sibling click ${clickDir}: ok=${clickOk}`
        );
        if (!clickOk) break;

        await this.page.waitForTimeout(2000);
      }

      if (!found) {
        found = await this.page.evaluate(
          (k: string): boolean => {
            const c = document.querySelector(
              'div.ds-virtual-list.ds-virtual-list--printable'
            );
            return !!c?.querySelector(
              `div[data-virtual-list-item-key="${k}"]`
            );
          },
          messageKey
        );
      }
      console.log(`[switchBranch] after sibling-fallback: found=${found}`);
    }

    if (!found) {
      const keys = ((search as any).keys || []).join(',');
      throw new Error(
        `Message ${messageKey} not found in PW DOM (keys: ${keys}). ` +
          `Возможно, сообщение на неактивной ветке — нужен resync.`
      );
    }

    // ─── 3. Клик по целевому switcher ──────────────────
    type ClickTargetArg = { key: string; dir: 'prev' | 'next' };
    type ClickTargetRes = { ok: boolean; error?: string };
    const clickTargetArg: ClickTargetArg = {
      key: messageKey,
      dir: direction,
    };

    const result: ClickTargetRes = await this.page.evaluate(
      (arg: ClickTargetArg): ClickTargetRes => {
        const msgEl = document.querySelector(
          `div[data-virtual-list-item-key="${arg.key}"]`
        ) as HTMLElement | null;
        if (!msgEl) return { ok: false, error: 'message not found after sibling' };

        const textEl = msgEl.querySelector('.dd7e4fda');
        if (!textEl) return { ok: false, error: 'switcher not found' };

        const switcher = textEl.parentElement;
        if (!switcher) return { ok: false, error: 'switcher parent not found' };

        const buttons = switcher.querySelectorAll('[role="button"]');
        if (buttons.length < 2) return { ok: false, error: 'buttons < 2' };

        const btn = (
          arg.dir === 'prev' ? buttons[0] : buttons[1]
        ) as HTMLElement;
        if (btn.classList.contains('ds-button--disabled')) {
          return { ok: false, error: `arrow ${arg.dir} disabled` };
        }

        btn.click();
        return { ok: true };
      },
      clickTargetArg
    );

    if (!result.ok) {
      throw new Error(result.error || 'switch failed');
    }

    await this.page.waitForTimeout(1000);

    try {
      await this.page.evaluate(() => {
        const container = document.querySelector(
          'div.ds-virtual-list.ds-virtual-list--printable'
        ) as HTMLElement | null;
        if (!container) return;
        const all = Array.from(
          container.querySelectorAll('[data-virtual-list-item-key]')
        ) as HTMLElement[];
        const target = all.find((e) => e.querySelector('.dd7e4fda'));
        if (target) {
          target.scrollIntoView({
            block: 'center',
            behavior: 'instant' as ScrollBehavior,
          });
        }
      });
      await this.page.waitForTimeout(1500);
    } catch {
      /* ignore */
    }
  }

  /**
   * Отладочный метод: возвращает текущее состояние PW (все сообщения, их ключи и ветки)
   * БЕЗ сохранения в БД. Только для сравнения.
   */
  async dumpFullPWState(): Promise<Array<{
    pwKey: string;
    role: string;
    text: string;
    branch: string;
  }>> {
    if (!this.page) return [];

    // Правильное сканирование: медленно, но надёжно.
    // Не прыгаем, а идём шагом 400px с паузой 300ms по всей высоте.
    const result = await this.page.evaluate(async () => {
      const container = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!container) return [];

      const map = new Map<string, {
        pwKey: string;
        role: string;
        text: string;
        branch: string;
      }>();

      const collect = () => {
        container.querySelectorAll('div[data-virtual-list-item-key]').forEach((el) => {
          const key = el.getAttribute('data-virtual-list-item-key') || '';
          if (!key) return;
          // Не перезаписываем, но обновляем если HTML изменился (для диагностики неважно)
          if (map.has(key)) return;

          const hasUserText = !!el.querySelector('.fbb737a4');
          const hasFileChips = !!el.querySelector('.eafda4ae');
          const isUser = hasUserText || hasFileChips;
          const role = isUser ? 'user' : 'assistant';

          let text = '';
          if (isUser) {
            text = el.querySelector('.fbb737a4')?.textContent?.trim() || '';
          } else {
            const main = el.querySelector('.ds-markdown.ds-assistant-message-main-content');
            text = main?.textContent?.trim() || '';
          }

          // 5.7.17: через .dd7e4fda (класс _17e14c5 может быть Unicode).
          let branch = '-';
          const textEl = el.querySelector('.dd7e4fda');
          if (textEl) branch = textEl.textContent?.trim() || '-';

          map.set(key, {
            pwKey: key,
            role,
            text: text.slice(0, 60).replace(/\n/g, ' '),
            branch,
          });
        });
      };

      // Маленький MutationObserver — ловит всё, что появляется
      const observer = new MutationObserver(() => collect());
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-virtual-list-item-key'],
      });

      const step = 150;
      let pos = 0;
      while (pos <= container.scrollHeight) {
        container.scrollTop = pos;
        await new Promise((r) => setTimeout(r, 300));
        collect();
        pos += step;
      }

      // Финальный сбор
      container.scrollTop = container.scrollHeight;
      await new Promise((r) => setTimeout(r, 500));
      collect();

      observer.disconnect();
      return Array.from(map.values());
    });

    return result;
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

  /**
   * Переименовывает диалог в DeepSeek.
   */
  async renameConversation(id: string, newTitle: string): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const convLink = this.page.locator(`a._546d736[href*="${id}"]`).first();
    await convLink.waitFor({ state: 'visible', timeout: 5000 });
    await convLink.hover();
    await this.page.waitForTimeout(200);

    const moreButton = convLink.locator('._2090548').first();
    await moreButton.click({ force: true });
    await this.page.waitForTimeout(300);

    // Клик по Rename / Переименовать
    const renameItem = this.page
      .locator('.ds-dropdown-menu-option__label, [role="menuitem"]')
      .filter({ hasText: /Rename|Переименовать/i })
      .first();
    await renameItem.waitFor({ state: 'visible', timeout: 5000 });
    await renameItem.click({ force: true });

    await this.page.waitForTimeout(500);

    // Ищем поле ввода (DeepSeek может использовать input или textarea)
    // Чаще всего это input.ds-input__input или просто input, который стал видимым
    let inputSelector = 'input.ds-input__input';
    if (await this.page.locator(inputSelector).count() === 0) {
      inputSelector = 'input[type="text"]';
    }
    
    const input = this.page.locator(inputSelector).first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    
    // Очищаем и вводим новое имя
    await input.fill('');
    await input.fill(newTitle);
    await input.press('Enter');
    
    await this.page.waitForTimeout(1000);
    console.log(`[DeepSeek] ✅ Диалог ${id} переименован в "${newTitle}"`);
  }

  /**
   * Закрепляет или открепляет диалог.
   * @param pin true = закрепить, false = открепить
   */
  async pinConversation(id: string, pin: boolean): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    const convLink = this.page.locator(`a._546d736[href*="${id}"]`).first();
    await convLink.waitFor({ state: 'visible', timeout: 5000 });
    await convLink.hover();
    await this.page.waitForTimeout(200);

    const moreButton = convLink.locator('._2090548').first();
    await moreButton.click({ force: true });
    await this.page.waitForTimeout(300);

    // Ищем пункт Pin или Unpin
    const pinRegex = pin ? /Pin|Закрепить/i : /Unpin|Открепить/i;
    
    const pinItem = this.page
      .locator('.ds-dropdown-menu-option__label, [role="menuitem"]')
      .filter({ hasText: pinRegex })
      .first();
      
    await pinItem.waitFor({ state: 'visible', timeout: 5000 });
    await pinItem.click({ force: true });
    
    await this.page.waitForTimeout(500);
    console.log(`[DeepSeek] ✅ Диалог ${id} ${pin ? 'закреплён' : 'откреплён'}`);
  }

  /**
   * Удаляет диалог из DeepSeek.
   *
   * Поток (по результатам разведки в PW):
   *   1. Найти элемент в сайдбаре (или убедиться, что уже удалён)
   *   2. hover → три точки → меню → «Delete/Удалить»
   *   3. Ждём модалку подтверждения (кнопка .ds-button--error)
   *   4. Ставим waitForResponse на POST /api/v0/chat_session/delete
   *   5. Клик по подтверждению
   *   6. Дождаться ответа сервера и проверить code === 0
   *
   * Бросает Error с осмысленным текстом на любой стадии — IPC-обёртка
   * вернёт пользователю точную причину. При провале БД не трогается.
   */
  async deleteConversation(id: string): Promise<void> {
    if (!this.page) throw new Error('Браузер не запущен');

    // 1. Найти элемент в сайдбаре
    const convLink = this.page.locator(`a._546d736[href*="${id}"]`).first();
    const visible = await convLink
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!visible) {
      // Возможно, уже удалён, либо виртуализация. Проверяем через список.
      const list = await this.getConversations().catch(() => []);
      if (!list.some((c) => c.id === id)) {
        console.log(`[DeepSeek] Диалог ${id} отсутствует в сайдбаре — считаем уже удалённым`);
        return;
      }
      throw new Error(`Диалог ${id} не найден в сайдбаре (timeout 10с)`);
    }

    // 2. Hover + три точки
    await convLink.hover();
    await this.page.waitForTimeout(200);
    const moreButton = convLink.locator('._2090548').first();
    try {
      await moreButton.waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      throw new Error('Кнопка «три точки» не появилась при hover на диалог');
    }
    await moreButton.click({ force: true });
    await this.page.waitForTimeout(300);

    // 3. Пункт меню «Удалить / Delete»
    const deleteItem = this.page
      .locator('[role="menuitem"], .ds-dropdown-menu-option__label')
      .filter({ hasText: /Удалить|Delete/i })
      .first();
    try {
      await deleteItem.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      throw new Error('Пункт меню «Удалить/Delete» не появился');
    }
    await deleteItem.click({ force: true });

    // 4. Модалка подтверждения (.ds-button--error — точный селектор из рекона)
    const confirmButton = this.page
      .locator('div.ds-modal .ds-button--error, div.ds-modal .ds-button--filled')
      .filter({ hasText: /Delete chat|Удалить|Delete/i })
      .first();
    try {
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      throw new Error('Модалка подтверждения не появилась (кнопка .ds-button--error)');
    }

    // 5. Ставим ожидание ответа сервера ДО клика
    const responsePromise = this.page.waitForResponse(
      (resp) => {
        if (resp.request().method() !== 'POST') return false;
        if (!resp.url().includes('/api/v0/chat_session/delete')) return false;
        const postData = resp.request().postData() || '';
        return postData.includes(id);
      },
      { timeout: 15000 }
    );

    // 6. Клик по подтверждению
    await confirmButton.click({ force: true });

    // 7. Ждём ответ сервера
    let response;
    try {
      response = await responsePromise;
    } catch (e) {
      throw new Error(
        `Сервер не ответил на /chat_session/delete за 15с: ${(e as Error).message}`
      );
    }

    const status = response.status();
    if (status !== 200) {
      throw new Error(`Сервер вернул HTTP ${status} на удаление`);
    }

    // 8. Проверяем тело ответа
    let json: any = null;
    try {
      json = await response.json();
    } catch (e) {
      console.warn(
        `[DeepSeek] Не удалось распарсить JSON ответа (status=${status}):`,
        (e as Error).message
      );
    }

    if (json && typeof json.code === 'number' && json.code !== 0) {
      throw new Error(
        `Сервер вернул code=${json.code}: ${json.msg || 'без сообщения'}`
      );
    }

    console.log(
      `[DeepSeek] ✅ Диалог ${id} удалён (сервер подтвердил: code=${json?.code ?? '?'})`
    );
  }

  /**
   * Загружает содержимое одного file-чипа из PW.
   *
   * Шаги:
   *  1) openConversation, если нужно
   *  2) прогрев списка (top→bottom→top) — чтобы целевое сообщение было в DOM
   *  3) клик по чипу по data-virtual-list-item-key (numeric) ИЛИ по chipName
   *  4) ждём появления панели ._26c5bc2
   *  5) ждём загрузки содержимого .abbe3c45 (PoW ~20-30с, до 60с)
   *  6) читаем title (heading), text (content)
   *  7) file_id из URL files.deepseeksvc.com/api/file?file_id=...
   *  8) закрываем панель
   *
   * Возвращает { name, content, fileId }. null — только если ничего не загрузилось
   * (тогда бросаем — чтобы IPC вернул error, а не тихий null).
   */
  async fetchFileContent(
    convId: string,
    pwKeyOrNull: string | null,
    chipName: string,
    chipIndex: number
  ): Promise<{
    name: string;
    content: string;
    fileId: string;
  }> {
    if (!this.page) throw new Error('Браузер не запущен');

    // 1) Открыть диалог, если не текущий
    const currentUrl = this.page.url();
    if (!currentUrl.includes(convId)) {
      await this.openConversation(convId);
    }

    await this.page.waitForSelector(
      'div.ds-virtual-list.ds-virtual-list--printable',
      { timeout: 10000 }
    );

    // 2) Прогрев списка — чтобы сообщение попало в DOM
    await this.page.evaluate(async () => {
      const c = document.querySelector(
        'div.ds-virtual-list.ds-virtual-list--printable'
      ) as HTMLElement | null;
      if (!c) return;
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 900));
      c.scrollTop = c.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
      c.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 500));
    });

    // 3) Хук на сетевой запрос — file_id в URL
    const capturedUrls: string[] = [];
    const onResponse = (resp: any) => {
      const url = resp.url();
      if (url.includes('files.deepseeksvc.com') && url.includes('/api/file')) {
        capturedUrls.push(url);
      }
    };
    this.page.on('response', onResponse);

    try {
      // 4) Клик по чипу
      const numeric =
        pwKeyOrNull && /^\d+$/.test(pwKeyOrNull) ? pwKeyOrNull : null;
      let clicked = false;

      if (numeric) {
        try {
          const chipLocator = this.page
            .locator(
              `div[data-virtual-list-item-key="${numeric}"] .eafda4ae ._25c7358`
            )
            .nth(chipIndex);
          await chipLocator.scrollIntoViewIfNeeded({ timeout: 3000 });
          await chipLocator.click({ force: true, timeout: 5000 });
          clicked = true;
        } catch (e) {
          console.warn(
            '[fetchFileContent] locator.click не удался:',
            (e as Error).message
          );
        }
      }

      if (!clicked) {
        const r = await this.page.evaluate(
          ({
            numeric,
            chipName,
            chipIndex,
          }: {
            numeric: string | null;
            chipName: string;
            chipIndex: number;
          }) => {
            const container = document.querySelector(
              'div.ds-virtual-list.ds-virtual-list--printable'
            );
            if (!container) return { ok: false, error: 'no container' };

            let msgEl: HTMLElement | null = null;
            if (numeric) {
              msgEl = container.querySelector(
                `div[data-virtual-list-item-key="${numeric}"]`
              ) as HTMLElement | null;
            }
            if (!msgEl && chipName) {
              const items = Array.from(
                container.querySelectorAll('div[data-virtual-list-item-key]')
              );
              for (const item of items) {
                const chips = Array.from(
                  item.querySelectorAll('.eafda4ae ._25c7358')
                );
                for (const chip of chips) {
                  const nameEl = chip.querySelector('.e70accd6');
                  if (nameEl?.textContent?.trim() === chipName) {
                    msgEl = item as HTMLElement;
                    break;
                  }
                }
                if (msgEl) break;
              }
            }
            if (!msgEl) return { ok: false, error: 'message not found' };
            const chipList = msgEl.querySelectorAll('.eafda4ae ._25c7358');
            const chip = chipList[chipIndex] as HTMLElement | undefined;
            if (!chip)
              return { ok: false, error: `chip #${chipIndex} missing` };
            chip.scrollIntoView({ block: 'center' });
            chip.click();
            return { ok: true };
          },
          { numeric, chipName, chipIndex }
        );
        if (!r.ok) {
          throw new Error(`click failed: ${r.error}`);
        }
      }

      // 5) Ждём панель
      let panelFound = false;
      try {
        await this.page.waitForSelector('._26c5bc2', {
          state: 'visible',
          timeout: 5000,
        });
        panelFound = true;
      } catch {
        /* ignore */
      }
      if (!panelFound) {
        throw new Error('panel not found (timeout 5s)');
      }

      // 6) Ждём содержимое (PoW до 60с)
      let content = '';
      let name = '';
      const start = Date.now();
      const waitMs = 60000;
      while (Date.now() - start < waitMs) {
        const r = await this.page.evaluate(() => {
          const panel = document.querySelector('._26c5bc2');
          if (!panel) return null;
          const header = panel.querySelector('._2c74d7a');
          const title =
            header?.querySelector('[role="heading"]')?.textContent?.trim() ||
            '';
          const contentEl = panel.querySelector(
            '.abbe3c45'
          ) as HTMLElement | null;
          const text = contentEl?.textContent || '';
          return { title, text };
        });
        if (r && r.text.length > 50) {
          content = r.text;
          name = r.title;
          break;
        }
        await this.page.waitForTimeout(300);
      }

      // 7) Закрываем панель
      try {
        await this.page.evaluate(() => {
          const btn = document.querySelector(
            '._26c5bc2 ._5d271a3'
          ) as HTMLElement | null;
          if (btn) btn.click();
        });
        await this.page.waitForTimeout(300);
      } catch {
        /* ignore */
      }

      if (!content) {
        throw new Error(
          `content not loaded (waited ${Date.now() - start}ms, networkHits=${
            capturedUrls.length
          })`
        );
      }

      // 8) file_id из URL
      let fileId = '';
      if (capturedUrls.length > 0) {
        const m = capturedUrls[0].match(/[?&]file_id=([a-f0-9-]+)/i);
        if (m) fileId = m[1];
      }

      console.log(
        '[DeepSeek] fetchFileContent OK:',
        JSON.stringify({
          name,
          contentLen: content.length,
          fileId,
          waitMs: Date.now() - start,
        })
      );

      return { name, content, fileId };
    } finally {
      this.page.off('response', onResponse);
    }
  }
}


