// src/main/services/osint/scrapers/kadArbitr/card.ts
// Разведка карточки дела: шапка + стороны + инстансы + события (timeline).
// Дисциплина: только UI-клик по .js-collapse, никаких fetch/POST.

import { Page } from 'playwright';
import type {
  KadArbitrCard,
  KadArbitrCardEvent,
  KadArbitrCardInstance,
  KadArbitrCardOptions,
  KadArbitrCardSide,
  KadArbitrCaseType,
  KadArbitrEventType,
} from './types';

const CARD_URL = (uuid: string) => `https://kad.arbitr.ru/Card/${uuid}`;
const DEFAULT_RATE_DELAY_MS = 2000;

/**
 * Открывает карточку дела, раскрывает все инстансы и парсит содержимое.
 *
 * События (timeline) подгружаются отдельным XHR
 * GET /Kad/InstanceDocumentsPage?id={instance_uuid}&caseId={case_uuid}
 * по клику на .js-collapse — поэтому раскрываем каждый инстанс.
 */
export async function fetchCard(
  page: Page,
  caseUuid: string,
  options: KadArbitrCardOptions = {}
): Promise<KadArbitrCard> {
  const expandAll = options.expandAllInstances !== false;
  const rateDelay = options.rateDelayMs ?? DEFAULT_RATE_DELAY_MS;

  await page.goto(CARD_URL(caseUuid), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.js-case-header-case_num', { timeout: 30000 });

  if (expandAll) {
    const instanceUuids = await page.$$eval(
      '#chrono_list_content .js-chrono-item-header',
      (els) => els.map((el) => (el as HTMLElement).getAttribute('data-id') || '').filter(Boolean)
    );

    for (const uuid of instanceUuids) {
      await expandInstance(page, uuid, rateDelay);
    }
  }

  return await parseCard(page, caseUuid);
}

async function expandInstance(
  page: Page,
  instanceUuid: string,
  rateDelay: number
): Promise<void> {
  const headerSel = `.js-chrono-item-header[data-id="${instanceUuid}"]`;
  const header = page.locator(headerSel).first();
  if ((await header.count()) === 0) return;

  const isExpanded = await header
    .evaluate((el) => el.classList.contains('b-chrono-item-header-expanded'))
    .catch(() => false);

  if (!isExpanded) {
    await header.locator('.js-collapse').click({ timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(rateDelay);
  }

  // Ждём появления хотя бы одного .js-chrono-item у этого инстанса.
  await page
    .waitForFunction(
      (sel: string) => {
        const h = document.querySelector(sel);
        if (!h) return false;
        let next: Element | null = h.nextElementSibling;
        while (next && !next.classList.contains('js-chrono-item-header')) {
          if (next.querySelectorAll('.js-chrono-item').length > 0) return true;
          next = next.nextElementSibling;
        }
        return false;
      },
      headerSel,
      { timeout: 30000 }
    )
    .catch(() => null);
}

async function parseCard(page: Page, caseUuid: string): Promise<KadArbitrCard> {
  return page.evaluate((uuid: string) => {
    // ---------- helpers ----------
    const decode = (s: string | null | undefined): string =>
      (s || '')
        .replace(/&quot;/g, '"')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

    const parseDate = (raw: string | null | undefined): string | undefined => {
      if (!raw) return undefined;
      const m = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
    };

    const detectCaseType = (cls: string): KadArbitrCaseType => {
      if (cls.includes('bankruptcy')) return 'bankruptcy';
      if (cls.includes('administrative')) return 'administrative';
      if (cls.includes('civil')) return 'civil';
      return 'other';
    };

    const mapEventType = (raw: string): KadArbitrEventType => {
      const t = (raw || '').trim().toLowerCase();
      if (t === 'заявление' || t === 'исковое заявление') return 'filing';
      if (t === 'определение') return 'ruling';
      if (t === 'решение') return 'decision';
      if (t === 'судебное заседание' || t === 'заседание') return 'hearing';
      if (t.includes('апелляцион')) return 'appeal';
      if (t.includes('кассацион')) return 'cassation';
      return 'other';
    };

    const el = (sel: string, root: Document | Element = document): Element | null =>
      root.querySelector(sel);
    const txt = (sel: string, root: Document | Element = document): string =>
      (el(sel, root)?.textContent || '').trim();

    // ---------- шапка ----------
    const caseNumber =
      ((el('#caseName') as HTMLInputElement | null)?.value || '').trim() ||
      txt('.js-case-header-case_num');
    const caseId = (el('#caseId') as HTMLInputElement | null)?.value || uuid;

    const status = txt('.b-case-header-desc') || undefined;

    const durationRaw = txt('.case-dur');
    const durationDays = durationRaw
      ? parseInt(durationRaw.match(/\d+/)?.[0] || '0', 10) || undefined
      : undefined;

    const headerCard = el('.b-iblock__header_card');
    const iconCls = headerCard?.querySelector('.b-icon')?.className || '';
    const caseType = detectCaseType(iconCls);
    // категория — текст в первом span внутри headerCard (может содержать иконку)
    const categoryRaw = headerCard?.querySelector('span')?.textContent?.trim() || '';
    const category = categoryRaw ? decode(categoryRaw) : undefined;

    // станет
    const monthRu: Record<string, string> = {
      'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
      'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
      'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12',
    };
    const headerDateRaw = (el('.case-date a')?.textContent || '').trim();
    let filingDate: string | undefined;
    const ruMatch = headerDateRaw.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})$/i);
    if (ruMatch) {
      const mm = monthRu[ruMatch[2].toLowerCase()];
      if (mm) filingDate = `${ruMatch[3]}-${mm}-${ruMatch[1].padStart(2, '0')}`;
    } else {
      filingDate = parseDate(headerDateRaw);
    }

        // ---------- стороны ----------
    // ВАЖНО: `td.plaintiffs` есть и в <thead> (заголовок "Истцы"),
    // и в <tbody> (данные). Ищем строго в <tbody>.
    const parseSides = (tdClass: string): KadArbitrCardSide[] => {
      const container = document.querySelector(`#gr_case_partps tbody ${tdClass}`);
      if (!container) return [];
      const result: KadArbitrCardSide[] = [];
      const rolls = container.querySelectorAll('.js-rollover');
      for (const roll of Array.from(rolls)) {
        const a = roll.querySelector('a[href*="/SideCard/"]') as HTMLAnchorElement | null;
        if (!a) continue;
        const name = decode(a.textContent?.trim() || '');
        if (!name) continue;
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/SideCard\/([a-f0-9-]+)/i);
        const side_uuid = m ? m[1] : '';
        const htmlSpan = roll.querySelector('.js-rolloverHtml');
        const address = htmlSpan
          ? decode(htmlSpan.textContent?.replace(/\s+/g, ' ').trim() || '') || undefined
          : undefined;
        result.push({ side_uuid, name, address });
      }
      return result;
    };

    const sides = {
      plaintiffs: parseSides('td.plaintiffs'),
      respondents: parseSides('td.defendants'),
      third_parties: parseSides('td.third'),
      others: parseSides('td.others'),
    };

    // ---------- судьи первой инстанции (из HTML шапки) ----------
    const judgesFromHeader: string[] = Array.from(
      el('#gr_case_judges')?.querySelectorAll('td.first ul li') || []
    )
      .map((li) => (li.textContent || '').trim())
      .filter(Boolean);

    // ---------- события ----------
    const parseEvent = (item: Element): KadArbitrCardEvent | null => {
      const dateRaw = (item.querySelector('.case-date')?.textContent || '').trim();
      const typeRaw = (item.querySelector('.case-type')?.textContent || '').trim();
      const date = parseDate(dateRaw);
      if (!date || !typeRaw) return null;

      const event_uuid = item.getAttribute('data-id') || undefined;

      const additionalInfo = (item.querySelector('.additional-info')?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim() || undefined;

      // Полный текст .case-subject. В шаблоне cardChrono там лежит
      // "Дата и время судебного заседания ДД.ММ.ГГГГ ЧЧ:ММ, зал N, ФИО, ..."
      // для определений об отложении/назначении — эту дату нельзя терять.
      const subjectEl = item.querySelector('.case-subject');
      const subjectText = subjectEl
        ? decode((subjectEl.textContent || '').replace(/\s+/g, ' ').trim())
        : undefined;

      // Отдельные имена судей — из span[title] (нужны для judge / declarer).
      const judgeNamesFromSubject: string[] = Array.from(
        item.querySelectorAll('.case-subject span[title]')
      )
        .map((s) => decode((s as HTMLElement).getAttribute('title') || s.textContent || '').trim())
        .filter(Boolean);

      // Дата заседания может лежать и в .case-subject, и в .additional-info —
      // kad в разных шаблонах кладёт её в разные места. Собираем оба текста.
      // В .case-subject обычно — судья/заявитель, в .additional-info — дата.
      let hearing_date: string | undefined;
      let hearing_time: string | undefined;
      let hearing_place: string | undefined;

      const hearingSource = [subjectText, additionalInfo].filter(Boolean).join(' | ');
      if (hearingSource) {
        // Формат: "Дата и время судебного заседания DD.MM.YYYY, HH:MM, <место>"
        // между датой и временем — запятая + пробел (а не просто пробел).
        const dtMatch = hearingSource.match(
          /Дата и время судебного заседания\s+(\d{2}\.\d{2}\.\d{4})[,\s]+(\d{1,2}:\d{2})(?:[,\s]+([^,|]+))?/i
        );
        if (dtMatch) {
          hearing_date = parseDate(dtMatch[1]);
          hearing_time = dtMatch[2];
          if (dtMatch[3]) {
            // Место — всё до конца токена: "ЗАЛ 6", "13 (кабинет 207)"
            hearing_place = dtMatch[3].trim();
          }
        }
      }

      const resultEl = item.querySelector('.b-case-result-text') as HTMLElement | null;
      const content = decode(
        (resultEl?.textContent || '').replace(/\s+/g, ' ').trim()
      ) || undefined;

      const resultA =
        (resultEl?.tagName === 'A' ? (resultEl as HTMLAnchorElement) : null) ||
        (item.querySelector('a.b-case-result-text') as HTMLAnchorElement | null);
      const document_url = resultA?.getAttribute('href') || undefined;

      const publishA = item.querySelector('.b-case-publish_info a') as HTMLAnchorElement | null;
      const publishUrl = publishA?.getAttribute('href') || undefined;
      const publishText = (publishA?.textContent || '').trim();
      const publishMatch = publishText.match(/Дата публикации:\s*(.+)/i);
      const publish_date = publishMatch ? publishMatch[1].trim() : undefined;

      // Разбираем .js-judges-rolloverHtml: там "Судебный состав" и "Судья-докладчик"
      const judgesBlock = item.querySelector('.js-judges-rolloverHtml');
      let judgeRole: string | undefined;
      let judgePanel: string | undefined;
      if (judgesBlock) {
        const paragraphs = Array.from(judgesBlock.querySelectorAll('p'));
        for (const p of paragraphs) {
          const strong = p.querySelector('strong')?.textContent?.trim() || '';
          const value = (p.textContent || '')
            .replace(strong, '')
            .replace(/^[\s:]+/, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (/Судебный состав/i.test(strong) && value) judgePanel = value;
          if (/Судья[- ]докладчик/i.test(strong)) judgeRole = 'Судья-докладчик';
        }
      }

      // Если есть роль судьи — берём первого судью из span[title].
      // Иначе первый span[title] — это заявитель. Если span'ов нет —
      // используем очищенный от префикса текст как fallback.
      let judge: string | undefined;
      let declarer: string | undefined;

      const cleanSubjectText = subjectText
        ? subjectText
            .replace(/^Дата и время судебного заседания\s+[\d\.]*\s*[\d:]*\s*,?\s*/i, '')
            .replace(/^зал[а-я]*\s+[\w/.-]+\s*,?\s*/i, '')
            .trim()
        : undefined;

      if (judgeRole) {
        judge = judgeNamesFromSubject[0] || cleanSubjectText;
      } else {
        declarer = judgeNamesFromSubject[0] || cleanSubjectText;
      }

      let amount: string | undefined;
      if (additionalInfo) {
        const m = additionalInfo.match(/Сумма исковых требований\s+([\d\s,\.]+)/i);
        if (m) amount = m[1].replace(/\s/g, '').trim();
      }

      return {
        event_uuid,
        event_date: date,
        event_type: mapEventType(typeRaw),
        event_type_raw: typeRaw,
        content,
        document_url,
        publish_date,
        publish_url: publishUrl,
        judge,
        judge_role: judgeRole,
        judge_panel: judgePanel,
        additional_info: additionalInfo,
        amount,
        declarer,
        hearing_date,
        hearing_time,
        hearing_place,
        hearing_judges: judgeNamesFromSubject.length > 0 ? judgeNamesFromSubject : undefined,
      };
    };

    // ---------- инстансы ----------
    const instances: KadArbitrCardInstance[] = [];
    const headerEls = document.querySelectorAll('#chrono_list_content .js-chrono-item-header');

    for (const h of Array.from(headerEls)) {
      const instance_uuid = h.getAttribute('data-id') || '';
      const court_tag = h.getAttribute('data-court') || undefined;
      const level = (h.querySelector('.l-col strong')?.textContent || '').trim();
      const caseNum = (h.querySelector('.b-case-instance-number')?.textContent || '').trim();
      const courtA = h.querySelector('.instantion-name a') as HTMLAnchorElement | null;
      const court_name = (courtA?.textContent || '').trim();
      const court_href = courtA?.getAttribute('href') || undefined;

      // События — в следующем sibling .b-chrono-items-container
      const events: KadArbitrCardEvent[] = [];
      let next: Element | null = h.nextElementSibling;
      while (next && !next.classList.contains('js-chrono-item-header')) {
        if (next.classList.contains('b-chrono-items-container')) {
          const items = next.querySelectorAll('.js-chrono-item');
          for (const item of Array.from(items)) {
            const ev = parseEvent(item);
            if (ev) events.push(ev);
          }
          break;
        }
        next = next.nextElementSibling;
      }

      instances.push({
        instance_uuid,
        case_number: caseNum,
        court_name,
        court_href,
        court_tag,
        level,
        events,
      });
    }

    // Судьи из шапки относятся к суду первой инстанции.
    // Ищем инстанс с level='Первая инстанция' и совпадающим court_name,
    // а не просто instances[0].
    if (judgesFromHeader.length > 0) {
      const firstInstance = instances.find(
        (i) => i.level === 'Первая инстанция'
      );
      if (firstInstance) {
        firstInstance.judges = judgesFromHeader;
      }
    }

    return {
      case_uuid: caseId,
      case_number: caseNumber,
      case_type: caseType,
      category,
      status,
      duration_days: durationDays,
      filing_date: filingDate,
      sides,
      instances,
      collected_at: new Date().toISOString(),
      source_url: location.href,
    };
  }, caseUuid);
}

/**
 * Обогащает card извлечёнными полями hearing_* там, где их ещё нет.
 * Применяется и к свежескачанной, и к кешированной карточке
 * (кеш хранит только распарсенный объект без HTML).
 *
 * Источник данных — .additional-info / .case-subject / .content,
 * которые уже извлечены parseEvent.
 */
export function enrichCardHearing(card: KadArbitrCard): void {
  for (const inst of card.instances) {
    for (const ev of inst.events) {
      if (ev.hearing_date) continue; // уже есть — не трогаем

      // Собираем все текстовые источники, где может лежать дата
      const sources = [ev.additional_info, ev.content, ev.event_type_raw]
        .filter(Boolean)
        .join(' | ');

      // Формат: "Дата и время судебного заседания DD.MM.YYYY, HH:MM, <место>"
      // Между датой и временем может быть запятая или пробел.
      // Место — всё после времени до следующей запятой или разделителя.
      const dtMatch = sources.match(
        /Дата и время судебного заседания\s+(\d{2}\.\d{2}\.\d{4})[,\s]+(\d{1,2}:\d{2})(?:\s*,\s*([^,|]+))?/i
      );
      if (!dtMatch) continue;

      const [, dd, hhmm, place] = dtMatch;
      const dm = dd.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!dm) continue;

      ev.hearing_date = `${dm[3]}-${dm[2]}-${dm[1]}`;
      ev.hearing_time = hhmm;
      if (place) ev.hearing_place = place.trim();
    }
  }
}