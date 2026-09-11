// src/main/services/osint/scrapers/rusprofile/details/gz.ts
import { Page } from 'playwright';

// Применение фильтров для госзакупок
export async function applyGzFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Роль (radio)
  if (filters.role && filters.role !== 'all') {
    const radio = page.locator(`input[name="role"][value="${filters.role}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Статус закупки (radio)
  if (filters.purchaseStatus && filters.purchaseStatus !== 'all') {
    const radio = page.locator(`input[name="purchase_status"][value="${filters.purchaseStatus}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Статус контракта (radio)
  if (filters.contractStatus && filters.contractStatus !== 'all') {
    const radio = page.locator(`input[name="contract_status"][value="${filters.contractStatus}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Исполнитель контракта (radio)
  if (filters.isContractor && filters.isContractor !== 'all') {
    const radio = page.locator(`input[name="is_contractor"][value="${filters.isContractor}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Категория закупки (radio)
  if (filters.category && filters.category !== 'all') {
    const radio = page.locator(`input[name="category"][value="${filters.category}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Поиск (input)
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основная функция сбора для санкций (детальный список)
export async function collectGzDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных госзакупок для компании ID ${companyId}...`);
  const data: any = { total_purchases: '', purchases: [] };

  const url = `https://www.rusprofile.ru/gz/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyGzFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*закупок/);
    if (m) data.total_purchases = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество закупок:', e);
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
      const purchase: any = {};

      // === Извлекаем основную закупку ===
      const mainData = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value--title');

        // Извлекаем поля из dl.snippet__block
        const fields: any = {};
        const dl = li.querySelector('dl.snippet__block');
        if (dl) {
          const rows = dl.querySelectorAll('.snippet__row');
          rows.forEach(row => {
            const keyEl = row.querySelector('dt.snippet__row-key');
            const valueEl = row.querySelector('dd.snippet__row-value');
            if (!keyEl || !valueEl) return;
            const key = keyEl.textContent?.trim() || '';
            let value = valueEl.textContent?.trim() || '';
            const link = valueEl.querySelector('a.snippet__link');
            if (link) {
              value = link.textContent?.trim() || value;
              fields[key] = { text: value, href: (link as HTMLAnchorElement).href || '' };
            } else {
              fields[key] = value;
            }
          });
        }

        // Ссылка "Подробнее" на сайт Госзакупок
        const siteLink = li.querySelector("a.snippet__link[href*='zakupki.gov.ru']");
        const site_url = siteLink ? (siteLink as HTMLAnchorElement).href || '' : '';

        return { status, title, fields, site_url };
      });

      purchase.status = mainData.status;
      // Номер и дата закупки
      const m = mainData.title.match(/№\s*([\d]+)\s*от\s*([\d.]+)/);
      if (m) {
        purchase.purchase_number = m[1];
        purchase.purchase_date = m[2];
      } else {
        purchase.purchase_number = mainData.title;
        purchase.purchase_date = '';
      }
      purchase.fields = mainData.fields;
      purchase.site_url = mainData.site_url;

      // === Извлекаем контракт (если есть вложенный .snippet.sub) ===
      const subSnippet = item.locator('div.snippet.sub');
      if (await subSnippet.count() > 0) {
        const contractData = await subSnippet.evaluate((li) => {
          const getText = (selector: string) => {
            const el = li.querySelector(selector);
            return el ? el.textContent?.trim() || '' : '';
          };

          const status = getText('.snippet__status');
          const title = getText('.snippet__row-value--title');

          const fields: any = {};
          const rows = li.querySelectorAll('dl.snippet__block .snippet__row');
          rows.forEach(row => {
            const keyEl = row.querySelector('dt.snippet__row-key');
            const valueEl = row.querySelector('dd.snippet__row-value');
            if (!keyEl || !valueEl) return;
            const key = keyEl.textContent?.trim() || '';
            let value = valueEl.textContent?.trim() || '';
            const link = valueEl.querySelector('a.snippet__link');
            if (link) {
              value = link.textContent?.trim() || value;
              fields[key] = { text: value, href: (link as HTMLAnchorElement).href || '' };
            } else {
              fields[key] = value;
            }
          });

          const siteLink = li.querySelector("a.snippet__link[href*='zakupki.gov.ru']");
          const site_url = siteLink ? (siteLink as HTMLAnchorElement).href || '' : '';

          return { status, title, fields, site_url };
        });

        const contract: any = {};
        contract.status = contractData.status;
        const cm = contractData.title.match(/№\s*([\d]+)\s*от\s*([\d.]+)/);
        if (cm) {
          contract.contract_number = cm[1];
          contract.contract_date = cm[2];
        } else {
          contract.contract_number = contractData.title;
          contract.contract_date = '';
        }
        contract.fields = contractData.fields;
        contract.site_url = contractData.site_url;

        purchase.contract = contract;
      } else {
        purchase.contract = null;
      }

      data.purchases.push(purchase);
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

  console.log(`Собрано закупок: ${data.purchases.length}, всего: ${data.total_purchases}`);
  return data;
}