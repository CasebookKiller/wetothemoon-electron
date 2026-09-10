// src/main/services/osint/scrapers/rusprofile/details/history.ts
import { Page } from 'playwright';

// Применение фильтров для истории
export async function applyHistoryFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Только важные события (checkbox)
  if (filters.importantOnly) {
    const checkbox = page.locator('input[name="critical"][value="1"]');
    if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
      await checkbox.check();
      await page.waitForTimeout(300);
    }
  }

  // Радио-фильтры категорий
  const radioGroups = [
    'egrul', 'bankruptcy', 'sanctions', 'fns', 'kad', 'sou', 'fssp',
    'gz', 'license', 'leasing', 'pledge', 'trademarks'
  ];

  for (const group of radioGroups) {
    const value = filters[group];
    if (value && value !== 'all') {
      const radio = page.locator(`input[name="${group}"][value="${value}"]`);
      if (await radio.count() > 0 && await radio.isEnabled()) {
        await radio.check();
        await page.waitForTimeout(300);
      }
    }
  }
}

// Основная функция сбора для история (детальный список)
export async function collectHistoryDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор исторических сведений для компании ID ${companyId}...`);
  const data: any = { total_events: '', history: [] };

  const url = `https://www.rusprofile.ru/history/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForSelector('ul.filters-results__list', { timeout: 5000 });
  } catch {
    console.log('Список истории не появился (возможно, нет событий)');
  }
  await page.waitForTimeout(500);

  if (options.filters) {
    await applyHistoryFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Общее количество событий: пагинация может быть скрыта, если записей мало.
  // Сначала пробуем найти счётчик «из N», затем — количество <li> на странице.
  try {
    let total: string | null = null;
    const paginationSelectors = [
      '.filters-pagination__notice',
      '.export-data__text',
      '.filters-results__head .export-data__text',
    ];

    for (const sel of paginationSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        try {
          const text = await el.innerText({ timeout: 2000 });
          if (text) {
            const m = text.match(/из\s*([\d\s]+)/) || text.match(/([\d\s]+)/);
            if (m) {
              total = m[1].replace(/\s/g, '');
              break;
            }
          }
        } catch {
          // пропускаем
        }
      }
    }

    if (!total) {
      // Счётчика нет — считаем элементы на странице
      const count = await page.locator('li.filters-results__list-item').count();
      total = String(count);
    }

    data.total_events = total;
  } catch (e) {
    console.log('Не удалось получить общее количество событий:', e);
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
      const historyEntry: any = {};

      // === Раскрываем скрытые тексты ===
      const togglers = item.locator('.fakelink.toggler');
      const togglerCount = await togglers.count();
      for (let j = 0; j < togglerCount; j++) {
        try {
          const text = await togglers.nth(j).innerText();
          if (text.includes('показать все')) {
            await togglers.nth(j).click({ force: true });
            await page.waitForTimeout(200);
          }
        } catch (e) {
          console.warn(`Не удалось раскрыть текст #${j}:`, e);
        }
      }
      await page.waitForTimeout(300);

      // === Извлекаем данные ===
      const parsed = await item.evaluate((li) => {
        // Дата
        const date = li.querySelector('.history-box__header-title')?.textContent?.trim() || '';

        // Группы событий
        const groups: any[] = [];
        const groupEls = li.querySelectorAll('.history-box__item');
        groupEls.forEach(groupEl => {
          const title = groupEl.querySelector('.history-box__item-title')?.textContent?.trim() || '';
          const entries: any[] = [];

          const entryEls = groupEl.querySelectorAll('li');
          entryEls.forEach(entryEl => {
            // Текст записи
            let text = entryEl.textContent?.trim() || '';
            // Удаляем лишние пробелы
            text = text.replace(/\s+/g, ' ').trim();

            // Ссылки внутри записи
            const links: any[] = [];
            const linkEls = entryEl.querySelectorAll('a');
            linkEls.forEach(link => {
              links.push({
                text: link.textContent?.trim() || '',
                href: (link as HTMLAnchorElement).href || ''
              });
            });

            entries.push({ text, links });
          });

          groups.push({ title, entries });
        });

        // Ссылка "Смотреть детально"
        let detailsHref = '';
        const detailsLink = li.querySelector('a.history-box__item-more');
        if (detailsLink) detailsHref = (detailsLink as HTMLAnchorElement).href || '';

        return { date, groups, detailsHref };
      });

      historyEntry.date = parsed.date;
      historyEntry.groups = parsed.groups;
      historyEntry.details_href = parsed.detailsHref;

      if (historyEntry.date || historyEntry.groups.length > 0) {
        data.history.push(historyEntry);
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

  console.log(`Собрано записей истории: ${data.history.length}, всего событий: ${data.total_events}`);
  return data;
}