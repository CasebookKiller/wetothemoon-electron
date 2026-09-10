// Основная функция сбора для оквед (детальный список)
// src/main/services/osint/scrapers/rusprofile/details/okved.ts
import { Page } from 'playwright';

export async function collectOkvedDetails(
  page: Page,
  companyId: number,
  options: { maxTotalCases?: number } = {}
): Promise<any> {
  console.log(`Сбор видов деятельности для компании ID ${companyId}...`);
  const data: any = {
    industry: '',
    main_activity: '',
    region: '',
    average_revenue: '',
    top_companies: [],
    additional_activities: [],
    total_activities: '',
  };

  const url = `https://www.rusprofile.ru/okved/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Универсальное ожидание: либо ЮЛ-структура, либо ИП-структура
  try {
    await page.waitForSelector(
      '.okved-list, .text-box, .content-frame__title',
      { timeout: 15000 }
    );
  } catch {
    console.log('Страница ОКВЭД не загрузилась, возвращаем пустой результат');
    return data;
  }
  await page.waitForTimeout(1000);

  const parsed = await page.evaluate(() => {
    const result: any = {
      industry: '',
      main_activity: '',
      region: '',
      average_revenue: '',
      top_companies: [],
      additional_activities: [],
      total_activities: '',
    };

    // === Определяем формат страницы ===
    const contentFrameTitle = document.querySelector('.content-frame__title')?.textContent?.trim() || '';
    const isIpFormat = contentFrameTitle.includes('Виды деятельности ОКВЭД');

    if (isIpFormat) {
      // === Формат ИП ===
      const totalMatch = contentFrameTitle.match(/\((\d+)\)/);
      if (totalMatch) result.total_activities = totalMatch[1];

      // Собираем заголовки и соответствующие списки
      const titles = document.querySelectorAll('.okved-list-title');
      const lists = document.querySelectorAll('ul.okved-list');

      titles.forEach((titleEl, index) => {
        const titleText = titleEl.textContent?.trim() || '';
        const list = lists[index];
        if (!list) return;

        const items = list.querySelectorAll('li.okved-item');
        items.forEach((li) => {
          const num = li.querySelector('.okved-item__num')?.textContent?.trim() || '';
          const text = li.querySelector('.okved-item__text')?.textContent?.trim() || '';
          if (!num && !text) return;

          if (titleText.startsWith('Основной')) {
            result.main_activity = `${text} (${num})`;
          } else if (titleText.startsWith('Дополнительные')) {
            result.additional_activities.push({ code: num, description: text });
          }
        });
      });

      return result;
    }

    // === Формат ЮЛ (оригинальная логика) ===

    // Отрасль
    const industryBlock = Array.from(document.querySelectorAll('.text-box')).find(el =>
      el.querySelector('.sub-title')?.textContent?.trim() === 'Отрасль'
    );
    if (industryBlock) {
      result.industry = industryBlock.textContent?.replace('Отрасль', '').trim() || '';
    }

    // Основной вид деятельности
    const mainBlock = Array.from(document.querySelectorAll('.text-box')).find(el =>
      el.querySelector('.sub-title')?.textContent?.includes('Основной вид деятельности ОКВЭД')
    );
    if (mainBlock) {
      result.main_activity = mainBlock.textContent?.replace(/Основной вид деятельности ОКВЭД.*/, '').trim() || '';
    }

    // Регион
    const regionBlock = Array.from(document.querySelectorAll('.text-box')).find(el =>
      el.querySelector('.sub-title')?.textContent?.trim() === 'Регион'
    );
    if (regionBlock) {
      result.region = regionBlock.textContent?.replace('Регион', '').trim() || '';
    }

    // Средняя выручка
    const revenueBox = document.querySelector('.number-box');
    if (revenueBox) {
      const numEl = revenueBox.querySelector('.number .num');
      result.average_revenue = numEl ? numEl.textContent?.trim() || '' : '';
    }

    // Топ компаний
    const topList = document.querySelector('ul.okved-list');
    if (topList) {
      const items = topList.querySelectorAll('li.okved-item');
      items.forEach(item => {
        const position = item.querySelector('.okved-item__num')?.textContent?.trim() || '';
        const nameEl = item.querySelector('.okved-item__text .name a');
        const name = nameEl ? nameEl.textContent?.trim() || '' : '';
        const href = nameEl ? (nameEl as HTMLAnchorElement).href || '' : '';
        const revenue = item.querySelector('.okved-item__text .num')?.textContent?.trim() || '';
        if (name || position) {
          result.top_companies.push({ position, name, href, revenue });
        }
      });
    }

    // Дополнительные виды деятельности (ЮЛ)
    result.additional_activities = [];
    const additionalList = document.querySelector('#other');
    if (additionalList) {
      const list = additionalList.nextElementSibling;
      if (list && list.classList.contains('okved-list')) {
        const items = list.querySelectorAll('li.okved-item');
        items.forEach(item => {
          const code = item.querySelector('.okved-item__num')?.textContent?.trim() || '';
          const description = item.querySelector('.okved-item__text')?.textContent?.trim() || '';
          if (code || description) {
            result.additional_activities.push({ code, description });
          }
        });
      }
    }

    return result;
  });

  data.industry = parsed.industry;
  data.main_activity = parsed.main_activity;
  data.region = parsed.region;
  data.average_revenue = parsed.average_revenue;
  data.top_companies = parsed.top_companies;
  data.additional_activities = parsed.additional_activities;
  data.total_activities = parsed.total_activities;

  console.log(`Собрано ОКВЭД: основной="${data.main_activity}", доп. видов: ${data.additional_activities.length}, топ компаний: ${data.top_companies.length}`);
  return data;
}