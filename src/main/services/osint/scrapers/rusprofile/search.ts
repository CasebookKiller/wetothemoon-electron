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
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // 1. Прямой переход
  const currentUrl = page.url();
  const directMatch = currentUrl.match(/\/(id|ip|person)\/(\d+)/);
  if (directMatch) {
    return { id: parseInt(directMatch[2]), type: directMatch[1] as any };
  }

  // 2. Если есть выпадающий список, пробуем кликнуть вкладку согласно preferredType
  try {
    await page.waitForSelector('.head-drop-results__tabs', { timeout: 5000 });
  } catch {
    // Вкладок нет, ищем первую подходящую ссылку
    const firstLink = page.locator("a[href*='/id/'], a[href*='/ip/'], a[href*='/person/']").first();
    if (await firstLink.count() > 0) {
      const href = await firstLink.getAttribute('href');
      if (href) {
        const match = href.match(/\/(id|ip|person)\/(\d+)/);
        if (match) return { id: parseInt(match[2]), type: match[1] as any };
      }
    }
    throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
  }

  // 3. Определяем порядок вкладок в зависимости от preferredType
  const tabLabels: Record<string, string> = {
    company: 'Юрлица',
    entrepreneur: 'ИП',
    person: 'Физлица',
  };

  let tabsToTry: string[] = [];
  if (preferredType && tabLabels[preferredType]) {
    tabsToTry.push(tabLabels[preferredType]);
  } else {
    // Если тип не задан, пробуем ИП, Физлица, Юрлица (для 12-значного ИНН сначала ИП и Физлица)
    tabsToTry = ['ИП', 'Физлица', 'Юрлица'];
  }

  for (const tabText of tabsToTry) {
    const tab = page.locator(`.head-drop-results__tab:has-text("${tabText}")`).first();
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(500);
      // Ищем ссылку в активной вкладке
      const links = page.locator('.head-drop-results__list a[href*="/id/"], .head-drop-results__list a[href*="/ip/"], .head-drop-results__list a[href*="/person/"]');
      if (await links.count() > 0) {
        const href = await links.first().getAttribute('href');
        if (href) {
          const match = href.match(/\/(id|ip|person)\/(\d+)/);
          if (match) return { id: parseInt(match[2]), type: match[1] as any };
        }
      }
    }
  }

  throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
}