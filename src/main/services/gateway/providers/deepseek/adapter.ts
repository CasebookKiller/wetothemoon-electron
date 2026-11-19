/**
 * DeepSeekAdapter — обёртка над web-каналом DeepSeek через ProviderAdapter.
 *
 * ВАЖНО: DeepSeekService — stateful singleton с одним this.page.
 * Для multi-context (BrowserPool) нужен адаптер, работающий с page снаружи.
 *
 * Статус: connect() и getConversations() — TODO (селекторы из SelectorProfileService).
 * sendMessage() — TODO (полная реализация после recon, когда будут реальные селекторы).
 *
 * Пока — регистрация в registry работает, BrowserPool.acquire() работает.
 * Это разблокирует recon других провайдеров (GigaChat, Алиса, Duck.ai) —
 * их адаптеры будут по тому же интерфейсу.
 */

import type { BrowserContext, Page } from 'playwright-core';
import type {
  ProviderAdapter,
  ProviderSelectors,
  CookiePattern,
  MessageChunk,
  Conversation,
  SendMessageOpts,
} from '../types';

export class DeepSeekAdapter implements ProviderAdapter {
  readonly name = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly baseUrl = 'https://chat.deepseek.com';
  readonly requiresAuth = true;

  readonly selectors: ProviderSelectors = {
    // TODO(deepseek-recon): взять из SelectorProfileService
    // grep -n "assistantMessageSelector\|input\|send" src/main/services/gateway/deepseekService.ts
    input: 'textarea[placeholder*="Send"]',
    send: 'button[type="submit"]',
    response: '[data-message-author-role="assistant"]',
    streaming: '[data-streaming="true"]',
    newChat: 'a[href="/"]',
    conversationsList: 'nav a[href^="/a/chat"]',
  };

  readonly cookiePatterns: CookiePattern[] = [
    // TODO(cookieTracker): взять из cookieTracker.ts
    // grep -n "name:\|Cookie" src/main/services/gateway/cookieTracker.ts
    { name: 'ds_session_id', purpose: 'session', severity: 'critical', note: 'DeepSeek session' },
    { name: /^_ga/, purpose: 'analytics', severity: 'warning', note: 'Google Analytics' },
    { name: /^_gid/, purpose: 'analytics', severity: 'warning', note: 'Google Analytics' },
  ];

  async connect(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // TODO(deepseek-recon): ждать именно поле ввода
    await page.waitForSelector(this.selectors.input, { timeout: 15_000 });
    return page;
  }

  async *sendMessage(
    _page: Page,
    _message: string,
    _opts?: SendMessageOpts,
  ): AsyncIterable<MessageChunk> {
    // TODO(deepseek-recon): реализовать через SelectorProfileService.
    // Пока — заглушка. BrowserPool + registry работают, но sendMessage не готов.
    yield {
      type: 'error',
      text: 'DeepSeekAdapter.sendMessage — not implemented. ' +
            'Планируется после recon: взять селекторы из SelectorProfileService, ' +
            'ждать assistantMessageSelector, отдавать чанки по мере стрима.',
    };
  }

  async getConversations(_page: Page): Promise<Conversation[]> {
    // TODO(deepseek-recon): использовать selectors.conversationsList
    return [];
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    // TODO(deepseek-recon): проверить наличие поля ввода (если есть — залогинен)
    try {
      await page.waitForSelector(this.selectors.input, { timeout: 3_000 });
      return true;
    } catch {
      return false;
    }
  }
}