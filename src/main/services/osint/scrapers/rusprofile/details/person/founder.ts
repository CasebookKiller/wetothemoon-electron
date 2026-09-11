// src/main/services/osint/scrapers/rusprofile/details/person/founder.ts
import { Page } from 'playwright';

export async function collectPersonFounderDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор учредителя для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/founder`;

  const data: any = {
    current: [],
    past: [],
  };

  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть /founder:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница /founder недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('.content-frame__title, .company__list, .list-element', { timeout: 15000 });
  } catch {
    console.log('Структура страницы /founder не найдена');
    return data;
  }
  await page.waitForTimeout(500);

  const parsed = await page.evaluate(() => {
    const result: any = { current: [], past: [] };

    /**
     * Парсит один `.list-element` — организацию, где человек учредитель.
     */
    const parseListItem = (el: Element) => {
      const nameEl = el.querySelector('a.list-element__title');
      const name = nameEl?.textContent?.trim() || '';
      const href = (nameEl as HTMLAnchorElement | null)?.href || '';

      // Статус: "Организация ликвидирована"
      let status = '';
      const statusEl = el.querySelector('.warning-text');
      if (statusEl) status = statusEl.textContent?.trim() || '';

      // Вид деятельности — первый .list-element__text
      const textEls = el.querySelectorAll('.list-element__text');
      const activity = textEls[0]?.textContent?.trim() || '';

      // Роль, период и доля из .list-element__info-box-item
      let period = '';
      let share = '';
      el.querySelectorAll('.list-element__info-box-item').forEach((item) => {
        const spans = item.querySelectorAll('span');
        if (spans.length === 0) return;
        const label = spans[0]?.textContent?.trim() || '';
        if (label.startsWith('Учредитель:')) {
          // Период хранится в span.warning
          const warning = item.querySelector('.warning');
          if (warning) period = warning.textContent?.trim() || '';
        } else if (label.startsWith('Доля:')) {
          // Доля — во втором span
          const valueSpan = spans[1];
          if (valueSpan) share = valueSpan.textContent?.replace(/\s+/g, ' ').trim() || '';
        }
      });

      const address = el.querySelector('.list-element__address')?.textContent?.trim() || '';

      // ИНН, ОГРН, дата регистрации
      let inn = '';
      let ogrn = '';
      let regDate = '';
      const infoSpans = el.querySelectorAll('.list-element__row-info span');
      if (infoSpans.length >= 3) {
        inn = infoSpans[0].textContent?.replace('ИНН:', '').trim() || '';
        ogrn = infoSpans[1].textContent?.replace('ОГРН:', '').trim() || '';
        regDate = infoSpans[2].textContent?.replace('Дата регистрации:', '').trim() || '';
      }

      // Финансовые показатели из info-box
      const financials: Record<string, string> = {};
      el.querySelectorAll('.list-element__info-box dl').forEach((dl) => {
        const dt = dl.querySelector('dt')?.textContent?.trim() || '';
        if (!dt) return;
        if (dt === 'Надёжность') {
          const badge = dl.querySelector('.badge-status')?.textContent?.trim() || '';
          if (badge) financials[dt] = badge;
        } else {
          const dd = dl.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (dd) financials[dt] = dd;
        }
      });

      return {
        name,
        href,
        status,
        activity,
        period,
        share,
        address,
        inn,
        ogrn,
        registration_date: regDate,
        financials,
      };
    };

    // Итерируем по .company__list, разделяя на секции по подзаголовкам
    const container = document.querySelector('.company__list');
    if (!container) return result;

    const children = Array.from(container.children);
    let currentSection: 'current' | 'past' | null = null;

    for (const child of children) {
      const el = child as HTMLElement;

      if (el.classList.contains('tile-item__subtitle')) {
        const text = el.textContent?.trim() || '';
        if (text.includes('в настоящее время')) currentSection = 'current';
        else if (text.includes('в прошлом')) currentSection = 'past';
        continue;
      }

      if (el.classList.contains('list-element__row') && currentSection) {
        el.querySelectorAll('.list-element').forEach((item) => {
          const parsed = parseListItem(item);
          if (parsed.name || parsed.inn) {
            result[currentSection!].push(parsed);
          }
        });
      }
    }

    return result;
  });

  data.current = parsed.current;
  data.past = parsed.past;

  console.log(`Собрано учредителя (ФЛ): текущих ${data.current.length}, прошлых ${data.past.length}`);
  return data;
}