// src/main/services/osint/scrapers/rusprofile/details/fssp.ts
import { Page } from 'playwright';

// Применение фильтров для исполнительного производства
export async function applyFsspFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Статус (checkbox)
  if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    for (const status of filters.statuses) {
      const checkbox = page.locator(`input[name="status"][value="${status}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Предмет (checkbox)
  if (filters.objects && Array.isArray(filters.objects) && filters.objects.length > 0) {
    for (const obj of filters.objects) {
      const checkbox = page.locator(`input[name="object"][value="${obj}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Сумма (checkbox)
  if (filters.due && Array.isArray(filters.due) && filters.due.length > 0) {
    for (const due of filters.due) {
      const checkbox = page.locator(`input[name="due"][value="${due}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Поиск (если будет поле)
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основная функция сбора для исполнительного производства (детальный список)
export async function collectFsspDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор исполнительных производств для компании ID ${companyId}...`);
  const data: any = { total_productions: '', productions: [] };

  const url = `https://www.rusprofile.ru/fssp/${companyId}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
    await page.waitForTimeout(1000);
  } catch (error) {
    console.warn('Не удалось загрузить страницу ФССП, пропускаем сбор:', error);
    return data; // вернёт { total_productions: '', productions: [] }
  }

  if (options.filters) {
    await applyFsspFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*производств/);
    if (m) data.total_productions = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество производств:', e);
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
      const production: any = {};

      // Извлекаем данные
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value--title');

        // Извлекаем пары ключ-значение
        const fields: any = {};
        const rows = li.querySelectorAll('.snippet__row');
        rows.forEach(row => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          if (!key) return; // пропускаем пустые ключи (например, заголовок)

          // Проверяем наличие ссылки внутри значения
          const link = valueEl.querySelector('a.snippet__link');
          if (link) {
            fields[key] = {
              text: link.textContent?.trim() || valueEl.textContent?.trim() || '',
              href: (link as HTMLAnchorElement).href || ''
            };
          } else {
            fields[key] = valueEl.textContent?.trim() || '';
          }
        });

        return { status, title, fields };
      });

      production.status = parsed.status;
      // Номер и дата из title
      const m = parsed.title.match(/№\s*([\w\-/]+)\s*от\s*([\d.]+)/);
      if (m) {
        production.production_number = m[1];
        production.production_date = m[2];
      } else {
        production.production_number = parsed.title;
        production.production_date = '';
      }
      production.fields = parsed.fields;

      data.productions.push(production);
      collected++;
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

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

  console.log(`Собрано исполнительных производств: ${data.productions.length}, всего: ${data.total_productions}`);
  return data;
}