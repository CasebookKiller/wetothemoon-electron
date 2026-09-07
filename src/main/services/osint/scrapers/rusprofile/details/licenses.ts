// src/main/services/osint/scrapers/rusprofile/details/licenses.ts
import { Page } from 'playwright';

// Применение фильтров для лицензий
export async function applyLicensesFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Тип источника (checkbox name="origins")
  if (filters.origins && Array.isArray(filters.origins) && filters.origins.length > 0) {
    for (const origin of filters.origins) {
      const checkbox = page.locator(`input[name="origins"][value="${origin}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Статус (checkbox name="statuses")
  if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    for (const status of filters.statuses) {
      const checkbox = page.locator(`input[name="statuses"][value="${status}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }
}

// Основная функция сбора для лицензий (детальный список)
export async function collectLicensesDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор лицензий для компании ID ${companyId}...`);
  const data: any = { total_licenses: '', licenses: [] };

  const url = `https://www.rusprofile.ru/licenses/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyLicensesFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*лицензии/);
    if (m) data.total_licenses = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество лицензий:', e);
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
      const license: any = {};

      // === Раскрываем "Показать все" ===
      const showMoreButtons = item.locator('.show-more-link');
      const btnCount = await showMoreButtons.count();
      for (let j = 0; j < btnCount; j++) {
        try {
          await showMoreButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Показать все" #${j}:`, e);
        }
      }
      await page.waitForTimeout(500);

      // === Извлекаем данные ===
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value--title');

        // Собираем поля
        const fields: any = {};
        const rows = li.querySelectorAll('.snippet__row');
        rows.forEach(row => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          if (!key) return;

          let value = valueEl.textContent?.trim() || '';

          // Если есть скрытые элементы "rowItem", собираем их все
          const rowItems = valueEl.querySelectorAll('.rowItem');
          if (rowItems.length > 0) {
            const items = Array.from(rowItems).map(el => el.textContent?.trim() || '');
            value = items.join('; ');
          }

          const link = valueEl.querySelector('a');
          if (link) {
            fields[key] = { text: link.textContent?.trim() || value, href: (link as HTMLAnchorElement).href || '' };
          } else {
            fields[key] = value;
          }
        });

        return { status, title, fields };
      });

      license.status = parsed.status;
      const m = parsed.title.match(/№\s*(.+?)\s+от\s*([\d.]+)/);
      if (m) {
        license.license_number = m[1].trim();
        license.issue_date = m[2];
      } else {
        license.license_number = parsed.title;
        license.issue_date = '';
      }
      license.fields = parsed.fields;

      data.licenses.push(license);
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

  console.log(`Собрано лицензий: ${data.licenses.length}, всего: ${data.total_licenses}`);
  return data;
}
