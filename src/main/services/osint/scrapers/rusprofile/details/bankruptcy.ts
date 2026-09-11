// src/main/services/osint/scrapers/rusprofile/details/bankruptcy.ts
import { Page } from 'playwright';

// Основная функция сбора для банкротства (детальный список)
export async function collectBankruptcyDetails(
  page: Page,
  companyId: number | string,
  options: {
    maxPages?: number;
    maxTotalCases?: number;
    search?: string;
  } = {}
): Promise<any> {
  console.log(`Сбор банкротства для компании ID ${companyId}...`);
  const data: any = { total_messages: '', messages: [] };

  const url = `https://www.rusprofile.ru/bankruptcy/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('ul.filters-results__list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Поиск (если задан)
  if (options.search && options.search.trim() !== '') {
    const searchInput = page.locator('input[name="number"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(options.search.trim());
      await page.locator('button.filters-panel__base-input-btn').first().click();
      await page.waitForTimeout(2000);
    }
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
      const message: any = {};

      // === Раскрываем "Подробнее" ===
      const detailButtons = item.locator('button.snippet__more');
      const btnCount = await detailButtons.count();
      for (let j = 0; j < btnCount; j++) {
        try {
          await detailButtons.nth(j).click({ force: true });
          await page.waitForTimeout(300);
        } catch (e) {
          console.warn(`Не удалось нажать "Подробнее" #${j}:`, e);
        }
      }
      await page.waitForTimeout(500); // ждём раскрытия

      // === Извлекаем данные ===
      const parsed = await item.evaluate((li) => {
        const getText = (selector: string) => {
          const el = li.querySelector(selector);
          return el ? el.textContent?.trim() || '' : '';
        };

        // Заголовок (тип события)
        const title = getText('.snippet__row-value--title');

        // Номер и дата (строка с ключом "№")
        let number = '';
        let date = '';
        const rows = li.querySelectorAll('.snippet__row');
        rows.forEach(row => {
          const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
          if (key === '№') {
            const value = row.querySelector('.snippet__row-value')?.textContent?.trim() || '';
            const m = value.match(/(\d+)\s*от\s*([\d.,\s:]+)/);
            if (m) {
              number = m[1];
              date = m[2].trim();
            } else {
              number = value;
            }
          }
        });

        // Кредиторы (могут быть ссылки)
        const creditors: any[] = [];
        const creditorRows = li.querySelectorAll('.snippet__row');
        creditorRows.forEach(row => {
          const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
          if (key === 'Кредиторы') {
            const valueEl = row.querySelector('.snippet__row-value');
            if (valueEl) {
              valueEl.querySelectorAll('a.snipper__link').forEach(link => {
                creditors.push({
                  name: link.textContent?.trim() || '',
                  href: (link as HTMLAnchorElement).href || ''
                });
              });
            }
          }
        });

        // Публикатор
        const pubRow = li.querySelector('.snippet__row-key');
        let publisher = '';
        let publisherHref = '';
        rows.forEach(row => {
          const key = row.querySelector('.snippet__row-key')?.textContent?.trim() || '';
          if (key === 'Публикатор') {
            const link = row.querySelector('a.snipper__link');
            if (link) {
              publisher = link.textContent?.trim() || '';
              publisherHref = (link as HTMLAnchorElement).href || '';
            }
          }
        });

        // Полный текст сообщения (после раскрытия)
        let fullText = '';
        const overflowEl = li.querySelector('.snippet__text-overflow');
        if (overflowEl) fullText = overflowEl.textContent?.trim() || '';

        return { title, number, date, creditors, publisher, publisherHref, fullText };
      });

      message.title = parsed.title;
      message.number = parsed.number;
      message.date = parsed.date;
      message.creditors = parsed.creditors;
      message.publisher = parsed.publisher;
      message.publisher_href = parsed.publisherHref;
      message.full_text = parsed.fullText;

      if (message.title || message.number) {
        data.messages.push(message);
        collected++;
      }
    }

    if (currentPage >= maxPages || collected >= maxTotalCases) break;

    // Пагинация (обычно для банкротства небольшое количество, но предусмотрим)
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

  console.log(`Собрано сообщений о банкротстве: ${data.messages.length}`);
  return data;
}
