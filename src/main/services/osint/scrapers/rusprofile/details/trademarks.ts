// src/main/services/osint/scrapers/rusprofile/details/trademarks.ts
import { Page } from 'playwright';

// Применение фильтров для товарных знаков
export async function applyTrademarksFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Только действующие
  if (filters.onlyActual) {
    const checkbox = page.locator('input[name="status"][value="actual"]');
    if (await checkbox.count() > 0) {
      await checkbox.check();
      await page.waitForTimeout(500);
    }
  }

  // Тип товарного знака (radio)
  if (filters.type && filters.type !== 'all') {
    const radio = page.locator(`input[name="type"][value="${filters.type}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Поиск по номеру регистрации
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основная функция сбора для товарных знаков (детальный список)
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
  await page.waitForSelector('ul.filters-results__list, .trademarks-list, .similar-table-container', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Применяем фильтры
  if (options.filters) {
    await applyTrademarksFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*товарных знаков?/i) || headText.match(/Найдено\s*([\d\s]+)/);
    if (m) data.total_trademarks = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество товарных знаков:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collected = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collected < maxTotalCases) {
    // Здесь предполагаем, что каждый товарный знак находится в li.filters-results__list-item
    // Если структура другая, замените селектор
    const items = page.locator('li.filters-results__list-item, .trademark-item, .tm_item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collected < maxTotalCases; i++) {
      const item = items.nth(i);
      const trademark: any = {};

      // Извлекаем данные через evaluate
      const details = await item.evaluate((el) => {
        const getText = (selector: string) => {
          const node = el.querySelector(selector);
          return node ? node.textContent?.trim() || '' : '';
        };

        const id = getText('.tm_item__link, .trademark-item__number, .snippet__row-value--title');
        const status = getText('.tm_status, .snippet__status');
        const type = getText("dl:has-text('Тип') dd, .trademark-item__type");
        const regDate = getText("dl:has-text('Дата регистрации') dd, .trademark-item__date");
        const expires = getText("dl:has-text('Истекает') dd, .trademark-item__expires");
        const classes = getText('.tm_classes, .trademark-item__classes');

        return { id, status, type, regDate, expires, classes };
      });

      trademark.id = details.id;
      trademark.status = details.status;
      trademark.type = details.type;
      trademark.registration_date = details.regDate;
      trademark.expires = details.expires;
      trademark.classes = details.classes;

      if (trademark.id || trademark.status) {
        data.trademarks.push(trademark);
        collected++;
      }
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

    // Пагинация (если есть)
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
