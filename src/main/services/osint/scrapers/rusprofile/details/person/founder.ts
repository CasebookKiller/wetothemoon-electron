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
    await page.waitForSelector('.tiles-content, .content-frame, .filters-results', { timeout: 15000 });
  } catch {
    console.log('Структура страницы /founder не найдена');
    return data;
  }
  await page.waitForTimeout(500);

  const parsed = await page.evaluate(() => {
    const result: any = { current: [], past: [] };

    const collectList = (tabName: string) => {
      const tab = document.querySelector(`.tab-item[data-tab_name="${tabName}"]`);
      if (!tab) return [];

      const items: any[] = [];
      tab.querySelectorAll('.list-element').forEach((el) => {
        const nameEl = el.querySelector('a.list-element__title');
        const name = nameEl?.textContent?.trim() || '';
        const href = (nameEl as HTMLAnchorElement | null)?.href || '';

        let status = '';
        const statusEl = el.querySelector('.warning-text');
        if (statusEl) status = statusEl.textContent?.trim() || '';

        const activity = el.querySelector('.list-element__text')?.textContent?.trim() || '';
        const address = el.querySelector('.list-element__address')?.textContent?.trim() || '';

        let inn = '';
        let ogrn = '';
        let regDate = '';
        const infoSpans = el.querySelectorAll('.list-element__row-info span');
        if (infoSpans.length >= 3) {
          inn = infoSpans[0].textContent?.replace('ИНН:', '').trim() || '';
          ogrn = infoSpans[1].textContent?.replace('ОГРН:', '').trim() || '';
          regDate = infoSpans[2].textContent?.replace('Дата регистрации:', '').trim() || '';
        }

        let share = '';
        let period = '';
        const infoItems = el.querySelectorAll('.list-element__info-box-item');
        infoItems.forEach((item) => {
          const text = item.textContent?.trim() || '';
          if (text.startsWith('Учредитель:')) {
            const periodMatch = text.match(/с\s+([\d.]+)\s+по\s+([\d.]+)/);
            if (periodMatch) period = `с ${periodMatch[1]} по ${periodMatch[2]}`;
          }
          if (text.startsWith('Доля:')) {
            share = text.replace('Доля:', '').trim();
          }
        });

        if (name || inn) {
          items.push({ name, href, status, activity, address, inn, ogrn, registration_date: regDate, share, period });
        }
      });
      return items;
    };

    result.current = collectList('founder_now');
    result.past = collectList('founder_past');
    return result;
  });

  console.log(`Собрано учредителя (ФЛ): текущих ${parsed.current.length}, прошлых ${parsed.past.length}`);
  return parsed;
}