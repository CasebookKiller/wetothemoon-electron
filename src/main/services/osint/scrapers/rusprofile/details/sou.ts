// src/main/services/osint/scrapers/rusprofile/details/sou.ts
import { Page } from 'playwright';

// Применение фильтров для судов общей юрисдикции
export async function applySouFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Роль (radio)
  if (filters.role && filters.role !== 'all') {
    const radio = page.locator(`input[name="role"][value="${filters.role}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Судопроизводство (checkbox types)
  if (filters.types && Array.isArray(filters.types) && filters.types.length > 0) {
    for (const type of filters.types) {
      const checkbox = page.locator(`input[name="types"][value="${type}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Категория (checkbox categories)
  if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
    for (const cat of filters.categories) {
      const checkbox = page.locator(`input[name="categories"][value="${cat}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Регион (checkbox regions)
  if (filters.regions && Array.isArray(filters.regions) && filters.regions.length > 0) {
    for (const region of filters.regions) {
      const checkbox = page.locator(`input[name="regions"][value="${region}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Статус дела (checkbox results)
  if (filters.results && Array.isArray(filters.results) && filters.results.length > 0) {
    for (const result of filters.results) {
      const checkbox = page.locator(`input[name="results"][value="${result}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Точность совпадения (checkbox match_level)
  if (filters.matchLevel && Array.isArray(filters.matchLevel) && filters.matchLevel.length > 0) {
    for (const level of filters.matchLevel) {
      const checkbox = page.locator(`input[name="match_level"][value="${level}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Поиск (номер дела)
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }
}

// Основная функция сбора для судов общей юрисдикции (детальный список)
export async function collectSouDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор детальных судов общей юрисдикции для компании ID ${companyId}...`);
  const data: any = { total_cases: '', cases: [] };

  const souUrl = `https://www.rusprofile.ru/sou/${companyId}`;
  await page.goto(souUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Применяем фильтры (аналогично арбитражу)
  if (options.filters) {
    await applySouFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const mCases = headText.match(/Найдено\s*([\d\s]+)\s*дел/);
    if (mCases) data.total_cases = mCases[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить заголовок судов:', e);
  }

  const maxPages = options.maxPages || 1;
  const maxTotalCases = options.maxTotalCases || 100;
  let collectedCases = 0;
  let currentPage = 1;

  while (currentPage <= maxPages && collectedCases < maxTotalCases) {
    const items = page.locator('li.filters-results__list-item');
    const itemCount = await items.count();

    for (let i = 0; i < itemCount && collectedCases < maxTotalCases; i++) {
      const item = items.nth(i);
      const caseData: any = {};

      // Основные данные
      const basicInfo = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value.--title');

        const fields: any = {};
        const dl = li.querySelector('dl.snippet__block');
        if (dl) {
          const rows = dl.querySelectorAll('.snippet__row');
          rows.forEach((row) => {
            const keyEl = row.querySelector('dt.snippet__row-key');
            const valueEl = row.querySelector('dd.snippet__row-value');
            const key = keyEl ? keyEl.textContent?.trim() || '' : '';
            let value = valueEl ? valueEl.textContent?.trim() || '' : '';
            const link = valueEl?.querySelector('a.snippet__link');
            if (link) {
              value = link.textContent?.trim() || value;
              fields[key] = {
                text: value,
                href: (link as HTMLAnchorElement).href || ''
              };
            } else {
              fields[key] = value;
            }
          });
        }

        // Ссылка на сайт суда
        const sourceLink = li.querySelector("a.snippet__link[href*='mos-gorsud.ru'], a.snippet__link[href*='sudrf.ru']");
        const source_url = sourceLink ? (sourceLink as HTMLAnchorElement).href || '' : '';

        return { status, title, fields, source_url };
      });

      caseData.status = basicInfo.status;
      caseData.fields = basicInfo.fields;
      caseData.source_url = basicInfo.source_url;

      // Парсим номер дела и дату
      const m = basicInfo.title.match(/№\s*([\w\-/]+)\s*от\s*([\d.]+)/);
      if (m) {
        caseData.case_number = m[1];
        caseData.case_date = m[2];
      } else {
        caseData.case_number = basicInfo.title;
        caseData.case_date = '';
      }

      // Раскрываем все инстанции и события
      const moreButton = item.locator('button.snippet__more');
      if (await moreButton.count() > 0) {
        try {
          await moreButton.click();
          await page.waitForTimeout(1000);
        } catch (e) {
          console.warn('Не удалось нажать "Показать все" в судах:', e);
        }
      }

      // Извлекаем события после раскрытия
      const events = await item.evaluate((li) => {
        const blocks = li.querySelectorAll('div.snippet__block');
        let targetBlock: Element | null = null;
        for (const block of blocks) {
          if (block.querySelector('button.snippet__more') || block.querySelector('.snippet__row-value--bold')) {
            targetBlock = block;
            break;
          }
        }
        if (!targetBlock) return [];

        const result: any[] = [];
        const rows = targetBlock.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const timeEl = row.querySelector('time.snippet__row-key');
          const valueEl = row.querySelector('div.snippet__row-value');
          const date = timeEl ? timeEl.textContent?.trim() || '' : '';
          let valueText = valueEl ? valueEl.textContent?.trim() || '' : '';
          let linkHref = '';
          const link = valueEl?.querySelector('a.snippet__link');
          if (link) {
            linkHref = (link as HTMLAnchorElement).href || '';
            valueText = link.textContent?.trim() || valueText;
          }
          let instanceName = '';
          const boldEl = valueEl?.querySelector('.snippet__row-value--bold') || (valueEl && valueEl.classList.contains('snippet__row-value--bold') ? valueEl : null);
          if (boldEl) {
            instanceName = boldEl.textContent?.trim() || '';
          }
          if (date || valueText || instanceName) {
            result.push({ date, text: valueText, link: linkHref, instance: instanceName });
          }
        });
        return result;
      });

      caseData.events = events;

      if (caseData.case_number || caseData.status) {
        data.cases.push(caseData);
        collectedCases++;
      }
    }

    if (currentPage >= maxPages || collectedCases >= maxTotalCases) break;

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

  console.log(`Собрано дел судов: ${data.cases.length}, всего: ${data.total_cases}`);
  return data;
}