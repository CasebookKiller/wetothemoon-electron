// src/main/services/osint/scrapers/rusprofile/details/arbitr.ts
import { Page } from 'playwright';

// Применение фильтров для арбитражных дел
export async function applyArbitrFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Роль (sides)
  if (filters.sides && Array.isArray(filters.sides) && filters.sides.length > 0) {
    const sideValues = filters.sides
      .map((s: string) => {
        switch (s) {
          case 'defendant': return '1';
          case 'plaintiff': return '0';
          case 'third': return '2';
          default: return null;
        }
      })
      .filter(Boolean);

    for (const value of sideValues) {
      const checkbox = page.locator(`input[name="sides"][value="${value}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(500); // даём странице обновиться
      }
    }
  }

  // Статус
  if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
    const statusValues = filters.status
      .map((s: string) => {
        switch (s) {
          case 'in_progress': return '0';
          case 'completed': return '1';
          default: return null;
        }
      })
      .filter(Boolean);

    for (const value of statusValues) {
      const checkbox = page.locator(`input[name="status"][value="${value}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(500);
      }
    }
  }

  // Исходы (пока не реализованы, но можно добавить)
  if (filters.outcomes && Array.isArray(filters.outcomes) && filters.outcomes.length > 0) {
    for (const outcome of filters.outcomes) {
      const checkbox = page.locator(`input[name="outcomes"][value="${outcome}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
        await page.waitForTimeout(500);
      }
    }
  }

  // Категории (если будут переданы)
  if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
    for (const category of filters.categories) {
      const checkbox = page.locator(`input[name="categories"][value="${category}"]`);
      if (await checkbox.count() === 0) {
        // Попытка найти по тексту
        const label = page.locator(`label.choice-input:has-text("${category}") input[name="categories"]`);
        if (await label.count() > 0) {
          await label.check();
          await page.waitForTimeout(500);
        }
      } else {
        await checkbox.check();
        await page.waitForTimeout(500);
      }
    }
  }

  // Поиск (номер дела или ИНН)
  if (filters.search && filters.search.trim() !== '') {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(filters.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(1000);
    }
  }

  // Период (не реализован из-за сложности datepicker, можно добавить позже)
}

// Основная функция сбора арбитражных дел (детальный список)
export async function collectArbitrDetails(
  page: Page,
  companyId: number,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  const data: any = { total_cases: '', total_amount: '', cases: [] };

  const arbitrUrl = `https://www.rusprofile.ru/arbitr/${companyId}`;
  await page.goto(arbitrUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Применяем фильтры, если заданы
  await applyArbitrFilters(page, options.filters);

  // Ждём обновления списка после фильтров
  await page.waitForTimeout(2000);

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const mCases = headText.match(/Найдено\s*([\d\s]+)\s*дел/);
    if (mCases) data.total_cases = mCases[1].replace(/\s/g, '');
    const mAmount = headText.match(/на сумму\s*(.*?)(?:₽|руб)/);
    if (mAmount) data.total_amount = mAmount[1].trim();
  } catch (e) {
    console.log('Не удалось получить заголовок арбитража:', e);
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

        const kadLink = li.querySelector("a.snippet__link[href*='kad.arbitr.ru']");
        const kad_url = kadLink ? (kadLink as HTMLAnchorElement).href || '' : '';

        return { status, title, fields, kad_url };
      });

      caseData.status = basicInfo.status;
      caseData.fields = basicInfo.fields;
      caseData.kad_url = basicInfo.kad_url;

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
          console.warn('Не удалось нажать "Показать все инстанции"', e);
        }
      }

      // Извлекаем все инстанции/события после раскрытия
      const events = await item.evaluate((li) => {
        const blocks = li.querySelectorAll('div.snippet__block');
        // Ищем блок, содержащий кнопку snippet__more или заголовок --bold
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
            result.push({
              date,
              text: valueText,
              link: linkHref,
              instance: instanceName
            });
          }
        });
        return result;
      });

      caseData.events = events;

      // Если не удалось извлечь события, оставляем пустой массив
      if (!caseData.events) caseData.events = [];

      if (caseData.case_number || caseData.status) {
        data.cases.push(caseData);
        collectedCases++;
      }
    }

    if (currentPage >= maxPages || collectedCases >= maxTotalCases) break;

    // Переход на следующую страницу
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

  return data;
}