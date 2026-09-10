// src/main/services/osint/scrapers/rusprofile/details/requisites.ts
import { Page } from 'playwright';

export async function collectRequisitesDetails(
  page: Page,
  companyId: number,
  options: { maxTotalCases?: number } = {}
): Promise<any> {
  console.log(`Сбор реквизитов для компании ID ${companyId}...`);
  const data: any = { sections: [] };

  const url = `https://www.rusprofile.ru/requisites/${companyId}`;

  // Проверяем доступность страницы (у ИП её может не быть — 404)
  let response: any = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('Не удалось открыть страницу реквизитов:', e);
    return data;
  }

  if (!response || response.status() === 404) {
    console.log(`Страница реквизитов недоступна (HTTP ${response?.status()}). Пропускаем.`);
    return data;
  }

  // Ожидание структуры (могут быть разные варианты)
  try {
    await page.waitForSelector('.requisites-list, .requisites-ip, .content-frame', { timeout: 10000 });
  } catch {
    console.log('Структура страницы реквизитов не найдена, возвращаем пустой результат');
    return data;
  }
  await page.waitForTimeout(500);

  // === Вариант 1: ЮЛ — секции .requisites-list с .requisites-item ===
  const sectionsFromUl = await page.evaluate(() => {
    const result: any[] = [];
    const container = document.querySelector('.main-wrap__content');
    if (!container) return result;

    let currentTitle = '';
    const childNodes = Array.from(container.children);
    for (const node of childNodes) {
      if (node.classList.contains('tile-item__title') || node.classList.contains('requisites-list__date-title')) {
        currentTitle = node.textContent?.trim() || '';
      } else if (node.classList.contains('tile-item__subtitle')) {
        if (result.length > 0) {
          result[result.length - 1].subtitle = node.textContent?.trim() || '';
        }
      } else if (node.classList.contains('requisites-list')) {
        const items: any[] = [];
        node.querySelectorAll('li.requisites-item').forEach((li) => {
          const name = li.querySelector('.requisites-item__name')?.textContent?.trim() || '';
          const valueEl = li.querySelector('.requisites-item__value');
          let value = valueEl ? valueEl.textContent?.replace(/\s+/g, ' ').trim() || '' : '';
          value = value.replace(/Cкопировать/g, '').trim();
          const copySpan = valueEl?.querySelector('.copy-value');
          if (copySpan) value = copySpan.textContent?.trim() || value;
          if (name || value) items.push({ name, value });
        });
        if (items.length > 0) result.push({ title: currentTitle || 'Без заголовка', items });
      }
    }
    return result;
  });

  if (sectionsFromUl.length > 0) {
    data.sections = sectionsFromUl;
    console.log(`Собрано секций реквизитов (ЮЛ): ${data.sections.length}`);
    return data;
  }

  // === Вариант 2: ИП — секции .requisites-ip с dt/dd ===
  const sectionsFromIp = await page.evaluate(() => {
    const result: any[] = [];
    document.querySelectorAll('.requisites-ip').forEach((block) => {
      const title = block.querySelector('.requisites-ip__title')?.textContent?.trim() || '';
      const items: any[] = [];
      block.querySelectorAll('dl.requisites-ip__list').forEach((dl) => {
        const name = dl.querySelector('dt')?.textContent?.trim() || '';
        const value = dl.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (name || value) items.push({ name, value });
      });
      if (items.length > 0) result.push({ title: title || 'Без заголовка', items });
    });
    return result;
  });

  data.sections = sectionsFromIp;
  console.log(`Собрано секций реквизитов (ИП): ${data.sections.length}`);
  return data;
}