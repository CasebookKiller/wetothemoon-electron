// src/main/services/osint/scrapers/rusprofile/details/requisites.ts
import { Page } from 'playwright';

// Основная функция сбора для реквизитов (детальный список)
export async function collectRequisitesDetails(
  page: Page,
  companyId: number,
  options: { maxTotalCases?: number } = {}
): Promise<any> {
  console.log(`Сбор реквизитов для компании ID ${companyId}...`);
  const data: any = { sections: [] };

  const url = `https://www.rusprofile.ru/requisites/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.requisites-list', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Извлекаем все секции
  const sections = await page.evaluate(() => {
    const result: any[] = [];

    // Ищем заголовки секций (tile-item__title или requisites-list__date-title)
    // и соответствующие им списки requisites-list
    const container = document.querySelector('.main-wrap__content');
    if (!container) return result;

    // Последовательно обходим дочерние элементы, запоминая текущий заголовок
    let currentTitle = '';
    const childNodes = Array.from(container.children);
    for (const node of childNodes) {
      if (node.classList.contains('tile-item__title') || node.classList.contains('requisites-list__date-title')) {
        currentTitle = node.textContent?.trim() || '';
      } else if (node.classList.contains('tile-item__subtitle')) {
        // Можно добавить как подзаголовок внутри текущей секции (если нужно)
        if (result.length > 0) {
          result[result.length - 1].subtitle = node.textContent?.trim() || '';
        }
      } else if (node.classList.contains('requisites-list')) {
        const items: any[] = [];
        const liElements = node.querySelectorAll('li.requisites-item');
        liElements.forEach(li => {
          const name = li.querySelector('.requisites-item__name')?.textContent?.trim() || '';
          const valueEl = li.querySelector('.requisites-item__value');
          let value = valueEl ? valueEl.textContent?.replace(/\s+/g, ' ').trim() || '' : '';
          // Удаляем текст кнопки "Cкопировать"
          value = value.replace(/Cкопировать/g, '').trim();
          // Если есть отдельный span.copy-value, берём его текст
          const copySpan = valueEl?.querySelector('.copy-value');
          if (copySpan) {
            value = copySpan.textContent?.trim() || value;
          }
          if (name || value) {
            items.push({ name, value });
          }
        });
        if (items.length > 0) {
          result.push({ title: currentTitle || 'Без заголовка', items });
        }
      }
    }

    return result;
  });

  data.sections = sections;

  console.log(`Собрано секций реквизитов: ${data.sections.length}`);
  return data;
}