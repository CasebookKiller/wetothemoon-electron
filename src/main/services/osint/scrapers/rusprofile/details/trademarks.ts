// src/main/services/osint/scrapers/rusprofile/details/trademarks.ts
import { Page } from 'playwright';

export async function applyTrademarksFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  if (filters.onlyActual) {
    const checkbox = page.locator('input[name="status"][value="actual"]');
    if (await checkbox.count() > 0) {
      await checkbox.check();
      await page.waitForTimeout(500);
    }
  }

  if (filters.type && filters.type !== 'all') {
    const radio = page.locator(`input[name="type"][value="${filters.type}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

export async function collectTrademarksDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных товарных знаков для компании ID ${companyId}...`);
  const data: any = { total_trademarks: '', trademarks: [] };

  const url = `https://www.rusprofile.ru/trademarks/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyTrademarksFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Получаем общее количество из уведомления о пагинации
  try {
    const noticeText = await page.locator('.filters-pagination__notice').first().innerText({ timeout: 5000 });
    const m = noticeText.match(/из\s*([\d\s]+)/);
    if (m) data.total_trademarks = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество товарных знаков:', e);
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

      // Извлекаем данные (аккордеоны раскрывать не требуется, текст доступен в DOM)
      const details = await item.evaluate((li) => {
        const getValueByTitle = (title: string, container?: Element | null): string => {
          const target = container || li;
          const items = target.querySelectorAll('.info__item');
          for (const item of items) {
            const titleEl = item.querySelector('.company-info__title');
            if (titleEl && titleEl.textContent?.trim() === title) {
              const valueEl = item.querySelector('.company-info__text');
              return valueEl ? valueEl.textContent?.trim() || '' : '';
            }
          }
          return '';
        };

        const id = getValueByTitle('Номер гос. регистрации');
        const status = getValueByTitle('Статус');
        const regDate = getValueByTitle('Дата гос. регистрации');
        const country = getValueByTitle('Страна правообладателя');

        const descriptionAccordion = li.querySelector('.accordion__item[data-resolver="description"]');
        const type = getValueByTitle('Тип товарного знака', descriptionAccordion);

        const generalAccordion = li.querySelector('.accordion__item[data-resolver="general_information"]');
        const expires = getValueByTitle('Дата истечения срока действия исключительного права', generalAccordion);

        const mktuAccordion = li.querySelector('.accordion__item[data-resolver="mktu"]');
        let classes = '';
        if (mktuAccordion) {
          const textEl = mktuAccordion.querySelector('.truncate-textBlock__content');
          if (textEl) classes = textEl.textContent?.trim() || '';
        }

        // Изображение товарного знака
        const imgEl = li.querySelector('.trademarks-img img');
        const imageUrl = imgEl ? (imgEl as HTMLImageElement).getAttribute('src') || '' : '';

        return { id, status, regDate, country, type, expires, classes, imageUrl };
      });

      const trademark: any = {
        id: details.id,
        status: details.status,
        registration_date: details.regDate,
        country: details.country,
        type: details.type,
        expires: details.expires,
        classes: details.classes,
        image_url: details.imageUrl,
      };

      if (trademark.id || trademark.status) {
        data.trademarks.push(trademark);
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

  console.log(`Собрано товарных знаков: ${data.trademarks.length}, всего: ${data.total_trademarks}`);
  return data;
}