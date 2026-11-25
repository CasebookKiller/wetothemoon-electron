// src/main/services/gateway/providers/deepseek/adapter.ts

import type { BrowserContext, Page } from 'playwright-core';
import type {
  ProviderAdapter,
  ProviderSelectors,
  CookiePattern,
  MessageChunk,
  Conversation,
  SendMessageOpts,
} from '../types';

const SELECTORS: ProviderSelectors = {
  input: 'textarea[placeholder*="Сообщение"], textarea[placeholder*="Message"]',
  send: 'div.ds-button--primary.ds-button--filled, div._52c986b',
  response: '.ds-markdown', // контейнер ответа (внутри data-virtual-list-item-key)
  streaming: 'div.e1675d8b.ds-think-content', // индикатор reasoning
  newChat: 'a[href="/"]',
};

export class DeepSeekAdapter implements ProviderAdapter {
  readonly name = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly baseUrl = 'https://chat.deepseek.com';
  readonly requiresAuth = true;
  readonly selectors = SELECTORS;
  readonly cookiePatterns: CookiePattern[] = [];

  async connect(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return page;
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector(this.selectors.input, { timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  async *sendMessage(
    page: Page,
    message: string,
    opts?: SendMessageOpts,
  ): AsyncIterable<MessageChunk> {
    const timeoutMs = opts?.timeoutMs ?? 180_000; // DS думает дольше
    const signal = opts?.signal;
    const t0 = Date.now();

    // 1. Ввод и отправка
    const ta = await page.waitForSelector(this.selectors.input, { state: 'visible', timeout: 10_000 });
    await ta.fill(message);
    await page.waitForTimeout(300); // ждём активации кнопки

    let sent = false;
    try {
      const sendBtn = await page.$(this.selectors.send);
      if (sendBtn) {
        await sendBtn.click();
        sent = true;
      }
    } catch { /* ignore */ }

    if (!sent) {
      await ta.focus();
      await page.keyboard.press('Enter');
    }

    // Ждём очистки textarea (признак того, что сообщение ушло)
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel) as HTMLTextAreaElement;
        return !el || el.value.length === 0;
      },
      this.selectors.input,
      { timeout: 5_000 }
    ).catch(() => {});

    // 2. Ожидание появления нового ответа (контейнера)
    // Ищем последний элемент data-virtual-list-item-key, внутри которого есть .ds-markdown
    const getLastHtml = async () => {
      return await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div[data-virtual-list-item-key]'));
        if (items.length === 0) return '';
        const lastItem = items[items.length - 1];
        const md = lastItem.querySelector('.ds-markdown') as HTMLElement | null;
        return md ? md.innerHTML : '';
      });
    };

    let lastHtml = '';
    let started = false;
    let stableTicks = 0;

    // 3. Цикл поллинга (стрим)
    while (Date.now() - t0 < timeoutMs) {
      if (signal?.aborted) { yield { type: 'error', text: 'aborted' }; return; }
      await page.waitForTimeout(300);

      const currentHtml = await getLastHtml();

      if (!started && currentHtml.length > 0) {
        started = true;
      }

      if (!started) continue;

      if (currentHtml === lastHtml) {
        if (lastHtml.length > 0) {
          stableTicks++;
          if (stableTicks >= 10) { // 3 секунды стабильности
            yield { type: 'done' };
            return;
          }
        }
        continue;
      }

      // HTML изменился — сбрасываем стабильность и отправляем чанк
      stableTicks = 0;
      
      // Извлекаем "reasoning" (размышления), если они есть
      const reasoningText = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div[data-virtual-list-item-key]'));
        const lastItem = items[items.length - 1];
        const think = lastItem?.querySelector('div.e1675d8b.ds-think-content') as HTMLElement | null;
        return think ? think.textContent || '' : '';
      });

      if (reasoningText && reasoningText !== lastHtml) {
         // В будущем UI сможет отрисовывать reasoning.
         // yield { type: 'reasoning', text: reasoningText };
      }

      yield { type: 'text', text: currentHtml, format: 'html', reset: true };
      lastHtml = currentHtml;
    }

    yield { type: 'error', text: 'timeout' };
  }

  async getConversations(page: Page): Promise<Conversation[]> {
    // Селекторы портированы из legacy DeepSeekService.getConversations()
    // (deepseekService.ts:2194). Проверены работоспособностью /chat_session/delete.
    const rows = await page.evaluate(() => {
      const result: { id: string; title: string; group?: string }[] = [];
      const groupContainers = document.querySelectorAll('._3098d02');

      if (groupContainers.length > 0) {
        groupContainers.forEach((container) => {
          const headerEl = container.querySelector('.f3d18f6a');
          let groupName = 'Все диалоги';
          if (headerEl) {
            const titleSpan = headerEl.querySelector('span');
            groupName = titleSpan ? titleSpan.textContent?.trim() || '' : headerEl.textContent?.trim() || '';
          }
          container.querySelectorAll('a._546d736').forEach((link) => {
            const href = link.getAttribute('href') || '';
            const title = link.querySelector('.c08e6e93')?.textContent?.trim() || '';
            const id = href.split('/').pop() || '';
            if (title && id) result.push({ id, title, group: groupName });
          });
        });
      } else {
        document.querySelectorAll('a._546d736').forEach((link) => {
          const href = link.getAttribute('href') || '';
          const title = link.querySelector('.c08e6e93')?.textContent?.trim() || '';
          const id = href.split('/').pop() || '';
          if (title && id) result.push({ id, title });
        });
      }
      return result;
    });

    return rows.map((r, i) => ({
      id: r.id,
      title: r.title,
      group: r.group,
      pinned: false,   // у DS нет избранного (в отличие от GigaChat)
      position: i,     // insertion order = DOM order
    }));
  }
}