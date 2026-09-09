// src/main/services/osint/scrapers/rusprofile/search.ts
import { Page } from 'playwright';

export async function getEntityIdByInn(
  page: Page,
  inn: string,
  preferredType?: 'company' | 'entrepreneur' | 'person'
): Promise<{ id: number; type: 'company' | 'entrepreneur' | 'person' }> {
  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input#autocomplete-main-search', { timeout: 15000 });

  // Вводим ИНН без нажатия Enter
  await page.fill('input#autocomplete-main-search', inn);
  // Ждём появления выпадающего списка (обычно 1-2 секунды)
  try {
    await page.waitForSelector('.head-drop-results__tabs', { timeout: 5000 });
  } catch {
    // Если выпадающий список не появился, пробуем обычный поиск по первой ссылке
    const firstLink = page.locator("a[href*='/id/'], a[href*='/ip/'], a[href*='/person/']").first();
    if (await firstLink.count() > 0) {
      const href = await firstLink.getAttribute('href');
      if (href) {
        const match = href.match(/\/(id|ip|person)\/([^/?]+)/);
        if (match) {
          return {
            id: match[1] === 'person' ? 0 : parseInt(match[2]), // для person пока не поддерживаем
            type: match[1] as any,
          };
        }
      }
    }
    throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
  }

  // Определяем, какую вкладку нужно активировать
  const tabLabelMap: Record<string, string> = {
    company: 'Юрлица',
    entrepreneur: 'ИП',
    person: 'Физлица',
  };

  let desiredTab = '';
  if (preferredType && tabLabelMap[preferredType]) {
    desiredTab = tabLabelMap[preferredType];
  } else {
    // Если тип не задан, пробуем в порядке: ИП, Физлица, Юрлица (для 12-значного ИНН сначала ИП)
    desiredTab = 'ИП';
  }

  // Кликаем нужную вкладку, если она есть
  const tab = page.locator(`.head-drop-results__tab:has-text("${desiredTab}")`).first();
  if (await tab.count() === 0) {
    // Если желаемой вкладки нет, пробуем остальные
    const fallbackTabs = ['ИП', 'Физлица', 'Юрлица'].filter(t => t !== desiredTab);
    for (const label of fallbackTabs) {
      const fallbackTab = page.locator(`.head-drop-results__tab:has-text("${label}")`).first();
      if (await fallbackTab.count() > 0) {
        await fallbackTab.click();
        await page.waitForTimeout(500);
        break;
      }
    }
  } else {
    await tab.click();
    await page.waitForTimeout(500);
  }

  // Извлекаем ссылку из активного списка
  const link = page.locator('.head-drop-results__list a[href*="/ip/"], .head-drop-results__list a[href*="/id/"], .head-drop-results__list a[href*="/person/"]').first();
  if (await link.count() > 0) {
    const href = await link.getAttribute('href');
    if (href) {
      const match = href.match(/\/(id|ip|person)\/([^/?]+)/);
      if (match) {
        // Переходим по ссылке для загрузки карточки
        await page.goto(`https://www.rusprofile.ru${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        return {
          id: match[1] === 'person' ? 0 : parseInt(match[2]), // person пока не поддерживаем числовым id
          type: match[1] as any,
        };
      }
    }
  }

  throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
}