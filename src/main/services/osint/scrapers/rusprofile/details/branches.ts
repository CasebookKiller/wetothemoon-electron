// src/main/services/osint/scrapers/rusprofile/details/branches.ts
import { Page } from 'playwright';

// Основная функция сбора для филиалов (детальный список)
export async function collectBranchesDetails(
  page: Page,
  companyId: number | string,
  options: { maxTotalCases?: number } = {}
): Promise<any> {
  console.log(`Сбор филиалов и представительств для компании ID ${companyId}...`);
  const data: any = { total_branches: '', branches: [] };

  const url = `https://www.rusprofile.ru/branches/${companyId}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.branches-company-items', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Заголовок с количеством
  try {
    const header = await page.locator('.content-frame__title').first().innerText();
    const m = header.match(/\((\d+)\)/);
    if (m) data.total_branches = m[1];
  } catch (e) {
    console.log('Не удалось получить общее количество филиалов:', e);
  }

  const maxTotalCases = options.maxTotalCases || 100;
  let collected = 0;

  // Все элементы находятся в контейнере .branches-company-items
  const items = page.locator('.branches-company-items .company-item');
  const itemCount = await items.count();

  for (let i = 0; i < itemCount && collected < maxTotalCases; i++) {
    const item = items.nth(i);
    const branch: any = {};

    // Извлекаем данные
    const parsed = await item.evaluate((el) => {
      const name = el.querySelector('.company-item__name')?.textContent?.trim() || '';
      const address = el.querySelector('.company-item-info dd')?.textContent?.trim() || '';

      // Координаты из data-placemark
      const placemarkAttr = el.getAttribute('data-placemark') || '';
      let coordinates = null;
      if (placemarkAttr) {
        try {
          coordinates = JSON.parse(placemarkAttr);
        } catch (e) {
          // игнорируем
        }
      }

      return { name, address, coordinates };
    });

    branch.name = parsed.name;
    branch.address = parsed.address;
    branch.latitude = parsed.coordinates?.latitude || '';
    branch.longitude = parsed.coordinates?.longitude || '';

    if (branch.name || branch.address) {
      data.branches.push(branch);
      collected++;
    }
  }

  console.log(`Собрано филиалов/представительств: ${data.branches.length}, всего: ${data.total_branches}`);
  return data;
}
