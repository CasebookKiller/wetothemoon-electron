// src/main/services/osint/scrapers/kadArbitr/search.ts

import { Page } from 'playwright';
import type {
  KadArbitrCase,
  KadArbitrData,
  KadArbitrSearchOptions,
  KadArbitrSearchPayload,
} from './types';
import { saveAllKadCookies } from './login';


const KAD_HOME = 'https://kad.arbitr.ru/';
const DEFAULT_PAGE_SIZE = 25;
const RATE_DELAY_MS = 3000;
const MAX_RETRIES_ON_CAPTCHA = 2;

/**
 * Поиск дел по ИНН через UI-клик.
 *
 * Логика:
 * 1. Открываем главную kad.arbitr.
 * 2. Заполняем поле «Участник дела» + выбираем роль.
 * 3. Кликаем «Найти».
 * 4. Ждём результатов (или капчи, или «нет результатов»).
 * 5. Парсим HTML таблицы.
 * 6. Пагинация — клик по номерам страниц.
 */
export async function searchCases(
  page: Page,
  inn: string,
  options: KadArbitrSearchOptions = {}
): Promise<KadArbitrData> {
  const maxPages = options.maxPages ?? 5;
  const maxTotalCases = options.maxTotalCases ?? 500;
  const roles = options.roles && options.roles.length > 0 ? options.roles : ['any'];
  const primaryRole = roles[0];

  const allCases: KadArbitrCase[] = [];
  let totalFound = 0;
  let pagesCount = 1;

  // 1. Первая страница — через клик по кнопке «Найти»
  const firstPageResult = await submitSearchUI(page, inn, primaryRole);

  if (firstPageResult.empty) {
    return buildResult(inn, options, primaryRole, [], 0, 1);
  }

  totalFound = firstPageResult.meta.totalCount;
  pagesCount = firstPageResult.meta.pagesCount;

  for (const c of firstPageResult.cases) {
    if (allCases.length >= maxTotalCases) break;
    allCases.push(c);
  }

  // 2. Остальные страницы — через клик по номерам страниц
  for (let pageNum = 2; pageNum <= Math.min(maxPages, pagesCount); pageNum++) {
    if (allCases.length >= maxTotalCases) break;

    console.log(`[kad-search] Пауза ${RATE_DELAY_MS}мс перед страницей ${pageNum}...`);
    await new Promise((r) => setTimeout(r, RATE_DELAY_MS));

    try {
      const pageResult = await navigateToPage(page, pageNum);
      if (!pageResult || pageResult.cases.length === 0) break;

      for (const c of pageResult.cases) {
        if (allCases.length >= maxTotalCases) break;
        allCases.push(c);
      }
    } catch (e) {
      console.warn(`[kad-search] Ошибка на странице ${pageNum}:`, (e as Error).message);
      break;
    }
  }

  try {
    await saveAllKadCookies(page);
  } catch (e) {
    console.warn('[kad-search] Не удалось сохранить cookies:', (e as Error).message);
  }

  return buildResult(inn, options, primaryRole, allCases, totalFound, pagesCount);
}

function buildResult(
  inn: string,
  options: KadArbitrSearchOptions,
  primaryRole: string,
  cases: KadArbitrCase[],
  totalFound: number,
  pagesCount: number
): KadArbitrData {
  return {
    entity_inn: inn,
    collected_at: new Date().toISOString(),
    source_url: `https://kad.arbitr.ru/?inn=${inn}`,
    search_params: {
      date_from: options.dateFrom ?? null,
      date_to: options.dateTo ?? null,
      roles: [primaryRole],
    },
    totals: {
      cases_found: totalFound,
      cases_collected: cases.length,
      pages_count: pagesCount,
    },
    cases,
  };
}

function roleToType(role: string): number {
  switch (role) {
    case 'plaintiff':   return 0;
    case 'defendant':   return 1;
    case 'third_party': return 2;
    case 'any':
    default:            return -1;
  }
}

interface PageMeta {
  totalCount: number;
  pagesCount: number;
  page: number;
  pageSize: number;
}

interface PageResult {
  cases: KadArbitrCase[];
  meta: PageMeta;
  empty?: boolean;
}

/**
 * Заполняет форму, кликает «Найти», ждёт результат, парсит.
 */
async function submitSearchUI(
  page: Page,
  inn: string,
  primaryRole: string
): Promise<PageResult> {
  // 1. Открываем главную
  await page.goto(KAD_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Удаляем rcid перед кликом, чтобы chain Pravocaptcha пошёл через
  // checkIsNeedShow (сервер сам решит, нужна ли капча). Без этого
  // цепочка идёт через ветку "rcid уже есть" и POST уходит без токена → 403.
  try {
    const cookies = await page.context().cookies('https://kad.arbitr.ru');
    const filtered = cookies.filter((c) => c.name !== 'rcid');
    await page.context().clearCookies({ name: 'rcid', domain: '.kad.arbitr.ru' }).catch(() => {});
    await page.context().clearCookies({ name: 'rcid', domain: 'kad.arbitr.ru' }).catch(() => {});
    console.log('[kad-search] rcid удалён перед кликом');
  } catch (e) {
    console.warn('[kad-search] Не удалось удалить rcid:', (e as Error).message);
  }
  
  // 2. Перехватываем Pravocaptcha ДО клика.
  // WASM-модуль в Playwright-Chromium падает с RuntimeError, из-за чего
  // промис внутри Pravocaptcha зависает и POST не отправляется.
  // Подменяем executePravocaptcha заглушкой — callback зовётся сразу,
  // POST уходит без RecaptchaToken (kad.arbitr это допускает).
  /*await page.evaluate(() => {
    const w = window as any;

    const override = () => {
      // Основной путь: Common.executePravocaptcha
      if (w.Common && typeof w.Common.executePravocaptcha === 'function') {
        w.Common.executePravocaptcha = function (callback: any) {
          console.log('[FIX] Common.executePravocaptcha → callback(null)');
          if (typeof callback === 'function') callback(null);
        };
      }

      // Дублирующий — сам объект Pravocaptcha
      if (w.pravocaptcha && typeof w.pravocaptcha.execute === 'function') {
        w.pravocaptcha.execute = function (callback: any) {
          console.log('[FIX] Pravocaptcha.execute → callback(null)');
          if (typeof callback === 'function') callback(null);
        };
      }
    };

    override();
    // На случай, если объекты ещё не созданы — повторим через таймер
    setTimeout(override, 1000);
    setTimeout(override, 3000);
  });

  console.log('[kad-search] Pravocaptcha перехвачена, будет вызвана без WASM');*/

  // === СНИФФЕР СЕТИ ===
  // Перехватываем XHR и fetch, чтобы увидеть реальные запросы и ответы.
  // Нужно для диагностики 403 на /Kad/SearchInstances.
  await page.evaluate(() => {
    const w = window as any;
    w.__netLog = [];

    // fetch
    const origFetch = w.fetch;
    w.fetch = async function (...args: any[]) {
      const info: any = {
        type: 'fetch',
        url: String(args[0]),
        method: args[1]?.method || 'GET',
        reqHeaders: args[1]?.headers || {},
        reqBody: args[1]?.body ? String(args[1].body).slice(0, 500) : null,
      };
      try {
        const res = await origFetch.apply(this, args);
        info.status = res.status;
        try {
          info.respBody = (await res.clone().text()).slice(0, 2000);
        } catch {}
        w.__netLog.push(info);
        return res;
      } catch (e) {
        info.error = String(e);
        w.__netLog.push(info);
        throw e;
      }
    };

    // XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string,
      ...rest: any[]
    ) {
      (this as any).__info = {
        type: 'xhr',
        method,
        url,
        reqHeaders: {},
        reqBody: null,
      };
      return origOpen.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
      if ((this as any).__info) (this as any).__info.reqHeaders[name] = value;
      return origSetHeader.apply(this, [name, value] as any);
    };

    XMLHttpRequest.prototype.send = function (body?: any) {
      const info = (this as any).__info;
      if (info) {
        info.reqBody = typeof body === 'string' ? body.slice(0, 500) : String(body).slice(0, 500);
        this.addEventListener('load', () => {
          info.status = this.status;
          info.respBody = (this.responseText || '').slice(0, 2000);
          w.__netLog.push(info);
        });
        this.addEventListener('error', () => {
          info.error = 'network error';
          w.__netLog.push(info);
        });
      }
      return origSend.apply(this, [body] as any);
    };
  });

  // 3. Заполняем поле «Участник дела»
  const participantInput = page
    .locator('.b-selected-tags textarea[placeholder="название, ИНН или ОГРН"]')
    .first();

  await participantInput.waitFor({ state: 'visible', timeout: 20000 });
  await participantInput.click();
  await participantInput.fill('');
  // type вместо fill — имитация ввода пользователя (WASM это видит)
  await participantInput.type(inn, { delay: 50 });
  await page.waitForTimeout(800);

  // 4. Устанавливаем роль (если не «любой»)
  const roleType = roleToType(primaryRole);
  if (roleType !== -1) {
    try {
      const switcher = page.locator('.b-type-switcher-current').first();
      if (await switcher.isVisible().catch(() => false)) {
        await switcher.click();
        await page.waitForTimeout(500);
        const radio = page.locator(
          `.b-type-switcher .content ul li input[type="radio"][value="${roleType}"]`
        ).first();
        if ((await radio.count()) > 0) {
          await radio.click({ force: true });
          await page.waitForTimeout(500);
        }
      }
    } catch (e) {
      console.warn('[kad-search] Не удалось установить роль:', (e as Error).message);
    }
  }

  // 5. Клик по «Найти»
  const submitBtn = page.locator('#b-form-submit button').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();

    // Даём запросу SearchInstances время уйти и вернуться
  await page.waitForTimeout(5000);

  // Дамп сетевого лога
  try {
    const netLog = await page.evaluate(() => (window as any).__netLog || []);
    console.log(`\n[kad-search] === СЕТЕВОЙ ЛОГ (${netLog.length} записей) ===`);
    for (const e of netLog) {
      // Печатаем только релевантные — SearchInstances, CheckCaptcha, Wasm, Fp
      const url = String(e.url || '');
      const interesting =
        url.includes('SearchInstances') ||
        url.includes('CheckCaptcha') ||
        url.includes('GetCaptcha') ||
        url.includes('checkIsNeedShow') ||
        url.includes('WasCaptcha') ||
        url.includes('wasm') ||
        url.includes('fp');
      if (!interesting) continue;

      console.log(`\n--- ${e.type.toUpperCase()} ${e.method} ${url}`);
      console.log(`    Status: ${e.status ?? e.error ?? '?'}`);
      console.log(`    ReqHeaders: ${JSON.stringify(e.reqHeaders)}`);
      console.log(`    ReqBody: ${e.reqBody}`);
      console.log(`    RespBody: ${e.respBody}`);
    }
    console.log(`[kad-search] === /СЕТЕВОЙ ЛОГ ===\n`);
  } catch (e) {
    console.warn('[kad-search] Не удалось прочитать netLog:', (e as Error).message);
  }

  // 6. Ждём результат
  await waitForSearchResult(page);

  // 7. Парсим
  return parseCurrentPage(page);
}

/**
 * Ждёт появления любого из трёх состояний: results / noResults / captcha.
 * При капче делает паузу и ждёт ручного прохождения.
 */
async function waitForSearchResult(page: Page): Promise<void> {
  await page.waitForSelector(
    '.b-results:not(.g-hidden), .b-noResults:not(.g-hidden), .b-pravocaptcha',
    { timeout: 90000 }
  ).catch(() => null);

  // Проверка капчи
  const captchaVisible = await page
    .locator('.b-pravocaptcha')
    .isVisible()
    .catch(() => false);

  if (captchaVisible) {
    // Ждём прохождения капчи вручную (до 2 минут)
    console.log('[kad-search] Обнаружена капча. Ожидаем прохождения вручную (2 минуты)...');
    await page.waitForSelector('.b-pravocaptcha', { state: 'hidden', timeout: 120000 })
      .catch(() => null);
    // После прохождения — ждём результаты
    await page.waitForSelector(
      '.b-results:not(.g-hidden), .b-noResults:not(.g-hidden)',
      { timeout: 60000 }
    ).catch(() => null);
  }
}

/**
 * Парсит текущую страницу результатов.
 */
async function parseCurrentPage(page: Page): Promise<PageResult> {
  const html = await page.evaluate(() => {
    const container = document.querySelector('#main-column2');
    if (!container) return '';

    // Извлекаем только таблицу + input'ы с метаданными
    const table = container.querySelector('#b-cases');
    const metas = Array.from(container.querySelectorAll('input[type="hidden"]'))
      .map((el) => (el as HTMLInputElement).outerHTML)
      .join('');

    return (table ? table.outerHTML : '') + metas;
  });

  return parseHtmlResult(page, html);
}

/**
 * Пагинация: клик по номеру страницы.
 */
async function navigateToPage(page: Page, pageNum: number): Promise<PageResult | null> {
  // Ищем кнопку с номером страницы
  const pageLink = page
    .locator(`.b-footer-pages a, #b-footer-pages a, .pager a, a:has-text("${pageNum}")`)
    .filter({ hasText: new RegExp(`^${pageNum}$`) })
    .first();

  if ((await pageLink.count()) === 0) {
    console.warn(`[kad-search] Кнопка страницы ${pageNum} не найдена`);
    return null;
  }

  await pageLink.click();
  await waitForSearchResult(page);
  return parseCurrentPage(page);
}

/**
 * Парсит HTML-ответ: возвращает список дел + метаданные.
 */
async function parseHtmlResult(page: Page, html: string): Promise<PageResult> {
  return page.evaluate(
    ({ html }: { html: string }) => {
      // === Метаданные ===
      const extractHidden = (id: string): string | null => {
        const re = new RegExp(`id=["']${id}["'][^>]*value=["']([^"']*)["']`);
        const m = html.match(re);
        return m ? m[1] : null;
      };

      const meta = {
        totalCount: parseInt(extractHidden('documentsTotalCount') || '0', 10) || 0,
        pagesCount: parseInt(extractHidden('documentsPagesCount') || '1', 10) || 1,
        page: parseInt(extractHidden('documentsPage') || '1', 10) || 1,
        pageSize: parseInt(extractHidden('documentsPageSize') || '25', 10) || 25,
      };

      // === Парсинг строк ===
      const wrapper = document.createElement('table');
      wrapper.innerHTML = html;

      const decodeHtml = (s: string): string =>
        s
          .replace(/&quot;/g, '"')
          .replace(/&laquo;/g, '«')
          .replace(/&raquo;/g, '»')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');

      const parseDate = (raw: string | null): string => {
        if (!raw) return '';
        const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
      };

      const detectCaseType = (
        cls: string
      ): 'civil' | 'administrative' | 'bankruptcy' | 'other' => {
        if (cls.includes('bankruptcy')) return 'bankruptcy';
        if (cls.includes('administrative')) return 'administrative';
        if (cls.includes('civil')) return 'civil';
        return 'other';
      };

      const detectCounterpartyType = (
        name: string
      ): 'company' | 'person' | 'unknown' => {
        if (!name) return 'unknown';
        const upper = name.toUpperCase();
        if (/^ИП\s/.test(upper)) return 'person';
        if (/\b(ООО|ОАО|ЗАО|ПАО|АО|НП|СРО|ГУП|МУП|ФГУП|КБ|ПК|ТСЖ|ЖСК)\b/.test(upper)) {
          return 'company';
        }
        if (/[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]?\.?/.test(name)) return 'person';
        return 'unknown';
      };

      interface PartyAccum {
        items: Array<{
          name: string;
          inn?: string;
          address?: string;
          type: 'company' | 'person' | 'unknown';
          hidden_data?: boolean;
        }>;
        hidden: number;
      }

      const parseParticipants = (td: Element | null): PartyAccum => {
        const result: PartyAccum = { items: [], hidden: 0 };
        if (!td) return result;

        const hiddenBtn = td.querySelector('.b-button-container .b-button strong');
        if (hiddenBtn) {
          result.hidden = parseInt(hiddenBtn.textContent?.trim() || '0', 10) || 0;
        }

        const seen = new Set<string>();
        const rollovers = td.querySelectorAll('.js-rollover');

        for (const roll of Array.from(rollovers)) {
          if (roll.querySelector('a.num_case')) continue;

          const htmlSpan = roll.querySelector('.js-rolloverHtml');
          if (!htmlSpan) continue;

          const strong = htmlSpan.querySelector('strong');
          const rawName = strong?.textContent?.trim() || '';
          const name = decodeHtml(rawName);
          if (!name || name.length < 2) continue;
          if (seen.has(name)) continue;
          seen.add(name);

          const fullText = htmlSpan.textContent || '';
          const hidden_data = fullText.includes('Данные скрыты');

          let inn: string | undefined;
          const innMatch = fullText.match(/ИНН:\s*(\d{10,12})/);
          if (innMatch) inn = innMatch[1];

          let address: string | undefined;
          if (!hidden_data) {
            const clone = htmlSpan.cloneNode(true) as Element;
            clone.querySelector('strong')?.remove();
            clone.querySelectorAll('div').forEach((d) => d.remove());
            const txt = (clone.textContent || '').replace(/\s+/g, ' ').trim();
            if (txt.length > 5) address = decodeHtml(txt);
          }

          result.items.push({
            name,
            inn,
            address,
            type: detectCounterpartyType(name),
            hidden_data,
          });
        }

        return result;
      };

      const rows = wrapper.querySelectorAll('tr');
      const cases: any[] = [];

      for (const tr of Array.from(rows)) {
        const numTd = tr.querySelector('td.num');
        const courtTd = tr.querySelector('td.court');
        const plaintiffTd = tr.querySelector('td.plaintiff');
        const respondentTd = tr.querySelector('td.respondent');

        if (!numTd || !courtTd) continue;

        const dateDiv = numTd.querySelector('div[title]');
        const filingDate = parseDate(dateDiv?.getAttribute('title') || null);
        const caseType = detectCaseType(dateDiv?.className || '');

        const link = numTd.querySelector('a.num_case');
        const caseNumber = link?.textContent?.trim() || '';
        const href = link?.getAttribute('href') || '';
        const uuidMatch = href.match(/\/Card\/([a-f0-9-]+)/i);
        const caseUuid = uuidMatch ? uuidMatch[1] : '';

        if (!caseNumber) continue;

        const judge =
          courtTd.querySelector('.judge')?.getAttribute('title')?.trim() ||
          courtTd.querySelector('.judge')?.textContent?.trim() ||
          undefined;

        const courtDivs = courtTd.querySelectorAll('div[title]:not(.judge)');
        const court =
          courtDivs[0]?.textContent?.trim() ||
          courtDivs[0]?.getAttribute('title')?.trim() ||
          '';

        const plaintiffs = parseParticipants(plaintiffTd);
        const respondents = parseParticipants(respondentTd);

        cases.push({
          case_number: caseNumber,
          case_uuid: caseUuid,
          case_type: caseType,
          filing_date: filingDate,
          court,
          judge,
          plaintiffs: plaintiffs.items,
          respondents: respondents.items,
          hidden_plaintiffs_count: plaintiffs.hidden || undefined,
          hidden_respondents_count: respondents.hidden || undefined,
        });
      }

      // Проверяем «нет результатов»
      const noResults = html.includes('b-noResults') && !html.includes('b-results:not');

      return { cases, meta, empty: cases.length === 0 };
    },
    { html }
  );
}