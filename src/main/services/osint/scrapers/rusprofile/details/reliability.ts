// src/main/services/osint/scrapers/rusprofile/details/reliability.ts
import { Page } from 'playwright';

// Основная функция сбора для надежности (детальный список)
export async function collectReliabilityDetails(
  page: Page,
  companyId: number,
  options: { maxTotalCases?: number } = {}
): Promise<any> {
  console.log(`Сбор надёжности для компании ID ${companyId}...`);
  const data: any = { rating: '', groups: [], recommendations: [], bottom_text: '' };

  const url = `https://www.rusprofile.ru/reliability/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.facts', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // === Раскрываем все блоки «Еще факты» ===
  const moreButtons = page.locator('.facts__more');
  const moreCount = await moreButtons.count();
  for (let i = 0; i < moreCount; i++) {
    try {
      await moreButtons.nth(i).click({ force: true });
      await page.waitForTimeout(500);
    } catch (e) {
      console.warn(`Не удалось раскрыть "Еще факты" #${i}:`, e);
    }
  }

  // === Раскрываем все аккордеоны (клик по заголовку) ===
  const accordionHeaders = page.locator('.accordion__header');
  const headerCount = await accordionHeaders.count();
  for (let i = 0; i < headerCount; i++) {
    try {
      await accordionHeaders.nth(i).click({ force: true });
      await page.waitForTimeout(300);
    } catch (e) {
      console.warn(`Не удалось раскрыть аккордеон #${i}:`, e);
    }
  }
  await page.waitForTimeout(1000); // даём время на полное раскрытие

  // === Извлекаем данные ===
  const result = await page.evaluate(() => {
    // Рейтинг
    const ratingEl = document.querySelector('.rating');
    const rating = ratingEl ? ratingEl.textContent?.trim() || '' : '';

    // Группы фактов (например, "Риски неисполнения обязательств: незначительные")
    const groups: any[] = [];
    const factItems = document.querySelectorAll('.facts__item');
    factItems.forEach((groupEl) => {
      const titleEl = groupEl.querySelector('.facts__title');
      let groupTitle = '';
      let groupValue = '';
      if (titleEl) {
        const spans = titleEl.querySelectorAll('span');
        if (spans.length >= 2) {
          groupTitle = spans[0].textContent?.trim() || '';
          groupValue = spans[1].textContent?.trim() || '';
        } else {
          groupTitle = titleEl.textContent?.trim() || '';
        }
      }
      const intro = groupEl.querySelector('.facts__intro')?.textContent?.trim() || '';

      const facts: any[] = [];
      const accordionItems = groupEl.querySelectorAll('.accordion__item');
      accordionItems.forEach((item) => {
        const type = item.getAttribute('type') || '';
        const titleSpan = item.querySelector('.accordion__title');
        const fullTitle = titleSpan ? titleSpan.textContent?.trim() || '' : '';
        const valueSpan = titleSpan ? titleSpan.querySelector('span') : null;
        const value = valueSpan ? valueSpan.textContent?.trim() || '' : '';
        const headerText = fullTitle.replace(value, '').replace(/:\s*$/, '').trim();
        const body = item.querySelector('.accordion__body p')?.textContent?.trim() || '';

        facts.push({ type, header: headerText, value, body });
      });

      groups.push({ title: groupTitle, value: groupValue, intro, facts });
    });

    // Блок «Рекомендуем проверить самостоятельно»
    const recommendations: string[] = [];
    document.querySelectorAll('.info-block .item .text').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text) recommendations.push(text);
    });

    // Нижний текст
    const bottomText = document.querySelector('.bottom-block')?.textContent?.trim() || '';

    return { rating, groups, recommendations, bottom_text: bottomText };
  });

  data.rating = result.rating;
  data.groups = result.groups;
  data.recommendations = result.recommendations;
  data.bottom_text = result.bottom_text;

  console.log(`Собрано групп фактов: ${data.groups.length}`);
  return data;
}