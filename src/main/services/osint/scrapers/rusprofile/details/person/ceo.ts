import { Page } from 'playwright';

export async function collectPersonCeoDetails(page: Page, slug: string): Promise<any> {
  console.log(`Сбор руководителя для ФЛ ${slug}...`);
  const url = `https://www.rusprofile.ru/person/${slug}/ceo`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    console.warn('Не удалось открыть /ceo:', e);
    return { organizations: [] };
  }
  return { organizations: [] }; // TODO: реализовать парсинг
}