// src/main/services/osint/scrapers/rusprofile/details/pledges.ts
import { Page } from 'playwright';

// Применение фильтров для залога
export async function applyPledgeFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  if (filters.role && filters.role !== 'all') {
    const radio = page.locator(`input[name="role"][value="${filters.role}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  if (filters.status && filters.status !== 'all') {
    const radio = page.locator(`input[name="status"][value="${filters.status}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  if (filters.code && filters.code !== 'all') {
    const radio = page.locator(`input[name="code"][value="${filters.code}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }
}

// Основная функция сбора для залогов (детальный список)
export async function collectPledgesDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных залогов для компании ID ${companyId}...`);
  const data: any = { total_messages: '', pledges: [] };

  const url = `https://www.rusprofile.ru/pledge/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyPledgeFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*сообщений о залогах/);
    if (m) data.total_messages = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество сообщений о залогах:', e);
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
      const pledge: any = {};

      // === Раскрываем все "Показать полностью" и "Показать ещё" ===
      const showMoreButtons = item.locator('.show-more-link');
      const buttonCount = await showMoreButtons.count();
      for (let j = 0; j < buttonCount; j++) {
        try {
          await showMoreButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Показать" #${j}:`, e);
        }
      }
      await page.waitForTimeout(500); // даём время на раскрытие

      // === Раскрываем связанные сообщения (если есть) ===
      const pledgeTriggers = item.locator('.pledge-changes-trigger');
      const triggerCount = await pledgeTriggers.count();
      for (let j = 0; j < triggerCount; j++) {
        try {
          await pledgeTriggers.nth(j).click({ force: true });
          await page.waitForTimeout(500);
        } catch (e) {
          console.warn(`Не удалось раскрыть связанное сообщение #${j}:`, e);
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
        const title = getText('.snippet__row-value.--title');

        // Основные поля
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

        // Сведения о заложенном имуществе
        const pledgedItems: any[] = [];
        const mortgageBlocks = li.querySelectorAll('.snippet__block-mortaged');
        mortgageBlocks.forEach((block) => {
          const item: any = {};
          block.querySelectorAll('.snippet__row').forEach(row => {
            const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
            const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
            if (key) item[key] = value;
          });
          if (Object.keys(item).length) pledgedItems.push(item);
        });

        // Документы
        const documents: string[] = [];
        const docLinks = li.querySelectorAll('a.snippet__link--document');
        docLinks.forEach(link => {
          const text = link.textContent?.trim() || '';
          if (text) documents.push(text);
        });

        // Связанные сообщения
        const changes: any[] = [];
        const changeItems = li.querySelectorAll('.pledge-changes-item');
        changeItems.forEach((changeItem) => {
          const date = changeItem.querySelector('.pledge-changes-trigger__date')?.textContent?.trim() || '';
          const text = changeItem.querySelector('.pledge-changes-trigger__text')?.textContent?.trim() || '';

          // Детали из раскрытого контейнера
          const details: any[] = [];
          const container = changeItem.querySelector('.pledge-changes-container');
          if (container) {
            container.querySelectorAll('.snippet__row').forEach(row => {
              const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
              const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
              if (key) details.push({ key, value });
            });
          }

          changes.push({ date, text, details });
        });

        return { status, title, fields, pledgedItems, documents, changes };
      });

      pledge.status = parsed.status;
      const m = parsed.title.match(/№\s*(\d+)\s*от\s*([\d.]+)/);
      if (m) {
        pledge.message_number = m[1];
        pledge.message_date = m[2];
      } else {
        pledge.message_number = parsed.title;
        pledge.message_date = '';
      }
      pledge.fields = parsed.fields;
      pledge.pledged_items = parsed.pledgedItems;
      pledge.documents = parsed.documents;
      pledge.related_messages = parsed.changes;

      if (pledge.message_number || pledge.status) {
        data.pledges.push(pledge);
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

  console.log(`Собрано сообщений о залогах: ${data.pledges.length}, всего: ${data.total_messages}`);
  return data;
}
