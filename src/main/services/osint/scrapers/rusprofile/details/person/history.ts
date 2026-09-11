// src/main/services/osint/scrapers/rusprofile/details/person/history.ts
import { Page } from 'playwright';

export async function collectPersonHistoryDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор истории для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/history`;

  const data: any = {
    total_events: '',
    history: [],
  };

  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть /history:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница /history недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('ul.filters-results__list, .content-frame, .history-box', { timeout: 15000 });
  } catch {
    console.log('Список истории не появился');
  }
  await page.waitForTimeout(500);

  // Общее количество (по фолбэку)
  try {
    let total: string | null = null;
    const selectors = ['.filters-pagination__notice', '.export-data__text'];
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        try {
          const text = await el.innerText({ timeout: 2000 });
          if (text) {
            const m = text.match(/из\s*([\d\s]+)/) || text.match(/([\d\s]+)/);
            if (m) { total = m[1].replace(/\s/g, ''); break; }
          }
        } catch { /* skip */ }
      }
    }
    if (!total) {
      const count = await page.locator('li.filters-results__list-item').count();
      total = String(count);
    }
    data.total_events = total;
  } catch (e) {
    console.log('Не удалось получить общее количество событий:', e);
  }

  const parsed = await page.evaluate(() => {
    const result: any = { history: [] };

    const items = document.querySelectorAll('li.filters-results__list-item');
    items.forEach((item) => {
      const date = item.querySelector('.history-box__header-title')?.textContent?.trim() || '';

      const groups: any[] = [];
      item.querySelectorAll('.history-box__item').forEach((groupEl) => {
        const title = groupEl.querySelector('.history-box__item-title')?.textContent?.trim() || '';
        const entries: any[] = [];

        groupEl.querySelectorAll('li').forEach((entryEl) => {
          let text = entryEl.textContent?.replace(/\s+/g, ' ').trim() || '';
          const links: any[] = [];
          entryEl.querySelectorAll('a').forEach((link) => {
            links.push({
              text: link.textContent?.trim() || '',
              href: (link as HTMLAnchorElement).href || '',
            });
          });
          entries.push({ text, links });
        });

        groups.push({ title, entries });
      });

      if (date || groups.length > 0) {
        result.history.push({ date, groups });
      }
    });

    return result;
  });

  data.history = parsed.history;

  console.log(`Собрано истории (ФЛ): ${data.history.length}, всего: ${data.total_events}`);
  return data;
}