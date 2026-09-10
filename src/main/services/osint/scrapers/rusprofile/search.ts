// src/main/services/osint/scrapers/rusprofile/search.ts
import { Page } from 'playwright';

export async function getEntityIdByInn(
  page: Page,
  inn: string,
  preferredType?: 'company' | 'entrepreneur' | 'person'
): Promise<{ id: number; type: 'company' | 'entrepreneur' | 'person' }> {
  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input#autocomplete-main-search', { timeout: 15000 });

  await page.fill('input#autocomplete-main-search', inn);

  try {
    await page.waitForSelector('.head-drop-results__tabs', { timeout: 5000 });
  } catch {
    // Выпадающий список не появился — пробуем первую попавшуюся ссылку
    const firstLink = page.locator("a[href*='/id/'], a[href*='/ip/'], a[href*='/person/']").first();
    if (await firstLink.count() > 0) {
      const href = await firstLink.getAttribute('href');
      if (href) {
        const match = href.match(/\/(id|ip|person)\/([^/?]+)/);
        if (match) {
          return normalizeEntity(match[1], match[2]);
        }
      }
    }
    throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
  }

  // Определяем, какую вкладку активировать
  const tabLabelMap: Record<string, string> = {
    company: 'Юрлица',
    entrepreneur: 'ИП',
    person: 'Физлица',
  };

  let desiredTab = '';
  if (preferredType && tabLabelMap[preferredType]) {
    desiredTab = tabLabelMap[preferredType];
  } else {
    desiredTab = 'ИП';
  }

  const tab = page.locator(`.head-drop-results__tab:has-text("${desiredTab}")`).first();
  if (await tab.count() === 0) {
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
        // Переходим на карточку
        await page.goto(`https://www.rusprofile.ru${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        return normalizeEntity(match[1], match[2]);
      }
    }
  }

  throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
}

/**
 * Преобразует URL-сегмент (id/ip/person) и идентификатор в нормализованный тип.
 * Для физических лиц ID пока не числовой — возвращаем 0.
 */
function normalizeEntity(
  segment: string,
  rawId: string
): { id: number; type: 'company' | 'entrepreneur' | 'person' } {
  if (segment === 'id') return { id: parseInt(rawId), type: 'company' };
  if (segment === 'ip') return { id: parseInt(rawId), type: 'entrepreneur' };
  // person — пока возвращаем 0, тип 'person'
  return { id: 0, type: 'person' };
}