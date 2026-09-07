// src/main/services/osint/scrapers/rusprofile/details/egrul.ts
import { Page } from 'playwright';

// Основная функция сбора для ЕГРЮЛ (детальный список)
export async function collectEgrulDetails(
  page: Page,
  companyId: number,
  options: { maxTotalCases?: number; entityType?: string } = {}
): Promise<any> {
  console.log(`Сбор выписки из ЕГРЮЛ/ЕГРИП для ID ${companyId}, тип: ${options.entityType || 'company'}...`);
  const data: any = { basic_info: {}, sections: [] };

  // Если entityType == 'person', выписка недоступна
  if (options.entityType === 'person') {
    console.log('Для физических лиц выписка ЕГРЮЛ/ЕГРИП не предусмотрена.');
    return data;
  }

  const urlPath = options.entityType === 'entrepreneur' ? 'ip' : 'id';
  const selector = options.entityType === 'entrepreneur' ? '#clip_ogrnip' : '#clip_ogrn';
  const queryParam = options.entityType === 'entrepreneur' ? 'ogrnip' : 'ogrn';

  // Получаем ОГРН/ОГРНИП с карточки
  await page.goto(`https://www.rusprofile.ru/${urlPath}/${companyId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector(selector, { timeout: 15000 });
  const ogrn = await page.locator(selector).first().innerText().catch(() => '');
  if (!ogrn) {
    console.warn('Не удалось получить ОГРН/ОГРНИП с карточки, сбор выписки прерван');
    return data;
  }

  // Переходим на страницу выписки
  await page.goto(`https://www.rusprofile.ru/egrul?${queryParam}=${ogrn}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.tiles-content', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Основная информация (первая таблица на странице)
  const basicInfo = await page.evaluate(() => {
    const info: any = {};
    const firstTable = document.querySelector('.button-tile table.info-table');
    if (firstTable) {
      firstTable.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 3) {
          const label = cells[1]?.textContent?.trim() || '';
          const value = cells[2]?.textContent?.trim() || '';
          if (label) info[label] = value;
        }
      });
    }
    return info;
  });
  data.basic_info = basicInfo;

  // Все секции
  const sections = await page.evaluate(() => {
    const result: any[] = [];
    const content = document.querySelector('.tiles-content');
    if (!content) return result;

    const tileItems = content.querySelectorAll('.tile-item');
    tileItems.forEach(tile => {
      const titleEl = tile.querySelector('.tile-item__title');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';
      if (!title) return;

      const items: any[] = [];
      const tables = tile.querySelectorAll('table.info-table');
      tables.forEach(table => {
        table.querySelectorAll('tbody tr').forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length !== 3) return;

          const num = cells[0]?.textContent?.trim() || '';
          const label = cells[1]?.textContent?.trim() || '';
          const value = cells[2]?.textContent?.trim() || '';

          // Пропускаем полностью пустые строки
          if (!num && !label && !value) return;

          // Если num пустой или &nbsp;, это подзаголовок или пустая строка
          if (!num || num === '&nbsp;') {
            if (label) {
              items.push({ type: 'subtitle', label, value: '' });
            }
            return;
          }

          items.push({ number: num, label, value });
        });
      });

      if (items.length > 0) {
        result.push({ title, items });
      }
    });

    return result;
  });

  data.sections = sections;

  console.log(`Собрано секций выписки: ${data.sections.length}`);
  return data;
}
