// src/main/services/osint/scrapers/rusprofile/details/leasing.ts
import { Page } from 'playwright';

// Применение фильтров для лизинга
export async function applyLeasingFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Роль (radio)
  if (filters.role && filters.role !== 'all') {
    const radio = page.locator(`input[name="role"][value="${filters.role}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Статус (radio)
  if (filters.status && filters.status !== 'all') {
    const radio = page.locator(`input[name="status"][value="${filters.status}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Предмет аренды (radio)
  if (filters.code && filters.code !== 'all') {
    const radio = page.locator(`input[name="code"][value="${filters.code}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Поиск
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основая функция сбора для лизинга (детальный списрк)
export async function collectLeasingDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детального лизинга для компании ID ${companyId}...`);
  const data: any = { total_contracts: '', contracts: [] };

  const url = `https://www.rusprofile.ru/leasing/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyLeasingFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*договоров? лизинга/);
    if (m) data.total_contracts = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество договоров лизинга:', e);
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
      const contract: any = {};

      // === Раскрываем связанные сообщения (исправлено) ===
      const triggerLinks = item.locator('.leasing-changes-trigger__link');
      const triggerCount = await triggerLinks.count();
      for (let j = 0; j < triggerCount; j++) {
        const link = triggerLinks.nth(j);
        try {
          const parentTrigger = link.locator('..'); // .leasing-changes-trigger
          const container = parentTrigger.locator('.leasing-changes-container');
          if (await container.count() === 0) {
            // Кликаем по текстовой части
            await link.click({ force: true });
            await page.waitForTimeout(500);
            // Если контейнер не появился, кликаем по родительскому триггеру
            if (await container.count() === 0) {
              await parentTrigger.click({ force: true });
              await page.waitForTimeout(500);
            }
          }
        } catch (e) {
          console.warn(`Не удалось раскрыть сообщение #${j}:`, e);
        }
      }
      await page.waitForTimeout(500); // даём время на полное раскрытие всех контейнеров

      // === Извлекаем данные ===
      const basic = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value.--title');

        // Основные поля карточки
        const fields: any = {};
        const rows = li.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          const value = valueEl.textContent?.trim() || '';
          if (key && !key.includes('--subtitle')) {
            fields[key] = value;
          }
        });

        // Предметы финансовой аренды (вложенные блоки)
        const leaseItems: any[] = [];
        const blocks = li.querySelectorAll('div.snippet__block');
        blocks.forEach((block) => {
          const innerRows = block.querySelectorAll('.snippet__row');
          if (innerRows.length > 0) {
            const hasLeaseFields = Array.from(innerRows).some(row => {
              const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
              return ['Идентификатор', 'Классификация', 'Описание'].includes(key);
            });
            if (hasLeaseFields) {
              const leaseItem: any = {};
              innerRows.forEach(row => {
                const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
                const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
                if (key) leaseItem[key] = value;
              });
              leaseItems.push(leaseItem);
            }
          }
        });

        // Связанные сообщения с раскрытыми контейнерами
        const changes: any[] = [];
        const changeItems = li.querySelectorAll('.leasing-changes-item');
        changeItems.forEach((changeItem) => {
          const date = changeItem.querySelector('.leasing-changes-trigger__date')?.textContent?.trim() || '';
          const text = changeItem.querySelector('.leasing-changes-trigger__text')?.textContent?.trim() || '';

          // Ищем контейнер с деталями
          const container = changeItem.querySelector('.leasing-changes-container');
          const details: any[] = [];
          if (container) {
            const detailRows = container.querySelectorAll('.snippet__row');
            detailRows.forEach(row => {
              const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
              const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
              if (key) {
                details.push({ key, value });
              }
            });

            const relatedBlocks = container.querySelectorAll('.snippet__block-related');
            relatedBlocks.forEach(block => {
              const related: any[] = [];
              block.querySelectorAll('.snippet__row').forEach(row => {
                const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
                const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
                if (key) related.push({ key, value });
              });
              if (related.length) details.push({ related });
            });
          }

          changes.push({ date, text, details });
        });

        return { status, title, fields, leaseItems, changes };
      });

      contract.status = basic.status;
      const m = basic.title.match(/№\s*([\w\-/]+)\s*от\s*([\d.]+)/);
      if (m) {
        contract.contract_number = m[1];
        contract.contract_date = m[2];
      } else {
        contract.contract_number = basic.title;
        contract.contract_date = '';
      }
      contract.fields = basic.fields;
      contract.lease_subjects = basic.leaseItems;
      contract.related_messages = basic.changes;

      if (contract.contract_number || contract.status) {
        data.contracts.push(contract);
        collected++;
      }
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

  console.log(`Собрано договоров лизинга: ${data.contracts.length}, всего: ${data.total_contracts}`);
  return data;
}

