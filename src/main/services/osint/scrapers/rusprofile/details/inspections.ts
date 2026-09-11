// src/main/services/osint/scrapers/rusprofile/details/inspections.ts
import { Page } from 'playwright';

// Применение фильтров для проверка
export async function applyInspectionsFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Тип (checkbox name="planned")
  if (filters.planned && Array.isArray(filters.planned) && filters.planned.length > 0) {
    for (const value of filters.planned) {
      const checkbox = page.locator(`input[name="planned"][value="${value}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Статус (checkbox name="status")
  if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    for (const value of filters.statuses) {
      const checkbox = page.locator(`input[name="status"][value="${value}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }

  // Результат (checkbox name="result")
  if (filters.results && Array.isArray(filters.results) && filters.results.length > 0) {
    for (const value of filters.results) {
      const checkbox = page.locator(`input[name="result"][value="${value}"]`);
      if (await checkbox.count() > 0 && await checkbox.isEnabled()) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
    }
  }
}

// Основная функция сбора для проверок (детальный список)
export async function collectInspectionsDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор проверок для компании ID ${companyId}...`);
  const data: any = { total_inspections: '', inspections: [] };

  const url = `https://www.rusprofile.ru/inspections/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyInspectionsFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  // Заголовок с общим количеством
  try {
    const headText = await page.locator('div.export-data__text').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*проверок/);
    if (m) data.total_inspections = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество проверок:', e);
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
      const inspection: any = {};

      // === Раскрываем все "Подробнее" и "Подробнее" внутри результата ===
      const moreButtons = item.locator('button.snippet__more, button.snippet__value-more');
      const btnCount = await moreButtons.count();
      for (let j = 0; j < btnCount; j++) {
        try {
          await moreButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось раскрыть детали #${j}:`, e);
        }
      }
      await page.waitForTimeout(500); // ждём полного раскрытия

      // === Извлекаем данные ===
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        const status = getText('.snippet__status');
        const title = getText('.snippet__row-value--title');

        // Собираем все пары ключ-значение
        const fields: any = {};
        const rows = li.querySelectorAll('.snippet__row');
        rows.forEach(row => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          if (!key) return; // пропускаем пустые ключи

          // Проверяем, есть ли скрытый текст внутри value (после раскрытия)
          let value = valueEl.textContent?.trim() || '';

          // Если есть под-текст (sub-text), берём его тоже
          const subTextEl = row.querySelector('.sub-text');
          if (subTextEl) {
            const subText = subTextEl.textContent?.trim() || '';
            if (subText) value += '\n' + subText;
          }

          // Ищем ссылку внутри значения
          const link = valueEl.querySelector('a');
          if (link) {
            fields[key] = {
              text: link.textContent?.trim() || value,
              href: (link as HTMLAnchorElement).href || ''
            };
          } else {
            fields[key] = value;
          }
        });

        // Ссылка на сайт Генпрокуратуры (из под-текста)
        const proverkiLink = li.querySelector("a[href*='proverki.gov.ru']");
        const proverki_url = proverkiLink ? (proverkiLink as HTMLAnchorElement).href || '' : '';

        return { status, title, fields, proverki_url };
      });

      inspection.status = parsed.status;
      // Номер и дата из title
      const m = parsed.title.match(/№\s*([\d]+)\s*от\s*([\d.]+)/);
      if (m) {
        inspection.inspection_number = m[1];
        inspection.inspection_date = m[2];
      } else {
        inspection.inspection_number = parsed.title;
        inspection.inspection_date = '';
      }
      inspection.fields = parsed.fields;
      inspection.proverki_url = parsed.proverki_url;

      data.inspections.push(inspection);
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

  console.log(`Собрано проверок: ${data.inspections.length}, всего: ${data.total_inspections}`);
  return data;
}