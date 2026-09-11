// src/main/services/osint/scrapers/rusprofile/search.ts
import { Page } from 'playwright';

export async function getEntityIdByInn(
  page: Page,
  inn: string,
  preferredType?: 'company' | 'entrepreneur' | 'person'
): Promise<{ id: number | string; type: 'company' | 'entrepreneur' | 'person' }> {
  console.log(`DEBUG search: ищем ИНН ${inn}, preferredType=${preferredType}`);

  await page.goto('https://www.rusprofile.ru/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input#autocomplete-main-search', { timeout: 15000 });

  await page.fill('input#autocomplete-main-search', inn);

  // Ждём появления вкладок
  try {
    await page.waitForSelector('.head-drop-results__tabs', { timeout: 5000 });
  } catch {
    // Если вкладок нет, пробуем первую попавшуюся ссылку
    const firstLink = page.locator("a[href*='/id/'], a[href*='/ip/'], a[href*='/person/']").first();
    if (await firstLink.count() > 0) {
      const href = await firstLink.getAttribute('href');
      if (href) {
        const match = href.match(/\/(id|ip|person)\/([^/?]+)/);
        if (match) return normalizeEntity(match[1], match[2]);
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
  const desiredTab = preferredType && tabLabelMap[preferredType] ? tabLabelMap[preferredType] : 'ИП';

  console.log(`DEBUG search: кликаем вкладку "${desiredTab}"`);

  const tab = page.locator(`.head-drop-results__tab:has-text("${desiredTab}")`).first();
  if (await tab.count() === 0) {
    const fallback = ['ИП', 'Физлица', 'Юрлица'].filter(t => t !== desiredTab);
    for (const label of fallback) {
      const fbTab = page.locator(`.head-drop-results__tab:has-text("${label}")`).first();
      if (await fbTab.count() > 0) {
        await fbTab.click();
        await page.waitForTimeout(500);
        break;
      }
    }
  } else {
    await tab.click();
    await page.waitForTimeout(500);
  }

  // Определяем селектор ссылки в зависимости от preferredType
  let linkSelector: string;
  if (preferredType === 'person') {
    linkSelector = '.head-drop-results__list a[href*="/person/"]';
  } else if (preferredType === 'entrepreneur') {
    linkSelector = '.head-drop-results__list a[href*="/ip/"]';
  } else if (preferredType === 'company') {
    linkSelector = '.head-drop-results__list a[href*="/id/"]';
  } else {
    // Если тип не задан, пробуем в порядке приоритета person → ip → id (для 12-значных ИНН)
    linkSelector = '.head-drop-results__list a[href*="/person/"], ' +
                   '.head-drop-results__list a[href*="/ip/"], ' +
                   '.head-drop-results__list a[href*="/id/"]';
  }

  // Ждём появления нужной ссылки
  try {
    await page.waitForSelector(linkSelector, { timeout: 5000 });
  } catch {
    console.warn(`DEBUG search: ссылка по селектору "${linkSelector}" не появилась`);
  }

  const link = page.locator(linkSelector).first();
  if (await link.count() > 0) {
    const href = await link.getAttribute('href');
    console.log(`DEBUG search: найдена ссылка ${href}`);
    if (href) {
      const match = href.match(/\/(id|ip|person)\/([^/?]+)/);
      if (match) {
        return normalizeEntity(match[1], match[2]);
      }
    }
  }

  throw new Error(`Не удалось найти сущность по ИНН ${inn}`);
}

function normalizeEntity(
  segment: string,
  rawId: string
): { id: number | string; type: 'company' | 'entrepreneur' | 'person' } {
  if (segment === 'id') return { id: parseInt(rawId), type: 'company' };
  if (segment === 'ip') return { id: parseInt(rawId), type: 'entrepreneur' };
  return { id: rawId, type: 'person' };
}