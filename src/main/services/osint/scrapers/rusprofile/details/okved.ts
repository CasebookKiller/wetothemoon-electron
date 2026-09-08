// src/main/services/osint/scrapers/rusprofile/details/okved.ts
import { Page } from 'playwright';

// Основная функция сбора для оквед (детальный список)
export async function collectOkvedDetails(
  page: Page,
  companyId: number,
  options: { maxTotalCases?: number } = {}
): Promise<any> {
  console.log(`Сбор видов деятельности для компании ID ${companyId}...`);
  const data: any = { industry: '', main_activity: '', region: '', average_revenue: '', top_companies: [], additional_activities: [] };

  const url = `https://www.rusprofile.ru/okved/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.okved-list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Извлекаем данные
  const parsed = await page.evaluate(() => {
    const result: any = {};

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
    const topCompanies: any[] = [];
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
          topCompanies.push({ position, name, href, revenue });
        }
      });
    }
    result.top_companies = topCompanies;

    // Дополнительные виды деятельности
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

  console.log(`Собрано ОКВЭД: отрасль "${data.industry}", доп. видов: ${data.additional_activities.length}, топ компаний: ${data.top_companies.length}`);
  return data;
}