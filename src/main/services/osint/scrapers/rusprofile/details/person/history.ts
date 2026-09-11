// src/main/services/osint/scrapers/rusprofile/details/person/history.ts
import { Page } from 'playwright';

export async function collectPersonHistoryDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор истории для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/history`;

  const data: any = {
    title: '',
    description: '',
    total_events: '',
    filter_tabs: [],
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
    await page.waitForSelector('.history-wrapper, .history-box, .content-frame__title', { timeout: 15000 });
  } catch {
    console.log('История ФЛ не найдена');
  }
  await page.waitForTimeout(500);

  const parsed = await page.evaluate(() => {
    const result: any = {
      title: '',
      description: '',
      total_events: '',
      filter_tabs: [],
      history: [],
    };

    // Заголовок и описание
    result.title = document.querySelector('.content-frame__title')?.textContent?.trim() || '';
    result.description = document.querySelector('.content-frame__description')?.textContent?.replace(/\s+/g, ' ').trim() || '';

    // Общее количество: "Выбрано 27 из 27"
    const infoText = document.querySelector('.filter-block__info-text')?.textContent?.trim() || '';
    const totalMatch = infoText.match(/из\s*([\d\s]+)/);
    if (totalMatch) {
      result.total_events = totalMatch[1].replace(/\s/g, '');
    }

    // Табы фильтрации
    document.querySelectorAll('.filter-block__item .custom-select__tab').forEach((tab) => {
      const text = tab.textContent?.trim() || '';
      const href = (tab as HTMLAnchorElement).href || '';
      if (text) result.filter_tabs.push({ text, href });
    });

    // Каждый .history-box — одна дата
    document.querySelectorAll('.history-wrapper .history-box').forEach((box) => {
      const date = box.querySelector('.history-box__header-title')?.textContent?.trim() || '';
      if (!date) return;

      const groups: any[] = [];

      // Внутри бокса может быть несколько .history-box__item (например, "Участие в организациях" и "События ИП")
      box.querySelectorAll('.history-box__item').forEach((groupEl) => {
        const title = groupEl.querySelector('.history-box__item-title')?.textContent?.trim() || '';

        const entries: any[] = [];
        groupEl.querySelectorAll('.history-box__item-list > li').forEach((li) => {
          const textEl = li.querySelector('.history-box__item-list-text');
          if (!textEl) return;

          // Собираем чистый текст, но сохраняем ссылки
          // Убираем лишние пробелы/переносы
          let fullText = textEl.textContent?.replace(/\s+/g, ' ').trim() || '';

          const links: any[] = [];
          textEl.querySelectorAll('a').forEach((a) => {
            const linkText = a.textContent?.trim() || '';
            const href = (a as HTMLAnchorElement).href || '';
            // Пропускаем пустые ссылки (типа <a href="/id/"> </a> без текста)
            if (href) links.push({ text: linkText, href });
          });

          // Статус (warning / success и т.п.)
          const icon = li.querySelector('i')?.getAttribute('data-ico') || '';
          const level = icon === 'warning' ? 'warning'
                      : icon === 'success' ? 'success'
                      : icon === 'danger' ? 'danger'
                      : 'info';

          if (fullText || links.length > 0) {
            entries.push({ text: fullText, level, links });
          }
        });

        if (title || entries.length > 0) {
          groups.push({ title, entries });
        }
      });

      if (groups.length > 0) {
        result.history.push({ date, groups });
      }
    });

    return result;
  });

  data.title = parsed.title;
  data.description = parsed.description;
  data.total_events = parsed.total_events;
  data.filter_tabs = parsed.filter_tabs;
  data.history = parsed.history;

  console.log(`Собрано истории (ФЛ): ${data.history.length} дат, всего событий: ${data.total_events}`);
  return data;
}