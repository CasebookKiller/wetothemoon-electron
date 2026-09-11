// src/main/services/osint/scrapers/rusprofile/details/founders.ts
import { Page } from 'playwright';

// Применение фильтров для учредителей
export async function applyFoundersFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Тип (может быть несколько)
  if (filters.types && Array.isArray(filters.types) && filters.types.length > 0) {
    for (const type of filters.types) {
      const checkbox = page.locator(`input[name="type"][value="${type}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Статус
  if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    for (const status of filters.statuses) {
      const checkbox = page.locator(`input[name="status"][value="${status}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }
}

// Основная функция сбора для учредителей (детальный список)
export async function collectFoundersDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных учредителей для компании ID ${companyId}...`);
  const data: any = { founders: [] };

  const url = `https://www.rusprofile.ru/founders/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Применяем фильтры
  if (options.filters) {
    await applyFoundersFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collected = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collected < maxTotalCases) {
    const items = page.locator('li.filters-results__list-item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collected < maxTotalCases; i++) {
      const item = items.nth(i);
      const founder: any = {};

      // Извлекаем данные
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        // Название и ссылка
        const titleEl = li.querySelector('a.list-element__title');
        const name = titleEl ? titleEl.textContent?.trim() || '' : '';
        const href = titleEl ? (titleEl as HTMLAnchorElement).href || '' : '';

        // Период
        let period = '';
        const periodItems = li.querySelectorAll('.list-element__info-box-item');
        periodItems.forEach(item => {
          const label = item.querySelector('span')?.textContent?.trim() || '';
          if (label === 'Период:') {
            period = item.querySelectorAll('span')[1]?.textContent?.trim() || '';
          }
        });

        // Доля
        let share = '';
        periodItems.forEach(item => {
          const label = item.querySelector('span')?.textContent?.trim() || '';
          if (label === 'Доля:') {
            share = item.querySelectorAll('span')[1]?.textContent?.trim() || '';
          }
        });

        // Вид деятельности (первый .list-element__text после info-box)
        const activity = getText('.list-element__text');

        // Руководитель (второй .list-element__text, если есть)
        const textEls = li.querySelectorAll('.list-element__text');
        const director = textEls.length > 1 ? textEls[1].textContent?.trim() || '' : '';

        // Адрес
        const address = getText('.list-element__address');

        // Реквизиты
        const infoSpans = li.querySelectorAll('.list-element__row-info span');
        let inn = '';
        let ogrn = '';
        let regDate = '';
        if (infoSpans.length >= 3) {
          inn = infoSpans[0].textContent?.replace('ИНН:', '').trim() || '';
          ogrn = infoSpans[1].textContent?.replace('ОГРН:', '').trim() || '';
          regDate = infoSpans[2].textContent?.replace('Дата регистрации:', '').trim() || '';
        }

        // Количество организаций и связей (если есть)
        let organizations = '';
        let connections = '';
        periodItems.forEach(item => {
          const label = item.querySelector('span')?.textContent?.trim() || '';
          if (label === 'Учредитель:') {
            const link = item.querySelector('a');
            organizations = link ? link.textContent?.trim() || '' : '';
          }
          if (label === 'Связи:') {
            const link = item.querySelector('a');
            connections = link ? link.textContent?.trim() || '' : '';
          }
        });

        return { name, href, period, share, activity, director, address, inn, ogrn, regDate, organizations, connections };
      });

      founder.name = parsed.name;
      founder.href = parsed.href;
      founder.period = parsed.period;
      founder.share = parsed.share;
      founder.activity = parsed.activity;
      founder.director = parsed.director;
      founder.address = parsed.address;
      founder.inn = parsed.inn;
      founder.ogrn = parsed.ogrn;
      founder.registration_date = parsed.regDate;
      founder.organizations_count = parsed.organizations;
      founder.connections_count = parsed.connections;

      if (founder.name) {
        data.founders.push(founder);
        collected++;
      }
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

    // Пагинация
    const showMore = page.locator("button:has-text('Показать ещё')").first();
    if (await showMore.count() > 0 && await showMore.isEnabled()) {
      await showMore.click();
      await page.waitForTimeout(3000);
      currentPage++;
    } else {
      const nextBtn = page.locator('button.filters-pagination__nav.--next').first();
      if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
        currentPage++;
      } else {
        break;
      }
    }
  }

  console.log(`Собрано учредителей: ${data.founders.length}`);
  return data;
}
