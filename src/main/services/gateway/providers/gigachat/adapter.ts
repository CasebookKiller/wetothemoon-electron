// src/main/services/gateway/providers/gigachat/adapter.ts

/**
 * GigaChatAdapter — browser-провайдер для giga.chat (Sber).
 *
 * Recon 2026-11-21:
 *   input:     #chat-input-textarea (aria-label="Сообщение")
 *   send:      button[aria-label="Отправить"] — появляется ПОСЛЕ fill, type="submit" в <form>
 *   user:      [class*="MessageItem-styled__UserBubble"]
 *   assistant: [class*="MessageItem-styled__AssistantContent"] — рендерится постепенно (стрим)
 *   Enter:     работает как отправка, textarea сбрасывается
 *   auth:      без SberID → app-boot-error; с сессией → textarea есть
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

const SELECTORS: ProviderSelectors = {
  input: '#chat-input-textarea',
  send: 'button[aria-label="Отправить"]',
  response: '[class*="MessageItem-styled__AssistantContent"]',
  streaming: '[class*="MessageItem-styled__AssistantContent"]',
  newChat: 'button[aria-label="Новый чат"]',
};

const COOKIE_PATTERNS: CookiePattern[] = [
  { name: '_sm_sess',       purpose: 'session',     severity: 'critical', note: 'GigaChat session' },
  { name: '_sm_user_id',    purpose: 'auth',        severity: 'critical' },
  { name: '_sd_user_id',    purpose: 'auth',        severity: 'warning' },
  { name: 'aws-waf-token',  purpose: 'fingerprint', severity: 'warning',  note: 'AWS WAF' },
];

export class GigaChatAdapter implements ProviderAdapter {
  readonly name = 'gigachat';
  readonly displayName = 'GigaChat';
  readonly baseUrl = 'https://giga.chat';
  readonly requiresAuth = true;
  readonly selectors = SELECTORS;
  readonly cookiePatterns = COOKIE_PATTERNS;

  async connect(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector(this.selectors.input, { timeout: 20_000 });
    return page;
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    if (/login|auth|sberbank|sber-id|sber-id\.ru/i.test(page.url())) return false;
    try {
      await page.waitForSelector(this.selectors.input, { timeout: 5_000 });
      // authGateRoot присутствует всегда; textarea — только в авторизованном режиме
      const gate = await page.$('[data-testid="authGateRoot"]');
      const ta = await page.$(this.selectors.input);
      return !!ta && !gate;
    } catch {
      return false;
    }
  }

  async *sendMessage(
    page: Page,
    message: string,
    opts?: SendMessageOpts,
  ): AsyncIterable<MessageChunk> {
    const timeoutMs = opts?.timeoutMs ?? 120_000;
    const signal = opts?.signal;
    const t0 = Date.now();

    const beforeCount = await page.$$eval(this.selectors.response, (els) => els.length);

    await page.fill(this.selectors.input, message);

    // send-кнопка рендерится после появления текста (до 3 сек)
    try {
      await page.waitForSelector(this.selectors.send, { timeout: 3_000, state: 'visible' });
      await page.click(this.selectors.send);
    } catch {
      await page.focus(this.selectors.input);
      await page.press(this.selectors.input, 'Enter');
    }

    // LCP-diff: если префикс изменился — DOM перерисован, шлём reset.
    // Иначе — обычная дельта (append).
    const diff = (prev: string, next: string) => {
      let i = 0;
      while (i < prev.length && i < next.length && prev[i] === next[i]) i++;
      return { removed: prev.length - i, added: next.slice(i) };
    };

    let lastText = '';
    let stableTicks = 0;
    let started = false;
    // Промежуточное «Думаю над ответом» — GigaChat's thinking indicator.
    // Не эмитим его как text; отдельный класс в response не нужен, т.к.
    // этот текст жил в ДРУГОМ элементе и в final DOM исчез.
    const THINKING_PREFIXES = ['Думаю над ответом', 'Думаю…', 'Thinking'];

    while (Date.now() - t0 < timeoutMs) {
      if (signal?.aborted) { yield { type: 'error', text: 'aborted' }; return; }
      await page.waitForTimeout(300);

      const snap = await page.evaluate((sel) => {
        const els = [...document.querySelectorAll(sel)];
        const last = els[els.length - 1];
        return { count: els.length, text: last ? (last.textContent || '') : '' };
      }, this.selectors.response);

      if (!started && snap.count <= beforeCount) continue;
      started = true;

      if (snap.text === lastText) {
        if (lastText) {
          stableTicks++;
          if (stableTicks >= 10) {           // 10 × 300ms = 3s стабильно → done
            yield { type: 'done' };
            return;
          }
        }
        continue;
      }

      // snapshot изменился
      stableTicks = 0;
      const next = snap.text;
      const thinking = THINKING_PREFIXES.some((p) => next.trimStart().startsWith(p));

      if (thinking) {
        // GigaChat ещё думает; AssistantContent временно содержит "Думаю над ответом"
        lastText = next;
        continue;
      }

      if (lastText && next.startsWith(lastText)) {
        const { added } = diff(lastText, next);
        if (added) yield { type: 'text', text: added };
      } else {
        // DOM заменён целиком — сброс буфера
        yield { type: 'text', text: next, reset: true };
      }
      lastText = next;
    }
    yield { type: 'error', text: 'timeout' };
  }

  async getConversations(page: Page): Promise<Conversation[]> {
    try {
      return await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href^="/sessions/"]')) as HTMLAnchorElement[];
        return links.map((el) => {
          const href = el.getAttribute('href') || '';
          const id = el.getAttribute('data-da_session_id') || href.replace('/sessions/', '');
          const title = el.textContent?.trim() || 'Без названия';
          return {
            id,
            title,
            url: `https://giga.chat${href}`,
          };
        });
      });
    } catch {
      return [];
    }
  }
}
