// src/main/services/osint/scrapers/rusprofile/details/person/reliability.ts
import { Page } from 'playwright';

export async function collectPersonReliabilityDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор факторов риска для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/reliability`;

  const data: any = {
    personal: [],
    related: [],
    sanctions: [],
  };

  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть /reliability:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница /reliability недоступна (HTTP ${response?.status()})`);
    return data;
  }

  try {
    await page.waitForSelector('.tiles-content, .content-frame, .list-factors', { timeout: 15000 });
  } catch {
    console.log('Структура страницы /reliability не найдена');
    return data;
  }
  await page.waitForTimeout(500);

  const parsed = await page.evaluate(() => {
    const result: any = { personal: [], related: [], sanctions: [] };

    // Собираем список факторов риска
    document.querySelectorAll('.list-factors li').forEach((li) => {
      const text = li.textContent?.trim() || '';
      if (!text) return;
      const icon = li.querySelector('i')?.getAttribute('data-ico') || '';
      const level = icon === 'danger' ? 'danger' : icon === 'warning' ? 'warning' : icon === 'success' ? 'success' : 'info';

      // Определяем раздел: персональные или связанных организаций
      const parent = li.closest('.company-col');
      const sectionTitle = parent?.querySelector('.company-info__title')?.textContent?.trim() || '';

      if (sectionTitle.toLowerCase().includes('персональн')) {
        result.personal.push({ text, level });
      } else if (sectionTitle.toLowerCase().includes('связанн')) {
        result.related.push({ text, level });
      } else {
        result.personal.push({ text, level });
      }
    });

    // Санкции (если есть отдельный блок)
    document.querySelectorAll('.sanctions-block li').forEach((li) => {
      const text = li.textContent?.trim() || '';
      if (text) result.sanctions.push(text);
    });

    return result;
  });

  console.log(`Собрано факторов риска (ФЛ): персональных ${parsed.personal.length}, связанных ${parsed.related.length}`);
  return parsed;
}