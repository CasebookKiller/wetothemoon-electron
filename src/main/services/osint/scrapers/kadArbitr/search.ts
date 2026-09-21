// src/main/services/osint/scrapers/kadArbitr/search.ts

import { Page } from 'playwright';
import type {
  KadArbitrCase,
  KadArbitrData,
  KadArbitrSearchOptions,
  KadArbitrSearchPayload,
} from './types';

const SEARCH_URL = '/Kad/SearchInstances';
const DEFAULT_PAGE_SIZE = 25;

/**
 * Публичная точка входа: собрать список дел по ИНН.
 *
 * Итерируется по страницам, на каждой делает POST /Kad/SearchInstances
 * и парсит HTML-ответ внутри браузерного контекста.
 */
export async function searchCases(
  page: Page,
  inn: string,
  options: KadArbitrSearchOptions = {}
): Promise<KadArbitrData> {
  const maxPages = options.maxPages ?? 5;
  const maxTotalCases = options.maxTotalCases ?? 500;
  const roles = options.roles && options.roles.length > 0 ? options.roles : ['any'];

  // В MVP поддерживаем одну роль за раз (как в UI kad.arbitr — один тег).
  const primaryRole = roles[0];
  const sideType = roleToType(primaryRole);

  const basePayload: KadArbitrSearchPayload = {
    Page: 1,
    Count: DEFAULT_PAGE_SIZE,
    Courts: [],
    DateFrom: options.dateFrom ?? null,
    DateTo: options.dateTo ?? null,
    Judges: [],
    CaseNumbers: [],
    Sides: [{ Name: inn, Type: sideType, ExactMatch: false }],
    WithVKSInstances: false,
  };

  const allCases: KadArbitrCase[] = [];
  let totalFound = 0;
  let pagesCount = 1;
  let pageNum = 1;

  while (pageNum <= maxPages && allCases.length < maxTotalCases) {
    const payload: KadArbitrSearchPayload = { ...basePayload, Page: pageNum };
    const { cases, meta } = await searchOnePage(page, payload);

    if (pageNum === 1) {
      totalFound = meta.totalCount;
      pagesCount = meta.pagesCount;
    }

    if (cases.length === 0) break;

    for (const c of cases) {
      if (allCases.length >= maxTotalCases) break;
      allCases.push(c);
    }

    pageNum++;

    if (pageNum > pagesCount) break;
  }

  return {
    entity_inn: inn,
    collected_at: new Date().toISOString(),
    source_url: `https://kad.arbitr.ru/Kad/SearchInstances?inn=${inn}`,
    search_params: {
      date_from: options.dateFrom ?? null,
      date_to: options.dateTo ?? null,
      roles: [primaryRole],
    },
    totals: {
      cases_found: totalFound,
      cases_collected: allCases.length,
      pages_count: pagesCount,
    },
    cases: allCases,
  };
}

function roleToType(role: string): number {
  switch (role) {
    case 'plaintiff':
      return 0;
    case 'defendant':
      return 1;
    case 'third_party':
      return 2;
    case 'any':
    default:
      return -1;
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
}

/**
 * Один POST на /Kad/SearchInstances. Всё парсится внутри браузера,
 * наружу уходят уже готовые объекты.
 */
async function searchOnePage(
  page: Page,
  payload: KadArbitrSearchPayload
): Promise<PageResult> {
  return page.evaluate(
    async ({ url, body }: { url: string; body: KadArbitrSearchPayload }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'x-date-format': 'iso',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`SearchInstances вернул ${res.status}`);
      }

      const html = await res.text();

      // === Метаданные пагинации — проще через regexp, чем через DOM ===
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

      // === Строки — через настоящий DOM ===
      // Оборачиваем в <table>, чтобы <tr>/<colgroup> корректно распарсились.
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

      const detectCaseType = (cls: string): 'civil' | 'administrative' | 'bankruptcy' | 'other' => {
        if (cls.includes('bankruptcy')) return 'bankruptcy';
        if (cls.includes('administrative')) return 'administrative';
        if (cls.includes('civil')) return 'civil';
        return 'other';
      };

      const detectCounterpartyType = (name: string): 'company' | 'person' | 'unknown' => {
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
          // Пропускаем ссылку «Подробнее...»
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
      const cases: KadArbitrCase[] = [];

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
        const court = (courtDivs[0]?.textContent?.trim() ||
          courtDivs[0]?.getAttribute('title')?.trim()) as string | undefined;

        const plaintiffs = parseParticipants(plaintiffTd);
        const respondents = parseParticipants(respondentTd);

        cases.push({
          case_number: caseNumber,
          case_uuid: caseUuid,
          case_type: caseType,
          filing_date: filingDate,
          court: court || '',
          judge,
          plaintiffs: plaintiffs.items,
          respondents: respondents.items,
          hidden_plaintiffs_count: plaintiffs.hidden || undefined,
          hidden_respondents_count: respondents.hidden || undefined,
        });
      }

      return { cases, meta };
    },
    { url: SEARCH_URL, body: payload }
  );
}