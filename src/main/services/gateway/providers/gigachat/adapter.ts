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
    let lastHtml = '';
    let stableTicks = 0;
    let started = false;
    // Промежуточное «Думаю над ответом» — GigaChat's thinking indicator.
    // Не эмитим его как text; отдельный класс в response не нужен, т.к.
    // этот текст жил в ДРУГОМ элементе и в final DOM исчез.
    // Расширенный список: GigaChat в разных режимах показывает разные статусы.
    // Не эмитим их как текст и не считаем «финальными».
    const THINKING_PREFIXES = [
      'Думаю над ответом', 'Думаю…', 'Thinking',
      'Ищу информацию', 'Поиск', 'Searching', 'Looking',
      'Анализирую', 'Готовлю ответ',
    ];

    while (Date.now() - t0 < timeoutMs) {
      if (signal?.aborted) { yield { type: 'error', text: 'aborted' }; return; }
      await page.waitForTimeout(300);

      const snap = await page.evaluate((sel) => {
        const els = [...document.querySelectorAll(sel)];
        const last = els[els.length - 1];
        const mdRoot = last?.querySelector('[class*="MarkdownRoot"]') as HTMLElement | null;
        return {
          count: els.length,
          // textContent — для stability-check и thinking-detection (быстро, без HTML-парсинга)
          text: last ? (last.textContent || '') : '',
          // innerHTML MarkdownRoot — готовый HTML от GigaChat, то что нужно отрендерить в UI.
          // Пустая строка, если MarkdownRoot не найден — тогда fallback на text.
          html: mdRoot ? (mdRoot.innerHTML || '') : '',
        };
      }, this.selectors.response);

      if (!started && snap.count <= beforeCount) continue;
      started = true;

      if (snap.text === lastText) {
        if (lastText) {
          // Не считаем «стабильность», если текст похож на статус-заглушку:
          // иначе premature done, пока GigaChat ещё «думает/ищет».
          const stillThinking = THINKING_PREFIXES.some((p) =>
            lastText.trimStart().startsWith(p),
          );
          if (!stillThinking) {
            stableTicks++;
            if (stableTicks >= 10) {         // 10 × 300ms = 3s стабильно → done
              yield { type: 'done' };
              return;
            }
          }
        }
        continue;
      }

      // snapshot изменился
      stableTicks = 0;
      const nextText = snap.text;
      const nextHtml = snap.html;
      const thinking = THINKING_PREFIXES.some((p) => nextText.trimStart().startsWith(p));

      if (thinking) {
        // GigaChat ещё думает/ищет; MarkdownRoot может содержать временный статус
        lastText = nextText;
        lastHtml = nextHtml;
        continue;
      }

      // HTML при стриме перерисовывается целиком → всегда reset, UI заменяет буфер.
      // LCP-diff для HTML не работает (innerHTML не монотонен из-за растущих тегов).
      if (nextHtml && nextHtml !== lastHtml) {
        yield { type: 'text', text: nextHtml, format: 'html', reset: true };
      } else if (!nextHtml && nextText !== lastText) {
        // Fallback: MarkdownRoot не найден (например, простой ответ без разметки)
        // → отдаём plain text, как раньше.
        yield { type: 'text', text: nextText, reset: true };
      }
      lastText = nextText;
      lastHtml = nextHtml;
    }
    yield { type: 'error', text: 'timeout' };
  }

  async getConversations(page: Page): Promise<Conversation[]> {
    try {
      // ── Фаза 1: раскрыть ВСЕ свёрнутые секции (Избранные, Архив) ────────
      // В GigaChat «Архив» по умолчанию свёрнут — без клика adapter видит
      // только Recent. Кликаем все collapsed toggle'ы с aria-expanded="false".
      await page.evaluate(async () => {
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        for (let round = 0; round < 5; round++) {
          const collapsed = Array.from(
            document.querySelectorAll('[data-da_name*="Toggle"][aria-expanded="false"]'),
          ) as HTMLElement[];
          if (collapsed.length === 0) break;
          for (const b of collapsed) {
            try { b.click(); } catch { /* ignore */ }
            await wait(300);
          }
        }
      });

      // ── Фаза 1b: докликать «Показать ещё» до стабилизации ───────────────
      // GigaChat выдаёт по +2 за клик, кнопка появляется снова после подгрузки.
      await page.evaluate(async () => {
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const cnt = () => document.querySelectorAll('a[data-da_name="SessionListItem"]').length;

        let lastCount = cnt();
        let stableRounds = 0;
        for (let i = 0; i < 30 && stableRounds < 3; i++) {
          const btns = Array.from(
            document.querySelectorAll('[data-da_name*="ShowMore"]'),
          ) as HTMLElement[];
          const clickable = btns.filter((b) => b.offsetParent !== null);
          if (clickable.length === 0) {
            // кнопок нет — дадим GigaChat ещё шанс (ленивая загрузка)
            await wait(300);
          } else {
            for (const b of clickable) {
              try { b.click(); } catch { /* ignore */ }
            }
            await wait(500); // ждём сетевой lazy-load
          }
          const now = cnt();
          if (now === lastCount) stableRounds++;
          else { stableRounds = 0; lastCount = now; }
        }
      });

      // ── Фаза 2+4: скролл СО СБОРОМ (не в конце!) ────────────────────────
      // Ключевое: GigaChat виртуализирует сайдбар — верхние строки размонтируются
      // при скролле вниз. Если собирать в конце, favorites уже не в DOM → pinned=0.
      // Решение: accumulate в Map по мере прохода сверху вниз.
      const result = await page.evaluate(async () => {
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const section = document.querySelector('section[aria-label="История чатов"]') as HTMLElement | null;
        if (!section) return [];

        // Найти реальный скроллер
        let scroller: HTMLElement | null = section;
        while (scroller && scroller !== document.body) {
          if (scroller.scrollHeight > scroller.clientHeight + 10) break;
          scroller = scroller.parentElement;
        }
        if (!scroller) scroller = section;

        type Conv = { id: string; title: string; url: string; pinned: boolean; position: number };
        const collected = new Map<string, Conv>();

        const collectVisible = () => {
          const links = document.querySelectorAll(
            'a[data-da_name="SessionListItem"]',
          ) as NodeListOf<HTMLAnchorElement>;
          for (const el of links) {
            const href = el.getAttribute('href') || '';
            const id = el.getAttribute('data-da_session_id') || href.replace('/sessions/', '');
            if (!id || collected.has(id)) continue;
            const titleEl = el.querySelector('[class*="ChatRow-styled__Title"]');
            const title = titleEl?.textContent?.trim() || 'Без названия';
            const row =
              el.closest('[class*="ChatRow-styled__Row-sc-"]') ?? el.parentElement;
            const favEl = row?.querySelector('[data-da_favorite]');
            const pinned = favEl?.getAttribute('data-da_favorite') === 'true';
            collected.set(id, {
              id,
              title,
              url: href.startsWith('http') ? href : `https://giga.chat${href}`,
              pinned,
              position: collected.size, // insertion order = DOM order = порядок GigaChat
            });
          }
        };

        // Сначала — сбор верхних строк (favorites здесь!)
        console.log('[collect] initial scrollTop:', scroller.scrollTop,
                    'scrollHeight:', scroller.scrollHeight);
        scroller.scrollTop = 0;
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        await wait(400); // было 200 — увеличили, чтобы favorites успели смонтироваться
        collectVisible();
        console.log('[collect] after top: collected', collected.size,
                    'pinned:', Array.from(collected.values()).filter(c => c.pinned).length);

        // Скроллим по шагам, собирая на каждой позиции
        const step = Math.max(120, Math.floor(scroller.clientHeight * 0.6));
        let lastCount = collected.size;
        let stableRounds = 0;
        let iterations = 0;

        while (iterations < 100 && stableRounds < 8) {
          const scrollH = scroller.scrollHeight;
          for (let y = 0; y <= scrollH; y += step) {
            scroller.scrollTop = y;
            scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
            await wait(100);
            collectVisible();
            iterations++;
            if (iterations > 100) break;
          }
          scroller.scrollTop = scroller.scrollHeight;
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          await wait(400);
          collectVisible();

          // Пробуем ShowMore снова — может появиться после подгрузки
          const sm = Array.from(
            document.querySelectorAll('[data-da_name*="ShowMore"]'),
          ).filter((b) => (b as HTMLElement).offsetParent !== null) as HTMLElement[];
          for (const b of sm) { try { b.click(); } catch { /* ignore */ } }
          if (sm.length > 0) await wait(400);

          if (collected.size === lastCount) stableRounds++;
          else { stableRounds = 0; lastCount = collected.size; }
        }

        console.log('[collect] final collected:', collected.size,
                    'pinned:', Array.from(collected.values()).filter(c => c.pinned).length);

        return Array.from(collected.values());
      });

      const favCount = result.filter((c) => c.pinned).length;
      console.log(`[GigaChatAdapter:getConversations] found ${result.length} conversations (${favCount} favorites)`);
      // Диагностика 260-vs-220: сколько legacy, сколько synced
      console.log('[collect] final detail:', {
        total: result.length,
        favorites: favCount,
        pinnedPositions: result.filter((c) => c.pinned).map((c) => c.position).slice(0, 5),
        recentPositions: result.filter((c) => !c.pinned).map((c) => c.position).slice(0, 5),
        lastPosition: result.length > 0 ? result[result.length - 1].position : null,
      });
      // Диагностика: первые 3 элемента — что нашли по pinned
      console.log('[GigaChatAdapter:getConversations] sample:', result.slice(0, 3).map((c) => ({
        id: c.id.slice(0, 8),
        title: c.title.slice(0, 20),
        pinned: c.pinned,
      })));
      return result;
    } catch (e) {
      console.error('[GigaChatAdapter:getConversations] failed:', e);
      return [];
    }
  }

  /**
   * Парсит сообщения ТЕКУЩЕГО открытого диалога.
   * Используется для синхронизации истории (sync-messages).
   */
  async getCurrentMessages(page: Page): Promise<Array<{ id: string; role: 'user' | 'assistant'; contentHtml: string; contentPlain: string }>> {
    try {
      return await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('[data-message-id]'));
        const result: Array<{ id: string; role: 'user' | 'assistant'; contentHtml: string; contentPlain: string }> = [];

        for (const node of nodes) {
          const id = node.getAttribute('data-message-id');
          if (!id) continue;

          const isUser = node.className.includes('MessageItem-styled__UserRow');
          const isAssistant = node.className.includes('MessageItem-styled__AssistantRow');
          if (!isUser && !isAssistant) continue;

          // Контент всегда внутри MarkdownRoot-styled__MarkdownRoot
          const mdRoot = node.querySelector('[class*="MarkdownRoot-styled__MarkdownRoot"]') as HTMLElement | null;
          if (!mdRoot) continue;

          result.push({
            id,
            role: isUser ? 'user' : 'assistant',
            contentHtml: mdRoot.innerHTML || '',
            contentPlain: mdRoot.textContent || '',
          });
        }
        return result;
      });
    } catch {
      return [];
    }
  }
}
