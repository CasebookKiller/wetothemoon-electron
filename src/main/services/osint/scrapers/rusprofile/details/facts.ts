// src/main/services/osint/scrapers/rusprofile/details/facts.ts
import { Page } from 'playwright';

// Применение фильтров для существенных фактов
export async function applyFactsFilters(page: Page, filters?: any): Promise<void> {
  if (!filters) return;

  // Категория (radio name="group")
  if (filters.group && filters.group !== 'all') {
    const radio = page.locator(`input[name="group"][value="${filters.group}"]`);
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(500);
    }
  }

  // Аннулированные сообщения (checkbox)
  if (filters.withAnnulled) {
    const checkbox = page.locator('input[name="with_annulled"][value="1"]');
    if (await checkbox.count() > 0) {
      await checkbox.check();
      await page.waitForTimeout(500);
    }
  }
}

// Основная функция сбора для существенных фактов (детальный список) 
export async function collectFactsDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    filters?: any;
  } = {}
): Promise<any> {
  console.log(`Сбор существенных фактов для компании ID ${companyId}...`);
  const data: any = { total_messages: '', facts: [] };

  const url = `https://www.rusprofile.ru/facts/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  if (options.filters) {
    await applyFactsFilters(page, options.filters);
    await page.waitForTimeout(2000);
  }

  try {
    const headText = await page.locator('div.export-data__text, .filters-results__head').first().innerText();
    const m = headText.match(/Найдено\s*([\d\s]+)\s*сообщений?/);
    if (m) data.total_messages = m[1].replace(/\s/g, '');
  } catch (e) {
    console.log('Не удалось получить общее количество сообщений:', e);
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
      const fact: any = {};

      // === Раскрываем все скрытые блоки ===
      // Кнопки "Показать полностью" (текст комментария)
      const moreButtons = item.locator('a.snippet__more:not(.snippet__more--force)');
      const moreCount = await moreButtons.count();
      for (let j = 0; j < moreCount; j++) {
        try {
          await moreButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Показать полностью" #${j}:`, e);
        }
      }

      // Кнопки "Показать всех" (список кредиторов)
      const forceButtons = item.locator('a.snippet__more--force');
      const forceCount = await forceButtons.count();
      for (let j = 0; j < forceCount; j++) {
        try {
          await forceButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Показать всех" #${j}:`, e);
        }
      }

      await page.waitForTimeout(500); // ждём полного раскрытия

      // === Извлекаем данные ===
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        // Заголовок (тип сообщения)
        const title = getText('.snippet__row-value--title');

        // Сообщение (номер и дата)
        const message = getText('.snippet__row-value span');
        // Публикатор
        const publisherLink = li.querySelector('a.snipper__link');
        const publisher = publisherLink ? publisherLink.textContent?.trim() || '' : '';
        const publisherHref = publisherLink ? (publisherLink as HTMLAnchorElement).href || '' : '';

        // Должник/Кредитор (находим все строки)
        const fields: any = {};
        const rows = li.querySelectorAll('div.snippet__row');
        rows.forEach((row) => {
          const keyEl = row.querySelector('.snippet__row-key');
          const valueEl = row.querySelector('.snippet__row-value');
          if (!keyEl || !valueEl) return;
          const key = keyEl.textContent?.trim() || '';
          const value = valueEl.textContent?.trim() || '';
          if (key && !key.includes('--subtitle') && key !== 'Комментарий публикатора') {
            fields[key] = value;
          }
        });

        // Полный текст комментария
        let comment = '';
        const commentBlock = li.querySelector('.snippet__row--comment .truncate-text');
        if (commentBlock) comment = commentBlock.textContent?.trim() || '';

        // Список кредиторов (если есть)
        const creditors: any[] = [];
        const creditorsContainer = li.querySelector('.creditors-list');
        if (creditorsContainer) {
          const creditorLinks = creditorsContainer.querySelectorAll('a.snipper__link');
          creditorLinks.forEach(link => {
            creditors.push({
              name: link.textContent?.trim() || '',
              href: (link as HTMLAnchorElement).href || ''
            });
          });
          // Также могут быть span без ссылок (иностранные организации)
          creditorsContainer.querySelectorAll('span').forEach(span => {
            const text = span.textContent?.trim() || '';
            if (text && !span.querySelector('a')) {
              creditors.push({ name: text, href: '' });
            }
          });
        }

        // Документы
        const documents: any[] = [];
        const docItems = li.querySelectorAll('.docs-item');
        docItems.forEach(doc => {
          const text = doc.textContent?.trim() || '';
          const guid = (doc as HTMLElement).getAttribute('data-file-guid') || '';
          if (text || guid) documents.push({ name: text, guid });
        });

        return { title, message, publisher, publisherHref, fields, comment, creditors, documents };
      });

      fact.title = parsed.title;
      fact.message = parsed.message;
      fact.publisher = parsed.publisher;
      fact.publisher_href = parsed.publisherHref;
      fact.fields = parsed.fields;
      fact.comment = parsed.comment;
      fact.creditors = parsed.creditors;
      fact.documents = parsed.documents;

      if (fact.title || fact.message) {
        data.facts.push(fact);
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

  console.log(`Собрано фактов: ${data.facts.length}, всего: ${data.total_messages}`);
  return data;
}
